"""Generate all backlog story files for the CybaWorld MMORPG project."""
import os, pathlib

BASE = pathlib.Path(__file__).parent.parent.parent / "docs" / "stories"
BASE.mkdir(parents=True, exist_ok=True)


def w(name: str, content: str):
    p = BASE / name
    p.write_text(content.lstrip("\n"), encoding="utf-8")
    print(f"  created {name}")


# ── EPIC 2 ──────────────────────────────────────────────────────────────────

w("story-2.1-account-schema.md", """
# Story 2.1 — Account Schema and Identity Flows
**Epic:** 2 | **Role:** Backend Agent | **Status:** Ready (merge 1.2 first)

## Problem / intent
Players must register, log in, and hold a session so lineage and settings persist.

## Acceptance criteria
- [ ] POST /api/auth/register creates account with bcrypt-hashed password
- [ ] POST /api/auth/login returns JWT access token + refresh token
- [ ] POST /api/auth/refresh issues new access token
- [ ] POST /api/auth/logout invalidates refresh token
- [ ] accounts table: id (uuid), email (unique), password_hash, created_at, updated_at
- [ ] refresh_tokens table: id, account_id (fk), token_hash, expires_at
- [ ] Zod validation; invalid input → 400
- [ ] Audit events: AccountCreated, AccountLoggedIn via domain-events.ts
- [ ] Unit tests: register, login, duplicate email, bad password, refresh, logout

## Dependencies
- 1.1 ✅  |  1.2 (merge before firing)

## Scope
Only touch: server/src/modules/accounts/, server/src/modules/auth/, infra/migrations/, server/test/
Do NOT touch: client/, simulation/, .github/

## Implementation notes
- Packages: @nestjs/jwt bcryptjs (@types/bcryptjs dev)
- Global API prefix /api already set in main.ts
- Emit events via server/src/common/domain-events.ts
- Never log passwords or raw tokens

## Test notes
server/test/auth.service.test.ts — register→login→refresh→logout cycle

## Observability notes
Log AccountCreated, AccountLoggedIn at info with account id only

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 2.1 - Account Schema and Identity Flows.

STEP 1 - Read (do not stop after this):
  cat AGENTS.md && cat docs/stories/story-2.1-account-schema.md && cat server/src/app.module.ts && cat server/src/common/domain-events.ts && cat server/src/config/env.ts

STEP 2 - Implement:
  npm install @nestjs/jwt bcryptjs --workspace=server && npm install --save-dev @types/bcryptjs --workspace=server
  Create server/src/modules/accounts/: accounts.module.ts, accounts.service.ts
  Create server/src/modules/auth/: auth.module.ts, auth.service.ts, jwt.strategy.ts, jwt-auth.guard.ts
  Create infra/migrations/001_create_accounts.sql: accounts and refresh_tokens DDL
  Implement POST /api/auth/register, /login, /refresh, /logout
  Register AccountsModule + AuthModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate
  Fix errors and re-run until passing.

STEP 4 - Open PR:
  git checkout -b story/2.1-account-schema
  git add server/src/modules/accounts/ server/src/modules/auth/ infra/migrations/001_create_accounts.sql server/test/ server/src/app.module.ts
  git commit -m "feat(2.1): account schema, JWT auth, register/login/refresh/logout"
  gh pr create --draft --title "feat(2.1): account schema and identity flows" --body "Implements story 2.1. Accounts+Auth modules, JWT, migrations. All criteria met."
```
""")

w("story-2.2-single-character-enforcement.md", """
# Story 2.2 — Single-Character Enforcement
**Epic:** 2 | **Role:** Backend Agent | **Status:** Blocked on 2.1

## Problem / intent
Each account may control exactly one living character. The system must enforce this even under race conditions.

## Acceptance criteria
- [ ] Creating a character fails with 409 if the account already has a living character
- [ ] Race condition handled via DB unique partial index: (account_id) WHERE status='alive'
- [ ] CharacterDied event allows a new character to be created after permadeath
- [ ] Admin override stub: POST /api/admin/accounts/:id/reset-character (RBAC-gated, returns 200)
- [ ] Unit tests: create when none exists, create when one exists, create after death, race condition

## Dependencies
- 2.1 ✅

## Scope
Only touch: server/src/modules/characters/, infra/migrations/, server/test/
Do NOT touch: client/, simulation/, auth/

## Implementation notes
- characters table: id, account_id (fk), name, status (alive|dead|unborn), created_at, died_at
- Unique partial index: CREATE UNIQUE INDEX one_alive_per_account ON characters(account_id) WHERE status='alive'
- Emit CharacterBorn, CharacterDied domain events

## Test notes
server/test/character-enforcement.test.ts — concurrent create race condition test

## Observability notes
Log CharacterBorn, CharacterDied with account_id and character_id

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 2.2 - Single-Character Enforcement.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-2.2-single-character-enforcement.md && cat server/src/modules/accounts/accounts.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create server/src/modules/characters/: characters.module.ts, characters.service.ts, characters.controller.ts
  Create infra/migrations/002_create_characters.sql with characters table + unique partial index
  POST /api/characters: enforce one-alive rule, emit CharacterBorn
  POST /api/admin/accounts/:id/reset-character: stub, RBAC guard, returns 200
  Register CharactersModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/2.2-single-character
  git add server/src/modules/characters/ infra/migrations/002_create_characters.sql server/test/ server/src/app.module.ts
  git commit -m "feat(2.2): single-character enforcement with DB partial index"
  gh pr create --draft --title "feat(2.2): single-character enforcement" --body "Implements story 2.2. One-alive-per-account via partial index, CharacterBorn/Died events, admin stub. All criteria met."
```
""")

# ── EPIC 3 ──────────────────────────────────────────────────────────────────

w("story-3.1-websocket-gateway.md", """
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
""")

w("story-3.2-browser-client-shell.md", """
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
""")

# ── EPIC 4 remaining ─────────────────────────────────────────────────────────

w("story-4.3-offline-routine-mode.md", """
# Story 4.3 — Offline Routine Mode
**Epic:** 4 | **Role:** Backend Agent | **Status:** Ready ✅ (4.2 done)

## Problem / intent
Characters should follow routines while the player is offline so the game stays playable.

## Acceptance criteria
- [ ] Characters can have up to 3 routine slots (actionType + priority)
- [ ] Offline processing runs at 60% efficiency vs active play
- [ ] Routine processing skips if needs (hunger/fatigue) are critical
- [ ] Dangerous actions blocked for infant/child life stages
- [ ] On next login, player receives OfflineReport: duration, actions_completed, xp_earned, needs_changes, warnings
- [ ] Routine state persisted per character
- [ ] Unit tests: routine execution, safety defaults, efficiency penalty, report generation

## Dependencies
- 4.2 ✅

## Scope
Only touch: server/src/modules/simulation/routines/, server/src/modules/simulation/simulation.module.ts, server/test/
Do NOT touch: client/, auth/, characters/

## Implementation notes
- Create routine.types.ts: RoutineSlot, OfflineReport types
- Create routine.service.ts: processOfflineRoutines(), generateOfflineReport()
- 0.6 efficiency multiplier on XP and output rewards
- Emit OfflineReportGenerated domain event
- offline_since timestamp stored on character state, cleared on login

## Test notes
server/test/routine.service.test.ts — 3 slots, blocked dangerous action, report content

## Observability notes
Log routine start/end with character_id and action count. Metric: offline_routines_processed_total

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 4.3 - Offline Routine Mode.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-4.3-offline-routine-mode.md && cat server/src/modules/simulation/simulation.service.ts && cat server/src/modules/simulation/tick.service.ts && cat server/src/modules/simulation/actions/action.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create server/src/modules/simulation/routines/routine.types.ts: RoutineSlot, OfflineReport interfaces
  Create server/src/modules/simulation/routines/routine.service.ts: processOfflineRoutines(), generateOfflineReport()
  Apply 0.6 efficiency multiplier for offline XP and outputs
  Block dangerous actions for infant/child stages; skip steps when needs critical
  Emit OfflineReportGenerated domain event; store offline_since on character
  Register RoutineService in simulation.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/4.3-offline-routine
  git add server/src/modules/simulation/routines/ server/src/modules/simulation/simulation.module.ts server/test/
  git commit -m "feat(4.3): offline routine mode with 60% efficiency and safety defaults"
  gh pr create --draft --title "feat(4.3): offline routine mode" --body "Implements story 4.3. Routine slots, offline processing at 60% efficiency, OfflineReport generation. All criteria met."
```
""")

