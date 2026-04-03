# Agentic Team Operating Model
This is the practical process to run the backlog with multiple agents and a human Product Owner.

## 1) Sprint cadence
- Sprint length: 2 weeks.
- Planning: backlog grooming + dependency mapping.
- Mid-sprint: architecture checkpoint for contract drift.
- End of sprint: internal playable demo + release decision.

## 2) Story intake flow
1. Create story file from template:
   - `npm run story:new -- 2.1 Account identity flow`
2. Fill required sections: acceptance criteria, dependencies, implementation notes, tests, observability.
3. Architect agent reviews dependency graph and interface contracts.
4. Product Owner approves or sends back for refinement.

## 3) Parallel execution rules
- Work in parallel only on stories whose interfaces are frozen.
- If schema/event contract changes, pause dependent stories and update ADR/contracts first.
- Every active story has one primary owner agent and one reviewer.

## 4) Daily operating loop
1. Product Owner updates priorities in `docs/BACKLOG.md`.
2. Agents pull assigned stories from `docs/stories/`.
3. Implementation + test + docs are updated together.
4. QA/Security agent performs risk and regression check.
5. Merge only when DoD is met.

## 5) Release process (foundation phase)
- Run `npm run validate`.
- Bring up infra via Docker Compose.
- Launch backend and frontend.
- Demonstrate target stories against acceptance criteria.
- Capture release notes and known risks in runbooks.

## 6) Roles in practice
- Product Owner: accepts scope and signs off completion.
- Architect: approves contracts before broad implementation.
- Backend/Frontend/Economy/AI agents: implement domain slices.
- QA/Security: blocks merge on quality or abuse risk.
- Live Ops: validates deployability, observability, and recovery.

## 7) First 8-sprint implementation arc
- Sprint 1: repo, CI, baseline backend/client shell.
- Sprint 2: account identity + websocket command envelope stabilization.
- Sprint 3: world time + action queue foundations.
- Sprint 4: life stages + routine mode baseline.
- Sprint 5: item identity and crafting core.
- Sprint 6: market listings + contracts.
- Sprint 7: settlement and law mechanics.
- Sprint 8: AI skill proposal pipeline with moderation gate.
