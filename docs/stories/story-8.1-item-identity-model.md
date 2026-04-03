# Story 8.1 — Item Type-Variant-Instance Model
**Epic:** 8 | **Role:** Backend Agent | **Status:** Ready ✅ (1.1 done)

## Problem / intent
Items need deterministic canonical identities so markets and storage remain manageable while preserving uniqueness.

## Acceptance criteria
- [ ] item_template_id: design-time category definition (e.g. "Iron Sword")
- [ ] item_canonical_id: same name + same defining stat profile → same canonical ID (hashed)
- [ ] item_variation_id: stat deviations within a canonical family
- [ ] item_instance_id: individual owned copy with durability, provenance, owner, embedded modifiers
- [ ] Canonicalisation hash deterministic: same inputs always yield same canonical_id
- [ ] GET /api/items/canonical/:id returns canonical item data
- [ ] GET /api/characters/:id/inventory returns instance-level items
- [ ] Unit tests: hash consistency, variation branching, instance creation

## Dependencies
- 1.1 ✅

## Scope
Only touch: server/src/modules/items/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, simulation/

## Implementation notes
- Tables: item_templates, item_canonicals, item_variations, item_instances
- Canonical hash: SHA-256 of (name + sorted stat profile JSON)
- item_instances: id, variation_id, owner_character_id, durability, provenance_json, created_at

## Test notes
server/test/items.service.test.ts — hash determinism, variation branch, instance ownership transfer

## Observability notes
Emit ItemCreated domain event with instance_id and canonical_id

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 8.1 - Item Type-Variant-Instance Model.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-8.1-item-identity-model.md && cat server/src/common/domain-events.ts && cat server/src/app.module.ts

STEP 2 - Implement:
  Create infra/migrations/011_create_items.sql: item_templates, item_canonicals, item_variations, item_instances tables
  Create server/src/modules/items/: items.module.ts, items.service.ts (canonicalise, createInstance, getInventory), items.controller.ts
  Canonical hash: SHA-256 of JSON.stringify({name, stats: sorted})
  GET /api/items/canonical/:id, GET /api/characters/:id/inventory
  Emit ItemCreated domain event on instance creation
  Register ItemsModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/8.1-item-identity
  git add server/src/modules/items/ infra/migrations/011_create_items.sql server/test/ server/src/app.module.ts
  git commit -m "feat(8.1): item type-variant-instance model with deterministic canonical hash"
  gh pr create --draft --title "feat(8.1): item identity model" --body "Implements story 8.1. 4-layer item identity, SHA-256 canonical hash, inventory API, ItemCreated event. All criteria met."
```
