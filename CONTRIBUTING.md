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
2. **Playable character** — one protagonist with goals, weaknesses, health points, inventory, voice, and memory seeds.
3. **Nodes** — locations with public names, descriptions, broad node types, exits, optional travel blockers, optional unfinished business, optional map positions, and weighted event lists.
4. **Events** — scene pressures with objective nodes, authored choices, deterministic effects, and optional NPC templates.
5. **Choices** — player-facing options with labels, neutral summaries, writer intent, requirements, skill-color tags, and consequences.
6. **Codex terms** — important places, people, objects, factions, or ideas.
7. **Failure pressure** — a believable way the story can go badly.
8. **Tone** — generic guidance for original narration, such as character-driven investigation, agency-preserving options, and consequence-driven dialogue.

Stories, prompts, comments, and documentation must be original. Do not ask the model to name, quote, imitate, or allude to protected fictional settings, characters, authors, franchises, signature passages, or named external works.

Do not ask the model to write the player character's private thoughts, exact speech, or unchosen intent. If a choice is conversational, describe the intent the player can select rather than inventing a full line of dialogue unless exact quoted speech is intentionally authored as the selectable option.

## Code style

- Keep UI text audience-facing unless it is explicitly debug-only.
- Prefer schema data over hardcoded story behavior.
- Keep state changes deterministic: generated prose can enrich a moment, but inventory, health, map movement, and outcomes should come from authored effects.
- Keep free map travel deterministic: explored connected nodes may be travelled to, unexplored connected nodes should reveal only type-level hints until discovered, and blockers or unfinished business should be explicit schema data.
- Keep item tag labels, summaries, and details compact, concrete, and player-facing. Do not put author-only or prompt-engineering instructions in normal tag UI.
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
- [ ] Story and prompt text are original and do not request imitation of protected works or named external styles.
