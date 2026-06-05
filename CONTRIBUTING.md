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

**The player never sees the schema. Every field you define should serve what the player experiences — not what the framework needs to function.**

When contributing a story sample, prepare it in this order:

1. **THE PLAYER'S EXPERIENCE**
   
   Describe the fantasy your story delivers to a player who knows nothing about the schema.
   
   “The player feels like a lone investigator in a fog-bound coastal town.”
   
   “The player feels like a soldier making impossible choices behind enemy lines.”
   
   This goes first. If a contributor can't write this sentence, the story isn't ready.

2. **THE WORLD'S RULES (3–5 absolute facts)**
   
   What is always true in this world regardless of player action?
   
   These become `fixedRules` in the schema and are injected into every generation prompt.

3. **THE MAP (locations and their connections)**
   
   Name every location. For each, write one atmospheric sentence that would orient a player who just arrived. Define exits by name and direction — these are fixed forever.
   
   Optionally write an `explorationHint` for each exit that leads to an unexplored node.

4. **THE PROTAGONIST**
   
   Who is the player character right now, at the start of the story?
   
   Not their history — their present: what they carry, what they know, what they fear.

5. **THE PRESSURE**
   
   What forces the player to act? What gets worse if they wait?
   
   This becomes event weighting and the `objective.failureCondition`.

6. **THE EVENTS & CHOICES**
   
   Only after the above are solid, define the authored events and choices.

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
