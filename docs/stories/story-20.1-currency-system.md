# Story 20.1 — Currency System
**Epic:** 20 | **Role:** Economy Agent | **Status:** Blocked on 2.1

## Problem / intent
The game needs a first-class currency system with character wallets, settlement treasuries, transaction logs, and anti-dupe controls before any market or contract can function correctly.

## Acceptance criteria
- [ ] currencies table: id, name, symbol, issuer_type (world/settlement/nation), is_primary
- [ ] character_wallets table: character_id, currency_id, balance — with non-negative constraint
- [ ] All balance changes atomic and idempotent (use idempotency_key)
- [ ] Transaction log: currency_transactions table with from_id, to_id, amount, reason, idempotency_key, created_at
- [ ] GET /api/characters/:id/wallet; POST /api/wallet/transfer (character to character)
- [ ] Starter currencies seeded: World Gold (primary), Settlement Credit (local)
- [ ] Anti-dupe: double-spend prevented by idempotency_key unique constraint
- [ ] Unit tests: transfer, insufficient balance rejection, idempotency replay, audit log

## Dependencies
- 2.1 ✅

## Scope
Only touch: server/src/modules/currency/, infra/migrations/, server/test/
Do NOT touch: client/, simulation core/, crafting/

## Implementation notes
- character_wallets: CHECK (balance >= 0) enforced at DB level
- Idempotency: unique constraint on currency_transactions(idempotency_key)
- settlement_treasuries table: settlement_id, currency_id, balance

## Test notes
server/test/currency.service.test.ts — transfer, overdraft block, idempotency replay safety

## Observability notes
Log all transfers with from_id, to_id, amount, reason (never log idempotency keys)

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Economy Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 20.1 - Currency System.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-20.1-currency-system.md && cat server/src/common/domain-events.ts && cat server/src/app.module.ts

STEP 2 - Implement:
  Create infra/migrations/035_create_currency.sql: currencies, character_wallets (balance >= 0 check), settlement_treasuries, currency_transactions tables
  Seed starter currencies: World Gold (primary=true), Settlement Credit
  Create server/src/modules/currency/: currency.module.ts, currency.service.ts (transfer, getBalance, seedWallet, deductFee), currency.controller.ts
  Atomic transfer with idempotency_key unique constraint
  GET /api/characters/:id/wallet, POST /api/wallet/transfer
  Register CurrencyModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/20.1-currency-system
  git add server/src/modules/currency/ infra/migrations/035_create_currency.sql server/test/ server/src/app.module.ts
  git commit -m "feat(20.1): currency system with wallets, atomic transfers, idempotency and audit log"
  gh pr create --draft --title "feat(20.1): currency system" --body "Implements story 20.1. Currencies, wallets, atomic transfers, idempotency, overdraft protection, audit log. All criteria met."
```
