# Story 2.2 — Single-Character Enforcement
**Epic:** 2 | **Role:** Backend Agent | **Status:** Blocked on 2.1

## Problem / intent
Each account may control exactly one living character. The system must enforce this even under race conditions.

## Acceptance criteria
- [ ] Creating a character fails with 409 if the account already has a living character
- [ ] Race condition handled via DB unique partial index: (account_id) WHERE status='alive'
- [ ] CharacterDied event allows a new character to be created after permadeath
- [ ] Admin override stub: POST /api/admin/accounts/:id/reset-character (RBAC-gated, returns 200)
- [ ] Unit tests: create when none exists, create when one exists, create after death, race condition

## Dependencies
- 2.1 ✅

## Scope
Only touch: server/src/modules/characters/, infra/migrations/, server/test/
Do NOT touch: client/, simulation/, auth/

## Implementation notes
- characters table: id, account_id (fk), name, status (alive|dead|unborn), created_at, died_at
- Unique partial index: CREATE UNIQUE INDEX one_alive_per_account ON characters(account_id) WHERE status='alive'
- Emit CharacterBorn, CharacterDied domain events

## Test notes
server/test/character-enforcement.test.ts — concurrent create race condition test

## Observability notes
Log CharacterBorn, CharacterDied with account_id and character_id

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 2.2 - Single-Character Enforcement.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-2.2-single-character-enforcement.md && cat server/src/modules/accounts/accounts.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create server/src/modules/characters/: characters.module.ts, characters.service.ts, characters.controller.ts
  Create infra/migrations/002_create_characters.sql with characters table + unique partial index
  POST /api/characters: enforce one-alive rule, emit CharacterBorn
  POST /api/admin/accounts/:id/reset-character: stub, RBAC guard, returns 200
  Register CharactersModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/2.2-single-character
  git add server/src/modules/characters/ infra/migrations/002_create_characters.sql server/test/ server/src/app.module.ts
  git commit -m "feat(2.2): single-character enforcement with DB partial index"
  gh pr create --draft --title "feat(2.2): single-character enforcement" --body "Implements story 2.2. One-alive-per-account via partial index, CharacterBorn/Died events, admin stub. All criteria met."
```
