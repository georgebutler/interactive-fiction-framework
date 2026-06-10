import type { ChoiceIntent, ChoiceIntentCategory, NarrativePattern } from '@/framework/story-bible'

export type ScenePatternId =
  | 'false_lead'
  | 'unexpected_witness'
  | 'costly_success'
  | 'hidden_connection'
  | 'arrival_pressure'
  | 'npc_confrontation'
  | 'environmental_hazard'
  | 'threshold'

export type RequiredChoiceMix = {
  minimumChoices: number
  requireSafe: boolean
  requireInvestigative: boolean
  requireRisky: boolean
  requireCharacterFocused: boolean
}

export const narrativePatterns: Record<ScenePatternId, NarrativePattern> = {
  false_lead: {
    id: 'false_lead',
    purpose: 'misdirect',
    instruction: 'Make one visible clue plausible but uncertain, without resolving the core mystery.',
  },
  unexpected_witness: {
    id: 'unexpected_witness',
    purpose: 'reveal information',
    instruction: 'Let a person, trace, or object indicate that someone else saw part of the truth.',
  },
  costly_success: {
    id: 'costly_success',
    purpose: 'increase tension',
    instruction: 'Let progress remain possible while making its cost visible and concrete.',
  },
  hidden_connection: {
    id: 'hidden_connection',
    purpose: 'link mysteries',
    instruction: 'Connect two known clues without revealing the final explanation early.',
  },
  arrival_pressure: {
    id: 'arrival_pressure',
    purpose: 'establish pressure',
    instruction: 'Turn the place itself into a source of immediate choice and uncertainty.',
  },
  npc_confrontation: {
    id: 'npc_confrontation',
    purpose: 'test social trust',
    instruction: 'Let an NPC want something concrete while withholding or distorting useful information.',
  },
  environmental_hazard: {
    id: 'environmental_hazard',
    purpose: 'create danger',
    instruction: 'Make the environment threaten progress without removing multiple viable approaches.',
  },
  threshold: {
    id: 'threshold',
    purpose: 'mark transition',
    instruction: 'Make crossing into a new stage feel meaningful without forcing a single route.',
  },
}

export const defaultRequiredChoiceMix: RequiredChoiceMix = {
  minimumChoices: 4,
  requireSafe: true,
  requireInvestigative: true,
  requireRisky: true,
  requireCharacterFocused: true,
}

export function getNarrativePattern(id: string | undefined) {
  return narrativePatterns[(id as ScenePatternId | undefined) ?? 'arrival_pressure'] ?? narrativePatterns.arrival_pressure
}

export function selectNarrativePattern(input: { hasNpc: boolean; hasRisk: boolean; hasDiscovery: boolean; nodeType: string; tension: number }): NarrativePattern {
  if (input.nodeType === 'crypt' || input.nodeType === 'ritual' || input.tension >= 70) {
    return narrativePatterns.threshold
  }

  if (input.hasNpc) {
    return narrativePatterns.npc_confrontation
  }

  if (input.nodeType === 'hazard' || input.hasRisk) {
    return narrativePatterns.environmental_hazard
  }

  if (input.hasDiscovery) {
    return narrativePatterns.hidden_connection
  }

  return narrativePatterns.arrival_pressure
}

function hasCategory(choices: ChoiceIntent[], category: ChoiceIntentCategory) {
  return choices.some((choice) => choice.category === category)
}

export function validateChoiceMix(choices: ChoiceIntent[], mix: RequiredChoiceMix = defaultRequiredChoiceMix) {
  const warnings: string[] = []

  if (choices.length < mix.minimumChoices) {
    warnings.push(`Scene has ${choices.length} choices; expected at least ${mix.minimumChoices}.`)
  }

  if (mix.requireSafe && !choices.some((choice) => choice.category === 'observe' || choice.category === 'social')) {
    warnings.push('Scene is missing a safe or low-commitment choice.')
  }

  if (mix.requireInvestigative && !hasCategory(choices, 'investigate')) {
    warnings.push('Scene is missing an investigative choice.')
  }

  if (mix.requireRisky && !hasCategory(choices, 'risk')) {
    warnings.push('Scene is missing a risky choice.')
  }

  if (mix.requireCharacterFocused && !hasCategory(choices, 'character')) {
    warnings.push('Scene is missing a character-focused choice.')
  }

  return warnings
}
