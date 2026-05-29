# Interactive Fiction Framework

**Interactive Fiction Framework (IFF)** is a schema-driven local AI framework for progressive text adventures.

IFF is built around stories that unfold like a visual novel or tabletop scene viewed from the outside: the audience presses **Next**, the narrator frames the scene, characters discuss what to do, NPCs respond, and a private narrator validation decides whether the scene has been resolved.

The current sample story, **The King’s Lich**, follows three unwilling volunteers sent by King Osric to stop a lich raising an increasing number of undead.

## Why IFF?

The goal is to make AI-assisted interactive fiction modular and remixable:

- Writers define a story schema instead of hardcoding one campaign.
- Scenes can span multiple AI turns instead of resolving immediately.
- Story nodes work like a hidden adventure map with weighted random events.
- NPCs are generated from templates and remembered by the codex.
- The codex acts as both audience reference and compact LLM memory.
- Debug mode exposes private character/narrator exchanges and scene validation.
- The app runs locally against Ollama, so experiments do not depend on hosted model APIs.

## Features

- Progressive streamed story output
- One-button story advancement
- Visual novel inspired chat log
- Modular `StorySchema` with nodes, weighted events, NPC templates, fixed rules, and codex terms
- Explored-only SVG map graph that hides unreached routes
- Codex with people, places, inventories, biographies, memories, and seen events
- Clickable codex terms inside generated text
- Private debug narrator channel
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

Defines the story title, goal node, fixed rules, public codex terms, nodes, and events.

### `StoryNode`

Represents a location or map point. Each node controls:

- Public name
- Description
- Icon
- Hidden exits
- Weighted event table

### `StoryEvent`

Represents something that can happen at a node. Events can define:

- Weight
- Prompt pressure
- Objective node
- Optional NPC template

### `StoryNpcTemplate`

Defines reusable NPCs that can enter the story and then persist in memory.

### `CampaignState`

Tracks the current turn, current scene, explored nodes, known NPCs, feed entries, debug entries, codex memory, and outcome.

## Contributing stories

Story contributions are welcome. A good sample story should include:

- A clear premise
- 3–8 locations
- Weighted events for each location
- At least one NPC template
- Codex terms that should become clickable in generated text
- A concrete success condition
- A plausible risk of failure
- A tone guide for the narrator and characters

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
