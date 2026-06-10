import type { PlayableCharacter, StoryChoice, StoryEffect, StoryEvent, StoryNode } from '@/framework/schema'
import type { DirectorOutput, SceneType } from '@/framework/director'
import type { MemorySnapshot } from '@/framework/memory'
import { defaultRequiredChoiceMix, validateChoiceMix } from '@/framework/patterns'
import type { ChoiceIntent, ChoiceIntentCategory, SimulationUpdate, StoryBible } from '@/framework/story-bible'

export type ProceduralScenePlan = {
  id: string
  objective: string
  sceneType: SceneType
  involvedNpcIds: string[]
  discoveries: string[]
  complications: string[]
  opportunity: string
  tension: number
  patternId: string
  adaptedEvent?: StoryEvent
  choiceIntents: ChoiceIntent[]
  deterministicEffectsByChoiceId: Record<string, StoryEffect[]>
  simulationUpdatesByChoiceId: Record<string, SimulationUpdate>
  warnings: string[]
}

function categoryForChoice(choice: StoryChoice): ChoiceIntentCategory {
  if (choice.mode === 'ask' || choice.skillTags.includes('grave-lore')) {
    return 'investigate'
  }

  if (choice.mode === 'say') {
    return 'social'
  }

  if (choice.mode === 'risk') {
    return 'risk'
  }

  if (choice.mode === 'wait') {
    return 'observe'
  }

  if (choice.mode === 'use-item') {
    return 'resource'
  }

  return choice.skillTags.length > 0 ? 'character' : 'travel'
}

export function adaptAuthoredChoicesToChoiceIntents(event: StoryEvent): ChoiceIntent[] {
  return event.choices.map((choice) => ({
    id: choice.id,
    label: choice.label,
    category: categoryForChoice(choice),
    target: event.objectiveNodeId ?? event.id,
    objective: choice.writerIntent,
    mode: choice.mode,
    displayStyle: choice.displayStyle,
    skillTags: choice.skillTags,
    requiresItem: choice.requiresItem,
    neutralSummary: choice.neutralSummary,
    writerIntent: choice.writerIntent,
    actionPrompt: choice.actionPrompt,
    deterministicEffects: choice.effects ?? [],
    sourceChoiceId: choice.id,
  }))
}

function createSupportIntent(input: { event?: StoryEvent; node: StoryNode; player: PlayableCharacter; category: ChoiceIntentCategory }): ChoiceIntent {
  const baseId = input.event?.id ?? input.node.id
  const target = input.event?.objectiveNodeId ?? input.node.id
  const skill = input.category === 'character' ? input.player.skillTags[0] : undefined

  const templates: Record<ChoiceIntentCategory, Pick<ChoiceIntent, 'label' | 'mode' | 'displayStyle' | 'neutralSummary' | 'writerIntent' | 'actionPrompt'>> = {
    investigate: {
      label: 'What detail is everyone stepping around?',
      mode: 'ask',
      displayStyle: 'dialogue',
      neutralSummary: 'You pushed the scene toward a concrete clue instead of accepting its surface explanation.',
      writerIntent: 'Offer an investigative no-effect question that seeks information without resolving the mystery early.',
      actionPrompt: 'The selected option is to ask the exact question in the choice label and press the scene for one visible clue that fits the current plan.',
    },
    social: {
      label: 'Let us keep this careful and open.',
      mode: 'say',
      displayStyle: 'dialogue',
      neutralSummary: 'You kept the moment from collapsing into threat or silence.',
      writerIntent: 'Offer a safe spoken line that preserves agency and keeps information possible.',
      actionPrompt: 'The selected option is to say the exact line in the choice label so the scene remains open to more than one outcome.',
    },
    travel: {
      label: 'Prepare the next step without rushing it',
      mode: 'act',
      displayStyle: 'action',
      neutralSummary: 'You made practical preparations before committing to the road.',
      writerIntent: 'Offer a safe travel-oriented option with no direct state movement unless listed consequences say so.',
      actionPrompt: 'The selected option is to prepare for movement while staying within the current location and plan.',
    },
    observe: {
      label: 'Hold still and let the scene show its pattern',
      mode: 'wait',
      displayStyle: 'passive',
      neutralSummary: 'You paused long enough for one visible pattern in the scene to stand out.',
      writerIntent: 'Offer a safe observation option that gathers atmosphere and opportunity without state mutation.',
      actionPrompt: 'The selected option is to wait and observe until one visible pattern becomes clear.',
    },
    risk: {
      label: 'Force the moment before it settles against you',
      mode: 'risk',
      displayStyle: 'action',
      neutralSummary: 'You chose pressure and exposure over caution.',
      writerIntent: 'Offer a risky no-effect option that increases dramatic pressure without inventing mechanical success.',
      actionPrompt: 'The selected option is to force the issue in a way that creates visible danger but no unapproved state change.',
    },
    resource: {
      label: 'Check what can be risked or spared',
      mode: 'act',
      displayStyle: 'action',
      neutralSummary: 'You measured tools, proof, and leverage before spending anything.',
      writerIntent: 'Offer a resource-awareness option without consuming inventory unless listed consequences say so.',
      actionPrompt: 'The selected option is to assess available resources and what they might safely do.',
    },
    character: {
      label: `Let ${input.player.firstName}'s hard-earned instincts guide the read`,
      mode: 'act',
      displayStyle: 'action',
      neutralSummary: `${input.player.firstName} leaned on personal training and history without letting it decide the whole scene.`,
      writerIntent: 'Offer a character-focused option that colors approach through the selected protagonist without changing story-critical state.',
      actionPrompt: 'The selected option is to use the protagonist’s authored strengths, history, and visible habits to frame the approach.',
    },
  }

  const template = templates[input.category]

  return {
    id: `${baseId}-procedural-${input.category}`,
    label: template.label,
    category: input.category,
    target,
    objective: template.writerIntent,
    mode: template.mode,
    displayStyle: template.displayStyle,
    skillTags: skill ? [skill] : [],
    neutralSummary: template.neutralSummary,
    writerIntent: template.writerIntent,
    actionPrompt: template.actionPrompt,
    deterministicEffects: [],
  }
}