# ── EPIC 5 ──────────────────────────────────────────────────────────────────

w("story-5.1-birth-and-wheel-generation.md", """
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
""")

w("story-5.2-life-stages-family-protection.md", """
# Story 5.2 — Life Stages and Family Protection
**Epic:** 5 | **Role:** Backend Agent | **Status:** Blocked on 5.1 + 4.2

## Problem / intent
New characters start as infants in a protected environment so early life isn't trivially lost.

## Acceptance criteria
- [ ] 5 life stages: infant (0-2), child (3-9), teen (10-14), adult (15-45), elder (46+)
- [ ] Stage transitions are automatic based on in-game age
- [ ] Dangerous actions blocked for infant and child stages
- [ ] Family NPC provides food and shelter for infant/child; neglect triggers safety alert
- [ ] Tutorial prompts fire at each stage transition
- [ ] Unit tests: stage transition, action blocking, family support triggers

## Dependencies
- 5.1 ✅  |  4.2 ✅

## Scope
Only touch: server/src/modules/characters/lifecycle/, server/src/modules/simulation/family/, server/test/
Do NOT touch: economy/, realtime/, client/

## Implementation notes
- Life stage derived from character age (world time delta from born_at)
- Family NPC: household_state JSONB on family row; resolved via tick
- Emit LifeStageTransition domain event

## Test notes
server/test/lifecycle.service.test.ts — stage transitions, blocked actions, family safety alert

## Observability notes
Log LifeStageTransition with character_id and new stage

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 5.2 - Life Stages and Family Protection.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-5.2-life-stages-family-protection.md && cat server/src/modules/simulation/simulation.service.ts && cat server/src/modules/simulation/tick.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create server/src/modules/characters/lifecycle/lifecycle.service.ts: computeLifeStage(), enforceStageRestrictions()
  Create server/src/modules/simulation/family/family.service.ts: resolveFamilySupport(), triggerSafetyAlert()
  Create infra/migrations/004_create_families.sql: families table with household_state JSONB
  Emit LifeStageTransition domain event on stage change
  Wire lifecycle check into tick.service.ts daily tick

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/5.2-life-stages
  git add server/src/modules/characters/lifecycle/ server/src/modules/simulation/family/ infra/migrations/ server/test/
  git commit -m "feat(5.2): life stages state machine and family protection system"
  gh pr create --draft --title "feat(5.2): life stages and family protection" --body "Implements story 5.2. 5 stages, action restrictions, family NPC support, tutorial triggers. All criteria met."
```
""")

w("story-5.3-dual-stat-layer.md", """
# Story 5.3 — Dual Stat Layer System
**Epic:** 5 | **Role:** Backend Agent | **Status:** Blocked on 5.1 + 4.2

## Problem / intent
Characters have visible stats (current capability) and hidden potential stats (growth ceiling, learning efficiency, scenario bias) to make lives asymmetric.

## Acceptance criteria
- [ ] Visible stat families: Physical (STR/AGI/END/REC), Mental (INT/FOC/CRE/MEM), Social (CHA/AUT/EMP/DEC), Perceptual (AWR/PRE/INS), Spiritual (WIL/RES/AET), Economic (APR/NEG/LOG)
- [ ] Hidden potential families: growth_elasticity, ceiling_bias, fortune_bias, craft_intuition, combat_instinct, research_spark, trauma_susceptibility (all 0–100)
- [ ] All stats 0–1,000,000; level 100 = peak human
- [ ] Hidden layer is server-only; never serialised in player-facing API responses
- [ ] Admin debug endpoint GET /api/admin/characters/:id/potential returns full hidden layer
- [ ] Unit tests: stat initialisation from wheel results, hidden layer not in player API response

## Dependencies
- 5.1 ✅  |  4.2 ✅

## Scope
Only touch: server/src/modules/characters/stats/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, realtime/

## Implementation notes
- Tables: character_current_stats, character_potential_stats (separate rows, same character_id FK)
- Stats stored as JSONB columns per family for flexibility
- Initialise stats from wheel_results via a stat-seeding function

## Test notes
server/test/stats.service.test.ts — initialisation, hidden layer exclusion from player DTO

## Observability notes
Log stat initialisation with character_id and stat family counts

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 5.3 - Dual Stat Layer System.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-5.3-dual-stat-layer.md && cat server/src/modules/characters/characters.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create server/src/modules/characters/stats/: stat.types.ts (all stat families + hidden potential types), stat.service.ts (initStats, getVisibleStats, getPotentialStats), stat.constants.ts (PEAK_HUMAN = 100)
  Create infra/migrations/005_create_character_stats.sql: character_current_stats + character_potential_stats tables with JSONB columns
  Ensure hidden potential never appears in player-facing GET /api/characters/:id response
  Admin endpoint GET /api/admin/characters/:id/potential — RBAC-gated, returns full hidden layer

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/5.3-dual-stat-layer
  git add server/src/modules/characters/stats/ infra/migrations/005_create_character_stats.sql server/test/
  git commit -m "feat(5.3): dual stat layer — visible stats and hidden potential"
  gh pr create --draft --title "feat(5.3): dual stat layer system" --body "Implements story 5.3. Visible stats (6 families), hidden potential (7 values), migration 005, admin debug endpoint. All criteria met."
```
""")

w("story-5.4-passive-hidden-traits.md", """
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
""")

# ── EPIC 6 ──────────────────────────────────────────────────────────────────

w("story-6.1-xp-and-scaling-curves.md", """
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
""")

w("story-6.2-skill-taxonomy.md", """
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
""")

w("story-6.3-emergent-skill-pipeline.md", """
# Story 6.3 — AI-Assisted Emergent Skill Pipeline
**Epic:** 6 | **Role:** AI Systems Agent | **Status:** Blocked on 6.2 + 4.2 + 11.2

## Problem / intent
Rare new skills should be able to emerge safely from repeated player behaviour so the game can evolve over time without destabilising balance.

## Acceptance criteria
- [ ] Actions emit semantic fingerprints: verb, domain, tool, output_class, context
- [ ] Fingerprint detector identifies novel action clusters not matching existing skills
- [ ] AI worker receives sanitised context and proposes: name, parent_skill_id, description, effect_template
- [ ] Rules engine scores proposal: duplicate risk, naming rules, taxonomy fit, exploit risk
- [ ] Proposals stored in ai_skill_proposals table with versioned record, provenance, score, moderation_status
- [ ] Admin review queue GET/PATCH /api/admin/skill-proposals
- [ ] Approved proposals create live skill definitions via existing skills table
- [ ] Non-AI fallback: proposal rejected if AI provider is down
- [ ] Unit tests: fingerprint emission, similarity match, scoring, non-AI fallback

## Dependencies
- 6.2 ✅  |  4.2 ✅  |  11.2 ✅

## Scope
Only touch: server/src/modules/skills/emergent/, server/src/modules/ai/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, simulation core/

## Implementation notes
- ai_skill_proposals table: id, fingerprint_hash, proposed_name, parent_skill_id, description, effect_template, score, moderation_status, created_at
- Use OpenAI API (key from env OPENAI_API_KEY) — with circuit breaker fallback
- Similarity check: cosine similarity of fingerprint vectors vs existing skill embeddings

## Test notes
server/test/emergent-skill.service.test.ts — mock AI, test scoring, fallback path

## Observability notes
Emit AIProposalCreated, AIProposalApproved domain events

## Review owner
Product Owner (Joshua) — human must approve all proposals before publish

---
## Cloud agent execution prompt
```
You are the AI Systems Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 6.3 - AI-Assisted Emergent Skill Pipeline.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-6.3-emergent-skill-pipeline.md && cat server/src/modules/skills/skills.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create infra/migrations/008_create_ai_skill_proposals.sql
  Create server/src/modules/ai/: ai.module.ts, ai.service.ts (OpenAI calls with circuit breaker fallback)
  Create server/src/modules/skills/emergent/: fingerprint.service.ts, similarity.service.ts, proposal.service.ts, proposal.controller.ts (admin routes)
  Wire fingerprint emission into action.service.ts (call emitFingerprint after each action)
  Admin GET /api/admin/skill-proposals, PATCH /api/admin/skill-proposals/:id (approve/reject)

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/6.3-emergent-skills
  git add server/src/modules/skills/emergent/ server/src/modules/ai/ infra/migrations/008_create_ai_skill_proposals.sql server/test/
  git commit -m "feat(6.3): AI-assisted emergent skill pipeline with moderation gate"
  gh pr create --draft --title "feat(6.3): emergent skill pipeline" --body "Implements story 6.3. Fingerprinting, similarity check, AI proposal, scoring, admin review queue. All criteria met."
```
""")

