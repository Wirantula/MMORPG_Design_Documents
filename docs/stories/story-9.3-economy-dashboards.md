# Story 9.3 — Economy Dashboards
**Epic:** 9 | **Role:** Economy Agent | **Status:** Blocked on 9.1 + 12.1

## Problem / intent
Hosts need market and sink/faucet dashboards so the economy can be monitored and balanced.

## Acceptance criteria
- [ ] GET /api/admin/economy/summary: top traded items, total volume, price velocity
- [ ] GET /api/admin/economy/sinks: total currency destroyed (fees, upkeep) per day
- [ ] GET /api/admin/economy/faucets: total currency created (rewards, NPC trades) per day
- [ ] Alerts: shortages (no listings for key items > 3 days), inflation (price up > 50% in 7 days)
- [ ] Reports exported as JSON to infra/exports/ on schedule
- [ ] All endpoints RBAC-gated (admin only)
- [ ] Unit tests: summary aggregation, shortage detection, inflation detection

## Dependencies
- 9.1 ✅  |  12.1 ✅

## Scope
Only touch: server/src/modules/economy/dashboards/, server/src/modules/admin/, server/test/
Do NOT touch: client/, simulation core/, crafting/

## Implementation notes
- Query market_price_history and market_listings for aggregations
- Schedule daily export job via tick.service background scheduler
- Shortage alert: canonical items with 0 active listings for 3+ in-game days

## Test notes
server/test/economy-dashboard.service.test.ts — shortage detection, inflation detection

## Observability notes
Log dashboard export completion with row counts and file path

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Economy Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 9.3 - Economy Dashboards.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-9.3-economy-dashboards.md && cat server/src/modules/economy/market.service.ts

STEP 2 - Implement:
  Create server/src/modules/economy/dashboards/: dashboard.service.ts (summarise, detectShortages, detectInflation, exportReport), dashboard.controller.ts
  GET /api/admin/economy/summary, /sinks, /faucets — all RBAC-gated
  Wire daily export into tick.service background scheduler

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/9.3-economy-dashboards
  git add server/src/modules/economy/dashboards/ server/test/
  git commit -m "feat(9.3): economy dashboards with shortage and inflation detection"
  gh pr create --draft --title "feat(9.3): economy dashboards" --body "Implements story 9.3. Summary, sinks/faucets, alerts, daily export. All criteria met."
```
