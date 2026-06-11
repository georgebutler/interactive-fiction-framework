# Interactive Fiction Framework

**Interactive Fiction Framework (IFF)** is a local-first React framework for playable, schema-driven interactive fiction.

IFF combines authored story bundles with a runtime layer that plans scenes, tracks memory and simulation pressure, prompts a local Ollama model, validates structured scene JSON, and falls back safely when generation fails. The model writes visible prose, reactions, atmosphere, and uncertainty. The application owns durable state: inventory, flags, explored map nodes, events, consequences, protagonist selection, scene plans, memory snapshots, and endings.

## What it does

- Presents a choosable protagonist rather than an autonomous party.
- Streams story prose from a local Ollama model.
- Uses a Story Bible as the highest-authority narrative context for generated scenes.
- Selects scene pressure through a lightweight director layer.
- Builds scene plans and planner-approved choice intents before prompting the model.
- Requests structured scene JSON for scene openings and resolutions.
- Validates generated output with Zod and safety checks before showing it to the player.
- Falls back to deterministic prose when model output is invalid, unsafe, or malformed.
- Keeps player agency intact through authored or planner-approved options.
- Tracks deterministic state such as inventory, flags, known NPCs, revealed map nodes, and outcomes.
- Tracks memory across canonical state, recent scenes, character memory, and rumors.
- Tracks simulation pressure such as tension, relationships, reputation, quests, and director state.
- Provides a tabbed play view for **Story**, **Map**, and **Character**.
- Shows codex tooltips inline for known places, people, objects, and rumors.
- Includes an interactive 3D map with discovered routes, unknown route hints, optional selection, and travel buttons.
- Runs locally against Ollama; no hosted model API is required.

## Current sample: The Open Graves

**The Open Graves** is the built-in sample story. Opened graves in Redvale have become a struggle over public truth: Graymere Court wants order, Redvale Church wants meaning, villagers want their dead remembered correctly, and royal archivists need the records to remain trustworthy.

The player chooses one protagonist:

- **Tamsin Vale** — a Redvale grave-tender with high mental fortitude, burial knowledge, and firsthand experience of records burying the wrong truth.
- **Corvin Hale** — a retired mercenary with high strength, practical restraint, and a history of seeing lawful certainty punish the wrong person.

The goal is not to prove a monster. The goal is to gather **Contested Evidence** strong enough to make King Osric’s court hear more than one explanation before a convenient certainty becomes law.

The sample keeps several explanations plausible: crime, panic, fraud, sabotage, spiritual fracture, archival failure, or something still unnamed. No scene should confirm one final supernatural, criminal, political, clerical, archival, or psychological cause.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- shadcn/ui-style component primitives
- Radix UI primitives
- Lucide React icons
- React Three Fiber / Drei / Three for the map
- Zod for generated scene JSON validation
- Ollama `/api/tags` for local model discovery
- Ollama `/api/generate` for local streaming narration

## Getting started

### Requirements