function completeChoiceMix(input: { choices: ChoiceIntent[]; event?: StoryEvent; node: StoryNode; player: PlayableCharacter }) {
  const choices = [...input.choices]
  const requiredCategories: ChoiceIntentCategory[] = ['observe', 'investigate', 'risk', 'character']

  for (const category of requiredCategories) {
    if (!choices.some((choice) => choice.category === category)) {
      choices.push(createSupportIntent({ event: input.event, node: input.node, player: input.player, category }))
    }
  }

  return choices.slice(0, Math.max(defaultRequiredChoiceMix.minimumChoices, choices.length))
}

function createSimulationUpdate(intent: ChoiceIntent): SimulationUpdate {
  if (intent.category === 'risk') {
    return { tensionDelta: 8 }
  }

  if (intent.category === 'observe' || intent.category === 'investigate') {
    return { tensionDelta: -2 }
  }

  if (intent.category === 'social') {
    return { tensionDelta: -1 }
  }

  return {}
}

export function planScene(input: {
  bible: StoryBible
  currentNode: StoryNode
  player: PlayableCharacter
  director: DirectorOutput
  adaptedEvent?: StoryEvent
  memory: MemorySnapshot
  flags: Record<string, boolean>
}): ProceduralScenePlan {
  const adaptedChoices = input.adaptedEvent ? adaptAuthoredChoicesToChoiceIntents(input.adaptedEvent) : []
  const choiceIntents = completeChoiceMix({ choices: adaptedChoices, event: input.adaptedEvent, node: input.currentNode, player: input.player })
  const deterministicEffectsByChoiceId = Object.fromEntries(choiceIntents.map((intent) => [intent.id, intent.deterministicEffects]))
  const simulationUpdatesByChoiceId = Object.fromEntries(choiceIntents.map((intent) => [intent.id, createSimulationUpdate(intent)]))
  const clueMystery = input.bible.mysteries.find((mystery) => mystery.knownClues.length > 0)

  return {
    id: `plan-${input.currentNode.id}-${input.adaptedEvent?.id ?? 'procedural'}`,
    objective: input.director.purpose,
    sceneType: input.director.sceneType,
    involvedNpcIds: input.director.involvedNpcIds,
    discoveries: clueMystery ? clueMystery.knownClues.slice(0, 2) : input.memory.rumorMemory.slice(0, 2).map((atom) => atom.text),
    complications: [input.director.pattern.instruction],
    opportunity: input.adaptedEvent?.currentHint ?? `Find a meaningful way through ${input.currentNode.publicName}.`,
    tension: input.director.tension,
    patternId: input.director.pattern.id,
    adaptedEvent: input.adaptedEvent,
    choiceIntents,
    deterministicEffectsByChoiceId,
    simulationUpdatesByChoiceId,
    warnings: validateChoiceMix(choiceIntents),
  }
}

export function choiceIntentToStoryChoice(intent: ChoiceIntent): StoryChoice {
  return {
    id: intent.id,
    intentId: intent.id,
    generatedIntent: !intent.sourceChoiceId,
    label: intent.label,
    mode: intent.mode,
    displayStyle: intent.displayStyle,
    skillTags: intent.skillTags,
    requiresItem: intent.requiresItem,
    writerIntent: intent.writerIntent,
    neutralSummary: intent.neutralSummary,
    actionPrompt: intent.actionPrompt,
    effects: intent.deterministicEffects,
  }
}
