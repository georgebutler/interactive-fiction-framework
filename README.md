# Interactive Fiction Framework

**Interactive Fiction Framework (IFF)** is a local-first React framework for playable, schema-driven interactive fiction.

IFF combines authored story structure with local LLM narration. Writers define the protagonist, places, events, choices, inventory, consequences, and memory. The model adds prose, but the code owns state: health, items, map movement, revealed locations, flags, and endings stay deterministic.

The current sample story, **The Open Graves**, follows Tamsin, a gravedigger sent by royal order to investigate opened graves around Redvale. The story is grounded medieval fiction: the “lich” is treated as rumor, fear, or an explanation people reach for rather than a guaranteed answer.

## What it does

- Presents a playable protagonist rather than an autonomous party.
- Streams story prose from a local Ollama model.
- Reveals text progressively, with line gating and animated character fade-in.
- Keeps player agency intact by offering authored options instead of asking the model to choose for the player.
- Tracks deterministic state such as health, inventory, flags, known NPCs, revealed map nodes, and outcomes.
- Provides a tabbed play view for **Story**, **Map**, and **Character**.
- Shows codex tooltips inline for known places, people, objects, and rumors.
- Includes a top-down interactive map with discovered routes, unknown route hints, optional selection, and travel buttons.
- Includes a character page with health, biography, memories, and a scrollable inventory.
- Runs locally against Ollama; no hosted model API is required.

## Current sample

**The Open Graves** is the built-in sample story. It is intentionally small and practical so the framework mechanics are easy to inspect:

- **Player character:** Tamsin, a gravedigger under royal order.
- **Core problem:** graves are opening near Redvale, and the court needs proof more than rumors.
- **Tone:** grounded medieval hardship, plain social pressure, burial customs, fear, mud, and practical tools.
- **Structure:** a handful of connected locations, weighted events, authored choices, item checks, consequences, and a return-to-court ending.
- **Important design note:** supernatural explanations are uncertain in the player-facing text. Rumors matter, but proof matters more.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- shadcn/ui-style component primitives
- Radix UI primitives
- Lucide React icons
- React Three Fiber / Drei for the map
- Ollama `/api/generate` for local narration

## Getting started

### Requirements

- Node.js 20+
- npm
- [Ollama](https://ollama.com/) running locally
- A local model, for example:

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

You can change these in the app’s **Settings** panel. The app can also test the configured model connection.

## Scripts

```bash
npm run dev      # start local dev server
npm run build    # typecheck and build
npm run lint     # run ESLint
npm run preview  # preview production build
```

## Player experience

The main play screen is split into a compact left column and a tabbed story area.

### Left column

- Story title and sample label
- Ollama connection status
- Light/dark toggle
- Settings button
- Compact status strip with HP and inventory access

### Story tab

- Current location and objective
- Full-width story log
- Inline codex tooltips for known terms
- Progressive line reveals
- Animated character-by-character text appearance
- A contextual action panel with labels like `Continue`, `Begin`, and `What will Tamsin do next?`

### Map tab

- Top-down route map
- No default selected location
- Click empty map space to deselect
- Select discovered and hinted locations for details
- Travel using a full-width travel button when movement is allowed

### Character tab

- Character details and current condition
- Biography and memories
- Inventory with a scroll area
- Horizontal item rows with icon, name, description, and compact tags

## Story architecture

The current sample schema lives in `src/App.tsx`. The core types are intentionally plain so a contributor can understand the story model without learning a separate editor.

### `StorySchema`

Defines the story title, premise, opening narration, goal node, fixed rules, public codex terms, playable protagonist, map nodes, and events.

### `PlayableCharacter`

Defines the character the user plays:

- Name and role
- Portrait
- Health
- Inventory
- Skill tags
- Voice guidance
- Backstory
- Memory seeds

### `InventoryItem`

Defines player-facing objects. Items can be required by choices, consumed by effects, shown in inventory, and surfaced as codex tooltip terms.

### `StoryNode`

Represents a place on the map. Nodes define:

- Internal id
- Public name
- Description
- Node type
- Exits
- Optional blockers
- Optional unfinished business
- Optional map position
- Weighted event table

Explored connected nodes can be travelled to directly. Unexplored connected nodes can appear as limited route hints until discovered.

### `StoryEvent`

Represents a scene pressure at a location. Events define:

- Prompt pressure
- Optional objective node
- Optional NPC template
- Authored choices
- Weight for random selection

### `StoryChoice`

Represents a player-selectable option. Choices define:

- Label
- Option summary
- Writer intent
- Action mode (`act`, `say`, `ask`, `use-item`, `risk`, `wait`)
- Tone
- Optional skill tags
- Optional item requirement
- Consequence hint
- Deterministic effects

### `StoryEffect`

Effects are the source of truth for state changes. Generated prose may describe what happens, but effects decide what actually changes:

- Gain or lose items
- Damage or heal the player
- Remember facts
- Reveal nodes
- Move to nodes
- Set flags

### `StoryNpcTemplate`

Defines reusable NPC data for generated scenes and codex summaries:

- Name
- Role
- Description
- Voice
- Want
- What they know

### `CampaignState`

Tracks runtime play state:

- Turn count
- Player state
- Current node and event
- Scene open/closed state
- Known NPCs
- Feed entries
- Debug entries
- Explored nodes
- Flags
- Outcome

## Prompting and safety rules

IFF uses prompt rules to preserve player agency:

- Do not write the player character’s private thoughts, feelings, motives, exact speech, or unchosen actions.
- Do not invent health, inventory, map movement, victory, loss, or hidden discoveries.
- Do not reveal future places, hidden routes, or event tables early.
- If a choice is conversational, summarize intent rather than inventing full player dialogue.
- Keep all story material original; do not name, quote, imitate, or allude to protected fictional settings, characters, authors, franchises, or signature passages.

The model can enrich visible prose, NPC reactions, and sensory details. It cannot override mechanical state.

## Debugging

The Settings panel includes a debug toggle. Debug mode records useful development details such as:

- Generated prompts
- Selected choice data
- Applied effects
- Model errors
- Narration traces

This is intended for story authors and framework development rather than normal play.

## Contributing stories

A good story contribution should include:

- A clear premise
- One playable protagonist with a practical goal
- 3–8 locations
- A small inventory with meaningful use cases
- Authored choices with deterministic effects
- NPC templates where scenes need characters
- Codex terms with useful player-facing summaries
- A concrete success condition
- A plausible failure state

Story tone can vary, but contributions should keep agency clear and state deterministic. The player should understand what kind of action they are choosing, while the prose can preserve uncertainty and surprise.

## Development notes

Useful future improvements:

- Move sample story schemas out of `src/App.tsx`
- Add a story registry
- Add Zod validation for story schemas
- Add automated tests for progression and blockers
- Add more local model adapters beyond Ollama
- Improve map layout for larger stories
- Add save slot management
- Add authoring tools for codex terms and tooltip summaries

## License

MIT
