"""Generate extended story files for systems not covered by the original backlog:
   Lineage, Messaging, Currency, Combat, Research, Invention,
   Guilds/Titles/Mentorship, Nations, Production Infra, Management Panel,
   Integrity Checks, Load Testing.
"""
import pathlib

BASE = pathlib.Path(__file__).parent.parent.parent / "docs" / "stories"
BASE.mkdir(parents=True, exist_ok=True)


def w(name: str, content: str):
    p = BASE / name
    p.write_text(content.lstrip("\n"), encoding="utf-8")
    print(f"  created {name}")


# ── EPIC 14 — LINEAGE, LEGACY AND PERMADEATH CONTINUITY ─────────────────────

w("story-14.1-lineage-memorial-records.md", """
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
""")

w("story-14.2-inheritance-and-succession.md", """
# Story 14.2 — Inheritance and Property Succession
**Epic:** 14 | **Role:** Backend Agent | **Status:** Blocked on 14.1 + 9.2

## Problem / intent
When a character dies, their property, wealth, and institutional roles must transfer according to designated succession rules so lineage continuity has mechanical weight.

## Acceptance criteria
- [ ] Characters can designate heirs: POST /api/characters/:id/succession
- [ ] On CharacterDied: execute succession — transfer item_instances, currency balance, and contracts to heir
- [ ] If no heir designated: items go to character's settlement treasury; currency sinks 30%
- [ ] Institutional roles (offices, guild leadership) transferred or put to election
- [ ] Succession execution atomic — all transfers in one DB transaction
- [ ] GET /api/characters/:id/succession — view current succession plan
- [ ] Unit tests: heir succession, no-heir sink, institutional role transfer, atomicity

## Dependencies
- 14.1 ✅  |  9.2 ✅

## Scope
Only touch: server/src/modules/lineage/succession/, infra/migrations/, server/test/
Do NOT touch: client/, simulation core/, realtime/

## Implementation notes
- character_succession table: character_id, heir_character_id, updated_at
- Succession handler listens to CharacterDied event
- Use DB transaction to move all assets atomically
- Emit InheritanceExecuted domain event

## Test notes
server/test/succession.service.test.ts — designated heir, no-heir treasury sink, atomicity

## Observability notes
Emit InheritanceExecuted with character_id, heir_id, value_transferred

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 14.2 - Inheritance and Property Succession.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-14.2-inheritance-and-succession.md && cat server/src/modules/lineage/lineage.service.ts && cat server/src/modules/items/items.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create infra/migrations/025_create_succession.sql: character_succession table
  Create server/src/modules/lineage/succession/: succession.service.ts (designateHeir, executeSuccession, sinkNoHeirAssets), succession.controller.ts
  Listen to CharacterDied event: atomically transfer items/currency/roles to heir or sink
  POST /api/characters/:id/succession — designate heir
  GET /api/characters/:id/succession — view plan
  Emit InheritanceExecuted domain event

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/14.2-inheritance
  git add server/src/modules/lineage/succession/ infra/migrations/025_create_succession.sql server/test/
  git commit -m "feat(14.2): inheritance and property succession on permadeath"
  gh pr create --draft --title "feat(14.2): inheritance and property succession" --body "Implements story 14.2. Heir designation, atomic asset transfer, no-heir treasury sink. All criteria met."
```
""")

# ── EPIC 15 — MESSAGING, PRESENCE AND SOCIAL FEED ───────────────────────────

w("story-15.1-inbox-and-notifications.md", """
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
""")

w("story-15.2-player-presence-and-social-status.md", """
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
""")

# ── EPIC 16 — COMBAT SYSTEM ──────────────────────────────────────────────────

