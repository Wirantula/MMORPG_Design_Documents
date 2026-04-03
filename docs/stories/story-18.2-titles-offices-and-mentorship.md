# Story 18.2 — Titles, Offices and Mentorship
**Epic:** 18 | **Role:** Backend Agent | **Status:** Blocked on 18.1 + 6.2

## Problem / intent
Titles reward legacy and reputation. Offices give formal civic power. Mentorship creates meaningful elder/youth relationships that mechanically benefit both parties.

## Acceptance criteria
- [ ] Titles awarded by: settlement governors, guild leaders, or system events; stored per character
- [ ] Titles have rarity (common/rare/legendary) and display priority
- [ ] Offices: appointed positions with expiry and successor rules (settlement-level already in 10.2, extend here for guild/world scope)
- [ ] Mentorship: elder character (adult/elder stage) can mentor junior; junior gains +10% XP in mentor's primary skill domain; mentor gains Mentorship XP
- [ ] Active mentorships expire when junior reaches adult or mentor dies
- [ ] GET /api/characters/:id/titles; POST /api/mentorship/start; GET /api/mentorship/active
- [ ] Unit tests: title award, mentorship XP bonus, expiry on stage change, mentor death

## Dependencies
- 18.1 ✅  |  6.2 ✅

## Scope
Only touch: server/src/modules/titles/, server/src/modules/mentorship/, infra/migrations/, server/test/

## Implementation notes
- character_titles table: character_id, title_id, awarded_by, awarded_at
- titles master table: id, name, rarity, description
- mentorships table: mentor_id, mentee_id, domain, started_at, expires_at
- Wire +10% XP bonus into xp.service.ts via mentorship check

## Test notes
server/test/mentorship.service.test.ts — XP bonus, expiry, mentor death cleanup

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 18.2 - Titles, Offices and Mentorship.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-18.2-titles-offices-and-mentorship.md && cat server/src/modules/progression/xp.service.ts && cat server/src/modules/characters/lifecycle/lifecycle.service.ts

STEP 2 - Implement:
  Create infra/migrations/033_create_titles_mentorship.sql: titles, character_titles, mentorships tables
  Create server/src/modules/titles/: titles.module.ts, titles.service.ts (awardTitle, getTitles), titles.controller.ts
  Create server/src/modules/mentorship/: mentorship.module.ts, mentorship.service.ts (startMentorship, expireMentorship, getMentorshipBonus), mentorship.controller.ts
  Wire getMentorshipBonus() into xp.service.ts awardXP()
  Wire expireMentorship() on LifeStageTransition and CharacterDied events
  GET /api/characters/:id/titles, POST /api/mentorship/start, GET /api/mentorship/active

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/18.2-titles-mentorship
  git add server/src/modules/titles/ server/src/modules/mentorship/ infra/migrations/033_create_titles_mentorship.sql server/test/
  git commit -m "feat(18.2): titles, office awards, and mentorship XP bonuses"
  gh pr create --draft --title "feat(18.2): titles, offices and mentorship" --body "Implements story 18.2. Title awards, mentorship with +10% XP bonus, expiry on stage change/death. All criteria met."
```
