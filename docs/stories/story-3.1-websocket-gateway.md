# Story 3.1 — WebSocket Gateway
**Epic:** 3 | **Role:** Backend Agent | **Status:** Blocked on 2.1 + 1.3

## Problem / intent
Players need live updates without polling so the world feels persistent and alive.

## Acceptance criteria
- [ ] WS connections require valid JWT in handshake (auth query param)
- [ ] Unauthenticated connections rejected immediately
- [ ] Server sends heartbeat ping every 30s; disconnect if no pong within 10s
- [ ] Standard message envelope used for all messages (contracts/message-envelope.ts)
- [ ] Server events: world:tick, character:update, notification:new, chat:message
- [ ] Client commands: action:submit, chat:send, character:get
- [ ] Disconnect logged with account_id and reason
- [ ] Unit tests: auth accept, auth reject, heartbeat timeout

## Dependencies
- 2.1 ✅  |  1.3 ✅

## Scope
Only touch: server/src/modules/realtime/, server/test/
Do NOT touch: client/, simulation/, accounts/

## Implementation notes
- Scaffold already at server/src/modules/realtime/realtime.gateway.ts — extend it
- Inject JwtService, validate on handleConnection
- Map socket.id → account_id in private Map
- Emit ConnectionEstablished, ConnectionClosed domain events

## Test notes
server/test/realtime.gateway.test.ts — mock JWT, test auth rejection and valid connect

## Observability notes
Log ConnectionEstablished/Closed with account_id. Track connected_clients_count metric.

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 3.1 - WebSocket Gateway.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-3.1-websocket-gateway.md && cat server/src/modules/realtime/realtime.gateway.ts && cat server/src/contracts/message-envelope.ts

STEP 2 - Implement:
  Extend realtime.gateway.ts: inject JwtService, validate JWT on handleConnection, reject unauth sockets
  Add Map<socketId, accountId>, 30s heartbeat with 10s pong timeout, auto-disconnect
  Handle client commands: action:submit, chat:send, character:get
  Broadcast server events: world:tick, character:update, notification:new, chat:message
  Emit ConnectionEstablished, ConnectionClosed domain events with account_id

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/3.1-websocket-gateway
  git add server/src/modules/realtime/ server/test/
  git commit -m "feat(3.1): authenticated websocket gateway with heartbeat and command routing"
  gh pr create --draft --title "feat(3.1): WebSocket gateway" --body "Implements story 3.1. JWT auth, heartbeat, command routing, domain events. All criteria met."
```