w("story-16.1-combat-resolution-engine.md", """
# Story 16.1 — Combat Resolution Engine
**Epic:** 16 | **Role:** Backend Agent | **Status:** Blocked on 5.3 + 7.1 + 10.3

## Problem / intent
Combat must be lethal, reputationally expensive, and politically meaningful — one route to power among many, constrained by law and consequences.

## Acceptance criteria
- [ ] POST /api/combat/initiate: aggressor selects target, server validates legality (law, safe zones, age protection)
- [ ] Combat resolves server-side over 1–3 exchange windows using Physical stats (STR/AGI/END)
- [ ] Combat instinct hidden trait biases clutch outcomes
- [ ] Death triggers CharacterDied domain event with cause=combat
- [ ] Crime flag logged for aggressor in target's settlement (assault or murder)
- [ ] Reputation cost: aggressor's Social stats penalised after unprovoked kills
- [ ] Winner may loot a % of loser's carried items (not inventory — only equipped/carried)
- [ ] Unit tests: legal check, exchange resolution, death trigger, crime flag, loot rules

## Dependencies
- 5.3 ✅  |  7.1 ✅  |  10.3 ✅

## Scope
Only touch: server/src/modules/combat/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, crafting/

## Implementation notes
- combat_logs table: id, aggressor_id, defender_id, outcome, exchanges_json, loot_json, created_at
- Exchange resolution: compare STR + random(0,AGI) vs defender's AGI + random(0,END); apply damage
- Legality check: call law.service.ts to verify permitted_pvp and check age protection
- Emit CombatResolved domain event

## Test notes
server/test/combat.service.test.ts — legal check fail, exchange resolution, death path, crime flag

## Observability notes
Emit CombatResolved with outcome, aggressor_id, defender_id

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 16.1 - Combat Resolution Engine.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-16.1-combat-resolution-engine.md && cat server/src/modules/characters/stats/stat.types.ts && cat server/src/modules/settlements/law/law.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create infra/migrations/028_create_combat_logs.sql
  Create server/src/modules/combat/: combat.module.ts, combat.service.ts (initiateCombat, checkLegality, resolveExchanges, applyDeath, logCrime), combat.controller.ts
  POST /api/combat/initiate: validate legality, resolve 1-3 exchanges, apply outcome
  On death: emit CharacterDied with cause=combat; on aggressor: log crime, penalise Social stats
  Winner loots % of carried items (not full inventory)
  Emit CombatResolved domain event

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/16.1-combat-engine
  git add server/src/modules/combat/ infra/migrations/028_create_combat_logs.sql server/test/
  git commit -m "feat(16.1): combat resolution engine with legality checks and reputation consequences"
  gh pr create --draft --title "feat(16.1): combat resolution engine" --body "Implements story 16.1. Legal check, stat-based exchange resolution, death trigger, crime flag, loot rules. All criteria met."
```
""")

w("story-16.2-combat-reputation-and-bounties.md", """
# Story 16.2 — Combat Reputation and Bounty System
**Epic:** 16 | **Role:** Backend Agent | **Status:** Blocked on 16.1 + 10.3

## Problem / intent
Combat must carry lasting social consequences. Killers accumulate notoriety; victims' allies can post bounties, creating player-driven justice.

## Acceptance criteria
- [ ] Kill count tracked per character per settlement context (pvp_kills, pvp_deaths)
- [ ] Notoriety score: increases with unprovoked kills, decays over 30 in-game days
- [ ] High notoriety (> 50): character flagged as outlaw, visible to settlement guards
- [ ] Bounty board: POST /api/bounties/:target_id (any citizen, escrow in contracts), GET /api/bounties/active
- [ ] Bounty collected when wanted character is killed by bounty hunter and confirmed by server
- [ ] Unit tests: notoriety accumulation, decay, outlaw flag, bounty creation, collection

## Dependencies
- 16.1 ✅  |  10.3 ✅

## Scope
Only touch: server/src/modules/combat/reputation/, server/src/modules/bounties/, infra/migrations/, server/test/

## Implementation notes
- character_notoriety table: character_id, settlement_id, pvp_kills, pvp_deaths, notoriety_score, last_kill_at
- bounties table: id, poster_id, target_id, reward_amount, status, expires_at
- Notoriety decay: subtract 1 point per 30 in-game days without a kill

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 16.2 - Combat Reputation and Bounty System.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-16.2-combat-reputation-and-bounties.md && cat server/src/modules/combat/combat.service.ts && cat server/src/modules/economy/contracts/contracts.service.ts

STEP 2 - Implement:
  Create infra/migrations/029_create_notoriety_bounties.sql: character_notoriety + bounties tables
  Create server/src/modules/combat/reputation/: reputation.service.ts (updateNotoriety, decayNotoriety, flagOutlaw)
  Create server/src/modules/bounties/: bounties.module.ts, bounties.service.ts, bounties.controller.ts
  Wire updateNotoriety() into CombatResolved event handler
  Wire decayNotoriety() into daily tick
  POST /api/bounties/:target_id, GET /api/bounties/active, PATCH /api/bounties/:id/collect

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/16.2-combat-reputation
  git add server/src/modules/combat/reputation/ server/src/modules/bounties/ infra/migrations/029_create_notoriety_bounties.sql server/test/
  git commit -m "feat(16.2): combat notoriety, outlaw flagging, and bounty board"
  gh pr create --draft --title "feat(16.2): combat reputation and bounties" --body "Implements story 16.2. Notoriety accumulation/decay, outlaw flagging, bounty board with escrow. All criteria met."
```
""")

