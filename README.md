# CybaWorld MMORPG Agentic Monorepo
This repository is the executable foundation for the backlog in `MMORPG_Backlog_Agentic_Development_Plan.txt`. It is structured for a modular-monolith-first implementation with explicit agent ownership boundaries.

## Repository layout
- `server/` - authoritative backend runtime (NestJS)
- `client/` - browser UI shell (Next.js)
- `tools/` - delivery tooling (story generation, validation scripts)
- `infra/` - local infrastructure and deployment scaffolding
- `docs/` - operating model, ADRs, backlog tracking, runbooks
- `tests/` - cross-module and scenario-level test planning

## Quick start
1. Copy `.env.example` to `.env` and adjust values.
2. Install dependencies:
   - `npm install`
3. Start infrastructure dependencies:
   - `docker compose -f infra/compose/docker-compose.yml up -d`
4. Start services in separate terminals:
   - `npm run dev:server`
   - `npm run dev:client`
5. Validate quality gates:
   - `npm run validate`

## Development standards
- Contract-first changes before parallel implementation
- Every story includes acceptance criteria, dependencies, tests, and observability notes
- No merge without lint, typecheck, tests, and reviewer approval
- AI-generated gameplay/balance changes require explicit human sign-off

## Planning and delivery docs
- Team playbook: `docs/TEAM_OPERATING_MODEL.md`
- Agent instructions: `AGENTS.md` and `docs/AGENTS.md`
- Story template: `docs/stories/STORY_TEMPLATE.md`
- ADR process: `docs/ADR/README.md`
