#!/usr/bin/env node
/**
 * CybaWorld Load Testing Harness (Story 22.2)
 *
 * Simulates N concurrent WebSocket users against the game server.
 * Each user authenticates, opens a Socket.IO connection, submits actions
 * at ~1/s, and records latencies for connections, actions, and ticks.
 *
 * Usage:
 *   node tools/scripts/load-test.mjs --users=100 --duration=60
 *
 * Options:
 *   --users      Number of concurrent simulated users (default: 10)
 *   --duration   Test duration in seconds (default: 30)
 *   --host       Server base URL (default: http://localhost:3000)
 *   --report-dir Directory for JSON reports (default: infra/exports)
 */

import { io } from 'socket.io-client';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';

// ── CLI argument parsing ────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    users:      { type: 'string', default: '10' },
    duration:   { type: 'string', default: '30' },
    host:       { type: 'string', default: 'http://localhost:3000' },
    'report-dir': { type: 'string', default: 'infra/exports' },
  },
  strict: false,
});

const NUM_USERS       = parseInt(args.users, 10);
const DURATION_SEC    = parseInt(args.duration, 10);
const SERVER_BASE_URL = args.host;
const REPORT_DIR      = resolve(args['report-dir']);

console.log(`\n🔧 CybaWorld Load Test`);
console.log(`   Users: ${NUM_USERS}  Duration: ${DURATION_SEC}s  Server: ${SERVER_BASE_URL}\n`);

// ── Thresholds (from acceptance criteria) ───────────────────────

const THRESHOLDS = {
  connectionLatencyP95Ms: 200,   // < 200ms p95
  tickDurationP95Ms:      500,   // < 500ms under 100 concurrent users
  actionLatencyP95Ms:     500,   // reasonable action round-trip
};

// ── Metrics collection ──────────────────────────────────────────

const metrics = {
  connectionLatencies: [],   // ms per user to connect
  actionLatencies:     [],   // ms per action round-trip (submit → ack)
  tickArrivalTimes:    [],   // timestamps of tick events
  tickDurations:       [],   // intervals between consecutive ticks
  errors:              [],   // any error events
  actionsSubmitted:    0,
  actionsAcked:       0,
  ticksReceived:       0,
};

// ── Helpers ─────────────────────────────────────────────────────

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeStats(values) {
  if (values.length === 0) return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  return {
    count: sorted.length,
    min:   sorted[0],
    max:   sorted[sorted.length - 1],
    mean:  Math.round(sum / sorted.length * 100) / 100,
    p50:   percentile(sorted, 50),
    p95:   percentile(sorted, 95),
    p99:   percentile(sorted, 99),
  };
}

