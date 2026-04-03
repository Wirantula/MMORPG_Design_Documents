# Story 9.1 — Market Listings and Order Book
**Epic:** 9 | **Role:** Economy Agent | **Status:** Blocked on 8.1 + 8.2 + 3.2

## Problem / intent
Traders need to buy and sell goods through reliable player-driven market systems.

## Acceptance criteria
- [ ] POST /api/market/listings: create sell listing (item_instance_id, price, quantity, expires_at)
- [ ] POST /api/market/orders: create buy order (canonical_id, max_price, quantity)
- [ ] Order matching runs on tick: best ask fills best bid, transaction recorded
- [ ] Listing fee: 1% of price, sent to settlement treasury (or sink if no settlement)
- [ ] Anti-spam: max 20 active listings per character
- [ ] GET /api/market/listings?canonical_id=: price history + current depth
- [ ] Price history stored: 30 data points per canonical item
- [ ] Unit tests: listing, matching, fee calculation, anti-spam limit

## Dependencies
- 8.1 ✅  |  8.2 ✅  |  3.2 ✅

## Scope
Only touch: server/src/modules/economy/, infra/migrations/, server/test/
Do NOT touch: client/, simulation core/, crafting/

## Implementation notes
- market_listings table: id, seller_id, item_instance_id, canonical_id, price, quantity, status, expires_at
- market_orders table: id, buyer_id, canonical_id, max_price, quantity, status
- market_price_history table: canonical_id, price, quantity, traded_at
- Matching: idempotent, with inventory reservation via items.service

## Test notes
server/test/market.service.test.ts — listing → order → match → transfer cycle, fee deduction

## Observability notes
Emit MarketTradeExecuted domain event with canonical_id, price, quantity

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Economy Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 9.1 - Market Listings and Order Book.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-9.1-market-listings.md && cat server/src/modules/items/items.service.ts && cat server/src/modules/simulation/tick.service.ts

STEP 2 - Implement:
  Create infra/migrations/014_create_market.sql: market_listings, market_orders, market_price_history
  Create server/src/modules/economy/: economy.module.ts, market.service.ts (createListing, createOrder, matchOrders, recordHistory), market.controller.ts
  Wire matchOrders() into tick.service.ts
  POST /api/market/listings, POST /api/market/orders, GET /api/market/listings
  Deduct 1% listing fee; enforce 20-listing anti-spam limit; emit MarketTradeExecuted

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/9.1-market-listings
  git add server/src/modules/economy/ infra/migrations/014_create_market.sql server/test/
  git commit -m "feat(9.1): market listings, order book, matching engine, price history"
  gh pr create --draft --title "feat(9.1): market listings and order book" --body "Implements story 9.1. Listings, buy orders, tick-based matching, fees, price history. All criteria met."
```
