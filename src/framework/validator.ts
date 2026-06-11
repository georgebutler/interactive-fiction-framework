import { z } from 'zod'
import type { StoryChoice, StoryEffect } from '@/framework/schema'
import type { ProceduralScenePlan } from '@/framework/planner'

export const generatedChoiceSchema = z.strictObject({
  intentId: z.string().min(1),
  label: z.string().min(1).max(160),
  presentationHint: z.string().min(1).max(260).optional(),
})

export const generatedSceneSchema = z.strictObject({
  summary: z.string().min(1).max(700),
  visibleFacts: z.array(z.string().min(1).max(260)).max(8).default([]),
  discoveries: z.array(z.string().min(1).max(260)).max(6).default([]),
  opportunities: z.array(z.string().min(1).max(260)).max(6).default([]),
  npcMentions: z.array(z.string().min(1).max(120)).max(8).default([]),
  mood: z.string().min(1).max(200),
  generatedChoices: z.array(generatedChoiceSchema).min(1).max(6),
})

export type GeneratedScene = z.infer<typeof generatedSceneSchema>

export type SceneValidationResult = {
  scene: GeneratedScene
  ok: boolean
  warnings: string[]
  errors: string[]
  repaired: boolean
}

const forbiddenKeys = ['effect', 'effects', 'flags', 'inventory', 'itemsGained', 'itemsLost', 'moveToNode', 'currentNodeId', 'relationshipDelta', 'reputationDelta', 'questStatus', 'tensionDelta', 'victory', 'defeat', 'newNpc', 'newLocation', 'newExit']
const mutationClaims = [/\byou obtain\b/i, /\byou gain\b/i, /\byou lose\b/i, /\badded to your inventory\b/i, /\bthe flag\b/i, /\byou travel to\b/i, /\byou arrive at\b/i]
const mindReadingClaims = [/\byou realize\b/i, /\byou decide\b/i, /\byou feel\b/i, /\byou understand\b/i, /\byou know\b/i]
const spoilerClaims = [/\bwill betray\b/i, /\bwill die\b/i, /\bin the end\b/i, /\blater,?\s+you\b/i]
const internalAuthoringClaims = [
  /\bDirector purpose\b/i,
  /\bdirector goal\b/i,
  /\bplanner\b/i,
  /\bdebug\b/i,
  /\bdiagnostic\b/i,
  /\bschema\b/i,
  /\bJSON\b/i,
  /\bobjective=/i,
  /\btarget=/i,
  /\bintentId\b/i,
  /\bpressure rating\b/i,
  /\bhidden rules?\b/i,
  /\bwriter guidance\b/i,
  /\bmechanical effects?\b/i,
  /\bdeterministic effects?\b/i,
]

function stripFences(raw: string) {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
}

function extractFirstJsonObject(raw: string) {
  const text = stripFences(raw)
  const firstBrace = text.indexOf('{')

  if (firstBrace < 0) {
    return text
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = firstBrace; index < text.length; index += 1) {
    const character = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        inString = false
      }

      continue
    }

    if (character === '"') {
      inString = true
    } else if (character === '{') {
      depth += 1
    } else if (character === '}') {
      depth -= 1

      if (depth === 0) {
        return text.slice(firstBrace, index + 1)
      }
    }
  }

  return text
}

function collectObjectKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectObjectKeys)
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [key, ...collectObjectKeys(child)])
}

function sceneText(scene: GeneratedScene) {
  return [scene.summary, ...scene.visibleFacts, ...scene.discoveries, ...scene.opportunities, ...scene.npcMentions, scene.mood, ...scene.generatedChoices.map((choice) => `${choice.label} ${choice.presentationHint ?? ''}`)].join('\n')
}

export function buildFallbackScene(input: { plan: ProceduralScenePlan; currentPlace: string }): GeneratedScene {
  const firstComplication = input.plan.complications[0]
  const firstDiscovery = input.plan.discoveries[0]

  return {
    summary: `${input.currentPlace} does not offer a clean answer. The scene settles into visible details, competing interpretations, and one practical opening forward.`,
    visibleFacts: input.plan.complications.slice(0, 2),
    discoveries: input.plan.discoveries.slice(0, 2),
    opportunities: [input.plan.opportunity],
    npcMentions: input.plan.involvedNpcIds,
    mood: firstComplication || firstDiscovery ? 'Every answer in reach still leaves another witness, record, or wound resisting it.' : 'The next move matters because no single explanation owns the room yet.',
    generatedChoices: input.plan.choiceIntents.slice(0, 4).map((choice) => ({ intentId: choice.id, label: choice.label, presentationHint: 'This remains one visible way to press the scene.' })),
  }
}

function isPassiveChoice(choice: Pick<StoryChoice, 'mode' | 'displayStyle'>) {
  return choice.mode === 'wait' || choice.displayStyle === 'passive'
}

