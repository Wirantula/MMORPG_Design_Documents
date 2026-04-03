# Story 6.1 — XP and Scaling Curves
**Epic:** 6 | **Role:** Backend Agent | **Status:** Blocked on 5.3

## Problem / intent
High capability must remain rare and meaningful. XP requirements scale progressively and hidden potential affects efficiency, not existence.

## Acceptance criteria
- [ ] XP formula: progressive (not linear) — each tier requires proportionally more XP than the last
- [ ] Level 100 = peak human; 100–500 = superhuman with threshold effects
- [ ] Hidden potential (growth_elasticity, ceiling_bias) modifies XP efficiency and soft caps
- [ ] Domain-specific resistance curves prevent uniform grinding
- [ ] Stat decay applies sparingly to physically maintained skills when unused >30 in-game days
- [ ] GET /api/admin/balance/xp-curves returns curve data for balancing
- [ ] Unit tests: XP award, soft cap, decay, potential modifier application

## Dependencies
- 5.3 ✅

## Scope
Only touch: server/src/modules/progression/, server/test/
Do NOT touch: client/, economy/, realtime/

## Implementation notes
- Create ProgressionModule: xp.service.ts, curves.ts (formula constants), progression.module.ts
- XP formula: xp_required(level) = BASE * (level ^ EXPONENT) with domain multipliers
- Soft cap: when stat > ceiling_bias * 1000, XP efficiency multiplied by 0.1

## Test notes
server/test/xp.service.test.ts — progression at level 50, 100, 250; soft cap trigger; decay

## Observability notes
Emit SkillLevelUp domain event with character_id, skill, new_level

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 6.1 - XP and Scaling Curves.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-6.1-xp-and-scaling-curves.md && cat server/src/modules/simulation/actions/action.service.ts && cat server/src/modules/characters/stats/stat.types.ts

STEP 2 - Implement:
  Create server/src/modules/progression/curves.ts: XP formula, threshold breakpoints, domain multipliers, decay constants
  Create server/src/modules/progression/xp.service.ts: awardXP(), applyDecay(), computeEffectiveGain()
  Create server/src/modules/progression/progression.module.ts
  Register ProgressionModule in app.module.ts
  Emit SkillLevelUp domain event when level crosses integer boundary

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/6.1-xp-curves
  git add server/src/modules/progression/ server/test/ server/src/app.module.ts
  git commit -m "feat(6.1): progressive XP curves with hidden potential modifiers and decay"
  gh pr create --draft --title "feat(6.1): XP and scaling curves" --body "Implements story 6.1. Progressive XP formula, soft caps, potential modifiers, decay, SkillLevelUp event. All criteria met."
```
