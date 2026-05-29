import { useMemo, useRef, useState } from 'react'
import { AlertCircleIcon, EyeIcon, PlayIcon, RotateCcwIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

type CharacterBackground = {
  storyRole: string
  home: string
  want: string
  weakness: string
  closeTie: string
  privateKnowledge: string
  decisionJob: string
}

type CharacterStats = {
  body: number
  wits: number
  heart: number
}

type Character = {
  id: string
  name: string
  role: string
  personality: string
  portraitAsset: string
  color: string
  background: CharacterBackground
  stats: CharacterStats
  inventory: string[]
  currentNodeId: string
  completed: boolean
  health: number
  memory: string[]
}

type StoryIconId = 'lantern' | 'road' | 'crossroads' | 'codex' | 'keep' | 'forest'

type StoryEvent = {
  id: string
  name: string
  weight: number
  iconAssetId: StoryIconId
  prompt: string
  objectiveNodeId?: string
  npcTemplate?: StoryNpcTemplate
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

type StoryNode = {
  id: string
  name: string
  publicName: string
  description: string
  iconAssetId: StoryIconId
  nextNodeIds: string[]
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
  authorControl: string
  fixedRules: string[]
  codexTerms: string[]
  nodes: StoryNode[]
  events: StoryEvent[]
}

type FeedEntry = {
  id: string
  turn: number
  kind: 'narration' | 'dialogue' | 'system'
  speaker?: string
  text: string
  nodeId?: string
  eventId?: string
  streaming?: boolean
}

type DebugEntry = {
  id: string
  turn: number
  characterName?: string
  text: string
  streaming?: boolean
}

type CampaignState = {
  turn: number
  characters: Character[]
  storyNpcs: StoryNpc[]
  currentNodeId: string
  currentEvent?: StoryEvent
  currentEventStartedTurn?: number
  exploredNodeIds: string[]
  eventHistory: StoryEvent[]
  feed: FeedEntry[]
  debugFeed: DebugEntry[]
  outcome: 'running' | 'won' | 'lost'
}

type LlmSettings = {
  endpoint: string
  model: string
}

type AppView = 'story' | 'map' | 'codex' | 'settings'
type CodexSection = 'people' | 'places'

type CodexReference = {
  term: string
  type: 'place' | 'person' | 'term'
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

const storySchema: StorySchema = {
  id: 'lich-volunteers-schema',
  title: 'The King’s Lich',
  goalNodeId: 'king-return',
  maxTurns: 14,
  authorControl:
    'A story writer can replace this schema with a tiny one-shot or a large campaign. Nodes decide which weighted events can happen, what nearby paths exist, and how much of the route the audience is allowed to see.',
  fixedRules: [
    'The end user watches from outside the fiction and does not choose character actions.',
    'The Next button advances the current scene: narrator framing, private character questions, visible character interaction, then private narrator validation.',
    'A scene can span multiple Next presses and resolves only when the characters converge on a concrete plan the narrator accepts.',
    'Private narrator exchanges can influence characters, but are hidden unless debug mode is enabled.',
    'The codex is compact known story memory. The narrator and characters can reference what has been revealed so far.',
    'Unexplored story nodes and their weighted event tables are writer-owned hidden structure, not public spoilers.',
  ],
  codexTerms: ['Redvale', 'King Osric', 'Blackpine Road', 'Ash Farms', 'Old Watchtower', 'Barrow Crypt', 'Graymere Hall', 'iron spear', 'silver bell', 'grave ash', 'King’s Writ', 'the lich'],
  nodes: [
    {
      id: 'graymere-yard',
      name: 'Graymere Yard',
      publicName: 'Graymere Hall',
      description: 'The king’s muddy courtyard, where three unwilling volunteers are handed bad weapons and worse orders.',
      iconAssetId: 'road',
      nextNodeIds: ['ash-farms', 'old-watchtower'],
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
      description: 'Sickly fields outside Redvale, where frightened farmers count fresh graves and missing names.',
      iconAssetId: 'crossroads',
      nextNodeIds: ['blackpine-road', 'old-watchtower'],
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
      description: 'A leaning stone tower where the volunteers can look for the lich’s route before committing themselves.',
      iconAssetId: 'codex',
      nextNodeIds: ['blackpine-road', 'barrow-crypt'],
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
      description: 'A cramped forest road where carts lie split, horses refuse to move, and cold grave mist hangs between the trees.',
      iconAssetId: 'forest',
      nextNodeIds: ['barrow-crypt'],
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
      description: 'The lich’s buried hall, cold with old bones, stolen bells, and a deathless ruler raising more dead by the hour.',
      iconAssetId: 'keep',
      nextNodeIds: ['king-return'],
      eventWeights: [
        { eventId: 'lich-ritual', weight: 10 },
        { eventId: 'phylactery-glimpse', weight: 3 },
      ],
    },
    {
      id: 'king-return',
      name: 'King Return',
      publicName: 'Graymere Hall',
      description: 'The return to King Osric, where survival must become proof and the lich’s end must be believed.',
      iconAssetId: 'lantern',
      nextNodeIds: [],
      eventWeights: [
        { eventId: 'royal-proof', weight: 10 },
      ],
    },
  ],
  events: [
    {
      id: 'royal-order',
      name: 'The king names his volunteers',
      weight: 4,
      iconAssetId: 'road',
      prompt: 'King Osric orders three ordinary people to stop the lich because every trained knight sent into the barrows has returned as undead or not at all.',
      objectiveNodeId: 'ash-farms',
      npcTemplate: {
        id: 'king-osric',
        name: 'King Osric',
        role: 'Tired king',
        description: 'A thin, sleepless ruler in a patched crown who talks like command is the only tool he has left.',
        voice: 'formal, clipped, ashamed when pressed, and impatient with delay',
        want: 'Send someone, anyone, to stop the lich before the undead around Redvale outnumber the living.',
        knows: 'The lich works from the old barrows beyond Blackpine Road, and the last knight returned pale, silent, and dead-eyed before vanishing at dawn.',
      },
    },
    {
      id: 'bad-equipment',
      name: 'Bad weapons from the armory',
      weight: 5,
      iconAssetId: 'lantern',
      prompt: 'The volunteers discover their issued weapons are cheap, old, and badly matched to fighting walking corpses and a deathless sorcerer.',
      objectiveNodeId: 'old-watchtower',
    },
    {
      id: 'village-plea',
      name: 'Redvale begs for proof',
      weight: 3,
      iconAssetId: 'crossroads',
      prompt: 'Villagers ask whether the volunteers are truly going to help or just walking out to join the dead.',
      objectiveNodeId: 'ash-farms',
    },
    {
      id: 'burned-field',
      name: 'A field full of open graves',
      weight: 2,
      iconAssetId: 'forest',
      prompt: 'The party reaches a farm where old graves have opened and someone is hiding in a root cellar from the dead.',
      objectiveNodeId: 'blackpine-road',
      npcTemplate: {
        id: 'miller-joan',
        name: 'Miller Joan',
        role: 'Injured farmer',
        description: 'A mud-covered miller with a shaking lantern and no patience for heroic speeches.',
        voice: 'plain, angry, frightened, and practical',
        want: 'Get her brother out of the root cellar before the dead find the door.',
        knows: 'The dead came from the east after the bell rang under the hill, and one corpse still wore a royal tabard.',
      },
    },
    {
      id: 'hermit-warning',
      name: 'The hermit knows the old burial rite',
      weight: 5,
      iconAssetId: 'codex',
      prompt: 'A hermit at the old watchtower claims the lich can be stopped only if its bone charm is found and the burial bell is rung.',
      objectiveNodeId: 'barrow-crypt',
      npcTemplate: {
        id: 'old-perrin',
        name: 'Old Perrin',
        role: 'Tower hermit',
        description: 'A sharp-eyed hermit who has survived by being useful and unpleasant in equal measure.',
        voice: 'rasping, blunt, and fond of ugly truths',
        want: 'Convince the volunteers that bravery without a rite will only add three fresh bodies to the lich’s host.',
        knows: 'The lich hides its soul in a bone charm near a silver burial bell, and grave ash can briefly blind the dead.',
      },
    },
    {
      id: 'grave-mist',
      name: 'The grave mist turns fresh',
      weight: 6,
      iconAssetId: 'forest',
      prompt: 'Fresh grave mist and broken pines show the undead are close enough to hear if anyone speaks too loudly.',
      objectiveNodeId: 'barrow-crypt',
    },
    {
      id: 'bandit-toll',
      name: 'Bandits block the road',
      weight: 2,
      iconAssetId: 'crossroads',
      prompt: 'Hungry deserters demand the volunteers hand over food and weapons before entering the dead country.',
      objectiveNodeId: 'barrow-crypt',
    },
    {
      id: 'phylactery-glimpse',
      name: 'The bone charm shows',
      weight: 4,
      iconAssetId: 'keep',
      prompt: 'The lich turns toward its ritual, revealing a bone charm threaded with silver wire beneath its robes.',
      objectiveNodeId: 'king-return',
    },
    {
      id: 'lich-ritual',
      name: 'The lich raises another dead host',
      weight: 10,
      iconAssetId: 'keep',
      prompt: 'The lich begins raising another dead host in Barrow Crypt and the volunteers must execute a believable plan or fail.',
      objectiveNodeId: 'king-return',
    },
    {
      id: 'royal-proof',
      name: 'Proof before the throne',
      weight: 10,
      iconAssetId: 'lantern',
      prompt: 'The volunteers return to King Osric and must prove the lich is ended before panic eats the court alive.',
    },
  ],
}

const nodeById = new Map(storySchema.nodes.map((node) => [node.id, node]))
const eventById = new Map(storySchema.events.map((event) => [event.id, event]))

const initialCharacters: Character[] = [
  {
    id: 'tamsin',
    name: 'Tamsin',
    role: 'Gravedigger',
    personality: 'dry, stubborn, practical, and too familiar with death to be impressed by it',
    portraitAsset: '/icons/ffffff/transparent/1x1/darkzaitzev/hooded-figure.svg',
    color: '#7dd3fc',
    currentNodeId: 'graymere-yard',
    completed: false,
    health: 100,
    inventory: ['grave spade', 'iron nails', 'chalk marks', 'grave ash'],
    stats: { body: 7, wits: 7, heart: 5 },
    memory: ['Dead things are simpler when they stay buried.'],
    background: {
      storyRole: 'Tamsin knows graves, grave dirt, old burial signs, and what disturbed soil means.',
      home: 'She digs graves outside Redvale and was taken by the king’s levy because she knows the dead too well.',
      want: 'She wants to survive, end the rising dead, and return to work that at least made sense.',
      weakness: 'She hides fear behind jokes until people mistake her caution for cruelty.',
      closeTie: 'She trusts Brann’s hands when a plan needs lifting, breaking, or holding shut.',
      privateKnowledge: 'She knows grave ash can blind a corpse for a few breaths if thrown into its eyes or mouth.',
      decisionJob: 'When the group faces undead signs, Tamsin names what is corpse-work, what is magic, and what can be delayed no longer.',
    },
  },
  {
    id: 'brann',
    name: 'Brann',
    role: 'Blacksmith',
    personality: 'blunt, anxious, loyal, and very aware that courage does not stop a blade',
    portraitAsset: '/icons/ffffff/transparent/1x1/delapouite/person.svg',
    color: '#facc15',
    currentNodeId: 'graymere-yard',
    completed: false,
    health: 100,
    inventory: ['iron spear', 'smith hammer', 'coil of chain', 'wrapped bread'],
    stats: { body: 8, wits: 5, heart: 7 },
    memory: ['If something can be broken, wedged, chained, or braced, say so before running.'],
    background: {
      storyRole: 'Brann understands metal, hinges, chains, pressure, and how poor equipment fails.',
      home: 'He is a village smith from Redvale, dragged into service after repairing too many royal spearheads.',
      want: 'He wants to come home alive and make King Osric regret calling this volunteering.',
      weakness: 'He hesitates when a plan requires someone else to stand in danger while he works.',
      closeTie: 'He watches over Sister Elowen because she treats him like more than hired muscle.',
      privateKnowledge: 'He can spot weak pins, brittle locks, and old burial iron that might bind a corpse or bell chain.',
      decisionJob: 'When the plan needs tools, force, or a practical way to pin something down, Brann makes it concrete.',
    },
  },
  {
    id: 'elowen',
    name: 'Elowen',
    role: 'Novice sister',
    personality: 'gentle, frightened, observant, and brave only after admitting she is afraid',
    portraitAsset: '/icons/ffffff/transparent/1x1/delapouite/character.svg',
    color: '#c084fc',
    currentNodeId: 'graymere-yard',
    completed: false,
    health: 100,
    inventory: ['silver bell', 'chapel candle', 'threadbare prayer book', 'clean bandages'],
    stats: { body: 5, wits: 6, heart: 9 },
    memory: ['Fear gets smaller when someone names the next step.'],
    background: {
      storyRole: 'Elowen knows burial prayers, old saints’ rites, and how to keep frightened people talking.',
      home: 'She served in Redvale’s chapel until the king named her volunteer because she could read the burial book.',
      want: 'She wants the dead put back to rest and wants the living to stop treating sacrifice as policy.',
      weakness: 'She can freeze when cruelty sounds official or when someone calls her faith useless.',
      closeTie: 'She believes Tamsin’s grim knowledge and Brann’s practical hands can become a real plan if she keeps them together.',
      privateKnowledge: 'She knows a rite that may weaken a lich if a silver bell is rung over its soul vessel.',
      decisionJob: 'When others pull apart, Elowen turns fear, clues, and conscience into one agreed course.',
    },
  },
]

const defaultLlmSettings: LlmSettings = {
  endpoint: 'http://localhost:11434',
  model: 'qwen2.5:7b',
}

const initialState: CampaignState = {
  turn: 1,
  characters: initialCharacters,
  storyNpcs: [],
  currentNodeId: 'graymere-yard',
  currentEvent: storySchema.events[0],
  currentEventStartedTurn: 1,
  exploredNodeIds: ['graymere-yard'],
  eventHistory: [storySchema.events[0]],
  feed: [
    {
      id: 'opening',
      turn: 1,
      kind: 'dialogue',
      speaker: 'King Osric',
      nodeId: 'graymere-yard',
      text: 'King Osric: Tamsin of the graves, Brann of the forge, Sister Elowen of Redvale—you are named by the King’s Writ. The lich in the old barrows raises more dead each night. Stop him, return to Graymere Hall, and I will call you heroes instead of volunteers.',
    },
  ],
  debugFeed: [],
  outcome: 'running',
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getNode(id: string) {
  return nodeById.get(id) ?? storySchema.nodes[0]
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

function chooseNextNode(state: CampaignState, event: StoryEvent, visibleText: string) {
  const node = getNode(state.currentNodeId)

  if (event.objectiveNodeId && node.nextNodeIds.includes(event.objectiveNodeId)) {
    return event.objectiveNodeId
  }

  const mentionedNode = node.nextNodeIds.find((nodeId) => visibleText.toLowerCase().includes(getNode(nodeId).publicName.toLowerCase().split(' ')[0]))

  if (mentionedNode) {
    return mentionedNode
  }

  return node.nextNodeIds[0] ?? node.id
}

function formatRecentFeed(feed: FeedEntry[]) {
  return feed
    .slice(-8)
    .map((entry) => `${entry.speaker ?? entry.kind}: ${entry.text}`)
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
  state.characters.forEach((character) => {
    addReference({ term: character.name, type: 'person', targetId: character.id })
    character.inventory.forEach((item) => addReference({ term: item, type: 'term' }))
  })
  state.storyNpcs.forEach((npc) => addReference({ term: npc.name, type: 'person', targetId: npc.id }))
  storySchema.codexTerms.forEach((term) => {
    const matchingPlace = storySchema.nodes.find((node) => node.publicName.toLowerCase() === term.toLowerCase())
    const matchingPlaceIsKnown = matchingPlace ? state.exploredNodeIds.includes(matchingPlace.id) : false
    addReference({ term, type: matchingPlaceIsKnown ? 'place' : 'term', targetId: matchingPlaceIsKnown ? matchingPlace?.id : undefined })
  })

  return references.sort((a, b) => b.term.length - a.term.length)
}

function formatCharacterSheet(character: Character) {
  return `Role: ${character.role}
Personality: ${character.personality}
Want: ${character.background.want}
Weakness: ${character.background.weakness}
Tie: ${character.background.closeTie}
Private knowledge: ${character.background.privateKnowledge}
Decision job: ${character.background.decisionJob}
Recent memory: ${character.memory.slice(-4).join(' / ')}`
}

function formatCodexContext(state: CampaignState) {
  const knownPlaces = state.exploredNodeIds.map((nodeId) => {
    const node = getNode(nodeId)
    return `${node.publicName}: ${node.description}${node.id === state.currentNodeId ? ' Current location.' : ''}`
  })
  const knownPeople = [
    ...state.characters.map((character) => `${character.name}: ${character.role}. ${character.background.storyRole} Inventory: ${character.inventory.join(', ')}. Memory: ${character.memory.slice(-4).join(' / ')}`),
    ...state.storyNpcs.map((npc) => `${npc.name}: ${npc.role}. ${npc.description} Wants: ${npc.want}. Knows: ${npc.knows}. Memory: ${npc.memory.slice(-4).join(' / ')}`),
  ]
  const seenEvents = [...new Set(state.eventHistory.map((event) => event.name))]

  return `Known places:\n${knownPlaces.join('\n') || 'None yet.'}\n\nKnown people:\n${knownPeople.join('\n')}\n\nSeen events:\n${seenEvents.join(', ') || 'None yet.'}`
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

function buildNarratorPrompt(state: CampaignState, event: StoryEvent) {
  const node = getNode(state.currentNodeId)
  const sceneStartedTurn = state.currentEventStartedTurn ?? state.turn
  const sceneAge = Math.max(1, state.turn - sceneStartedTurn + 1)

  return `You are the narrator of a progressive text adventure being watched from outside the party.

Story: ${storySchema.title}
Turn: ${state.turn}/${storySchema.maxTurns}
Current node: ${node.publicName}
Node purpose: ${node.description}
Current scene: ${event.name}
Scene has continued for ${sceneAge} Next press(es).
Event pressure: ${event.prompt}
Recent visible story:
${formatRecentFeed(state.feed)}
Codex memory available to narrator and characters:
${formatCodexContext(state)}

Write only visible story text. No JSON. No markdown heading.
Style requirements:
- Visual novel style: short beats, one beat per line.
- Outside observer perspective.
- Make the situation clear and concrete.
- Do not decide for the characters.
- Mention sensory details and what the characters can react to.
- If this is a continuing scene, escalate or clarify the same problem instead of resolving it for them.
- If an NPC speaks, write the NPC's actual name followed by a colon, like "King Osric: words". Never write the literal label "Name:".
- For fragile or quiet delivery, prefix that line with "[weak]", "[small]", or "[whisper]".
- Do not reveal hidden schema nodes or unreached route names.`
}

function buildPrivateNarratorPrompt(character: Character, state: CampaignState, event: StoryEvent) {
  const node = getNode(state.currentNodeId)

  return `This is a private debug-only exchange. It is NOT visible to the audience unless debug mode is on.

Character: ${character.name}
${formatCharacterSheet(character)}
Current node: ${node.publicName}
Current event: ${event.name} — ${event.prompt}
Recent visible story:
${formatRecentFeed(state.feed)}
Codex memory available privately:
${formatCodexContext(state)}

Write a compact private exchange between ${character.name} and the Narrator:
${character.name} asks one practical question about what they can infer or try.
Narrator answers with one useful constraint or clue.
No JSON.`
}

function buildCharacterPrompt(character: Character, state: CampaignState, event: StoryEvent, privateExchange: string, spokenThisTurn: string[]) {
  const others = state.characters.filter((other) => other.id !== character.id).map((other) => `${other.name} (${other.role})`).join(', ')
  const node = getNode(state.currentNodeId)
  const sceneNpcs = state.storyNpcs.filter((npc) => npc.currentNodeId === state.currentNodeId || npc.introducedByEventId === event.id)

  return `You are writing one visible character turn in a progressive text adventure.

Character: ${character.name}
${formatCharacterSheet(character)}
Other characters present: ${others}
Scene NPCs:
${formatSceneNpcs(sceneNpcs)}
Current node: ${node.publicName}
Current event: ${event.name} — ${event.prompt}
Private narrator exchange for this character, not visible to audience:
${privateExchange || 'None.'}
Visible story so far:
${formatRecentFeed(state.feed)}
Codex memory available to this character:
${formatCodexContext(state)}
Characters who already spoke this turn:
${spokenThisTurn.length > 0 ? spokenThisTurn.join('\n') : 'No one yet.'}

Write only ${character.name}'s visible action and dialogue. No JSON. No markdown heading.
Rules:
- Visual novel style: short beats, one beat per line.
- ${character.name} should primarily talk with the other protagonists about how to approach the situation.
- ${character.name} may ask the NPC one specific question, but should not act like they are handling the NPC alone.
- React to prior speakers instead of monologuing.
- Favor direct action and dialogue that naturally fits the scene.
- Use ${character.name}'s actual name followed by a colon for spoken lines, like "${character.name}: words". Never write the literal label "Name:".
- For quiet, uncertain, or broken delivery, prefix the line with "[weak]", "[small]", or "[whisper]".
- The line should sound like a person under pressure, not a status report.
- Use the private exchange only as subtext; do not expose that a private question happened.`
}

function buildNpcPrompt(npc: StoryNpc, state: CampaignState, event: StoryEvent, spokenThisTurn: string[]) {
  const node = getNode(state.currentNodeId)

  return `You are writing one visible NPC response in a progressive visual novel scene.

NPC: ${npc.name} (${npc.role})
Description: ${npc.description}
Voice: ${npc.voice}
Want: ${npc.want}
Knows: ${npc.knows}
Current node: ${node.publicName}
Current event: ${event.name} — ${event.prompt}
What the protagonists just said:
${spokenThisTurn.length > 0 ? spokenThisTurn.join('\n') : 'No one spoke yet.'}
Codex memory available to the scene:
${formatCodexContext(state)}

Write only ${npc.name}'s visible response. No JSON. No markdown heading.
Rules:
- Visual novel style: short beats, one beat per line.
- Use ${npc.name}'s actual name followed by a colon for speech, like "${npc.name}: words". Never write the literal label "Name:".
- If ${npc.name} is scared, small, weak, hesitant, or whispering, prefix the line with "[weak]", "[small]", or "[whisper]".
- Answer or react to the group, not each character separately.`
}

function buildSceneResolutionPrompt(state: CampaignState, event: StoryEvent, spokenThisTurn: string[]) {
  const node = getNode(state.currentNodeId)
  const sceneStartedTurn = state.currentEventStartedTurn ?? state.turn
  const sceneAge = Math.max(1, state.turn - sceneStartedTurn + 1)

  return `This is a private debug-only narrator validation. It is NOT visible to the audience unless debug mode is on.

Story: ${storySchema.title}
Current place: ${node.publicName}
Scene: ${event.name}
Scene pressure: ${event.prompt}
Scene has continued for ${sceneAge} Next press(es).
Visible character/NPC text from this press:
${spokenThisTurn.length > 0 ? spokenThisTurn.join('\n') : 'No visible plan yet.'}
Compact codex memory:
${formatCodexContext(state)}

Decide whether the scene is resolved enough for the map to advance.
The scene may resolve only if the protagonists have converged on a concrete, plausible solution and any active NPC pressure has been answered well enough.

Return exactly this format:
RESOLVED: yes or no
REASON: one short sentence

No markdown. No extra headings.`
}

function parseSceneResolved(validationText: string) {
  const resolvedMatch = validationText.match(/RESOLVED:\s*(yes|no)/i)
  return resolvedMatch?.[1]?.toLowerCase() === 'yes'
}

function StoryIcon({ id, label, className = '' }: { id: StoryIconId; label: string; className?: string }) {
  return (
    <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary ${className}`} aria-hidden="true">
      <img src={storyIconAssets[id]} alt="" className="size-6 object-contain" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

function getVisualNovelLineStyle(line: string) {
  const markerMatch = line.match(/^\[(weak|small|whisper)\]\s*/i)
  const marker = markerMatch?.[1]?.toLowerCase()
  const text = markerMatch ? line.replace(/^\[(weak|small|whisper)\]\s*/i, '') : line

  if (marker === 'weak' || marker === 'small') {
    return { text, className: 'text-sm italic tracking-wide text-muted-foreground/80' }
  }

  if (marker === 'whisper') {
    return { text, className: 'text-sm italic text-muted-foreground' }
  }

  return { text, className: '' }
}

function renderCodexText(
  text: string,
  references: CodexReference[],
  onOpenCodexNode: (nodeId: string) => void,
  onOpenCodexPerson: (personId: string) => void,
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

      onOpenCodex()
    }

    return (
      <button key={`${part}-${index}`} type="button" className="inline-block cursor-pointer appearance-none border-0 bg-transparent p-0 align-baseline font-[inherit] font-bold italic leading-none text-foreground transition-colors duration-200 ease-out hover:text-primary focus-visible:outline-none focus-visible:text-primary" onClick={openReference}>
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
  onOpenCodex,
}: {
  state: CampaignState
  onOpenCodexNode: (nodeId: string) => void
  onOpenCodexPerson: (personId: string) => void
  onOpenCodex: () => void
}) {
  const references = getCodexReferences(state)

  return (
    <div className="rounded-2xl border bg-background p-5 shadow-sm">
      <div className="font-serif text-base leading-8 tracking-normal">
        {state.feed.map((entry) => (
          <FeedBlock
            key={entry.id}
            entry={entry}
            references={references}
            onOpenCodexNode={onOpenCodexNode}
            onOpenCodexPerson={onOpenCodexPerson}
            onOpenCodex={onOpenCodex}
          />
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
  onOpenCodex,
}: {
  entry: FeedEntry
  references: CodexReference[]
  onOpenCodexNode: (nodeId: string) => void
  onOpenCodexPerson: (personId: string) => void
  onOpenCodex: () => void
}) {
  const lines = entry.text.split('\n').filter((line) => line.trim().length > 0)
  const renderedLines = lines.length > 0 ? [...lines, ...(entry.streaming && entry.text.endsWith('\n') ? [''] : [])] : ['']

  return (
    <section className="mb-8 last:mb-0">
      {entry.kind === 'system' ? (
        <div className="mb-3 flex items-center gap-3 font-sans text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Separator className="flex-1" />
          <span>{entry.text}</span>
          <Separator className="flex-1" />
        </div>
      ) : null}
      {entry.kind !== 'system' ? (
        <div className={entry.kind === 'narration' ? 'text-foreground' : 'text-muted-foreground'}>
        {renderedLines.map((line, index) => {
          const styledLine = getVisualNovelLineStyle(line)
          const speakerMatch = styledLine.text.match(/^([^:]{2,32}):\s*(.+)$/)
          const displayedSpeaker = normalizeSpeakerLabel(entry.kind === 'dialogue' ? speakerMatch?.[1] ?? entry.speaker : speakerMatch?.[1], entry.speaker)
          const displayedText = speakerMatch ? speakerMatch[2] : styledLine.text

          const shouldShowSpeaker = displayedSpeaker && displayedSpeaker !== 'Narrator'

          return shouldShowSpeaker ? (
            <p key={`${entry.id}-line-${index}`} className={`mb-2 grid grid-cols-[6.75rem_minmax(0,1fr)] items-baseline gap-3 whitespace-pre-wrap last:mb-0 ${styledLine.className}`}>
              <span className="truncate font-sans text-xs font-semibold uppercase tracking-[0.08em] text-foreground">{displayedSpeaker}</span>
              <span>
                {renderCodexText(displayedText, references, onOpenCodexNode, onOpenCodexPerson, onOpenCodex)}
                {entry.streaming && index === renderedLines.length - 1 ? <span className="ml-1 animate-pulse font-sans text-primary">▌</span> : null}
              </span>
            </p>
          ) : (
            <p key={`${entry.id}-line-${index}`} className={`mb-2 whitespace-pre-wrap last:mb-0 ${styledLine.className}`}>
              <span>{renderCodexText(displayedText, references, onOpenCodexNode, onOpenCodexPerson, onOpenCodex)}</span>
              {entry.streaming && index === renderedLines.length - 1 ? <span className="ml-1 animate-pulse font-sans text-primary">▌</span> : null}
            </p>
          )
        })}
        </div>
      ) : null}
    </section>
  )
}

function MapGraphView({
  state,
  selectedNodeId,
  onSelectNode,
  onOpenCodex,
}: {
  state: CampaignState
  selectedNodeId: string
  onSelectNode: (nodeId: string) => void
  onOpenCodex: (nodeId: string) => void
}) {
  const explored = new Set(state.exploredNodeIds)
  const graphLayout: Record<string, { x: number; y: number }> = {
    'graymere-yard': { x: 300, y: 520 },
    'ash-farms': { x: 180, y: 385 },
    'old-watchtower': { x: 420, y: 385 },
    'blackpine-road': { x: 285, y: 250 },
    'barrow-crypt': { x: 300, y: 110 },
    'king-return': { x: 470, y: 65 },
  }
  const exploredNodes = storySchema.nodes.filter((node) => explored.has(node.id))
  const exploredEdges = exploredNodes.flatMap((node) =>
    node.nextNodeIds
      .filter((nextNodeId) => explored.has(nextNodeId))
      .map((nextNodeId) => ({ from: node.id, to: nextNodeId })),
  )
  const currentNode = getNode(state.currentNodeId)
  const selectedNode = getNode(selectedNodeId)
  const hiddenExits = currentNode.nextNodeIds.filter((nodeId) => !explored.has(nodeId))
  const currentPosition = graphLayout[currentNode.id]

  return (
    <Card className="min-h-[680px]">
      <CardHeader>
        <CardTitle>Map</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-2xl border bg-background p-4">
          <svg viewBox="0 0 600 600" className="h-[560px] w-full" role="img" aria-label="Explored story map graph">
            {exploredEdges.map((edge) => {
              const from = graphLayout[edge.from]
              const to = graphLayout[edge.to]

              return <line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="currentColor" strokeOpacity="0.28" strokeWidth="4" />
            })}

            {hiddenExits.map((nodeId, index) => {
              const angle = hiddenExits.length === 1 ? -90 : -125 + index * 70
              const radians = (angle * Math.PI) / 180
              const x = currentPosition.x + Math.cos(radians) * 105
              const y = currentPosition.y + Math.sin(radians) * 105

              return (
                <g key={nodeId}>
                  <line x1={currentPosition.x} y1={currentPosition.y} x2={x} y2={y} stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" strokeDasharray="8 10" />
                  <circle cx={x} cy={y} r="25" fill="var(--muted)" stroke="currentColor" strokeOpacity="0.28" strokeDasharray="5 6" />
                  <text x={x} y={y + 6} textAnchor="middle" className="fill-muted-foreground text-xl font-semibold">?</text>
                </g>
              )
            })}

            {exploredNodes.map((node) => {
              const position = graphLayout[node.id]
              const isCurrent = node.id === state.currentNodeId
              const isSelected = node.id === selectedNodeId

              return (
                <g key={node.id} role="button" tabIndex={0} className="cursor-pointer outline-none" onClick={() => onSelectNode(node.id)} onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    onSelectNode(node.id)
                  }
                }}>
                  <circle cx={position.x} cy={position.y} r={isCurrent ? 39 : 33} fill={isCurrent ? 'var(--primary)' : 'var(--background)'} stroke="currentColor" strokeOpacity={isCurrent || isSelected ? '0.95' : '0.35'} strokeWidth={isSelected ? '6' : '4'} />
                  <image href={storyIconAssets[node.iconAssetId]} x={position.x - 16} y={position.y - 16} width="32" height="32" />
                  <text x={position.x} y={position.y + 57} textAnchor="middle" className="fill-foreground text-sm font-medium">{node.publicName}</text>
                </g>
              )
            })}
          </svg>
          </div>
          <aside className="rounded-2xl border bg-background p-4">
            <div className="flex items-start gap-3">
              <StoryIcon id={selectedNode.iconAssetId} label={selectedNode.publicName} className="size-9 rounded-lg" />
              <div>
                <h3 className="text-lg font-semibold">{selectedNode.publicName}</h3>
                {selectedNode.id === state.currentNodeId ? <Badge className="mt-2" variant="secondary">current</Badge> : null}
              </div>
            </div>
            <p className="mt-4 font-serif text-sm leading-6 text-muted-foreground">{selectedNode.description}</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenCodex(selectedNode.id)}>Open in codex</Button>
            </div>
          </aside>
        </div>
      </CardContent>
    </Card>
  )
}

function CharactersPanel({ characters, npcs }: { characters: Character[]; npcs: StoryNpc[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Characters</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {characters.map((character) => (
          <div key={character.id} className="rounded-xl border bg-background p-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: character.color }} />
              <p className="font-medium">{character.name}</p>
            </div>
            <p className="mt-2 font-serif text-sm leading-6 text-muted-foreground">{character.background.storyRole}</p>
          </div>
        ))}
        {npcs.map((npc) => (
          <div key={npc.id} className="rounded-xl border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <p className="font-medium">{npc.name}</p>
            </div>
            <p className="mt-2 font-serif text-sm leading-6 text-muted-foreground">{npc.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function CodexPanel({
  state,
  section,
  selectedNodeId,
  selectedPersonId,
  onSelectSection,
  onSelectNode,
  onSelectPerson,
  onOpenMap,
}: {
  state: CampaignState
  section: CodexSection
  selectedNodeId: string
  selectedPersonId: string
  onSelectSection: (section: CodexSection) => void
  onSelectNode: (nodeId: string) => void
  onSelectPerson: (personId: string) => void
  onOpenMap: (nodeId: string) => void
}) {
  const exploredNodes = state.exploredNodeIds.map(getNode)
  const selectedNode = exploredNodes.find((node) => node.id === selectedNodeId) ?? exploredNodes[0]
  const selectedCharacter = state.characters.find((character) => character.id === selectedPersonId)
  const selectedNpc = state.storyNpcs.find((npc) => npc.id === selectedPersonId)
  const currentEventNames = state.eventHistory.map((event) => event.name)
  const seenEventNames = [...new Set(currentEventNames)]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Codex</CardTitle>
      </CardHeader>
      <CardContent className="grid items-stretch gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-[560px] flex-col gap-3 rounded-2xl border bg-background p-4">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={section === 'people' ? 'secondary' : 'outline'} onClick={() => onSelectSection('people')}>People</Button>
            <Button type="button" variant={section === 'places' ? 'secondary' : 'outline'} onClick={() => onSelectSection('places')}>Places</Button>
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            {section === 'people' ? (
              <>
                {state.characters.map((character) => (
                  <Button key={character.id} type="button" variant={selectedPersonId === character.id ? 'secondary' : 'outline'} className="justify-start" onClick={() => onSelectPerson(character.id)}>
                    {character.name}
                  </Button>
                ))}
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
          </div>
        </aside>

        <section className="flex min-h-[560px] flex-col rounded-2xl border bg-background p-5">
          {section === 'people' && selectedCharacter ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <span className="inline-flex size-20 items-center justify-center rounded-lg bg-primary">
                  <img src={selectedCharacter.portraitAsset} alt="" className="size-14 object-contain" />
                </span>
                <div>
                  <h4 className="text-xl font-semibold">{selectedCharacter.name}</h4>
                  <p className="text-sm text-muted-foreground">{selectedCharacter.role}</p>
                </div>
              </div>
              <div className="font-serif text-sm leading-6 text-muted-foreground">
                <p>{selectedCharacter.background.storyRole}</p>
                <p className="mt-2">{selectedCharacter.background.home}</p>
                <p className="mt-2">{selectedCharacter.background.want}</p>
                <p className="mt-2">{selectedCharacter.background.closeTie}</p>
              </div>
              <div>
                <h5 className="text-sm font-medium">Inventory</h5>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedCharacter.inventory.map((item) => (
                    <Badge key={item} variant="outline">{item}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h5 className="text-sm font-medium">Story so far</h5>
                <ul className="mt-2 flex flex-col gap-2 font-serif text-sm leading-6 text-muted-foreground">
                  {selectedCharacter.memory.map((memory) => <li key={memory}>{memory}</li>)}
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
                  {selectedNpc.memory.map((memory) => <li key={memory}>{memory}</li>)}
                </ul>
              </div>
            </div>
          ) : null}

          {section === 'places' ? (
            <div>
              <div className="flex items-start gap-3">
                <StoryIcon id={selectedNode.iconAssetId} label={selectedNode.publicName} className="size-8 rounded-md" />
                <div>
                  <h4 className="text-lg font-semibold">{selectedNode.publicName}</h4>
                  {selectedNode.id === state.currentNodeId ? <Badge className="mt-2" variant="secondary">current</Badge> : null}
                </div>
              </div>
              <p className="mt-3 font-serif text-sm leading-6 text-muted-foreground">{selectedNode.description}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => onOpenMap(selectedNode.id)}>
                Show on map
              </Button>
            </div>
          ) : null}

        {seenEventNames.length > 0 ? (
          <>
            <Separator />
            <section>
              <h3 className="text-sm font-medium">Seen events</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {seenEventNames.map((eventName) => (
                  <Badge key={eventName} variant="secondary">{eventName}</Badge>
                ))}
              </div>
            </section>
          </>
        ) : null}
        </section>
      </CardContent>
    </Card>
  )
}

function DebugPanel({ entries }: { entries: DebugEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Debug narrator channel</CardTitle>
        <CardDescription className="font-serif">Private character questions and narrator hints. Hidden from the normal audience view.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72">
          <div className="flex flex-col gap-3 pr-3">
            {entries.length === 0 ? <p className="font-serif text-sm text-muted-foreground">No private exchanges yet.</p> : null}
            {entries.map((entry) => (
              <article key={entry.id} className="rounded-xl border bg-muted/20 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Badge variant="outline">{entry.characterName ?? 'Narrator'}</Badge>
                  <span className="text-xs text-muted-foreground">Turn {entry.turn}</span>
                </div>
                <p className="whitespace-pre-wrap font-serif text-sm leading-6 text-muted-foreground">
                  {entry.text}
                  {entry.streaming ? <span className="ml-1 animate-pulse font-sans text-primary">▌</span> : null}
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
  const [currentView, setCurrentView] = useState<AppView>('story')
  const [codexSection, setCodexSection] = useState<CodexSection>('people')
  const [selectedNodeId, setSelectedNodeId] = useState(initialState.currentNodeId)
  const [selectedPersonId, setSelectedPersonId] = useState(initialCharacters[0].id)
  const [llmError, setLlmError] = useState<string | undefined>()
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null)
  const currentNode = useMemo(() => getNode(campaign.currentNodeId), [campaign.currentNodeId])

  const appendFeedEntry = (entry: Omit<FeedEntry, 'id'>) => {
    const id = createId(entry.kind)
    setCampaign((state) => ({ ...state, feed: [...state.feed, { id, ...entry }] }))
    requestAnimationFrame(() => scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
    return id
  }

  const updateFeedEntry = (id: string, updater: (entry: FeedEntry) => FeedEntry) => {
    setCampaign((state) => ({ ...state, feed: state.feed.map((entry) => (entry.id === id ? updater(entry) : entry)) }))
    requestAnimationFrame(() => scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
  }

  const streamFeedEntry = async (entryId: string, prompt: string) => {
    let pendingLine = ''
    const appendCompletedText = (text: string) => {
      updateFeedEntry(entryId, (entry) => ({ ...entry, text: `${entry.text}${text}` }))
    }
    const fullText = await streamLocalText(llmSettings, prompt, (chunk) => {
      pendingLine += chunk
      const lines = pendingLine.split('\n')
      pendingLine = lines.pop() ?? ''

      if (lines.length > 0) {
        appendCompletedText(`${lines.join('\n')}\n`)
      }
    })

    if (pendingLine.trim().length > 0) {
      appendCompletedText(pendingLine)
    }

    return fullText
  }

  const appendDebugEntry = (entry: Omit<DebugEntry, 'id'>) => {
    const id = createId('debug')
    setCampaign((state) => ({ ...state, debugFeed: [...state.debugFeed, { id, ...entry }] }))
    return id
  }

  const updateDebugEntry = (id: string, updater: (entry: DebugEntry) => DebugEntry) => {
    setCampaign((state) => ({ ...state, debugFeed: state.debugFeed.map((entry) => (entry.id === id ? updater(entry) : entry)) }))
  }

  const advanceOneTurn = async () => {
    if (isAdvancing || campaign.outcome !== 'running') {
      return
    }

    setIsAdvancing(true)
    setLlmError(undefined)

    try {
      await assertLocalModelAvailable(llmSettings)

      const stateAtStart = campaign
      const turn = stateAtStart.turn
      const event = stateAtStart.currentEvent ?? drawStoryEvent(stateAtStart)
      const isNewScene = !stateAtStart.currentEvent
      const sceneStartedTurn = stateAtStart.currentEventStartedTurn ?? turn
      const sceneAge = Math.max(1, turn - sceneStartedTurn + 1)
      const node = getNode(stateAtStart.currentNodeId)
      const { storyNpcs, sceneNpc } = getOrCreateEventNpc(stateAtStart, event)
      const turnState = { ...stateAtStart, currentEvent: event, currentEventStartedTurn: sceneStartedTurn, storyNpcs }

      setCampaign((state) => ({
        ...state,
        currentEvent: event,
        currentEventStartedTurn: sceneStartedTurn,
        storyNpcs,
        eventHistory: isNewScene ? [...state.eventHistory, event].slice(-20) : state.eventHistory,
      }))

      if (isNewScene) {
        appendFeedEntry({
          turn,
          kind: 'system',
          speaker: 'Scene',
          nodeId: node.id,
          eventId: event.id,
          text: event.name,
        })
      }

      const narratorEntryId = appendFeedEntry({
        turn,
        kind: 'narration',
        speaker: 'Narrator',
        nodeId: node.id,
        eventId: event.id,
        text: '',
        streaming: true,
      })

      await streamFeedEntry(narratorEntryId, buildNarratorPrompt(turnState, event))
      updateFeedEntry(narratorEntryId, (entry) => ({ ...entry, streaming: false }))

      const visibleCharacterTurns: string[] = []
      const updatedCharacters: Character[] = []

      for (const character of stateAtStart.characters) {
        if (character.completed || character.health <= 0) {
          updatedCharacters.push(character)
          continue
        }

        const debugEntryId = appendDebugEntry({ turn, characterName: character.name, text: '', streaming: true })
        const privateExchange = await streamLocalText(llmSettings, buildPrivateNarratorPrompt(character, turnState, event), (chunk) => {
          updateDebugEntry(debugEntryId, (entry) => ({ ...entry, text: entry.text + chunk }))
        })
        updateDebugEntry(debugEntryId, (entry) => ({ ...entry, streaming: false }))

        const characterEntryId = appendFeedEntry({
          turn,
          kind: 'dialogue',
          speaker: character.name,
          nodeId: node.id,
          eventId: event.id,
          text: '',
          streaming: true,
        })

        const visibleTurn = await streamFeedEntry(characterEntryId, buildCharacterPrompt(character, turnState, event, privateExchange, visibleCharacterTurns))
        updateFeedEntry(characterEntryId, (entry) => ({ ...entry, streaming: false }))
        visibleCharacterTurns.push(`${character.name}: ${visibleTurn}`)
        updatedCharacters.push({ ...character, memory: [...character.memory, visibleTurn].slice(-8) })
      }

      let updatedStoryNpcs = storyNpcs

      if (sceneNpc) {
        const npcEntryId = appendFeedEntry({
          turn,
          kind: 'dialogue',
          speaker: sceneNpc.name,
          nodeId: node.id,
          eventId: event.id,
          text: '',
          streaming: true,
        })
        const npcTurn = await streamFeedEntry(npcEntryId, buildNpcPrompt(sceneNpc, turnState, event, visibleCharacterTurns))
        updateFeedEntry(npcEntryId, (entry) => ({ ...entry, streaming: false }))
        visibleCharacterTurns.push(`${sceneNpc.name}: ${npcTurn}`)
        updatedStoryNpcs = storyNpcs.map((npc) => (npc.id === sceneNpc.id ? { ...npc, memory: [...npc.memory, npcTurn].slice(-8) } : npc))
      }

      const resolutionDebugEntryId = appendDebugEntry({ turn, characterName: 'Narrator', text: '', streaming: true })
      const validationText = await streamLocalText(llmSettings, buildSceneResolutionPrompt(turnState, event, visibleCharacterTurns), (chunk) => {
        updateDebugEntry(resolutionDebugEntryId, (entry) => ({ ...entry, text: entry.text + chunk }))
      })
      updateDebugEntry(resolutionDebugEntryId, (entry) => ({ ...entry, streaming: false }))

      const sceneResolved = sceneAge >= 2 && parseSceneResolved(validationText)
      const nextNodeId = sceneResolved ? chooseNextNode(stateAtStart, event, visibleCharacterTurns.join('\n')) : stateAtStart.currentNodeId
      const nextTurn = turn + 1
      const reachedGoal = sceneResolved && nextNodeId === storySchema.goalNodeId && stateAtStart.currentNodeId === storySchema.goalNodeId
      const outOfTime = nextTurn > storySchema.maxTurns && !reachedGoal
      const outcome: CampaignState['outcome'] = reachedGoal ? 'won' : outOfTime ? 'lost' : 'running'
      const nextExploredNodeIds = stateAtStart.exploredNodeIds.includes(nextNodeId) ? stateAtStart.exploredNodeIds : [...stateAtStart.exploredNodeIds, nextNodeId]

      if (sceneResolved) {
        setSelectedNodeId(nextNodeId)
      }

      setCampaign((state) => ({
        ...state,
        turn: nextTurn,
        characters: updatedCharacters.map((character) => ({ ...character, currentNodeId: nextNodeId, completed: outcome === 'won' })),
        storyNpcs: updatedStoryNpcs.map((npc) => ({ ...npc, currentNodeId: nextNodeId })),
        currentNodeId: nextNodeId,
        currentEvent: sceneResolved || outcome !== 'running' ? undefined : event,
        currentEventStartedTurn: sceneResolved || outcome !== 'running' ? undefined : sceneStartedTurn,
        exploredNodeIds: nextExploredNodeIds,
        outcome,
      }))

      if (outcome !== 'running') {
        appendFeedEntry({
          turn: nextTurn,
          kind: 'narration',
          speaker: 'Narrator',
          nodeId: nextNodeId,
          text: outcome === 'won' ? 'The lich is ended, the dead are still, and the road back to the king opens beneath a pale morning.' : 'The adventure breaks before its promise is kept. Somewhere ahead, the lich keeps raising the dead until they outnumber the living.',
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
    setSelectedPersonId(initialCharacters[0].id)
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

  const openCodex = () => {
    setCurrentView('codex')
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
        <aside className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{storySchema.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button type="button" size="lg" onClick={advanceOneTurn} disabled={isAdvancing || campaign.outcome !== 'running'} className="w-full">
                <PlayIcon data-icon="inline-start" />
                {isAdvancing ? 'Generating…' : 'Next'}
              </Button>
              <Separator />
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['story', 'Story'],
                  ['map', 'Map'],
                  ['codex', 'Codex'],
                  ['settings', 'Settings'],
                ] as Array<[AppView, string]>).map(([view, label]) => (
                  <Button key={view} type="button" variant={currentView === view ? 'secondary' : 'outline'} onClick={() => setCurrentView(view)}>
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <CharactersPanel characters={campaign.characters} npcs={campaign.storyNpcs} />
        </aside>

        <section className="flex min-h-0 flex-col gap-5">
          {currentView === 'story' ? (
            <>
              {llmError ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>Local model required</AlertTitle>
                  <AlertDescription className="font-serif">{llmError}</AlertDescription>
                </Alert>
              ) : null}

              <Card className="min-h-[720px] bg-transparent ring-0 shadow-none">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <StoryIcon id={currentNode.iconAssetId} label={currentNode.publicName} />
                    <div>
                      <CardTitle>{currentNode.publicName}</CardTitle>
                      <CardDescription className="font-serif text-base leading-7">{currentNode.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[76vh] min-h-[620px]">
                    <div className="pr-3">
                      <StoryTranscript state={campaign} onOpenCodexNode={openCodexNode} onOpenCodexPerson={openCodexPerson} onOpenCodex={openCodex} />
                      <div ref={scrollAnchorRef} />
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          ) : null}

          {currentView === 'map' ? <MapGraphView state={campaign} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} onOpenCodex={openCodexNode} /> : null}

          {currentView === 'codex' ? (
            <CodexPanel
              state={campaign}
              section={codexSection}
              selectedNodeId={selectedNodeId}
              selectedPersonId={selectedPersonId}
              onSelectSection={setCodexSection}
              onSelectNode={setSelectedNodeId}
              onSelectPerson={setSelectedPersonId}
              onOpenMap={openMapNode}
            />
          ) : null}

          {currentView === 'settings' ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription className="font-serif">Local generation and debug controls.</CardDescription>
                </CardHeader>
                <CardContent className="flex max-w-xl flex-col gap-3">
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Endpoint
                    <Input value={llmSettings.endpoint} onChange={(event) => setLlmSettings((settings) => ({ ...settings, endpoint: event.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Model
                    <Input value={llmSettings.model} onChange={(event) => setLlmSettings((settings) => ({ ...settings, model: event.target.value }))} />
                  </label>
                  <Separator />
                  <Button type="button" variant={debugMode ? 'secondary' : 'outline'} onClick={() => setDebugMode((value) => !value)}>
                    <EyeIcon data-icon="inline-start" />
                    {debugMode ? 'Hide debug channel' : 'Show debug channel'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetCampaign} disabled={isAdvancing}>
                    <RotateCcwIcon data-icon="inline-start" />
                    Reset story
                  </Button>
                </CardContent>
              </Card>

              {debugMode ? <DebugPanel entries={campaign.debugFeed} /> : null}
            </>
          ) : null}
        </section>
      </div>
    </main>
  )
}

export default App
