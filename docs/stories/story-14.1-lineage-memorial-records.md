# Story 14.1 — Lineage, Bloodlines and Memorial Records
**Epic:** 14 | **Role:** Backend Agent | **Status:** Blocked on 2.2 + 5.1

## Problem / intent
Death is permanent, but what survives is legacy. Lineage data, memorial records, and bloodline connections must persist after a character dies so the world remembers and next lives inherit context.

## Acceptance criteria
- [ ] lineages table: id, founder_account_id, family_name, founded_at, member_character_ids
- [ ] On CharacterDied: create memorial_record (character_id, name, life_summary_json, born_at, died_at, achievements_json)
- [ ] GET /api/lineages/:id returns family tree and memorial list
- [ ] GET /api/characters/:id/memorial returns public memorial for a dead character
- [ ] Living characters can be linked to a lineage at birth
- [ ] Lineage reputation score: sum of achievement_points from all member memorials
- [ ] Next character born to same account auto-offered lineage continuation
- [ ] Unit tests: memorial creation on death, lineage score calculation, lineage continuation offer

## Dependencies
- 2.2 ✅  |  5.1 ✅

## Scope
Only touch: server/src/modules/lineage/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, simulation core/

## Implementation notes
- lineages table: id, founder_account_id, family_name, founded_at
- lineage_members table: lineage_id, character_id, joined_at, role (founder/heir/member)
- memorial_records table: character_id, name, life_summary_json, achievements_json, born_at, died_at
- Listen to CharacterDied domain event to auto-create memorial
- Achievement points: calculated from completed actions, skill levels, economic contributions

## Test notes
server/test/lineage.service.test.ts — memorial on death, score calc, lineage link

## Observability notes
Log LineageUpdated event with lineage_id and new_member_count on each memorial addition

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 14.1 - Lineage, Bloodlines and Memorial Records.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-14.1-lineage-memorial-records.md && cat server/src/common/domain-events.ts && cat server/src/modules/characters/characters.service.ts

STEP 2 - Implement:
  Create infra/migrations/024_create_lineage.sql: lineages, lineage_members, memorial_records tables
  Create server/src/modules/lineage/: lineage.module.ts, lineage.service.ts (createMemorial, linkToLineage, getLineageTree, computeReputationScore), lineage.controller.ts
  Listen to CharacterDied event: auto-create memorial_record with life summary
  GET /api/lineages/:id — family tree with member list and reputation score
  GET /api/characters/:id/memorial — public memorial for dead character
  POST /api/lineages — found new lineage
  Register LineageModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/14.1-lineage-memorial
  git add server/src/modules/lineage/ infra/migrations/024_create_lineage.sql server/test/ server/src/app.module.ts
  git commit -m "feat(14.1): lineage system, bloodlines, memorial records on permadeath"
  gh pr create --draft --title "feat(14.1): lineage and memorial records" --body "Implements story 14.1. Lineages, memorial_records on CharacterDied, family tree API, reputation score. All criteria met."
```
