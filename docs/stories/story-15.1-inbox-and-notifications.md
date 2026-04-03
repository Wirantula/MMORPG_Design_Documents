# Story 15.1 — Inbox, Notifications and Persistent Messaging
**Epic:** 15 | **Role:** Backend Agent | **Status:** Blocked on 2.1 + 3.1

## Problem / intent
Players need a persistent inbox for messages, system alerts, trade confirmations, and announcements that survive beyond their WebSocket session.

## Acceptance criteria
- [ ] notifications table: id, recipient_id, type, title, body_json, read, created_at
- [ ] notification types: system_alert, trade_completed, contract_update, character_event, announcement, private_message
- [ ] GET /api/notifications — paginated, unread-first; PATCH /api/notifications/:id/read
- [ ] POST /api/messages — send private message to another character (if social contact exists)
- [ ] Unread notification count pushed via WebSocket notification:count_update event
- [ ] Announcements: POST /api/admin/announcements — broadcast to all connected players
- [ ] System events auto-create notifications on domain events (trade, contract, death, level-up)
- [ ] Unit tests: notification creation, read marking, unread count push, announcement broadcast

## Dependencies
- 2.1 ✅  |  3.1 ✅

## Scope
Only touch: server/src/modules/messaging/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, simulation core/

## Implementation notes
- notifications table: id, recipient_id, type, title, body_json (JSONB), read, created_at
- chat_messages table: id, sender_id, recipient_id, body, sent_at (already referenced in schema)
- Subscribe to domain events to auto-generate relevant notifications
- Push count via realtime gateway on each new notification

## Test notes
server/test/messaging.service.test.ts — notification creation on domain event, unread count, announcement

## Observability notes
Log notification dispatch with type and recipient_count

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 15.1 - Inbox, Notifications and Persistent Messaging.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-15.1-inbox-and-notifications.md && cat server/src/modules/realtime/realtime.gateway.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create infra/migrations/026_create_messaging.sql: notifications + chat_messages tables
  Create server/src/modules/messaging/: messaging.module.ts, notifications.service.ts (createNotification, markRead, getUnreadCount, broadcastAnnouncement), messaging.controller.ts
  Subscribe to domain events (MarketTradeExecuted, ContractCompleted, CharacterBorn etc.) to auto-create notifications
  Push notification:count_update via realtime gateway on each new notification
  GET /api/notifications, PATCH /api/notifications/:id/read
  POST /api/messages (private), POST /api/admin/announcements
  Register MessagingModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/15.1-messaging
  git add server/src/modules/messaging/ infra/migrations/026_create_messaging.sql server/test/ server/src/app.module.ts
  git commit -m "feat(15.1): inbox, notifications, private messages and admin announcements"
  gh pr create --draft --title "feat(15.1): inbox and notifications" --body "Implements story 15.1. Persistent notifications, private messages, announcement broadcast, WS count push. All criteria met."
```
