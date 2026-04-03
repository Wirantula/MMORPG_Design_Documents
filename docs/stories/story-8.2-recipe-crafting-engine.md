# Story 8.2 — Recipe and Crafting Engine
**Epic:** 8 | **Role:** Backend Agent | **Status:** Blocked on 8.1 + 4.2 + 6.1

## Problem / intent
Crafters need to produce useful items so non-combat progression is real and economically meaningful.

## Acceptance criteria
- [ ] Recipes defined in tools/content/recipes.json: inputs (item_canonical_ids + quantities), output_template_id, time_seconds, required_skill_id + min_level
- [ ] POST /api/crafting/start validates inventory, reserves inputs, creates craft_job
- [ ] Craft job resolves on tick; output quality varies with skill level and stats
- [ ] Quality range: 50–150% of base stats (normal distribution, skill shifts mean)
- [ ] Failure states: critical fail destroys inputs, partial fail produces degraded item
- [ ] GET /api/characters/:id/craft-jobs returns active and completed jobs
- [ ] Unit tests: input reservation, quality variance, failure states, completion

## Dependencies
- 8.1 ✅  |  4.2 ✅  |  6.1 ✅

## Scope
Only touch: server/src/modules/crafting/, tools/content/recipes.json, infra/migrations/, server/test/
Do NOT touch: client/, economy/, auth/

## Implementation notes
- craft_jobs table: id, character_id, recipe_id, status, started_at, completes_at, output_instance_id
- Quality formula: base + (skill_level - recipe_min_level) * 0.5 + random(−25, +25)
- Inputs reserved on job start; released on fail; consumed on success

## Test notes
server/test/crafting.service.test.ts — start, tick resolution, quality curve, fail state

## Observability notes
Log craft job start/complete/fail with character_id, recipe_id, quality_score

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 8.2 - Recipe and Crafting Engine.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-8.2-recipe-crafting-engine.md && cat server/src/modules/items/items.service.ts && cat server/src/modules/simulation/tick.service.ts

STEP 2 - Implement:
  Create tools/content/recipes.json: 10 starter recipes covering food, tools, basic weapons
  Create infra/migrations/012_create_craft_jobs.sql
  Create server/src/modules/crafting/: crafting.module.ts, crafting.service.ts (startCraft, resolveCraft, computeQuality), crafting.controller.ts
  POST /api/crafting/start, GET /api/characters/:id/craft-jobs
  Wire resolveCraft() into tick.service.ts
  Reserve inputs on start; compute quality on complete; handle failure states

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/8.2-crafting-engine
  git add server/src/modules/crafting/ tools/content/recipes.json infra/migrations/012_create_craft_jobs.sql server/test/
  git commit -m "feat(8.2): recipe and crafting engine with quality variance and failure states"
  gh pr create --draft --title "feat(8.2): recipe and crafting engine" --body "Implements story 8.2. Recipe DSL, craft jobs, quality formula, failure states. All criteria met."
```
