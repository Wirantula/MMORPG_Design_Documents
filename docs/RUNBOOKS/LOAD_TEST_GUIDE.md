# Load Test Guide

Runbook for the CybaWorld WebSocket load testing harness (`tools/scripts/load-test.mjs`).

## Prerequisites

- Node.js ≥ 22
- `npm install` completed at monorepo root (installs `socket.io-client` in `tools` workspace)
- Local dev server running (`npm run dev:server`)

## Quick Start

```bash
# 1. Start the dev server
npm run dev:server &

# 2. Run load test (defaults: 10 users, 30s)
node tools/scripts/load-test.mjs

# 3. Run with custom parameters
node tools/scripts/load-test.mjs --users=100 --duration=60
```

## CLI Options

- `--users <N>` — Number of concurrent simulated users (default: `10`)
- `--duration <seconds>` — Test duration in seconds (default: `30`)
- `--host <url>` — Server base URL (default: `http://localhost:3000`)
- `--report-dir <path>` — Directory for JSON reports (default: `infra/exports`)

## What the Test Does

1. **Authenticate** — Creates/logs in N test users via `POST /api/auth/login`
2. **Connect** — Opens N concurrent Socket.IO connections (WebSocket transport) with JWT auth
3. **Submit actions** — Each user sends `action.submit` commands at ~1 per second
4. **Measure** — Records connection latency, action round-trip latency (submit → ack/started), and tick interval durations
5. **Report** — Computes percentile stats (p50/p95/p99), checks thresholds, writes JSON report

## Threshold Reference

| Metric | Threshold | Condition |
|---|---|---|
| Connection latency p95 | < 200 ms | All user counts |
| Tick duration p95 | < 500 ms | Under 100 concurrent users |
| Action latency p95 | < 500 ms | All user counts |

The script exits with code `0` on PASS, `1` on FAIL, `2` on crash.

## Output

### Console

The script prints a summary table with connection/action/tick latency percentiles and threshold PASS/FAIL results.

### JSON Report

Written to `infra/exports/load-test-report-{timestamp}.json` with structure:

```json
{
  "meta": { "tool", "version", "timestamp", "server", "config", "testDurationMs" },
  "summary": { "usersAttempted", "usersConnected", "actionsSubmitted", "actionsAcked", "ticksReceived", "errorsCount" },
  "latencies": {
    "connection": { "count", "min", "max", "mean", "p50", "p95", "p99" },
    "action": { ... },
    "tickDuration": { ... }
  },
  "thresholds": {
    "connectionLatencyP95": { "value", "threshold", "pass" },
    "tickDurationP95": { ... },
    "actionLatencyP95": { ... }
  },
  "pass": true|false,
  "errors": [ ... ]
}
```

### Observability

A structured JSON log line (`event: "load_test.completed"`) is emitted at the end for ingestion by monitoring pipelines.

## Pre-Release Checklist

Run this test **before every release** and **after infrastructure changes**:

```bash
# Standard pre-release load test
node tools/scripts/load-test.mjs --users=100 --duration=60

# Verify report
ls -la infra/exports/load-test-report-*.json
```

## Failure Response

### Connection latency p95 exceeds 200ms

- Check server resource usage (CPU, memory, open file descriptors)
- Check network latency between test runner and server
- Review Socket.IO server configuration (ping interval, max connections)
- Check if auth endpoint is a bottleneck (database connection pool)

### Tick duration p95 exceeds 500ms

- Profile the simulation tick loop for expensive operations
- Check for lock contention in world state updates
- Review entity count — reduce NPC density if tick is overloaded
- Consider splitting tick processing across workers

### Action latency p95 exceeds 500ms

- Profile action service for slow operations
- Check database query performance for action resolution
- Review action queue depth — actions may be backing up
- Check if broadcast fan-out is blocking the event loop

### General debugging

- Review `errors` array in the JSON report for specific failure messages
- Check server logs for corresponding error entries during the test window
- Run with fewer users to isolate whether the issue is load-dependent
- Use `--host` to test against staging environments
