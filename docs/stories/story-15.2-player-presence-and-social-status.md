# Story 15.2 — Player Presence and Social Status
**Epic:** 15 | **Role:** Backend Agent | **Status:** Blocked on 15.1 + 3.1

## Problem / intent
Players need to know who else is online and in the same location so the world feels inhabited and social connections are meaningful.

## Acceptance criteria
- [ ] Presence states: online, away, busy, offline (set by player or auto-detected from WS activity)
- [ ] GET /api/world/nodes/:id/presence — list of characters present in a location with status
- [ ] Presence updates broadcast via WebSocket world:presence_update event
- [ ] Social contact list: POST /api/social/contacts (add), GET /api/social/contacts (list with presence)
- [ ] Privacy: presence visible to contacts and same-location players only; hidden from strangers across world
- [ ] Unit tests: presence update on connect/disconnect, privacy filter, contact list

## Dependencies
- 15.1 ✅  |  3.1 ✅

## Scope
Only touch: server/src/modules/messaging/presence/, server/src/modules/social/, infra/migrations/, server/test/

## Implementation notes
- Use Redis sorted set for active presence: key=node_id, member=character_id, score=last_seen_epoch
- social_contacts table: character_id, contact_character_id, added_at
- Auto-set offline when WS disconnects; auto-set online on WS connect

## Test notes
server/test/presence.service.test.ts — connect sets online, disconnect sets offline, privacy filter

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 15.2 - Player Presence and Social Status.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-15.2-player-presence-and-social-status.md && cat server/src/modules/messaging/messaging.module.ts && cat server/src/modules/realtime/realtime.gateway.ts

STEP 2 - Implement:
  Create infra/migrations/027_create_social.sql: social_contacts table
  Create server/src/modules/messaging/presence/: presence.service.ts (setPresence, getLocationPresence, broadcastPresenceUpdate)
  Create server/src/modules/social/: social.module.ts, social.service.ts, social.controller.ts
  Hook presence into realtime gateway: setOnline on connect, setOffline on disconnect
  GET /api/world/nodes/:id/presence, GET /api/social/contacts, POST /api/social/contacts
  Broadcast world:presence_update via realtime gateway

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/15.2-presence
  git add server/src/modules/messaging/presence/ server/src/modules/social/ infra/migrations/027_create_social.sql server/test/
  git commit -m "feat(15.2): player presence, social contacts, location awareness"
  gh pr create --draft --title "feat(15.2): player presence and social status" --body "Implements story 15.2. Redis presence, social contacts, location roster, privacy filters. All criteria met."
```
