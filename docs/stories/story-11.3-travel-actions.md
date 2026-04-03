# Story 11.3 — Travel Actions and Risks
**Epic:** 11 | **Role:** Backend Agent | **Status:** Blocked on 11.1 + 4.2

## Problem / intent
Travel should matter economically and narratively — with time cost, cargo risk, and route choices.

## Acceptance criteria
- [ ] POST /api/travel/start: select route (from/to node), carry cargo (item_instance_ids), estimated time
- [ ] Travel resolves over real time via tick; character unavailable for other actions during travel
- [ ] Hazard roll per segment: hazard_level → chance of encounter (cargo loss, delay, injury)
- [ ] Cargo weight affects travel time (heavier = slower)
- [ ] Travel summary posted to character's notification feed on arrival
- [ ] Unit tests: route validation, hazard roll, cargo weight penalty, arrival notification

## Dependencies
- 11.1 ✅  |  4.2 ✅

## Scope
Only touch: server/src/modules/travel/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, characters/

## Implementation notes
- travel_journeys table: id, character_id, from_node_id, to_node_id, cargo_json, status, started_at, arrives_at, hazard_log_json
- Wire arrival resolution into tick.service.ts

## Test notes
server/test/travel.service.test.ts — full journey, hazard encounter, cargo loss, arrival notification

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 11.3 - Travel Actions and Risks.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-11.3-travel-actions.md && cat server/src/modules/world/world.service.ts && cat server/src/modules/simulation/tick.service.ts

STEP 2 - Implement:
  Create infra/migrations/021_create_travel_journeys.sql
  Create server/src/modules/travel/: travel.module.ts, travel.service.ts (startJourney, resolveArrival, rollHazard, computeCargoWeight), travel.controller.ts
  POST /api/travel/start, GET /api/travel/journeys (active)
  Wire resolveArrival() into tick.service.ts; block other actions during travel
  Post arrival notification via notifications service

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/11.3-travel
  git add server/src/modules/travel/ infra/migrations/021_create_travel_journeys.sql server/test/
  git commit -m "feat(11.3): travel actions with hazard rolls, cargo weight, and arrival notifications"
  gh pr create --draft --title "feat(11.3): travel actions and risks" --body "Implements story 11.3. Route selection, timed travel, hazard rolls, cargo, arrival notification. All criteria met."
```