# ── EPIC 17 — RESEARCH AND INVENTION ─────────────────────────────────────────

w("story-17.1-research-queues-and-discovery.md", """
# Story 17.1 — Research Queues and Discovery
**Epic:** 17 | **Role:** Backend Agent | **Status:** Blocked on 5.3 + 6.1 + 8.1

## Problem / intent
Research uncovers formulas, world secrets, technologies, and unlock conditions. It is a macro-system driver and must reward Intelligence and Focus stats meaningfully.

## Acceptance criteria
- [ ] Research topics defined in tools/content/research.json: id, name, domain, required_skills, base_duration_days, outputs_json
- [ ] POST /api/research/start: assign character to research topic (one active per character)
- [ ] Research progress advances each in-game day via tick; hidden Research Spark trait modifies breakthrough chance
- [ ] Completion outputs: formula_unlocked, tech_discovered, skill_hint, world_secret_fragment
- [ ] Research breakthroughs emitted as PotentialBreakpointReached domain event
- [ ] GET /api/characters/:id/research — active and completed research
- [ ] Unit tests: research tick progress, breakthrough roll, completion outputs, spark trait modifier

## Dependencies
- 5.3 ✅  |  6.1 ✅  |  8.1 ✅

## Scope
Only touch: server/src/modules/research/, tools/content/research.json, infra/migrations/, server/test/
Do NOT touch: client/, economy/, combat/

## Implementation notes
- research_projects table: id, character_id, topic_id, progress_pct, status, started_at, completed_at, output_json
- Breakthrough chance: base_chance * (1 + research_spark_weight * 0.01)
- Completion output stored as JSONB; consumed by unlock engine or skill system

## Test notes
server/test/research.service.test.ts — tick progress, breakthrough, output generation

## Observability notes
Emit PotentialBreakpointReached with character_id, topic_id, output_type

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 17.1 - Research Queues and Discovery.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-17.1-research-queues-and-discovery.md && cat server/src/modules/simulation/tick.service.ts && cat server/src/modules/characters/traits/trait.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create tools/content/research.json: 10 research topics across Combat, Crafting, Science, Magic, Governance domains
  Create infra/migrations/030_create_research_projects.sql
  Create server/src/modules/research/: research.module.ts, research.service.ts (startResearch, tickResearch, rollBreakthrough, completeResearch), research.controller.ts
  Wire tickResearch() into tick.service.ts daily tick
  Apply Research Spark trait modifier on breakthrough roll
  POST /api/research/start, GET /api/characters/:id/research
  Emit PotentialBreakpointReached on breakthrough

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/17.1-research
  git add server/src/modules/research/ tools/content/research.json infra/migrations/030_create_research_projects.sql server/test/
  git commit -m "feat(17.1): research queues, discovery pipeline, and breakthrough rolls"
  gh pr create --draft --title "feat(17.1): research queues and discovery" --body "Implements story 17.1. 10 research topics, daily tick progress, breakthrough rolls, Research Spark trait modifier. All criteria met."
```
""")

