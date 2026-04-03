# Story 11.1 — Universe / Planet / Plane Graph
**Epic:** 11 | **Role:** Backend Agent | **Status:** Blocked on 1.1 + 3.2

## Problem / intent
The world needs distinct places and travel routes so exploration and logistics matter.

## Acceptance criteria
- [ ] World node types: universe, planet, plane, region, settlement_zone
- [ ] Nodes have: id, name, type, parent_id, environmental_tags_json, travel_cost, unlock_status
- [ ] Edges have: from_node, to_node, travel_time_minutes, cost, hazard_level
- [ ] GET /api/world/nodes and GET /api/world/nodes/:id/connections
- [ ] Starter world seeded from tools/content/world-seed.json
- [ ] Schema supports future expansion without rewrite
- [ ] Unit tests: graph traversal, node lookup, connection filtering

## Dependencies
- 1.1 ✅  |  3.2 ✅

## Scope
Only touch: server/src/modules/world/, tools/content/world-seed.json, infra/migrations/, server/test/
Do NOT touch: simulation core/, economy/, characters/

## Implementation notes
- world_nodes table: id, name, type, parent_id, env_tags JSONB, travel_cost, unlock_status
- world_edges table: from_node_id, to_node_id, travel_time_minutes, currency_cost, hazard_level
- Seed from world-seed.json via migration or seeder script

## Test notes
server/test/world.service.test.ts — node lookup, edge traversal, expansion without breaking existing nodes

## Observability notes
Log world node unlock with node_id and trigger type

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 11.1 - Universe/Planet/Plane Graph.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-11.1-world-graph.md && cat server/src/app.module.ts

STEP 2 - Implement:
  Create tools/content/world-seed.json: 1 universe, 3 planets, 2 planes, 8 regions, travel edges
  Create infra/migrations/019_create_world.sql: world_nodes + world_edges
  Create server/src/modules/world/: world.module.ts, world.service.ts, world.controller.ts
  GET /api/world/nodes, GET /api/world/nodes/:id/connections
  Register WorldModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/11.1-world-graph
  git add server/src/modules/world/ tools/content/world-seed.json infra/migrations/019_create_world.sql server/test/ server/src/app.module.ts
  git commit -m "feat(11.1): world graph — universe/planet/plane/region nodes and travel edges"
  gh pr create --draft --title "feat(11.1): world graph" --body "Implements story 11.1. World node hierarchy, travel edges, seed data. All criteria met."
```
