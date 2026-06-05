# Contributing to Interactive Fiction Framework

Thanks for wanting to contribute to IFF.

This project grows through code improvements, story contributions, prompt tuning, UI polish, 
and design ideas. The most important contributions are playable stories. This guide puts the 
player experience first and the schema second.

## Ways to contribute

- Write a new playable story
- Improve the sample story
- Improve schema architecture or prompt reliability
- Improve map, codex, or character UX
- Add tests or documentation
- Add support for more local model backends
- Report bugs with reproduction steps

## Before you write a single schema field

Answer this question out loud:

> "When a player sits down with this story, what should they feel in the first two minutes?"

If you can't answer that in one sentence, the story is not ready to schema yet. Examples of 
good answers:

- "They should feel like a lone investigator trying to hold onto their job while something 
  impossible happens around them."
- "They should feel the weight of a bad decision they made before the story started."
- "They should feel like they have maybe four moves before everything goes wrong."

Write that sentence down. It becomes your `objective.summary`.

## Story contribution order

Design in this order. Each step tests whether the previous one was solid.

### 1. THE PLAYER'S EXPERIENCE (one sentence)
What is the core feeling this story delivers? This is not a plot summary.
It becomes `objective.summary` in the schema.

### 2. THE WORLD'S RULES (3–5 laws)
What is permanently true in this world, regardless of player choices?
These become `fixedRules[]` and are injected into every generation prompt as hard constraints.
Write each rule as a prohibition or absolute fact. It must be specific and falsifiable.

Good:
- "The dead cannot speak unless the lich wills it."  
- "No one crosses the Iron Bridge at night without paying the toll."
- "The mayor's office is always locked from inside."

Bad (too vague to enforce):
- "Magic feels rare and dangerous."
- "The world is grim."

### 3. THE MAP (locations and their connections, fixed forever)
Name every location. For each, write:
- One sentence that would orient a player who just arrived (`description`)
- One atmospheric hint per unexplored exit leading away from it (`explorationHint`)
- Which exits connect where — these never change mid-story

Draw it on paper first. Connections defined here are permanent. The LLM cannot invent 
new routes. Blockers and unfinished business can gate movement, but the topology is fixed.

### 4. THE PROTAGONIST
Who is the player character at the moment the story begins?
Not their backstory — their present:
- What do they carry? (`inventory`)
- What do they know that matters right now? (`memory`)
- What would they rather not do, but have to? (voice + backstory together)

### 5. THE PRESSURE
What gets worse if the player waits? What is the deadline?
This becomes `objective.failureCondition` and the weight of your event table.
Without pressure, the player is a tourist, not an agent.

### 6. EVENTS AND CHOICES (last)
Only now, define events and choices.
Write action choices as imperatives. The player should feel they are commanding their character, 
not selecting a story branch.

Good: "Wedge your shovel under the lid."  
Bad: "Try to open the coffin."

Choices that use `displayStyle: 'dialogue'` should describe intent, not exact words, 
unless you are intentionally giving the player a scripted line.

## What the model can and cannot do

The model enriches prose, NPC reactions, and sensory detail.
It cannot change health, inventory, map position, flags, or story outcomes.
All state changes come from authored `StoryEffect` entries on choices.

Do not write `writerIntent`, `actionPrompt`, or `neutralSummary` as if the model is a 
co-author making decisions. Write them as stage directions for a narrator who executes 
exactly what you specify.

## Originality requirement

All story content — text, names, prompts, comments — must be original.
Do not ask the model to name, quote, imitate, or allude to protected fictional settings, 
characters, authors, franchises, signature passages, or named external works.

## Code style

- Keep UI text player-facing unless it is explicitly debug-only.
- Prefer schema data over hardcoded story behaviour.
- State changes must be deterministic: effects own state, prose owns atmosphere.
- Map topology is fixed: explored nodes may be travelled to; unexplored nodes show only their 
  `explorationHint` or type hint until discovered.
- Run lint and build before submitting.
