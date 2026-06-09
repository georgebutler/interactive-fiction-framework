import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { Group } from 'three'
import { AlertCircleIcon, BookOpenIcon, ClockIcon, EyeIcon, HandIcon, MapIcon, MessageCircleIcon, MessageCircleQuestionIcon, MoonIcon, PackageIcon, PlayIcon, SettingsIcon, SunIcon, TriangleAlertIcon, UserRoundIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type InventoryItem = {
  id: string
  name: string
  description: string
  tags?: string[]
  visible: boolean
  iconAssetId?: StoryIconId
  consumable?: boolean
}

type PlayerVoice = {
  publicStyle: string
  innerStyle: string
  fear: string
  desire: string
  contradiction: string
}

type PlayerBackstory = {
  origin: string
  wound: string
  want: string
  privateKnowledge: string
}

type PlayableCharacter = {
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

type StoryIconId = 'lantern' | 'road' | 'crossroads' | 'codex' | 'keep' | 'forest'
type SkillTag = 'grave-lore' | 'plain-speech' | 'steady-hands'
type StoryChoiceMode = 'act' | 'say' | 'ask' | 'use-item' | 'risk' | 'wait'
type StoryChoiceDisplayStyle = 'action' | 'dialogue' | 'passive'
type StoryNodeType = 'origin' | 'settlement' | 'road' | 'wilds' | 'watch' | 'crypt' | 'court' | 'ritual' | 'hazard' | 'mystery'

type StoryEffect =
  | { type: 'gainItem'; item: InventoryItem }
  | { type: 'loseItem'; itemId: string }
  | { type: 'remember'; text: string }
  | { type: 'revealNode'; nodeId: string }
  | { type: 'moveToNode'; nodeId: string }
  | { type: 'setFlag'; flag: string; value: boolean }

type StoryChoice = {
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

type StoryEvent = {
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

type StoryObjective = {
  summary: string
  successCondition: string
  failureCondition: string
  currentHint?: string
}

type StoryNpcTemplate = {
  id: string
  name: string
  role: string
  canonicalDescription?: string
  description: string
  voice: string
  want: string
  knows: string
}

type StoryNpc = StoryNpcTemplate & {
  introducedByEventId: string
  currentNodeId: string
  memory: string[]
}

type TravelBlocker = {
  id: string
  label: string
  reason: string
  preventsTravel?: boolean
  requiredFlag?: string
  requiredItemId?: string
  clearedByFlag?: string
}

type UnfinishedBusiness = {
  id: string
  label: string
  reason: string
  activeEventId?: string
  requiredFlag?: string
  requiredItemId?: string
  clearedByFlag?: string
}

type StoryExit = {
  toNodeId: string
  direction?: string
  label?: string
  hiddenUntilExplored?: boolean
  blocker?: TravelBlocker
}

type StoryNode = {
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

type StorySchema = {
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

type FeedEntry = {
  id: string
  kind: 'narration' | 'dialogue' | 'selected' | 'consequence' | 'system' | 'location' | 'error'
  speaker?: string
  text: string
  content?: {
    name: string
    nodeType: StoryNodeType
  }
  generatedText?: string
  nodeId?: string
  eventId?: string
  streaming?: boolean
  consequenceBadges?: string[]
  retryAction?: 'begin-scene' | 'choose-action'
}

type DebugEntry = {
  id: string
  label?: string
  text: string
  streaming?: boolean
}

type CampaignState = {
  player: PlayableCharacter
  storyNpcs: StoryNpc[]
  currentNodeId: string
  currentEvent?: StoryEvent
  sceneOpened: boolean
  exploredNodeIds: string[]
  eventHistory: StoryEvent[]
  feed: FeedEntry[]
  debugFeed: DebugEntry[]
  flags: Record<string, boolean>
  canonicalFacts: Record<string, string>
  outcome: 'running' | 'won' | 'lost'
}

type LlmSettings = {
  endpoint: string
  model: string
  presetId: LlmPresetId
  options: OllamaGenerationOptions
  think: boolean
}

type LlmPresetId = 'auto' | 'fast' | 'balanced' | 'quality' | 'custom'

type OllamaGenerationOptions = {
  temperature: number
  top_p: number
  repeat_penalty: number
  num_ctx: number
  num_predict: number
}

type LlmModelPreset = {
  id: LlmPresetId
  label: string
  description: string
  preferredModels: string[]
  options: OllamaGenerationOptions
}

type AppPhase = 'story-select' | 'protagonist-intro' | 'playing'
type MainTab = 'story' | 'map' | 'character'
type ResolvedThemeMode = 'light' | 'dark'
type ThemeMode = ResolvedThemeMode | 'system'
type OllamaStatus = 'checking' | 'connected' | 'unreachable'

type CodexReference = {
  term: string
  type: 'place' | 'person' | 'item' | 'term'
  targetId?: string
}

const codexTermTargets: Record<string, Pick<CodexReference, 'type' | 'targetId'>> = {
  Redvale: { type: 'place', targetId: 'ash-farms' },
}

const codexTermSummaries: Record<string, string> = {
  'the lich': 'A frightened name people use for whatever is stirring the graves. It may be an old lord, a wrong burial custom, or just a rumor that makes the dead easier to explain.',
}

const storyIconAssets: Record<StoryIconId, string> = {
  lantern: '/icons/ffffff/transparent/1x1/delapouite/old-lantern.svg',
  road: '/icons/ffffff/transparent/1x1/delapouite/horizon-road.svg',
  crossroads: '/icons/ffffff/transparent/1x1/delapouite/crossroad.svg',
  codex: '/icons/ffffff/transparent/1x1/lorc/open-book.svg',
  keep: '/icons/ffffff/transparent/1x1/delapouite/castle.svg',
  forest: '/icons/ffffff/transparent/1x1/delapouite/forest.svg',
}

// Public domain / CC0 image from The Metropolitan Museum of Art Open Access:
// Fra Filippo Lippi, "Portrait of a Woman with a Man at a Casement", object 436896.
const publicDomainPortraitAsset = '/portraits/fra-filippo-lippi-portrait-public-domain.jpg'

const skillTagDefinitions: Record<SkillTag, { label: string; summary: string }> = {
  'grave-lore': {
    label: 'Burial Knowledge',
    summary: 'Knows grave customs, burial signs, and how the dead are meant to rest.',
  },
  'plain-speech': {
    label: 'Plain Speaking',
    summary: 'Can cut through fear, rank, and ceremony with direct words.',
  },
  'steady-hands': {
    label: 'Steady Hands',
    summary: 'Can keep control during delicate, dangerous, or physical work.',
  },
}

const graveSpade: InventoryItem = {
  id: 'grave-spade',
  name: "Tamsin's Shovel",
  description: 'Her working tool, with a polished haft, a nicked iron edge, and the weight of every honest grave she has dug. Tamsin trusts it more than court steel.',
  tags: ['tool'],
  iconAssetId: 'road',
  consumable: false,
  visible: true,
}

const graveAsh: InventoryItem = {
  id: 'grave-ash',
  name: 'Holy Water',
  description: 'A small stoppered flask blessed by a village priest. Tamsin has seen it make the restless dead flinch and slow.',
  tags: ['church', 'water'],
  iconAssetId: 'lantern',
  consumable: true,
  visible: true,
}

const ironNails: InventoryItem = {
  id: 'iron-nails',
  name: 'Iron Nails',
  description: 'A palmful of coffin nails. Good iron, bent and old, useful for holding a door when hands press from the other side.',
  tags: ['iron', 'tool'],
  iconAssetId: 'keep',
  consumable: true,
  visible: true,
}

const royalWrit: InventoryItem = {
  id: 'royal-writ',
  name: 'Sealed Writ',
  description: 'King Osric’s command, stamped in red wax. It opens gates and closes excuses.',
  tags: ['proof', 'authority'],
  iconAssetId: 'codex',
  consumable: false,
  visible: true,
}

const betterKnife: InventoryItem = {
  id: 'armory-knife',
  name: 'Armory Knife',
  description: 'A narrow knife with honest balance. Not heroic, but useful when knots, straps, or hands must be cut free.',
  tags: ['iron', 'tool'],
  iconAssetId: 'lantern',
  consumable: true,
  visible: true,
}

const crackedSpearHead: InventoryItem = {
  id: 'cracked-spear-head',
  name: 'Cracked Spearhead',
  description: 'Salvaged from a weapon too poor to carry whole. It is still iron, and iron still has opinions about the dead.',
  tags: ['iron', 'salvage'],
  iconAssetId: 'keep',
  consumable: true,
  visible: true,
}

const bellClapper: InventoryItem = {
  id: 'bell-clapper',
  name: 'Silver Bell Clapper',
  description: 'The missing tongue of an old burial bell, dark with age and bright where Tamsin rubbed it clean.',
  tags: ['church', 'silver'],
  iconAssetId: 'codex',
  consumable: false,
  visible: true,
}

const boneCharm: InventoryItem = {
  id: 'bone-charm',
  name: 'Bone Token',
  description: 'A fingerbone wrapped in silver wire. It is ugly enough for proof, whatever tale the court chooses to tell about it.',
  tags: ['proof', 'bone'],
  iconAssetId: 'forest',
  consumable: false,
  visible: true,
}

const storySchema: StorySchema = {
  id: 'kings-lich-playable',
  title: 'The Open Graves',
  premise: 'A royal order sends a practical gravedigger through opened graves, frightened villages, and a court that would rather call sacrifice service.',
  objective: {
    summary: 'Follow the opened graves back to the thing stirring them, survive, and return with proof the court cannot bury.',
    successCondition: 'Reach Graymere Hall Return with proof from the Old Barrow and make the king acknowledge it.',
    failureCondition: 'Return without proof, abandon the investigation, or let the court bury the truth again.',
    currentHint: 'Answer the royal order, then follow the opened graves out of Graymere Hall.',
  },
  openingNarration: 'Graymere Hall smells of wet wool, old rushes, and men trying not to look afraid. Tamsin stands before King Osric with grave dirt still worked into her hands, a sealed writ waiting on the table between them, and the dead roads of Redvale opening somewhere beyond the rain.',
  victoryResolution: 'The proof reaches the throne, and the dead are given names the court can no longer spend quietly.',
  defeatResolution: 'Tamsin falls short of the proof, and the dead keep walking beneath orders no living mouth will confess.',
  goalNodeId: 'king-return',
  designNote:
    'A contributor-authored playable story about agency-preserving narration, original scenes, varied authored choices, and lightweight consequences. The local model narrates within the schema; code owns state.',
  fixedRules: [
    'The end user plays the authored protagonist directly.',
    'Authored choices decide what the protagonist can attempt; generated prose may enrich but cannot override mechanical state.',
    'Inventory is visible story state and changes only through authored effects.',
    'The protagonist’s condition is visible prose, never a number, bar, level, or percentage.',
    'The codex is compact known memory for the player and the local narrator.',
    'Unexplored places, hidden routes, and future event tables remain unrevealed until discovered.',
    'All story material and style guidance must remain original and generic, without named protected references.',
  ],
  codexTerms: ['Redvale', 'King Osric', 'Blackpine Road', 'Ash Farms', 'Old Watchtower', 'Old Barrow', 'Graymere Hall', "Tamsin's Shovel", 'Holy Water', 'Iron Nails', 'Sealed Writ', 'the lich'],
  player: {
    id: 'tamsin',
    name: 'Tamsin',
    role: 'Gravedigger under royal order',
    portraitAsset: publicDomainPortraitAsset,
    color: '#7dd3fc',
    condition: 'Tired, mud-spattered, and steady enough to keep moving.',
    inventory: [graveSpade, graveAsh, ironNails, royalWrit],
    skillTags: ['grave-lore', 'plain-speech', 'steady-hands'],
    voice: {
      publicStyle: 'dry, practical, and too familiar with death to flatter anyone',
      innerStyle: 'watchful, restrained, bitterly funny when fear gets close',
      fear: 'being spent by powerful people who will misname it courage',
      desire: 'to put the dead back down and return to work that makes sense',
      contradiction: 'she respects burial customs but distrusts anyone who turns sacrifice into policy',
    },
    backstory: {
      origin: 'Tamsin digs graves outside Redvale and was taken by levy because she knows the dead too well.',
      wound: 'She has buried neighbors for orders written by people who never learned their names.',
      want: 'She wants to survive, end the rising dead, and make the king admit what this command costs.',
      privateKnowledge: 'Holy Water can slow a corpse for a few breaths if thrown into its eyes or mouth.',
    },
    memory: ['The king called it service because he could not bear to call it fear.'],
  },
  nodes: [
    {
      id: 'graymere-yard',
      name: 'Graymere Yard',
      publicName: 'Graymere Hall',
      canonicalDescription: 'Graymere Hall is the muddy seat of King Osric, where polished orders make the dead roads sound cleaner than they are.',
      description: 'The muddy seat of King Osric, where limewashed walls, wet rushes, and polished orders make the roads sound cleaner than they are.',
      explorationHint: 'Mud-dark roads lead away from the hall under a low sky.',
      iconAssetId: 'road',
      nodeType: 'origin',
      exits: [
        { toNodeId: 'ash-farms', direction: 'west', label: 'Follow the opened graves' },
        { toNodeId: 'old-watchtower', direction: 'east', label: 'Take the high road toward the old tower' },
      ],
      unfinishedBusiness: [
        {
          id: 'answer-royal-order',
          label: 'Answer the royal order',
          reason: 'Tamsin needs to answer King Osric’s order before leaving Graymere Hall.',
          activeEventId: 'royal-order',
          clearedByFlag: 'royal-order-answered',
        },
      ],
      nextNodeIds: ['ash-farms', 'old-watchtower'],
      mapPosition: { x: 300, y: 520 },
      eventWeights: [
        { eventId: 'royal-order', weight: 8 },
        { eventId: 'bad-equipment', weight: 3 },
        { eventId: 'village-plea', weight: 2 },
      ],
    },
    {
      id: 'ash-farms',
      name: 'Ash Farms',
      publicName: 'Ash Farms',
      canonicalDescription: 'Ash Farms is a stretch of sickly fields outside Redvale where fresh graves keep opening and farmers count names under their breath.',
      description: 'Sickly fields outside Redvale, where fresh graves keep opening and farmers count names under their breath.',
      explorationHint: 'A rutted farm road sinks into fields and grave-cold mist.',
      iconAssetId: 'crossroads',
      nodeType: 'settlement',
      exits: [
        { toNodeId: 'graymere-yard', direction: 'east', label: 'Return to the king’s road' },
        { toNodeId: 'blackpine-road', direction: 'north', label: 'Follow the grave-road into the pines' },
        { toNodeId: 'old-watchtower', direction: 'northeast', label: 'Cut across the high fields' },
      ],
      nextNodeIds: ['graymere-yard', 'blackpine-road', 'old-watchtower'],
      mapPosition: { x: 180, y: 385 },
      eventWeights: [
        { eventId: 'burned-field', weight: 8 },
        { eventId: 'village-plea', weight: 3 },
        { eventId: 'grave-mist', weight: 2 },
      ],
    },
    {
      id: 'old-watchtower',
      name: 'Old Watchtower',
      publicName: 'Old Watchtower',
      canonicalDescription: 'The Old Watchtower is a leaning hill tower where bad maps, burial marks, and worse advice have survived the weather.',
      description: 'A leaning hill tower where bad maps, old burial customs, and worse advice have survived the weather.',
      explorationHint: 'A high path climbs toward broken stone and old warning marks.',
      iconAssetId: 'codex',
      nodeType: 'watch',
      exits: [
        { toNodeId: 'graymere-yard', direction: 'west', label: 'Descend toward Graymere Hall' },
        { toNodeId: 'ash-farms', direction: 'southwest', label: 'Cross back toward the fields' },
        { toNodeId: 'blackpine-road', direction: 'northwest', label: 'Take the marked road under the pines' },
        { toNodeId: 'barrow-crypt', direction: 'north', label: 'Follow the tower map toward the barrow' },
      ],
      nextNodeIds: ['graymere-yard', 'ash-farms', 'blackpine-road', 'barrow-crypt'],
      mapPosition: { x: 420, y: 385 },
      eventWeights: [
        { eventId: 'hermit-warning', weight: 7 },
        { eventId: 'bad-equipment', weight: 2 },
        { eventId: 'grave-mist', weight: 3 },
      ],
    },
    {
      id: 'blackpine-road',
      name: 'Blackpine Road',
      publicName: 'Blackpine Road',
      canonicalDescription: 'Blackpine Road is a cramped forest road where split carts lean under black pines and cold mist hangs low over the ruts.',
      description: 'A cramped forest road where split carts lean under black pines and cold mist hangs low over the ruts.',
      explorationHint: 'Black pines crowd a road where cold fog swallows wheel ruts.',
      iconAssetId: 'forest',
      nodeType: 'hazard',
      exits: [
        { toNodeId: 'ash-farms', direction: 'south', label: 'Return by the farm track' },
        { toNodeId: 'old-watchtower', direction: 'southeast', label: 'Climb back toward the tower' },
        { toNodeId: 'barrow-crypt', direction: 'north', label: 'Press through the mist' },
      ],
      nextNodeIds: ['ash-farms', 'old-watchtower', 'barrow-crypt'],
      mapPosition: { x: 285, y: 250 },
      eventWeights: [
        { eventId: 'grave-mist', weight: 8 },
        { eventId: 'bandit-toll', weight: 3 },
        { eventId: 'burned-field', weight: 1 },
      ],
    },
    {
      id: 'barrow-crypt',
      name: 'Old Barrow',
      publicName: 'Old Barrow',
      canonicalDescription: 'The Old Barrow is a buried hall under the hill, cold with old bones, a cracked bell, and signs that someone has been using the dead.',
      description: 'A buried hall under the hill, cold with old bones, a cracked bell, and signs that someone has been using the dead.',
      explorationHint: 'A grass-swallowed mound waits ahead with stone teeth showing.',
      iconAssetId: 'keep',
      nodeType: 'crypt',
      exits: [
        { toNodeId: 'old-watchtower', direction: 'south', label: 'Retreat by the tower path' },
        { toNodeId: 'blackpine-road', direction: 'southwest', label: 'Return through Blackpine Road' },
        {
          toNodeId: 'king-return',
          direction: 'east',
          label: 'Return to court with proof',
          blocker: {
            id: 'proof-required',
            label: 'Proof required',
            reason: 'Returning to court empty-handed would give the king another order, not proof. Tamsin needs something that can show what is stirring the graves.',
            requiredItemId: 'bone-charm',
          },
        },
      ],
      nextNodeIds: ['old-watchtower', 'blackpine-road', 'king-return'],
      mapPosition: { x: 300, y: 110 },
      eventWeights: [
        { eventId: 'lich-ritual', weight: 10 },
        { eventId: 'bone-charm-glimpse', weight: 3 },
      ],
    },
    {
      id: 'king-return',
      name: 'King Return',
      publicName: 'Graymere Hall Return',
      canonicalDescription: 'Graymere Hall Return is the court’s reckoning point, where survival must become proof and proof must become a sentence.',
      description: 'The return to King Osric, where survival must become proof and proof must become a sentence.',
      explorationHint: 'Torch smoke and court noise gather beyond the road back.',
      iconAssetId: 'lantern',
      nodeType: 'court',
      exits: [{ toNodeId: 'barrow-crypt', direction: 'west', label: 'Go back toward the barrow road' }],
      nextNodeIds: ['barrow-crypt'],
      mapPosition: { x: 470, y: 65 },
      eventWeights: [{ eventId: 'royal-proof', weight: 10 }],
    },
  ],
  events: [
    {
      id: 'royal-order',
      name: 'The king spends a gravedigger',
      weight: 4,
      iconAssetId: 'road',
      prompt: 'King Osric gives Tamsin a stamped writ and commands her to follow the opened graves back to their master.',
      currentHint: 'Get the order into plain words before choosing which road leaves the hall.',
      objectiveNodeId: 'ash-farms',
      npcTemplate: {
        id: 'king-osric',
        name: 'King Osric',
        role: 'Tired king',
        canonicalDescription: 'King Osric is a thin ruler in a patched crown who has slept badly enough to mistake command for courage.',
        description: 'A thin ruler in a patched crown who has slept badly enough to mistake command for courage.',
        voice: 'formal, clipped, ashamed when pressed, impatient with delay',
        want: 'Send someone to stop the dead before the graves around Redvale empty out.',
        knows: 'The old barrow beyond Blackpine Road is where the trouble seems to start, and the last knight returned pale, silent, and dead-eyed before vanishing at dawn.',
      },
      choices: [
        {
          id: 'make-king-name-cost',
          label: 'Make the king name what he is asking of you',
          neutralSummary: 'You pressed for plain accountability instead of accepting the order silently.',
          writerIntent: 'Offer a direct social option that challenges power without choosing exact words for the player.',
          actionPrompt: 'The selected option is to press King Osric to speak plainly about sending a gravedigger where trained knights failed.',
          mode: 'ask',
          displayStyle: 'dialogue',
          skillTags: ['plain-speech'],
          effects: [
            { type: 'setFlag', flag: 'royal-order-answered', value: true },
            { type: 'remember', text: 'King Osric admitted the old barrow beyond Blackpine Road may be where the dead are being stirred.' },
            { type: 'revealNode', nodeId: 'ash-farms' },
            { type: 'moveToNode', nodeId: 'ash-farms' },
          ],
        },
        {
          id: 'inspect-writ',
          label: 'Study the Sealed Writ for what it can open',
          neutralSummary: 'You looked for the practical authority the writ granted before leaving the hall.',
          writerIntent: 'Offer an investigative alternative that treats royal authority as a tool, not a feeling.',
          actionPrompt: 'The selected option is to study the Sealed Writ for practical access, demands, and obligations it can create.',
          mode: 'act',
          displayStyle: 'action',
          skillTags: ['grave-lore'],
          effects: [
            { type: 'setFlag', flag: 'royal-order-answered', value: true },
            { type: 'remember', text: 'The Sealed Writ can demand shelter, testimony, and access to closed roads.' },
            { type: 'revealNode', nodeId: 'old-watchtower' },
            { type: 'moveToNode', nodeId: 'old-watchtower' },
          ],
        },
      ],
    },
    {
      id: 'bad-equipment',
      name: 'The armory offers insult as steel',
      weight: 5,
      iconAssetId: 'lantern',
      prompt: 'The armory clerk gives Tamsin a spear with a split shaft and waits for her to accept the insult quietly.',
      currentHint: 'Secure something useful before the road makes the court’s insult dangerous.',
      objectiveNodeId: 'old-watchtower',
      choices: [
        {
          id: 'demand-usable-iron',
          label: 'Demand usable iron before leaving',
          neutralSummary: 'You turned the bad equipment into a public problem the clerk had to answer.',
          writerIntent: 'Give the player a forceful speech-intent option that improves preparation.',
          actionPrompt: 'The selected option is to press the armory clerk for gear that will not fail at the first dead hand.',
          mode: 'say',
          displayStyle: 'dialogue',
          skillTags: ['plain-speech'],
          effects: [
            { type: 'gainItem', item: betterKnife },
            { type: 'remember', text: 'Tamsin forced the armory to admit the first weapon was meant for someone disposable.' },
            { type: 'moveToNode', nodeId: 'old-watchtower' },
          ],
        },
        {
          id: 'salvage-spear-head',
          label: 'Salvage the spearhead and leave the shaft behind',
          neutralSummary: 'You took the only useful part and avoided giving the clerk another opening to posture.',
          writerIntent: 'Offer a quiet practical option that converts bad gear into a useful item.',
          actionPrompt: 'The selected option is to strip useful iron from the broken spear and leave the useless shaft behind.',
          mode: 'act',
          displayStyle: 'action',
          skillTags: ['steady-hands'],
          effects: [
            { type: 'gainItem', item: crackedSpearHead },
            { type: 'moveToNode', nodeId: 'old-watchtower' },
          ],
        },
      ],
    },
    {
      id: 'village-plea',
      name: 'A farmer asks which kind of mercy this is',
      weight: 3,
      iconAssetId: 'crossroads',
      prompt: 'A farmer blocks the road with a child behind him and asks whether Tamsin has come to bury the village or save it.',
      currentHint: 'Listen for what the farms know about the first opened grave.',
      objectiveNodeId: 'ash-farms',
      npcTemplate: {
        id: 'farmer-riel',
        name: 'Farmer Riel',
        role: 'Frightened father',
        canonicalDescription: 'Farmer Riel is a raw-eyed farmer with mud on his knees and a child gripping the back of his coat.',
        description: 'A raw-eyed farmer with mud on his knees and a child gripping the back of his coat.',
        voice: 'plain, guarded, angry from fear',
        want: 'Know whether Tamsin brings help or another royal lie.',
        knows: 'Three graves opened behind his byre after a bell rang under the hill.',
      },
      choices: [
        {
          id: 'answer-with-truth',
          label: 'Answer him with the truth you can afford',
          neutralSummary: 'You gave a limited honest answer and left room for what was still unknown.',
          writerIntent: 'Offer an empathetic conversational option without writing exact player dialogue.',
          actionPrompt: 'The selected option is to answer Farmer Riel honestly about what is known, what is unknown, and the next intended step.',
          mode: 'say',
          displayStyle: 'dialogue',
          skillTags: ['plain-speech'],
          effects: [
            { type: 'remember', text: 'A bell rang beneath the hill before the Ash Farms graves opened.' },
            { type: 'moveToNode', nodeId: 'ash-farms' },
          ],
        },
        {
          id: 'show-writ',
          label: 'Show the Sealed Writ and ask for the first opened grave',
          neutralSummary: 'You used official authority to focus the exchange on a concrete lead.',
          writerIntent: 'Offer an authority-backed investigative option that may create distrust but gains direction.',
          actionPrompt: 'The selected option is to show the Sealed Writ as authority to demand a path to the first disturbed grave.',
          mode: 'ask',
          displayStyle: 'dialogue',
          skillTags: ['grave-lore'],
          requiresItem: 'royal-writ',
          effects: [
            { type: 'remember', text: 'The first opened grave at Ash Farms belonged to a bell-ringer buried without his clapper.' },
            { type: 'moveToNode', nodeId: 'ash-farms' },
          ],
        },
      ],
    },
    {
      id: 'burned-field',
      name: 'The field has too many open mouths',
      weight: 2,
      iconAssetId: 'forest',
      prompt: 'Tamsin reaches a farm where old graves gape open and someone is trapped beneath a root cellar door.',
      currentHint: 'Control the danger long enough to learn what came from the east.',
      objectiveNodeId: 'blackpine-road',
      npcTemplate: {
        id: 'miller-joan',
        name: 'Miller Joan',
        role: 'Injured farmer',
        canonicalDescription: 'Miller Joan is a mud-covered miller with a shaking lantern and no patience for ceremonial courage.',
        description: 'A mud-covered miller with a shaking lantern and no patience for ceremonial courage.',
        voice: 'plain, angry, frightened, and practical',
        want: 'Get her brother out of the root cellar before the dead find the door.',
        knows: 'The dead came from the east after the bell rang under the hill, and one corpse still wore a royal tabard.',
      },
      choices: [
        {
          id: 'seal-cellar-with-nails',
          label: 'Use Iron Nails to hold the cellar shut',
          neutralSummary: 'You spent the nails to buy time and control the rescue.',
          writerIntent: 'Offer a careful item-use option that trades inventory for safety.',
          actionPrompt: 'The selected option is to brace the cellar door with coffin nails and coordinate when the people below should move.',
          mode: 'use-item',
          displayStyle: 'action',
          skillTags: ['steady-hands'],
          requiresItem: 'iron-nails',
          effects: [
            { type: 'loseItem', itemId: 'iron-nails' },
            { type: 'remember', text: 'Miller Joan saw a corpse in royal colors among the dead from the east.' },
            { type: 'moveToNode', nodeId: 'blackpine-road' },
          ],
        },
        {
          id: 'throw-grave-ash',
          label: 'Throw Holy Water into the nearest dead face',
          neutralSummary: 'You spent the Holy Water for a fast opening, accepting that close work might hurt.',
          writerIntent: 'Offer a risky item-use option with a clear cost.',
          actionPrompt: 'The selected option is to spend Holy Water to slow the nearest corpse long enough to open the root cellar.',
          mode: 'use-item',
          displayStyle: 'action',
          skillTags: ['grave-lore'],
          requiresItem: 'grave-ash',
          effects: [
            { type: 'loseItem', itemId: 'grave-ash' },
            { type: 'remember', text: 'The dead clawed close while the cellar opened.' },
            { type: 'remember', text: 'Holy Water can slow the dead, but only for moments.' },
            { type: 'moveToNode', nodeId: 'blackpine-road' },
          ],
        },
      ],
    },
    {
      id: 'hermit-warning',
      name: 'The tower keeps an ugly warning',
      weight: 5,
      iconAssetId: 'codex',
      prompt: 'A hermit at the old watchtower says the dead began walking after someone stole from a burial bell under the hill.',
      currentHint: 'Turn the hermit’s ugly warning into a practical way into the barrow.',
      objectiveNodeId: 'barrow-crypt',
      npcTemplate: {
        id: 'old-perrin',
        name: 'Old Perrin',
        role: 'Tower hermit',
        canonicalDescription: 'Old Perrin is a sharp-eyed hermit who has survived by being useful and unpleasant in equal measure.',
        description: 'A sharp-eyed hermit who has survived by being useful and unpleasant in equal measure.',
        voice: 'rasping, blunt, fond of ugly truths',
        want: 'Convince Tamsin that courage without care will only add a fresh body to the road.',
        knows: 'A fingerbone token lies near a silver burial bell under the hill, and the bell lacks its clapper.',
      },
      choices: [
        {
          id: 'trade-for-rite',
          label: 'Trade plain answers for the burial custom',
          neutralSummary: 'You treated the hermit as a bargainer and exchanged facts for useful instructions.',
          writerIntent: 'Offer a direct social option that rewards candor with practical burial knowledge.',
          actionPrompt: 'The selected option is to give Old Perrin plain answers about the opened graves and demand the burial instructions in return.',
          mode: 'say',
          displayStyle: 'dialogue',
          skillTags: ['plain-speech'],
          effects: [
            { type: 'gainItem', item: bellClapper },
            { type: 'remember', text: 'The burial bell may matter because the dead began walking after its clapper went missing.' },
            { type: 'moveToNode', nodeId: 'barrow-crypt' },
          ],
        },
        {
          id: 'read-the-tower-marks',
          label: 'Read the burial marks carved into the tower stair',
          neutralSummary: 'You relied on physical evidence instead of the hermit’s performance.',
          writerIntent: 'Offer an investigative option that uses the protagonist’s grave knowledge.',
          actionPrompt: 'The selected option is to study the old burial marks carved into the tower stairwell for usable instructions.',
          mode: 'act',
          displayStyle: 'action',
          skillTags: ['grave-lore'],
          effects: [
            { type: 'remember', text: 'The barrow marks link the bell, a fingerbone token, and the old names of the buried dead.' },
            { type: 'revealNode', nodeId: 'barrow-crypt' },
            { type: 'moveToNode', nodeId: 'barrow-crypt' },
          ],
        },
      ],
    },
    {
      id: 'grave-mist',
      name: 'The mist learns to listen',
      weight: 6,
      iconAssetId: 'forest',
      prompt: 'Cold mist and broken pines show the dead are close enough to hear careless breath.',
      currentHint: 'Keep moving toward the barrow without letting the mist decide the route.',
      objectiveNodeId: 'barrow-crypt',
      choices: [
        {
          id: 'mark-safe-path',
          label: "Mark a quiet path with Tamsin's Shovel",
          neutralSummary: "You used Tamsin's Shovel as a practical tool to test ground and choose a safer route.",
          writerIntent: 'Offer a careful tool-use option that avoids stating obvious item affordances as tags.',
          actionPrompt: "The selected option is to use Tamsin's Shovel to test soft earth and mark a path where the mist lies thinnest.",
          mode: 'use-item',
          displayStyle: 'action',
          skillTags: ['grave-lore', 'steady-hands'],
          requiresItem: 'grave-spade',
          effects: [
            { type: 'remember', text: 'The mist thickens around disturbed royal dead.' },
            { type: 'moveToNode', nodeId: 'barrow-crypt' },
          ],
        },
        {
          id: 'run-through-mist',
          label: 'Run before the mist closes',
          neutralSummary: 'You traded safety for speed before the dead fully gathered.',
          writerIntent: 'Offer a high-risk option where speed leaves visible strain and danger in the narration.',
          actionPrompt: 'The selected option is to choose speed over silence and break through the mist before the dead fully gather.',
          mode: 'risk',
          displayStyle: 'action',
          skillTags: ['steady-hands'],
          effects: [
            { type: 'remember', text: 'The cold mist burned where it touched living skin.' },
            { type: 'moveToNode', nodeId: 'barrow-crypt' },
          ],
        },
      ],
    },
    {
      id: 'bandit-toll',
      name: 'Deserters ask the dead country for rent',
      weight: 2,
      iconAssetId: 'crossroads',
      prompt: 'Hungry deserters demand Tamsin hand over food, tools, and the writ before entering the dead country.',
      currentHint: 'Get past the deserters with enough strength and proof-seeking tools intact.',
      objectiveNodeId: 'barrow-crypt',
      npcTemplate: {
        id: 'sergeant-maud',
        name: 'Sergeant Maud',
        role: 'Deserter with a borrowed sword',
        canonicalDescription: 'Sergeant Maud is a hollow-cheeked veteran whose shame has hardened into toll-taking.',
        description: 'A hollow-cheeked veteran whose shame has hardened into toll-taking.',
        voice: 'dry, threatening, tired beneath the threat',
        want: 'Take enough from travelers to keep her deserters alive another week.',
        knows: 'The royal dead walk first when the bell sounds, as if old commands still pull them upright.',
      },
      choices: [
        {
          id: 'show-royal-dead-truth',
          label: 'Tell the deserters what walks in royal colors',
          neutralSummary: 'You used the deserters’ own fear and experience to make the roadblock feel pointless.',
          writerIntent: 'Offer a direct conversational option that uses known evidence without exact dialogue.',
          actionPrompt: 'The selected option is to tell Sergeant Maud about the royal corpse and challenge whether blocking this investigation helps anyone survive.',
          mode: 'say',
          displayStyle: 'dialogue',
          skillTags: ['plain-speech'],
          effects: [
            { type: 'remember', text: 'The royal dead may be walking first because old commands still cling to them.' },
            { type: 'moveToNode', nodeId: 'barrow-crypt' },
          ],
        },
        {
          id: 'trade-knife-for-passage',
          label: 'Trade the Armory Knife for quiet passage',
          neutralSummary: 'You gave up a useful object to avoid violence and keep moving.',
          writerIntent: 'Offer a careful inventory trade that avoids a fight.',
          actionPrompt: 'The selected option is to trade the Armory Knife for passage without a fight.',
          mode: 'use-item',
          displayStyle: 'action',
          skillTags: ['plain-speech'],
          requiresItem: 'armory-knife',
          effects: [
            { type: 'loseItem', itemId: 'armory-knife' },
            { type: 'remember', text: 'Avoiding the fight preserved strength for the road ahead.' },
            { type: 'moveToNode', nodeId: 'barrow-crypt' },
          ],
        },
      ],
    },
    {
      id: 'bone-charm-glimpse',
      name: 'The bone token shows itself',
      weight: 4,
      iconAssetId: 'keep',
      prompt: 'A dead man in rotted finery turns toward the bell, revealing a fingerbone token threaded with silver wire beneath its robes.',
      currentHint: 'Take proof from the barrow without giving the dead another body to carry.',
      objectiveNodeId: 'king-return',
      choices: [
        {
          id: 'hook-charm-with-spade',
          label: "Hook the Bone Token with Tamsin's Shovel",
          neutralSummary: 'You used reach and leverage to take the charm without barehanded contact.',
          writerIntent: 'Offer a risky tool-use option where the cost is handled through visible narrative consequence.',
          actionPrompt: "The selected option is to use Tamsin's Shovel to hook the Bone Token away from the dead man without touching it barehanded.",
          mode: 'use-item',
          displayStyle: 'action',
          skillTags: ['steady-hands'],
          requiresItem: 'grave-spade',
          effects: [
            { type: 'gainItem', item: boneCharm },
            { type: 'remember', text: 'The corpse’s cold bit through the spade haft.' },
            { type: 'remember', text: 'The Bone Token may be the proof that someone has been using the dead.' },
            { type: 'moveToNode', nodeId: 'king-return' },
          ],
        },
        {
          id: 'speak-burial-name',
          label: 'Speak the burial name and reach for the token',
          neutralSummary: 'You used the burial name to make the dead pause, then took the opening it created.',
          writerIntent: 'Offer a reflective burial-knowledge option without inventing exact spoken words.',
          actionPrompt: 'The selected option is to invoke the burial name and reach for the token while the dead man hesitates.',
          mode: 'say',
          displayStyle: 'dialogue',
          skillTags: ['grave-lore'],
          effects: [
            { type: 'gainItem', item: boneCharm },
            { type: 'remember', text: 'Naming the dead can slow them when the old burial customs still hold.' },
            { type: 'moveToNode', nodeId: 'king-return' },
          ],
        },
      ],
    },
    {
      id: 'lich-ritual',
      name: 'The dead rise to the wrong bell',
      weight: 10,
      iconAssetId: 'keep',
      prompt: 'The dead begin rising again in the Old Barrow while a cracked burial bell swings without its missing voice.',
      currentHint: 'Break the command over the dead, or escape with proof before the barrow closes.',
      objectiveNodeId: 'king-return',
      choices: [
        {
          id: 'restore-bell-and-break-charm',
          label: 'Restore the bell and break the Bone Token',
          neutralSummary: 'You made the burial bell whole and used it to turn the dead away.',
          writerIntent: 'Offer the strongest prepared burial-custom solution for players who found the clapper.',
          actionPrompt: 'The selected option is to set the Silver Bell Clapper into the burial bell, ring it, and break the Bone Token as the dead turn toward the sound.',
          mode: 'use-item',
          displayStyle: 'action',
          skillTags: ['grave-lore', 'steady-hands'],
          requiresItem: 'bell-clapper',
          effects: [
            { type: 'gainItem', item: boneCharm },
            { type: 'remember', text: 'The burial bell rang whole, and the dead lost whatever command held them upright.' },
            { type: 'setFlag', flag: 'lich-ended', value: true },
            { type: 'moveToNode', nodeId: 'king-return' },
          ],
        },
        {
          id: 'bind-crypt-with-iron',
          label: 'Bar the barrow door with scavenged iron',
          neutralSummary: 'You used scavenged iron to hold the door when a clean ending was not available.',
          writerIntent: 'Offer a costly fallback that can still carry the story forward.',
          actionPrompt: 'The selected option is to use every available scrap of iron to bar the barrow door long enough to escape with proof.',
          mode: 'use-item',
          displayStyle: 'action',
          skillTags: ['steady-hands'],
          requiresItem: 'cracked-spear-head',
          effects: [
            { type: 'loseItem', itemId: 'cracked-spear-head' },
            { type: 'remember', text: 'The barrow fought back with dead hands and falling stone.' },
            { type: 'gainItem', item: boneCharm },
            { type: 'setFlag', flag: 'lich-contained', value: true },
            { type: 'moveToNode', nodeId: 'king-return' },
          ],
        },
      ],
    },
    {
      id: 'royal-proof',
      name: 'Proof dirties the throne room',
      weight: 10,
      iconAssetId: 'lantern',
      prompt: 'Tamsin returns to King Osric with mud, wounds, and whatever proof she could carry from under the hill.',
      currentHint: 'Make the proof public enough that the court cannot rename it service.',
      choices: [
        {
          id: 'lay-proof-before-king',
          label: 'Lay the proof before the king and make him look',
          neutralSummary: 'You used the carried evidence to force public acknowledgment.',
          writerIntent: 'Offer a direct ending option focused on accountability and proof.',
          actionPrompt: 'The selected option is to lay the proof before King Osric and force public acknowledgment of the order’s cost.',
          mode: 'act',
          displayStyle: 'action',
          skillTags: ['plain-speech'],
          requiresItem: 'bone-charm',
          effects: [
            { type: 'remember', text: 'Tamsin returned with proof and made the king look at what his command cost.' },
            { type: 'setFlag', flag: 'proof-delivered', value: true },
          ],
        },
        {
          id: 'demand-names-read',
          label: 'Demand the names of the dead be read before reward',
          neutralSummary: 'You made witness and remembrance the price of any royal gratitude.',
          writerIntent: 'Offer a reflective ending option that centers the dead rather than reward.',
          actionPrompt: 'The selected option is to refuse reward until the names of the raised and reburied dead are read aloud in the hall.',
          mode: 'say',
          displayStyle: 'dialogue',
          skillTags: ['grave-lore', 'plain-speech'],
          effects: [
            { type: 'remember', text: 'Tamsin demanded witness for the dead before accepting any royal gratitude.' },
            { type: 'setFlag', flag: 'proof-delivered', value: true },
          ],
        },
      ],
    },
  ],
}

const nodeById = new Map(storySchema.nodes.map((node) => [node.id, node]))
const eventById = new Map(storySchema.events.map((event) => [event.id, event]))

const llmModelPresets: LlmModelPreset[] = [
  {
    id: 'auto',
    label: 'Auto',
    description: 'Pick the best installed local model for interactive fiction.',
    preferredModels: ['qwen3.6:latest', 'qwen3.6', 'qwen2.5:7b', 'llama3.1:8b', 'llama3.2:3b', 'mistral:7b', 'gemma2:9b'],
    options: { temperature: 0.68, top_p: 0.9, repeat_penalty: 1.08, num_ctx: 4096, num_predict: 320 },
  },
  {
    id: 'fast',
    label: 'Fast',
    description: 'Lower latency for laptops and smaller machines.',
    preferredModels: ['llama3.2:3b', 'qwen2.5:3b', 'phi3:mini'],
    options: { temperature: 0.64, top_p: 0.88, repeat_penalty: 1.08, num_ctx: 3072, num_predict: 260 },
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Recommended balance of prose quality and speed.',
    preferredModels: ['qwen3.6:latest', 'qwen3.6', 'qwen2.5:7b', 'llama3.1:8b', 'mistral:7b'],
    options: { temperature: 0.68, top_p: 0.9, repeat_penalty: 1.08, num_ctx: 4096, num_predict: 320 },
  },
  {
    id: 'quality',
    label: 'Quality',
    description: 'Richer prose if your machine can comfortably run larger models.',
    preferredModels: ['qwen3.6:latest', 'qwen3.6', 'qwen2.5:14b', 'llama3.1:8b', 'gemma2:9b', 'qwen2.5:7b'],
    options: { temperature: 0.72, top_p: 0.92, repeat_penalty: 1.1, num_ctx: 6144, num_predict: 420 },
  },
]

const defaultLlmSettings: LlmSettings = {
  endpoint: 'http://localhost:11434',
  model: 'qwen3.6:latest',
  presetId: 'auto',
  options: llmModelPresets[0].options,
  think: false,
}

const allKnownItems = [graveSpade, graveAsh, ironNails, royalWrit, betterKnife, crackedSpearHead, bellClapper, boneCharm]

function getSystemThemeMode(): ResolvedThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getNextThemeMode(themeMode: ThemeMode): ThemeMode {
  if (themeMode === 'system') {
    return getSystemThemeMode() === 'dark' ? 'light' : 'dark'
  }

  return themeMode === 'dark' ? 'light' : 'dark'
}

const initialState: CampaignState = {
  player: storySchema.player,
  storyNpcs: [],
  currentNodeId: 'graymere-yard',
  currentEvent: undefined,
  sceneOpened: false,
  exploredNodeIds: ['graymere-yard'],
  eventHistory: [],
  feed: [
    {
      id: 'opening',
      kind: 'narration',
      speaker: 'Narrator',
      nodeId: 'graymere-yard',
      text: storySchema.openingNarration,
    },
  ],
  debugFeed: [],
  flags: {},
  canonicalFacts: {
    [getNode('graymere-yard').publicName]: getNodeCanonicalFact(getNode('graymere-yard')),
  },
  outcome: 'running',
}

initialState.feed.unshift({ id: 'opening-location', ...createLocationFeedEntry(getNode('graymere-yard')) })

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createLocationFeedEntry(node: StoryNode): Omit<FeedEntry, 'id'> {
  return {
    kind: 'location',
    speaker: 'Location',
    nodeId: node.id,
    text: node.publicName,
    content: {
      name: node.name,
      nodeType: node.nodeType,
    },
  }
}

function splitFeedLines(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function splitReadableParagraphs(line: string) {
  if (line.length <= 420) {
    return [line]
  }

  const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean)
  const paragraphs: string[] = []
  let current = ''

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence

    if (current && next.length > 360) {
      paragraphs.push(current)
      current = sentence
    } else {
      current = next
    }
  }

  if (current) {
    paragraphs.push(current)
  }

  return paragraphs.length > 0 ? paragraphs : [line]
}

function getFeedDisplayLines(entry: FeedEntry) {
  const lines = splitFeedLines(entry.text)

  if (entry.kind !== 'narration' && entry.kind !== 'dialogue') {
    return lines
  }

  return lines.flatMap(splitReadableParagraphs)
}

function getFirstSentence(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const sentenceMatch = normalized.match(/^.+?[.!?](?=\s|$)/)

  return (sentenceMatch?.[0] ?? normalized).slice(0, 240)
}

function setCanonicalFact(facts: CampaignState['canonicalFacts'], subject: string, fact: string | undefined) {
  const cleanSubject = subject.trim()
  const cleanFact = fact?.replace(/\s+/g, ' ').trim()

  if (!cleanSubject || !cleanFact || facts[cleanSubject]) {
    return facts
  }

  return { ...facts, [cleanSubject]: getFirstSentence(cleanFact) }
}

function getNpcCanonicalFact(npc: StoryNpcTemplate) {
  return npc.canonicalDescription ?? npc.description
}

function getNodeCanonicalFact(node: StoryNode) {
  return node.canonicalDescription ?? node.description
}

function getNode(id: string) {
  return nodeById.get(id) ?? storySchema.nodes[0]
}

function getNodeExits(node: StoryNode) {
  return node.exits.length > 0 ? node.exits : (node.nextNodeIds ?? []).map((toNodeId) => ({ toNodeId }))
}

function getNodePosition(node: StoryNode, index = storySchema.nodes.findIndex((candidate) => candidate.id === node.id)) {
  const safeIndex = index < 0 ? 0 : index

  return node.mapPosition ?? { x: 120 + (safeIndex % 3) * 180, y: 520 - Math.floor(safeIndex / 3) * 160 }
}

function getNodeDistance(from: StoryNode, to: StoryNode) {
  const fromPosition = getNodePosition(from)
  const toPosition = getNodePosition(to)

  return Math.hypot(toPosition.x - fromPosition.x, toPosition.y - fromPosition.y)
}

function getNodeTypeLabel(nodeType: StoryNodeType) {
  const labels: Record<StoryNodeType, string> = {
    origin: 'Starting point',
    settlement: 'Settlement',
    road: 'Road',
    wilds: 'Wilds',
    watch: 'Watchpoint',
    crypt: 'Barrow',
    court: 'Court',
    ritual: 'Burial site',
    hazard: 'Danger',
    mystery: 'Unknown',
  }

  return labels[nodeType]
}

function getLlmPreset(id: LlmPresetId) {
  return llmModelPresets.find((preset) => preset.id === id) ?? llmModelPresets[0]
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function sanitizeLlmOptions(options: OllamaGenerationOptions): OllamaGenerationOptions {
  return {
    temperature: clampNumber(options.temperature, 0, 1.5),
    top_p: clampNumber(options.top_p, 0.1, 1),
    repeat_penalty: clampNumber(options.repeat_penalty, 0.8, 1.5),
    num_ctx: Math.round(clampNumber(options.num_ctx, 2048, 8192)),
    num_predict: Math.round(clampNumber(options.num_predict, 120, 800)),
  }
}

function getEffectiveLlmOptions(settings: LlmSettings) {
  const presetOptions = settings.presetId === 'custom' ? defaultLlmSettings.options : getLlmPreset(settings.presetId).options

  return sanitizeLlmOptions({ ...presetOptions, ...settings.options })
}

function getBestInstalledModel(modelNames: string[], presetId: LlmPresetId) {
  const preset = getLlmPreset(presetId)
  const installedModels = new Set(modelNames)
  const presetMatch = preset.preferredModels.find((model) => installedModels.has(model))

  if (presetMatch) {
    return presetMatch
  }

  const broadlyRecommended = ['qwen3.6:latest', 'qwen3.6', 'qwen2.5:7b', 'llama3.1:8b', 'llama3.2:3b', 'mistral:7b', 'gemma2:9b', 'qwen2.5:3b', 'phi3:mini']
  return broadlyRecommended.find((model) => installedModels.has(model)) ?? modelNames[0]
}

function normalizeOllamaBase(endpoint: string) {
  return endpoint.trim().replace(/\/+$/, '')
}

function normalizeOllamaGenerateEndpoint(endpoint: string) {
  return `${normalizeOllamaBase(endpoint)}/api/generate`
}

async function fetchOllamaModelNames(endpoint: string) {
  const response = await fetch(`${normalizeOllamaBase(endpoint)}/api/tags`)

  if (!response.ok) {
    throw new Error(`Ollama is reachable but returned ${response.status}. Start Ollama and try again.`)
  }

  const data = (await response.json()) as { models?: Array<{ name?: string }> }
  return data.models?.map((model) => model.name).filter((name): name is string => Boolean(name)) ?? []
}

async function assertLocalModelAvailable(settings: LlmSettings) {
  const modelNames = await fetchOllamaModelNames(settings.endpoint)

  if (modelNames.length === 0) {
    throw new Error('Ollama is running, but no local models were found. Try: ollama pull qwen3.6')
  }

  if (!modelNames.includes(settings.model)) {
    throw new Error(`Model "${settings.model}" is not installed. Available models: ${modelNames.join(', ')}.`)
  }
}

async function streamLocalText(settings: LlmSettings, prompt: string, onChunk: (chunk: string) => void | Promise<void>) {
  const response = await fetch(normalizeOllamaGenerateEndpoint(settings.endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model,
      prompt,
      stream: true,
      think: settings.think,
      options: getEffectiveLlmOptions(settings),
    }),
  })

  if (!response.ok) {
    throw new Error(`Local model returned ${response.status}. The story cannot advance until the model is running.`)
  }

  if (!response.body) {
    const data = (await response.json()) as { response?: string }
    const text = data.response ?? ''
    await onChunk(text)
    return text
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let receivedThinkingOnlyOutput = false

  const processLine = async (line: string) => {
    const trimmed = line.trim()

    if (!trimmed) {
      return
    }

    let data: { response?: string; thinking?: string; done?: boolean }

    try {
      data = JSON.parse(trimmed) as { response?: string; thinking?: string; done?: boolean }
    } catch {
      throw new Error('The local model returned a malformed streaming response. Restart Ollama and try again.')
    }

    const chunk = data.response ?? ''

    if (!chunk && data.thinking) {
      receivedThinkingOnlyOutput = true
    }

    if (chunk) {
      fullText += chunk
      await onChunk(chunk)
    }
  }

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      await processLine(line)
    }
  }

  await processLine(buffer)

  if (!fullText.trim() && receivedThinkingOnlyOutput) {
    throw new Error('The model spent its generation budget on hidden thinking and returned no story text. Turn model thinking off, or increase Max generated tokens and try again.')
  }

  return fullText.trim()
}

function weightedChoice<T>(items: T[], getWeight: (item: T) => number) {
  const totalWeight = items.reduce((total, item) => total + Math.max(0, getWeight(item)), 0)

  if (items.length === 0 || totalWeight <= 0) {
    return undefined
  }

  let roll = Math.random() * totalWeight

  for (const item of items) {
    roll -= Math.max(0, getWeight(item))

    if (roll <= 0) {
      return item
    }
  }

  return items[items.length - 1]
}

function drawStoryEvent(state: CampaignState) {
  const node = getNode(state.currentNodeId)
  const recentEventIds = new Set(state.eventHistory.slice(-2).map((event) => event.id))
  const weightedEvents = node.eventWeights
    .map(({ eventId, weight }) => {
      const event = eventById.get(eventId)
      return event ? { event, weight } : undefined
    })
    .filter((entry): entry is { event: StoryEvent; weight: number } => Boolean(entry))
  const availableEvents = weightedEvents.filter(({ event }) => !recentEventIds.has(event.id))
  const pool = availableEvents.length > 0 ? availableEvents : weightedEvents

  return weightedChoice(pool, ({ weight }) => weight)?.event ?? storySchema.events[0]
}

function hasInventoryItem(player: PlayableCharacter, itemId: string) {
  return player.inventory.some((item) => item.id === itemId)
}

function addInventoryItem(player: PlayableCharacter, item: InventoryItem) {
  if (hasInventoryItem(player, item.id)) {
    return player
  }

  return { ...player, inventory: [...player.inventory, item] }
}

function removeInventoryItem(player: PlayableCharacter, itemId: string) {
  return { ...player, inventory: player.inventory.filter((item) => item.id !== itemId) }
}

function getTravelBlockerReason(state: CampaignState, exit: StoryExit) {
  const blocker = exit.blocker

  if (!blocker) {
    return undefined
  }

  if (blocker.clearedByFlag && state.flags[blocker.clearedByFlag]) {
    return undefined
  }

  if (blocker.requiredFlag && !state.flags[blocker.requiredFlag]) {
    return blocker.reason
  }

  if (blocker.requiredItemId && !hasInventoryItem(state.player, blocker.requiredItemId)) {
    return blocker.reason
  }

  if (blocker.requiredFlag || blocker.requiredItemId || blocker.clearedByFlag) {
    return undefined
  }

  return blocker.preventsTravel === false ? undefined : blocker.reason
}

function getUnfinishedBusinessReason(state: CampaignState) {
  const currentNode = getNode(state.currentNodeId)

  for (const business of currentNode.unfinishedBusiness ?? []) {
    if (business.clearedByFlag && state.flags[business.clearedByFlag]) {
      continue
    }

    if (business.requiredFlag && !state.flags[business.requiredFlag]) {
      continue
    }

    if (business.requiredItemId && !hasInventoryItem(state.player, business.requiredItemId)) {
      continue
    }

    if (business.activeEventId && state.currentEvent?.id !== business.activeEventId) {
      continue
    }

    return business.reason
  }

  return undefined
}

function getCurrentObjective(state: CampaignState) {
  if (state.outcome === 'won') {
    return 'The proof has been delivered; the hall now has to hear the dead by name.'
  }

  if (state.outcome === 'lost') {
    return 'Tamsin can go no farther; the dead keep walking under orders no one will admit giving.'
  }

  const unfinishedBusinessReason = getUnfinishedBusinessReason(state)

  if (unfinishedBusinessReason) {
    return unfinishedBusinessReason
  }

  if (state.currentEvent?.currentHint) {
    return state.currentEvent.currentHint
  }

  if (storySchema.objective.currentHint) {
    return storySchema.objective.currentHint
  }

  return storySchema.objective.summary
}

function getAdjacentTravelTargets(state: CampaignState) {
  const currentNode = getNode(state.currentNodeId)
  const explored = new Set(state.exploredNodeIds)

  return getNodeExits(currentNode)
    .map((exit) => {
      const node = getNode(exit.toNodeId)

      return {
        node,
        exit,
        explored: explored.has(node.id),
        distance: getNodeDistance(currentNode, node),
        blockedReason: getTravelBlockerReason(state, exit),
      }
    })
    .sort((a, b) => a.distance - b.distance)
}

function getNearestUnexploredAdjacentTargets(state: CampaignState) {
  const unexploredTargets = getAdjacentTravelTargets(state).filter((target) => !target.explored && !target.blockedReason)
  const nearestDistance = Math.min(...unexploredTargets.map((target) => target.distance))

  if (!Number.isFinite(nearestDistance)) {
    return []
  }

  return unexploredTargets.filter((target) => Math.abs(target.distance - nearestDistance) < 0.001)
}

function getTravelDisabledReason(state: CampaignState, nodeId: string) {
  if (!state.sceneOpened || !state.currentEvent) {
    return 'Begin the current scene before leaving this place.'
  }

  if (nodeId === state.currentNodeId) {
    return 'Tamsin is already here.'
  }

  const unfinishedBusinessReason = getUnfinishedBusinessReason(state)

  if (unfinishedBusinessReason) {
    return unfinishedBusinessReason
  }

  const target = getAdjacentTravelTargets(state).find((candidate) => candidate.node.id === nodeId)

  if (!target) {
    return 'That place is not connected to the current location.'
  }

  if (target.blockedReason) {
    return target.blockedReason
  }

  if (target.explored) {
    return undefined
  }

  const nearestUnexploredTargets = getNearestUnexploredAdjacentTargets(state)
  const isNearestUnexploredTarget = nearestUnexploredTargets.some((candidate) => candidate.node.id === nodeId)

  return isNearestUnexploredTarget ? undefined : 'A nearer unknown route has to be dealt with first.'
}

function getChoiceDisabledReason(state: CampaignState, choice: StoryChoice) {
  if (choice.requiresItem && !hasInventoryItem(state.player, choice.requiresItem)) {
    const knownItem = allKnownItems.find((item) => item.id === choice.requiresItem)
    return `Requires: ${knownItem?.name ?? 'a missing item'}`
  }

  return undefined
}

function getAvailableChoices(state: CampaignState) {
  return state.currentEvent?.choices ?? []
}

function getChoiceVarietyWarnings(event: StoryEvent) {
  const modes = new Set(event.choices.map((choice) => choice.mode))
  const warnings: string[] = []

  if (event.choices.length < 3) {
    warnings.push(`${event.name} has fewer than 3 authored options.`)
  }

  if (modes.size < Math.min(2, event.choices.length)) {
    warnings.push(`${event.name} options do not vary by action mode.`)
  }

  return warnings
}

function describeEffect(effect: StoryEffect) {
  switch (effect.type) {
    case 'gainItem':
      return `Gain item: ${effect.item.name}`
    case 'loseItem':
      return `Lose item: ${effect.itemId}`
    case 'remember':
      return `Remember: ${effect.text}`
    case 'revealNode':
      return `Reveal place: ${getNode(effect.nodeId).publicName}`
    case 'moveToNode':
      return `Move to: ${getNode(effect.nodeId).publicName}`
    case 'setFlag':
      return `Set ${effect.flag}: ${String(effect.value)}`
  }
}

function formatBadgeText(text: string, maxLength = 80) {
  const normalized = text.trim().replace(/\s+/g, ' ').replace(/[.。]$/, '')

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`
}

function getEffectBadges(effects: StoryEffect[]) {
  const movedNodeIds = new Set(
    effects
      .filter((effect): effect is Extract<StoryEffect, { type: 'moveToNode' }> => effect.type === 'moveToNode')
      .map((effect) => effect.nodeId),
  )
  const badges: string[] = []
  const seen = new Set<string>()

  for (const effect of effects) {
    const badge = getEffectBadge(effect, movedNodeIds)

    if (!badge || seen.has(badge)) {
      continue
    }

    seen.add(badge)
    badges.push(badge)
  }

  return badges
}

function getEffectBadge(effect: StoryEffect, movedNodeIds = new Set<string>()): string | null {
  switch (effect.type) {
    case 'gainItem':
      return `Gained ${effect.item.name}`
    case 'loseItem': {
      const item = allKnownItems.find((candidate) => candidate.id === effect.itemId)
      return `Lost ${item?.name ?? effect.itemId}`
    }
    case 'remember':
      return `Learned: ${formatBadgeText(effect.text)}`
    case 'revealNode':
      if (movedNodeIds.has(effect.nodeId)) {
        return null
      }

      return `Discovered ${getNode(effect.nodeId).publicName}`
    case 'moveToNode':
      return `Traveling to ${getNode(effect.nodeId).publicName}`
    case 'setFlag':
      return null
  }
}

function getStoryChoiceModeBadge(mode: StoryChoiceMode) {
  const labels: Record<StoryChoiceMode, string> = {
    act: 'ACT',
    say: 'SAY',
    ask: 'ASK',
    'use-item': 'USE',
    risk: 'RISK',
    wait: 'WAIT',
  }

  return labels[mode]
}

function getStoryChoiceModeColor(mode: StoryChoiceMode) {
  const colors: Record<StoryChoiceMode, string> = {
    say: 'var(--color-say)',
    ask: 'var(--color-ask)',
    act: 'var(--color-act)',
    risk: 'var(--color-risk)',
    wait: 'var(--color-wait)',
    'use-item': 'var(--color-use)',
  }

  return colors[mode]
}

function StoryChoiceModeIcon({ mode }: { mode: StoryChoiceMode }) {
  const icons = {
    act: HandIcon,
    say: MessageCircleIcon,
    ask: MessageCircleQuestionIcon,
    'use-item': PackageIcon,
    risk: TriangleAlertIcon,
    wait: ClockIcon,
  } satisfies Record<StoryChoiceMode, typeof HandIcon>
  const Icon = icons[mode]

  return <Icon className="size-3" aria-hidden="true" />
}

function choiceNeedsConfirmation(choice: StoryChoice) {
  return (choice.effects ?? []).some((effect) => {
    if (effect.type === 'loseItem') {
      const item = allKnownItems.find((candidate) => candidate.id === effect.itemId)
      return Boolean(item && !item.consumable)
    }

    return false
  })
}

function applyStoryEffects(state: CampaignState, effects: StoryEffect[]) {
  let player = state.player
  let currentNodeId = state.currentNodeId
  let exploredNodeIds = state.exploredNodeIds
  let flags = state.flags

  for (const effect of effects) {
    if (effect.type === 'gainItem') {
      player = addInventoryItem(player, effect.item)
    }

    if (effect.type === 'loseItem') {
      player = removeInventoryItem(player, effect.itemId)
    }

    if (effect.type === 'remember') {
      player = { ...player, memory: [...player.memory, effect.text].slice(-8) }
    }

    if (effect.type === 'revealNode') {
      exploredNodeIds = exploredNodeIds.includes(effect.nodeId) ? exploredNodeIds : [...exploredNodeIds, effect.nodeId]
    }

    if (effect.type === 'moveToNode') {
      currentNodeId = effect.nodeId
      exploredNodeIds = exploredNodeIds.includes(effect.nodeId) ? exploredNodeIds : [...exploredNodeIds, effect.nodeId]
    }

    if (effect.type === 'setFlag') {
      flags = { ...flags, [effect.flag]: effect.value }
    }
  }

  const outcome: CampaignState['outcome'] = currentNodeId === storySchema.goalNodeId && flags['proof-delivered'] ? 'won' : 'running'

  return { ...state, player, currentNodeId, exploredNodeIds, flags, outcome }
}

function formatRecentFeed(feed: FeedEntry[]) {
  return feed
    .slice(-10)
    .map((entry) => `${entry.speaker ?? entry.kind}: ${entry.generatedText ?? entry.text}`)
    .join('\n')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getPlayerCodexSummary(player: PlayableCharacter) {
  return `${player.name} is ${player.role.toLowerCase()}, ${player.backstory.origin.charAt(0).toLowerCase()}${player.backstory.origin.slice(1)} She wants to survive, put the dead back down, and make the king reckon with what his orders cost.`
}

function getNpcCodexSummary(person: StoryNpcTemplate) {
  return `${person.name} is ${person.role.toLowerCase()}. ${person.description} Wants: ${person.want}`
}

function getCanonicalFactForReference(facts: CampaignState['canonicalFacts'], reference: CodexReference) {
  const directFact = facts[reference.term]

  if (directFact) {
    return directFact
  }

  if (reference.type === 'place' && reference.targetId) {
    const node = getNode(reference.targetId)
    return facts[node.publicName] ?? facts[node.name]
  }

  return undefined
}

function getCodexReferenceSummary(reference: CodexReference, facts?: CampaignState['canonicalFacts']) {
  const canonicalFact = facts ? getCanonicalFactForReference(facts, reference) : undefined

  if (canonicalFact) {
    return canonicalFact
  }

  const explicitSummary = codexTermSummaries[reference.term.toLowerCase()]

  if (explicitSummary) {
    return explicitSummary
  }

  if (reference.type === 'place' && reference.targetId) {
    return getNode(reference.targetId).description
  }

  if (reference.type === 'item' && reference.targetId) {
    const item = allKnownItems.find((candidate) => candidate.id === reference.targetId)
    return item?.description ?? 'A known item in Tamsin’s story.'
  }

  if (reference.type === 'person') {
    if (reference.targetId === storySchema.player.id || reference.term.toLowerCase() === storySchema.player.name.toLowerCase()) {
      return getPlayerCodexSummary(storySchema.player)
    }

    const person = reference.targetId ? storySchema.events.map((event) => event.npcTemplate).find((npc) => npc?.id === reference.targetId) : undefined
    return person ? getNpcCodexSummary(person) : `${reference.term} is a named person in Tamsin’s story; their role and loyalties are still emerging through play.`
  }

  return `${reference.term} is part of the current story codex.`
}

function getCodexReferences(state: CampaignState) {
  const references: CodexReference[] = []
  const seenTerms = new Set<string>()
  const addReference = (reference: CodexReference) => {
    const key = reference.term.toLowerCase()

    if (reference.term.trim().length === 0 || seenTerms.has(key)) {
      return
    }

    seenTerms.add(key)
    references.push(reference)
  }

  state.exploredNodeIds.forEach((nodeId) => {
    const node = getNode(nodeId)
    addReference({ term: node.publicName, type: 'place', targetId: node.id })
    addReference({ term: node.name, type: 'place', targetId: node.id })
  })
  addReference({ term: state.player.name, type: 'person', targetId: state.player.id })
  state.player.inventory.filter((item) => item.visible).forEach((item) => addReference({ term: item.name, type: 'item', targetId: item.id }))
  state.storyNpcs.forEach((npc) => addReference({ term: npc.name, type: 'person', targetId: npc.id }))
  storySchema.codexTerms.forEach((term) => {
    const explicitTarget = codexTermTargets[term]

    if (explicitTarget) {
      addReference({ term, type: explicitTarget.type, targetId: explicitTarget.targetId })
      return
    }

    const matchingPlace = storySchema.nodes.find((node) => node.publicName.toLowerCase() === term.toLowerCase() || node.name.toLowerCase() === term.toLowerCase())
    const matchingItem = state.player.inventory.find((item) => item.name.toLowerCase() === term.toLowerCase())
    addReference({ term, type: matchingPlace ? 'place' : matchingItem ? 'item' : 'term', targetId: matchingPlace?.id ?? matchingItem?.id })
  })

  return references.sort((a, b) => b.term.length - a.term.length)
}

function formatPlayerSheet(player: PlayableCharacter) {
  return `Name: ${player.name}
Role: ${player.role}
Current condition: ${player.condition}
Visible inventory: ${player.inventory.filter((item) => item.visible).map((item) => item.name).join(', ') || 'None'}
Internal skill tags: ${player.skillTags.join(', ')}
Public presentation: ${player.voice.publicStyle}
Authorial constraints: fear of ${player.voice.fear}; wants ${player.voice.desire}; contradiction: ${player.voice.contradiction}
Origin: ${player.backstory.origin}
Wound: ${player.backstory.wound}
Known goal: ${player.backstory.want}
Private knowledge available to the player: ${player.backstory.privateKnowledge}
Recent known story facts: ${player.memory.slice(-5).join(' / ')}`
}

function sanitizePlayerCondition(text: string, fallback: string) {
  const firstLine = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)[0]?.trim()

  if (!firstLine || /\b(hp|health points?|hit points?|bar|bars?|percent|percentage|level)\b/i.test(firstLine)) {
    return fallback
  }

  return firstLine.slice(0, 180)
}

function formatCodexContext(state: CampaignState) {
  const currentNode = getNode(state.currentNodeId)
  const knownPlaces = state.exploredNodeIds.map((nodeId) => {
    const node = getNode(nodeId)
    return `${node.publicName}: ${node.description}${node.id === state.currentNodeId ? ' Current location.' : ''}`
  })
  const knownNpcs = state.storyNpcs.map((npc) => `${npc.name}: ${npc.role}. ${npc.description} Wants: ${npc.want}. Knows: ${npc.knows}. Memory: ${npc.memory.slice(-4).join(' / ')}`)
  const seenEvents = [...new Set(state.eventHistory.map((event) => event.name))]
  const flags = Object.entries(state.flags).filter(([, value]) => value).map(([flag]) => flag)

  const confirmedFacts = Object.entries(state.canonicalFacts).map(([subject, fact]) => `[${subject}]: ${fact}`)

  return `Current place: ${currentNode.publicName}

Player:
${formatPlayerSheet(state.player)}

Known places:
${knownPlaces.join('\n') || 'None yet.'}

Known people:
${knownNpcs.join('\n') || 'No one else has been closely encountered yet.'}

Seen events:
${seenEvents.join(', ') || 'None yet.'}

Known flags:
${flags.join(', ') || 'None.'}

Confirmed facts:
${confirmedFacts.join('\n') || 'None yet.'}`
}

function formatSceneNpcs(npcs: StoryNpc[]) {
  if (npcs.length === 0) {
    return 'None.'
  }

  return npcs.map((npc) => `${npc.name} (${npc.role}): ${npc.description} Voice: ${npc.voice}. Wants: ${npc.want}. Knows: ${npc.knows}.`).join('\n')
}

function getOrCreateEventNpc(state: CampaignState, event: StoryEvent) {
  if (!event.npcTemplate) {
    return { storyNpcs: state.storyNpcs, sceneNpc: undefined, canonicalFacts: state.canonicalFacts }
  }

  const existingNpc = state.storyNpcs.find((npc) => npc.id === event.npcTemplate?.id)

  if (existingNpc) {
    return { storyNpcs: state.storyNpcs, sceneNpc: existingNpc, canonicalFacts: state.canonicalFacts }
  }

  const sceneNpc: StoryNpc = {
    ...event.npcTemplate,
    introducedByEventId: event.id,
    currentNodeId: state.currentNodeId,
    memory: [`Introduced during ${event.name}.`],
  }

  return {
    storyNpcs: [...state.storyNpcs, sceneNpc],
    sceneNpc,
    canonicalFacts: setCanonicalFact(state.canonicalFacts, sceneNpc.name, getNpcCanonicalFact(sceneNpc)),
  }
}

const originalStoryRule = 'Do not name, quote, imitate, or allude to protected fictional settings, characters, authors, franchises, signature passages, or named external works. Use only this original schema and generic genre language.'
const playerAgencyRule = 'Do not write the player character’s private thoughts, feelings, doubts, motives, exact speech, or unchosen actions. Only frame, resolve, or respond to the selected option as stated.'
const groundedMedievalRule = 'For texture, favor grounded medieval hardship, plain names, practical social friction, and simple burial customs; do not copy or evoke any specific external work.'
const gameMasterNarratorFrame = `You are a Game Master narrating a living world. You write in second person, present tense.
You describe only what the player character can perceive right now — what they see, hear, smell, and feel in this exact moment. You never summarise past events or skip ahead. You never write the player character's thoughts, decisions, or dialogue. Every passage should end with the world in a state of tension — something unresolved, a detail that demands attention, or a choice that feels urgent. You respect the world's fixed rules absolutely: locations are fixed, exits are fixed, NPCs behave consistently with their established nature. You do not invent new locations, new exits, or new factions. If an authored choice leads to a consequence, you narrate that consequence viscerally and concretely. Keep passages to 120–180 words.`
const directionWords = ['north', 'south', 'east', 'west', 'up', 'down', 'left', 'right', 'through', 'across'] as const

function buildWorldRulesBlock() {
  const rules = storySchema.fixedRules.map((rule, index) => `${index + 1}. ${rule}`)

  return `--- WORLD RULES (ABSOLUTE — NEVER VIOLATE) ---
${rules.join('\n') || '1. No additional world rules are defined.'}
These rules cannot be broken by player choices, NPC behaviour, or narrative convenience.
If a generated passage would violate any rule, rewrite it before outputting.
---`
}

function buildObjectivePressureBlock() {
  return `--- CURRENT OBJECTIVE ---
The player's goal: ${storySchema.objective.summary}. Your narration should keep this goal felt but not stated — the world should apply pressure toward it without the narrator ever saying "you must" or "remember your mission."
---`
}

function buildEstablishedFactsBlock(state: CampaignState) {
  const facts = Object.entries(state.canonicalFacts)

  return `--- ESTABLISHED FACTS (DO NOT CONTRADICT) ---
${facts.length > 0 ? facts.map(([subject, fact]) => `[${subject}]: ${fact}`).join('\n') : 'No canonical facts have been confirmed yet.'}
---`
}

function getExitDirection(exit: StoryExit) {
  return exit.direction ?? exit.label ?? `Route to ${getNode(exit.toNodeId).publicName}`
}

function getExplorationHintForExit(exit: StoryExit) {
  const targetNode = getNode(exit.toNodeId)
  const direction = exit.direction ?? 'ahead'

  return targetNode.explorationHint ?? `A ${getNodeTypeLabel(targetNode.nodeType).toLowerCase()} waits ${direction}, still unnamed.`
}

function getUnexploredExitHints(state: CampaignState) {
  const explored = new Set(state.exploredNodeIds)
  const currentNode = getNode(state.currentNodeId)

  return getNodeExits(currentNode)
    .filter((exit) => !explored.has(exit.toNodeId))
    .map((exit) => getExplorationHintForExit(exit))
}

function buildUnexploredExitSensesBlock(state: CampaignState) {
  const hints = getUnexploredExitHints(state)

  if (hints.length === 0) {
    return ''
  }

  return `At the edge of this scene, the player may sense: ${hints.join(' ')}
Weave one of these into the closing atmosphere of your passage if it fits naturally.
Do not name the destination. Do not invent alternative routes.`
}

function hasVisitedNodeInFeed(state: CampaignState, nodeId: string) {
  return state.feed.some((entry) => entry.nodeId === nodeId && (entry.kind === 'narration' || entry.kind === 'dialogue' || entry.kind === 'location'))
}

function buildVisitedSceneOpeningRule(state: CampaignState) {
  const node = getNode(state.currentNodeId)

  if (!hasVisitedNodeInFeed(state, node.id)) {
    return 'This is the first generated passage here; establish only immediate sensory pressure, not a full gazetteer description.'
  }

  return `The player has been to ${node.publicName} before. Open with action, atmosphere, or changed pressure; do not restate the location name as if introducing it for the first time.`
}

function buildWorldTopologyBlock(state: CampaignState) {
  const currentNode = getNode(state.currentNodeId)
  const exits = getNodeExits(currentNode)
  const exitSummaries = exits.map((exit) => `${getExitDirection(exit)} → ${exit.toNodeId}`)
  const blockedExitSummaries = exits
    .map((exit) => {
      const blockedReason = getTravelBlockerReason(state, exit)
      return blockedReason ? `${getExitDirection(exit)} → ${exit.toNodeId}: ${blockedReason}` : undefined
    })
    .filter(Boolean)
  const adjacentLocationNames = exits.map((exit) => getNode(exit.toNodeId).publicName)

  return `--- WORLD TOPOLOGY (DO NOT CONTRADICT) ---
Current location: ${currentNode.name}
Exits from here: ${exitSummaries.join(', ') || 'None'}
Blocked exits: ${blockedExitSummaries.join(', ') || 'None'}
Adjacent locations you may reference by name only: ${adjacentLocationNames.join(', ') || 'None'}
Locations that do not exist in this world: you must not invent any.
---`
}

function getValidExitDirectionWords(state: CampaignState) {
  const currentNode = getNode(state.currentNodeId)
  const exitText = getNodeExits(currentNode).map((exit) => getExitDirection(exit).toLowerCase()).join(' ')

  return new Set(directionWords.filter((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(exitText)))
}

function getInvalidGeneratedDirections(state: CampaignState, text: string) {
  const validDirections = getValidExitDirectionWords(state)

  return directionWords.filter((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(text) && !validDirections.has(word))
}

function getSelectedChoicePromptPrefix(choice: StoryChoice) {
  if (choice.displayStyle === 'dialogue') {
    return `The player says (intent): ${choice.label}`
  }

  if (choice.displayStyle === 'passive') {
    return 'The player waits and observes.'
  }

  return `The player acts: ${choice.label}`
}

function buildSceneOpeningPrompt(state: CampaignState, event: StoryEvent) {
  const node = getNode(state.currentNodeId)
  const sceneNpcs = state.storyNpcs.filter((npc) => npc.currentNodeId === state.currentNodeId || npc.introducedByEventId === event.id)

  return `${gameMasterNarratorFrame}

${buildWorldRulesBlock()}

${buildObjectivePressureBlock()}

${buildEstablishedFactsBlock(state)}

${buildWorldTopologyBlock(state)}

${buildVisitedSceneOpeningRule(state)}
${buildUnexploredExitSensesBlock(state)}

Story: ${storySchema.title}
Current place: ${node.publicName}
Place purpose: ${node.description}
Player character:
${formatPlayerSheet(state.player)}
Scene: ${event.name}
Scene pressure: ${event.prompt}
Scene NPCs:
${formatSceneNpcs(sceneNpcs)}
Recent visible story:
${formatRecentFeed(state.feed)}
Compact story memory:
${formatCodexContext(state)}

Write only visible story text. No JSON. No markdown heading.
Rules:
- Describe only externally available scene details: surroundings, NPC behavior, physical pressure, sensory facts, and immediate stakes.
- Format the passage as two or three short paragraphs separated by blank lines; avoid one dense wall of text.
- Make the situation concrete and leave room for the player to choose from the authored options.
- Do not write dialogue for the player character.
- Do not decide the player's action.
- ${playerAgencyRule}
- Do not invent inventory, victory, loss, map movement, or hidden discoveries.
- You may describe visible strain, wounds, fatigue, relief, composure, or other condition changes naturally, but never as HP, health points, bars, levels, numbers, or percentages.
- If an NPC speaks, write the NPC's actual name followed by a colon. Never write the literal label "Name:".
- For fragile or quiet delivery, prefix that line with "[weak]", "[small]", or "[whisper]".
- Do not reveal hidden routes, future places, or event tables.
- ${groundedMedievalRule}
- ${originalStoryRule}`
}

function buildPlayerActionResolutionPrompt(state: CampaignState, event: StoryEvent, choice: StoryChoice, effects: StoryEffect[]) {
  const node = getNode(state.currentNodeId)

  return `${gameMasterNarratorFrame}

${buildWorldRulesBlock()}

${buildObjectivePressureBlock()}

${buildEstablishedFactsBlock(state)}

${buildWorldTopologyBlock(state)}

${buildUnexploredExitSensesBlock(state)}

Resolve the player's chosen action as original interactive fiction.

Current place: ${node.publicName}
Current scene: ${event.name}
Scene pressure: ${event.prompt}
Player character:
${formatPlayerSheet(state.player)}
Game Master direction from contributor-only choice fields:
Selected choice framing: ${getSelectedChoicePromptPrefix(choice)}
Writer intent: ${choice.writerIntent}
Neutral summary: ${choice.neutralSummary}
Action prompt: ${choice.actionPrompt}
Player-facing mode: ${choice.mode}
Player-facing skill color: ${choice.skillTags.join(', ') || 'none'}
Hard state effects handled by code:
${effects.length > 0 ? effects.map(describeEffect).join('\n') : 'No mechanical state change.'}
Recent visible story:
${formatRecentFeed(state.feed)}
Compact story memory:
${formatCodexContext(state)}

Write visible prose only. No JSON. No markdown heading.
Rules:
- Resolve only the selected option.
- Format the passage as two or three short paragraphs separated by blank lines; avoid one dense wall of text.
- Do not add unselected motives, regrets, memories, emotions, thoughts, or private conclusions for the player character.
- Do not write exact dialogue for the player character unless the selected option itself contains exact quoted words.
- If the selected option is conversational, summarize the communicated intent without inventing a full spoken line.
- ${playerAgencyRule}
- Do not invent additional inventory, map, victory, or loss changes beyond the hard effects listed above.
- You may reflect visible consequences to the player character’s condition in prose, without HP, bars, levels, numbers, or percentages.
- If someone speaks, use their actual name followed by a colon. Never write the literal label "Name:".
- ${groundedMedievalRule}
- ${originalStoryRule}`
}

function buildNpcResponsePrompt(state: CampaignState, event: StoryEvent, npc: StoryNpc, choice: StoryChoice, resolutionText: string) {
  const node = getNode(state.currentNodeId)

  return `${gameMasterNarratorFrame}

${buildWorldRulesBlock()}

${buildObjectivePressureBlock()}

${buildEstablishedFactsBlock(state)}

${buildWorldTopologyBlock(state)}

Write one visible NPC response in an original interactive fiction scene.

NPC: ${npc.name} (${npc.role})
Description: ${npc.description}
Voice: ${npc.voice}
Want: ${npc.want}
Knows: ${npc.knows}
Current place: ${node.publicName}
Scene: ${event.name} — ${event.prompt}
Game Master direction from contributor-only choice fields:
Selected choice framing: ${getSelectedChoicePromptPrefix(choice)}
Writer intent: ${choice.writerIntent}
Neutral summary: ${choice.neutralSummary}
Action prompt: ${choice.actionPrompt}
Resolution so far:
${resolutionText}
Compact story memory:
${formatCodexContext(state)}

Write only ${npc.name}'s visible response. No JSON. No markdown heading.
Rules:
- Use ${npc.name}'s actual name followed by a colon. Never write the literal label "Name:".
- Keep this response readable: one short paragraph, or two short paragraphs if action and speech both matter.
- React to the selected option and the NPC's own want.
- Do not invent exact dialogue, private thoughts, motives, or additional actions for the player character.
- If the selected option was conversational, respond to its stated intent without adding new words the player character did not choose.
- ${playerAgencyRule}
- Do not invent inventory, map, victory, or loss changes.
- You may reflect visible consequences to the player character’s condition in prose, without HP, bars, levels, numbers, or percentages.
- ${groundedMedievalRule}
- ${originalStoryRule}`
}

function buildPlayerConditionUpdatePrompt(state: CampaignState, choice: StoryChoice, resolutionText: string, npcText?: string) {
  return `You maintain the player character's visible condition as prose, not numbers.

Player: ${state.player.name}
Previous condition: ${state.player.condition}

Selected choice:
${choice.neutralSummary}

Visible result:
${resolutionText}

NPC response:
${npcText || 'None.'}

Write one concise player-facing condition sentence for ${state.player.name}.
Rules:
- Output only the condition sentence.
- No HP, health points, hit points, bars, levels, percentages, or numeric status.
- Describe only visible physical, social, or emotional condition.
- Do not declare death or defeat unless the visible story clearly establishes it.`
}

function StoryIcon({ id, label, className = '' }: { id: StoryIconId; label: string; className?: string }) {
  return (
    <span className={`inline-flex size-8 shrink-0 items-center justify-center border border-[var(--color-border)] bg-foreground ${className}`} aria-hidden="true">
      <img src={storyIconAssets[id]} alt="" className="size-4 object-contain invert" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

function getVisualNovelLineStyle(line: string) {
  const markerMatch = line.match(/^\[(weak|small|whisper)\]\s*/i)
  const marker = markerMatch?.[1]?.toLowerCase()
  const text = markerMatch ? line.replace(/^\[(weak|small|whisper)\]\s*/i, '') : line

  if (marker === 'weak' || marker === 'small') {
    return { text, className: 'italic tracking-wide text-foreground/80' }
  }

  if (marker === 'whisper') {
    return { text, className: 'italic text-foreground/75' }
  }

  return { text, className: '' }
}

function renderCodexText(text: string, references: CodexReference[], options: { canonicalFacts?: CampaignState['canonicalFacts'] } = {}) {
  if (references.length === 0 || text.length === 0) {
    return text
  }

  const matcher = new RegExp(`(${references.map((reference) => escapeRegExp(reference.term)).join('|')})`, 'gi')
  const parts = text.split(matcher)

  return parts.map((part, index) => {
    const reference = references.find((candidate) => candidate.term.toLowerCase() === part.toLowerCase())

    if (!reference) {
      return part
    }

    const canonicalFact = options.canonicalFacts ? getCanonicalFactForReference(options.canonicalFacts, reference) : undefined

    return (
      <Tooltip key={`${part}-${index}`}>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="codex-term inline cursor-help align-baseline focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-accent)]" aria-label={`${part}: ${getCodexReferenceSummary(reference, options.canonicalFacts)}`}>
            {part}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="max-w-xs">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{reference.term}</span>
              {canonicalFact ? <Badge variant="secondary" className="px-1.5 py-0 text-[0.6rem]">Confirmed</Badge> : null}
            </div>
            <p>{getCodexReferenceSummary(reference, options.canonicalFacts)}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    )
  })
}

function normalizeSpeakerLabel(label: string | undefined, fallback: string | undefined) {
  if (!label) {
    return fallback
  }

  return label.trim().toLowerCase() === 'name' ? fallback : label
}

function StoryTranscript({
  state,
  onRetry,
}: {
  state: CampaignState
  onRetry?: () => void
}) {
  const references = getCodexReferences(state)

  return (
    <div className="iff-transcript border-0 p-0 shadow-none">
      <div className="font-serif text-base leading-8 tracking-normal text-foreground">
        {state.feed.map((entry) => (
          <div key={entry.id}>
            <FeedBlock entry={entry} references={references} canonicalFacts={state.canonicalFacts} onRetry={onRetry} />
          </div>
        ))}
      </div>
    </div>
  )
}

function FeedBlock({
  entry,
  references,
  canonicalFacts,
  onRetry,
}: {
  entry: FeedEntry
  references: CodexReference[]
  canonicalFacts: CampaignState['canonicalFacts']
  onRetry?: () => void
}) {
  if (entry.kind === 'location') {
    return (
      <section className="mb-4 mt-5 border-t border-[var(--color-border)] pt-3 first:mt-0 last:mb-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-[var(--color-text-muted)]">
          <p className="font-serif text-[0.72rem] font-normal uppercase tracking-[0.22em]">{entry.content?.name ?? entry.text}</p>
          <p className="font-serif text-[0.68rem] italic tracking-wide text-[var(--color-text-dim)]">{entry.content?.nodeType ? getNodeTypeLabel(entry.content.nodeType) : 'Place'}</p>
        </div>
      </section>
    )
  }

  const lines = getFeedDisplayLines(entry)

  if (lines.length === 0 && !entry.streaming) {
    return null
  }

  const renderedLines = lines.length > 0 ? lines : [entry.streaming ? 'The next passage is taking shape…' : 'Continue to reveal the next line.']
  const blockClassName = entry.kind === 'dialogue'
    ? 'border-l border-[var(--color-border)] bg-muted/60 px-4 py-3'
    : entry.kind === 'selected'
      ? 'font-sans text-sm font-normal leading-6 text-muted-foreground'
      : entry.kind === 'error'
        ? 'border border-destructive bg-background px-4 py-3 text-destructive'
        : ''

  return (
    <section className="mb-8 w-full last:mb-0">
      {entry.kind === 'system' ? (
        <div className="mb-4 mt-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--color-border)]" />
          <span className="shrink-0 whitespace-nowrap text-[9px] uppercase tracking-[0.25em] text-[var(--color-text-dim)]">{entry.text}</span>
          <span className="h-px flex-1 bg-[var(--color-border)]" />
        </div>
      ) : null}
      {entry.kind !== 'system' ? (
        <div className={blockClassName}>
            {renderedLines.map((line, index) => {
              const styledLine = getVisualNovelLineStyle(line)
              const speakerMatch = styledLine.text.match(/^([^:]{2,32}):\s*(.+)$/)
              const displayedSpeaker = normalizeSpeakerLabel(entry.kind === 'dialogue' ? speakerMatch?.[1] ?? entry.speaker : speakerMatch?.[1], entry.speaker)
              const displayedText = speakerMatch ? speakerMatch[2] : styledLine.text
              const shouldShowSpeaker = entry.kind === 'dialogue' && displayedSpeaker && displayedSpeaker !== 'Narrator'

              return shouldShowSpeaker ? (
                <p key={`${entry.id}-line-${index}`} className={`mb-4 whitespace-pre-wrap text-base leading-[1.85] last:mb-0 ${styledLine.className}`}>
                  <span className="mr-2 font-sans text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{displayedSpeaker}</span>
                  <span>
                    {renderCodexText(displayedText, references, { canonicalFacts })}
                  </span>
                </p>
              ) : (
                <p key={`${entry.id}-line-${index}`} className={`mb-4 whitespace-pre-wrap text-base leading-[1.85] last:mb-0 ${entry.kind === 'selected' ? 'font-sans text-sm leading-6 text-muted-foreground' : ''} ${styledLine.className}`}>
                  <span>{renderCodexText(displayedText, references, { canonicalFacts })}</span>
                </p>
              )
            })}
            {entry.consequenceBadges && entry.consequenceBadges.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.consequenceBadges.map((badge) => <Badge key={badge} variant="secondary">{badge}</Badge>)}
              </div>
            ) : null}
            {entry.kind === 'error' && onRetry ? (
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>Retry</Button>
            ) : null}
        </div>
      ) : null}
    </section>
  )
}

type MapRenderNode = {
  id: string
  label: string
  description: string
  nodeType: StoryNodeType
  position: [number, number, number]
  explored: boolean
  current: boolean
  selected: boolean
  travelDisabledReason?: string
}

type MapRenderEdge = {
  id: string
  from: [number, number, number]
  to: [number, number, number]
  hidden: boolean
  blocked: boolean
}

type MapTravelAnimation = {
  id: string
  fromNodeId: string
  toNodeId: string
}

type MapControlsLike = {
  target: {
    x: number
    y: number
    z: number
    set: (x: number, y: number, z: number) => void
  }
  update: () => void
}

function normalizeMapPosition(node: StoryNode): [number, number, number] {
  const position = getNodePosition(node)

  return [(position.x - 300) / 38, 0, (300 - position.y) / 38]
}

function getMapRenderModel(state: CampaignState, selectedNodeId?: string) {
  const explored = new Set(state.exploredNodeIds)
  const adjacentTargets = getAdjacentTravelTargets(state)
  const visibleNodeIds = new Set([...state.exploredNodeIds, ...adjacentTargets.map((target) => target.node.id)])
  const selectedVisibleNodeId = selectedNodeId && visibleNodeIds.has(selectedNodeId) ? selectedNodeId : undefined
  const visibleNodes = storySchema.nodes.filter((node) => visibleNodeIds.has(node.id))
  const nodes: MapRenderNode[] = visibleNodes.map((node) => {
    const isExplored = explored.has(node.id)
    const isCurrent = node.id === state.currentNodeId
    const travelDisabledReason = getTravelDisabledReason(state, node.id)
    const routeToNode = adjacentTargets.find((target) => target.node.id === node.id)?.exit
    const explorationHint = routeToNode ? getExplorationHintForExit(routeToNode) : node.explorationHint

    return {
      id: node.id,
      label: isExplored || isCurrent ? node.publicName : 'Unexplored route',
      description: isExplored || isCurrent ? node.description : explorationHint ?? 'The route ahead is still uncertain.',
      nodeType: node.nodeType,
      position: normalizeMapPosition(node),
      explored: isExplored,
      current: isCurrent,
      selected: node.id === selectedVisibleNodeId,
      travelDisabledReason,
    }
  })
  const edgeKeys = new Set<string>()
  const edges: MapRenderEdge[] = []
  const addEdge = (fromNode: StoryNode, exit: StoryExit) => {
    const toNode = getNode(exit.toNodeId)

    if (!visibleNodeIds.has(fromNode.id) || !visibleNodeIds.has(toNode.id)) {
      return
    }

    const hidden = !explored.has(fromNode.id) || !explored.has(toNode.id)
    const key = [fromNode.id, toNode.id].sort().join('--')

    if (edgeKeys.has(key)) {
      return
    }

    edgeKeys.add(key)
    edges.push({
      id: `${fromNode.id}-${toNode.id}`,
      from: normalizeMapPosition(fromNode),
      to: normalizeMapPosition(toNode),
      hidden,
      blocked: Boolean(getTravelBlockerReason(state, exit)),
    })
  }

  storySchema.nodes.filter((node) => explored.has(node.id)).forEach((node) => {
    getNodeExits(node).forEach((exit) => {
      if (explored.has(exit.toNodeId)) {
        addEdge(node, exit)
      }
    })
  })
  adjacentTargets.forEach((target) => addEdge(getNode(state.currentNodeId), target.exit))

  return { nodes, edges, selectedVisibleNodeId }
}

function ThreeMapEdge({ edge }: { edge: MapRenderEdge }) {
  return (
    <Line
      points={[edge.from, edge.to]}
      color="#9E8B6B"
      lineWidth={edge.blocked ? 2.2 : 1.55}
      dashed={edge.hidden}
      dashScale={18}
      dashSize={0.45}
      gapSize={0.28}
      depthWrite={false}
    />
  )
}

function ThreeMapNode({
  node,
  onSelectNode,
}: {
  node: MapRenderNode
  onSelectNode: (nodeId: string) => void
}) {
  const color = node.explored || node.current ? '#EDE9E0' : '#5A4F3A'

  return (
    <group position={node.position} onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelectNode(node.id) }}>
      {node.current ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.54, 0.07, 12, 40]} />
          <meshBasicMaterial color="#9E8B6B" />
        </mesh>
      ) : null}
      {node.selected ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.72, 0.025, 12, 40]} />
          <meshBasicMaterial color="#EDE9E0" />
        </mesh>
      ) : null}
      <SphereGeometryNode color={color} />
      {!node.selected ? (
        <Html position={[0, 0.86, 0]} center style={{ pointerEvents: 'none', width: 'max-content' }}>
          <span className={`block whitespace-nowrap border bg-background px-2 py-1 font-sans text-[0.6rem] font-semibold uppercase tracking-[0.14em] ${node.explored || node.current ? 'border-[var(--color-border)] text-foreground' : 'border-muted-foreground text-muted-foreground'}`}>
            {node.label}
          </span>
        </Html>
      ) : null}
    </group>
  )
}

function SphereGeometryNode({ color }: { color: string }) {
  return (
    <mesh>
      <sphereGeometry args={[0.34, 24, 16]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

function MapPerspectiveCamera() {
  const size = useThree((state) => state.size)
  const aspect = size.width / Math.max(size.height, 1)

  return (
    <PerspectiveCamera
      makeDefault
      position={[0, 12, 0]}
      rotation={[-Math.PI / 2, 0, Math.PI]}
      fov={30}
      aspect={aspect}
      near={0.1}
      far={60}
      onUpdate={(camera) => {
        camera.aspect = aspect
        camera.updateProjectionMatrix()
      }}
    />
  )
}

function getMapFocusPosition(model: ReturnType<typeof getMapRenderModel>, travelAnimation?: MapTravelAnimation) {
  const travellingToNode = travelAnimation ? model.nodes.find((node) => node.id === travelAnimation.toNodeId) : undefined
  const selectedNode = model.nodes.find((node) => node.id === model.selectedVisibleNodeId)
  const currentNode = model.nodes.find((node) => node.current)
  const focusNode = travellingToNode ?? selectedNode ?? currentNode ?? model.nodes[0]

  return focusNode?.position ?? ([0, 0, 0] as [number, number, number])
}

function lerpNumber(from: number, to: number, progress: number) {
  return from + (to - from) * progress
}

function getTravelProgress(elapsed: number, duration: number) {
  const linearProgress = Math.min(Math.max(elapsed / duration, 0), 1)

  return linearProgress < 0.5
    ? 2 * linearProgress * linearProgress
    : 1 - Math.pow(-2 * linearProgress + 2, 2) / 2
}

function MapTravelPawn({
  model,
  travelAnimation,
  onComplete,
}: {
  model: ReturnType<typeof getMapRenderModel>
  travelAnimation?: MapTravelAnimation
  onComplete: () => void
}) {
  const startTimeRef = useRef(0)
  const animationIdRef = useRef<string | undefined>(undefined)
  const completedRef = useRef(false)
  const positionRef = useRef<[number, number, number]>(getMapFocusPosition(model, travelAnimation))
  const pawnRef = useRef<Group>(null)
  const duration = 1.9

  const fromNode = travelAnimation ? model.nodes.find((node) => node.id === travelAnimation.fromNodeId) : undefined
  const toNode = travelAnimation ? model.nodes.find((node) => node.id === travelAnimation.toNodeId) : undefined
  const currentNode = model.nodes.find((node) => node.current)

  useFrame((state) => {
    if (!travelAnimation || !fromNode || !toNode) {
      positionRef.current = currentNode?.position ?? positionRef.current
      pawnRef.current?.position.set(positionRef.current[0], positionRef.current[1] + 0.34, positionRef.current[2])
      return
    }

    if (animationIdRef.current !== travelAnimation.id) {
      animationIdRef.current = travelAnimation.id
      startTimeRef.current = state.clock.elapsedTime
      completedRef.current = false
    }

    const progress = getTravelProgress(state.clock.elapsedTime - startTimeRef.current, duration)
    positionRef.current = [
      lerpNumber(fromNode.position[0], toNode.position[0], progress),
      0,
      lerpNumber(fromNode.position[2], toNode.position[2], progress),
    ]
    pawnRef.current?.position.set(positionRef.current[0], positionRef.current[1] + 0.34, positionRef.current[2])

    if (progress >= 1 && !completedRef.current) {
      completedRef.current = true
      window.setTimeout(onComplete, 0)
    }
  })

  const [x, y, z] = travelAnimation && fromNode && toNode ? positionRef.current : currentNode?.position ?? positionRef.current

  return (
    <group ref={pawnRef} position={[x, y + 0.34, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.42, 28]} />
        <meshBasicMaterial color="#E0B66A" transparent opacity={0.36} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <sphereGeometry args={[0.18, 20, 12]} />
        <meshBasicMaterial color="#F4D78A" />
      </mesh>
    </group>
  )
}

function MapCameraRig({
  model,
  travelAnimation,
}: {
  model: ReturnType<typeof getMapRenderModel>
  travelAnimation?: MapTravelAnimation
}) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as unknown as MapControlsLike | undefined
  const startTimeRef = useRef(0)
  const animationIdRef = useRef<string | undefined>(undefined)
  const focusKeyRef = useRef<string | undefined>(undefined)
  const focusUntilRef = useRef(0)
  const focusRef = useRef<[number, number, number]>(getMapFocusPosition(model, travelAnimation))
  const duration = 1.9

  useFrame((state, delta) => {
    const currentNodeId = model.nodes.find((node) => node.current)?.id
    const focusKey = travelAnimation?.id ?? model.selectedVisibleNodeId ?? currentNodeId ?? 'origin'
    let focus = getMapFocusPosition(model, travelAnimation)
    let shouldGuideCamera = Boolean(travelAnimation)

    if (focusKeyRef.current !== focusKey) {
      focusKeyRef.current = focusKey
      focusUntilRef.current = state.clock.elapsedTime + 0.9
    }

    if (travelAnimation) {
      const fromNode = model.nodes.find((node) => node.id === travelAnimation.fromNodeId)
      const toNode = model.nodes.find((node) => node.id === travelAnimation.toNodeId)

      if (fromNode && toNode) {
        if (animationIdRef.current !== travelAnimation.id) {
          animationIdRef.current = travelAnimation.id
          startTimeRef.current = state.clock.elapsedTime
        }

        const progress = getTravelProgress(state.clock.elapsedTime - startTimeRef.current, duration)
        focus = [
          lerpNumber(fromNode.position[0], toNode.position[0], progress),
          0,
          lerpNumber(fromNode.position[2], toNode.position[2], progress),
        ]
      }
    }

    if (!shouldGuideCamera) {
      shouldGuideCamera = state.clock.elapsedTime < focusUntilRef.current
    }

    if (!shouldGuideCamera) {
      focusRef.current = [controls?.target.x ?? focusRef.current[0], 0, controls?.target.z ?? focusRef.current[2]]
      return
    }

    const ease = 1 - Math.pow(0.001, delta)
    focusRef.current = [
      lerpNumber(focusRef.current[0], focus[0], ease),
      0,
      lerpNumber(focusRef.current[2], focus[2], ease),
    ]

    camera.position.set(focusRef.current[0], camera.position.y, focusRef.current[2])
    camera.lookAt(focusRef.current[0], 0, focusRef.current[2])
    controls?.target.set(focusRef.current[0], 0, focusRef.current[2])
    controls?.update()
  })

  return null
}

function ThreeMapScene({
  model,
  onSelectNode,
  travelAnimation,
  onTravelAnimationComplete,
}: {
  model: ReturnType<typeof getMapRenderModel>
  onSelectNode: (nodeId?: string) => void
  travelAnimation?: MapTravelAnimation
  onTravelAnimationComplete: () => void
}) {
  return (
    <>
      <MapPerspectiveCamera />
      <MapCameraRig model={model} travelAnimation={travelAnimation} />
      <group>
        {model.edges.map((edge) => <ThreeMapEdge key={edge.id} edge={edge} />)}
        {model.nodes.map((node) => <ThreeMapNode key={node.id} node={node} onSelectNode={onSelectNode} />)}
      </group>
      <MapTravelPawn model={model} travelAnimation={travelAnimation} onComplete={onTravelAnimationComplete} />
      <OrbitControls makeDefault target={[0, 0, 0]} enableRotate={false} enablePan enableZoom screenSpacePanning minDistance={6} maxDistance={18} zoomSpeed={0.75} panSpeed={0.7} />
    </>
  )
}

function MapNodeTypeBadge({ nodeType }: { nodeType: StoryNodeType }) {
  return (
    <Badge variant="outline">
      {getNodeTypeLabel(nodeType)}
    </Badge>
  )
}

function MapGraphView({
  state,
  selectedNodeId,
  onSelectNode,
  travelLocked,
  onTravelNode,
  travelAnimation,
  onTravelAnimationComplete,
  compact = false,
}: {
  state: CampaignState
  selectedNodeId?: string
  onSelectNode: (nodeId?: string) => void
  travelLocked: boolean
  onTravelNode: (nodeId: string) => void
  travelAnimation?: MapTravelAnimation
  onTravelAnimationComplete: () => void
  compact?: boolean
}) {
  const model = getMapRenderModel(state, selectedNodeId)

  return (
    <Card className="iff-chrome-panel min-h-0 flex-1 overflow-hidden py-0 lg:h-full">
      <CardContent className="min-h-0 flex-1 p-0">
        <h2 className="sr-only">Route atlas</h2>
        <p className="sr-only">Trace known roads and select a marked place for its details.</p>
        <div className={`relative overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] ${compact ? 'h-80 min-h-80' : 'h-[min(72svh,760px)] min-h-[420px] lg:h-full'}`} aria-label="Interactive route atlas">
          <Canvas dpr={[1.5, 2.5]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ position: [0, 12, 0], fov: 30, near: 0.1, far: 60 }} onPointerMissed={() => { if (!travelAnimation) onSelectNode(undefined) }}>
            <color attach="background" args={['#0F0F0D']} />
            <ThreeMapScene model={model} onSelectNode={(nodeId) => { if (!travelAnimation) onSelectNode(nodeId) }} travelAnimation={travelAnimation} onTravelAnimationComplete={onTravelAnimationComplete} />
          </Canvas>
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 w-[min(22rem,calc(100%-1.5rem))]">
            <MapLocationDetails state={state} selectedNodeId={selectedNodeId} travelLocked={travelLocked} onTravelNode={onTravelNode} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MapLocationDetails({
  state,
  selectedNodeId,
  travelLocked,
  onTravelNode,
}: {
  state: CampaignState
  selectedNodeId?: string
  travelLocked: boolean
  onTravelNode: (nodeId: string) => void
}) {
  const model = getMapRenderModel(state, selectedNodeId)
  const selectedNode = model.nodes.find((node) => node.id === model.selectedVisibleNodeId)

  if (!selectedNode) {
    return (
      <Card className="iff-chrome-panel pointer-events-auto bg-background/95 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="ui-label">Map location</p>
          <p className="mt-2 font-serif text-sm leading-6 text-muted-foreground">Select a marked place on the map to inspect it here.</p>
        </CardContent>
      </Card>
    )
  }

  const disabledReasonId = `${selectedNode.id}-map-overlay-travel-reason`

  return (
    <Card className="iff-chrome-panel pointer-events-auto bg-background/95 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="ui-label">Map location</p>
            <CardTitle className="mt-1 font-[var(--font-display)] text-2xl font-light leading-tight">{selectedNode.label}</CardTitle>
          </div>
          {selectedNode.explored || selectedNode.current ? <MapNodeTypeBadge nodeType={selectedNode.nodeType} /> : null}
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          {selectedNode.current ? <Badge variant="secondary">current location</Badge> : null}
          {!selectedNode.explored ? <Badge variant="secondary">unexplored</Badge> : null}
        </div>
        <p className="font-serif text-sm leading-6 text-muted-foreground">{selectedNode.description}</p>
        <span title={selectedNode.travelDisabledReason} className="block w-full">
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={travelLocked || Boolean(selectedNode.travelDisabledReason)}
            aria-describedby={selectedNode.travelDisabledReason ? disabledReasonId : undefined}
            onClick={() => onTravelNode(selectedNode.id)}
          >
            {travelLocked ? 'Travelling…' : 'Travel'}
          </Button>
        </span>
        {selectedNode.travelDisabledReason ? <span id={disabledReasonId} className="sr-only">{selectedNode.travelDisabledReason}</span> : null}
      </CardContent>
    </Card>
  )
}

function ChoicePanel({
  state,
  isAdvancing,
  confirmingChoiceId,
  onCancelConfirm,
  onBeginScene,
  onChoose,
}: {
  state: CampaignState
  isAdvancing: boolean
  confirmingChoiceId?: string
  onCancelConfirm: () => void
  onBeginScene: () => void
  onChoose: (choice: StoryChoice) => void
}) {
  if (state.outcome !== 'running') {
    return null
  }

  if (!state.sceneOpened || !state.currentEvent) {
    return (
      <Card className="iff-chrome-panel">
        <CardContent>
          <Button type="button" size="lg" onClick={onBeginScene} disabled={isAdvancing} className="w-full font-serif text-base">
            <PlayIcon data-icon="inline-start" />
            {isAdvancing ? 'Preparing the scene…' : 'Begin'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isAdvancing) {
    return (
      <Card className="iff-chrome-panel">
        <CardContent>
          <p className="font-serif text-sm text-muted-foreground">Waiting for narrator…</p>
        </CardContent>
      </Card>
    )
  }

  const choices = getAvailableChoices(state)
  const currentEvent = state.currentEvent
  const currentHint = getCurrentObjective(state)
  const shouldShowCurrentHint = currentHint.trim() && currentHint !== storySchema.objective.summary

  return (
    <Card className="iff-chrome-panel">
      <CardHeader className="pb-3">
        <CardTitle className="font-[var(--font-display)] text-3xl font-light">What will {state.player.name} do next?</CardTitle>
        <CardDescription className="font-serif">{currentEvent?.prompt}</CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="flex flex-col gap-2">
        {shouldShowCurrentHint ? (
          <div className="mb-2 border-l border-[var(--color-border-strong)] bg-background py-2 pl-3">
            <p className="font-serif text-sm italic leading-6 text-muted-foreground">{currentHint}</p>
          </div>
        ) : null}
        {choices.length > 4 ? <p className="font-sans text-xs text-muted-foreground">({choices.length} options)</p> : null}
        {choices.map((choice) => {
          const disabledReason = getChoiceDisabledReason(state, choice)
          const disabled = Boolean(disabledReason) || isAdvancing
          const needsConfirm = choiceNeedsConfirmation(choice)
          const confirming = confirmingChoiceId === choice.id
          const disabledId = `${choice.id}-disabled-reason`
          const describedBy = disabledReason ? disabledId : undefined
          const modeColor = getStoryChoiceModeColor(choice.mode)
          const isAction = choice.displayStyle === 'action'
          const isDialogue = choice.displayStyle === 'dialogue'
          const isPassive = choice.displayStyle === 'passive'

          return (
            <button key={choice.id} type="button" disabled={disabled} title={disabledReason ?? choice.label} aria-describedby={describedBy} className={`iff-choice-card relative w-full cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-4 pr-4 text-left transition-all duration-150 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-55 ${isDialogue ? 'pl-7' : ''} ${isPassive ? 'py-2.5' : ''} ${confirming ? 'bg-[var(--color-accent-dim)] ring-1 ring-[var(--color-accent)]' : ''}`} onClick={() => onChoose(choice)}>
              <span className="absolute bottom-0 left-0 top-0 w-[3px]" style={{ backgroundColor: modeColor }} />
              <span className="block">
                <span className={`mb-1.5 inline-flex items-center gap-1.5 border border-current px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest opacity-60 ${isPassive ? 'opacity-40' : ''}`} style={{ color: modeColor }}>
                  <StoryChoiceModeIcon mode={choice.mode} />
                  {getStoryChoiceModeBadge(choice.mode)}
                </span>
                <span className={`mb-1 block leading-snug ${isAction ? 'text-sm font-bold text-[var(--color-text)]' : ''} ${isDialogue ? 'text-sm italic text-[var(--color-text)]' : ''} ${isPassive ? 'text-xs text-[var(--color-text-muted)]' : ''}`}>
                  <span>
                    {isDialogue ? <span aria-hidden="true">“</span> : null}
                    {confirming ? `Confirm: ${choice.label}` : choice.label}
                  </span>
                </span>
                {!isPassive && choice.skillTags.length > 0 ? (
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {choice.skillTags.map((skill) => (
                      <span key={skill} className="inline-flex items-center gap-1.5 border border-[var(--color-border-subtle)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                        <span className="opacity-60">Skill:</span>
                        <span>{skillTagDefinitions[skill].label}</span>
                      </span>
                    ))}
                  </span>
                ) : null}
                {disabledReason ? <span id={disabledId} className="mt-2 block text-xs font-medium text-[var(--color-text-muted)]">{disabledReason}</span> : null}
                {needsConfirm && confirming ? (
                  <span className="mt-2 block text-xs text-[var(--color-text-muted)]">
                    This choice has lasting consequences. <button type="button" className="underline underline-offset-2" onClick={(event) => { event.stopPropagation(); onCancelConfirm() }}>Cancel</button>
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
        {isAdvancing ? <p className="font-sans text-xs text-muted-foreground">Waiting for narrator…</p> : null}
      </CardContent>
    </Card>
  )
}

function InventoryItemCard({
  item,
  selected,
  onSelect,
}: {
  item: InventoryItem
  selected: boolean
  onSelect: (itemId: string) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(item.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(item.id)
        }
      }}
      className="group flex w-full flex-col gap-3 border border-[var(--color-border)] bg-background p-3 text-left transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground aria-pressed:bg-muted sm:flex-row sm:items-start"
    >
      <StoryIcon id={item.iconAssetId ?? 'codex'} label={item.name} className="size-11 shrink-0 self-start" />
      <span className="block min-w-0 flex-1">
        <span className="block break-words text-base font-semibold leading-5 text-foreground sm:truncate">{item.name}</span>
        <span className="mt-1 block break-words font-serif text-sm leading-6 text-muted-foreground sm:truncate">{item.description}</span>
        {item.consumable ? (
          <span className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex border border-[var(--color-border-strong)] px-1.5 py-0.5 font-sans text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">Consumable</span>
          </span>
        ) : null}
      </span>
    </div>
  )
}

function CharacterPanel({
  state,
  selectedItemId,
  onSelectItem,
}: {
  state: CampaignState
  selectedItemId?: string
  onSelectItem: (itemId: string) => void
}) {
  const visibleInventory = state.player.inventory.filter((item) => item.visible)
  const selectedItem = visibleInventory.find((item) => item.id === selectedItemId) ?? visibleInventory[0]

  return (
    <Card className="iff-chrome-panel min-h-0 flex-1 lg:h-full">
      <CardHeader className="shrink-0">
        <CardTitle className="text-2xl">Character</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea className="h-[min(70svh,560px)] min-h-0 lg:h-full">
          <section className="flex min-h-0 flex-col gap-5 border border-[var(--color-border)] bg-background p-4 sm:p-5 lg:min-h-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span className="inline-flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden border border-[var(--color-border)] bg-background sm:h-24 sm:w-[4.5rem]">
              <img src={state.player.portraitAsset} alt="" className="h-full w-full object-cover" />
            </span>
            <div className="min-w-0">
              <h4 className="text-xl font-semibold">{state.player.name}</h4>
              <p className="text-sm text-muted-foreground">{state.player.role}</p>
              <div className="mt-3 border-l border-[var(--color-border)] pl-3">
                <p className="ui-label">Condition</p>
                <p className="mt-1 font-serif text-sm leading-6 text-muted-foreground">{state.player.condition}</p>
              </div>
            </div>
          </div>

          <div className="font-serif text-sm leading-relaxed text-muted-foreground">
            <p>{state.player.backstory.origin}</p>
            <p className="mt-1.5">{state.player.backstory.wound}</p>
            <p className="mt-1.5">{state.player.backstory.want}</p>
          </div>

          <section className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="ui-label">Current Objective</p>
            <h4 className="mt-1 font-[var(--font-display)] text-2xl font-light leading-tight">{storySchema.title}</h4>
            <p className="mt-3 font-serif text-sm leading-6 text-foreground">{storySchema.objective.summary}</p>
          </section>

          <div>
            <h5 className="text-sm font-medium">Strengths</h5>
            <div className="mt-2 flex flex-wrap gap-2">
              {state.player.skillTags.map((skill) => {
                const definition = skillTagDefinitions[skill]

                return (
                  <Badge key={skill} variant="outline" title={definition?.summary ?? skill}>
                    {definition?.label ?? skill}
                  </Badge>
                )
              })}
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xl font-semibold">Inventory</h4>
              <span className="font-sans text-xs text-muted-foreground">{visibleInventory.length} carried</span>
            </div>
            {visibleInventory.length > 0 ? (
              <ScrollArea className="mt-3 h-auto max-h-none border border-[var(--color-border)] bg-[var(--color-surface)] sm:h-72">
                <div className="flex flex-col gap-2 p-2 pr-3">
                {visibleInventory.map((item) => (
                  <InventoryItemCard key={item.id} item={item} selected={selectedItem?.id === item.id} onSelect={onSelectItem} />
                ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="mt-3 font-serif text-sm leading-6 text-muted-foreground">Tamsin is carrying no visible keepsakes right now.</p>
            )}
          </div>
          </section>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function DebugPanel({ entries }: { entries: DebugEntry[] }) {
  return (
    <Card className="iff-chrome-panel">
      <CardHeader>
        <CardTitle>Diagnostics</CardTitle>
        <CardDescription className="font-serif">Advanced session details for troubleshooting.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72">
          <div className="flex flex-col gap-3 pr-3">
            {entries.length === 0 ? <p className="font-serif text-sm text-muted-foreground">No diagnostic entries yet.</p> : null}
            {entries.map((entry) => (
              <article key={entry.id} className="border border-[var(--color-border)] bg-muted p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Badge variant="outline">{entry.label ?? 'Trace'}</Badge>
                </div>
                <p className="whitespace-pre-wrap font-serif text-sm leading-6 text-muted-foreground">
                  {entry.text}
                </p>
              </article>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function StorySelectionScreen({ onSelect }: { onSelect: () => void }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 text-foreground">
      <Card className="iff-chrome-panel max-w-2xl">
        <CardHeader>
          <p className="ui-label">Choose a story</p>
          <CardTitle className="font-[var(--font-display)] text-4xl font-light">{storySchema.title}</CardTitle>
          <CardDescription className="font-serif text-base leading-7">{storySchema.premise}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="border border-[var(--color-border)] bg-background p-4">
            <p className="ui-label">Protagonist</p>
            <p className="mt-2 font-serif text-lg">{storySchema.player.name}, {storySchema.player.role}</p>
          </div>
          <Button type="button" size="lg" onClick={onSelect}>
            Select
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

function ProtagonistIntroScreen({ onBegin }: { onBegin: () => void }) {
  const player = storySchema.player
  const visibleInventory = player.inventory.filter((item) => item.visible)

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 text-foreground">
      <Card className="iff-chrome-panel max-w-3xl">
        <CardHeader>
          <p className="ui-label">You are</p>
          <CardTitle className="font-[var(--font-display)] text-4xl font-light">{player.name}</CardTitle>
          <CardDescription className="font-serif text-base leading-7">{player.role}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
          <img src={player.portraitAsset} alt="" className="h-44 w-32 border border-[var(--color-border)] object-cover" />
          <div className="flex flex-col gap-4">
            <p className="font-serif text-base leading-relaxed text-muted-foreground">{player.backstory.origin} {player.backstory.wound}</p>
            <div className="flex flex-wrap gap-2">
              {visibleInventory.map((item) => <Badge key={item.id} variant="outline">{item.name}</Badge>)}
            </div>
            <Button type="button" size="lg" onClick={onBegin}>Begin</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

function EndScreen({ state }: { state: CampaignState }) {
  if (state.outcome === 'running') return null
  const won = state.outcome === 'won'
  const choices = state.feed.filter((entry) => entry.kind === 'selected')

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/95 p-4 text-foreground">
      <Card className="iff-chrome-panel max-h-[90svh] w-full max-w-3xl overflow-y-auto">
        <CardHeader>
          <p className="ui-label">{won ? 'Victory' : 'Defeat'}</p>
          <CardTitle className="font-[var(--font-display)] text-4xl font-light">{storySchema.title}</CardTitle>
          <CardDescription className="font-serif text-base leading-7">{won ? storySchema.victoryResolution : storySchema.defeatResolution}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <details className="border border-[var(--color-border)] bg-background p-4">
            <summary className="cursor-pointer font-sans text-sm font-semibold uppercase tracking-[0.14em]">Review your journey</summary>
            <div className="mt-3 flex flex-col gap-2">
              {choices.map((entry) => (
                <p key={entry.id} className="font-serif text-sm leading-6 text-muted-foreground">{entry.text}</p>
              ))}
              {choices.length === 0 ? <p className="font-serif text-sm text-muted-foreground">No choices recorded yet.</p> : null}
            </div>
          </details>
          <p className="font-serif text-sm leading-6 text-muted-foreground">Refresh the page to begin again.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function App() {
  const [campaign, setCampaign] = useState<CampaignState>(initialState)
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(defaultLlmSettings)
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [systemThemeMode, setSystemThemeMode] = useState<ResolvedThemeMode>(() => getSystemThemeMode())
  const [appPhase, setAppPhase] = useState<AppPhase>('story-select')
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('story')
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>()
  const [travelAnimation, setTravelAnimation] = useState<MapTravelAnimation>()
  const [isTravelAnimating, setIsTravelAnimating] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState(initialState.player.inventory[0]?.id)
  const [llmError, setLlmError] = useState<string | undefined>()
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>('checking')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [llmSetupHint, setLlmSetupHint] = useState<string>()
  const [testConnectionMessage, setTestConnectionMessage] = useState<string>()
  const [pendingRetry, setPendingRetry] = useState<(() => void) | undefined>()
  const [confirmingChoiceId, setConfirmingChoiceId] = useState<string>()
  const storyScrollRef = useRef<HTMLDivElement | null>(null)
  const currentNode = useMemo(() => getNode(campaign.currentNodeId), [campaign.currentNodeId])
  const currentLlmPreset = useMemo(() => getLlmPreset(llmSettings.presetId), [llmSettings.presetId])
  const effectiveLlmOptions = useMemo(() => getEffectiveLlmOptions(llmSettings), [llmSettings])
  const resolvedThemeMode = themeMode === 'system' ? systemThemeMode : themeMode
  const isStoryLocked = isAdvancing || isTravelAnimating

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedThemeMode
    document.documentElement.dataset.themePreference = themeMode
  }, [resolvedThemeMode, themeMode])

  useEffect(() => {
    if (themeMode !== 'system') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => setSystemThemeMode(mediaQuery.matches ? 'dark' : 'light')

    updateSystemTheme()
    mediaQuery.addEventListener('change', updateSystemTheme)

    return () => mediaQuery.removeEventListener('change', updateSystemTheme)
  }, [themeMode])

  useEffect(() => {
    document.title = `${storySchema.title} — IFF`
  }, [])

  useEffect(() => {
    let cancelled = false

    async function checkConnection() {
      setOllamaStatus('checking')
      try {
        const names = await fetchOllamaModelNames(llmSettings.endpoint)
        if (!cancelled) {
          setAvailableModels(names)
          setOllamaStatus('connected')
          if (names.length === 0) {
            setLlmSetupHint('Ollama is running, but no local models are installed. Try: ollama pull qwen3.6')
          } else if (!names.includes(llmSettings.model) && llmSettings.presetId !== 'custom') {
            const bestModel = getBestInstalledModel(names, llmSettings.presetId)
            const presetOptions = getLlmPreset(llmSettings.presetId).options
            setLlmSettings((settings) => ({ ...settings, model: bestModel, options: presetOptions }))
            setLlmSetupHint(`Auto-selected ${bestModel} from your installed Ollama models.`)
          } else if (!names.includes(llmSettings.model)) {
            setLlmSetupHint(`Custom model "${llmSettings.model}" is not installed. Choose an installed model or pull it with Ollama.`)
          } else {
            setLlmSetupHint(undefined)
          }
        }
      } catch {
        if (!cancelled) {
          setAvailableModels([])
          setOllamaStatus('unreachable')
          setLlmSetupHint(`Ollama is not reachable at ${normalizeOllamaBase(llmSettings.endpoint)}. Start Ollama or update the endpoint in advanced settings.`)
        }
      }
    }

    checkConnection()

    return () => {
      cancelled = true
    }
  }, [llmSettings.endpoint, llmSettings.model, llmSettings.presetId])

  const scrollStoryToEnd = (behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const resolvedBehavior = prefersReducedMotion ? 'auto' : behavior
        const innerScrollContainer = storyScrollRef.current
        const outerScrollContainer = document.scrollingElement ?? document.documentElement

        innerScrollContainer?.scrollTo({ top: innerScrollContainer.scrollHeight, behavior: resolvedBehavior })
        outerScrollContainer.scrollTo({ top: outerScrollContainer.scrollHeight, behavior: resolvedBehavior })
      })
    })
  }

  const appendFeedEntry = (entry: Omit<FeedEntry, 'id'>) => {
    const id = createId(entry.kind)
    setCampaign((state) => ({ ...state, feed: [...state.feed, { id, ...entry }] }))
    scrollStoryToEnd('smooth')
    return id
  }

  const updateFeedEntry = (id: string, updater: (entry: FeedEntry) => FeedEntry) => {
    setCampaign((state) => ({ ...state, feed: state.feed.map((entry) => (entry.id === id ? updater(entry) : entry)) }))
    scrollStoryToEnd('auto')
  }

  const streamFeedEntry = async (entryId: string, prompt: string) => {
    const appendGeneratedText = (text: string) => {
      updateFeedEntry(entryId, (entry) => {
        const generatedText = `${entry.generatedText ?? entry.text}${text}`
        return { ...entry, generatedText, text: generatedText }
      })
    }
    const fullText = await streamLocalText(llmSettings, prompt, async (chunk) => {
      appendGeneratedText(chunk)
    })

    return fullText
  }

  const appendDebugEntry = (entry: Omit<DebugEntry, 'id'>) => {
    const id = createId('debug')
    setCampaign((state) => ({ ...state, debugFeed: [...state.debugFeed, { id, ...entry }] }))
    return id
  }

  const appendDirectionLintWarning = (stateAtGeneration: CampaignState, text: string, label: string) => {
    const invalidDirections = getInvalidGeneratedDirections(stateAtGeneration, text)

    if (invalidDirections.length === 0) {
      return
    }

    const currentNode = getNode(stateAtGeneration.currentNodeId)
    const validExitDirections = Array.from(getValidExitDirectionWords(stateAtGeneration))
    appendDebugEntry({
      label: 'World topology warning',
      text: `${label} mentioned direction word(s) not present in exits from ${currentNode.publicName}: ${invalidDirections.join(', ')}. Valid direction words here: ${validExitDirections.join(', ') || 'none'}.`,
    })
  }

  const rememberLocationCanonicalFact = (node: StoryNode, narration: string) => {
    const firstSentence = node.canonicalDescription ?? getFirstSentence(narration)

    if (!firstSentence) {
      return
    }

    setCampaign((state) => ({
      ...state,
      canonicalFacts: setCanonicalFact(state.canonicalFacts, node.publicName, firstSentence),
    }))
  }

  const openSceneFromState = async (stateAtStart: CampaignState, leadingFeedEntries: Array<Omit<FeedEntry, 'id'>> = []) => {
    if (isAdvancing || stateAtStart.outcome !== 'running') {
      return
    }

    setIsAdvancing(true)
    setLlmError(undefined)

    let narratorEntryId: string | undefined

    try {
      await assertLocalModelAvailable(llmSettings)

      const event = stateAtStart.currentEvent ?? drawStoryEvent(stateAtStart)
      const node = getNode(stateAtStart.currentNodeId)
      const nodeCanonicalFacts = setCanonicalFact(stateAtStart.canonicalFacts, node.publicName, node.canonicalDescription)
      const { storyNpcs, canonicalFacts } = getOrCreateEventNpc({ ...stateAtStart, canonicalFacts: nodeCanonicalFacts }, event)
      const sceneState = {
        ...stateAtStart,
        currentEvent: event,
        sceneOpened: true,
        storyNpcs,
        canonicalFacts,
        eventHistory: stateAtStart.eventHistory.some((seenEvent) => seenEvent.id === event.id) ? stateAtStart.eventHistory : [...stateAtStart.eventHistory, event].slice(-20),
      }
      const feedEntries = leadingFeedEntries.map((entry) => ({ id: createId(entry.kind), ...entry }))
      const currentNarratorEntryId = createId('narration')
      narratorEntryId = currentNarratorEntryId

      setCampaign((state) => ({
        ...sceneState,
        feed: [
          ...state.feed,
          ...feedEntries,
          { id: createId('scene'), kind: 'system', speaker: 'Scene', nodeId: node.id, eventId: event.id, text: event.name },
          { id: createId('location'), ...createLocationFeedEntry(node), eventId: event.id },
          { id: currentNarratorEntryId, kind: 'narration', speaker: 'Narrator', nodeId: node.id, eventId: event.id, text: '', generatedText: '', streaming: true },
        ],
        debugFeed: state.debugFeed,
      }))
      scrollStoryToEnd('smooth')

      const prompt = buildSceneOpeningPrompt(sceneState, event)
      appendDebugEntry({ label: 'Scene opening prompt', text: prompt })
      const varietyWarnings = getChoiceVarietyWarnings(event)
      if (varietyWarnings.length > 0) {
        appendDebugEntry({ label: 'Choice variety warnings', text: varietyWarnings.join('\n') })
      }

      const openingText = await streamFeedEntry(currentNarratorEntryId, prompt)
      appendDirectionLintWarning(sceneState, openingText, 'Scene opening')
      rememberLocationCanonicalFact(node, openingText)
      updateFeedEntry(currentNarratorEntryId, (entry) => ({ ...entry, streaming: false }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The local model is not available. Start it before continuing.'
      if (narratorEntryId) {
        updateFeedEntry(narratorEntryId, (entry) => ({ ...entry, kind: entry.text ? entry.kind : 'error', text: entry.text || `Narrator unavailable — ${message}`, streaming: false, retryAction: 'begin-scene' }))
      } else {
        appendFeedEntry({ kind: 'error', speaker: 'System', nodeId: stateAtStart.currentNodeId, text: `Narrator unavailable — ${message}`, retryAction: 'begin-scene' })
      }
      setPendingRetry(() => () => void openSceneFromState(stateAtStart, leadingFeedEntries))
      setLlmError(message)
    } finally {
      setIsAdvancing(false)
    }
  }

  const travelToNode = async (nodeId: string) => {
    if (isStoryLocked || campaign.outcome !== 'running') {
      return
    }

    const disabledReason = getTravelDisabledReason(campaign, nodeId)
    const destination = getNode(nodeId)

    if (disabledReason) {
      if (campaign.sceneOpened && campaign.currentEvent) {
        appendFeedEntry({ kind: 'system', speaker: 'Map', nodeId: campaign.currentNodeId, text: disabledReason })
      }
      return
    }

    setActiveMainTab('map')
    setSelectedNodeId(nodeId)
    setIsTravelAnimating(true)
    setTravelAnimation({ id: createId('travel'), fromNodeId: campaign.currentNodeId, toNodeId: destination.id })
  }

  const completeTravelAnimation = async () => {
    if (!travelAnimation || !isTravelAnimating) {
      return
    }

    const nodeId = travelAnimation.toNodeId
    const destination = getNode(nodeId)
    const wasExplored = campaign.exploredNodeIds.includes(nodeId)
    const travelledState: CampaignState = {
      ...campaign,
      currentNodeId: nodeId,
      currentEvent: undefined,
      sceneOpened: false,
      exploredNodeIds: wasExplored ? campaign.exploredNodeIds : [...campaign.exploredNodeIds, nodeId],
      storyNpcs: campaign.storyNpcs.map((npc) => ({ ...npc, currentNodeId: nodeId })),
    }

    setCampaign(travelledState)
    setSelectedNodeId(nodeId)
    setTravelAnimation(undefined)
    setIsTravelAnimating(false)
    await openSceneFromState(travelledState, [{ kind: 'system', speaker: 'Map', nodeId, text: wasExplored ? `Travelled to ${destination.publicName}.` : `Discovered ${destination.publicName}.` }])
  }

  const beginScene = async () => {
    if (isStoryLocked || campaign.outcome !== 'running') {
      return
    }

    await openSceneFromState(campaign)
  }

  const chooseAction = async (choice: StoryChoice) => {
    if (isStoryLocked || campaign.outcome !== 'running' || !campaign.currentEvent || getChoiceDisabledReason(campaign, choice)) {
      return
    }

    if (choiceNeedsConfirmation(choice) && confirmingChoiceId !== choice.id) {
      setConfirmingChoiceId(choice.id)
      return
    }

    setConfirmingChoiceId(undefined)
    setIsAdvancing(true)
    setLlmError(undefined)

    try {
      await assertLocalModelAvailable(llmSettings)

      const stateAtStart = campaign
      const event = stateAtStart.currentEvent
      if (!event) {
        return
      }
      const node = getNode(stateAtStart.currentNodeId)
      const sceneNpc = event.npcTemplate ? stateAtStart.storyNpcs.find((npc) => npc.id === event.npcTemplate?.id) : undefined
      const effects = choice.effects ?? []

      appendFeedEntry({
        kind: 'selected',
        speaker: 'Your choice',
        nodeId: node.id,
        eventId: event.id,
        text: choice.neutralSummary,
      })
      appendDebugEntry({
        label: 'Selected choice',
        text: `${choice.label}\nMode: ${choice.mode}\nSkill tags: ${choice.skillTags.join(', ') || 'none'}\n\nEffects:\n${effects.map(describeEffect).join('\n') || 'No mechanical effects.'}`,
      })

      const resolutionPrompt = buildPlayerActionResolutionPrompt(stateAtStart, event, choice, effects)
      appendDebugEntry({ label: 'Resolution prompt', text: resolutionPrompt })
      const resolutionEntryId = appendFeedEntry({ kind: 'narration', speaker: 'Narrator', nodeId: node.id, eventId: event.id, text: '', generatedText: '', streaming: true })
      const resolutionText = await streamFeedEntry(resolutionEntryId, resolutionPrompt)
      appendDirectionLintWarning(stateAtStart, resolutionText, 'Choice resolution')
      updateFeedEntry(resolutionEntryId, (entry) => ({ ...entry, consequenceBadges: getEffectBadges(effects), streaming: false }))

      let updatedStoryNpcs = stateAtStart.storyNpcs
      let npcText = ''
      if (sceneNpc) {
        const npcPrompt = buildNpcResponsePrompt(stateAtStart, event, sceneNpc, choice, resolutionText)
        appendDebugEntry({ label: 'NPC prompt', text: npcPrompt })
        const npcEntryId = appendFeedEntry({ kind: 'dialogue', speaker: sceneNpc.name, nodeId: node.id, eventId: event.id, text: '', generatedText: '', streaming: true })
        npcText = await streamFeedEntry(npcEntryId, npcPrompt)
        appendDirectionLintWarning(stateAtStart, npcText, 'NPC response')
        updateFeedEntry(npcEntryId, (entry) => ({ ...entry, streaming: false }))
        updatedStoryNpcs = stateAtStart.storyNpcs.map((npc) => (npc.id === sceneNpc.id ? { ...npc, memory: [...npc.memory, npcText].slice(-8) } : npc))
      }

      let updatedCondition = stateAtStart.player.condition
      try {
        const conditionPrompt = buildPlayerConditionUpdatePrompt(stateAtStart, choice, resolutionText, npcText)
        appendDebugEntry({ label: 'Condition prompt', text: conditionPrompt })
        const conditionText = await streamLocalText(llmSettings, conditionPrompt, () => {})
        updatedCondition = sanitizePlayerCondition(conditionText, stateAtStart.player.condition)
      } catch {
        updatedCondition = stateAtStart.player.condition
      }

      const appliedState = applyStoryEffects({ ...stateAtStart, player: { ...stateAtStart.player, condition: updatedCondition }, storyNpcs: updatedStoryNpcs }, effects)
      const outcome: CampaignState['outcome'] = appliedState.outcome

      setSelectedNodeId(appliedState.currentNodeId)
      if (!appliedState.player.inventory.some((item) => item.id === selectedItemId)) {
        setSelectedItemId(appliedState.player.inventory[0]?.id)
      }

      setCampaign((state) => ({
        ...appliedState,
        feed: state.feed,
        debugFeed: state.debugFeed,
        storyNpcs: appliedState.storyNpcs.map((npc) => ({ ...npc, currentNodeId: appliedState.currentNodeId })),
        currentEvent: undefined,
        sceneOpened: false,
        outcome,
      }))

      appendDebugEntry({ label: 'Applied effects', text: effects.map(describeEffect).join('\n') || 'No mechanical effects.' })

      if (outcome !== 'running') {
        const outcomeText = outcome === 'won' ? 'The proof has been delivered. The dead have names again, and the hall has to hear them.' : 'Tamsin can go no farther. Somewhere ahead, the dead keep walking under orders no living mouth will admit giving.'
        appendFeedEntry({ ...createLocationFeedEntry(getNode(appliedState.currentNodeId)) })
        appendFeedEntry({
          kind: 'narration',
          speaker: 'Narrator',
          nodeId: appliedState.currentNodeId,
          text: outcomeText,
          generatedText: outcomeText,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The local model is not available. Start it before continuing.'
      appendFeedEntry({ kind: 'error', speaker: 'System', nodeId: campaign.currentNodeId, eventId: campaign.currentEvent?.id, text: `Narrator unavailable — ${message}`, retryAction: 'choose-action' })
      setPendingRetry(() => () => void chooseAction(choice))
      setLlmError(message)
    } finally {
      setIsAdvancing(false)
    }
  }

  const applyLlmPreset = (presetId: LlmPresetId) => {
    setLlmSettings((settings) => {
      if (presetId === 'custom') {
        return { ...settings, presetId }
      }

      const preset = getLlmPreset(presetId)
      const model = availableModels.length > 0 ? getBestInstalledModel(availableModels, presetId) : preset.preferredModels[0] ?? settings.model

      return { ...settings, presetId, model, options: preset.options }
    })
  }

  const updateLlmOption = (option: keyof OllamaGenerationOptions, value: string) => {
    const numericValue = Number(value)

    if (!Number.isFinite(numericValue)) {
      return
    }

    setLlmSettings((settings) => ({
      ...settings,
      presetId: 'custom',
      options: sanitizeLlmOptions({ ...settings.options, [option]: numericValue }),
    }))
  }

  const sidebarOllamaStatus = ollamaStatus === 'connected'
    ? availableModels.length > 0
      ? `Connected · ${llmSettings.model}`
      : 'Ollama running · no models installed'
    : ollamaStatus === 'checking'
      ? 'Checking Ollama…'
      : 'Ollama unreachable · check setup'

  if (appPhase === 'story-select') {
    return <StorySelectionScreen onSelect={() => setAppPhase('protagonist-intro')} />
  }

  if (appPhase === 'protagonist-intro') {
    return <ProtagonistIntroScreen onBegin={() => setAppPhase('playing')} />
  }

  return (
    <TooltipProvider>
    <main className="iff-app-shell min-h-svh text-foreground lg:h-svh lg:overflow-hidden">
      <div className="mx-auto grid w-full max-w-[1440px] gap-4 px-4 py-4 lg:h-full lg:min-h-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
          <Card className="iff-chrome-panel">
            <CardHeader className="pb-2">
              <div className="min-w-0">
                <CardTitle className="mt-1 font-[var(--font-display)] text-xl font-light leading-tight">{storySchema.title}</CardTitle>
                <p className="mt-1 font-serif text-sm text-[var(--color-text-muted)]">a story by IFF Contributors</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="flex min-w-0 items-center gap-2 font-sans text-xs text-muted-foreground">
                  <span className={`size-2 shrink-0 rounded-full ${ollamaStatus === 'connected' ? 'bg-emerald-500' : ollamaStatus === 'checking' ? 'bg-amber-400' : 'bg-red-500'}`} />
                  <span className="truncate whitespace-nowrap">{sidebarOllamaStatus}</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button type="button" variant="outline" size="sm" className="w-full whitespace-nowrap sm:flex-1" onClick={() => setThemeMode((theme) => getNextThemeMode(theme))} title={themeMode === 'system' ? `System preference: ${resolvedThemeMode}` : `Theme: ${themeMode}`}>
                    {resolvedThemeMode === 'dark' ? <SunIcon data-icon="inline-start" /> : <MoonIcon data-icon="inline-start" />}
                    {resolvedThemeMode === 'dark' ? 'Light' : 'Dark'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="w-full whitespace-nowrap sm:flex-1" onClick={() => setSettingsOpen(true)}>
                    <SettingsIcon data-icon="inline-start" />
                    Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="flex min-h-0 flex-col gap-4 lg:h-full lg:overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              {llmError ? (
                <Alert variant="destructive" className="iff-chrome-panel">
                  <AlertCircleIcon />
                  <AlertTitle>The next passage could not be prepared</AlertTitle>
                  <AlertDescription className="font-serif">Open Options if you want to inspect diagnostics, then try again.</AlertDescription>
                </Alert>
              ) : null}

              <Tabs value={activeMainTab} onValueChange={(value) => setActiveMainTab(value as MainTab)} className="flex min-h-0 flex-1 flex-col gap-3">
                <TabsList className="shrink-0 border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <TabsTrigger value="story" disabled={isTravelAnimating} className="inline-flex items-center gap-2"><BookOpenIcon className="size-3.5" aria-hidden="true" />Story</TabsTrigger>
                  <TabsTrigger value="map" className="inline-flex items-center gap-2"><MapIcon className="size-3.5" aria-hidden="true" />Map</TabsTrigger>
                  <TabsTrigger value="character" disabled={isTravelAnimating} className="inline-flex items-center gap-2"><UserRoundIcon className="size-3.5" aria-hidden="true" />Character</TabsTrigger>
                </TabsList>
                <TabsContent value="story" forceMount className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden data-[state=inactive]:hidden">
                  <Card className="iff-stage-card min-h-0 flex-1">
                    <CardHeader className="shrink-0 border-b border-[var(--color-border)] pb-4">
                      <div className="min-w-0">
                        <p className="ui-label">Current location</p>
                        <CardTitle className="mt-1 font-[var(--font-display)] text-4xl font-light leading-tight tracking-wide">{currentNode.publicName}</CardTitle>
                        <CardDescription className="mt-2 w-full max-w-none font-serif text-sm leading-6">{currentNode.description}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="min-h-0 flex-1 p-0">
                      <ScrollArea viewportRef={storyScrollRef} className="relative h-[min(58svh,620px)] min-h-0 lg:h-full">
                        <div className="p-4 lg:p-6">
                          <StoryTranscript state={campaign} onRetry={pendingRetry} />
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                  <section aria-label="Next actions" className="shrink-0">
                    <ChoicePanel state={campaign} isAdvancing={isStoryLocked} confirmingChoiceId={confirmingChoiceId} onCancelConfirm={() => setConfirmingChoiceId(undefined)} onBeginScene={beginScene} onChoose={chooseAction} />
                  </section>
                </TabsContent>
                <TabsContent value="map" forceMount className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
                  <MapGraphView state={campaign} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} travelLocked={isStoryLocked} onTravelNode={travelToNode} travelAnimation={travelAnimation} onTravelAnimationComplete={completeTravelAnimation} />
                </TabsContent>
                <TabsContent value="character" forceMount className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden data-[state=inactive]:hidden">
                  <CharacterPanel state={campaign} selectedItemId={selectedItemId} onSelectItem={setSelectedItemId} />
                </TabsContent>
              </Tabs>
            </div>
        </section>

        {settingsOpen ? (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80" onClick={() => setSettingsOpen(false)}>
            <div className="min-h-svh">
              <Card className="iff-chrome-panel ml-auto min-h-svh w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
                <CardHeader>
                  <CardTitle>Options</CardTitle>
                  <CardDescription className="font-serif">Tune the local narrator and display. Refresh the page to start over.</CardDescription>
                </CardHeader>
                <CardContent className="flex max-w-2xl flex-col gap-4">
                  <section className="border border-[var(--color-border)] bg-background p-4">
                    <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Local narrator</p>
                    <p className="mt-2 font-serif text-sm leading-6 text-muted-foreground">
                      IFF uses Ollama on your machine. Auto mode chooses a good installed model, so story contributors can focus on scenes and choices instead of model tuning.
                    </p>
                    <label className="mt-3 flex flex-col gap-1.5 text-sm font-medium">
                      Preset
                      <select className="border border-[var(--color-border)] bg-background px-3 py-2 font-serif" value={llmSettings.presetId} onChange={(event) => applyLlmPreset(event.target.value as LlmPresetId)}>
                        {llmModelPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                        <option value="custom">Custom</option>
                      </select>
                    </label>
                    <p className="mt-2 font-serif text-sm leading-6 text-muted-foreground">
                      {llmSettings.presetId === 'custom' ? 'Manual model and generation settings.' : currentLlmPreset.description}
                    </p>
                    <div className="mt-3 grid gap-2 font-sans text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                        <span className="block uppercase tracking-[0.14em]">Current model</span>
                        <span className="mt-1 block font-serif text-sm text-foreground">{llmSettings.model}</span>
                      </div>
                      <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                        <span className="block uppercase tracking-[0.14em]">Installed models</span>
                        <span className="mt-1 block font-serif text-sm text-foreground">{ollamaStatus === 'connected' ? availableModels.length : 'Unknown'}</span>
                      </div>
                    </div>
                    {llmSetupHint ? <p className="mt-3 font-serif text-sm leading-6 text-muted-foreground">{llmSetupHint}</p> : null}
                    {ollamaStatus === 'connected' && availableModels.length === 0 ? (
                      <div className="mt-3 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-xs text-foreground">
                        ollama pull qwen3.6<br />
                        <span className="text-muted-foreground"># lower-resource Llama option</span><br />
                        ollama pull llama3.2:3b
                      </div>
                    ) : null}
                  </section>

                  <Separator />

                  <Button type="button" variant="ghost" className="justify-between border border-[var(--color-border)] bg-background px-4 py-3" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((value) => !value)}>
                    Advanced settings
                    <span className="text-xs text-muted-foreground">{advancedOpen ? 'Hide' : 'Show'}</span>
                  </Button>

                  {advancedOpen ? (
                    <section className="flex flex-col gap-4 border border-[var(--color-border)] bg-background p-4">
                      <section className="flex flex-col gap-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                        <div>
                          <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Model settings</p>
                          <p className="mt-2 font-serif text-sm leading-6 text-muted-foreground">Override the local narrator endpoint, model, and generation controls when the preset defaults need tuning.</p>
                        </div>
                        <label className="flex flex-col gap-1.5 text-sm font-medium">
                          Service endpoint
                          <Input value={llmSettings.endpoint} onChange={(event) => setLlmSettings((settings) => ({ ...settings, endpoint: event.target.value }))} />
                        </label>
                        <label className="flex flex-col gap-1.5 text-sm font-medium">
                          Runtime model
                          {availableModels.length > 0 ? (
                            <select className="border border-[var(--color-border)] bg-background px-3 py-2 font-serif" value={llmSettings.model} onChange={(event) => setLlmSettings((settings) => ({ ...settings, presetId: 'custom', model: event.target.value }))}>
                              {availableModels.map((model) => <option key={model} value={model}>{model}</option>)}
                            </select>
                          ) : <Input value={llmSettings.model} onChange={(event) => setLlmSettings((settings) => ({ ...settings, presetId: 'custom', model: event.target.value }))} />}
                        </label>
                        <div className="border border-[var(--color-border)] bg-background p-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-medium">Model thinking</p>
                              <p className="mt-1 font-serif text-sm leading-6 text-muted-foreground">Optional for reasoning models. It can improve planning, but delays visible story text and may consume the token budget before narration starts.</p>
                            </div>
                            <Button type="button" variant={llmSettings.think ? 'secondary' : 'outline'} className="shrink-0" onClick={() => setLlmSettings((settings) => ({ ...settings, think: !settings.think }))}>
                              {llmSettings.think ? 'Thinking on' : 'Thinking off'}
                            </Button>
                          </div>
                          {llmSettings.think ? <p className="mt-2 font-sans text-xs text-muted-foreground">If narration comes back blank, turn this off or raise Max generated tokens.</p> : null}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-1.5 text-sm font-medium">
                            Temperature
                            <Input type="number" min="0" max="1.5" step="0.01" value={effectiveLlmOptions.temperature} onChange={(event) => updateLlmOption('temperature', event.target.value)} />
                          </label>
                          <label className="flex flex-col gap-1.5 text-sm font-medium">
                            Top-p
                            <Input type="number" min="0.1" max="1" step="0.01" value={effectiveLlmOptions.top_p} onChange={(event) => updateLlmOption('top_p', event.target.value)} />
                          </label>
                          <label className="flex flex-col gap-1.5 text-sm font-medium">
                            Repeat penalty
                            <Input type="number" min="0.8" max="1.5" step="0.01" value={effectiveLlmOptions.repeat_penalty} onChange={(event) => updateLlmOption('repeat_penalty', event.target.value)} />
                          </label>
                          <label className="flex flex-col gap-1.5 text-sm font-medium">
                            Context size
                            <Input type="number" min="2048" max="8192" step="256" value={effectiveLlmOptions.num_ctx} onChange={(event) => updateLlmOption('num_ctx', event.target.value)} />
                          </label>
                          <label className="flex flex-col gap-1.5 text-sm font-medium">
                            Max generated tokens
                            <Input type="number" min="120" max="800" step="20" value={effectiveLlmOptions.num_predict} onChange={(event) => updateLlmOption('num_predict', event.target.value)} />
                          </label>
                        </div>
                        <div className="flex items-center gap-2 font-sans text-xs text-muted-foreground">
                          <span className={`size-2 rounded-full ${ollamaStatus === 'connected' ? 'bg-foreground' : ollamaStatus === 'checking' ? 'bg-muted-foreground' : 'bg-destructive'}`} />
                          {sidebarOllamaStatus}
                        </div>
                        {llmSetupHint ? <p className="font-serif text-sm text-muted-foreground">{llmSetupHint}</p> : null}
                        <Button type="button" variant="outline" onClick={async () => {
                          try {
                            await assertLocalModelAvailable(llmSettings)
                            setTestConnectionMessage('✓ Model ready')
                          } catch (error) {
                            setTestConnectionMessage(`✗ Could not connect: ${error instanceof Error ? error.message : 'Unknown error'}`)
                          }
                        }}>Test Connection</Button>
                        {testConnectionMessage ? <p className="font-serif text-sm text-muted-foreground">{testConnectionMessage}</p> : null}
                        {llmError ? (
                          <Alert variant="destructive">
                            <AlertCircleIcon />
                            <AlertTitle>Diagnostic message</AlertTitle>
                            <AlertDescription className="font-serif">{llmError}</AlertDescription>
                          </Alert>
                        ) : null}
                        <Button type="button" variant={debugMode ? 'secondary' : 'outline'} onClick={() => setDebugMode((value) => !value)}>
                          <EyeIcon data-icon="inline-start" />
                          {debugMode ? 'Hide diagnostics' : 'Show diagnostics'}
                        </Button>
                      </section>

                    </section>
                  ) : null}
                </CardContent>
              </Card>

              {advancedOpen && debugMode ? <DebugPanel entries={campaign.debugFeed} /> : null}
            </div>
          </div>
        ) : null}

        <EndScreen state={campaign} />
      </div>
    </main>
    </TooltipProvider>
  )
}

export default App
