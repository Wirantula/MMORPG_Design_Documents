# Story 1.2 — CI Quality Gates

**Epic:** 1 — Foundation and repository governance
**Role:** QA / Security Agent
**Status:** Ready

## Problem / intent
As a team, we want automated validation so regressions are caught immediately and no broken code can reach main.

## Acceptance criteria
- [ ] A CI workflow runs on every push and pull_request to main/master
- [ ] CI runs: `npm run lint`, `npm run typecheck`, `npm run test` across all workspaces
- [ ] CI fails and blocks merge if any check fails
- [ ] A badge in README shows current CI status
- [ ] Workflow file is `.github/workflows/ci.yml`

## Dependencies
- Story 1.1 ✅ (monorepo foundation complete)

## Scope
Only touch: `.github/workflows/ci.yml`, `README.md`
Do NOT touch: server/src, client/src, infra/

## Implementation notes
- Use `actions/setup-node@v4` with Node 22
- Use `npm ci` (not `npm install`) in CI
- Cache node_modules with `actions/cache` keyed on package-lock.json hash
- The existing `.github/workflows/ci.yml` may already exist — review and complete it

## Test notes
- Verify CI runs successfully by checking the workflow passes on the current codebase
- Confirm it would catch a deliberate lint error

## Observability
- No backend changes required
- Badge in README is the observable output

## Review owner
Product Owner (Joshua)