function fallbackResolutionSummary(input: { choice: Pick<StoryChoice, 'label' | 'mode' | 'displayStyle'>; currentPlace: string }) {
  if (isPassiveChoice(input.choice)) {
    return `At ${input.currentPlace}, stillness gives the room time to show its seams. No hidden answer declares itself, but the visible details keep refusing a single clean reading.`
  }

  if (input.choice.mode === 'ask' || input.choice.mode === 'say') {
    return `At ${input.currentPlace}, the words land where records, memory, and fear already disagree. The answer comes through faces, silences, and what people choose not to simplify.`
  }

  if (input.choice.mode === 'risk') {
    return `At ${input.currentPlace}, the risky move makes the argument sharper without making it final. What changes is visible enough to follow, but not clean enough to settle the graves.`
  }

  return `At ${input.currentPlace}, the action changes what can be seen and argued over. The result is concrete, but it still leaves room for more than one truth to survive.`
}

function fallbackVisibleFactForEffect(effect: StoryEffect) {
  if (effect.type === 'remember') {
    return effect.text
  }

  if (effect.type === 'gainItem') {
    return `${effect.item.name} is now visibly part of the scene's outcome.`
  }

  if (effect.type === 'loseItem') {
    return 'Something previously available is no longer in the same position.'
  }

  if (effect.type === 'revealNode') {
    return 'A possible way forward is now apparent.'
  }

  if (effect.type === 'moveToNode') {
    return 'The scene turns toward its next place.'
  }

  return ''
}

export function buildFallbackResolution(input: { choice: Pick<StoryChoice, 'label' | 'mode' | 'displayStyle'>; currentPlace: string; effects: StoryEffect[] }): GeneratedScene {
  const visibleFacts = input.effects.map(fallbackVisibleFactForEffect).filter(Boolean).slice(0, 4)

  return {
    summary: fallbackResolutionSummary(input),
    visibleFacts,
    discoveries: input.effects.filter((effect) => effect.type === 'remember').map((effect) => effect.text),
    opportunities: [],
    npcMentions: [],
    mood: isPassiveChoice(input.choice) ? 'The moment stays taut, watchful, and ready for the next move.' : 'The pressure remains close, visible, and ready for the next move.',
    generatedChoices: [{ intentId: 'continue', label: 'Continue', presentationHint: 'The scene resolves.' }],
  }
}

export function validateScene(scene: GeneratedScene, allowedChoiceIds: string[], rawObject?: unknown): Omit<SceneValidationResult, 'scene' | 'repaired'> {
  const warnings: string[] = []
  const errors: string[] = []
  const keys = rawObject ? collectObjectKeys(rawObject) : []
  const forbiddenFound = keys.filter((key) => forbiddenKeys.includes(key))

  if (forbiddenFound.length > 0) {
    errors.push(`LLM output included forbidden state mutation fields: ${forbiddenFound.join(', ')}`)
  }

  const text = sceneText(scene)
  for (const pattern of mutationClaims) {
    if (pattern.test(text)) {
      warnings.push(`Potential state mutation claim found: ${pattern.source}`)
    }
  }

  for (const pattern of mindReadingClaims) {
    if (pattern.test(text)) {
      errors.push(`Player mind-reading claim found: ${pattern.source}`)
    }
  }

  for (const pattern of spoilerClaims) {
    if (pattern.test(text)) {
      errors.push(`Potential future spoiler found: ${pattern.source}`)
    }
  }

  for (const pattern of internalAuthoringClaims) {
    if (pattern.test(text)) {
      errors.push(`Internal authoring text found in player-facing output: ${pattern.source}`)
    }
  }

  const unknownChoices = scene.generatedChoices.map((choice) => choice.intentId).filter((intentId) => !allowedChoiceIds.includes(intentId) && intentId !== 'continue')
  if (unknownChoices.length > 0) {
    errors.push(`Generated choices not approved by planner: ${unknownChoices.join(', ')}`)
  }

  return { ok: errors.length === 0, warnings, errors }
}

export function parseGeneratedSceneJson(raw: string, fallback: GeneratedScene, allowedChoiceIds: string[]): SceneValidationResult {
  const jsonText = extractFirstJsonObject(raw)
  let parsed: unknown

  try {
    parsed = JSON.parse(jsonText)
  } catch (error) {
    return {
      scene: fallback,
      ok: false,
      warnings: [],
      errors: [error instanceof Error ? error.message : 'Generated scene was not valid JSON.'],
      repaired: false,
    }
  }

  const result = generatedSceneSchema.safeParse(parsed)
  if (!result.success) {
    return {
      scene: fallback,
      ok: false,
      warnings: [],
      errors: result.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`),
      repaired: false,
    }
  }

  const validation = validateScene(result.data, allowedChoiceIds, parsed)
  if (!validation.ok) {
    return { scene: fallback, ...validation, repaired: false }
  }

  return { scene: result.data, ...validation, repaired: jsonText !== stripFences(raw) }
}
