# Story 21.1 — Production Docker Compose and Reverse Proxy
**Epic:** 21 | **Role:** Live Ops Agent | **Status:** Blocked on 12.1

## Problem / intent
The game must be self-hostable on a Windows machine with TLS termination, proper port routing, and production-grade Docker Compose so the host can run the full stack reliably.

## Acceptance criteria
- [ ] infra/compose/docker-compose.prod.yml: web, server, worker, postgres, redis, caddy services
- [ ] Caddy (or Nginx) reverse proxy: TLS via Let's Encrypt, routes /, /api, /ws, /admin
- [ ] infra/caddy/Caddyfile (or nginx.conf): correct upstream proxying with websocket support
- [ ] Environment variable injection from infra/env/.env.prod.example (not committed with secrets)
- [ ] Worker container: separate process for tick scheduler and AI proposal jobs
- [ ] Health checks defined for all services
- [ ] docs/RUNBOOKS/PRODUCTION_DEPLOY.md: step-by-step Windows deploy guide
- [ ] docker compose -f infra/compose/docker-compose.prod.yml config validates without error

## Dependencies
- 12.1 ✅

## Scope
Only touch: infra/compose/, infra/caddy/, infra/env/, docs/RUNBOOKS/
Do NOT touch: server/src/, client/src/

## Implementation notes
- Use Caddy 2 — auto-HTTPS with Let's Encrypt, minimal config
- Worker service shares codebase with server but runs `node dist/worker.js` entrypoint
- All secrets in external .env.prod file; docker-compose.prod.yml uses env_file directive
- PostgreSQL and Redis on named volumes for data persistence

## Test notes
Validate by running: docker compose -f infra/compose/docker-compose.prod.yml config

## Observability notes
All containers log to stdout in JSON format; log driver: json-file with rotation

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Live Ops Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 21.1 - Production Docker Compose and Reverse Proxy.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-21.1-production-docker-and-reverse-proxy.md && cat infra/compose/docker-compose.yml && cat server/.env.example

STEP 2 - Implement:
  Create infra/caddy/Caddyfile: TLS termination, reverse proxy for /, /api, /ws (WS upgrade), /admin
  Create infra/env/.env.prod.example: all required env vars with placeholder values
  Create infra/compose/docker-compose.prod.yml: web, server, worker, postgres (named volume), redis (named volume), caddy services with health checks
  Create server/src/worker.ts: standalone worker entrypoint that runs tick scheduler and AI proposal jobs
  Create docs/RUNBOOKS/PRODUCTION_DEPLOY.md: step-by-step Windows production deploy guide including Docker Desktop setup, domain DNS, cert automation
  Validate: docker compose -f infra/compose/docker-compose.prod.yml config

STEP 3 - Validate (compose config, not npm):
  docker compose -f infra/compose/docker-compose.prod.yml config
  If errors, fix and re-run.

STEP 4 - Open PR:
  git checkout -b story/21.1-production-docker
  git add infra/compose/docker-compose.prod.yml infra/caddy/ infra/env/.env.prod.example server/src/worker.ts docs/RUNBOOKS/PRODUCTION_DEPLOY.md
  git commit -m "feat(21.1): production Docker Compose stack with Caddy TLS and worker service"
  gh pr create --draft --title "feat(21.1): production Docker Compose and reverse proxy" --body "Implements story 21.1. Caddy TLS, prod compose stack, worker service, production deploy runbook. All criteria met."
```
