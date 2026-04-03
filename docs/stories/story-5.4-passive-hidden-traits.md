# Story 5.4 — Passive Hidden Traits and Luck Model
**Epic:** 5 | **Role:** Backend Agent | **Status:** Blocked on 5.3

## Problem / intent
Some characters are secretly blessed or cursed. Passive hidden traits bias scenario outcomes without being directly visible.

## Acceptance criteria
- [ ] Hidden passive taxonomy: Fortune Drift, Catastrophe Avoidance, Research Spark, Combat Instinct, Craft Intuition, Trauma Susceptibility
- [ ] Each trait has a weight (−100 to +100) that biases scenario selection probability
- [ ] Trait weights influence relevant action outcomes (not guarantee them)
- [ ] Players receive indirect narrative hints (e.g. "feels unnaturally lucky today") not raw values
- [ ] Traits are rolled from wheel results and stored server-only
- [ ] Unit tests: trait application to outcome probability, hint generation, trait not in player API

## Dependencies
- 5.3 ✅

## Scope
Only touch: server/src/modules/characters/traits/, server/test/
Do NOT touch: client/, economy/, realtime/

## Implementation notes
- character_passive_traits table: character_id, trait_name, weight
- Hint generation: lookup table mapping weight ranges to narrative strings
- Apply trait weights as probability multipliers in action resolver (stub hook for story 4.2 extension)

## Test notes
server/test/traits.service.test.ts — probability bias, hint text output, hidden from player API

## Observability notes
Log trait roll on CharacterBorn with trait names and weight buckets (low/medium/high), not exact values

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 5.4 - Passive Hidden Traits and Luck Model.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-5.4-passive-hidden-traits.md && cat server/src/modules/characters/stats/stat.types.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create server/src/modules/characters/traits/: trait.types.ts, trait.service.ts (rollTraits, applyTraitBias, generateHint)
  Create infra/migrations/006_create_passive_traits.sql: character_passive_traits table
  Hint lookup table: map weight range buckets to narrative hint strings
  Expose hint string via GET /api/characters/:id/hints (player-facing, no raw weights)
  Never expose trait weights in player API responses

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/5.4-passive-traits
  git add server/src/modules/characters/traits/ infra/migrations/006_create_passive_traits.sql server/test/
  git commit -m "feat(5.4): passive hidden traits and luck model with narrative hints"
  gh pr create --draft --title "feat(5.4): passive hidden traits and luck model" --body "Implements story 5.4. 6 trait types, probability bias, narrative hints endpoint, migration 006. All criteria met."
```
