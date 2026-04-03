# Incident Response Runbook
## Severity model
- Sev 1: game unavailable or data integrity risk.
- Sev 2: major feature unavailable.
- Sev 3: degraded but playable.

## Response flow
1. Declare incident and assign incident commander.
2. Capture timeline and initial blast radius.
3. Stabilize service (rollback, disable feature flags, maintenance mode).
4. Validate player-facing recovery.
5. Publish internal postmortem with action items.

## Minimum artifacts
- Incident summary
- Root cause
- Corrective and preventive actions
- Owner and due date for each action
