# Story 9.2 — Contracts
**Epic:** 9 | **Role:** Economy Agent | **Status:** In Progress

## Problem / intent
Labor and delivery contracts let players monetize services, not just goods.

## Acceptance criteria
- [ ] Contract types: work (deliver labour), delivery (transport item), construction (milestone-based)
- [ ] Contracts have: offerer, acceptor, terms_json, escrow_amount, status, deadline
- [ ] Escrow held in contract until completion; returned on breach
- [ ] POST /api/contracts: create, GET /api/contracts/:id, PATCH /api/contracts/:id/complete, PATCH /api/contracts/:id/breach
- [ ] Breach triggers escrow release to non-breaching party and ContractBreached event
- [ ] Unit tests: create, accept, complete, breach with escrow flows

## Dependencies
- 9.1 ✅

## Scope
Only touch: server/src/modules/economy/contracts/, infra/migrations/, server/test/
Do NOT touch: client/, simulation core/, items/

## Implementation notes
- contracts table: id, type, offerer_id, acceptor_id, terms_json, escrow_amount, status, deadline, created_at
- Currency held in escrow_amount column; released atomically on complete/breach

## Test notes
server/test/contracts.service.test.ts — full lifecycle including breach scenario

## Observability notes
Emit ContractCompleted, ContractBreached domain events

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Economy Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 9.2 - Contracts.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-9.2-contracts.md && cat server/src/modules/economy/market.service.ts

STEP 2 - Implement:
  Create infra/migrations/015_create_contracts.sql
  Create server/src/modules/economy/contracts/: contracts.service.ts, contracts.controller.ts
  POST /api/contracts, GET /api/contracts/:id, PATCH /api/contracts/:id/complete, PATCH /api/contracts/:id/breach
  Atomic escrow release; emit ContractCompleted, ContractBreached domain events

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/9.2-contracts
  git add server/src/modules/economy/contracts/ infra/migrations/015_create_contracts.sql server/test/
  git commit -m "feat(9.2): labor and delivery contracts with escrow"
  gh pr create --draft --title "feat(9.2): contracts" --body "Implements story 9.2. Work/delivery/construction contracts, escrow, breach handling. All criteria met."
```
