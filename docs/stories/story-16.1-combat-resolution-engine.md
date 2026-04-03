# Story 16.1 — Combat Resolution Engine
**Epic:** 16 | **Role:** Backend Agent | **Status:** Blocked on 5.3 + 7.1 + 10.3

## Problem / intent
Combat must be lethal, reputationally expensive, and politically meaningful — one route to power among many, constrained by law and consequences.

## Acceptance criteria
- [ ] POST /api/combat/initiate: aggressor selects target, server validates legality (law, safe zones, age protection)
- [ ] Combat resolves server-side over 1–3 exchange windows using Physical stats (STR/AGI/END)
- [ ] Combat instinct hidden trait biases clutch outcomes
- [ ] Death triggers CharacterDied domain event with cause=combat
- [ ] Crime flag logged for aggressor in target's settlement (assault or murder)
- [ ] Reputation cost: aggressor's Social stats penalised after unprovoked kills
- [ ] Winner may loot a % of loser's carried items (not inventory — only equipped/carried)
- [ ] Unit tests: legal check, exchange resolution, death trigger, crime flag, loot rules

## Dependencies
- 5.3 ✅  |  7.1 ✅  |  10.3 ✅

## Scope
Only touch: server/src/modules/combat/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, crafting/

## Implementation notes
- combat_logs table: id, aggressor_id, defender_id, outcome, exchanges_json, loot_json, created_at
- Exchange resolution: compare STR + random(0,AGI) vs defender's AGI + random(0,END); apply damage
- Legality check: call law.service.ts to verify permitted_pvp and check age protection
- Emit CombatResolved domain event

## Test notes
server/test/combat.service.test.ts — legal check fail, exchange resolution, death path, crime flag

## Observability notes
Emit CombatResolved with outcome, aggressor_id, defender_id

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 16.1 - Combat Resolution Engine.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-16.1-combat-resolution-engine.md && cat server/src/modules/characters/stats/stat.types.ts && cat server/src/modules/settlements/law/law.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create infra/migrations/028_create_combat_logs.sql
  Create server/src/modules/combat/: combat.module.ts, combat.service.ts (initiateCombat, checkLegality, resolveExchanges, applyDeath, logCrime), combat.controller.ts
  POST /api/combat/initiate: validate legality, resolve 1-3 exchanges, apply outcome
  On death: emit CharacterDied with cause=combat; on aggressor: log crime, penalise Social stats
  Winner loots % of carried items (not full inventory)
  Emit CombatResolved domain event

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/16.1-combat-engine
  git add server/src/modules/combat/ infra/migrations/028_create_combat_logs.sql server/test/
  git commit -m "feat(16.1): combat resolution engine with legality checks and reputation consequences"
  gh pr create --draft --title "feat(16.1): combat resolution engine" --body "Implements story 16.1. Legal check, stat-based exchange resolution, death trigger, crime flag, loot rules. All criteria met."
```
