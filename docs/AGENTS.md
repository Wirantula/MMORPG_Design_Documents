# Agent Team Guide
This document is the team-facing extension of root `AGENTS.md`.

## Ownership map
- Product Owner: prioritization, acceptance, release approval.
- Architect Agent: contracts, schema design, ADR ownership.
- Backend Agent: server runtime, domain modules, persistence.
- Frontend Agent: UI shell and player/admin UX flows.
- Economy Agent: listings, contracts, sinks/faucets, dashboards.
- AI Systems Agent: emergent skill proposal pipeline and moderation gate.
- QA/Security Agent: tests, abuse cases, hardening requirements.
- Live Ops Agent: deployment, backup/restore, observability, incidents.

## Coordination protocol
1. Story is created from template in `docs/stories/STORY_TEMPLATE.md`.
2. Architect confirms dependencies and contract boundaries.
3. Product Owner approves scope and acceptance criteria.
4. Parallel execution starts only for independent contract surfaces.
5. QA/Security review + Product Owner acceptance complete the story.

## Required artifacts per story
- Updated story file under `docs/stories/`
- Tests in relevant workspace
- Docs update in `docs/` and/or ADR update
- Observability note (log/metric/event impact)