w("story-17.2-invention-pipeline-and-prototypes.md", """
# Story 17.2 — Invention Pipeline and Prototypes
**Epic:** 17 | **Role:** Backend Agent | **Status:** Blocked on 17.1 + 8.2

## Problem / intent
Invention covers novel processes, prototypes, and engineering solutions. It sits between crafting and research and feeds world unlock systems with player-driven discoveries.

## Acceptance criteria
- [ ] POST /api/invention/attempt: spend resources and time to attempt a novel prototype
- [ ] Invention uses Mental stats (Creativity, Intelligence) and Research outputs as inputs
- [ ] Success produces a unique prototype item_instance with invention_record
- [ ] Prototype can be submitted to research system as a discovery_contribution
- [ ] Critical success: invention enters review queue for potential new recipe or world unlock
- [ ] Craft Intuition hidden trait modifies quality variance
- [ ] Unit tests: resource spend, Mental stat modifier, success/fail states, prototype creation

## Dependencies
- 17.1 ✅  |  8.2 ✅

## Scope
Only touch: server/src/modules/invention/, infra/migrations/, server/test/

## Implementation notes
- invention_records table: id, character_id, attempt_json, outcome, item_instance_id, submitted_for_review, created_at
- Success chance: base 30% + (Creativity - recipe_difficulty) * 2 + random(-10, +10)
- Critical success (chance 5%): flag for admin/content review

## Test notes
server/test/invention.service.test.ts — stat modifier, success rates, prototype output, critical flag

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 17.2 - Invention Pipeline and Prototypes.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-17.2-invention-pipeline-and-prototypes.md && cat server/src/modules/crafting/crafting.service.ts && cat server/src/modules/research/research.service.ts

STEP 2 - Implement:
  Create infra/migrations/031_create_invention_records.sql
  Create server/src/modules/invention/: invention.module.ts, invention.service.ts (attemptInvention, computeSuccessChance, createPrototype, flagCritical), invention.controller.ts
  POST /api/invention/attempt: validate resources, compute chance, resolve outcome
  Create prototype item_instance on success; log invention_record
  Flag critical success for admin review

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/17.2-invention
  git add server/src/modules/invention/ infra/migrations/031_create_invention_records.sql server/test/
  git commit -m "feat(17.2): invention pipeline with prototypes and critical success review"
  gh pr create --draft --title "feat(17.2): invention pipeline and prototypes" --body "Implements story 17.2. Stat-based success chance, prototype creation, critical success flagging. All criteria met."
```
""")

# ── EPIC 18 — GUILDS, TITLES AND MENTORSHIP ──────────────────────────────────

w("story-18.1-guilds-and-households.md", """
# Story 18.1 — Guilds and Households
**Epic:** 18 | **Role:** Backend Agent | **Status:** Blocked on 10.1

## Problem / intent
Guilds and households are cross-settlement social structures that let players organise around professions, families, and factions without being tied to a single location.

## Acceptance criteria
- [ ] Guild types: trade_guild, combat_order, research_institute, craft_collective, political_faction
- [ ] Guilds have: name, type, founder_id, charter_text, member_limit, treasury_balance
- [ ] POST /api/guilds: found guild; GET /api/guilds/:id; PATCH /api/guilds/:id/charter
- [ ] Guild membership: apply, accept, rank (member/officer/leader), expel
- [ ] Guild treasury: members can deposit/withdraw based on rank permissions
- [ ] Households: family-unit guilds with inheritance implications (link to lineage)
- [ ] Unit tests: found, join, rank promotion, treasury deposit/withdraw, household link

## Dependencies
- 10.1 ✅

## Scope
Only touch: server/src/modules/guilds/, infra/migrations/, server/test/

## Implementation notes
- guilds table: id, name, type, founder_id, charter_text, member_limit, treasury_balance, created_at
- guild_members table: guild_id, character_id, rank, joined_at
- Guild treasury is a dedicated currency balance separate from character balance

## Test notes
server/test/guilds.service.test.ts — found, membership lifecycle, treasury RBAC

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 18.1 - Guilds and Households.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-18.1-guilds-and-households.md && cat server/src/modules/settlements/settlements.service.ts && cat server/src/modules/lineage/lineage.service.ts

STEP 2 - Implement:
  Create infra/migrations/032_create_guilds.sql: guilds + guild_members tables
  Create server/src/modules/guilds/: guilds.module.ts, guilds.service.ts (foundGuild, joinGuild, promoteRank, depositTreasury, withdrawTreasury), guilds.controller.ts
  POST /api/guilds, GET /api/guilds/:id, PATCH /api/guilds/:id/charter
  POST /api/guilds/:id/membership/apply, PATCH /api/guilds/:id/membership/:id/promote
  Guild treasury deposit/withdraw with rank-based RBAC
  Register GuildsModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/18.1-guilds
  git add server/src/modules/guilds/ infra/migrations/032_create_guilds.sql server/test/ server/src/app.module.ts
  git commit -m "feat(18.1): guilds, households, guild treasury and membership ranks"
  gh pr create --draft --title "feat(18.1): guilds and households" --body "Implements story 18.1. 5 guild types, membership lifecycle, treasury with rank RBAC. All criteria met."
```
""")

w("story-18.2-titles-offices-and-mentorship.md", """
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
""")

# ── EPIC 19 — NATION SYSTEM ──────────────────────────────────────────────────

