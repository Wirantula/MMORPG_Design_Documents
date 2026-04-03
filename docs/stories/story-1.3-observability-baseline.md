# Story 1.3 — Observability Baseline

**Epic:** 1 — Foundation and repository governance
**Role:** Backend Simulation Agent
**Status:** Ready

## Problem / intent
As operators, we want standard structured logs and a metrics endpoint so core server failures are immediately diagnosable.

## Acceptance criteria
- [ ] All server log lines are valid JSON with fields: timestamp, level, context, message
- [ ] GET /api/metrics returns Prometheus-format plain text (content-type: text/plain; version=0.0.4)
- [ ] Metrics include: uptime, memory (rss + heapUsed), process start time
- [ ] AppLogger is injected and used in HealthController and SimulationService
- [ ] OBSERVABILITY_BASELINE.md is updated to reflect actual implementation
- [ ] A unit test asserts the metrics endpoint returns a non-empty string

## Dependencies
- Story 1.1 ✅ (monorepo foundation complete)

## Scope
Only touch: server/src/common/, server/src/modules/health/, server/src/modules/observability/, server/src/modules/simulation/, server/test/, docs/OBSERVABILITY_BASELINE.md
Do NOT touch: client/, infra/, .github/

## Implementation notes
- AppLogger already exists at server/src/common/logger.service.ts — extend if needed
- ObservabilityModule already scaffolded at server/src/modules/observability/
- NestJS @nestjs/common Logger format: { timestamp, level, context, message }
- Inject AppLogger via constructor DI in controllers and services
- The metrics endpoint is GET /api/metrics (global prefix is /api)

## Test notes
- server/test/ should have a test for ObservabilityService.renderPrometheusMetrics()
- Confirm JSON log output format with a logged startup message

## Observability
- This story IS the observability baseline
- Completion = structured logs + /api/metrics endpoint working

## Review owner
Product Owner (Joshua)
