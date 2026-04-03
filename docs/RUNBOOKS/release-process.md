# Release Process Runbook
## Pre-release checks
1. Backlog and accepted stories are up to date.
2. `npm run validate` passes.
3. Infra health is green (Postgres, Redis, app services).
4. Known risks and rollback notes are documented.

## Release steps
1. Tag release candidate.
2. Deploy backend then frontend.
3. Verify:
   - `/api/health`
   - websocket connectivity `/ws`
4. Confirm logs/metrics dashboards are receiving data.

## Rollback
- Revert to previous image/build artifact.
- Re-run smoke checks.
- Log incident and corrective action.
