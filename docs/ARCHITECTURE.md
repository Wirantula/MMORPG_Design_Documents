# Architecture Baseline
Primary technical blueprint source files:
- `../MMORPG_Technical_Architecture_Blueprint.docx`
- `../MMORPG_Technical_Architecture_Blueprint.txt`

## Chosen implementation baseline
- Frontend: Next.js + TypeScript (`client/`)
- Backend: NestJS + TypeScript (`server/`)
- Data: PostgreSQL and Redis (`infra/compose/docker-compose.yml`)
- Runtime model: modular monolith first, service-ready boundaries
- Transport: HTTP + WebSocket (`/api`, `/ws`)

## Module boundaries (initial)
- `auth-accounts` (planned)
- `character-lifecycle` (planned)
- `simulation` (seeded)
- `realtime` (seeded)
- `economy-market` (planned)
- `inventory-items` (planned)
- `social-governance` (planned)
- `moderation-ops` (planned)
