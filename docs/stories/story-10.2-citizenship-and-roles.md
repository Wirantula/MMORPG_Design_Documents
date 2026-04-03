# Story 10.2 — Citizenship and Roles
**Epic:** 10 | **Role:** Backend Agent | **Status:** Blocked on 10.1

## Problem / intent
Formal membership and office systems allow player-run institutions to exist with enforceable structure.

## Acceptance criteria
- [ ] Membership statuses: citizen, resident, visitor, banned
- [ ] Roles: founder, governor, council_member, officer, citizen (tiered permissions)
- [ ] POST /api/settlements/:id/membership/apply, PATCH /api/settlements/:id/membership/:id/approve
- [ ] Role assignment: founder can appoint governor; governor can appoint council; council can appoint officers
- [ ] Roles expire if the holder leaves or is removed
- [ ] GET /api/settlements/:id/roster lists members with roles
- [ ] Unit tests: apply, approve, role assignment chain, role expiry

## Dependencies
- 10.1 ✅

## Scope
Only touch: server/src/modules/settlements/membership/, infra/migrations/, server/test/

## Implementation notes
- settlement_memberships table: id, settlement_id, character_id, status, role, joined_at, expires_at
- Permission matrix enforced in service layer, not just controller

## Test notes
server/test/membership.service.test.ts — full role chain, permission violation rejection

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 10.2 - Citizenship and Roles.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-10.2-citizenship-and-roles.md && cat server/src/modules/settlements/settlements.service.ts

STEP 2 - Implement:
  Create infra/migrations/017_create_memberships.sql
  Create server/src/modules/settlements/membership/: membership.service.ts, membership.controller.ts
  POST /api/settlements/:id/membership/apply, PATCH /api/settlements/:id/membership/:id/approve, GET /api/settlements/:id/roster
  Enforce role-based permission matrix in service layer

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/10.2-citizenship
  git add server/src/modules/settlements/membership/ infra/migrations/017_create_memberships.sql server/test/
  git commit -m "feat(10.2): citizenship, roles, and settlement membership system"
  gh pr create --draft --title "feat(10.2): citizenship and roles" --body "Implements story 10.2. Membership statuses, 5 roles, permission chain, roster. All criteria met."
```
