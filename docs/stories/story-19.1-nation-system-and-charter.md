# Story 19.1 — Nation System and Charter
**Epic:** 19 | **Role:** Backend Agent | **Status:** Blocked on 10.2 + 11.1

## Problem / intent
Nations are player-founded macro-polities that group settlements under shared law, taxation, and identity. They give political players a world-scale theatre of influence.

## Acceptance criteria
- [ ] Nations founded by charter: requires 3+ settlements and 100+ total citizens
- [ ] Nation has: name, founding_charter_text, capital_settlement_id, leader_character_id, tax_rate
- [ ] Settlements can join/leave nations via vote of their governors
- [ ] National law overrides settlement law where more restrictive
- [ ] National treasury: tax_rate % of all settlement transactions flows up
- [ ] POST /api/nations/found, GET /api/nations/:id, PATCH /api/nations/:id/law
- [ ] GET /api/nations/:id/settlements — member settlements
- [ ] Unit tests: founding requirements, settlement join/leave, law precedence, treasury flow

## Dependencies
- 10.2 ✅  |  11.1 ✅

## Scope
Only touch: server/src/modules/nations/, infra/migrations/, server/test/

## Implementation notes
- nations table: id, name, charter_text, capital_settlement_id, leader_character_id, tax_rate, founded_at
- nation_members table: nation_id, settlement_id, joined_at
- Law precedence: check national law first, fall back to settlement law
- Wire national tax deduction into economy transaction flow

## Test notes
server/test/nations.service.test.ts — founding check, settlement join/leave vote, tax flow

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 19.1 - Nation System and Charter.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-19.1-nation-system-and-charter.md && cat server/src/modules/settlements/settlements.service.ts && cat server/src/modules/settlements/law/law.service.ts

STEP 2 - Implement:
  Create infra/migrations/034_create_nations.sql: nations + nation_members tables
  Create server/src/modules/nations/: nations.module.ts, nations.service.ts (foundNation, joinNation, leaveNation, getNationalLaw, collectTax), nations.controller.ts
  POST /api/nations/found (validate 3+ settlements, 100+ citizens), GET /api/nations/:id, PATCH /api/nations/:id/law
  GET /api/nations/:id/settlements
  Wire national law precedence check into law.service.ts
  Wire tax collection into economy transaction flow

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/19.1-nation-system
  git add server/src/modules/nations/ infra/migrations/034_create_nations.sql server/test/
  git commit -m "feat(19.1): nation system, charters, settlement membership, national law and taxation"
  gh pr create --draft --title "feat(19.1): nation system and charter" --body "Implements story 19.1. Nation founding, settlement membership, law precedence, national treasury. All criteria met."
```