# ── EPIC 7 ──────────────────────────────────────────────────────────────────

w("story-7.1-needs-system.md", """
# Story 7.1 — Needs System
**Epic:** 7 | **Role:** Backend Agent | **Status:** Blocked on 4.2 + 5.2

## Problem / intent
Hunger, sleep, hygiene, morale, and belonging must matter so routine choices become meaningful.

## Acceptance criteria
- [ ] 5 need dimensions: nutrition, fatigue, hygiene, morale, belonging (each 0–100)
- [ ] Needs decay at configured rates per in-game day via daily tick
- [ ] Need level modifies action outcome quality and XP gain (−30% at critical, +10% at full)
- [ ] Critical needs (< 10) trigger warnings visible to player
- [ ] GET /api/characters/:id/needs returns current need levels with status labels
- [ ] Routines can include need-recovery actions (eat, sleep, socialise)
- [ ] Unit tests: decay rates, modifier application, critical warning trigger

## Dependencies
- 4.2 ✅  |  5.2 ✅

## Scope
Only touch: server/src/modules/needs/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, realtime/

## Implementation notes
- character_needs table: character_id, nutrition, fatigue, hygiene, morale, belonging, updated_at
- Decay wired into tick.service.ts daily tick
- Modifier hook: NeedsService.getModifier(characterId) → multiplier used by action.service.ts

## Test notes
server/test/needs.service.test.ts — decay after N ticks, modifier at critical/full, warning fire

## Observability notes
Log critical need warnings with character_id and need dimension

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 7.1 - Needs System.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-7.1-needs-system.md && cat server/src/modules/simulation/tick.service.ts && cat server/src/modules/simulation/actions/action.service.ts

STEP 2 - Implement:
  Create infra/migrations/009_create_character_needs.sql
  Create server/src/modules/needs/: needs.module.ts, needs.service.ts (decayNeeds, getModifier, getNeedsStatus, triggerWarnings), needs.controller.ts
  Wire decayNeeds() into tick.service.ts daily tick
  Apply getModifier() multiplier in action.service.ts outcome resolution
  GET /api/characters/:id/needs: current values with status labels (critical/low/ok/full)

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/7.1-needs-system
  git add server/src/modules/needs/ infra/migrations/009_create_character_needs.sql server/test/
  git commit -m "feat(7.1): needs system — nutrition/fatigue/hygiene/morale/belonging with decay and modifiers"
  gh pr create --draft --title "feat(7.1): needs system" --body "Implements story 7.1. 5 need dimensions, daily decay, action modifier hook, critical warnings. All criteria met."
```
""")

w("story-7.2-health-injury-recovery.md", """
# Story 7.2 — Health, Injury and Recovery
**Epic:** 7 | **Role:** Backend Agent | **Status:** Blocked on 7.1

## Problem / intent
Wounds and illness create consequences beyond hit points, requiring treatment and recovery time.

## Acceptance criteria
- [ ] Health condition types: wound (severity 1-5), illness (acute/chronic), exhaustion, poisoning
- [ ] Each condition has: duration_days, stat_penalty_modifier, recovery_action_required
- [ ] Conditions stack with diminishing severity
- [ ] Treatment linked to profession skills (e.g. Surgery reduces wound recovery time 50%)
- [ ] Early-life safety: no lethal conditions for infant/child stages
- [ ] GET /api/characters/:id/health returns active conditions with recovery prognosis
- [ ] Unit tests: condition application, stacking, treatment reduction, infant safety

## Dependencies
- 7.1 ✅

## Scope
Only touch: server/src/modules/health/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, realtime/

## Implementation notes
- character_conditions table: id, character_id, type, severity, started_at, resolves_at, treated_by_skill
- Conditions checked each tick; expired ones auto-resolved

## Test notes
server/test/health.service.test.ts — wound → treatment → recovery timeline

## Observability notes
Log condition applied/resolved with character_id, type, severity

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 7.2 - Health, Injury and Recovery.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-7.2-health-injury-recovery.md && cat server/src/modules/needs/needs.service.ts && cat server/src/modules/simulation/tick.service.ts

STEP 2 - Implement:
  Create infra/migrations/010_create_character_conditions.sql
  Create server/src/modules/health/: health.module.ts, health.service.ts (applyCondition, resolveCondition, getTreatmentReduction, checkInfantSafety), health.controller.ts
  Wire condition resolution into tick.service.ts
  GET /api/characters/:id/health: active conditions with recovery prognosis
  Block lethal conditions for infant/child life stages

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/7.2-health-injury
  git add server/src/modules/health/ infra/migrations/010_create_character_conditions.sql server/test/
  git commit -m "feat(7.2): health conditions, injury, recovery with profession treatment"
  gh pr create --draft --title "feat(7.2): health, injury and recovery" --body "Implements story 7.2. Condition types, stacking, treatment reductions, infant safety. All criteria met."
```
""")

# ── EPIC 8 ──────────────────────────────────────────────────────────────────

w("story-8.1-item-identity-model.md", """
# Story 8.1 — Item Type-Variant-Instance Model
**Epic:** 8 | **Role:** Backend Agent | **Status:** Ready ✅ (1.1 done)

## Problem / intent
Items need deterministic canonical identities so markets and storage remain manageable while preserving uniqueness.

## Acceptance criteria
- [ ] item_template_id: design-time category definition (e.g. "Iron Sword")
- [ ] item_canonical_id: same name + same defining stat profile → same canonical ID (hashed)
- [ ] item_variation_id: stat deviations within a canonical family
- [ ] item_instance_id: individual owned copy with durability, provenance, owner, embedded modifiers
- [ ] Canonicalisation hash deterministic: same inputs always yield same canonical_id
- [ ] GET /api/items/canonical/:id returns canonical item data
- [ ] GET /api/characters/:id/inventory returns instance-level items
- [ ] Unit tests: hash consistency, variation branching, instance creation

## Dependencies
- 1.1 ✅

## Scope
Only touch: server/src/modules/items/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, simulation/

## Implementation notes
- Tables: item_templates, item_canonicals, item_variations, item_instances
- Canonical hash: SHA-256 of (name + sorted stat profile JSON)
- item_instances: id, variation_id, owner_character_id, durability, provenance_json, created_at

## Test notes
server/test/items.service.test.ts — hash determinism, variation branch, instance ownership transfer

## Observability notes
Emit ItemCreated domain event with instance_id and canonical_id

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 8.1 - Item Type-Variant-Instance Model.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-8.1-item-identity-model.md && cat server/src/common/domain-events.ts && cat server/src/app.module.ts

STEP 2 - Implement:
  Create infra/migrations/011_create_items.sql: item_templates, item_canonicals, item_variations, item_instances tables
  Create server/src/modules/items/: items.module.ts, items.service.ts (canonicalise, createInstance, getInventory), items.controller.ts
  Canonical hash: SHA-256 of JSON.stringify({name, stats: sorted})
  GET /api/items/canonical/:id, GET /api/characters/:id/inventory
  Emit ItemCreated domain event on instance creation
  Register ItemsModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/8.1-item-identity
  git add server/src/modules/items/ infra/migrations/011_create_items.sql server/test/ server/src/app.module.ts
  git commit -m "feat(8.1): item type-variant-instance model with deterministic canonical hash"
  gh pr create --draft --title "feat(8.1): item identity model" --body "Implements story 8.1. 4-layer item identity, SHA-256 canonical hash, inventory API, ItemCreated event. All criteria met."
```
""")

