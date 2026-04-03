# Story 13.2 — Balance Simulation Harness
**Epic:** 13 | **Role:** QA / Security Agent | **Status:** Blocked on 6.1 + 9.3 + 11.2

## Problem / intent
Designers need synthetic simulations to inspect growth and economic stability before live release.

## Acceptance criteria
- [ ] CLI script: tools/scripts/simulate-balance.mjs runs N characters through M in-game days
- [ ] Outputs: profession earnings comparison, XP curve progression at key levels, need drain rates
- [ ] Checks: no single profession earns > 3x the median across all professions in 30 days
- [ ] Growth curve: level 100 reachable in ~6 in-game months with active play (not offline)
- [ ] Report saved to infra/exports/balance-report-{timestamp}.json
- [ ] Script is runnable: node tools/scripts/simulate-balance.mjs --days=30 --characters=50

## Dependencies
- 6.1 ✅  |  9.3 ✅  |  11.2 ✅

## Scope
Only touch: tools/scripts/simulate-balance.mjs, infra/exports/.gitkeep
Do NOT touch: server/src/, client/

## Implementation notes
- Pure simulation: import XP curves and formula constants from server/src/modules/progression/curves.ts
- Use TypeScript-compatible JS (ESM) — no real DB needed
- Output structured JSON matching the format used by economy dashboards

## Test notes
Manual run — verified by reviewing output report for balance checks

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the QA/Security Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 13.2 - Balance Simulation Harness.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-13.2-balance-simulation-harness.md && cat server/src/modules/progression/curves.ts

STEP 2 - Implement:
  Create infra/exports/.gitkeep
  Create tools/scripts/simulate-balance.mjs:
    - Parse --days and --characters CLI args
    - Simulate N characters each earning XP via random profession actions for M days
    - Apply XP formula from curves.ts; track levels reached
    - Compare profession earnings; flag if any profession > 3x median
    - Write report JSON to infra/exports/balance-report-{Date.now()}.json
    - Print summary to stdout

STEP 3 - Validate (no npm run validate needed — run the script):
  node tools/scripts/simulate-balance.mjs --days=30 --characters=10
  Confirm report file created and summary printed without errors.

STEP 4 - Open PR:
  git checkout -b story/13.2-balance-harness
  git add tools/scripts/simulate-balance.mjs infra/exports/.gitkeep
  git commit -m "feat(13.2): balance simulation harness for XP curves and profession earnings"
  gh pr create --draft --title "feat(13.2): balance simulation harness" --body "Implements story 13.2. CLI simulation script, profession balance check, JSON report output. All criteria met."
```
