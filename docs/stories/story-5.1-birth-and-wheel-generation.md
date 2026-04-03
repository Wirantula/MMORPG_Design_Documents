# Story 5.1 — Birth and Wheel Generation
**Epic:** 5 | **Role:** Backend Agent | **Status:** Blocked on 2.2 + 3.2

## Problem / intent
New lives begin through a wheel-based creation ritual. The wheel is server-authoritative — players cannot force a perfect outcome.

## Acceptance criteria
- [ ] 5 wheels: race, aptitude, trait, origin, optional omen
- [ ] Each wheel outcome is generated server-side with seeded RNG
- [ ] Wheel config stored in a data file (not hardcoded) so content team can update
- [ ] Anti-reroll: 24h cooldown and a coin cost after first reroll on each wheel
- [ ] Birth event creates character in 'unborn' status until wheel ritual completes
- [ ] CharacterBorn domain event emitted when ritual completes
- [ ] Unit tests: wheel generation, cooldown enforcement, outcome distribution

## Dependencies
- 2.2 ✅  |  3.2 ✅

## Scope
Only touch: server/src/modules/characters/birth/, server/src/modules/characters/wheels/, tools/content/wheels.json, server/test/
Do NOT touch: simulation/, economy/, client/ (except wheel reveal UI stubs)

## Implementation notes
- WheelResult: { race, aptitude, trait, origin, omen? }
- Store wheel_results on character row as JSONB
- Cooldown tracked per account: wheel_cooldowns table (account_id, wheel_type, available_at)

## Test notes
server/test/birth.service.test.ts — seeded RNG, cooldown block, full ritual completion

## Observability notes
Log CharacterBorn with account_id, character_id, wheel outcomes summary

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 5.1 - Birth and Wheel Generation.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-5.1-birth-and-wheel-generation.md && cat server/src/modules/characters/characters.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create tools/content/wheels.json: race, aptitude, trait, origin, omen wheel definitions with outcome tables
  Create server/src/modules/characters/wheels/: wheel.service.ts (seeded RNG, outcome selection), wheel.types.ts
  Create server/src/modules/characters/birth/: birth.service.ts (ritual flow, cooldown, CharacterBorn event)
  Create infra/migrations/003_create_wheel_cooldowns.sql
  POST /api/characters/birth/start — begin ritual, POST /api/characters/birth/spin/:wheel — spin one wheel, POST /api/characters/birth/complete — finalise

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/5.1-birth-wheel
  git add server/src/modules/characters/birth/ server/src/modules/characters/wheels/ tools/content/wheels.json infra/migrations/ server/test/
  git commit -m "feat(5.1): birth ritual with 5 server-authoritative wheels and anti-reroll"
  gh pr create --draft --title "feat(5.1): birth and wheel generation" --body "Implements story 5.1. 5 wheels, server RNG, cooldown, CharacterBorn event. All criteria met."
```
