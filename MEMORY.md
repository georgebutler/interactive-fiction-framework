# Project Memory

## Keep the README relevant

When changing the framework, story runtime, model integration, or bundled sample story, check whether `README.md` needs the same update. The README should describe what the app actually does today, not an older roadmap or story premise.

Use this checklist before committing meaningful changes:

- If `package.json` scripts or core dependencies change, update the **Tech stack**, **Getting started**, or **Scripts** sections.
- If Ollama defaults, model presets, settings, or generation endpoints change, update **Getting started** and **Local model settings**.
- If runtime architecture changes in `src/App.tsx` or `src/framework/*`, update **Runtime architecture**, **Prompting, validation, and safety rules**, and **Debugging**.
- If story schema or bundle types change in `src/framework/schema.ts`, update **Story authoring model**.
- If Story Bible, director, planner, memory, patterns, validator, or fallback behavior changes, document it in the README architecture sections.
- If `src/stories/open-graves.ts` changes its premise, protagonists, factions, objective, or ending structure, update **Current sample: The Open Graves**.
- If a roadmap item becomes implemented, remove or reword it in **Development notes**.
- Do not claim the LLM owns durable state. The app owns inventory, flags, map movement, effects, validation, and endings.
- Do not document hosted model support, save/load, persistence, tests, or authoring tools unless they are actually implemented.

The README should stay useful to two audiences:

1. Players or contributors trying to run the app locally.
2. Story authors and developers trying to understand how authored data, local generation, validation, and deterministic state fit together.
