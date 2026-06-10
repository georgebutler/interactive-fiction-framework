import { z } from 'zod'
import type { StoryEffect } from '@/framework/schema'
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

function stripFences(raw: string) {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
}

function extractFirstJsonObject(raw: string) {
  const text = stripFences(raw)
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return text
  }

  return text.slice(firstBrace, lastBrace + 1)
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
  return {
    summary: `${input.currentPlace} holds its pressure close. ${input.plan.objective}`,
    visibleFacts: input.plan.complications.slice(0, 2),
    discoveries: input.plan.discoveries.slice(0, 2),
    opportunities: [input.plan.opportunity],
    npcMentions: input.plan.involvedNpcIds,
    mood: `Tension ${input.plan.tension}/100; the moment remains unresolved.`,
    generatedChoices: input.plan.choiceIntents.slice(0, 4).map((choice) => ({ intentId: choice.id, label: choice.label, presentationHint: choice.objective })),
  }
}

export function buildFallbackResolution(input: { label: string; neutralSummary: string; effects: StoryEffect[] }): GeneratedScene {
  return {
    summary: input.neutralSummary,
    visibleFacts: input.effects.map((effect) => (effect.type === 'remember' ? effect.text : `A deterministic consequence is applied: ${effect.type}.`)).slice(0, 4),
    discoveries: input.effects.filter((effect) => effect.type === 'remember').map((effect) => effect.text),
    opportunities: [],
    npcMentions: [],
    mood: 'The choice changes what code has explicitly allowed, and nothing more.',
    generatedChoices: [{ intentId: 'continue', label: input.label, presentationHint: 'The selected action resolves.' }],
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
