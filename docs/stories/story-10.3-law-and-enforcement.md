# Story 10.3 — Law and Enforcement
**Epic:** 10 | **Role:** Backend Agent | **Status:** Blocked on 10.2

## Problem / intent
Grief-resistant law mechanics make permadeath viable by constraining unchecked hostility.

## Acceptance criteria
- [ ] Settlements can define law rules: permitted_pvp (bool), tax_rate (0–30%), restricted_items list
- [ ] Crime flags: theft, assault, murder — stored per character per settlement
- [ ] Wanted status set when crime_count exceeds threshold; cleared by serving sentence or paying fine
- [ ] Safe zones: infant/child characters cannot be attacked regardless of law
- [ ] Bounty hook: any citizen can post a bounty on a wanted character (links to contracts)
- [ ] GET /api/settlements/:id/laws, POST /api/settlements/:id/laws, GET /api/characters/:id/crime-record
- [ ] Unit tests: crime flag, wanted status, safe zone protection, bounty creation

## Dependencies
- 10.2 ✅

## Scope
Only touch: server/src/modules/settlements/law/, infra/migrations/, server/test/

## Implementation notes
- settlement_laws table: settlement_id, rule_key, rule_value_json
- character_crime_records table: character_id, settlement_id, crime_type, count, wanted, cleared_at
- Age protection check uses lifecycle.service.ts

## Test notes
server/test/law.service.test.ts — crime threshold → wanted, safe zone block, bounty post

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 10.3 - Law and Enforcement.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-10.3-law-and-enforcement.md && cat server/src/modules/settlements/settlements.service.ts && cat server/src/modules/characters/lifecycle/lifecycle.service.ts

STEP 2 - Implement:
  Create infra/migrations/018_create_laws.sql: settlement_laws + character_crime_records
  Create server/src/modules/settlements/law/: law.service.ts, law.controller.ts
  GET /api/settlements/:id/laws, POST /api/settlements/:id/laws
  GET /api/characters/:id/crime-record
  Enforce age protection (infant/child safe zone) by checking lifecycle stage
  Wanted threshold logic: flag character as wanted when crime_count >= 3

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/10.3-law-enforcement
  git add server/src/modules/settlements/law/ infra/migrations/018_create_laws.sql server/test/
  git commit -m "feat(10.3): law, crime flags, wanted status, and safe zones"
  gh pr create --draft --title "feat(10.3): law and enforcement" --body "Implements story 10.3. Settlement laws, crime records, wanted status, age-protected safe zones. All criteria met."
```