- Node.js 20+
- npm
- [Ollama](https://ollama.com/) running locally
- A local model. Recommended default:

```bash
ollama pull qwen3.6
```

Lower-resource Llama alternative:

```bash
ollama pull llama3.2:3b
```

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

Open the local Vite URL shown in your terminal.

By default the app uses:

- Endpoint: `http://localhost:11434`
- Model mode: **Auto**
- Recommended model: `qwen3.6:latest`

Auto mode checks installed Ollama models through `/api/tags` and picks the best recognized local model for the selected preset. Narration streams through `/api/generate`.

## Local model settings

IFF runs against a local Ollama endpoint. The Settings panel lets you configure:

- Endpoint
- Model selection
- Preset: `Auto`, `Fast`, `Balanced`, `Quality`, or `Custom`
- Thinking mode
- Temperature
- Top P
- Repeat penalty
- Context window
- Max generated tokens
- Connection test

Use **Auto** for normal local play. Use **Custom** when testing a specific model, context size, or generation profile.

## Scripts

```bash
npm run dev      # start local dev server
npm run build    # typecheck and build
npm run lint     # run ESLint
npm run preview  # preview production build
```

## Player experience

IFF starts with story and protagonist selection, then shows a protagonist intro before play begins.

The main play screen is split into a compact left column and a tabbed story area.

### Left column

- Story title and sample label
- Ollama connection status
- Light/dark toggle
- Settings button

### Story tab

- Current location title and description
- Full-width story log
- Inline codex tooltips for known terms
- Contextual choice cards with mode labels such as `Act`, `Wait`, `Ask`, `Say`, `Use`, and `Risk`
- Skill tags aligned with options when relevant
- Confirmation for choices with lasting consequences

### Map tab

- Interactive route map
- Current, discovered, and hinted locations
- Click empty map space to deselect
- Select discovered and hinted locations for details
- Travel using a full-width travel button when movement is allowed
- Blocker text when unfinished business or item requirements prevent travel

### Character tab

- Character details and current condition
- Biography, voice, and memories
- Inventory with a scroll area
- Horizontal item rows with icon, name, description, and compact tags

## Runtime architecture

IFF separates authored story data from runtime orchestration.

### Source layout

- `src/framework/schema.ts` — reusable story schema, deterministic effects, runtime config, and story bundle types.
- `src/framework/story-bible.ts` — vNext Story Bible types, legacy schema adapter, and prompt formatter.
- `src/framework/director.ts` — scene type, purpose, tension, pattern, and adapted-event selection.
- `src/framework/planner.ts` — authored event adaptation, choice intents, support choices, and procedural scene plans.
- `src/framework/memory.ts` — canonical, scene, character, and rumor memory snapshots.
- `src/framework/patterns.ts` — narrative patterns and choice-mix validation.
- `src/framework/validator.ts` — Zod schemas, generated scene validation, safety checks, and deterministic fallbacks.
- `src/stories/open-graves.ts` — authored sample story content and vNext Story Bible.
- `src/stories/index.ts` — story registry/default story export.
- `src/App.tsx` — React UI, runtime orchestration, Ollama calls, prompts, state transitions, map, settings, and debug feed.

### Scene flow

A typical scene flow is:

1. The app reads the current node, event history, flags, memory, and simulation state.
2. The director selects a scene type, purpose, tension target, narrative pattern, and candidate authored event.
3. The planner adapts authored choices into choice intents and adds safe, investigative, risky, or character-focused support choices as needed.
4. The app prompts the local model for structured scene JSON.
5. The validator parses, validates, and safety-checks the JSON.
6. If validation fails, the runtime uses a deterministic fallback scene or resolution.
7. Only authored or planner-approved consequences mutate durable state.

### Story Bible

The Story Bible is the vNext narrative authority used by generated scenes. It can define:

- Themes
- Tone
- World rules
- Narrative laws
- Factions
- Locations
- Characters
- Threats
- Mysteries
- Narrative patterns

Story bundles can provide `vNext.bible`. If they do not, the app can derive a compatible Story Bible from the legacy schema.

### Simulation state

The runtime can track more than immediate story flags:

- Tension
- Relationship scores
- Faction reputation
- Quest progress
- Director state

This state is used to shape prompts, scene pressure, and future planning. It does not allow generated prose to bypass deterministic effects.

## Story authoring model

The current story format remains compatible with authored `StorySchema` bundles. Newer stories can also provide a vNext Story Bible for richer narrative authority.

### `StoryBundle`

A bundled story includes:

- `schema` — authored story data.
- `iconAssets` — icon id to asset path mapping.
- `skillTagDefinitions` — labels and summaries for choice/protagonist skill tags.
- `allKnownItems` — item definitions available to codex and runtime references.
- `codexTermTargets` — explicit codex target mappings.
- `codexTermSummaries` — player-facing codex summaries.
- `runtime` — initial node, explored nodes, victory condition, objective text, and narration style rule.
- `vNext.bible` — optional Story Bible.

### `StorySchema`

Defines the story title, premise, objective, opening narration, goal node, fixed rules, public codex terms, playable protagonists, map nodes, and events.

`fixedRules` are absolute model constraints. Each string should be one world law, written as a prohibition or absolute fact.

`objective` defines schema-owned quest pressure shown in the HUD and injected into prompts. Keep `summary` to one player-facing sentence; use `successCondition` and `failureCondition` to define deterministic end pressure; use optional `currentHint` or event-level `currentHint` for immediate contextual direction.

### `PlayableCharacter`

Defines a character the user can choose to play:

- Name and role
- Portrait
- Current condition text
- Inventory
- Skill tags
- Aptitudes such as strength and mental fortitude
- Voice guidance
- Backstory
- Memory seeds

Protagonist choice is presentation state, not plot branching by default. The sample uses protagonist voice, aptitudes, backstory, inventory, and memories to color generated prose and choices while flags, map movement, revealed nodes, and outcomes remain deterministic code-owned state.

### `InventoryItem`

Defines player-facing objects. Items can be required by choices, consumed by effects, shown in inventory, and surfaced as codex tooltip terms.

### `StoryNode`

Represents a place on the map. Nodes define:

- Internal id
- Public name
- Optional canonical description to seed confirmed facts before generation
- Description
- Optional exploration hint for unreached exits
- Node type
- Exits
- Optional blockers
- Optional unfinished business
- Optional map position
- Weighted event table

Explored connected nodes can be travelled to directly. Unexplored connected nodes can appear as limited route hints until discovered.

### `StoryEvent`

Represents scene pressure at a location. Events define:

- Prompt pressure
- Optional objective node
- Optional NPC template
- Authored choices
- Weight for random selection

Events can be adapted by the planner into procedural scene plans while preserving authored constraints and deterministic consequences.

### `StoryChoice`

Represents a player-selectable option. Choices define:

- Label
- Action mode (`act`, `say`, `ask`, `use-item`, `risk`, `wait`)
- Display style (`action`, `dialogue`, `passive`)
- Skill tags
- Optional item requirement
- Prompt-only writer intent, neutral summary, and action prompt
- Deterministic effects
- Optional generated intent metadata

Write action choices as imperatives. The player should feel they are issuing a command to their character, not selecting a story branch. Good: `Wedge your shovel under the lid.` Bad: `Try to open the coffin.`

For `ask` and `say` choices, labels should be the exact line the character will speak whenever possible.

### `StoryEffect`

Effects are the source of truth for state changes. Generated prose may describe what happens, but effects decide what actually changes:

- Gain or lose items
- Remember facts
- Reveal nodes
- Move to nodes
- Set flags

### `StoryNpcTemplate`

Defines reusable NPC data for generated scenes and codex summaries:

- Name
- Role
- Optional canonical description to seed confirmed facts when introduced
- Description
- Voice
- Want
- What they know

### Runtime state

The app tracks runtime play state including:

- Player state
- Run profile texture
- Current node, event, and scene plan
- Scene open/closed state
- Known NPCs
- Event history
- Feed entries
- Debug entries
- Explored nodes
- Flags
- Canonical facts confirmed by first-authored or first-generated descriptions
- Simulation state
- Outcome

## Prompting, validation, and safety rules

IFF uses prompt rules and validation to preserve player agency:

- Do not write the player character’s private thoughts, feelings, motives, exact speech, or unchosen actions.
- Do not invent inventory, map movement, victory, loss, or hidden discoveries.
- Describe visible condition changes naturally, without HP, bars, levels, numbers, or percentages.
- Do not reveal future places, hidden routes, or event tables early.
- Keep all story material original; do not name, quote, imitate, or allude to protected fictional settings, characters, authors, franchises, or signature passages.
- Do not claim durable state changed unless a code-owned effect says it changed.

For structured scene generation, the model must return JSON matching the expected scene schema. The validator rejects or warns on:

- Forbidden state mutation fields
- Unapproved generated choice ids
- Player mind-reading
- Future spoilers
- Claims that inventory, flags, location, victory, defeat, or other durable state changed without code-owned effects

If the model returns malformed JSON, invalid schema fields, unsafe content, or unapproved choices, IFF uses a deterministic fallback scene or resolution generated from the current plan and known effects.

The model can enrich visible prose, NPC reactions, and sensory details. It cannot override mechanical state.

## Debugging

The Settings panel includes a debug toggle. Debug mode records useful development details such as:

- Generated prompts
- Selected choice data
- Applied effects
- Model errors
- Narration traces
- Director beat selection
- Scene plan data
- Structured JSON validation reports
- Fallback usage

The Settings panel also includes a connection test for the configured Ollama endpoint and model.

Debugging is intended for story authors and framework development rather than normal play.

## Contributing stories

A good story contribution should include:

- A clear premise
- One or more playable protagonists with a practical goal
- 3–8 locations
- A small inventory with meaningful use cases
- Authored choices with deterministic effects
- NPC templates where scenes need characters
- Codex terms with useful player-facing summaries
- A Story Bible with themes, tone, factions, threats, mysteries, and narrative patterns when the story needs richer generated context
- A concrete success condition
- A plausible failure state

Story tone can vary, but contributions should keep agency clear and state deterministic. The player should understand what kind of action they are choosing, while the prose can preserve uncertainty and surprise.

### Writing world rules

World rules are model constraints, not flavor text. They are injected into generation prompts as absolute laws the narrator must not contradict.

Write each rule so it is specific and falsifiable. A good rule should make it clear when generated prose has broken it.

Good examples:

- `No scene may prove a single supernatural, criminal, political, clerical, archival, or psychological cause for the opened graves.`
- `Blackpine Road has no northern exit.`
- `Inventory changes only through authored effects.`

Avoid broad mood guidance such as `The world is grim` or `Magic feels rare`. Put tone and atmosphere in the Story Bible, scene prompts, node descriptions, or writer intent instead.

## Development notes

Useful future improvements:

- Add authored story bundle validation for `StorySchema` and `StoryBundle` content.
- Add automated tests for director/planner progression, blockers, validation fallbacks, and story endings.
- Add more local model adapters beyond Ollama.
- Improve map layout for larger stories.
- Add authoring tools for Story Bible entries, codex terms, and tooltip summaries.

## License

MIT
