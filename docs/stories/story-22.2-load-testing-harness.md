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