w("story-8.2-recipe-crafting-engine.md", """
# Story 8.2 — Recipe and Crafting Engine
**Epic:** 8 | **Role:** Backend Agent | **Status:** Blocked on 8.1 + 4.2 + 6.1

## Problem / intent
Crafters need to produce useful items so non-combat progression is real and economically meaningful.

## Acceptance criteria
- [ ] Recipes defined in tools/content/recipes.json: inputs (item_canonical_ids + quantities), output_template_id, time_seconds, required_skill_id + min_level
- [ ] POST /api/crafting/start validates inventory, reserves inputs, creates craft_job
- [ ] Craft job resolves on tick; output quality varies with skill level and stats
- [ ] Quality range: 50–150% of base stats (normal distribution, skill shifts mean)
- [ ] Failure states: critical fail destroys inputs, partial fail produces degraded item
- [ ] GET /api/characters/:id/craft-jobs returns active and completed jobs
- [ ] Unit tests: input reservation, quality variance, failure states, completion

## Dependencies
- 8.1 ✅  |  4.2 ✅  |  6.1 ✅

## Scope
Only touch: server/src/modules/crafting/, tools/content/recipes.json, infra/migrations/, server/test/
Do NOT touch: client/, economy/, auth/

## Implementation notes
- craft_jobs table: id, character_id, recipe_id, status, started_at, completes_at, output_instance_id
- Quality formula: base + (skill_level - recipe_min_level) * 0.5 + random(−25, +25)
- Inputs reserved on job start; released on fail; consumed on success

## Test notes
server/test/crafting.service.test.ts — start, tick resolution, quality curve, fail state

## Observability notes
Log craft job start/complete/fail with character_id, recipe_id, quality_score

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 8.2 - Recipe and Crafting Engine.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-8.2-recipe-crafting-engine.md && cat server/src/modules/items/items.service.ts && cat server/src/modules/simulation/tick.service.ts

STEP 2 - Implement:
  Create tools/content/recipes.json: 10 starter recipes covering food, tools, basic weapons
  Create infra/migrations/012_create_craft_jobs.sql
  Create server/src/modules/crafting/: crafting.module.ts, crafting.service.ts (startCraft, resolveCraft, computeQuality), crafting.controller.ts
  POST /api/crafting/start, GET /api/characters/:id/craft-jobs
  Wire resolveCraft() into tick.service.ts
  Reserve inputs on start; compute quality on complete; handle failure states

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/8.2-crafting-engine
  git add server/src/modules/crafting/ tools/content/recipes.json infra/migrations/012_create_craft_jobs.sql server/test/
  git commit -m "feat(8.2): recipe and crafting engine with quality variance and failure states"
  gh pr create --draft --title "feat(8.2): recipe and crafting engine" --body "Implements story 8.2. Recipe DSL, craft jobs, quality formula, failure states. All criteria met."
```
""")

w("story-8.3-workshops-production-spaces.md", """
# Story 8.3 — Workshops and Production Spaces
**Epic:** 8 | **Role:** Backend Agent | **Status:** Blocked on 8.2 + 10.1

## Problem / intent
Buildings and workstations should shape production efficiency so infrastructure investment matters.

## Acceptance criteria
- [ ] Workshop types: basic_forge, carpentry_bench, alchemy_lab, kitchen, tannery (data-driven)
- [ ] Each workshop has station_quality (1–5) that multiplies craft quality and reduces time
- [ ] Advanced recipes require minimum workshop tier
- [ ] Workshops owned by settlements or individuals; access permissions enforced
- [ ] GET /api/settlements/:id/workshops and GET /api/characters/:id/workshops
- [ ] Unit tests: quality multiplier, tier gate, permission enforcement

## Dependencies
- 8.2 ✅  |  10.1 ✅

## Scope
Only touch: server/src/modules/workshops/, tools/content/workshops.json, infra/migrations/, server/test/
Do NOT touch: client/, economy/, simulation core/

## Implementation notes
- workshops table: id, settlement_id (nullable), owner_character_id (nullable), type, station_quality, access_policy
- station_quality multiplier: quality * (1 + 0.15 * (station_quality - 1))
- time multiplier: base_time * (1 - 0.1 * (station_quality - 1))

## Test notes
server/test/workshops.service.test.ts — multiplier at each tier, tier gate rejection, permission check

## Observability notes
Log workshop access granted/denied with character_id and workshop_id

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 8.3 - Workshops and Production Spaces.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-8.3-workshops-production-spaces.md && cat server/src/modules/crafting/crafting.service.ts

STEP 2 - Implement:
  Create tools/content/workshops.json: 5 workshop types with tier requirements
  Create infra/migrations/013_create_workshops.sql
  Create server/src/modules/workshops/: workshops.module.ts, workshops.service.ts, workshops.controller.ts
  Apply station_quality multipliers in crafting.service.ts
  GET /api/settlements/:id/workshops, GET /api/characters/:id/workshops
  Enforce access_policy (public/members/owner) in crafting start flow

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/8.3-workshops
  git add server/src/modules/workshops/ tools/content/workshops.json infra/migrations/013_create_workshops.sql server/test/
  git commit -m "feat(8.3): workshops and production spaces with station quality multipliers"
  gh pr create --draft --title "feat(8.3): workshops and production spaces" --body "Implements story 8.3. 5 workshop types, quality/time multipliers, tier gates, permission enforcement. All criteria met."
```
""")

# ── EPIC 9 ──────────────────────────────────────────────────────────────────

w("story-9.1-market-listings.md", """
# Story 9.1 — Market Listings and Order Book
**Epic:** 9 | **Role:** Economy Agent | **Status:** Blocked on 8.1 + 8.2 + 3.2

## Problem / intent
Traders need to buy and sell goods through reliable player-driven market systems.

## Acceptance criteria
- [ ] POST /api/market/listings: create sell listing (item_instance_id, price, quantity, expires_at)
- [ ] POST /api/market/orders: create buy order (canonical_id, max_price, quantity)
- [ ] Order matching runs on tick: best ask fills best bid, transaction recorded
- [ ] Listing fee: 1% of price, sent to settlement treasury (or sink if no settlement)
- [ ] Anti-spam: max 20 active listings per character
- [ ] GET /api/market/listings?canonical_id=: price history + current depth
- [ ] Price history stored: 30 data points per canonical item
- [ ] Unit tests: listing, matching, fee calculation, anti-spam limit

## Dependencies
- 8.1 ✅  |  8.2 ✅  |  3.2 ✅

## Scope
Only touch: server/src/modules/economy/, infra/migrations/, server/test/
Do NOT touch: client/, simulation core/, crafting/

## Implementation notes
- market_listings table: id, seller_id, item_instance_id, canonical_id, price, quantity, status, expires_at
- market_orders table: id, buyer_id, canonical_id, max_price, quantity, status
- market_price_history table: canonical_id, price, quantity, traded_at
- Matching: idempotent, with inventory reservation via items.service

## Test notes
server/test/market.service.test.ts — listing → order → match → transfer cycle, fee deduction

## Observability notes
Emit MarketTradeExecuted domain event with canonical_id, price, quantity

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Economy Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 9.1 - Market Listings and Order Book.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-9.1-market-listings.md && cat server/src/modules/items/items.service.ts && cat server/src/modules/simulation/tick.service.ts

STEP 2 - Implement:
  Create infra/migrations/014_create_market.sql: market_listings, market_orders, market_price_history
  Create server/src/modules/economy/: economy.module.ts, market.service.ts (createListing, createOrder, matchOrders, recordHistory), market.controller.ts
  Wire matchOrders() into tick.service.ts
  POST /api/market/listings, POST /api/market/orders, GET /api/market/listings
  Deduct 1% listing fee; enforce 20-listing anti-spam limit; emit MarketTradeExecuted

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/9.1-market-listings
  git add server/src/modules/economy/ infra/migrations/014_create_market.sql server/test/
  git commit -m "feat(9.1): market listings, order book, matching engine, price history"
  gh pr create --draft --title "feat(9.1): market listings and order book" --body "Implements story 9.1. Listings, buy orders, tick-based matching, fees, price history. All criteria met."
```
""")

