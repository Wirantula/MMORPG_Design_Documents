# Local Development Runbook
## Prerequisites
- Node.js 22+
- npm 10+
- Docker Desktop (or compatible Docker runtime)

## First-time setup
1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Start infra:
   - `docker compose -f infra/compose/docker-compose.yml up -d`
4. Start apps:
   - `npm run dev:server`
   - `npm run dev:client`

## Common commands
- Validate quality gates: `npm run validate`
- Build all workspaces: `npm run build`
- Create story scaffold: `npm run story:new -- 3.1 websocket gateway`
