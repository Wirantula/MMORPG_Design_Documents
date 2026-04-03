# Story 17.1 — Research Queues and Discovery
**Epic:** 17 | **Role:** Backend Agent | **Status:** Blocked on 5.3 + 6.1 + 8.1

## Problem / intent
Research uncovers formulas, world secrets, technologies, and unlock conditions. It is a macro-system driver and must reward Intelligence and Focus stats meaningfully.

## Acceptance criteria
- [ ] Research topics defined in tools/content/research.json: id, name, domain, required_skills, base_duration_days, outputs_json
- [ ] POST /api/research/start: assign character to research topic (one active per character)
- [ ] Research progress advances each in-game day via tick; hidden Research Spark trait modifies breakthrough chance
- [ ] Completion outputs: formula_unlocked, tech_discovered, skill_hint, world_secret_fragment
- [ ] Research breakthroughs emitted as PotentialBreakpointReached domain event
- [ ] GET /api/characters/:id/research — active and completed research
- [ ] Unit tests: research tick progress, breakthrough roll, completion outputs, spark trait modifier

## Dependencies
- 5.3 ✅  |  6.1 ✅  |  8.1 ✅

## Scope
Only touch: server/src/modules/research/, tools/content/research.json, infra/migrations/, server/test/
Do NOT touch: client/, economy/, combat/

## Implementation notes
- research_projects table: id, character_id, topic_id, progress_pct, status, started_at, completed_at, output_json
- Breakthrough chance: base_chance * (1 + research_spark_weight * 0.01)
- Completion output stored as JSONB; consumed by unlock engine or skill system

## Test notes
server/test/research.service.test.ts — tick progress, breakthrough, output generation

## Observability notes
Emit PotentialBreakpointReached with character_id, topic_id, output_type

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 17.1 - Research Queues and Discovery.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-17.1-research-queues-and-discovery.md && cat server/src/modules/simulation/tick.service.ts && cat server/src/modules/characters/traits/trait.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create tools/content/research.json: 10 research topics across Combat, Crafting, Science, Magic, Governance domains
  Create infra/migrations/030_create_research_projects.sql
  Create server/src/modules/research/: research.module.ts, research.service.ts (startResearch, tickResearch, rollBreakthrough, completeResearch), research.controller.ts
  Wire tickResearch() into tick.service.ts daily tick
  Apply Research Spark trait modifier on breakthrough roll
  POST /api/research/start, GET /api/characters/:id/research
  Emit PotentialBreakpointReached on breakthrough

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/17.1-research
  git add server/src/modules/research/ tools/content/research.json infra/migrations/030_create_research_projects.sql server/test/
  git commit -m "feat(17.1): research queues, discovery pipeline, and breakthrough rolls"
  gh pr create --draft --title "feat(17.1): research queues and discovery" --body "Implements story 17.1. 10 research topics, daily tick progress, breakthrough rolls, Research Spark trait modifier. All criteria met."
```
