# Interactive Fiction Framework

**Interactive Fiction Framework (IFF)** is a schema-driven local AI framework for original, contributor-authored playable stories.

IFF is built around playable protagonists, agency-preserving authored options, consequence-driven dialogue, a compact codex, and local LLM narration. The reader plays a character defined by the story contributor instead of watching a party act automatically.

The current sample story, **The King’s Lich**, follows Tamsin, a gravedigger ordered by King Osric to follow opened graves back to the lich raising the dead.

## Why IFF?

The goal is to make AI-assisted interactive fiction modular and remixable:

- Writers define a story schema instead of hardcoding one campaign.
- Contributors define the playable protagonist, health, inventory, voice, memory, and available actions.
- Story nodes work like a hidden adventure map with weighted random events.
- Authored choices keep state changes deterministic while local generation enriches prose.
- NPCs are generated from templates and remembered by the codex.
- The codex acts as both player reference and compact LLM memory.
- Debug mode exposes prompts, selected choices, generated passages, and applied effects.
- The app runs locally against Ollama, so experiments do not depend on hosted model APIs.

## Features

- Progressive streamed story output
- Playable contributor-authored protagonist
- Structured text log with narration, NPC dialogue, neutral selected-option entries, and consequences
- Authored choice panel with lightweight skill-color labels
- Health points and inventory as visible story state
- Modular `StorySchema` with player data, nodes, weighted events, NPC templates, choices, fixed rules, and codex terms
- Explored-only SVG map graph that hides unreached routes
- Codex with people, places, inventory, biography, memories, and seen events
- Clickable codex terms inside generated text
- Private debug channel
- Local Ollama generation via `/api/generate`

## Getting started

### Requirements

- Node.js 20+
- npm
- [Ollama](https://ollama.com/) running locally
- A local Ollama model, for example:

```bash
ollama pull qwen2.5:7b
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

By default the app expects:

- Endpoint: `http://localhost:11434`
- Model: `qwen2.5:7b`

You can change these in the app’s **Settings** view.

## Scripts

```bash
npm run dev      # start local dev server
npm run build    # typecheck and build
npm run lint     # run ESLint
npm run preview  # preview production build
```

## Story architecture

IFF currently keeps the sample schema in `src/App.tsx`. The important concepts are:

### `StorySchema`

Defines the story title, goal node, fixed rules, public codex terms, playable protagonist, nodes, and events.

### `PlayableCharacter`

Defines the character the end user plays, including:

- Name and role
- Health points
- Inventory
- Skill-color tags
- Voice and backstory
- Recent memory

Inventory items may include compact player-facing tags. Tag labels, summaries, and details are shown in the UI, so they should describe what the player can infer from the item rather than contributor instructions.

### `StoryNode`

Represents a location or map point. Each node controls:

- Public name
- Description
- Broad node type, used for map primitives and unrevealed route hints
- Exits to connected locations
- Optional travel blockers such as required items, cleared flags, locks, curses, or story reasons
- Optional unfinished business that prevents travel away from the current location until authored flags, items, or active event conditions resolve it
- Optional map position
- Weighted event table

Explored connected nodes can be travelled to directly from the map. Unexplored connected nodes appear as type-only route hints and can be explored if they are the nearest unblocked unknown route. Exact names, descriptions, codex entries, and event tables stay hidden until discovery.

### `StoryEvent`

Represents something that can happen at a node. Events can define:

- Weight
- Prompt pressure
- Objective node
- Optional NPC template
- Authored choices

### `StoryChoice`

Represents an action the player can take. Choices can define:

- Player-facing label
- Neutral option summary
- Writer intent for why the option belongs in the scene
- Optional mode such as act, say, ask, use-item, risk, or wait
- Action prompt for generated prose
- Optional inventory requirement
- Subtle skill-color tags
- Deterministic effects such as gaining an item, losing health, remembering a fact, revealing a place, or moving on the map

### `StoryNpcTemplate`

Defines reusable NPCs that can enter the story and then persist in memory.

### `CampaignState`

Tracks the current turn, player state, current scene, explored nodes, known NPCs, feed entries, debug entries, codex memory, flags, and outcome.

## Contributing stories

Story contributions are welcome. A good sample story should include:

- A clear premise
- One playable protagonist with goals, weaknesses, health, inventory, voice, and memory seeds
- 3–8 locations with public names, descriptions, node types, exits, optional blockers, optional unfinished business, optional map positions, and weighted event lists
- Events with scene pressure, authored choices, deterministic effects, and optional NPC templates
- Codex terms that should become clickable in generated text
- A concrete success condition
- A plausible risk of failure
- Generic tone guidance for original narration, such as character-driven investigation, agency-preserving options, and consequence-driven dialogue

Story contributions must be original. Do not ask the model to name, quote, imitate, or allude to protected fictional settings, characters, authors, franchises, signature passages, or named external works.

Good sample ideas:

- Low fantasy village crisis
- Haunted road trip
- Space salvage crew
- Detective mystery
- Disaster survival story
- Mythic pilgrimage
- Cozy town drama with supernatural problems

## Development notes

This project is intentionally early and experimental. Areas that would benefit from contributions:

- Extracting schemas into separate files
- Loading multiple sample stories from a registry
- Adding schema validation with Zod
- Saving/loading runs
- Improving local model prompt adapters
- Adding tests around story progression
- Supporting non-Ollama local model backends
- Improving map layout for larger stories

## License

MIT