w("story-9.2-contracts.md", """
# Story 9.2 — Contracts
**Epic:** 9 | **Role:** Economy Agent | **Status:** Blocked on 9.1

## Problem / intent
Labor and delivery contracts let players monetize services, not just goods.

## Acceptance criteria
- [ ] Contract types: work (deliver labour), delivery (transport item), construction (milestone-based)
- [ ] Contracts have: offerer, acceptor, terms_json, escrow_amount, status, deadline
- [ ] Escrow held in contract until completion; returned on breach
- [ ] POST /api/contracts: create, GET /api/contracts/:id, PATCH /api/contracts/:id/complete, PATCH /api/contracts/:id/breach
- [ ] Breach triggers escrow release to non-breaching party and ContractBreached event
- [ ] Unit tests: create, accept, complete, breach with escrow flows

## Dependencies
- 9.1 ✅

## Scope
Only touch: server/src/modules/economy/contracts/, infra/migrations/, server/test/
Do NOT touch: client/, simulation core/, items/

## Implementation notes
- contracts table: id, type, offerer_id, acceptor_id, terms_json, escrow_amount, status, deadline, created_at
- Currency held in escrow_amount column; released atomically on complete/breach

## Test notes
server/test/contracts.service.test.ts — full lifecycle including breach scenario

## Observability notes
Emit ContractCompleted, ContractBreached domain events

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Economy Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 9.2 - Contracts.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-9.2-contracts.md && cat server/src/modules/economy/market.service.ts

STEP 2 - Implement:
  Create infra/migrations/015_create_contracts.sql
  Create server/src/modules/economy/contracts/: contracts.service.ts, contracts.controller.ts
  POST /api/contracts, GET /api/contracts/:id, PATCH /api/contracts/:id/complete, PATCH /api/contracts/:id/breach
  Atomic escrow release; emit ContractCompleted, ContractBreached domain events

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/9.2-contracts
  git add server/src/modules/economy/contracts/ infra/migrations/015_create_contracts.sql server/test/
  git commit -m "feat(9.2): labor and delivery contracts with escrow"
  gh pr create --draft --title "feat(9.2): contracts" --body "Implements story 9.2. Work/delivery/construction contracts, escrow, breach handling. All criteria met."
```
""")

w("story-9.3-economy-dashboards.md", """
# Story 9.3 — Economy Dashboards
**Epic:** 9 | **Role:** Economy Agent | **Status:** Blocked on 9.1 + 12.1

## Problem / intent
Hosts need market and sink/faucet dashboards so the economy can be monitored and balanced.

## Acceptance criteria
- [ ] GET /api/admin/economy/summary: top traded items, total volume, price velocity
- [ ] GET /api/admin/economy/sinks: total currency destroyed (fees, upkeep) per day
- [ ] GET /api/admin/economy/faucets: total currency created (rewards, NPC trades) per day
- [ ] Alerts: shortages (no listings for key items > 3 days), inflation (price up > 50% in 7 days)
- [ ] Reports exported as JSON to infra/exports/ on schedule
- [ ] All endpoints RBAC-gated (admin only)
- [ ] Unit tests: summary aggregation, shortage detection, inflation detection

## Dependencies
- 9.1 ✅  |  12.1 ✅

## Scope
Only touch: server/src/modules/economy/dashboards/, server/src/modules/admin/, server/test/
Do NOT touch: client/, simulation core/, crafting/

## Implementation notes
- Query market_price_history and market_listings for aggregations
- Schedule daily export job via tick.service background scheduler
- Shortage alert: canonical items with 0 active listings for 3+ in-game days

## Test notes
server/test/economy-dashboard.service.test.ts — shortage detection, inflation detection

## Observability notes
Log dashboard export completion with row counts and file path

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Economy Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 9.3 - Economy Dashboards.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-9.3-economy-dashboards.md && cat server/src/modules/economy/market.service.ts

STEP 2 - Implement:
  Create server/src/modules/economy/dashboards/: dashboard.service.ts (summarise, detectShortages, detectInflation, exportReport), dashboard.controller.ts
  GET /api/admin/economy/summary, /sinks, /faucets — all RBAC-gated
  Wire daily export into tick.service background scheduler

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/9.3-economy-dashboards
  git add server/src/modules/economy/dashboards/ server/test/
  git commit -m "feat(9.3): economy dashboards with shortage and inflation detection"
  gh pr create --draft --title "feat(9.3): economy dashboards" --body "Implements story 9.3. Summary, sinks/faucets, alerts, daily export. All criteria met."
```
""")

# ── EPIC 10 ─────────────────────────────────────────────────────────────────

w("story-10.1-settlement-project-system.md", """
# Story 10.1 — Settlement Project System
**Epic:** 10 | **Role:** Backend Agent | **Status:** Blocked on 8.2 + 9.2

## Problem / intent
Communities need to build shared infrastructure so locations can evolve and matter strategically.

## Acceptance criteria
- [ ] Project types: housing, workshop, governance_hub, defence_wall (data-driven)
- [ ] Projects have milestones with material + labour requirements
- [ ] Players contribute items and labour actions toward milestones
- [ ] Milestone completion broadcasts public progress event
- [ ] Completed projects unlock capabilities (e.g. completed workshop unlocks 8.3 station)
- [ ] GET /api/settlements/:id/projects and POST /api/settlements/:id/projects/:id/contribute
- [ ] Unit tests: contribution, milestone completion, capability unlock

## Dependencies
- 8.2 ✅  |  9.2 ✅

## Scope
Only touch: server/src/modules/settlements/, tools/content/projects.json, infra/migrations/, server/test/
Do NOT touch: client/, economy market/, simulation core/

## Implementation notes
- settlements table: id, name, founded_by, world_node_id, founded_at
- settlement_projects table: id, settlement_id, type, status, milestone_data_json
- Emit SettlementUnlocked domain event when project completes

## Test notes
server/test/settlement-project.service.test.ts — contribute, milestone complete, unlock event

## Observability notes
Emit SettlementUnlocked with settlement_id and project_type

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 10.1 - Settlement Project System.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-10.1-settlement-project-system.md && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create tools/content/projects.json: 4 project types with milestone requirements
  Create infra/migrations/016_create_settlements.sql: settlements + settlement_projects
  Create server/src/modules/settlements/: settlements.module.ts, settlements.service.ts, projects.service.ts, settlements.controller.ts
  POST /api/settlements/:id/projects/:id/contribute, GET /api/settlements/:id/projects
  Emit SettlementUnlocked on project completion

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/10.1-settlement-projects
  git add server/src/modules/settlements/ tools/content/projects.json infra/migrations/016_create_settlements.sql server/test/
  git commit -m "feat(10.1): settlement project system with milestones and capability unlocks"
  gh pr create --draft --title "feat(10.1): settlement project system" --body "Implements story 10.1. 4 project types, milestones, contributions, SettlementUnlocked event. All criteria met."
```
""")

w("story-10.2-citizenship-and-roles.md", """
# Story 10.2 — Citizenship and Roles
**Epic:** 10 | **Role:** Backend Agent | **Status:** Blocked on 10.1

## Problem / intent
Formal membership and office systems allow player-run institutions to exist with enforceable structure.

## Acceptance criteria
- [ ] Membership statuses: citizen, resident, visitor, banned
- [ ] Roles: founder, governor, council_member, officer, citizen (tiered permissions)
- [ ] POST /api/settlements/:id/membership/apply, PATCH /api/settlements/:id/membership/:id/approve
- [ ] Role assignment: founder can appoint governor; governor can appoint council; council can appoint officers
- [ ] Roles expire if the holder leaves or is removed
- [ ] GET /api/settlements/:id/roster lists members with roles
- [ ] Unit tests: apply, approve, role assignment chain, role expiry

## Dependencies
- 10.1 ✅

## Scope
Only touch: server/src/modules/settlements/membership/, infra/migrations/, server/test/

## Implementation notes
- settlement_memberships table: id, settlement_id, character_id, status, role, joined_at, expires_at
- Permission matrix enforced in service layer, not just controller

## Test notes
server/test/membership.service.test.ts — full role chain, permission violation rejection

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 10.2 - Citizenship and Roles.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-10.2-citizenship-and-roles.md && cat server/src/modules/settlements/settlements.service.ts

STEP 2 - Implement:
  Create infra/migrations/017_create_memberships.sql
  Create server/src/modules/settlements/membership/: membership.service.ts, membership.controller.ts
  POST /api/settlements/:id/membership/apply, PATCH /api/settlements/:id/membership/:id/approve, GET /api/settlements/:id/roster
  Enforce role-based permission matrix in service layer

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/10.2-citizenship
  git add server/src/modules/settlements/membership/ infra/migrations/017_create_memberships.sql server/test/
  git commit -m "feat(10.2): citizenship, roles, and settlement membership system"
  gh pr create --draft --title "feat(10.2): citizenship and roles" --body "Implements story 10.2. Membership statuses, 5 roles, permission chain, roster. All criteria met."
```
""")

