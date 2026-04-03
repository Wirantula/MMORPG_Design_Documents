# Story 8.3 — Workshops and Production Spaces
**Epic:** 8 | **Role:** Backend Agent | **Status:** Blocked on 8.2 + 10.1

## Problem / intent
Buildings and workstations should shape production efficiency so infrastructure investment matters.

## Acceptance criteria
- [ ] Workshop types: basic_forge, carpentry_bench, alchemy_lab, kitchen, tannery (data-driven)
- [ ] Each workshop has station_quality (1–5) that multiplies craft quality and reduces time
- [ ] Advanced recipes require minimum workshop tier
- [ ] Workshops owned by settlements or individuals; access permissions enforced
- [ ] GET /api/settlements/:id/workshops and GET /api/characters/:id/workshops
- [ ] Unit tests: quality multiplier, tier gate, permission enforcement

## Dependencies
- 8.2 ✅  |  10.1 ✅

## Scope
Only touch: server/src/modules/workshops/, tools/content/workshops.json, infra/migrations/, server/test/
Do NOT touch: client/, economy/, simulation core/

## Implementation notes
- workshops table: id, settlement_id (nullable), owner_character_id (nullable), type, station_quality, access_policy
- station_quality multiplier: quality * (1 + 0.15 * (station_quality - 1))
- time multiplier: base_time * (1 - 0.1 * (station_quality - 1))

## Test notes
server/test/workshops.service.test.ts — multiplier at each tier, tier gate rejection, permission check

## Observability notes
Log workshop access granted/denied with character_id and workshop_id

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 8.3 - Workshops and Production Spaces.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-8.3-workshops-production-spaces.md && cat server/src/modules/crafting/crafting.service.ts

STEP 2 - Implement:
  Create tools/content/workshops.json: 5 workshop types with tier requirements
  Create infra/migrations/013_create_workshops.sql
  Create server/src/modules/workshops/: workshops.module.ts, workshops.service.ts, workshops.controller.ts
  Apply station_quality multipliers in crafting.service.ts
  GET /api/settlements/:id/workshops, GET /api/characters/:id/workshops
  Enforce access_policy (public/members/owner) in crafting start flow

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/8.3-workshops
  git add server/src/modules/workshops/ tools/content/workshops.json infra/migrations/013_create_workshops.sql server/test/
  git commit -m "feat(8.3): workshops and production spaces with station quality multipliers"
  gh pr create --draft --title "feat(8.3): workshops and production spaces" --body "Implements story 8.3. 5 workshop types, quality/time multipliers, tier gates, permission enforcement. All criteria met."
```
