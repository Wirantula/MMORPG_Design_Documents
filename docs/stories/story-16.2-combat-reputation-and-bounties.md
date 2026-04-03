# Story 16.2 — Combat Reputation and Bounty System
**Epic:** 16 | **Role:** Backend Agent | **Status:** Blocked on 16.1 + 10.3

## Problem / intent
Combat must carry lasting social consequences. Killers accumulate notoriety; victims' allies can post bounties, creating player-driven justice.

## Acceptance criteria
- [ ] Kill count tracked per character per settlement context (pvp_kills, pvp_deaths)
- [ ] Notoriety score: increases with unprovoked kills, decays over 30 in-game days
- [ ] High notoriety (> 50): character flagged as outlaw, visible to settlement guards
- [ ] Bounty board: POST /api/bounties/:target_id (any citizen, escrow in contracts), GET /api/bounties/active
- [ ] Bounty collected when wanted character is killed by bounty hunter and confirmed by server
- [ ] Unit tests: notoriety accumulation, decay, outlaw flag, bounty creation, collection

## Dependencies
- 16.1 ✅  |  10.3 ✅

## Scope
Only touch: server/src/modules/combat/reputation/, server/src/modules/bounties/, infra/migrations/, server/test/

## Implementation notes
- character_notoriety table: character_id, settlement_id, pvp_kills, pvp_deaths, notoriety_score, last_kill_at
- bounties table: id, poster_id, target_id, reward_amount, status, expires_at
- Notoriety decay: subtract 1 point per 30 in-game days without a kill

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 16.2 - Combat Reputation and Bounty System.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-16.2-combat-reputation-and-bounties.md && cat server/src/modules/combat/combat.service.ts && cat server/src/modules/economy/contracts/contracts.service.ts

STEP 2 - Implement:
  Create infra/migrations/029_create_notoriety_bounties.sql: character_notoriety + bounties tables
  Create server/src/modules/combat/reputation/: reputation.service.ts (updateNotoriety, decayNotoriety, flagOutlaw)
  Create server/src/modules/bounties/: bounties.module.ts, bounties.service.ts, bounties.controller.ts
  Wire updateNotoriety() into CombatResolved event handler
  Wire decayNotoriety() into daily tick
  POST /api/bounties/:target_id, GET /api/bounties/active, PATCH /api/bounties/:id/collect

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/16.2-combat-reputation
  git add server/src/modules/combat/reputation/ server/src/modules/bounties/ infra/migrations/029_create_notoriety_bounties.sql server/test/
  git commit -m "feat(16.2): combat notoriety, outlaw flagging, and bounty board"
  gh pr create --draft --title "feat(16.2): combat reputation and bounties" --body "Implements story 16.2. Notoriety accumulation/decay, outlaw flagging, bounty board with escrow. All criteria met."
```
