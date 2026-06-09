export type StoryIconId = string

export type SkillTag = string

export type InventoryItem = {
  id: string
  name: string
  description: string
  tags?: string[]
  visible: boolean
  iconAssetId?: StoryIconId
  consumable?: boolean
}

export type PlayerVoice = {
  publicStyle: string
  innerStyle: string
  fear: string
  desire: string
  contradiction: string
}

export type PlayerBackstory = {
  origin: string
  wound: string
  want: string
  privateKnowledge: string
}

export type PlayableCharacter = {
  id: string
  name: string
  role: string
  portraitAsset: string
  color: string
  condition: string
  inventory: InventoryItem[]
  skillTags: SkillTag[]
  voice: PlayerVoice
  backstory: PlayerBackstory
  memory: string[]
}

export type StoryChoiceMode = 'act' | 'say' | 'ask' | 'use-item' | 'risk' | 'wait'
export type StoryChoiceDisplayStyle = 'action' | 'dialogue' | 'passive'
export type StoryNodeType = 'origin' | 'settlement' | 'road' | 'wilds' | 'watch' | 'crypt' | 'court' | 'ritual' | 'hazard' | 'mystery'

export type StoryEffect =
  | { type: 'gainItem'; item: InventoryItem }
  | { type: 'loseItem'; itemId: string }
  | { type: 'remember'; text: string }
  | { type: 'revealNode'; nodeId: string }
  | { type: 'moveToNode'; nodeId: string }
  | { type: 'setFlag'; flag: string; value: boolean }

export type StoryChoice = {
  id: string
  label: string
  mode: StoryChoiceMode
  displayStyle: StoryChoiceDisplayStyle
  skillTags: SkillTag[]
  requiresItem?: string
  /** @promptOnly — never render this */
  writerIntent: string
  /** @promptOnly — never render this */
  neutralSummary: string
  /** @promptOnly — never render this */
  actionPrompt: string
  effects?: StoryEffect[]
}

export type StoryEvent = {
  id: string
  name: string
  weight: number
  iconAssetId: StoryIconId
  prompt: string
  currentHint?: string
  objectiveNodeId?: string
  npcTemplate?: StoryNpcTemplate
  choices: StoryChoice[]
}

export type StoryObjective = {
  summary: string
  successCondition: string
  failureCondition: string
  currentHint?: string
}

export type StoryNpcTemplate = {
  id: string
  name: string
  role: string
  canonicalDescription?: string
  description: string
  voice: string
  want: string
  knows: string
}

export type StoryNpc = StoryNpcTemplate & {
  introducedByEventId: string
  currentNodeId: string
  memory: string[]
}

export type TravelBlocker = {
  id: string
  label: string
  reason: string
  preventsTravel?: boolean
  requiredFlag?: string
  requiredItemId?: string
  clearedByFlag?: string
}

export type UnfinishedBusiness = {
  id: string
  label: string
  reason: string
  activeEventId?: string
  requiredFlag?: string
  requiredItemId?: string
  clearedByFlag?: string
}

export type StoryExit = {
  toNodeId: string
  direction?: string
  label?: string
  hiddenUntilExplored?: boolean
  blocker?: TravelBlocker
}

export type StoryNode = {
  id: string
  name: string
  publicName: string
  canonicalDescription?: string
  description: string
  explorationHint?: string
  iconAssetId: StoryIconId
  nodeType: StoryNodeType
  exits: StoryExit[]
  unfinishedBusiness?: UnfinishedBusiness[]
  nextNodeIds?: string[]
  mapPosition?: { x: number; y: number }
  eventWeights: Array<{
    eventId: string
    weight: number
  }>
}

export type StorySchema = {
  id: string
  title: string
  premise: string
  objective: StoryObjective
  openingNarration: string
  victoryResolution: string
  defeatResolution: string
  goalNodeId: string
  designNote: string
  /**
   * Each string is one world law, written as a prohibition or absolute fact.
   * Example: "The dead cannot speak unless the lich wills it."
   * Example: "King Osric's word is law. No NPC defies him openly."
   */
  fixedRules: string[]
  codexTerms: string[]
  player: PlayableCharacter
  nodes: StoryNode[]
  events: StoryEvent[]
}

export type SkillTagDefinition = {
  label: string
  summary: string
}

export type CodexReference = {
  term: string
  type: 'place' | 'person' | 'item' | 'term'
  targetId?: string
}

export type StoryRuntimeConfig = {
  initialNodeId: string
  initialExploredNodeIds?: string[]
  victory: {
    goalNodeId: string
    requiredFlag: string
  }
  currentObjectiveText: {
    won: string
    lost: string
  }
  outcomeFeedText: {
    won: string
    lost: string
  }
  narrationStyleRule: string
}

export type StoryBundle = {
  schema: StorySchema
  iconAssets: Record<StoryIconId, string>
  skillTagDefinitions: Record<SkillTag, SkillTagDefinition>
  allKnownItems: InventoryItem[]
  codexTermTargets: Record<string, Pick<CodexReference, 'type' | 'targetId'>>
  codexTermSummaries: Record<string, string>
  runtime: StoryRuntimeConfig
}
