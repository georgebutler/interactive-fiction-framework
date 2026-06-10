import type { StoryChoiceDisplayStyle, StoryChoiceMode, StoryEffect, StoryEvent, StorySchema } from '@/framework/schema'

export type RelationshipScores = {
  trust: number
  fear: number
  respect: number
  debt: number
}

export type Faction = {
  id: string
  name: string
  publicFace: string
  privatePressure?: string
  reputation?: number
}

export type LocationLore = {
  id: string
  name: string
  summary: string
  rules?: string[]
}

export type CharacterLore = {
  id: string
  name: string
  role: string
  wants: string[]
  fears?: string[]
  knows?: string[]
  relationship?: RelationshipScores
}

export type Threat = {
  id: string
  name: string
  pressure: string
  signs: string[]
}

export type Mystery = {
  id: string
  question: string
  knownClues: string[]
  resolvedBy?: string
}

export type NarrativePattern = {
  id: string
  purpose: string
  instruction: string
}

export type StoryBible = {
  themes: string[]
  tone: string[]
  worldRules: string[]
  narrativeLaws: string[]
  factions: Faction[]
  locations: LocationLore[]
  characters: CharacterLore[]
  threats: Threat[]
  mysteries: Mystery[]
  narrativePatterns: NarrativePattern[]
}

export type ChoiceIntentCategory = 'investigate' | 'social' | 'travel' | 'observe' | 'risk' | 'resource' | 'character'

export type ChoiceIntent = {
  id: string
  label: string
  category: ChoiceIntentCategory
  target: string
  objective: string
  mode: StoryChoiceMode
  displayStyle: StoryChoiceDisplayStyle
  skillTags: string[]
  requiresItem?: string
  neutralSummary: string
  writerIntent: string
  actionPrompt: string
  deterministicEffects: StoryEffect[]
  sourceChoiceId?: string
}

export type QuestRuntimeState = {
  goal: string
  progress: number
  obstacles: string[]
  urgency: number
}

export type SimulationUpdate = {
  tensionDelta?: number
  relationshipDeltas?: Record<string, Partial<RelationshipScores>>
  reputationDeltas?: Record<string, number>
  questUpdates?: Record<string, Partial<QuestRuntimeState>>
}

function listBlock(label: string, values: string[]) {
  return `${label}:\n${values.length > 0 ? values.map((value) => `- ${value}`).join('\n') : '- None specified.'}`
}

export function createStoryBibleFromLegacySchema(schema: StorySchema): StoryBible {
  const npcTemplates = schema.events
    .map((event) => event.npcTemplate)
    .filter((npc): npc is NonNullable<StoryEvent['npcTemplate']> => Boolean(npc))

  return {
    themes: [schema.objective.summary],
    tone: [schema.designNote],
    worldRules: schema.fixedRules,
    narrativeLaws: [
      'The Story Bible is the highest authority for generated scenes.',
      'The LLM may render scenes but may not change state.',
      'The player must always have multiple meaningful approaches.',
    ],
    factions: [],
    locations: schema.nodes.map((node) => ({ id: node.id, name: node.publicName, summary: node.canonicalDescription ?? node.description })),
    characters: [
      ...schema.players.map((player) => ({
        id: player.id,
        name: `${player.firstName} ${player.lastName}`,
        role: player.role,
        wants: [player.backstory.want],
        fears: [player.voice.fear],
        knows: [player.backstory.privateKnowledge],
      })),
      ...npcTemplates.map((npc) => ({
        id: npc.id,
        name: npc.name,
        role: npc.role,
        wants: [npc.want],
        knows: [npc.knows],
      })),
    ],
    threats: [],
    mysteries: [],
    narrativePatterns: [],
  }
}

export function formatStoryBibleForPrompt(bible: StoryBible) {
  return `--- STORY BIBLE (HIGHEST AUTHORITY — DO NOT CONTRADICT) ---
${listBlock('Themes', bible.themes)}
${listBlock('Tone', bible.tone)}
${listBlock('World rules', bible.worldRules)}
${listBlock('Narrative laws', bible.narrativeLaws)}
Factions:
${bible.factions.length > 0 ? bible.factions.map((faction) => `- ${faction.name}: ${faction.publicFace}${faction.privatePressure ? ` Pressure: ${faction.privatePressure}` : ''}`).join('\n') : '- None specified.'}
Locations:
${bible.locations.map((location) => `- ${location.name}: ${location.summary}`).join('\n') || '- None specified.'}
Characters:
${bible.characters.map((character) => `- ${character.name} (${character.role}): wants ${character.wants.join('; ') || 'unspecified'}`).join('\n') || '- None specified.'}
Threats:
${bible.threats.map((threat) => `- ${threat.name}: ${threat.pressure}. Signs: ${threat.signs.join('; ')}`).join('\n') || '- None specified.'}
Mysteries:
${bible.mysteries.map((mystery) => `- ${mystery.question} Known clues: ${mystery.knownClues.join('; ') || 'none'}`).join('\n') || '- None specified.'}
Narrative patterns:
${bible.narrativePatterns.map((pattern) => `- ${pattern.id}: ${pattern.purpose}. ${pattern.instruction}`).join('\n') || '- None specified.'}
---`
}
