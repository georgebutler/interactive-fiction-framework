export type MemoryLayerId = 'canonicalMemory' | 'sceneMemory' | 'characterMemory' | 'rumorMemory'

export type MemoryAtom = {
  id: string
  layer: MemoryLayerId
  subject: string
  text: string
  importance: number
}

export type MemorySnapshot = {
  canonicalMemory: MemoryAtom[]
  sceneMemory: MemoryAtom[]
  characterMemory: MemoryAtom[]
  rumorMemory: MemoryAtom[]
}

type FeedLike = {
  kind: string
  speaker?: string
  text: string
  generatedText?: string
}

type NpcMemoryLike = {
  npcId: string
  name: string
  memory: string[]
}

function memoryId(layer: MemoryLayerId, index: number) {
  return `${layer}-${index}`
}

function isRumorText(text: string) {
  return /may|might|rumou?r|seems?|perhaps|unverified|warning|heard|said/i.test(text)
}

export function buildMemorySnapshot(input: {
  feed: FeedLike[]
  canonicalFacts: Record<string, string>
  playerMemory: string[]
  npcMemories: NpcMemoryLike[]
  flags: Record<string, boolean>
  inventory?: Array<{ name: string }>
}) {
  const canonicalMemory: MemoryAtom[] = [
    ...Object.entries(input.canonicalFacts).map(([subject, text], index) => ({
      id: memoryId('canonicalMemory', index),
      layer: 'canonicalMemory' as const,
      subject,
      text,
      importance: 5,
    })),
    ...Object.entries(input.flags)
      .filter(([, value]) => value)
      .map(([flag], index) => ({
        id: memoryId('canonicalMemory', Object.keys(input.canonicalFacts).length + index),
        layer: 'canonicalMemory' as const,
        subject: 'Flag',
        text: flag,
        importance: 4,
      })),
    ...(input.inventory?.map((item, index) => ({
      id: memoryId('canonicalMemory', Object.keys(input.canonicalFacts).length + Object.keys(input.flags).length + index),
      layer: 'canonicalMemory' as const,
      subject: 'Inventory',
      text: item.name,
      importance: 4,
    })) ?? []),
  ]

  const recentFeed = input.feed
    .filter((entry) => entry.kind === 'narration' || entry.kind === 'dialogue' || entry.kind === 'selected')
    .slice(-3)

  const sceneMemory: MemoryAtom[] = recentFeed.map((entry, index) => ({
    id: memoryId('sceneMemory', index),
    layer: 'sceneMemory',
    subject: entry.speaker ?? entry.kind,
    text: entry.generatedText ?? entry.text,
    importance: 3,
  }))

  const playerAtoms = input.playerMemory.map((text, index) => ({
    id: memoryId('characterMemory', index),
    layer: 'characterMemory' as const,
    subject: 'Player',
    text,
    importance: 4,
  }))
  const npcAtoms = input.npcMemories.flatMap((npc, npcIndex) =>
    npc.memory.map((text, memoryIndex) => ({
      id: memoryId('characterMemory', playerAtoms.length + npcIndex * 10 + memoryIndex),
      layer: 'characterMemory' as const,
      subject: npc.name,
      text,
      importance: 3,
    })),
  )

  const characterMemory = [...playerAtoms, ...npcAtoms].slice(-12)
  const rumorMemory = characterMemory
    .filter((atom) => isRumorText(atom.text))
    .map((atom, index) => ({ ...atom, id: memoryId('rumorMemory', index), layer: 'rumorMemory' as const, importance: Math.max(1, atom.importance - 1) }))

  return {
    canonicalMemory: canonicalMemory.slice(-18),
    sceneMemory,
    characterMemory,
    rumorMemory: rumorMemory.slice(-8),
  } satisfies MemorySnapshot
}

function formatAtoms(label: string, atoms: MemoryAtom[]) {
  return `--- ${label} ---\n${atoms.length > 0 ? atoms.map((atom) => `- [${atom.subject}] ${atom.text}`).join('\n') : '- None.'}`
}

export function formatMemoryForPrompt(snapshot: MemorySnapshot) {
  return [
    formatAtoms('CANONICAL MEMORY (DETERMINISTIC STATE)', snapshot.canonicalMemory),
    formatAtoms('SCENE MEMORY (LAST 3 SCENES)', snapshot.sceneMemory),
    formatAtoms('CHARACTER MEMORY (BELIEFS / RELATIONSHIPS / TRUST)', snapshot.characterMemory),
    formatAtoms('RUMOR MEMORY (UNVERIFIED)', snapshot.rumorMemory),
  ].join('\n')
}
