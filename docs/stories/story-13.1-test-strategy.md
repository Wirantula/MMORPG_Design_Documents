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