w("story-19.1-nation-system-and-charter.md", """
# Story 19.1 — Nation System and Charter
**Epic:** 19 | **Role:** Backend Agent | **Status:** Blocked on 10.2 + 11.1

## Problem / intent
Nations are player-founded macro-polities that group settlements under shared law, taxation, and identity. They give political players a world-scale theatre of influence.

## Acceptance criteria
- [ ] Nations founded by charter: requires 3+ settlements and 100+ total citizens
- [ ] Nation has: name, founding_charter_text, capital_settlement_id, leader_character_id, tax_rate
- [ ] Settlements can join/leave nations via vote of their governors
- [ ] National law overrides settlement law where more restrictive
- [ ] National treasury: tax_rate % of all settlement transactions flows up
- [ ] POST /api/nations/found, GET /api/nations/:id, PATCH /api/nations/:id/law
- [ ] GET /api/nations/:id/settlements — member settlements
- [ ] Unit tests: founding requirements, settlement join/leave, law precedence, treasury flow

## Dependencies
- 10.2 ✅  |  11.1 ✅

## Scope
Only touch: server/src/modules/nations/, infra/migrations/, server/test/

## Implementation notes
- nations table: id, name, charter_text, capital_settlement_id, leader_character_id, tax_rate, founded_at
- nation_members table: nation_id, settlement_id, joined_at
- Law precedence: check national law first, fall back to settlement law
- Wire national tax deduction into economy transaction flow

## Test notes
server/test/nations.service.test.ts — founding check, settlement join/leave vote, tax flow

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 19.1 - Nation System and Charter.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-19.1-nation-system-and-charter.md && cat server/src/modules/settlements/settlements.service.ts && cat server/src/modules/settlements/law/law.service.ts

STEP 2 - Implement:
  Create infra/migrations/034_create_nations.sql: nations + nation_members tables
  Create server/src/modules/nations/: nations.module.ts, nations.service.ts (foundNation, joinNation, leaveNation, getNationalLaw, collectTax), nations.controller.ts
  POST /api/nations/found (validate 3+ settlements, 100+ citizens), GET /api/nations/:id, PATCH /api/nations/:id/law
  GET /api/nations/:id/settlements
  Wire national law precedence check into law.service.ts
  Wire tax collection into economy transaction flow

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/19.1-nation-system
  git add server/src/modules/nations/ infra/migrations/034_create_nations.sql server/test/
  git commit -m "feat(19.1): nation system, charters, settlement membership, national law and taxation"
  gh pr create --draft --title "feat(19.1): nation system and charter" --body "Implements story 19.1. Nation founding, settlement membership, law precedence, national treasury. All criteria met."
```
""")

# ── EPIC 20 — CURRENCY SYSTEM ────────────────────────────────────────────────

w("story-20.1-currency-system.md", """
# Story 20.1 — Currency System
**Epic:** 20 | **Role:** Economy Agent | **Status:** Blocked on 2.1

## Problem / intent
The game needs a first-class currency system with character wallets, settlement treasuries, transaction logs, and anti-dupe controls before any market or contract can function correctly.

## Acceptance criteria
- [ ] currencies table: id, name, symbol, issuer_type (world/settlement/nation), is_primary
- [ ] character_wallets table: character_id, currency_id, balance — with non-negative constraint
- [ ] All balance changes atomic and idempotent (use idempotency_key)
- [ ] Transaction log: currency_transactions table with from_id, to_id, amount, reason, idempotency_key, created_at
- [ ] GET /api/characters/:id/wallet; POST /api/wallet/transfer (character to character)
- [ ] Starter currencies seeded: World Gold (primary), Settlement Credit (local)
- [ ] Anti-dupe: double-spend prevented by idempotency_key unique constraint
- [ ] Unit tests: transfer, insufficient balance rejection, idempotency replay, audit log

## Dependencies
- 2.1 ✅

## Scope
Only touch: server/src/modules/currency/, infra/migrations/, server/test/
Do NOT touch: client/, simulation core/, crafting/

## Implementation notes
- character_wallets: CHECK (balance >= 0) enforced at DB level
- Idempotency: unique constraint on currency_transactions(idempotency_key)
- settlement_treasuries table: settlement_id, currency_id, balance

## Test notes
server/test/currency.service.test.ts — transfer, overdraft block, idempotency replay safety

## Observability notes
Log all transfers with from_id, to_id, amount, reason (never log idempotency keys)

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Economy Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 20.1 - Currency System.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-20.1-currency-system.md && cat server/src/common/domain-events.ts && cat server/src/app.module.ts

STEP 2 - Implement:
  Create infra/migrations/035_create_currency.sql: currencies, character_wallets (balance >= 0 check), settlement_treasuries, currency_transactions tables
  Seed starter currencies: World Gold (primary=true), Settlement Credit
  Create server/src/modules/currency/: currency.module.ts, currency.service.ts (transfer, getBalance, seedWallet, deductFee), currency.controller.ts
  Atomic transfer with idempotency_key unique constraint
  GET /api/characters/:id/wallet, POST /api/wallet/transfer
  Register CurrencyModule in app.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/20.1-currency-system
  git add server/src/modules/currency/ infra/migrations/035_create_currency.sql server/test/ server/src/app.module.ts
  git commit -m "feat(20.1): currency system with wallets, atomic transfers, idempotency and audit log"
  gh pr create --draft --title "feat(20.1): currency system" --body "Implements story 20.1. Currencies, wallets, atomic transfers, idempotency, overdraft protection, audit log. All criteria met."
```
""")