w("story-10.3-law-and-enforcement.md", """
# Story 10.3 — Law and Enforcement
**Epic:** 10 | **Role:** Backend Agent | **Status:** Blocked on 10.2

## Problem / intent
Grief-resistant law mechanics make permadeath viable by constraining unchecked hostility.

## Acceptance criteria
- [ ] Settlements can define law rules: permitted_pvp (bool), tax_rate (0–30%), restricted_items list
- [ ] Crime flags: theft, assault, murder — stored per character per settlement
- [ ] Wanted status set when crime_count exceeds threshold; cleared by serving sentence or paying fine
- [ ] Safe zones: infant/child characters cannot be attacked regardless of law
- [ ] Bounty hook: any citizen can post a bounty on a wanted character (links to contracts)
- [ ] GET /api/settlements/:id/laws, POST /api/settlements/:id/laws, GET /api/characters/:id/crime-record
- [ ] Unit tests: crime flag, wanted status, safe zone protection, bounty creation

## Dependencies
- 10.2 ✅

## Scope
Only touch: server/src/modules/settlements/law/, infra/migrations/, server/test/

## Implementation notes
- settlement_laws table: settlement_id, rule_key, rule_value_json
- character_crime_records table: character_id, settlement_id, crime_type, count, wanted, cleared_at
- Age protection check uses lifecycle.service.ts

## Test notes
server/test/law.service.test.ts — crime threshold → wanted, safe zone block, bounty post

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 10.3 - Law and Enforcement.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-10.3-law-and-enforcement.md && cat server/src/modules/settlements/settlements.service.ts && cat server/src/modules/characters/lifecycle/lifecycle.service.ts

STEP 2 - Implement:
  Create infra/migrations/018_create_laws.sql: settlement_laws + character_crime_records
  Create server/src/modules/settlements/law/: law.service.ts, law.controller.ts
  GET /api/settlements/:id/laws, POST /api/settlements/:id/laws
  GET /api/characters/:id/crime-record
  Enforce age protection (infant/child safe zone) by checking lifecycle stage
  Wanted threshold logic: flag character as wanted when crime_count >= 3

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/10.3-law-enforcement
  git add server/src/modules/settlements/law/ infra/migrations/018_create_laws.sql server/test/
  git commit -m "feat(10.3): law, crime flags, wanted status, and safe zones"
  gh pr create --draft --title "feat(10.3): law and enforcement" --body "Implements story 10.3. Settlement laws, crime records, wanted status, age-protected safe zones. All criteria met."
```
""")

# ── EPIC 11 ─────────────────────────────────────────────────────────────────

w("story-11.1-world-graph.md", """
# Story 11.1 — Universe / Planet / Plane Graph
**Epic:** 11 | **Role:** Backend Agent | **Status:** Blocked on 1.1 + 3.2

## Problem / intent
The world needs distinct places and travel routes so exploration and logistics matter.

## Acceptance criteria
- [ ] World node types: universe, planet, plane, region, settlement_zone
- [ ] Nodes have: id, name, type, parent_id, environmental_tags_json, travel_cost, unlock_status
- [ ] Edges have: from_node, to_node, travel_time_minutes, cost, hazard_level
- [ ] GET /api/world/nodes and GET /api/world/nodes/:id/connections
- [ ] Starter world seeded from tools/content/world-seed.json
- [ ] Schema supports future expansion without rewrite
- [ ] Unit tests: graph traversal, node lookup, connection filtering

## Dependencies
- 1.1 ✅  |  3.2 ✅

## Scope
Only touch: server/src/modules/world/, tools/content/world-seed.json, infra/migrations/, server/test/
Do NOT touch: simulation core/, economy/, characters/

## Implementation notes
- world_nodes table: id, name, type, parent_id, env_tags JSONB, travel_cost, unlock_status
- world_edges table: from_node_id, to_node_id, travel_time_minutes, currency_cost, hazard_level
- Seed from world-seed.json via migration or seeder script

## Test notes
server/test/world.service.test.ts — node lookup, edge traversal, expansion without breaking existing nodes

## Observability notes
Log world node unlock with node_id and trigger type

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 11.1 - Universe/Planet/Plane Graph.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-11.1-world-graph.md && cat server/src/app.module.ts

STEP 2 - Implement:
  Create tools/content/world-seed.json: 1 universe, 3 planets, 2 planes, 8 regions, travel edges
  Create infra/migrations/019_create_world.sql: world_nodes + world_edges
  Create server/src/modules/world/: world.module.ts, world.service.ts, world.controller.ts
  GET /api/world/nodes, GET /api/world/nodes/:id/connections
  Register WorldModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/11.1-world-graph
  git add server/src/modules/world/ tools/content/world-seed.json infra/migrations/019_create_world.sql server/test/ server/src/app.module.ts
  git commit -m "feat(11.1): world graph — universe/planet/plane/region nodes and travel edges"
  gh pr create --draft --title "feat(11.1): world graph" --body "Implements story 11.1. World node hierarchy, travel edges, seed data. All criteria met."
```
""")

w("story-11.2-unlock-engine.md", """
# Story 11.2 — Unlock Engine
**Epic:** 11 | **Role:** Backend Agent | **Status:** Blocked on 11.1 + 10.1 + 6.2

## Problem / intent
New areas and capabilities should unlock when players collectively reach milestones, making world expansion collaborative.

## Acceptance criteria
- [ ] Milestone types: research_completion, infrastructure_build, population_threshold, political_charter
- [ ] Each milestone has: target_node_id, required_conditions_json, current_progress, status
- [ ] Progress updates on relevant domain events (SettlementUnlocked, SkillUnlocked, etc.)
- [ ] Milestone completion unlocks a world node (sets unlock_status = 'open')
- [ ] Public progress broadcast via WebSocket world:unlock_progress event
- [ ] Admin override: PATCH /api/admin/world/milestones/:id/unlock (emergency bypass)
- [ ] Unit tests: progress update, threshold trigger, broadcast, admin override

## Dependencies
- 11.1 ✅  |  10.1 ✅  |  6.2 ✅

## Scope
Only touch: server/src/modules/world/unlock/, server/test/
Do NOT touch: client/, economy/, characters/

## Implementation notes
- world_milestones table: id, target_node_id, type, required_json, progress_json, status
- Event listeners on domain events to update progress
- On completion: update world_nodes.unlock_status, emit broadcast via realtime gateway

## Test notes
server/test/unlock.service.test.ts — progress accumulation, threshold completion, node unlock

## Observability notes
Emit SettlementUnlocked (reuse) or WorldNodeUnlocked domain event

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 11.2 - Unlock Engine.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-11.2-unlock-engine.md && cat server/src/modules/world/world.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create infra/migrations/020_create_world_milestones.sql
  Create server/src/modules/world/unlock/: unlock.service.ts (updateProgress, checkThreshold, broadcastProgress), unlock.controller.ts (admin override)
  Subscribe to domain events to auto-update milestone progress
  On threshold met: set world_nodes.unlock_status = 'open', broadcast via realtime gateway

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/11.2-unlock-engine
  git add server/src/modules/world/unlock/ infra/migrations/020_create_world_milestones.sql server/test/
  git commit -m "feat(11.2): world unlock engine with milestone tracking and broadcast"
  gh pr create --draft --title "feat(11.2): unlock engine" --body "Implements story 11.2. Milestone types, progress tracking, threshold unlock, public broadcast. All criteria met."
```
""")

w("story-11.3-travel-actions.md", """
# Story 11.3 — Travel Actions and Risks
**Epic:** 11 | **Role:** Backend Agent | **Status:** Blocked on 11.1 + 4.2

## Problem / intent
Travel should matter economically and narratively — with time cost, cargo risk, and route choices.

## Acceptance criteria
- [ ] POST /api/travel/start: select route (from/to node), carry cargo (item_instance_ids), estimated time
- [ ] Travel resolves over real time via tick; character unavailable for other actions during travel
- [ ] Hazard roll per segment: hazard_level → chance of encounter (cargo loss, delay, injury)
- [ ] Cargo weight affects travel time (heavier = slower)
- [ ] Travel summary posted to character's notification feed on arrival
- [ ] Unit tests: route validation, hazard roll, cargo weight penalty, arrival notification

## Dependencies
- 11.1 ✅  |  4.2 ✅

## Scope
Only touch: server/src/modules/travel/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, characters/

## Implementation notes
- travel_journeys table: id, character_id, from_node_id, to_node_id, cargo_json, status, started_at, arrives_at, hazard_log_json
- Wire arrival resolution into tick.service.ts

## Test notes
server/test/travel.service.test.ts — full journey, hazard encounter, cargo loss, arrival notification

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 11.3 - Travel Actions and Risks.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-11.3-travel-actions.md && cat server/src/modules/world/world.service.ts && cat server/src/modules/simulation/tick.service.ts

STEP 2 - Implement:
  Create infra/migrations/021_create_travel_journeys.sql
  Create server/src/modules/travel/: travel.module.ts, travel.service.ts (startJourney, resolveArrival, rollHazard, computeCargoWeight), travel.controller.ts
  POST /api/travel/start, GET /api/travel/journeys (active)
  Wire resolveArrival() into tick.service.ts; block other actions during travel
  Post arrival notification via notifications service

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/11.3-travel
  git add server/src/modules/travel/ infra/migrations/021_create_travel_journeys.sql server/test/
  git commit -m "feat(11.3): travel actions with hazard rolls, cargo weight, and arrival notifications"
  gh pr create --draft --title "feat(11.3): travel actions and risks" --body "Implements story 11.3. Route selection, timed travel, hazard rolls, cargo, arrival notification. All criteria met."
```
""")

