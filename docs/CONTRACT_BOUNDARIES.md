# Contract Boundaries
Define and freeze these interfaces before parallel implementation:

## HTTP contracts
- `/api/health` operational and simulation status
- auth/account endpoints (planned)
- action submission endpoints (planned)

## Realtime contracts
- WebSocket path `/ws`
- Client event: `command`
- Server event envelope: `ack | error | tick | world.snapshot`

## Data contracts
- Account and character schema (planned ADR)
- Action queue and event log schema (planned ADR)
- Item identity model (template, canonical, variation, instance)

## Rules
- Contract changes require ADR update and version note.
- Consumers must pin to a contract version during sprints.