# ── EPIC 21 — PRODUCTION INFRASTRUCTURE ─────────────────────────────────────

w("story-21.1-production-docker-and-reverse-proxy.md", """
# Story 21.1 — Production Docker Compose and Reverse Proxy
**Epic:** 21 | **Role:** Live Ops Agent | **Status:** Blocked on 12.1

## Problem / intent
The game must be self-hostable on a Windows machine with TLS termination, proper port routing, and production-grade Docker Compose so the host can run the full stack reliably.

## Acceptance criteria
- [ ] infra/compose/docker-compose.prod.yml: web, server, worker, postgres, redis, caddy services
- [ ] Caddy (or Nginx) reverse proxy: TLS via Let's Encrypt, routes /, /api, /ws, /admin
- [ ] infra/caddy/Caddyfile (or nginx.conf): correct upstream proxying with websocket support
- [ ] Environment variable injection from infra/env/.env.prod.example (not committed with secrets)
- [ ] Worker container: separate process for tick scheduler and AI proposal jobs
- [ ] Health checks defined for all services
- [ ] docs/RUNBOOKS/PRODUCTION_DEPLOY.md: step-by-step Windows deploy guide
- [ ] docker compose -f infra/compose/docker-compose.prod.yml config validates without error

## Dependencies
- 12.1 ✅

## Scope
Only touch: infra/compose/, infra/caddy/, infra/env/, docs/RUNBOOKS/
Do NOT touch: server/src/, client/src/

## Implementation notes
- Use Caddy 2 — auto-HTTPS with Let's Encrypt, minimal config
- Worker service shares codebase with server but runs `node dist/worker.js` entrypoint
- All secrets in external .env.prod file; docker-compose.prod.yml uses env_file directive
- PostgreSQL and Redis on named volumes for data persistence

## Test notes
Validate by running: docker compose -f infra/compose/docker-compose.prod.yml config

## Observability notes
All containers log to stdout in JSON format; log driver: json-file with rotation

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Live Ops Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 21.1 - Production Docker Compose and Reverse Proxy.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-21.1-production-docker-and-reverse-proxy.md && cat infra/compose/docker-compose.yml && cat server/.env.example

STEP 2 - Implement:
  Create infra/caddy/Caddyfile: TLS termination, reverse proxy for /, /api, /ws (WS upgrade), /admin
  Create infra/env/.env.prod.example: all required env vars with placeholder values
  Create infra/compose/docker-compose.prod.yml: web, server, worker, postgres (named volume), redis (named volume), caddy services with health checks
  Create server/src/worker.ts: standalone worker entrypoint that runs tick scheduler and AI proposal jobs
  Create docs/RUNBOOKS/PRODUCTION_DEPLOY.md: step-by-step Windows production deploy guide including Docker Desktop setup, domain DNS, cert automation
  Validate: docker compose -f infra/compose/docker-compose.prod.yml config

STEP 3 - Validate (compose config, not npm):
  docker compose -f infra/compose/docker-compose.prod.yml config
  If errors, fix and re-run.

STEP 4 - Open PR:
  git checkout -b story/21.1-production-docker
  git add infra/compose/docker-compose.prod.yml infra/caddy/ infra/env/.env.prod.example server/src/worker.ts docs/RUNBOOKS/PRODUCTION_DEPLOY.md
  git commit -m "feat(21.1): production Docker Compose stack with Caddy TLS and worker service"
  gh pr create --draft --title "feat(21.1): production Docker Compose and reverse proxy" --body "Implements story 21.1. Caddy TLS, prod compose stack, worker service, production deploy runbook. All criteria met."
```
""")

