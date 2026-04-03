# ADR 0001: Economy Module — Market, Contracts and Dashboards
Date: 2026-04-03
Status: Proposed

## Context
The game requires a player-driven economy (GDD pillar 4). Epic 9 covers market listings, contracts, and economy dashboards. The backend currently uses in-memory services with no database driver, so the economy module follows the same pattern as the simulation module: in-memory stores behind injectable services with domain event integration, ready to swap to PostgreSQL persistence once the data layer ships.

## Decision
1. **In-memory first, DB-ready schema.** All economy state lives in injectable NestJS services with `Map`-based stores. A forward-only SQL migration (`infra/migrations/202604031100_create_market_tables.sql`) defines the target PostgreSQL schema for when persistence lands.
2. **Tick-driven order matching.** `MarketService.matchOrders()` runs on every simulation tick via an `OrderMatcher` interface injected into `TickService`, avoiding a hard import cycle.
3. **1% listing fee as primary currency sink.** `Math.ceil(price * quantity * 0.01)` deducted from seller at listing time. Fees accumulate in `totalFeesCollected` and are exposed through the dashboard sinks endpoint and Prometheus metrics.
4. **Anti-spam: 20 active listings per character.** Validated server-side before listing creation.
5. **Price history capped at 30 entries per canonical item.** Oldest entries are evicted on insert.
6. **Escrow-based contracts.** Offerer's balance is locked at contract creation. Released to acceptor on completion, or to the non-breaching party on breach.
7. **Dashboard endpoints are admin-only by convention.** RBAC enforcement deferred to Story 12.1 (auth-accounts module).

## Consequences
- Economy metrics (trade count, active listings, fees) are exposed in Prometheus output for observability.
- Contract breach escrow routing is simple (binary party determination); multi-party contracts will need a future ADR.
- Balance management is currently scoped to `MarketService` — will migrate to a dedicated currency/wallet service when accounts ship.

## Implementation impact
- Affected modules: `economy-market` (new), `simulation` (tick integration), `observability` (new metrics)
- Migration: `infra/migrations/202604031100_create_market_tables.sql`
- Testing: 3 new test files covering market, contracts, and dashboard services
- Observability: 5 new Prometheus gauges/counters, structured log lines for all trades and contract lifecycle events
