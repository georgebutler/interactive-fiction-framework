import type { StoryEvent, StoryNode } from '@/framework/schema'
import type { MemorySnapshot } from '@/framework/memory'
import { selectNarrativePattern } from '@/framework/patterns'
import type { NarrativePattern, StoryBible } from '@/framework/story-bible'

export type SceneType = 'investigation' | 'social' | 'travel' | 'danger' | 'discovery' | 'revelation'

export type DirectorState = {
  currentTension: number
  storyMomentum: number
  recentSceneTypes: SceneType[]
  mysteriesIntroduced: string[]
  mysteriesResolved: string[]
  factionInfluence: Record<string, number>
}

export type DirectorOutput = {
  sceneType: SceneType
  purpose: string
  tension: number
  pattern: NarrativePattern
  involvedNpcIds: string[]
  adaptedEventId?: string
}

export type DirectorInput = {
  bible: StoryBible
  currentNode: StoryNode
  candidateEvents: StoryEvent[]
  recentEventIds: string[]
  memory: MemorySnapshot
  flags: Record<string, boolean>
  directorState: DirectorState
  rngValue: number
}

function clampTension(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function classifySceneType(node: StoryNode, event?: StoryEvent): SceneType {
  if (node.nodeType === 'court') {
    return 'revelation'
  }

  if (node.nodeType === 'crypt' || node.nodeType === 'ritual') {
    return 'danger'
  }

  if (node.nodeType === 'hazard') {
    return 'danger'
  }

  if (event?.npcTemplate) {
    return 'social'
  }

  if (event?.choices.some((choice) => choice.mode === 'ask' || choice.skillTags.includes('grave-lore'))) {
    return 'investigation'
  }

  if (event?.objectiveNodeId && event.objectiveNodeId !== node.id) {
    return 'travel'
  }

  return 'discovery'
}

function chooseEvent(input: DirectorInput) {
  const freshEvents = input.candidateEvents.filter((event) => !input.recentEventIds.includes(event.id))
  const pool = freshEvents.length > 0 ? freshEvents : input.candidateEvents

  if (pool.length === 0) {
    return undefined
  }

  const totalWeight = pool.reduce((total, event) => total + Math.max(0, event.weight), 0)
  let roll = input.rngValue * (totalWeight || pool.length)

  for (const event of pool) {
    roll -= totalWeight > 0 ? Math.max(0, event.weight) : 1
    if (roll <= 0) {
      return event
    }
  }

  return pool[pool.length - 1]
}

export function chooseDirectorBeat(input: DirectorInput): DirectorOutput {
  const event = chooseEvent(input)
  const sceneType = classifySceneType(input.currentNode, event)
  const rememberedPressure = input.memory.canonicalMemory.length + input.memory.rumorMemory.length
  const nodePressure = input.currentNode.nodeType === 'crypt' || input.currentNode.nodeType === 'court' ? 16 : input.currentNode.nodeType === 'hazard' ? 10 : 4
  const tension = clampTension(input.directorState.currentTension + nodePressure + rememberedPressure)
  const pattern = selectNarrativePattern({
    hasNpc: Boolean(event?.npcTemplate),
    hasRisk: Boolean(event?.choices.some((choice) => choice.mode === 'risk')),
    hasDiscovery: sceneType === 'investigation' || sceneType === 'discovery' || sceneType === 'revelation',
    nodeType: input.currentNode.nodeType,
    tension,
  })

  const mysteryPressure = input.bible.mysteries.find((mystery) => !input.directorState.mysteriesResolved.includes(mystery.id))
  const purpose = event
    ? `${event.prompt} Director purpose: ${sceneType} scene that ${pattern.purpose}${mysteryPressure ? ` while keeping pressure on ${mysteryPressure.question}` : ''}.`
    : `Create a ${sceneType} scene at ${input.currentNode.publicName} that ${pattern.purpose}.`

  return {
    sceneType,
    purpose,
    tension,
    pattern,
    involvedNpcIds: event?.npcTemplate ? [event.npcTemplate.id] : [],
    adaptedEventId: event?.id,
  }
}

export function createInitialDirectorState(bible: StoryBible): DirectorState {
  return {
    currentTension: 20,
    storyMomentum: 0,
    recentSceneTypes: [],
    mysteriesIntroduced: bible.mysteries.slice(0, 2).map((mystery) => mystery.id),
    mysteriesResolved: [],
    factionInfluence: Object.fromEntries(bible.factions.map((faction) => [faction.id, faction.reputation ?? 0])),
  }
}
