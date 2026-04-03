# Story 6.2 — Skill Taxonomy and Skill Tree UI
**Epic:** 6 | **Role:** Backend Agent + Frontend Agent | **Status:** Blocked on 6.1 + 3.2

## Problem / intent
Players need to see their skill landscape to plan their life direction.

## Acceptance criteria
- [ ] Skill taxonomy: root categories (Combat, Crafting, Trade, Research, Governance, Social, Survival, Exploration)
- [ ] Skills have: id, parent_id, name, description, domain, tier (1-5), visibility (visible|hidden|hint)
- [ ] Character skills stored with: character_id, skill_id, xp, level, unlocked_at
- [ ] GET /api/characters/:id/skills returns visible skills + hints for hidden ones
- [ ] Client skill tree renders root categories, children, and search
- [ ] Hidden skills shown as "???" with their narrative hint
- [ ] Unit tests: skill unlock, visible vs hidden serialisation, tree traversal

## Dependencies
- 6.1 ✅  |  3.2 ✅

## Scope
Only touch: server/src/modules/skills/, tools/content/skills.json, client/src/components/SkillTree/, server/test/
Do NOT touch: simulation/, economy/

## Implementation notes
- skills master table: id, parent_id, name, description, domain, tier, visibility
- character_skills table: character_id, skill_id, xp, level, unlocked_at
- Seed initial skill taxonomy from tools/content/skills.json

## Test notes
server/test/skills.service.test.ts — unlock flow, hidden skill serialisation

## Observability notes
Emit SkillUnlocked domain event with character_id, skill_id, tier

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend and Frontend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 6.2 - Skill Taxonomy and Skill Tree UI.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-6.2-skill-taxonomy.md && cat server/src/modules/progression/xp.service.ts && cat server/src/app.module.ts

STEP 2 - Implement:
  Create tools/content/skills.json: 8 root categories, 5 skills per category, visibility flags
  Create infra/migrations/007_create_skills.sql: skills + character_skills tables
  Create server/src/modules/skills/: skills.module.ts, skills.service.ts, skills.controller.ts
  GET /api/characters/:id/skills: visible skills with details, hidden as {id, hint, tier}
  Create client/src/components/SkillTree/: SkillTree.tsx (root cats), SkillNode.tsx, SkillSearch.tsx
  Add SkillTree to client shell (new tab/panel)

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/6.2-skill-taxonomy
  git add server/src/modules/skills/ tools/content/skills.json infra/migrations/007_create_skills.sql client/src/components/SkillTree/ server/test/
  git commit -m "feat(6.2): skill taxonomy, storage, and skill tree UI"
  gh pr create --draft --title "feat(6.2): skill taxonomy and skill tree UI" --body "Implements story 6.2. 8 root categories, character_skills table, API, SkillTree component. All criteria met."
```
