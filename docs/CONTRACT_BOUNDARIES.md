# Contract Boundaries
Define and freeze these interfaces before parallel implementation:

## HTTP contracts
- `/api/health` operational and simulation status
- auth/account endpoints (planned)
- action submission endpoints (planned)
- `POST /api/market/listings` create sell listing
- `POST /api/market/orders` create buy order
- `GET /api/market/listings?canonical_id=` active listings + price history
- `POST /api/contracts` create contract with escrow
- `GET /api/contracts/:id` get contract by ID
- `PATCH /api/contracts/:id/accept` accept contract
- `PATCH /api/contracts/:id/complete` complete contract
- `PATCH /api/contracts/:id/breach` breach contract
- `GET /api/admin/economy/summary` top traded items, volume, price velocity (admin)
- `GET /api/admin/economy/sinks` total fees and escrow lost (admin)
- `GET /api/admin/economy/faucets` total rewards and NPC purchases (admin)
- `GET /api/admin/economy/shortages` shortage alerts (admin)
- `GET /api/admin/economy/inflation` inflation alerts (admin)
- `GET /api/admin/economy/export` trigger economy report export (admin)

## Realtime contracts
- WebSocket path `/ws`
- Client event: `command`
- Server event envelope: `ack | error | tick | world.snapshot`

## Data contracts
- Account and character schema (planned ADR)
- Action queue and event log schema (planned ADR)
- Item identity model (template, canonical, variation, instance)
- Market economy schema (ADR 0001): market_listings, market_orders, market_price_history, contracts

## Rules
- Contract changes require ADR update and version note.
- Consumers must pin to a contract version during sprints.