w("story-21.2-management-panel-desktop-wrapper.md", """
# Story 21.2 — Management Panel Desktop Wrapper
**Epic:** 21 | **Role:** Frontend Agent + Live Ops Agent | **Status:** Blocked on 12.1 + 21.1

## Problem / intent
The host needs a local desktop application that wraps the admin panel and provides one-click stack management, so running the game feels like an application rather than a dev server.

## Acceptance criteria
- [ ] Electron app in tools/desktop/ that embeds the admin panel web UI
- [ ] App has a native menu: Start Stack, Stop Stack, Restart Server, View Logs, Create Backup
- [ ] Stack health panel visible at startup: shows service status, connected users, last backup, tick health
- [ ] "Start Stack" runs docker compose -f infra/compose/docker-compose.prod.yml up -d
- [ ] "Create Backup" calls POST /api/admin/ops/backups via the admin API
- [ ] App icon and window title: "CybaWorld Manager"
- [ ] Works on Windows 11; packaged as .exe installer
- [ ] Unit tests: menu action triggers correct shell command or API call

## Dependencies
- 12.1 ✅  |  21.1 ✅

## Scope
Only touch: tools/desktop/
Do NOT touch: server/src/, client/src/, infra/compose/

## Implementation notes
- Use Electron with electron-builder for packaging
- Shell commands run via child_process.exec in main process, not renderer
- Embed admin UI via BrowserWindow loading https://localhost/admin

## Test notes
tools/desktop/test/ — mock child_process.exec, assert correct commands fire

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Frontend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 21.2 - Management Panel Desktop Wrapper.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-21.2-management-panel-desktop-wrapper.md && cat infra/compose/docker-compose.prod.yml

STEP 2 - Implement:
  mkdir tools/desktop && cd tools/desktop
  npm init -y && npm install electron electron-builder
  Create tools/desktop/main.js: BrowserWindow loading localhost/admin, native menu with Start/Stop/Restart/Logs/Backup actions
  Create tools/desktop/package.json with electron-builder config for Windows .exe output
  Menu actions: Start Stack calls docker compose up -d; Create Backup calls POST /api/admin/ops/backups
  Create tools/desktop/preload.js for secure IPC between renderer and main
  Create README in tools/desktop explaining how to build and run

STEP 3 - Validate:
  cd MMORPG_Design_Documents/tools/desktop && npm install && npm start
  Confirm Electron window opens without errors.

STEP 4 - Open PR:
  git checkout -b story/21.2-desktop-manager
  git add tools/desktop/
  git commit -m "feat(21.2): Electron management panel desktop wrapper for Windows"
  gh pr create --draft --title "feat(21.2): management panel desktop wrapper" --body "Implements story 21.2. Electron app, native menu, stack management actions, health panel. All criteria met."
```
""")

# ── EPIC 22 — INTEGRITY, LOAD TESTING AND HARDENING ─────────────────────────

w("story-22.1-integrity-checks-and-audit-jobs.md", """
# Story 22.1 — Integrity Checks and Audit Jobs
**Epic:** 22 | **Role:** Live Ops Agent + QA Agent | **Status:** Blocked on 9.1 + 8.1

## Problem / intent
Periodic integrity checks catch item duplication, orphan listings, and broken references before they corrupt the economy or frustrate players.

## Acceptance criteria
- [ ] Scheduled integrity job runs every in-game day (via batch tick)
- [ ] Check 1 — Item dupe detection: any item_instance_id referenced by > 1 owner
- [ ] Check 2 — Orphan listings: market_listings with no valid item_instance_id
- [ ] Check 3 — Broken references: character_skills referencing non-existent skill_ids
- [ ] Check 4 — Wallet invariant: sum of all transfers for each character equals their wallet balance
- [ ] All violations logged to integrity_violations table with severity and auto-quarantine flag
- [ ] GET /api/admin/integrity/violations — admin view of flagged issues
- [ ] Unit tests: each check with seeded violation data

## Dependencies
- 9.1 ✅  |  8.1 ✅

## Scope
Only touch: server/src/modules/integrity/, infra/migrations/, server/test/

## Implementation notes
- integrity_violations table: id, check_name, entity_type, entity_id, severity, details_json, detected_at, resolved_at
- Wire integrity job into batch/archival tick (not daily game tick — run as scheduled job)
- Auto-quarantine: set item_instance.quarantined = true on dupe detection

## Test notes
server/test/integrity.service.test.ts — seed each violation type, assert detection and log

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Live Ops Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 22.1 - Integrity Checks and Audit Jobs.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-22.1-integrity-checks-and-audit-jobs.md && cat server/src/modules/simulation/tick.service.ts && cat server/src/modules/items/items.service.ts

STEP 2 - Implement:
  Create infra/migrations/036_create_integrity_violations.sql: integrity_violations table + quarantined column on item_instances
  Create server/src/modules/integrity/: integrity.module.ts, integrity.service.ts (checkItemDupes, checkOrphanListings, checkBrokenRefs, checkWalletInvariant, runAllChecks), integrity.controller.ts
  Wire runAllChecks() into tick.service.ts batch/archival scheduled job
  Auto-quarantine duplicated item_instances
  GET /api/admin/integrity/violations — admin only, paginated

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/22.1-integrity-checks
  git add server/src/modules/integrity/ infra/migrations/036_create_integrity_violations.sql server/test/
  git commit -m "feat(22.1): scheduled integrity checks for dupes, orphans, broken refs, wallet invariants"
  gh pr create --draft --title "feat(22.1): integrity checks and audit jobs" --body "Implements story 22.1. 4 integrity check types, violations table, auto-quarantine, admin view. All criteria met."
```
""")

