# Story 3.2 — Browser Client Shell
**Epic:** 3 | **Role:** Frontend Agent | **Status:** Blocked on 3.1

## Problem / intent
Players need a text-first readable interface to navigate the world with live updates.

## Acceptance criteria
- [ ] App shell has 5 panels: CharacterPanel, LocationPanel, ActionQueuePanel, ChatPanel, NotificationsPanel
- [ ] WS client connects on login, reconnects automatically on disconnect (exponential backoff)
- [ ] Character state updates in real time from character:update events
- [ ] Action queue shows active/queued actions from world:tick events
- [ ] Chat renders chat:message events and sends via chat:send command
- [ ] All panels reachable via keyboard (Tab navigation)
- [ ] Loading and error states shown for all async operations

## Dependencies
- 3.1 ✅

## Scope
Only touch: client/src/
Do NOT touch: server/, infra/, .github/

## Implementation notes
- Next.js app already at client/src/app/ — update page.tsx
- Create client/src/lib/ws-client.ts: singleton WS, typed event emitter, reconnect logic
- WS endpoint: process.env.NEXT_PUBLIC_WS_URL (default ws://localhost:3001)
- Use React state only (no external state library yet)

## Test notes
client/src/lib/ws-client.test.ts — reconnect logic using vitest mock WebSocket

## Observability notes
Console log WS connect/disconnect events

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Frontend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 3.2 - Browser Client Shell.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-3.2-browser-client-shell.md && cat client/src/app/page.tsx && cat server/src/contracts/message-envelope.ts

STEP 2 - Implement:
  Create client/src/lib/ws-client.ts: singleton WS class, auto-reconnect with exponential backoff, typed event emitter
  Create client/src/components/CharacterPanel.tsx, LocationPanel.tsx, ActionQueuePanel.tsx, ChatPanel.tsx, NotificationsPanel.tsx
  Update client/src/app/page.tsx: render all 5 panels, connect WS on mount, distribute events to panels
  Add NEXT_PUBLIC_WS_URL to client/.env.example

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/3.2-client-shell
  git add client/src/
  git commit -m "feat(3.2): browser client shell with 5 panels and live WS"
  gh pr create --draft --title "feat(3.2): browser client shell" --body "Implements story 3.2. 5 panels, WS client with reconnect, live updates. All criteria met."
```
