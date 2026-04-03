# Story 18.1 — Guilds and Households
**Epic:** 18 | **Role:** Backend Agent | **Status:** Blocked on 10.1

## Problem / intent
Guilds and households are cross-settlement social structures that let players organise around professions, families, and factions without being tied to a single location.

## Acceptance criteria
- [ ] Guild types: trade_guild, combat_order, research_institute, craft_collective, political_faction
- [ ] Guilds have: name, type, founder_id, charter_text, member_limit, treasury_balance
- [ ] POST /api/guilds: found guild; GET /api/guilds/:id; PATCH /api/guilds/:id/charter
- [ ] Guild membership: apply, accept, rank (member/officer/leader), expel
- [ ] Guild treasury: members can deposit/withdraw based on rank permissions
- [ ] Households: family-unit guilds with inheritance implications (link to lineage)
- [ ] Unit tests: found, join, rank promotion, treasury deposit/withdraw, household link

## Dependencies
- 10.1 ✅

## Scope
Only touch: server/src/modules/guilds/, infra/migrations/, server/test/

## Implementation notes
- guilds table: id, name, type, founder_id, charter_text, member_limit, treasury_balance, created_at
- guild_members table: guild_id, character_id, rank, joined_at
- Guild treasury is a dedicated currency balance separate from character balance

## Test notes
server/test/guilds.service.test.ts — found, membership lifecycle, treasury RBAC

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 18.1 - Guilds and Households.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-18.1-guilds-and-households.md && cat server/src/modules/settlements/settlements.service.ts && cat server/src/modules/lineage/lineage.service.ts

STEP 2 - Implement:
  Create infra/migrations/032_create_guilds.sql: guilds + guild_members tables
  Create server/src/modules/guilds/: guilds.module.ts, guilds.service.ts (foundGuild, joinGuild, promoteRank, depositTreasury, withdrawTreasury), guilds.controller.ts
  POST /api/guilds, GET /api/guilds/:id, PATCH /api/guilds/:id/charter
  POST /api/guilds/:id/membership/apply, PATCH /api/guilds/:id/membership/:id/promote
  Guild treasury deposit/withdraw with rank-based RBAC
  Register GuildsModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/18.1-guilds
  git add server/src/modules/guilds/ infra/migrations/032_create_guilds.sql server/test/ server/src/app.module.ts
  git commit -m "feat(18.1): guilds, households, guild treasury and membership ranks"
  gh pr create --draft --title "feat(18.1): guilds and households" --body "Implements story 18.1. 5 guild types, membership lifecycle, treasury with rank RBAC. All criteria met."
```
