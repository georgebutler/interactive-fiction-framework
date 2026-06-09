# Interactive Fiction Framework

**Interactive Fiction Framework (IFF)** is a local-first React framework for playable, schema-driven interactive fiction.

IFF combines authored story structure with local LLM narration. Writers define the protagonist, places, events, choices, inventory, consequences, and memory. The model adds prose and maintains the protagonist’s visible condition as text, while the code owns deterministic state such as items, map movement, revealed locations, flags, and endings.

The current sample story, **The Open Graves**, follows Tamsin, a gravedigger sent by royal order to investigate opened graves around Redvale. The story is grounded medieval fiction: the “lich” is treated as rumor, fear, or an explanation people reach for rather than a guaranteed answer.

## What it does

- Presents a playable protagonist rather than an autonomous party.
- Streams story prose from a local Ollama model.
- Keeps player agency intact by offering authored options instead of asking the model to choose for the player.
- Tracks deterministic state such as inventory, flags, known NPCs, revealed map nodes, and outcomes, while showing condition as prose.
- Provides a tabbed play view for **Story**, **Map**, and **Character**.
- Shows codex tooltips inline for known places, people, objects, and rumors.
- Includes a top-down interactive map with discovered routes, unknown route hints, optional selection, and travel buttons.
- Includes a character page with condition text, biography, memories, and a scrollable inventory.
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
- Recommended model: `qwen3.6`

Auto mode picks the best installed Ollama model it recognizes, so story contributors normally do not need to configure model settings. You can change presets, choose a specific model, tune generation options, and test the configured connection in the app’s **Settings** panel.

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

### Story tab

- Current location and objective
- Full-width story log
- Inline codex tooltips for known terms
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

The reusable story schema types live in `src/framework/schema.ts`. Bundled stories live under `src/stories/`; the current sample, **The Open Graves**, lives in `src/stories/open-graves.ts` and is exposed through `src/stories/index.ts`.

### Source layout

- `src/framework/schema.ts` — reusable story schema and story bundle types.
- `src/stories/open-graves.ts` — authored sample story content, assets, codex summaries, and sample-specific runtime config.
- `src/stories/index.ts` — story registry/default story export.
- `src/App.tsx` — current app runtime, UI, prompting, and story bundle wiring.

### `StorySchema`

Defines the story title, premise, objective, opening narration, goal node, fixed rules, public codex terms, playable protagonist, map nodes, and events.

`fixedRules` are absolute model constraints. Each string should be one world law, written as a prohibition or absolute fact.

`objective` defines the schema-owned quest pressure shown in the HUD and injected into prompts. Keep `summary` to one player-facing sentence; use `successCondition` and `failureCondition` to define deterministic end pressure; use optional `currentHint` or event-level `currentHint` for immediate contextual direction.

### `PlayableCharacter`

Defines the character the user plays:

- Name and role
- Portrait
- Current condition text
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

Represents a scene pressure at a location. Events define:

- Prompt pressure
- Optional objective node
- Optional NPC template
- Authored choices
- Weight for random selection

### `StoryChoice`

Represents a player-selectable option. Choices define:

- Label
- Action mode (`act`, `say`, `ask`, `use-item`, `risk`, `wait`)
- Display style (`action`, `dialogue`, `passive`)
- Skill tags
- Optional item requirement
- Prompt-only writer intent, neutral summary, and action prompt
- Deterministic effects

Write action choices as imperatives. The player should feel they are issuing a command to their character, not selecting a story branch. Good: `Wedge your shovel under the lid.` Bad: `Try to open the coffin.`

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

### `CampaignState`

Tracks runtime play state:

- Player state
- Current node and event
- Scene open/closed state
- Known NPCs
- Feed entries
- Debug entries
- Explored nodes
- Flags
- Canonical facts confirmed by first-authored or first-generated descriptions
- Outcome

## Prompting and safety rules

IFF uses prompt rules to preserve player agency:

- Do not write the player character’s private thoughts, feelings, motives, exact speech, or unchosen actions.
- Do not invent inventory, map movement, victory, loss, or hidden discoveries.
- Describe visible condition changes naturally, without HP, bars, levels, numbers, or percentages.
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

### Writing World Rules

World rules are model constraints, not flavour text. They are injected into every generation prompt as absolute laws the narrator must not contradict.

Write each rule so it is specific and falsifiable. A good rule should make it clear when generated prose has broken it.

Good examples:

- `The dead cannot speak unless the lich wills it.`
- `King Osric's word is law. No NPC defies him openly.`
- `Blackpine Road has no northern exit.`

Avoid broad mood guidance such as `The world is grim` or `Magic feels rare`. Put tone and atmosphere in scene prompts, node descriptions, or writer intent instead.

## Development notes

Useful future improvements:

- Add Zod validation for story schemas
- Add automated tests for progression and blockers
- Add more local model adapters beyond Ollama
- Improve map layout for larger stories
- Add authoring tools for codex terms and tooltip summaries

## License

MIT