# ── EPIC 12 ─────────────────────────────────────────────────────────────────

w("story-12.1-admin-panel-skeleton.md", """
# Story 12.1 — Admin Panel Skeleton
**Epic:** 12 | **Role:** Backend Agent + Frontend Agent | **Status:** Blocked on 2.1 + 1.3

## Problem / intent
The host needs a browser management panel to run the game from a single application.

## Acceptance criteria
- [ ] /admin route in Next.js client is protected (redirects to /login if no admin JWT)
- [ ] Admin dashboard shows: server uptime, connected_clients, active_characters, last_tick_at
- [ ] Admin role gated by account.role = 'admin' (new column on accounts table)
- [ ] Service status page: DB connection, Redis connection, tick health
- [ ] Maintenance mode toggle: POST /api/admin/maintenance (broadcasts to all WS clients)
- [ ] Audit log page: last 100 admin actions
- [ ] Unit tests: admin JWT guard, maintenance broadcast, audit log write

## Dependencies
- 2.1 ✅  |  1.3 ✅

## Scope
Only touch: server/src/modules/admin/, client/src/app/admin/, infra/migrations/, server/test/
Do NOT touch: simulation core/, economy/, characters/

## Implementation notes
- Add role column to accounts: ALTER TABLE accounts ADD COLUMN role VARCHAR DEFAULT 'player'
- AdminJwtGuard: extends JwtAuthGuard, checks account.role = 'admin'
- Audit log table: admin_audit_log (id, admin_id, action, target, created_at)
- Maintenance mode: Redis key 'maintenance_mode' + WS broadcast

## Test notes
server/test/admin.guard.test.ts — player role rejected, admin role accepted

## Observability notes
All admin actions write to admin_audit_log

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend and Frontend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 12.1 - Admin Panel Skeleton.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-12.1-admin-panel-skeleton.md && cat server/src/modules/auth/jwt-auth.guard.ts && cat server/src/modules/observability/observability.service.ts

STEP 2 - Implement:
  Create infra/migrations/022_add_admin_role.sql: add role column to accounts; create admin_audit_log
  Create server/src/modules/admin/: admin.module.ts, admin.guard.ts (role check), admin.service.ts (getStatus, toggleMaintenance, getAuditLog), admin.controller.ts
  Create client/src/app/admin/: layout.tsx (admin auth check), page.tsx (dashboard), status/page.tsx, audit/page.tsx
  POST /api/admin/maintenance, GET /api/admin/status, GET /api/admin/audit-log

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/12.1-admin-panel
  git add server/src/modules/admin/ client/src/app/admin/ infra/migrations/022_add_admin_role.sql server/test/
  git commit -m "feat(12.1): admin panel skeleton with RBAC, status, maintenance mode, audit log"
  gh pr create --draft --title "feat(12.1): admin panel skeleton" --body "Implements story 12.1. Admin JWT guard, dashboard, status, maintenance toggle, audit log. All criteria met."
```
""")

w("story-12.2-moderation-tooling.md", """
# Story 12.2 — Moderation Tooling
**Epic:** 12 | **Role:** Backend Agent | **Status:** Blocked on 12.1

## Problem / intent
Moderators need report queues and sanction tools so community harm can be managed efficiently.

## Acceptance criteria
- [ ] POST /api/moderation/reports: player submits report (target_id, reason, evidence_text)
- [ ] GET /api/admin/moderation/reports: paginated queue for moderators
- [ ] PATCH /api/admin/moderation/reports/:id: resolve report with action (warn|mute|ban|note)
- [ ] Warn: adds warning to account; Mute: sets muted_until; Ban: sets banned = true
- [ ] All moderation actions written to admin_audit_log
- [ ] Unit tests: report creation, each sanction type, audit log write

## Dependencies
- 12.1 ✅

## Scope
Only touch: server/src/modules/moderation/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, characters/

## Implementation notes
- player_reports table: id, reporter_id, target_id, reason, evidence_text, status, resolved_by, created_at
- Add muted_until, warning_count columns to accounts (migration)
- Mute broadcasts disconnection to target's WS session

## Test notes
server/test/moderation.service.test.ts — report lifecycle, all sanction types

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 12.2 - Moderation Tooling.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-12.2-moderation-tooling.md && cat server/src/modules/admin/admin.service.ts

STEP 2 - Implement:
  Create infra/migrations/023_create_moderation.sql: player_reports; add muted_until, warning_count to accounts
  Create server/src/modules/moderation/: moderation.module.ts, moderation.service.ts, moderation.controller.ts
  POST /api/moderation/reports, GET /api/admin/moderation/reports, PATCH /api/admin/moderation/reports/:id
  Implement warn/mute/ban sanctions; write all actions to admin_audit_log

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/12.2-moderation
  git add server/src/modules/moderation/ infra/migrations/023_create_moderation.sql server/test/
  git commit -m "feat(12.2): moderation tooling with report queue and sanctions"
  gh pr create --draft --title "feat(12.2): moderation tooling" --body "Implements story 12.2. Report intake, moderation queue, warn/mute/ban, audit trail. All criteria met."
```
""")

w("story-12.3-backups-and-deployment.md", """
# Story 12.3 — Backups, Restore and Deployment Controls
**Epic:** 12 | **Role:** Live Ops Agent | **Status:** Blocked on 12.1

## Problem / intent
The host needs operational safeguards to recover from mistakes or failures with confidence.

## Acceptance criteria
- [ ] Backup script: pg_dump to infra/backups/ with timestamp filename, runs daily
- [ ] Retention: keep last 7 daily and last 4 weekly backups; delete older
- [ ] GET /api/admin/ops/backups: list available backups with size and timestamp
- [ ] Restore dry-run: POST /api/admin/ops/restore/dry-run validates backup file integrity
- [ ] GET /api/admin/ops/version: returns current git commit hash and deploy timestamp
- [ ] Migration check: server startup validates all migrations applied before accepting requests
- [ ] Runbook: docs/RUNBOOKS/BACKUP_RESTORE.md documents full restore procedure
- [ ] Unit tests: retention policy deletion, backup listing

## Dependencies
- 12.1 ✅

## Scope
Only touch: server/src/modules/ops/, tools/scripts/backup.sh, docs/RUNBOOKS/, infra/backups/.gitkeep, server/test/
Do NOT touch: client/, economy/, characters/

## Implementation notes
- backup.sh: pg_dump with PGPASSWORD from env, output to infra/backups/backup_{timestamp}.sql.gz
- Retention: find infra/backups/ -mtime +7 and keep weekly snapshots separately
- Migration check: at app startup, query pg_migrations table vs expected count

## Test notes
server/test/ops.service.test.ts — retention logic, listing, dry-run validation

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Live Ops Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 12.3 - Backups, Restore and Deployment Controls.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-12.3-backups-and-deployment.md && cat server/src/main.ts

STEP 2 - Implement:
  Create tools/scripts/backup.sh: pg_dump with timestamp, gzip, retention policy
  Create infra/backups/.gitkeep
  Create server/src/modules/ops/: ops.module.ts, ops.service.ts (listBackups, dryRunRestore, getVersion, checkMigrations), ops.controller.ts
  GET /api/admin/ops/backups, POST /api/admin/ops/restore/dry-run, GET /api/admin/ops/version
  Add migration check to main.ts startup sequence
  Create docs/RUNBOOKS/BACKUP_RESTORE.md with step-by-step restore procedure

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/12.3-backups-ops
  git add server/src/modules/ops/ tools/scripts/backup.sh infra/backups/.gitkeep docs/RUNBOOKS/BACKUP_RESTORE.md server/test/
  git commit -m "feat(12.3): backup scripts, restore dry-run, deployment controls, runbook"
  gh pr create --draft --title "feat(12.3): backups and deployment controls" --body "Implements story 12.3. Daily pg_dump, retention, dry-run restore, version endpoint, migration check, runbook. All criteria met."
```
""")

