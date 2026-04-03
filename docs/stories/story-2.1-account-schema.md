# Story 2.1 — Account Schema and Identity Flows
**Epic:** 2 | **Role:** Backend Agent | **Status:** Review

## Problem / intent
Players must register, log in, and hold a session so lineage and settings persist.

## Acceptance criteria
- [x] POST /api/auth/register creates account with bcrypt-hashed password
- [x] POST /api/auth/login returns JWT access token + refresh token
- [x] POST /api/auth/refresh issues new access token
- [x] POST /api/auth/logout invalidates refresh token
- [x] accounts table: id (uuid), email (unique), password_hash, created_at, updated_at
- [x] refresh_tokens table: id, account_id (fk), token_hash, expires_at
- [x] Zod validation; invalid input → 400
- [x] Audit events: AccountCreated, AccountLoggedIn via domain-events.ts
- [x] Unit tests: register, login, duplicate email, bad password, refresh, logout

## Dependencies
- 1.1 ✅  |  1.2 (merge before firing)

## Scope
Only touch: server/src/modules/accounts/, server/src/modules/auth/, infra/migrations/, server/test/
Do NOT touch: client/, simulation/, .github/

## Implementation notes
- Packages: @nestjs/jwt bcryptjs (@types/bcryptjs dev)
- Global API prefix /api already set in main.ts
- Emit events via server/src/common/domain-events.ts
- Never log passwords or raw tokens

## Test notes
server/test/auth.service.test.ts — register→login→refresh→logout cycle

## Observability notes
Log AccountCreated, AccountLoggedIn at info with account id only

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 2.1 - Account Schema and Identity Flows.

STEP 1 - Read (do not stop after this):
  cat AGENTS.md && cat docs/stories/story-2.1-account-schema.md && cat server/src/app.module.ts && cat server/src/common/domain-events.ts && cat server/src/config/env.ts

STEP 2 - Implement:
  npm install @nestjs/jwt bcryptjs --workspace=server && npm install --save-dev @types/bcryptjs --workspace=server
  Create server/src/modules/accounts/: accounts.module.ts, accounts.service.ts
  Create server/src/modules/auth/: auth.module.ts, auth.service.ts, jwt.strategy.ts, jwt-auth.guard.ts
  Create infra/migrations/001_create_accounts.sql: accounts and refresh_tokens DDL
  Implement POST /api/auth/register, /login, /refresh, /logout
  Register AccountsModule + AuthModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate
  Fix errors and re-run until passing.

STEP 4 - Open PR:
  git checkout -b story/2.1-account-schema
  git add server/src/modules/accounts/ server/src/modules/auth/ infra/migrations/001_create_accounts.sql server/test/ server/src/app.module.ts
  git commit -m "feat(2.1): account schema, JWT auth, register/login/refresh/logout"
  gh pr create --draft --title "feat(2.1): account schema and identity flows" --body "Implements story 2.1. Accounts+Auth modules, JWT, migrations. All criteria met."
```
