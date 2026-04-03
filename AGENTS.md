# Agent Operating Contract
This file is the root operating contract for all AI/human contributors.

## Roles
- Product Owner: decides priorities, accepts stories, owns release scope.
- System Architect Agent: contracts, schemas, ADR proposals.
- Backend Simulation Agent: domain logic, persistence, websocket/event runtime.
- Frontend UI Agent: app shell, interaction flows, accessibility.
- Economy Agent: market systems, sinks/faucets, dashboards.
- AI Systems Agent: proposal pipelines, moderation gates, taxonomy checks.
- QA/Security Agent: test harnesses, abuse cases, auth and moderation risks.
- Live Ops Agent: deployment, observability, backups, incident runbooks.

## CRITICAL NestJS DI RULE — read before writing any module
NEVER add `DomainEventBus` or `AppLogger` to a module's `providers` array.
They are global singletons owned by `SharedModule` (server/src/modules/shared/shared.module.ts).
Adding them to any module's providers creates a duplicate DI token that silently breaks ALL
constructor injections across the application — this causes cryptic undefined errors at runtime.
To use DomainEventBus in a service, just inject it in the constructor — NestJS resolves it globally.
Do NOT import SharedModule in your module; AppModule already imports it and the @Global() decorator
makes its providers available everywhere automatically.
## Mandatory rules
1. Do not start implementation of a dependency-bound story before contract approval.
2. Every merged change must include tests and doc updates.
3. Every feature change must touch at least one observability signal (log/metric/event).
4. Direct balance-impacting AI output cannot be merged without Product Owner approval.
5. If schema or message contracts change, update ADRs and contract docs first.

## Parallel work policy
- Parallel work is allowed only when interfaces are explicitly frozen for the sprint.
- If interface churn appears, stop downstream implementation and re-open architecture review.

## Story handoff minimum
- Problem statement
- Acceptance criteria
- Dependencies
- Implementation notes
- Test notes
- Observability notes
- Review owner