# ── EPIC 13 ─────────────────────────────────────────────────────────────────

w("story-13.1-test-strategy.md", """
# Story 13.1 — Test Strategy Implementation
**Epic:** 13 | **Role:** QA / Security Agent | **Status:** Blocked on foundational epics (1-5)

## Problem / intent
The simulation must remain stable as it grows. Layered automated tests catch regressions before they reach players.

## Acceptance criteria
- [ ] Unit test coverage >= 80% for all server/src/modules/ (vitest)
- [ ] Integration tests for: auth flow, action submission, market trade, character death
- [ ] Contract tests: WebSocket message envelopes match defined types in contracts/
- [ ] Scenario test: character born → adult → dies → new character created (full lifecycle)
- [ ] All tests pass in CI on every PR
- [ ] Test runner outputs coverage report
- [ ] Unit tests: each test category represented

## Dependencies
- Foundational epics 1–5 ✅ (stories must exist before testing them)

## Scope
Only touch: server/test/, client/src/**/*.test.ts, vitest.config.ts files
Do NOT touch: server/src/ implementation files (add tests only)

## Implementation notes
- Use vitest for all tests (already installed)
- Integration tests can use in-memory mocks for DB (no real DB required in CI)
- Contract tests: import types from server/src/contracts/ and assert message shapes

## Test notes
This story IS the test strategy — output is a comprehensive test suite

## Observability notes
CI reports test pass/fail and coverage percentage as PR check

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the QA/Security Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 13.1 - Test Strategy Implementation.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-13.1-test-strategy.md && cat server/package.json && cat client/package.json

STEP 2 - Implement:
  Audit existing tests in server/test/ and client/src/ for coverage gaps
  Add missing unit tests for every module that is under 80% coverage
  Add integration test: server/test/integration/auth.flow.test.ts (register→login→use protected route)
  Add integration test: server/test/integration/character.lifecycle.test.ts (born→adult→death→rebirth)
  Add contract test: server/test/contracts/ws-envelope.contract.test.ts (validate all WS message shapes)
  Update vitest configs to output coverage reports

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run test
  Fix failing tests. Ensure coverage >= 80%.

STEP 4 - Open PR:
  git checkout -b story/13.1-test-strategy
  git add server/test/ client/src/**/*.test.ts
  git commit -m "feat(13.1): comprehensive test strategy — unit, integration, contract, scenario tests"
  gh pr create --draft --title "feat(13.1): test strategy implementation" --body "Implements story 13.1. 80%+ coverage, integration tests, contract tests, lifecycle scenario. All criteria met."
```
""")

w("story-13.2-balance-simulation-harness.md", """
# Story 13.2 — Balance Simulation Harness
**Epic:** 13 | **Role:** QA / Security Agent | **Status:** Blocked on 6.1 + 9.3 + 11.2

## Problem / intent
Designers need synthetic simulations to inspect growth and economic stability before live release.

## Acceptance criteria
- [ ] CLI script: tools/scripts/simulate-balance.mjs runs N characters through M in-game days
- [ ] Outputs: profession earnings comparison, XP curve progression at key levels, need drain rates
- [ ] Checks: no single profession earns > 3x the median across all professions in 30 days
- [ ] Growth curve: level 100 reachable in ~6 in-game months with active play (not offline)
- [ ] Report saved to infra/exports/balance-report-{timestamp}.json
- [ ] Script is runnable: node tools/scripts/simulate-balance.mjs --days=30 --characters=50

## Dependencies
- 6.1 ✅  |  9.3 ✅  |  11.2 ✅

## Scope
Only touch: tools/scripts/simulate-balance.mjs, infra/exports/.gitkeep
Do NOT touch: server/src/, client/

## Implementation notes
- Pure simulation: import XP curves and formula constants from server/src/modules/progression/curves.ts
- Use TypeScript-compatible JS (ESM) — no real DB needed
- Output structured JSON matching the format used by economy dashboards

## Test notes
Manual run — verified by reviewing output report for balance checks

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the QA/Security Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 13.2 - Balance Simulation Harness.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-13.2-balance-simulation-harness.md && cat server/src/modules/progression/curves.ts

STEP 2 - Implement:
  Create infra/exports/.gitkeep
  Create tools/scripts/simulate-balance.mjs:
    - Parse --days and --characters CLI args
    - Simulate N characters each earning XP via random profession actions for M days
    - Apply XP formula from curves.ts; track levels reached
    - Compare profession earnings; flag if any profession > 3x median
    - Write report JSON to infra/exports/balance-report-{Date.now()}.json
    - Print summary to stdout

STEP 3 - Validate (no npm run validate needed — run the script):
  node tools/scripts/simulate-balance.mjs --days=30 --characters=10
  Confirm report file created and summary printed without errors.

STEP 4 - Open PR:
  git checkout -b story/13.2-balance-harness
  git add tools/scripts/simulate-balance.mjs infra/exports/.gitkeep
  git commit -m "feat(13.2): balance simulation harness for XP curves and profession earnings"
  gh pr create --draft --title "feat(13.2): balance simulation harness" --body "Implements story 13.2. CLI simulation script, profession balance check, JSON report output. All criteria met."
```
""")

w("story-13.3-security-exploit-review.md", """
# Story 13.3 — Security and Exploit Review
**Epic:** 13 | **Role:** QA / Security Agent | **Status:** Blocked on 12.1 + 13.1

## Problem / intent
Abuse should be harder and more visible before the game goes live. A security gate on every release is mandatory.

## Acceptance criteria
- [ ] Rate limiting applied to all auth endpoints: 10 req/min per IP on /api/auth/*
- [ ] Rate limiting on market: 60 listings/hour per character
- [ ] Bot detection stub: requests with > 5 identical actions in 1s flagged and logged
- [ ] CSRF protection on all admin routes
- [ ] XSS sanitisation on all player-submitted text fields
- [ ] Security checklist doc: docs/RUNBOOKS/SECURITY_CHECKLIST.md (filled in for current state)
- [ ] Exploit test pack: server/test/security/exploit.test.ts covering top 5 abuse vectors
- [ ] Unit tests: rate limit trigger, bot flag, XSS sanitisation

## Dependencies
- 12.1 ✅  |  13.1 ✅

## Scope
Only touch: server/src/modules/security/, server/src/main.ts, docs/RUNBOOKS/, server/test/security/
Do NOT touch: client/, economy/, characters/

## Implementation notes
- Use @nestjs/throttler for rate limiting
- Bot detection: Redis sorted set per character, count actions in rolling 1s window
- XSS: strip HTML tags from all string inputs via class-transformer interceptor
- CSRF: SameSite=Strict cookie attribute on session cookies

## Test notes
server/test/security/exploit.test.ts — rate limit hit, bot flag, XSS strip, CSRF reject

## Review owner
Product Owner (Joshua) — security review required before any public launch

---
## Cloud agent execution prompt
```
You are the QA/Security Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 13.3 - Security and Exploit Review.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-13.3-security-exploit-review.md && cat server/src/main.ts && cat server/src/modules/auth/jwt-auth.guard.ts

STEP 2 - Implement:
  npm install @nestjs/throttler --workspace=server
  Create server/src/modules/security/: security.module.ts, bot-detection.service.ts, xss-sanitize.interceptor.ts
  Apply ThrottlerModule to app.module.ts; configure 10 req/min for /api/auth/* and 60/hr for /api/market/*
  Wire bot-detection.service.ts into action.service.ts (Redis sorted set rolling window check)
  Apply XSS sanitise interceptor globally in main.ts
  Add SameSite=Strict to session cookie config
  Create docs/RUNBOOKS/SECURITY_CHECKLIST.md: filled-in checklist for current attack surface
  Create server/test/security/exploit.test.ts: rate limit, bot flag, XSS sanitise, CSRF

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/13.3-security-review
  git add server/src/modules/security/ server/src/main.ts docs/RUNBOOKS/SECURITY_CHECKLIST.md server/test/security/
  git commit -m "feat(13.3): rate limiting, bot detection, XSS sanitisation, security checklist"
  gh pr create --draft --title "feat(13.3): security and exploit review" --body "Implements story 13.3. Rate limiting, bot detection, XSS, CSRF, exploit test pack, security checklist. All criteria met."
```
""")

print(f"\nAll {len(stories)} story files created in {BASE}")
