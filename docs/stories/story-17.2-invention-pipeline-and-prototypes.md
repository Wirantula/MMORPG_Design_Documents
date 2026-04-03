# Story 17.2 — Invention Pipeline and Prototypes
**Epic:** 17 | **Role:** Backend Agent | **Status:** Blocked on 17.1 + 8.2

## Problem / intent
Invention covers novel processes, prototypes, and engineering solutions. It sits between crafting and research and feeds world unlock systems with player-driven discoveries.

## Acceptance criteria
- [ ] POST /api/invention/attempt: spend resources and time to attempt a novel prototype
- [ ] Invention uses Mental stats (Creativity, Intelligence) and Research outputs as inputs
- [ ] Success produces a unique prototype item_instance with invention_record
- [ ] Prototype can be submitted to research system as a discovery_contribution
- [ ] Critical success: invention enters review queue for potential new recipe or world unlock
- [ ] Craft Intuition hidden trait modifies quality variance
- [ ] Unit tests: resource spend, Mental stat modifier, success/fail states, prototype creation

## Dependencies
- 17.1 ✅  |  8.2 ✅

## Scope
Only touch: server/src/modules/invention/, infra/migrations/, server/test/

## Implementation notes
- invention_records table: id, character_id, attempt_json, outcome, item_instance_id, submitted_for_review, created_at
- Success chance: base 30% + (Creativity - recipe_difficulty) * 2 + random(-10, +10)
- Critical success (chance 5%): flag for admin/content review

## Test notes
server/test/invention.service.test.ts — stat modifier, success rates, prototype output, critical flag

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 17.2 - Invention Pipeline and Prototypes.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-17.2-invention-pipeline-and-prototypes.md && cat server/src/modules/crafting/crafting.service.ts && cat server/src/modules/research/research.service.ts

STEP 2 - Implement:
  Create infra/migrations/031_create_invention_records.sql
  Create server/src/modules/invention/: invention.module.ts, invention.service.ts (attemptInvention, computeSuccessChance, createPrototype, flagCritical), invention.controller.ts
  POST /api/invention/attempt: validate resources, compute chance, resolve outcome
  Create prototype item_instance on success; log invention_record
  Flag critical success for admin review

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/17.2-invention
  git add server/src/modules/invention/ infra/migrations/031_create_invention_records.sql server/test/
  git commit -m "feat(17.2): invention pipeline with prototypes and critical success review"
  gh pr create --draft --title "feat(17.2): invention pipeline and prototypes" --body "Implements story 17.2. Stat-based success chance, prototype creation, critical success flagging. All criteria met."
```
