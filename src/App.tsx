import { useMemo, useRef, useState } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { AlertCircleIcon, EyeIcon, PlayIcon, RotateCcwIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

type Health = {
  current: number
  max: number
}

type InventoryItem = {
  id: string
  name: string
  description: string
  tags?: string[]
  visible: boolean
}

type ItemTagDefinition = {
  label: string
  summary: string
  detail: string
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
  health: Health
  inventory: InventoryItem[]
  skillTags: string[]
  voice: PlayerVoice
  backstory: PlayerBackstory
  memory: string[]
}

type StoryIconId = 'lantern' | 'road' | 'crossroads' | 'codex' | 'keep' | 'forest'
type ChoiceTone = 'direct' | 'careful' | 'empathetic' | 'investigative' | 'reckless' | 'reflective'
type ChoiceMode = 'act' | 'say' | 'ask' | 'use-item' | 'risk' | 'wait'
type StoryNodeType = 'origin' | 'settlement' | 'road' | 'wilds' | 'watch' | 'crypt' | 'court' | 'ritual' | 'hazard' | 'mystery'

type StoryEffect =
  | { type: 'gainItem'; item: InventoryItem }
  | { type: 'loseItem'; itemId: string }
  | { type: 'damage'; amount: number; reason: string }
  | { type: 'heal'; amount: number; reason: string }
  | { type: 'remember'; text: string }
  | { type: 'revealNode'; nodeId: string }
  | { type: 'moveToNode'; nodeId: string }
  | { type: 'setFlag'; flag: string; value: boolean }

type StoryChoice = {
  id: string
  label: string
  optionSummary?: string
  writerIntent?: string
  actionPrompt: string
  mode: ChoiceMode
  tone: ChoiceTone
  skillTags?: string[]
  requiresItemId?: string
  consequenceHint?: string
  effects?: StoryEffect[]
}

type StoryEvent = {
  id: string
  name: string
  weight: number
  iconAssetId: StoryIconId
  prompt: string
  objectiveNodeId?: string
  npcTemplate?: StoryNpcTemplate
  choices: StoryChoice[]
}

type StoryNpcTemplate = {
  id: string
  name: string
  role: string
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
  label?: string
  hiddenUntilExplored?: boolean
  blocker?: TravelBlocker
}

type StoryNode = {
  id: string
  name: string
  publicName: string
  description: string
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
  goalNodeId: string
  maxTurns: number
  designNote: string
  fixedRules: string[]
  codexTerms: string[]
  player: PlayableCharacter
  nodes: StoryNode[]
  events: StoryEvent[]
}

type FeedEntry = {
  id: string
  turn: number
  kind: 'narration' | 'dialogue' | 'action' | 'system'
  speaker?: string
  text: string
  generatedText?: string
  revealedLineCount?: number
  revealMode?: 'immediate' | 'line-gated'
  nodeId?: string
  eventId?: string
  streaming?: boolean
}

type DebugEntry = {
  id: string
  turn: number
  label?: string
  text: string
  streaming?: boolean
}

type CampaignState = {
  turn: number
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
  outcome: 'running' | 'won' | 'lost'
}

type LlmSettings = {
  endpoint: string
  model: string
}

type AppView = 'story' | 'map' | 'codex' | 'settings'
type CodexSection = 'people' | 'places' | 'inventory'

type CodexReference = {
  term: string
  type: 'place' | 'person' | 'item' | 'term'
  targetId?: string
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

const itemTagDefinitions: Record<string, ItemTagDefinition> = {
  tool: {
    label: 'Tool',
    summary: 'A practical object for changing the environment.',
    detail: 'Useful for lifting, cutting, prying, digging, fixing, or improvising.',
  },
  ward: {
    label: 'Ward',
    summary: 'An object meant to resist hostile pressure.',
    detail: 'May help repel, delay, blind, seal, or weaken a threat.',
  },
  iron: {
    label: 'Iron',
    summary: 'A material with weight against uncanny forces.',
    detail: 'May matter for binding, cutting, grounding, or containment.',
  },
  proof: {
    label: 'Proof',
    summary: 'Evidence that can change what people accept.',
    detail: 'Can support claims, unlock testimony, earn trust, or pressure officials.',
  },
  authority: {
    label: 'Authority',
    summary: 'An object that carries official force.',
    detail: 'Can demand access, shelter, answers, obedience, or accountability.',
  },
  salvage: {
    label: 'Salvage',
    summary: 'Imperfect material made useful by improvisation.',
    detail: 'Useful for repairs, substitutions, traps, or desperate plans.',
  },
  ritual: {
    label: 'Ritual',
    summary: 'An item with ceremonial relevance.',
    detail: 'Relevant to rites, symbols, names, vows, witnesses, or proper sequence.',
  },
  silver: {
    label: 'Silver',
    summary: 'A material that may matter to value, purity, or rites.',
    detail: 'May help when resonance, formality, or symbolic weight matters.',
  },
}

const graveSpade: InventoryItem = {
  id: 'grave-spade',
  name: 'grave spade',
  description: 'A working tool with a polished haft and a nicked iron edge. Tamsin trusts it more than court steel.',
  tags: ['tool'],
  visible: true,
}

const graveAsh: InventoryItem = {
  id: 'grave-ash',
  name: 'grave ash',
  description: 'A stoppered pouch of ash gathered from consecrated soil. It can blind the dead for a few breaths.',
  tags: ['ward', 'ritual'],
  visible: true,
}

const ironNails: InventoryItem = {
  id: 'iron-nails',
  name: 'iron nails',
  description: 'A palmful of coffin nails. They still remember the shape of a shut door.',
  tags: ['iron', 'ward'],
  visible: true,
}

const royalWrit: InventoryItem = {
  id: 'royal-writ',
  name: 'royal writ',
  description: 'King Osric’s command, stamped in red wax. It opens gates and closes excuses.',
  tags: ['proof', 'authority'],
  visible: true,
}

const betterKnife: InventoryItem = {
  id: 'armory-knife',
  name: 'armory knife',
  description: 'A narrow knife with honest balance. Not heroic, but useful when knots, straps, or hands must be cut free.',
  tags: ['iron', 'tool'],
  visible: true,
}

const crackedSpearHead: InventoryItem = {
  id: 'cracked-spear-head',
  name: 'cracked spearhead',
  description: 'Salvaged from a weapon too poor to carry whole. It is still iron, and iron still has opinions about the dead.',
  tags: ['iron', 'salvage'],
  visible: true,
}

const bellClapper: InventoryItem = {
  id: 'bell-clapper',
  name: 'silver bell clapper',
  description: 'The missing tongue of an old burial bell, dark with age and bright where Tamsin rubbed it clean.',
  tags: ['ritual', 'silver'],
  visible: true,
}

const boneCharm: InventoryItem = {
  id: 'bone-charm',
  name: 'bone charm',
  description: 'A fingerbone wrapped in silver wire. It is proof, prison, and accusation all at once.',
  tags: ['proof', 'ritual'],
  visible: true,
}

const storySchema: StorySchema = {
  id: 'kings-lich-playable',
  title: 'The King’s Lich',
  goalNodeId: 'king-return',
  maxTurns: 14,
  designNote:
    'A contributor-authored playable story about agency-preserving narration, original scenes, varied authored choices, and lightweight consequences. The local model narrates within the schema; code owns state.',
  fixedRules: [
    'The end user plays the authored protagonist directly.',
    'Authored choices decide what the protagonist can attempt; generated prose may enrich but cannot override mechanical state.',
    'Health and inventory are visible story state and change only through authored effects.',
    'The codex is compact known memory for the player and the local narrator.',
    'Unexplored places, hidden routes, and future event tables remain unrevealed until discovered.',
    'All story material and style guidance must remain original and generic, without named protected references.',
  ],
  codexTerms: ['Redvale', 'King Osric', 'Blackpine Road', 'Ash Farms', 'Old Watchtower', 'Barrow Crypt', 'Graymere Hall', 'grave spade', 'grave ash', 'iron nails', 'royal writ', 'the lich'],
  player: {
    id: 'tamsin',
    name: 'Tamsin',
    role: 'Gravedigger under royal order',
    portraitAsset: publicDomainPortraitAsset,
    color: '#7dd3fc',
    health: { current: 20, max: 20 },
    inventory: [graveSpade, graveAsh, ironNails, royalWrit],
    skillTags: ['grave-lore', 'plain-speech', 'steady-hands'],
    voice: {
      publicStyle: 'dry, practical, and too familiar with death to flatter anyone',
      innerStyle: 'watchful, restrained, bitterly funny when fear gets close',
      fear: 'being spent by powerful people who will misname it courage',
      desire: 'to put the dead back down and return to work that makes sense',
      contradiction: 'she respects burial rites but distrusts anyone who turns sacrifice into policy',
    },
    backstory: {
      origin: 'Tamsin digs graves outside Redvale and was taken by levy because she knows the dead too well.',
      wound: 'She has buried neighbors for orders written by people who never learned their names.',
      want: 'She wants to survive, end the rising dead, and make the king admit what this command costs.',
      privateKnowledge: 'Grave ash can blind a corpse for a few breaths if thrown into its eyes or mouth.',
    },
    memory: ['The king called it service because he could not bear to call it fear.'],
  },
  nodes: [
    {
      id: 'graymere-yard',
      name: 'Graymere Yard',
      publicName: 'Graymere Hall',
      description: 'The muddy seat of King Osric, where orders sound cleaner than the roads they create.',
      iconAssetId: 'road',
      nodeType: 'origin',
      exits: [
        { toNodeId: 'ash-farms', label: 'Follow the opened graves' },
        { toNodeId: 'old-watchtower', label: 'Take the high road toward old rites' },
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
      description: 'Sickly fields outside Redvale, where fresh graves keep opening and farmers count names under their breath.',
      iconAssetId: 'crossroads',
      nodeType: 'settlement',
      exits: [
        { toNodeId: 'graymere-yard', label: 'Return to the king’s road' },
        { toNodeId: 'blackpine-road', label: 'Follow the grave-road into the pines' },
        { toNodeId: 'old-watchtower', label: 'Cut across the high fields' },
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
      description: 'A leaning tower where old rites, bad maps, and worse advice have survived the weather.',
      iconAssetId: 'codex',
      nodeType: 'watch',
      exits: [
        { toNodeId: 'graymere-yard', label: 'Descend toward Graymere Hall' },
        { toNodeId: 'ash-farms', label: 'Cross back toward the fields' },
        { toNodeId: 'blackpine-road', label: 'Take the marked road under the pines' },
        { toNodeId: 'barrow-crypt', label: 'Follow the tower map toward the barrow' },
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
      description: 'A cramped forest road where carts lie split and grave-cold mist hangs between the pines.',
      iconAssetId: 'forest',
      nodeType: 'hazard',
      exits: [
        { toNodeId: 'ash-farms', label: 'Return by the farm track' },
        { toNodeId: 'old-watchtower', label: 'Climb back toward the tower' },
        { toNodeId: 'barrow-crypt', label: 'Press through the grave mist' },
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
      name: 'Barrow Crypt',
      publicName: 'Barrow Crypt',
      description: 'The lich’s buried hall, cold with old bones, stolen bells, and a ruler who has forgotten how to die.',
      iconAssetId: 'keep',
      nodeType: 'crypt',
      exits: [
        { toNodeId: 'old-watchtower', label: 'Retreat by the tower path' },
        { toNodeId: 'blackpine-road', label: 'Return through Blackpine Road' },
        {
          toNodeId: 'king-return',
          label: 'Return to court with proof',
          blocker: {
            id: 'proof-required',
            label: 'Proof required',
            reason: 'Returning to court empty-handed would give the king another order, not proof. Tamsin needs something that can accuse the lich in public.',
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
      description: 'The return to King Osric, where survival must become proof and proof must become a sentence.',
      iconAssetId: 'lantern',
      nodeType: 'court',
      exits: [{ toNodeId: 'barrow-crypt', label: 'Go back toward the barrow road' }],
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
      objectiveNodeId: 'ash-farms',
      npcTemplate: {
        id: 'king-osric',
        name: 'King Osric',
        role: 'Tired king',
        description: 'A thin ruler in a patched crown who has slept badly enough to mistake command for courage.',
        voice: 'formal, clipped, ashamed when pressed, impatient with delay',
        want: 'Send someone to stop the lich before the dead around Redvale outnumber the living.',
        knows: 'The old barrows beyond Blackpine Road are the source, and the last knight returned pale, silent, and dead-eyed before vanishing at dawn.',
      },
      choices: [
        {
          id: 'make-king-name-cost',
          label: 'Make the king name what he is asking of you',
          optionSummary: 'Press for plain accountability instead of accepting the order silently.',
          writerIntent: 'Offer a direct social option that challenges power without choosing exact words for the player.',
          actionPrompt: 'The selected option is to press King Osric to speak plainly about sending a gravedigger where trained knights failed.',
          mode: 'ask',
          tone: 'direct',
          skillTags: ['plain-speech'],
          consequenceHint: 'The king resents the question but gives clearer information about the road east.',
          effects: [
            { type: 'setFlag', flag: 'royal-order-answered', value: true },
            { type: 'remember', text: 'King Osric admitted the barrows beyond Blackpine Road are the source of the rising dead.' },
            { type: 'revealNode', nodeId: 'ash-farms' },
            { type: 'moveToNode', nodeId: 'ash-farms' },
          ],
        },
        {
          id: 'inspect-writ',
          label: 'Study the royal writ for what it can force open',
          optionSummary: 'Look for practical authority the writ grants before leaving the hall.',
          writerIntent: 'Offer an investigative alternative that treats royal authority as a tool, not a feeling.',
          actionPrompt: 'The selected option is to study the royal writ for practical access, demands, and obligations it can create.',
          mode: 'act',
          tone: 'investigative',
          skillTags: ['grave-lore'],
          consequenceHint: 'The writ becomes a practical key for frightened gates and stubborn officials.',
          effects: [
            { type: 'setFlag', flag: 'royal-order-answered', value: true },
            { type: 'remember', text: 'The royal writ can demand shelter, testimony, and access to sealed roads.' },
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
      objectiveNodeId: 'old-watchtower',
      choices: [
        {
          id: 'demand-usable-iron',
          label: 'Demand usable iron before leaving',
          optionSummary: 'Turn the bad equipment into a public problem the clerk has to answer.',
          writerIntent: 'Give the player a forceful speech-intent option that improves preparation.',
          actionPrompt: 'The selected option is to press the armory clerk for gear that will not fail at the first dead hand.',
          mode: 'say',
          tone: 'direct',
          skillTags: ['plain-speech'],
          consequenceHint: 'The clerk yields something small but honest rather than keep arguing in public.',
          effects: [
            { type: 'gainItem', item: betterKnife },
            { type: 'remember', text: 'Tamsin forced the armory to admit the first weapon was meant for someone disposable.' },
            { type: 'moveToNode', nodeId: 'old-watchtower' },
          ],
        },
        {
          id: 'salvage-spear-head',
          label: 'Salvage the spearhead and leave the shaft behind',
          optionSummary: 'Take the only useful part and avoid giving the clerk another opening to posture.',
          writerIntent: 'Offer a quiet practical option that converts bad gear into a useful item.',
          actionPrompt: 'The selected option is to strip useful iron from the broken spear and leave the useless shaft behind.',
          mode: 'act',
          tone: 'careful',
          skillTags: ['steady-hands'],
          consequenceHint: 'The court barely notices, but Tamsin leaves with a piece of iron she can trust.',
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
      objectiveNodeId: 'ash-farms',
      npcTemplate: {
        id: 'farmer-riel',
        name: 'Farmer Riel',
        role: 'Frightened father',
        description: 'A raw-eyed farmer with mud on his knees and a child gripping the back of his coat.',
        voice: 'plain, guarded, angry from fear',
        want: 'Know whether Tamsin brings help or another royal lie.',
        knows: 'Three graves opened behind his byre after a bell rang under the hill.',
      },
      choices: [
        {
          id: 'answer-with-truth',
          label: 'Answer him with the truth you can afford',
          optionSummary: 'Give a limited honest answer and leave room for what is still unknown.',
          writerIntent: 'Offer an empathetic conversational option without writing exact player dialogue.',
          actionPrompt: 'The selected option is to answer Farmer Riel honestly about what is known, what is unknown, and the next intended step.',
          mode: 'say',
          tone: 'empathetic',
          skillTags: ['plain-speech'],
          consequenceHint: 'Honesty does not comfort him, but it gives him a reason to share what he heard.',
          effects: [
            { type: 'remember', text: 'A bell rang beneath the hill before the Ash Farms graves opened.' },
            { type: 'moveToNode', nodeId: 'ash-farms' },
          ],
        },
        {
          id: 'show-writ',
          label: 'Show the royal writ and ask for the first opened grave',
          optionSummary: 'Use official authority to focus the exchange on a concrete lead.',
          writerIntent: 'Offer an authority-backed investigative option that may create distrust but gains direction.',
          actionPrompt: 'The selected option is to show the royal writ as authority to demand a path to the first disturbed grave.',
          mode: 'ask',
          tone: 'investigative',
          requiresItemId: 'royal-writ',
          consequenceHint: 'The farmer distrusts the seal but points her toward the first sign.',
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
      objectiveNodeId: 'blackpine-road',
      npcTemplate: {
        id: 'miller-joan',
        name: 'Miller Joan',
        role: 'Injured farmer',
        description: 'A mud-covered miller with a shaking lantern and no patience for ceremonial courage.',
        voice: 'plain, angry, frightened, and practical',
        want: 'Get her brother out of the root cellar before the dead find the door.',
        knows: 'The dead came from the east after the bell rang under the hill, and one corpse still wore a royal tabard.',
      },
      choices: [
        {
          id: 'seal-cellar-with-nails',
          label: 'Use iron nails to hold the cellar shut',
          optionSummary: 'Spend the nails to buy time and control the rescue.',
          writerIntent: 'Offer a careful item-use option that trades inventory for safety.',
          actionPrompt: 'The selected option is to brace the cellar door with coffin nails and coordinate when the people below should move.',
          mode: 'use-item',
          tone: 'careful',
          skillTags: ['steady-hands'],
          requiresItemId: 'iron-nails',
          consequenceHint: 'The nails buy enough time to pull the trapped man free without drawing every corpse at once.',
          effects: [
            { type: 'loseItem', itemId: 'iron-nails' },
            { type: 'remember', text: 'Miller Joan saw a corpse in royal colors among the dead from the east.' },
            { type: 'moveToNode', nodeId: 'blackpine-road' },
          ],
        },
        {
          id: 'throw-grave-ash',
          label: 'Throw grave ash into the nearest dead face',
          optionSummary: 'Spend the ash for a fast opening, accepting that close work may hurt.',
          writerIntent: 'Offer a risky item-use option with a clear cost.',
          actionPrompt: 'The selected option is to spend grave ash to blind the nearest corpse long enough to open the root cellar.',
          mode: 'use-item',
          tone: 'reckless',
          skillTags: ['grave-lore'],
          requiresItemId: 'grave-ash',
          consequenceHint: 'The ash works, but close work among the dead leaves bruises and torn skin.',
          effects: [
            { type: 'loseItem', itemId: 'grave-ash' },
            { type: 'damage', amount: 2, reason: 'The dead clawed close while the cellar opened.' },
            { type: 'remember', text: 'Grave ash can blind the dead, but only for moments.' },
            { type: 'moveToNode', nodeId: 'blackpine-road' },
          ],
        },
      ],
    },
    {
      id: 'hermit-warning',
      name: 'The tower keeps an ugly rite',
      weight: 5,
      iconAssetId: 'codex',
      prompt: 'A hermit at the old watchtower claims the lich can be stopped only if its bone charm is found and the burial bell is made whole.',
      objectiveNodeId: 'barrow-crypt',
      npcTemplate: {
        id: 'old-perrin',
        name: 'Old Perrin',
        role: 'Tower hermit',
        description: 'A sharp-eyed hermit who has survived by being useful and unpleasant in equal measure.',
        voice: 'rasping, blunt, fond of ugly truths',
        want: 'Convince Tamsin that courage without a rite will only add a fresh body to the lich’s host.',
        knows: 'The lich hides its soul in a bone charm near a silver burial bell, and the bell lacks its clapper.',
      },
      choices: [
        {
          id: 'trade-for-rite',
          label: 'Trade plain answers for the burial rite',
          optionSummary: 'Treat the hermit as a bargainer and exchange facts for instructions.',
          writerIntent: 'Offer a direct social option that rewards candor with ritual knowledge.',
          actionPrompt: 'The selected option is to give Old Perrin plain answers about the opened graves and demand the burial instructions in return.',
          mode: 'say',
          tone: 'direct',
          skillTags: ['plain-speech'],
          consequenceHint: 'The hermit respects a bargain with edges and gives her the missing clapper.',
          effects: [
            { type: 'gainItem', item: bellClapper },
            { type: 'remember', text: 'The burial bell must be made whole before the bone charm can be broken.' },
            { type: 'moveToNode', nodeId: 'barrow-crypt' },
          ],
        },
        {
          id: 'read-the-tower-marks',
          label: 'Read the burial marks carved into the tower stair',
          optionSummary: 'Rely on physical evidence instead of the hermit’s performance.',
          writerIntent: 'Offer an investigative option that uses the protagonist’s grave knowledge.',
          actionPrompt: 'The selected option is to study the old burial marks carved into the tower stairwell for usable instructions.',
          mode: 'act',
          tone: 'investigative',
          skillTags: ['grave-lore'],
          consequenceHint: 'The marks confirm the rite and show where the barrow path begins.',
          effects: [
            { type: 'remember', text: 'The barrow rite binds bell, bone charm, and grave name together.' },
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
      prompt: 'Fresh grave mist and broken pines show the undead are close enough to hear careless breath.',
      objectiveNodeId: 'barrow-crypt',
      choices: [
        {
          id: 'mark-safe-path',
          label: 'Mark a quiet path with the grave spade',
          optionSummary: 'Use the spade as a practical tool to test ground and choose a safer route.',
          writerIntent: 'Offer a careful tool-use option that avoids stating obvious item affordances as tags.',
          actionPrompt: 'The selected option is to use the grave spade to test soft earth and mark a path where the mist lies thinnest.',
          mode: 'use-item',
          tone: 'careful',
          skillTags: ['grave-lore', 'steady-hands'],
          requiresItemId: 'grave-spade',
          consequenceHint: 'The route avoids the worst of the listening dead.',
          effects: [
            { type: 'remember', text: 'The grave mist thickens around disturbed royal dead.' },
            { type: 'moveToNode', nodeId: 'barrow-crypt' },
          ],
        },
        {
          id: 'run-through-mist',
          label: 'Run before the mist closes',
          optionSummary: 'Trade safety for speed before the dead fully gather.',
          writerIntent: 'Offer a high-risk option with health cost and fast movement.',
          actionPrompt: 'The selected option is to choose speed over silence and break through the mist before the dead fully gather.',
          mode: 'risk',
          tone: 'reckless',
          consequenceHint: 'She reaches the barrow road, but the mist takes its price from her breath and skin.',
          effects: [
            { type: 'damage', amount: 3, reason: 'The grave mist burned cold where it touched living skin.' },
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
      objectiveNodeId: 'barrow-crypt',
      npcTemplate: {
        id: 'sergeant-maud',
        name: 'Sergeant Maud',
        role: 'Deserter with a borrowed sword',
        description: 'A hollow-cheeked veteran whose shame has hardened into toll-taking.',
        voice: 'dry, threatening, tired beneath the threat',
        want: 'Take enough from travelers to keep her deserters alive another week.',
        knows: 'The royal dead walk first when the bell sounds, as if old commands still pull them upright.',
      },
      choices: [
        {
          id: 'show-royal-dead-truth',
          label: 'Tell the deserters what walks in royal colors',
          optionSummary: 'Use the deserters’ own fear and experience to make the roadblock feel pointless.',
          writerIntent: 'Offer a direct conversational option that uses known evidence without exact dialogue.',
          actionPrompt: 'The selected option is to tell Sergeant Maud about the royal corpse and challenge whether blocking this investigation helps anyone survive.',
          mode: 'say',
          tone: 'direct',
          skillTags: ['plain-speech'],
          consequenceHint: 'The deserters do not become kind, but they stop blocking the road.',
          effects: [
            { type: 'remember', text: 'The lich may be raising royal dead first because old commands still cling to them.' },
            { type: 'moveToNode', nodeId: 'barrow-crypt' },
          ],
        },
        {
          id: 'trade-knife-for-passage',
          label: 'Trade the armory knife for quiet passage',
          optionSummary: 'Give up a useful object to avoid violence and keep moving.',
          writerIntent: 'Offer a careful inventory trade that avoids a fight.',
          actionPrompt: 'The selected option is to trade the armory knife for passage without a fight.',
          mode: 'use-item',
          tone: 'careful',
          requiresItemId: 'armory-knife',
          consequenceHint: 'The deserters accept the trade and point out the safest turn toward the barrows.',
          effects: [
            { type: 'loseItem', itemId: 'armory-knife' },
            { type: 'heal', amount: 1, reason: 'Avoiding the fight preserves strength.' },
            { type: 'moveToNode', nodeId: 'barrow-crypt' },
          ],
        },
      ],
    },
    {
      id: 'bone-charm-glimpse',
      name: 'The bone charm shows itself',
      weight: 4,
      iconAssetId: 'keep',
      prompt: 'The lich turns toward its ritual, revealing a fingerbone charm threaded with silver wire beneath its robes.',
      objectiveNodeId: 'king-return',
      choices: [
        {
          id: 'hook-charm-with-spade',
          label: 'Hook the bone charm with the grave spade',
          optionSummary: 'Use reach and leverage to take the charm without barehanded contact.',
          writerIntent: 'Offer a risky tool-use option with a health cost.',
          actionPrompt: 'The selected option is to use the grave spade to hook the bone charm away from the lich without touching it barehanded.',
          mode: 'use-item',
          tone: 'reckless',
          skillTags: ['steady-hands'],
          requiresItemId: 'grave-spade',
          consequenceHint: 'The charm comes free, but the lich’s cold tears at Tamsin as it passes.',
          effects: [
            { type: 'gainItem', item: boneCharm },
            { type: 'damage', amount: 2, reason: 'The lich’s cold bit through the spade haft.' },
            { type: 'remember', text: 'The bone charm is the lich’s anchor and proof of its ending.' },
            { type: 'moveToNode', nodeId: 'king-return' },
          ],
        },
        {
          id: 'speak-burial-name',
          label: 'Speak the burial name and reach for the charm',
          optionSummary: 'Use the burial name as ritual pressure, then take the opening it creates.',
          writerIntent: 'Offer a reflective ritual option grounded in grave-lore without inventing exact spoken words.',
          actionPrompt: 'The selected option is to invoke the burial name from the rite and reach for the charm while the lich hesitates.',
          mode: 'say',
          tone: 'reflective',
          skillTags: ['grave-lore'],
          consequenceHint: 'The name weakens the lich long enough for Tamsin to take proof.',
          effects: [
            { type: 'gainItem', item: boneCharm },
            { type: 'remember', text: 'Naming the dead can slow even a deathless thing when the rite is true.' },
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
      prompt: 'The lich begins raising another host in Barrow Crypt while a cracked burial bell swings without its missing voice.',
      objectiveNodeId: 'king-return',
      choices: [
        {
          id: 'restore-bell-and-break-charm',
          label: 'Restore the bell and break the bone charm',
          optionSummary: 'Complete the ritual mechanism and use it against the lich’s host.',
          writerIntent: 'Offer the strongest prepared ritual solution for players who found the clapper.',
          actionPrompt: 'The selected option is to set the silver clapper into the burial bell, ring the ritual, and break the bone charm as the dead turn toward the sound.',
          mode: 'use-item',
          tone: 'careful',
          skillTags: ['grave-lore', 'steady-hands'],
          requiresItemId: 'bell-clapper',
          consequenceHint: 'The rite takes hold because the bell is whole and the charm is exposed.',
          effects: [
            { type: 'gainItem', item: boneCharm },
            { type: 'remember', text: 'The burial bell rang whole, and the lich’s host lost the command that held it upright.' },
            { type: 'setFlag', flag: 'lich-ended', value: true },
            { type: 'moveToNode', nodeId: 'king-return' },
          ],
        },
        {
          id: 'bind-crypt-with-iron',
          label: 'Bind the crypt door with scavenged iron',
          optionSummary: 'Use scavenged iron for containment when a clean ending is not available.',
          writerIntent: 'Offer a costly fallback that can still carry the story forward.',
          actionPrompt: 'The selected option is to use every available scrap of iron to bind the crypt door and trap the ritual long enough to escape with proof.',
          mode: 'use-item',
          tone: 'reckless',
          requiresItemId: 'cracked-spear-head',
          consequenceHint: 'The binding is brutal and temporary, but it buys a path back to the king with evidence.',
          effects: [
            { type: 'loseItem', itemId: 'cracked-spear-head' },
            { type: 'damage', amount: 4, reason: 'The crypt fought the binding with dead hands and flying stone.' },
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
      prompt: 'Tamsin returns to King Osric with mud, wounds, and whatever proof she could carry from the barrow dark.',
      choices: [
        {
          id: 'lay-proof-before-king',
          label: 'Lay the proof before the king and make him look',
          optionSummary: 'Use the carried evidence to force public acknowledgment.',
          writerIntent: 'Offer a direct ending option focused on accountability and proof.',
          actionPrompt: 'The selected option is to lay the proof before King Osric and force public acknowledgment of the order’s cost.',
          mode: 'act',
          tone: 'direct',
          requiresItemId: 'bone-charm',
          consequenceHint: 'The court understands the lich is ended or contained because Tamsin brought back the thing that held it.',
          effects: [
            { type: 'remember', text: 'Tamsin returned with proof and made the king look at what his command cost.' },
            { type: 'setFlag', flag: 'proof-delivered', value: true },
          ],
        },
        {
          id: 'demand-names-read',
          label: 'Demand the names of the dead be read before reward',
          optionSummary: 'Make witness and remembrance the price of any royal gratitude.',
          writerIntent: 'Offer a reflective ending option that centers the dead rather than reward.',
          actionPrompt: 'The selected option is to refuse reward until the names of the raised and reburied dead are read aloud in the hall.',
          mode: 'say',
          tone: 'reflective',
          consequenceHint: 'The court resists the discomfort, but the story ends with witness instead of pageantry.',
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

const defaultLlmSettings: LlmSettings = {
  endpoint: 'http://localhost:11434',
  model: 'qwen2.5:7b',
}

const initialState: CampaignState = {
  turn: 1,
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
      turn: 1,
      kind: 'dialogue',
      speaker: 'King Osric',
      nodeId: 'graymere-yard',
      text: 'King Osric: Tamsin of Redvale, you know graves better than my remaining knights know roads. The old barrows have begun returning what we buried. Take this writ, follow the opened earth, and bring me proof that the dead will stay down.',
    },
  ],
  debugFeed: [],
  flags: {},
  outcome: 'running',
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function splitFeedLines(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function getGeneratedFeedLines(entry: FeedEntry) {
  return splitFeedLines(entry.generatedText ?? entry.text)
}

function getRevealedFeedText(entry: FeedEntry, revealedLineCount = entry.revealedLineCount ?? getGeneratedFeedLines(entry).length) {
  return getGeneratedFeedLines(entry).slice(0, revealedLineCount).join('\n')
}

function getFeedLineCount(entry: FeedEntry) {
  return getGeneratedFeedLines(entry).length
}

function hasUnrevealedLines(entry: FeedEntry) {
  return entry.revealMode === 'line-gated' && (entry.revealedLineCount ?? 0) < getFeedLineCount(entry)
}

function isFeedEntryFullyRevealed(entry: FeedEntry) {
  return entry.revealMode !== 'line-gated' || !entry.streaming && !hasUnrevealedLines(entry)
}

function getActiveLineGatedEntry(state: CampaignState) {
  return state.feed.find((entry) => entry.revealMode === 'line-gated' && !isFeedEntryFullyRevealed(entry))
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
    crypt: 'Crypt',
    court: 'Court',
    ritual: 'Ritual site',
    hazard: 'Danger',
    mystery: 'Unknown',
  }

  return labels[nodeType]
}

function normalizeOllamaBase(endpoint: string) {
  return endpoint.replace(/\/$/, '')
}

function normalizeOllamaGenerateEndpoint(endpoint: string) {
  return `${normalizeOllamaBase(endpoint)}/api/generate`
}

async function assertLocalModelAvailable(settings: LlmSettings) {
  const response = await fetch(`${normalizeOllamaBase(settings.endpoint)}/api/tags`)

  if (!response.ok) {
    throw new Error(`Ollama is reachable but returned ${response.status}. Start Ollama and try again.`)
  }

  const data = (await response.json()) as { models?: Array<{ name?: string }> }
  const modelNames = data.models?.map((model) => model.name).filter(Boolean) ?? []

  if (modelNames.length === 0) {
    throw new Error('Ollama is running, but no local models were found. Download a model before continuing.')
  }

  if (!modelNames.includes(settings.model)) {
    throw new Error(`Model "${settings.model}" is not installed. Available models: ${modelNames.join(', ')}.`)
  }
}

async function streamLocalText(settings: LlmSettings, prompt: string, onChunk: (chunk: string) => void) {
  const response = await fetch(normalizeOllamaGenerateEndpoint(settings.endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model,
      prompt,
      stream: true,
      options: { temperature: 0.68 },
    }),
  })

  if (!response.ok) {
    throw new Error(`Local model returned ${response.status}. The story cannot advance until the model is running.`)
  }

  if (!response.body) {
    const data = (await response.json()) as { response?: string }
    const text = data.response ?? ''
    onChunk(text)
    return text
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()

      if (!trimmed) {
        continue
      }

      const data = JSON.parse(trimmed) as { response?: string; done?: boolean }
      const chunk = data.response ?? ''

      if (chunk) {
        fullText += chunk
        onChunk(chunk)
      }
    }
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

function clampHealth(health: Health) {
  return { ...health, current: Math.min(health.max, Math.max(0, health.current)) }
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
  const unfinishedBusinessReason = getUnfinishedBusinessReason(state)

  if (unfinishedBusinessReason) {
    return unfinishedBusinessReason
  }

  if (state.outcome === 'won') {
    return 'The proof has been delivered; the hall now has to hear the dead by name.'
  }

  if (state.outcome === 'lost') {
    return 'Tamsin can go no farther; the dead keep walking under orders no one will admit giving.'
  }

  if (state.currentEvent?.objectiveNodeId) {
    const objectiveNode = getNode(state.currentEvent.objectiveNodeId)

    return `Resolve “${state.currentEvent.name}” and move toward ${objectiveNode.publicName}.`
  }

  if (state.currentEvent) {
    return `Resolve “${state.currentEvent.name}” before pushing deeper into the route.`
  }

  const goalNode = getNode(storySchema.goalNodeId)

  return `Find proof of the lich and return to ${goalNode.publicName}.`
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
  if (nodeId === state.currentNodeId) {
    return 'Tamsin is already here.'
  }

  if (state.player.health.current <= 0) {
    return 'Tamsin cannot travel while her health is gone.'
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
  if (choice.requiresItemId && !hasInventoryItem(state.player, choice.requiresItemId)) {
    const knownItem = [...state.player.inventory, graveSpade, graveAsh, ironNails, royalWrit, betterKnife, crackedSpearHead, bellClapper, boneCharm].find((item) => item.id === choice.requiresItemId)
    return `Requires ${knownItem?.name ?? 'a missing item'}.`
  }

  if (state.player.health.current <= 0) {
    return 'Tamsin cannot act while her health is gone.'
  }

  return undefined
}

function getAvailableChoices(state: CampaignState) {
  return state.currentEvent?.choices ?? []
}

function getChoiceVarietyWarnings(event: StoryEvent) {
  const modes = new Set(event.choices.map((choice) => choice.mode))
  const tones = new Set(event.choices.map((choice) => choice.tone))
  const warnings: string[] = []

  if (event.choices.length < 3) {
    warnings.push(`${event.name} has fewer than 3 authored options.`)
  }

  if (modes.size < Math.min(2, event.choices.length)) {
    warnings.push(`${event.name} options do not vary by action mode.`)
  }

  if (tones.size < Math.min(2, event.choices.length)) {
    warnings.push(`${event.name} options do not vary by tone.`)
  }

  return warnings
}

function describeEffect(effect: StoryEffect) {
  switch (effect.type) {
    case 'gainItem':
      return `Gain item: ${effect.item.name}`
    case 'loseItem':
      return `Lose item: ${effect.itemId}`
    case 'damage':
      return `Lose ${effect.amount} health: ${effect.reason}`
    case 'heal':
      return `Recover ${effect.amount} health: ${effect.reason}`
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

    if (effect.type === 'damage') {
      player = { ...player, health: clampHealth({ ...player.health, current: player.health.current - effect.amount }), memory: [...player.memory, effect.reason].slice(-8) }
    }

    if (effect.type === 'heal') {
      player = { ...player, health: clampHealth({ ...player.health, current: player.health.current + effect.amount }), memory: [...player.memory, effect.reason].slice(-8) }
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

  const outcome: CampaignState['outcome'] = player.health.current <= 0 ? 'lost' : currentNodeId === storySchema.goalNodeId && flags['proof-delivered'] ? 'won' : 'running'

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
    const matchingPlace = storySchema.nodes.find((node) => node.publicName.toLowerCase() === term.toLowerCase())
    const matchingPlaceIsKnown = matchingPlace ? state.exploredNodeIds.includes(matchingPlace.id) : false
    const matchingItem = state.player.inventory.find((item) => item.name.toLowerCase() === term.toLowerCase())
    addReference({ term, type: matchingPlaceIsKnown ? 'place' : matchingItem ? 'item' : 'term', targetId: matchingPlaceIsKnown ? matchingPlace?.id : matchingItem?.id })
  })

  return references.sort((a, b) => b.term.length - a.term.length)
}

function formatPlayerSheet(player: PlayableCharacter) {
  return `Name: ${player.name}
Role: ${player.role}
Health: ${player.health.current}/${player.health.max}
Visible inventory: ${player.inventory.filter((item) => item.visible).map((item) => item.name).join(', ') || 'None'}
Skill tags: ${player.skillTags.join(', ')}
Public presentation: ${player.voice.publicStyle}
Authorial constraints: fear of ${player.voice.fear}; wants ${player.voice.desire}; contradiction: ${player.voice.contradiction}
Origin: ${player.backstory.origin}
Wound: ${player.backstory.wound}
Known goal: ${player.backstory.want}
Private knowledge available to the player: ${player.backstory.privateKnowledge}
Recent known story facts: ${player.memory.slice(-5).join(' / ')}`
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
${flags.join(', ') || 'None.'}`
}

function formatSceneNpcs(npcs: StoryNpc[]) {
  if (npcs.length === 0) {
    return 'None.'
  }

  return npcs.map((npc) => `${npc.name} (${npc.role}): ${npc.description} Voice: ${npc.voice}. Wants: ${npc.want}. Knows: ${npc.knows}.`).join('\n')
}

function getOrCreateEventNpc(state: CampaignState, event: StoryEvent) {
  if (!event.npcTemplate) {
    return { storyNpcs: state.storyNpcs, sceneNpc: undefined }
  }

  const existingNpc = state.storyNpcs.find((npc) => npc.id === event.npcTemplate?.id)

  if (existingNpc) {
    return { storyNpcs: state.storyNpcs, sceneNpc: existingNpc }
  }

  const sceneNpc: StoryNpc = {
    ...event.npcTemplate,
    introducedByEventId: event.id,
    currentNodeId: state.currentNodeId,
    memory: [`Introduced during ${event.name}.`],
  }

  return { storyNpcs: [...state.storyNpcs, sceneNpc], sceneNpc }
}

const originalStoryRule = 'Do not name, quote, imitate, or allude to protected fictional settings, characters, authors, franchises, signature passages, or named external works. Use only this original schema and generic genre language.'
const playerAgencyRule = 'Do not write the player character’s private thoughts, feelings, doubts, motives, exact speech, or unchosen actions. Only frame, resolve, or respond to the selected option as stated.'

function buildSceneOpeningPrompt(state: CampaignState, event: StoryEvent) {
  const node = getNode(state.currentNodeId)
  const sceneNpcs = state.storyNpcs.filter((npc) => npc.currentNodeId === state.currentNodeId || npc.introducedByEventId === event.id)

  return `You are the narrator of an original literary interactive fiction scene.

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
- Short beats, one beat per line.
- Make the situation concrete and leave room for the player to choose from the authored options.
- Do not write dialogue for the player character.
- Do not decide the player's action.
- ${playerAgencyRule}
- Do not invent health, inventory, victory, loss, map movement, or hidden discoveries.
- If an NPC speaks, write the NPC's actual name followed by a colon. Never write the literal label "Name:".
- For fragile or quiet delivery, prefix that line with "[weak]", "[small]", or "[whisper]".
- Do not reveal hidden routes, future places, or event tables.
- ${originalStoryRule}`
}

function buildPlayerActionResolutionPrompt(state: CampaignState, event: StoryEvent, choice: StoryChoice, effects: StoryEffect[]) {
  const node = getNode(state.currentNodeId)

  return `Resolve the player's chosen action as original literary interactive fiction.

Current place: ${node.publicName}
Current scene: ${event.name}
Scene pressure: ${event.prompt}
Player character:
${formatPlayerSheet(state.player)}
Selected option:
Label: ${choice.label}
Mode: ${choice.mode}
Intent: ${choice.actionPrompt}
Writer intent: ${choice.writerIntent ?? 'Use only the selected option and authored consequence hint.'}
Tone: ${choice.tone}
Relevant skill color: ${choice.skillTags?.join(', ') || 'none'}
Authored consequence hint:
${choice.consequenceHint ?? 'Follow the current pressure and the hard effects below.'}
Hard state effects handled by code:
${effects.length > 0 ? effects.map(describeEffect).join('\n') : 'No mechanical state change.'}
Recent visible story:
${formatRecentFeed(state.feed)}
Compact story memory:
${formatCodexContext(state)}

Write visible prose only. No JSON. No markdown heading.
Rules:
- Resolve only the selected option.
- Short beats, one beat per line.
- Do not add unselected motives, regrets, memories, emotions, thoughts, or private conclusions for the player character.
- Do not write exact dialogue for the player character unless the selected option itself contains exact quoted words.
- If the selected option is conversational, summarize the communicated intent without inventing a full spoken line.
- ${playerAgencyRule}
- Do not invent additional health, inventory, map, victory, or loss changes beyond the hard effects listed above.
- If someone speaks, use their actual name followed by a colon. Never write the literal label "Name:".
- ${originalStoryRule}`
}

function buildNpcResponsePrompt(state: CampaignState, event: StoryEvent, npc: StoryNpc, choice: StoryChoice, resolutionText: string) {
  const node = getNode(state.currentNodeId)

  return `Write one visible NPC response in an original interactive fiction scene.

NPC: ${npc.name} (${npc.role})
Description: ${npc.description}
Voice: ${npc.voice}
Want: ${npc.want}
Knows: ${npc.knows}
Current place: ${node.publicName}
Scene: ${event.name} — ${event.prompt}
Selected option: ${choice.actionPrompt}
Resolution so far:
${resolutionText}
Compact story memory:
${formatCodexContext(state)}

Write only ${npc.name}'s visible response. No JSON. No markdown heading.
Rules:
- Short beats, one beat per line.
- Use ${npc.name}'s actual name followed by a colon. Never write the literal label "Name:".
- React to the selected option and the NPC's own want.
- Do not invent exact dialogue, private thoughts, motives, or additional actions for the player character.
- If the selected option was conversational, respond to its stated intent without adding new words the player character did not choose.
- ${playerAgencyRule}
- Do not invent health, inventory, map, victory, or loss changes.
- ${originalStoryRule}`
}

function StoryIcon({ id, label, className = '' }: { id: StoryIconId; label: string; className?: string }) {
  return (
    <span className={`inline-flex size-8 shrink-0 items-center justify-center border border-foreground bg-foreground ${className}`} aria-hidden="true">
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

function renderCodexText(
  text: string,
  references: CodexReference[],
  onOpenCodexNode: (nodeId: string) => void,
  onOpenCodexPerson: (personId: string) => void,
  onOpenCodexItem: (itemId: string) => void,
  onOpenCodex: () => void,
) {
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

    const openReference = () => {
      if (reference.type === 'place' && reference.targetId) {
        onOpenCodexNode(reference.targetId)
        return
      }

      if (reference.type === 'person' && reference.targetId) {
        onOpenCodexPerson(reference.targetId)
        return
      }

      if (reference.type === 'item' && reference.targetId) {
        onOpenCodexItem(reference.targetId)
        return
      }

      onOpenCodex()
    }

    return (
      <button key={`${part}-${index}`} type="button" className="inline cursor-pointer appearance-none border-0 bg-transparent p-0 align-baseline font-[inherit] italic leading-none text-foreground underline decoration-foreground underline-offset-2 transition-colors hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground" onClick={openReference}>
        {part}
      </button>
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
  onOpenCodexNode,
  onOpenCodexPerson,
  onOpenCodexItem,
  onOpenCodex,
}: {
  state: CampaignState
  onOpenCodexNode: (nodeId: string) => void
  onOpenCodexPerson: (personId: string) => void
  onOpenCodexItem: (itemId: string) => void
  onOpenCodex: () => void
}) {
  const references = getCodexReferences(state)

  return (
    <div className="iff-transcript border-0 p-0 shadow-none">
      <div className="font-serif text-base leading-8 tracking-normal text-foreground">
        {state.feed.map((entry) => (
          <FeedBlock key={entry.id} entry={entry} references={references} onOpenCodexNode={onOpenCodexNode} onOpenCodexPerson={onOpenCodexPerson} onOpenCodexItem={onOpenCodexItem} onOpenCodex={onOpenCodex} />
        ))}
      </div>
    </div>
  )
}

function FeedBlock({
  entry,
  references,
  onOpenCodexNode,
  onOpenCodexPerson,
  onOpenCodexItem,
  onOpenCodex,
}: {
  entry: FeedEntry
  references: CodexReference[]
  onOpenCodexNode: (nodeId: string) => void
  onOpenCodexPerson: (personId: string) => void
  onOpenCodexItem: (itemId: string) => void
  onOpenCodex: () => void
}) {
  const lines = splitFeedLines(entry.text).filter((line) => line.trim().length > 0)
  const isWaitingForLine = entry.revealMode === 'line-gated' && Boolean(entry.generatedText) && lines.length === 0

  if (lines.length === 0 && !entry.streaming && !isWaitingForLine) {
    return null
  }

  const renderedLines = lines.length > 0 ? lines : [entry.streaming ? 'The next passage is taking shape…' : 'Continue to reveal the next line.']
  return (
    <section className="iff-log-line mb-7 last:mb-0">
      {entry.kind === 'system' ? (
        <div className="my-6 flex items-center gap-3 font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Separator className="flex-1 bg-foreground" />
          <span>{entry.text}</span>
          <Separator className="flex-1 bg-foreground" />
        </div>
      ) : null}
      {entry.kind !== 'system' ? (
        <div className={entry.kind === 'action' ? 'border-l border-foreground pl-4' : ''}>
            {entry.kind === 'action' ? <p className="mb-2 font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Your choice</p> : null}
            {renderedLines.map((line, index) => {
              const styledLine = getVisualNovelLineStyle(line)
              const speakerMatch = styledLine.text.match(/^([^:]{2,32}):\s*(.+)$/)
              const displayedSpeaker = normalizeSpeakerLabel(entry.kind === 'dialogue' ? speakerMatch?.[1] ?? entry.speaker : speakerMatch?.[1], entry.speaker)
              const displayedText = speakerMatch ? speakerMatch[2] : styledLine.text
              const shouldShowSpeaker = entry.kind !== 'action' && displayedSpeaker && displayedSpeaker !== 'Narrator'

              return shouldShowSpeaker ? (
                <p key={`${entry.id}-line-${index}`} className={`mb-2 grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-3 whitespace-pre-wrap text-base leading-8 last:mb-0 ${styledLine.className}`}>
                  <span className="truncate font-sans text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{displayedSpeaker}</span>
                  <span>
                    {renderCodexText(displayedText, references, onOpenCodexNode, onOpenCodexPerson, onOpenCodexItem, onOpenCodex)}
                    {entry.streaming && index === renderedLines.length - 1 ? <span className="ml-1 animate-pulse font-sans text-foreground">▌</span> : null}
                  </span>
                </p>
              ) : (
                <p key={`${entry.id}-line-${index}`} className={`mb-2 whitespace-pre-wrap text-base leading-8 last:mb-0 ${entry.kind === 'action' && index === 0 ? 'font-medium text-foreground' : ''} ${entry.kind === 'action' && index > 0 ? 'font-serif text-muted-foreground' : ''} ${styledLine.className}`}>
                  <span>{renderCodexText(displayedText, references, onOpenCodexNode, onOpenCodexPerson, onOpenCodexItem, onOpenCodex)}</span>
                  {entry.streaming && index === renderedLines.length - 1 ? <span className="ml-1 animate-pulse font-sans text-foreground">▌</span> : null}
                </p>
              )
            })}
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

function normalizeMapPosition(node: StoryNode): [number, number, number] {
  const position = getNodePosition(node)

  return [(position.x - 300) / 38, (300 - position.y) / 38, 0]
}

function getNodeTypeColor(nodeType: StoryNodeType) {
  const colors: Record<StoryNodeType, string> = {
    origin: '#111111',
    settlement: '#111111',
    road: '#555555',
    wilds: '#111111',
    watch: '#111111',
    crypt: '#111111',
    court: '#111111',
    ritual: '#111111',
    hazard: '#111111',
    mystery: '#777777',
  }

  return colors[nodeType]
}

function getNodeTypeDescription(nodeType: StoryNodeType) {
  const descriptions: Record<StoryNodeType, string> = {
    origin: 'The known starting point of this route.',
    settlement: 'A lived-in place where social pressure, testimony, shelter, or supplies may matter.',
    road: 'A route node where travel, interception, delay, or discovery is likely.',
    wilds: 'An unsettled place where weather, terrain, animals, or isolation may matter.',
    watch: 'A vantage point where routes, warnings, records, or old advice may surface.',
    crypt: 'A buried or death-touched place where ritual pressure and danger are likely.',
    court: 'A place of authority, witness, judgment, or public consequence.',
    ritual: 'A place where symbols, rules, names, or sequence may matter.',
    hazard: 'A dangerous route where harm, obstruction, or ambush may happen.',
    mystery: 'An unknown place whose exact role is not yet clear.',
  }

  return descriptions[nodeType]
}

function getMapRenderModel(state: CampaignState, selectedNodeId: string) {
  const explored = new Set(state.exploredNodeIds)
  const adjacentTargets = getAdjacentTravelTargets(state)
  const visibleNodeIds = new Set([...state.exploredNodeIds, ...adjacentTargets.map((target) => target.node.id)])
  const selectedVisibleNodeId = visibleNodeIds.has(selectedNodeId) ? selectedNodeId : state.currentNodeId
  const visibleNodes = storySchema.nodes.filter((node) => visibleNodeIds.has(node.id))
  const nodes: MapRenderNode[] = visibleNodes.map((node) => {
    const isExplored = explored.has(node.id)
    const isCurrent = node.id === state.currentNodeId
    const travelDisabledReason = getTravelDisabledReason(state, node.id)

    return {
      id: node.id,
      label: isExplored || isCurrent ? node.publicName : 'Unexplored',
      description: isExplored ? node.description : getNodeTypeDescription(node.nodeType),
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
  const from = new THREE.Vector3(...edge.from)
  const to = new THREE.Vector3(...edge.to)
  const midpoint = from.clone().add(to).multiplyScalar(0.5)
  const delta = to.clone().sub(from)
  const length = delta.length()
  const rotationZ = -Math.atan2(delta.x, delta.y)

  return (
    <mesh position={midpoint} rotation={[0, 0, rotationZ]}>
      <cylinderGeometry args={[edge.blocked ? 0.035 : 0.025, edge.blocked ? 0.035 : 0.025, length, 8]} />
      <meshBasicMaterial color={edge.blocked ? '#111111' : edge.hidden ? '#999999' : '#111111'} />
    </mesh>
  )
}

function ThreeMapNode({
  node,
  onSelectNode,
  onTravelNode,
  onOpenCodex,
}: {
  node: MapRenderNode
  onSelectNode: (nodeId: string) => void
  onTravelNode: (nodeId: string) => void
  onOpenCodex: (nodeId: string) => void
}) {
  const color = node.explored || node.current ? getNodeTypeColor(node.nodeType) : '#777777'
  const disabledReasonId = `${node.id}-map-travel-reason`

  return (
    <group position={node.position} onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelectNode(node.id) }}>
      {node.current ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.54, 0.035, 12, 40]} />
          <meshBasicMaterial color="#111111" />
        </mesh>
      ) : null}
      {node.selected ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.72, 0.025, 12, 40]} />
          <meshBasicMaterial color="#111111" />
        </mesh>
      ) : null}
      {node.nodeType === 'watch' ? <CylinderGeometryNode color={color} /> : null}
      {node.nodeType === 'crypt' || node.nodeType === 'ritual' ? <OctahedronGeometryNode color={color} /> : null}
      {node.nodeType === 'hazard' ? <ConeGeometryNode color={color} /> : null}
      {node.nodeType === 'road' || node.nodeType === 'origin' ? <BoxGeometryNode color={color} /> : null}
      {node.nodeType === 'settlement' || node.nodeType === 'court' || node.nodeType === 'wilds' || node.nodeType === 'mystery' ? <SphereGeometryNode color={color} /> : null}
      <Html position={[0, 0.86, 0]} center style={{ pointerEvents: 'none', width: 'max-content' }}>
        <span className={`block whitespace-nowrap border bg-background px-2 py-1 font-sans text-[0.6rem] font-semibold uppercase tracking-[0.14em] ${node.explored || node.current ? 'border-foreground text-foreground' : 'border-muted-foreground text-muted-foreground'}`}>
          {node.label}
        </span>
      </Html>
      {node.selected ? (
        <Html position={[0, 1.48, 0]} center style={{ pointerEvents: 'auto', width: 'max-content' }}>
          <div role="dialog" aria-label={`${node.label} details`} className="w-56 max-w-[70vw] border border-foreground bg-background p-2.5 text-foreground shadow-none">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-sans text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Location</p>
                <h3 className="mt-1 truncate font-serif text-base leading-tight">{node.label}</h3>
              </div>
              <MapNodeTypeBadge nodeType={node.nodeType} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {node.current ? <Badge variant="secondary">current location</Badge> : null}
              {!node.explored ? <Badge variant="secondary">unexplored</Badge> : null}
            </div>
            <p className="mt-2 font-serif text-xs leading-5 text-muted-foreground">{node.description}</p>
            <div className="mt-2 flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                disabled={Boolean(node.travelDisabledReason)}
                title={node.travelDisabledReason}
                aria-describedby={node.travelDisabledReason ? disabledReasonId : undefined}
                onClick={(event) => {
                  event.stopPropagation()
                  onTravelNode(node.id)
                }}
              >
                {node.explored ? 'Travel here' : 'Explore this route'}
              </Button>
              {node.travelDisabledReason && !node.current ? <p id={disabledReasonId} className="font-serif text-xs leading-5 text-muted-foreground">{node.travelDisabledReason}</p> : null}
              {node.explored ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenCodex(node.id)
                  }}
                >
                  Open in journal
                </Button>
              ) : null}
            </div>
          </div>
        </Html>
      ) : null}
    </group>
  )
}

function SphereGeometryNode({ color }: { color: string }) {
  return (
    <mesh>
      <sphereGeometry args={[0.34, 24, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function BoxGeometryNode({ color }: { color: string }) {
  return (
    <mesh>
      <boxGeometry args={[0.72, 0.34, 0.3]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function ConeGeometryNode({ color }: { color: string }) {
  return (
    <mesh rotation={[0, 0, Math.PI]}>
      <coneGeometry args={[0.38, 0.72, 5]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function CylinderGeometryNode({ color }: { color: string }) {
  return (
    <mesh>
      <cylinderGeometry args={[0.26, 0.34, 0.78, 10]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function OctahedronGeometryNode({ color }: { color: string }) {
  return (
    <mesh>
      <octahedronGeometry args={[0.43, 0]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function ThreeMapScene({
  model,
  onSelectNode,
  onTravelNode,
  onOpenCodex,
}: {
  model: ReturnType<typeof getMapRenderModel>
  onSelectNode: (nodeId: string) => void
  onTravelNode: (nodeId: string) => void
  onOpenCodex: (nodeId: string) => void
}) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[0, 0, 8]} intensity={2.2} />
      {model.edges.map((edge) => <ThreeMapEdge key={edge.id} edge={edge} />)}
      {model.nodes.map((node) => <ThreeMapNode key={node.id} node={node} onSelectNode={onSelectNode} onTravelNode={onTravelNode} onOpenCodex={onOpenCodex} />)}
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
  onTravelNode,
  onOpenCodex,
}: {
  state: CampaignState
  selectedNodeId: string
  onSelectNode: (nodeId: string) => void
  onTravelNode: (nodeId: string) => void
  onOpenCodex: (nodeId: string) => void
}) {
  const model = getMapRenderModel(state, selectedNodeId)

  return (
    <Card className="iff-chrome-panel min-h-0 flex-1 overflow-hidden py-0 lg:h-full">
      <CardContent className="min-h-0 flex-1 p-0">
        <h2 className="sr-only">Route atlas</h2>
        <p className="sr-only">Trace known roads and select a marked place for its details.</p>
        <div className="relative h-[min(72svh,760px)] min-h-[420px] overflow-hidden border border-foreground bg-background lg:h-full" aria-label="Interactive route atlas">
          <Canvas orthographic camera={{ position: [0, 0, 12], zoom: 44 }}>
            <color attach="background" args={['#ffffff']} />
            <ThreeMapScene model={model} onSelectNode={onSelectNode} onTravelNode={onTravelNode} onOpenCodex={onOpenCodex} />
          </Canvas>
        </div>
      </CardContent>
    </Card>
  )
}

function PlayerPanel({ state, currentObjective }: { state: CampaignState; currentObjective: string }) {
  const player = state.player
  const activeNpcId = state.currentEvent?.npcTemplate?.id
  const healthPercent = Math.max(0, Math.min(100, Math.round((player.health.current / player.health.max) * 100)))
  const visibleInventory = player.inventory.filter((item) => item.visible)

  return (
    <Card className="iff-chrome-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">{player.name}</CardTitle>
        <CardDescription className="font-serif">{player.role}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <section className="border-t border-foreground pt-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Health</h3>
            <p className="font-serif text-sm text-muted-foreground">
              {player.health.current} / {player.health.max}
            </p>
          </div>
          <div className="mt-2 h-2 border border-foreground bg-background" aria-label={`Health ${player.health.current} of ${player.health.max}`}>
            <div className="h-full bg-foreground transition-all duration-300 ease-out" style={{ width: `${healthPercent}%` }} />
          </div>
        </section>

        <section className="border-t border-foreground pt-3" aria-live="polite">
          <h3 className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Objective</h3>
          <p className="mt-1 font-serif text-sm leading-6 text-foreground">{currentObjective}</p>
        </section>

        <section className="border-t border-foreground pt-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Inventory</h3>
            <span className="font-sans text-xs text-muted-foreground">{visibleInventory.length} carried</span>
          </div>
          <ul className="mt-2 list-inside list-disc font-serif text-sm leading-6 text-muted-foreground">
            {visibleInventory.map((item) => <li key={item.id} title={item.description}>{item.name}</li>)}
          </ul>
        </section>

        <section className="border-t border-foreground pt-3">
          <h3 className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Story so far</h3>
          <p className="mt-1 font-serif text-sm leading-6 text-muted-foreground">{player.memory[player.memory.length - 1]}</p>
        </section>

        {state.storyNpcs.length > 0 ? (
          <section className="flex flex-col gap-2 border-t border-foreground pt-3">
            <h3 className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Known figures</h3>
            {state.storyNpcs.map((npc) => {
              const isInScene = npc.id === activeNpcId

              return (
                <div key={npc.id} data-scene-state={isInScene ? 'present' : 'away'} className="border-l border-foreground pl-3 data-[scene-state=away]:opacity-65">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{npc.name}</p>
                    {isInScene ? <span className="font-sans text-xs text-muted-foreground">nearby</span> : null}
                  </div>
                  <p className="mt-1 font-serif text-sm leading-6 text-muted-foreground">{npc.description}</p>
                </div>
              )
            })}
          </section>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ChoicePanel({
  state,
  isAdvancing,
  activeLineGatedEntry,
  onBeginScene,
  onChoose,
  onContinue,
}: {
  state: CampaignState
  isAdvancing: boolean
  activeLineGatedEntry?: FeedEntry
  onBeginScene: () => void
  onChoose: (choice: StoryChoice) => void
  onContinue: () => void
}) {
  if (activeLineGatedEntry) {
    const canContinue = hasUnrevealedLines(activeLineGatedEntry)

    return (
      <Card className="iff-chrome-panel">
        <CardContent className="py-4">
          <Button type="button" size="lg" onClick={onContinue} disabled={!canContinue} className="w-full font-serif text-base">
            {canContinue ? 'Turn the page' : 'Setting the next line…'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (state.outcome !== 'running') {
    return null
  }

  if (!state.sceneOpened || !state.currentEvent) {
    return (
      <Card className="iff-chrome-panel">
        <CardContent className="py-4">
          <Button type="button" size="lg" onClick={onBeginScene} disabled={isAdvancing} className="w-full font-serif text-base">
            <PlayIcon data-icon="inline-start" />
            {isAdvancing ? 'Preparing the scene…' : 'Begin scene'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const choices = getAvailableChoices(state)
  const currentEvent = state.currentEvent

  return (
    <Card className="iff-chrome-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl">Next</CardTitle>
        <CardDescription className="font-serif">{currentEvent?.prompt}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {choices.map((choice) => {
          const disabledReason = getChoiceDisabledReason(state, choice)
          const disabled = Boolean(disabledReason) || isAdvancing
          const summaryId = `${choice.id}-summary`
          const disabledId = `${choice.id}-disabled-reason`
          const describedBy = [choice.optionSummary ? summaryId : undefined, disabledReason ? disabledId : undefined].filter(Boolean).join(' ') || undefined

          return (
            <Button key={choice.id} type="button" variant="outline" disabled={disabled} title={disabledReason ?? choice.consequenceHint ?? choice.optionSummary ?? choice.label} aria-describedby={describedBy} className="iff-choice-card h-auto w-full justify-start whitespace-normal px-4 py-4 text-left font-serif shadow-none disabled:hover:bg-background disabled:hover:text-foreground" onClick={() => onChoose(choice)}>
              <span className="grid w-full gap-2">
                <span className="font-medium leading-6 text-foreground group-hover/button:text-background">{choice.label}</span>
                {choice.optionSummary ? <span id={summaryId} className="font-serif text-sm font-normal leading-6 text-muted-foreground">{choice.optionSummary}</span> : null}
                {choice.consequenceHint ? <span className="border-t border-foreground pt-2 font-serif text-xs font-normal leading-5 text-muted-foreground">{choice.consequenceHint}</span> : null}
                {disabledReason ? <span id={disabledId} className="font-sans text-xs font-medium text-muted-foreground">{disabledReason}</span> : null}
              </span>
            </Button>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ItemTagBadge({ tag }: { tag: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const definition = itemTagDefinitions[tag] ?? {
    label: tag,
    summary: 'A notable quality of this item.',
    detail: 'Its usefulness depends on the choices available in the current scene.',
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="inline-flex items-center border border-foreground px-2.5 py-0.5 font-sans text-xs font-semibold capitalize text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
        title={`${definition.summary} ${definition.detail}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        {definition.label}
      </button>
      {isOpen ? (
        <span className="absolute left-0 top-full z-20 mt-2 w-72 border border-foreground bg-popover p-3 text-left text-popover-foreground shadow-none">
          <span className="block font-sans text-xs font-semibold uppercase tracking-[0.12em]">{definition.label}</span>
          <span className="mt-1 block font-serif text-sm leading-6 text-muted-foreground">{definition.summary}</span>
          <span className="mt-2 block font-serif text-sm leading-6">{definition.detail}</span>
        </span>
      ) : null}
    </span>
  )
}

function CodexPanel({
  state,
  section,
  selectedNodeId,
  selectedPersonId,
  selectedItemId,
  onSelectSection,
  onSelectNode,
  onSelectPerson,
  onSelectItem,
  onOpenMap,
}: {
  state: CampaignState
  section: CodexSection
  selectedNodeId: string
  selectedPersonId: string
  selectedItemId?: string
  onSelectSection: (section: CodexSection) => void
  onSelectNode: (nodeId: string) => void
  onSelectPerson: (personId: string) => void
  onSelectItem: (itemId: string) => void
  onOpenMap: (nodeId: string) => void
}) {
  const exploredNodes = state.exploredNodeIds.map(getNode)
  const selectedNode = exploredNodes.find((node) => node.id === selectedNodeId) ?? exploredNodes[0]
  const selectedNpc = state.storyNpcs.find((npc) => npc.id === selectedPersonId)
  const selectedItem = state.player.inventory.find((item) => item.id === selectedItemId) ?? state.player.inventory[0]
  return (
    <Card className="iff-chrome-panel min-h-0 lg:h-full">
      <CardHeader className="shrink-0">
        <CardTitle className="text-2xl">Journal</CardTitle>
        <CardDescription className="font-serif">People, places, and keepsakes Tamsin has learned to trust.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-h-0 flex-1 items-stretch gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 max-h-[min(70svh,560px)] flex-col gap-3 border border-foreground bg-background p-4 lg:max-h-none">
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" variant={section === 'people' ? 'secondary' : 'outline'} onClick={() => onSelectSection('people')}>
              People
            </Button>
            <Button type="button" variant={section === 'places' ? 'secondary' : 'outline'} onClick={() => onSelectSection('places')}>
              Places
            </Button>
            <Button type="button" variant={section === 'inventory' ? 'secondary' : 'outline'} onClick={() => onSelectSection('inventory')}>
              Items
            </Button>
          </div>
          <Separator />
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {section === 'people' ? (
              <>
                <Button type="button" variant={selectedPersonId === state.player.id ? 'secondary' : 'outline'} className="justify-start" onClick={() => onSelectPerson(state.player.id)}>
                  {state.player.name}
                </Button>
                {state.storyNpcs.map((npc) => (
                  <Button key={npc.id} type="button" variant={selectedPersonId === npc.id ? 'secondary' : 'outline'} className="justify-start" onClick={() => onSelectPerson(npc.id)}>
                    {npc.name}
                  </Button>
                ))}
              </>
            ) : null}
            {section === 'places'
              ? exploredNodes.map((node) => (
                  <Button key={node.id} type="button" variant={selectedNode.id === node.id ? 'secondary' : 'outline'} className="justify-start" onClick={() => onSelectNode(node.id)}>
                    {node.publicName}
                  </Button>
                ))
              : null}
            {section === 'inventory'
              ? state.player.inventory.filter((item) => item.visible).map((item) => (
                  <Button key={item.id} type="button" variant={selectedItem?.id === item.id ? 'secondary' : 'outline'} className="justify-start" onClick={() => onSelectItem(item.id)}>
                    {item.name}
                  </Button>
                ))
              : null}
          </div>
        </aside>

        <section className="flex min-h-0 max-h-[min(70svh,560px)] flex-col gap-4 overflow-y-auto border border-foreground bg-background p-5 lg:max-h-none">
          {section === 'people' && selectedPersonId === state.player.id ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-24 w-[4.5rem] items-center justify-center overflow-hidden border border-foreground bg-background">
                  <img src={state.player.portraitAsset} alt="" className="h-full w-full object-cover" />
                </span>
                <div>
                  <h4 className="text-xl font-semibold">{state.player.name}</h4>
                  <p className="text-sm text-muted-foreground">{state.player.role}</p>
                  <Badge className="mt-2" variant="secondary">
                    Health {state.player.health.current}/{state.player.health.max}
                  </Badge>
                </div>
              </div>
              <div className="font-serif text-sm leading-6 text-muted-foreground">
                <p>{state.player.backstory.origin}</p>
                <p className="mt-2">{state.player.backstory.wound}</p>
                <p className="mt-2">{state.player.backstory.want}</p>
              </div>
              <div>
                <h5 className="text-sm font-medium">Strengths</h5>
                <div className="mt-2 flex flex-wrap gap-2">
                  {state.player.skillTags.map((skill) => (
                    <Badge key={skill} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h5 className="text-sm font-medium">Story so far</h5>
                <ul className="mt-2 flex flex-col gap-2 font-serif text-sm leading-6 text-muted-foreground">
                  {state.player.memory.map((memory) => (
                    <li key={memory}>{memory}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {section === 'people' && selectedNpc ? (
            <div className="flex flex-col gap-4">
              <div>
                <h4 className="text-xl font-semibold">{selectedNpc.name}</h4>
                <p className="text-sm text-muted-foreground">{selectedNpc.role}</p>
              </div>
              <p className="font-serif text-sm leading-6 text-muted-foreground">{selectedNpc.description}</p>
              <div>
                <h5 className="text-sm font-medium">Story so far</h5>
                <ul className="mt-2 flex flex-col gap-2 font-serif text-sm leading-6 text-muted-foreground">
                  {selectedNpc.memory.map((memory) => (
                    <li key={memory}>{memory}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {section === 'places' ? (
            <div>
              <div className="flex items-start gap-3">
                <StoryIcon id={selectedNode.iconAssetId} label={selectedNode.publicName} className="size-8" />
                <div>
                  <h4 className="text-lg font-semibold">{selectedNode.publicName}</h4>
                  {selectedNode.id === state.currentNodeId ? (
                    <Badge className="mt-2" variant="secondary">
                      current location
                    </Badge>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 font-serif text-sm leading-6 text-muted-foreground">{selectedNode.description}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => onOpenMap(selectedNode.id)}>
                Show on map
              </Button>
            </div>
          ) : null}

          {section === 'inventory' && selectedItem ? (
            <div>
              <h4 className="text-xl font-semibold">{selectedItem.name}</h4>
              <p className="mt-3 font-serif text-sm leading-6 text-muted-foreground">{selectedItem.description}</p>
              {selectedItem.tags && selectedItem.tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedItem.tags.map((tag) => <ItemTagBadge key={tag} tag={tag} />)}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
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
              <article key={entry.id} className="border border-foreground bg-muted p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Badge variant="outline">{entry.label ?? 'Trace'}</Badge>
                  <span className="text-xs text-muted-foreground">Turn {entry.turn}</span>
                </div>
                <p className="whitespace-pre-wrap font-serif text-sm leading-6 text-muted-foreground">
                  {entry.text}
                  {entry.streaming ? <span className="ml-1 animate-pulse font-sans text-foreground">▌</span> : null}
                </p>
              </article>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function App() {
  const [campaign, setCampaign] = useState(initialState)
  const [llmSettings, setLlmSettings] = useState(defaultLlmSettings)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [currentView, setCurrentView] = useState<AppView>('story')
  const [codexSection, setCodexSection] = useState<CodexSection>('people')
  const [selectedNodeId, setSelectedNodeId] = useState(initialState.currentNodeId)
  const [selectedPersonId, setSelectedPersonId] = useState(initialState.player.id)
  const [selectedItemId, setSelectedItemId] = useState(initialState.player.inventory[0]?.id)
  const [llmError, setLlmError] = useState<string | undefined>()
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null)
  const currentNode = useMemo(() => getNode(campaign.currentNodeId), [campaign.currentNodeId])
  const currentObjective = useMemo(() => getCurrentObjective(campaign), [campaign])
  const activeLineGatedEntry = useMemo(() => getActiveLineGatedEntry(campaign), [campaign])

  const scrollStoryToEnd = (behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      scrollAnchorRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : behavior, block: 'end' })
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
    let pendingLine = ''
    const appendGeneratedText = (text: string) => {
      updateFeedEntry(entryId, (entry) => {
        const generatedText = `${entry.generatedText ?? entry.text}${text}`
        const generatedLineCount = splitFeedLines(generatedText).length
        const shouldAutoRevealFirstLine = entry.revealMode === 'line-gated' && (entry.revealedLineCount ?? 0) === 0 && generatedLineCount > 0
        const revealedLineCount = entry.revealMode === 'line-gated' ? shouldAutoRevealFirstLine ? 1 : entry.revealedLineCount ?? 0 : generatedLineCount
        const nextEntry = { ...entry, generatedText, revealedLineCount }

        return { ...nextEntry, text: getRevealedFeedText(nextEntry, revealedLineCount) }
      })
    }
    const fullText = await streamLocalText(llmSettings, prompt, (chunk) => {
      pendingLine += chunk
      const lines = pendingLine.split('\n')
      pendingLine = lines.pop() ?? ''

      if (lines.length > 0) {
        appendGeneratedText(`${lines.join('\n')}\n`)
      }
    })

    if (pendingLine.trim().length > 0) {
      appendGeneratedText(pendingLine)
    }

    return fullText
  }

  const advanceFeedLine = () => {
    const entryId = getActiveLineGatedEntry(campaign)?.id

    if (!entryId) {
      return
    }

    updateFeedEntry(entryId, (entry) => {
      const nextRevealedLineCount = Math.min((entry.revealedLineCount ?? 0) + 1, getFeedLineCount(entry))
      const nextEntry = { ...entry, revealedLineCount: nextRevealedLineCount }

      return { ...nextEntry, text: getRevealedFeedText(nextEntry, nextRevealedLineCount) }
    })
  }

  const appendDebugEntry = (entry: Omit<DebugEntry, 'id'>) => {
    const id = createId('debug')
    setCampaign((state) => ({ ...state, debugFeed: [...state.debugFeed, { id, ...entry }] }))
    return id
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

      const turn = stateAtStart.turn
      const event = stateAtStart.currentEvent ?? drawStoryEvent(stateAtStart)
      const node = getNode(stateAtStart.currentNodeId)
      const { storyNpcs } = getOrCreateEventNpc(stateAtStart, event)
      const sceneState = {
        ...stateAtStart,
        currentEvent: event,
        sceneOpened: true,
        storyNpcs,
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
          { id: createId('scene'), turn, kind: 'system', speaker: 'Scene', nodeId: node.id, eventId: event.id, text: event.name },
          { id: currentNarratorEntryId, turn, kind: 'narration', speaker: 'Narrator', nodeId: node.id, eventId: event.id, text: '', generatedText: '', revealedLineCount: 0, revealMode: 'line-gated', streaming: true },
        ],
        debugFeed: state.debugFeed,
      }))
      scrollStoryToEnd('smooth')

      const prompt = buildSceneOpeningPrompt(sceneState, event)
      appendDebugEntry({ turn, label: 'Scene opening prompt', text: prompt })
      const varietyWarnings = getChoiceVarietyWarnings(event)
      if (varietyWarnings.length > 0) {
        appendDebugEntry({ turn, label: 'Choice variety warnings', text: varietyWarnings.join('\n') })
      }

      await streamFeedEntry(currentNarratorEntryId, prompt)
      updateFeedEntry(currentNarratorEntryId, (entry) => ({ ...entry, streaming: false }))
    } catch (error) {
      if (narratorEntryId) {
        updateFeedEntry(narratorEntryId, (entry) => ({ ...entry, streaming: false }))
      }
      setLlmError(error instanceof Error ? error.message : 'The local model is not available. Start it before continuing.')
    } finally {
      setIsAdvancing(false)
    }
  }

  const travelToNode = async (nodeId: string) => {
    if (isAdvancing || campaign.outcome !== 'running' || getActiveLineGatedEntry(campaign)) {
      return
    }

    const disabledReason = getTravelDisabledReason(campaign, nodeId)
    const destination = getNode(nodeId)

    if (disabledReason) {
      appendFeedEntry({ turn: campaign.turn, kind: 'system', speaker: 'Map', nodeId: campaign.currentNodeId, text: disabledReason })
      return
    }

    const wasExplored = campaign.exploredNodeIds.includes(nodeId)
    const travelledState: CampaignState = {
      ...campaign,
      currentNodeId: nodeId,
      currentEvent: undefined,
      sceneOpened: false,
      exploredNodeIds: wasExplored ? campaign.exploredNodeIds : [...campaign.exploredNodeIds, nodeId],
      storyNpcs: campaign.storyNpcs.map((npc) => ({ ...npc, currentNodeId: nodeId })),
    }

    setSelectedNodeId(nodeId)
    setCurrentView('story')
    await openSceneFromState(travelledState, [{ turn: campaign.turn, kind: 'system', speaker: 'Map', nodeId, text: wasExplored ? `Travelled to ${destination.publicName}.` : `Discovered ${destination.publicName}.` }])
  }

  const beginScene = async () => {
    if (isAdvancing || campaign.outcome !== 'running') {
      return
    }

    await openSceneFromState(campaign)
  }

  const chooseAction = async (choice: StoryChoice) => {
    if (isAdvancing || campaign.outcome !== 'running' || !campaign.currentEvent || getChoiceDisabledReason(campaign, choice)) {
      return
    }

    setIsAdvancing(true)
    setLlmError(undefined)

    try {
      await assertLocalModelAvailable(llmSettings)

      const stateAtStart = campaign
      const turn = stateAtStart.turn
      const event = stateAtStart.currentEvent
      if (!event) {
        return
      }
      const node = getNode(stateAtStart.currentNodeId)
      const sceneNpc = event.npcTemplate ? stateAtStart.storyNpcs.find((npc) => npc.id === event.npcTemplate?.id) : undefined
      const effects = choice.effects ?? []

      appendFeedEntry({
        turn,
        kind: 'action',
        speaker: 'Your choice',
        nodeId: node.id,
        eventId: event.id,
        text: choice.optionSummary ? `${choice.label}\n${choice.optionSummary}` : choice.label,
      })
      appendDebugEntry({
        turn,
        label: 'Selected choice',
        text: `${choice.label}\nMode: ${choice.mode}\nTone: ${choice.tone}\nWriter intent: ${choice.writerIntent ?? 'None provided.'}\n\nEffects:\n${effects.map(describeEffect).join('\n') || 'No mechanical effects.'}`,
      })

      const resolutionPrompt = buildPlayerActionResolutionPrompt(stateAtStart, event, choice, effects)
      appendDebugEntry({ turn, label: 'Resolution prompt', text: resolutionPrompt })
      const resolutionEntryId = appendFeedEntry({ turn, kind: 'narration', speaker: 'Narrator', nodeId: node.id, eventId: event.id, text: '', generatedText: '', revealedLineCount: 0, revealMode: 'line-gated', streaming: true })
      const resolutionText = await streamFeedEntry(resolutionEntryId, resolutionPrompt)
      updateFeedEntry(resolutionEntryId, (entry) => ({ ...entry, streaming: false }))

      let updatedStoryNpcs = stateAtStart.storyNpcs
      if (sceneNpc) {
        const npcPrompt = buildNpcResponsePrompt(stateAtStart, event, sceneNpc, choice, resolutionText)
        appendDebugEntry({ turn, label: 'NPC prompt', text: npcPrompt })
        const npcEntryId = appendFeedEntry({ turn, kind: 'dialogue', speaker: sceneNpc.name, nodeId: node.id, eventId: event.id, text: '', generatedText: '', revealedLineCount: 0, revealMode: 'line-gated', streaming: true })
        const npcTurn = await streamFeedEntry(npcEntryId, npcPrompt)
        updateFeedEntry(npcEntryId, (entry) => ({ ...entry, streaming: false }))
        updatedStoryNpcs = stateAtStart.storyNpcs.map((npc) => (npc.id === sceneNpc.id ? { ...npc, memory: [...npc.memory, npcTurn].slice(-8) } : npc))
      }

      const appliedState = applyStoryEffects({ ...stateAtStart, storyNpcs: updatedStoryNpcs }, effects)
      const nextTurn = turn + 1
      const outOfTime = nextTurn > storySchema.maxTurns && appliedState.outcome === 'running'
      const outcome: CampaignState['outcome'] = outOfTime ? 'lost' : appliedState.outcome

      setSelectedNodeId(appliedState.currentNodeId)
      if (!appliedState.player.inventory.some((item) => item.id === selectedItemId)) {
        setSelectedItemId(appliedState.player.inventory[0]?.id)
      }

      setCampaign((state) => ({
        ...appliedState,
        feed: state.feed,
        debugFeed: state.debugFeed,
        storyNpcs: appliedState.storyNpcs.map((npc) => ({ ...npc, currentNodeId: appliedState.currentNodeId })),
        turn: nextTurn,
        currentEvent: undefined,
        sceneOpened: false,
        outcome,
      }))

      appendDebugEntry({ turn, label: 'Applied effects', text: effects.map(describeEffect).join('\n') || 'No mechanical effects.' })

      if (outcome !== 'running') {
        const outcomeText = outcome === 'won' ? 'The proof has been delivered. The dead have names again, and the hall has to hear them.' : 'Tamsin can go no farther. Somewhere ahead, the dead keep walking under orders no living mouth will admit giving.'
        appendFeedEntry({
          turn: nextTurn,
          kind: 'narration',
          speaker: 'Narrator',
          nodeId: appliedState.currentNodeId,
          text: '',
          generatedText: outcomeText,
          revealedLineCount: 0,
          revealMode: 'line-gated',
        })
      }
    } catch (error) {
      setLlmError(error instanceof Error ? error.message : 'The local model is not available. Start it before continuing.')
    } finally {
      setIsAdvancing(false)
    }
  }

  const resetCampaign = () => {
    setLlmError(undefined)
    setCodexSection('people')
    setSelectedNodeId(initialState.currentNodeId)
    setSelectedPersonId(initialState.player.id)
    setSelectedItemId(initialState.player.inventory[0]?.id)
    setCampaign(initialState)
  }

  const openMapNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    setCurrentView('map')
  }

  const openCodexNode = (nodeId: string) => {
    setCodexSection('places')
    setSelectedNodeId(nodeId)
    setCurrentView('codex')
  }

  const openCodexPerson = (personId: string) => {
    setCodexSection('people')
    setSelectedPersonId(personId)
    setCurrentView('codex')
  }

  const openCodexItem = (itemId: string) => {
    setCodexSection('inventory')
    setSelectedItemId(itemId)
    setCurrentView('codex')
  }

  const openCodex = () => {
    setCurrentView('codex')
  }

  return (
    <main className="iff-app-shell min-h-svh text-foreground lg:h-svh lg:overflow-hidden">
      <div className="mx-auto grid w-full max-w-[1180px] gap-6 px-4 py-6 lg:h-full lg:min-h-0 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
          <Card className="iff-chrome-panel">
            <CardHeader className="pb-2">
              <div className="min-w-0">
                <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Table of contents</p>
                <CardTitle className="mt-1 text-2xl leading-tight">{storySchema.title}</CardTitle>
                <CardDescription className="mt-2 font-serif">Now at {currentNode.publicName}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <nav aria-label="Primary">
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['story', 'Story'],
                    ['map', 'Map'],
                    ['codex', 'Journal'],
                    ['settings', 'Options'],
                  ] as Array<[AppView, string]>).map(([view, label]) => {
                    const isCurrentView = currentView === view

                    return (
                      <Button key={view} type="button" variant={isCurrentView ? 'default' : 'outline'} aria-current={isCurrentView ? 'page' : undefined} className="justify-start gap-2" onClick={() => setCurrentView(view)}>
                        <span className={`size-1.5 border border-current ${isCurrentView ? 'bg-current' : 'bg-transparent'}`} />
                        {label}
                      </Button>
                    )
                  })}
                </div>
              </nav>
            </CardContent>
          </Card>

          <PlayerPanel state={campaign} currentObjective={currentObjective} />
        </aside>

        <section className="flex min-h-0 flex-col gap-4 lg:h-full lg:overflow-hidden">
          {currentView === 'story' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              {llmError ? (
                <Alert variant="destructive" className="iff-chrome-panel">
                  <AlertCircleIcon />
                  <AlertTitle>The next passage could not be prepared</AlertTitle>
                  <AlertDescription className="font-serif">Open Options if you want to inspect diagnostics, then try again.</AlertDescription>
                </Alert>
              ) : null}

              <Card className="iff-stage-card min-h-0 flex-1">
                <CardHeader className="shrink-0 border-b border-foreground pb-4">
                  <div className="min-w-0">
                    <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Current location</p>
                    <CardTitle className="mt-1 text-3xl leading-tight">{currentNode.publicName}</CardTitle>
                    <CardDescription className="mt-2 max-w-3xl font-serif text-base leading-7">{currentNode.description}</CardDescription>
                  </div>
                </CardHeader>
                <aside className="iff-objective-card border-b border-foreground bg-muted px-4 py-3 font-serif text-sm leading-6" aria-live="polite">
                  <span className="mr-2 font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Objective</span>
                  {currentObjective}
                </aside>
                <CardContent className="min-h-0 flex-1 p-0">
                  <ScrollArea className="h-[min(58svh,620px)] min-h-0 lg:h-full">
                    <div className="p-4 lg:p-6">
                      <StoryTranscript state={campaign} onOpenCodexNode={openCodexNode} onOpenCodexPerson={openCodexPerson} onOpenCodexItem={openCodexItem} onOpenCodex={openCodex} />
                      <div ref={scrollAnchorRef} />
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <div className="shrink-0 lg:max-h-[38svh] lg:overflow-y-auto">
                <ChoicePanel state={campaign} isAdvancing={isAdvancing} activeLineGatedEntry={activeLineGatedEntry} onBeginScene={beginScene} onChoose={chooseAction} onContinue={advanceFeedLine} />
              </div>
            </div>
          ) : null}

          {currentView === 'map' ? <MapGraphView state={campaign} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} onTravelNode={travelToNode} onOpenCodex={openCodexNode} /> : null}

          {currentView === 'codex' ? (
            <CodexPanel
              state={campaign}
              section={codexSection}
              selectedNodeId={selectedNodeId}
              selectedPersonId={selectedPersonId}
              selectedItemId={selectedItemId}
              onSelectSection={setCodexSection}
              onSelectNode={setSelectedNodeId}
              onSelectPerson={setSelectedPersonId}
              onSelectItem={setSelectedItemId}
              onOpenMap={openMapNode}
            />
          ) : null}

          {currentView === 'settings' ? (
            <div className="min-h-0 overflow-y-auto">
              <Card className="iff-chrome-panel">
                <CardHeader>
                  <CardTitle>Options</CardTitle>
                  <CardDescription className="font-serif">Manage the session. Technical details stay tucked away.</CardDescription>
                </CardHeader>
                <CardContent className="flex max-w-2xl flex-col gap-4">
                  <section className="border border-foreground bg-background p-4">
                    <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Session</p>
                    <p className="mt-2 font-serif text-sm leading-6 text-muted-foreground">Restart the adventure from the beginning whenever you want a clean road.</p>
                    <Button type="button" variant="outline" className="mt-3" onClick={resetCampaign} disabled={isAdvancing}>
                      <RotateCcwIcon data-icon="inline-start" />
                      Reset story
                    </Button>
                  </section>

                  <Separator />

                  <Button type="button" variant="ghost" className="justify-between" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((value) => !value)}>
                    Advanced diagnostics
                    <span className="text-xs text-muted-foreground">{advancedOpen ? 'Hide' : 'Show'}</span>
                  </Button>

                  {advancedOpen ? (
                    <section className="flex flex-col gap-3 border border-foreground bg-background p-4">
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Service endpoint
                        <Input value={llmSettings.endpoint} onChange={(event) => setLlmSettings((settings) => ({ ...settings, endpoint: event.target.value }))} />
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Runtime model
                        <Input value={llmSettings.model} onChange={(event) => setLlmSettings((settings) => ({ ...settings, model: event.target.value }))} />
                      </label>
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
                  ) : null}
                </CardContent>
              </Card>

              {advancedOpen && debugMode ? <DebugPanel entries={campaign.debugFeed} /> : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}

export default App