w("story-22.2-load-testing-harness.md", """
# Story 22.2 — Load Testing Harness
**Epic:** 22 | **Role:** QA / Security Agent | **Status:** Blocked on 3.1 + 4.2

## Problem / intent
The server must withstand concurrent WebSocket connections and world tick processing under realistic player load before going live.

## Acceptance criteria
- [ ] Load test script: tools/scripts/load-test.mjs
- [ ] Simulates N concurrent WS connections, each authenticating and submitting actions
- [ ] Records: connection latency, action throughput (actions/sec), tick duration under load
- [ ] Threshold checks: connection latency < 200ms p95; tick duration < 500ms under 100 concurrent users
- [ ] Script runnable: node tools/scripts/load-test.mjs --users=100 --duration=60
- [ ] Output: JSON report to infra/exports/load-test-report-{timestamp}.json
- [ ] docs/RUNBOOKS/LOAD_TEST_GUIDE.md: instructions for running tests before releases

## Dependencies
- 3.1 ✅  |  4.2 ✅

## Scope
Only touch: tools/scripts/load-test.mjs, infra/exports/.gitkeep, docs/RUNBOOKS/
Do NOT touch: server/src/, client/

## Implementation notes
- Use Node.js ws package for WebSocket connections in load test
- Auth via POST /api/auth/login for each simulated user (use test accounts)
- Measure action round-trip time from submit to ActionResolved event
- Report p50, p95, p99 latencies per metric

## Test notes
Manual run against local dev server — verified by reviewing output report

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the QA/Security Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 22.2 - Load Testing Harness.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-22.2-load-testing-harness.md && cat server/src/contracts/message-envelope.ts && cat server/src/modules/realtime/realtime.gateway.ts

STEP 2 - Implement:
  npm install ws --save-dev (in tools/ workspace or root)
  Create tools/scripts/load-test.mjs:
    - Parse --users and --duration args
    - Authenticate N users via POST /api/auth/login
    - Open N WS connections with JWT tokens
    - Submit action commands at 1/s per user; record round-trip latency
    - Measure tick events: record arrival times, compute tick duration distribution
    - Compute p50/p95/p99 for connection latency, action latency, tick duration
    - Check thresholds; report PASS/FAIL
    - Write JSON report to infra/exports/load-test-report-{Date.now()}.json
  Create docs/RUNBOOKS/LOAD_TEST_GUIDE.md: setup, run commands, threshold reference, failure response

STEP 3 - Validate (run against local server):
  npm run dev:server & sleep 5 && node tools/scripts/load-test.mjs --users=10 --duration=15
  Check report file created and summary printed.

STEP 4 - Open PR:
  git checkout -b story/22.2-load-testing
  git add tools/scripts/load-test.mjs docs/RUNBOOKS/LOAD_TEST_GUIDE.md
  git commit -m "feat(22.2): WS and action load testing harness with p95 threshold checks"
  gh pr create --draft --title "feat(22.2): load testing harness" --body "Implements story 22.2. Concurrent WS load test, latency percentiles, threshold checks, JSON report. All criteria met."
```
""")

print(f"All extended story files written to {BASE}")
