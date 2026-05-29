# Contributing to Interactive Fiction Framework

Thanks for wanting to contribute to IFF.

This project is meant to grow through code improvements, sample stories, schemas, prompts, UI polish, and design ideas.

## Ways to contribute

- Add sample stories or story ideas
- Improve the schema architecture
- Improve prompt reliability
- Improve map and codex UX
- Add tests
- Improve documentation
- Add support for more local model backends
- Report bugs with screenshots or reproduction steps

## Story contribution guidelines

When contributing a story sample, include:

1. **Premise** — one or two sentences explaining the adventure.
2. **Characters** — 2–5 protagonists with goals, weaknesses, inventory, and memory seeds.
3. **Nodes** — locations with public names, descriptions, exits, icons, and weighted event lists.
4. **Events** — scene pressures with objective nodes and optional NPC templates.
5. **Codex terms** — important places, people, objects, factions, or ideas.
6. **Failure pressure** — a believable way the story can go badly.
7. **Tone** — examples of what the narration should feel like.

## Code style

- Keep UI text audience-facing unless it is explicitly debug-only.
- Prefer schema data over hardcoded story behavior.
- Keep story generation prompts clear and modular.
- Run lint and build before submitting changes.

```bash
npm run lint
npm run build
```

## Local model assumptions

IFF currently targets Ollama streaming through `/api/generate`. If you add another backend, keep the app local-first and avoid requiring hosted API keys for the default experience.

## Pull request checklist

- [ ] The change has a clear purpose.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Story/schema changes do not reveal hidden map nodes to the normal audience view.
- [ ] Debug-only information remains behind debug mode.
- [ ] New UI copy is written for the end user, not for developers.
