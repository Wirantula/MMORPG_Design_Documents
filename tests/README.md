# Cross-Module Test Strategy
This directory is reserved for scenario and contract tests that span multiple workspaces.

## Implemented suites
- **Contract envelope parity** (`contract-envelope.test.ts`) – verifies server and client message envelope types stay in sync, and that client-produced envelopes pass server-side Zod validation.

## Planned suites
- Account lifecycle + one-character enforcement
- Action queue and time progression
- Market trade commit and anti-dupe checks
- Permadeath and legacy transitions

## Running
```bash
npx vitest run --config tests/vitest.config.ts --root tests
```