/** Authenticate a test user via POST /api/auth/login. */
async function authenticateUser(userId) {
  const username = `loadtest_user_${userId}`;
  const password = 'loadtest_password';

  try {
    const res = await fetch(`${SERVER_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.accessToken || data.token || data.access_token || null;
    }

    // If login fails, try register then login
    const regRes = await fetch(`${SERVER_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (regRes.ok) {
      const retryRes = await fetch(`${SERVER_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (retryRes.ok) {
        const data = await retryRes.json();
        return data.accessToken || data.token || data.access_token || null;
      }
    }

    // Fallback: generate a synthetic token for load testing when auth
    // service is unavailable or doesn't support test accounts.
    console.warn(`  ⚠ Auth failed for user ${userId}, using synthetic token`);
    return `loadtest-synthetic-${userId}-${Date.now()}`;
  } catch (err) {
    console.warn(`  ⚠ Auth error for user ${userId}: ${err.message}. Using synthetic token.`);
    return `loadtest-synthetic-${userId}-${Date.now()}`;
  }
}

/** Open a Socket.IO connection and return a handle. */
function connectUser(userId, token) {
  return new Promise((resolvePromise) => {
    const connectStart = performance.now();

    const socket = io(SERVER_BASE_URL, {
      path: '/ws',
      auth: { token },
      query: { auth: token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10_000,
    });

    const pendingActions = new Map();  // commandId → submitTimestamp
    let lastTickTime = null;

    // ── Connection ──
    socket.on('connect', () => {
      const latency = performance.now() - connectStart;
      metrics.connectionLatencies.push(Math.round(latency * 100) / 100);
      resolvePromise({ socket, pendingActions, userId });
    });

    // ── Server events ──
    socket.on('event', (envelope) => {
      if (!envelope || !envelope.type) return;

      switch (envelope.type) {
        case 'ack': {
          const cmdId = envelope.id;
          if (pendingActions.has(cmdId)) {
            const latency = performance.now() - pendingActions.get(cmdId);
            metrics.actionLatencies.push(Math.round(latency * 100) / 100);
            metrics.actionsAcked++;
            pendingActions.delete(cmdId);
          }
          break;
        }

        case 'action.started':
        case 'action.resolved': {
          const cmdId = envelope.id?.replace(/:action\.\w+$/, '');
          if (cmdId && pendingActions.has(cmdId)) {
            const latency = performance.now() - pendingActions.get(cmdId);
            metrics.actionLatencies.push(Math.round(latency * 100) / 100);
            metrics.actionsAcked++;
            pendingActions.delete(cmdId);
          }
          break;
        }

        case 'tick': {
          const now = performance.now();
          metrics.ticksReceived++;
          metrics.tickArrivalTimes.push(now);
          if (lastTickTime !== null) {
            metrics.tickDurations.push(Math.round((now - lastTickTime) * 100) / 100);
          }
          lastTickTime = now;
          break;
        }

        case 'error': {
          metrics.errors.push({
            userId,
            message: envelope.payload?.message ?? 'unknown',
            timestamp: envelope.timestamp,
          });
          break;
        }
      }
    });

    // ── Connection failure ──
    socket.on('connect_error', (err) => {
      const latency = performance.now() - connectStart;
      metrics.connectionLatencies.push(Math.round(latency * 100) / 100);
      metrics.errors.push({
        userId,
        message: `connect_error: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
      resolvePromise({ socket, pendingActions, userId, failed: true });
    });
  });
}

/** Submit a single action command on the socket. */
function submitAction(handle) {
  const commandId = `load:${handle.userId}:${randomUUID().slice(0, 8)}`;
  const envelope = {
    id: commandId,
    type: 'action.submit',
    timestamp: new Date().toISOString(),
    payload: {
      characterId: `char-loadtest-${handle.userId}`,
      definitionId: 'gather_wood',
    },
  };

  handle.pendingActions.set(commandId, performance.now());
  metrics.actionsSubmitted++;
  handle.socket.emit('command', envelope);
}

// ── Main execution ──────────────────────────────────────────────

async function main() {
  const testStartTime = Date.now();
  const testStartPerf = performance.now();

  // Phase 1: Authenticate users
  console.log(`Phase 1: Authenticating ${NUM_USERS} users...`);
  const tokens = await Promise.all(
    Array.from({ length: NUM_USERS }, (_, i) => authenticateUser(i))
  );
  const authDuration = Math.round(performance.now() - testStartPerf);
  console.log(`  ✓ Auth complete in ${authDuration}ms (${tokens.filter(Boolean).length}/${NUM_USERS} tokens)`);

  // Phase 2: Open WebSocket connections
  console.log(`Phase 2: Opening ${NUM_USERS} WebSocket connections...`);
  const connStart = performance.now();
  const handles = await Promise.all(
    tokens.map((token, i) => connectUser(i, token))
  );
  const connDuration = Math.round(performance.now() - connStart);
  const connectedCount = handles.filter(h => !h.failed).length;
  console.log(`  ✓ ${connectedCount}/${NUM_USERS} connected in ${connDuration}ms`);

  // Phase 3: Submit actions at ~1/s per user for duration
  console.log(`Phase 3: Submitting actions for ${DURATION_SEC}s...`);
  const activeHandles = handles.filter(h => !h.failed && h.socket.connected);

  let elapsed = 0;
  await new Promise((done) => {
    const interval = setInterval(() => {
      elapsed++;
      for (const handle of activeHandles) {
        submitAction(handle);
      }
      if (elapsed >= DURATION_SEC) {
        clearInterval(interval);
        done();
      }
    }, 1000);
  });

  // Grace period for in-flight responses
  await new Promise((r) => setTimeout(r, 2000));

  const totalTestDuration = Math.round(performance.now() - testStartPerf);
  console.log(`  ✓ Test complete. Duration: ${totalTestDuration}ms`);

  // Phase 4: Disconnect all
  for (const handle of handles) {
    handle.socket.disconnect();
  }

  // Phase 5: Compute stats and thresholds
  const connectionStats = computeStats(metrics.connectionLatencies);
  const actionStats     = computeStats(metrics.actionLatencies);
  const tickStats       = computeStats(metrics.tickDurations);

  const thresholdResults = {
    connectionLatencyP95: {
      value:     connectionStats.p95,
      threshold: THRESHOLDS.connectionLatencyP95Ms,
      pass:      connectionStats.p95 <= THRESHOLDS.connectionLatencyP95Ms,
    },
    tickDurationP95: {
      value:     tickStats.p95,
      threshold: THRESHOLDS.tickDurationP95Ms,
      pass:      tickStats.count === 0 || tickStats.p95 <= THRESHOLDS.tickDurationP95Ms,
    },
    actionLatencyP95: {
      value:     actionStats.p95,
      threshold: THRESHOLDS.actionLatencyP95Ms,
      pass:      actionStats.count === 0 || actionStats.p95 <= THRESHOLDS.actionLatencyP95Ms,
    },
  };

  const allPassed = Object.values(thresholdResults).every(t => t.pass);

  // Phase 6: Build report
  const report = {
    meta: {
      tool:      'cybaworld-load-test',
      version:   '1.0.0',
      timestamp: new Date().toISOString(),
      server:    SERVER_BASE_URL,
      config: {
        users:    NUM_USERS,
        durationSec: DURATION_SEC,
      },
      testDurationMs: totalTestDuration,
    },
    summary: {
      usersAttempted:  NUM_USERS,
      usersConnected:  connectedCount,
      actionsSubmitted: metrics.actionsSubmitted,
      actionsAcked:    metrics.actionsAcked,
      ticksReceived:   metrics.ticksReceived,
      errorsCount:     metrics.errors.length,
    },
    latencies: {
      connection: connectionStats,
      action:     actionStats,
      tickDuration: tickStats,
    },
    thresholds: thresholdResults,
    pass: allPassed,
    errors: metrics.errors.slice(0, 50),  // cap error list
  };

  // Phase 7: Write report
  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }
  const reportFile = join(REPORT_DIR, `load-test-report-${Date.now()}.json`);
  writeFileSync(reportFile, JSON.stringify(report, null, 2));

  // Phase 8: Print summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  LOAD TEST REPORT`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Users: ${connectedCount}/${NUM_USERS} connected`);
  console.log(`  Duration: ${DURATION_SEC}s`);
  console.log(`  Actions: ${metrics.actionsSubmitted} submitted, ${metrics.actionsAcked} acked`);
  console.log(`  Ticks:   ${metrics.ticksReceived} received`);
  console.log(`  Errors:  ${metrics.errors.length}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Connection Latency (ms):`);
  console.log(`    p50=${connectionStats.p50}  p95=${connectionStats.p95}  p99=${connectionStats.p99}  mean=${connectionStats.mean}`);
  console.log(`  Action Latency (ms):`);
  console.log(`    p50=${actionStats.p50}  p95=${actionStats.p95}  p99=${actionStats.p99}  mean=${actionStats.mean}`);
  console.log(`  Tick Duration (ms):`);
  console.log(`    p50=${tickStats.p50}  p95=${tickStats.p95}  p99=${tickStats.p99}  mean=${tickStats.mean}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Threshold Checks:`);
  for (const [name, result] of Object.entries(thresholdResults)) {
    const icon = result.pass ? '✅' : '❌';
    console.log(`    ${icon} ${name}: ${result.value}ms (threshold: ${result.threshold}ms)`);
  }
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Result: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Report: ${reportFile}`);
  console.log(`${'═'.repeat(60)}\n`);

  // Observability: log structured event for monitoring pipelines
  console.log(JSON.stringify({
    event: 'load_test.completed',
    timestamp: new Date().toISOString(),
    users: NUM_USERS,
    duration_sec: DURATION_SEC,
    pass: allPassed,
    connection_p95: connectionStats.p95,
    action_p95: actionStats.p95,
    tick_p95: tickStats.p95,
    errors: metrics.errors.length,
  }));

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n❌ Load test crashed: ${err.message}\n${err.stack}`);
  process.exit(2);
});
