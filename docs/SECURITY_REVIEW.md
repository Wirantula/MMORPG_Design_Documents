# Security Review – Foundation Phase

Reviewed by: QA/Security Agent
Date: 2026-04-03
Scope: All code seeded in the foundation sprint (Epic 1, 3, 4, 13)

## 1. Threat Model Summary

### 1.1 Assets
- Player account credentials (future – not yet implemented)
- Game state integrity (world time, simulation, action queue)
- Server infrastructure (NestJS process, PostgreSQL, Redis)
- Admin/moderation controls (future)

### 1.2 Actors
- Authenticated player (future)
- Unauthenticated browser client (current)
- Automated bot / script
- Malicious insider (admin abuse)

## 2. Findings

### 2.1 WebSocket Gateway – Input Validation ✅ Adequate
- **Status:** Mitigated by Zod schema validation in `server/src/modules/realtime/dto/command.dto.ts`.
- **Detail:** The `parseCommandEnvelope` function validates `id` (non-empty string), `type` (enum of known commands), `timestamp` (ISO 8601 datetime), and strips unknown fields via Zod default strip mode.
- **Residual risk:** No payload size limit is enforced. A client could send an arbitrarily large `payload` or `metadata` object.
- **Recommendation:** Add `z.string().max(1024)` for `id`, `z.unknown().refine()` with a max serialized byte check on `payload`, and a max key count on `metadata`.

### 2.2 WebSocket Gateway – No Authentication 🔴 High
- **Status:** Open. The WebSocket gateway at `/ws` accepts all connections without authentication.
- **Detail:** This is expected for the foundation phase (auth is planned in Epic 2), but it means any client can connect, send commands, and receive world snapshots.
- **Recommendation:** Before Epic 3 exits foundation phase, add an authenticated handshake requirement (Story 3.1 subtask). Until then, document this as a known limitation.

### 2.3 WebSocket Gateway – No Rate Limiting 🟡 Medium
- **Status:** Open. No per-connection or per-IP rate limiting exists on the `command` message handler.
- **Detail:** A malicious client could flood the gateway with rapid `command` messages, consuming server resources.
- **Recommendation:** Implement a per-socket rate limiter (e.g., token bucket with 10 commands/second burst, 2 commands/second sustained). Wire a metric `cybaworld_ws_rate_limited_total` for observability.

### 2.4 WebSocket Gateway – CORS Policy 🟡 Medium
- **Status:** Open. The gateway uses `cors: { origin: true, credentials: true }`, which accepts connections from any origin.
- **Detail:** This is acceptable for local development but must be restricted before any hosted deployment.
- **Recommendation:** Make CORS origin configurable via environment variable (e.g., `WS_CORS_ORIGIN`). Default to `http://localhost:3000` in development, require explicit setting in production.

### 2.5 Environment Configuration – Secret Defaults 🟡 Medium
- **Status:** Open. `server/src/config/env.ts` sets `POSTGRES_PASSWORD` default to `cybaworld_dev_password`.
- **Detail:** The default is fine for local development but creates risk if the server is deployed without overriding the password.
- **Recommendation:** In `production` mode, require `POSTGRES_PASSWORD` to be explicitly set (no default). Add a startup check that rejects known-weak defaults when `NODE_ENV=production`.

### 2.6 Environment Configuration – Env Caching 🟢 Low
- **Status:** Informational. `loadEnv()` caches the result in a module-level variable, preventing hot-reload of env changes at runtime.
- **Detail:** This is intentional and safe. No action needed.

### 2.7 Health Endpoint – Information Disclosure 🟢 Low
- **Status:** Informational. `/api/health` exposes process uptime, simulation time, and acceleration factor.
- **Detail:** This is non-sensitive for the current scope. When auth and account endpoints are added, consider gating detailed health info behind an admin role.

### 2.8 Metrics Endpoint – No Authentication 🟡 Medium
- **Status:** Open. `/api/metrics` exposes Prometheus metrics to any caller.
- **Detail:** Metrics include process memory and uptime. Not critical now, but operational data should be restricted in production.
- **Recommendation:** Gate `/api/metrics` behind an internal-only network policy or basic auth token in production deployments.

### 2.9 Client – No Content Security Policy 🟡 Medium
- **Status:** Open. The Next.js client does not set a Content-Security-Policy header.
- **Detail:** When user-generated content is displayed (chat, item names, etc.), XSS risk increases.
- **Recommendation:** Add a baseline CSP header in `next.config.mjs` before Epic 3.2 is complete. At minimum: `default-src 'self'; connect-src 'self' ws://localhost:3001`.

### 2.10 Observability – Log Redaction Policy ✅ Adequate
- **Status:** Documented in `docs/OBSERVABILITY_BASELINE.md`.
- **Detail:** The redaction policy prohibits logging secrets, session IDs, and payment identifiers. The structured logger in `server/src/common/logger.service.ts` outputs JSON with standard fields.
- **Residual risk:** No automated redaction enforcement. Developers could accidentally log sensitive fields.
- **Recommendation:** Add a lint rule or test that scans log output for known secret patterns (deferred to Story 13.3 hardening).

## 3. Exploit Test Checklist (Foundation Phase)

Run these checks before every release candidate:

1. **WebSocket flood:** Open 100 concurrent WebSocket connections and send 1000 rapid `ping` commands. Verify server remains responsive and logs the load.
2. **Malformed envelope injection:** Send `{ type: "__proto__", id: "x", timestamp: "2200-01-01T00:00:00Z" }` and verify Zod rejects it.
3. **Oversized payload:** Send a command with a 10 MB `payload` field. Verify the server handles it without crashing (currently a gap – see 2.1).
4. **CORS probe:** Make a cross-origin fetch from `http://evil.example.com` and verify the response is blocked when CORS is properly configured (currently open – see 2.4).
5. **Health endpoint smoke:** Verify `/api/health` returns `200` with `status: "ok"`.
6. **Metrics endpoint smoke:** Verify `/api/metrics` returns valid Prometheus format with expected metric names.
7. **Invalid env startup:** Set `NODE_ENV=production` with default password and verify the server starts (gap – see 2.5; after hardening, it should refuse to start).

## 4. Hardening Roadmap

Priority order for remediation:

1. **Epic 2 (auth):** WebSocket authenticated handshake (blocks most abuse vectors)
2. **Rate limiting:** Per-socket command throttle with observability metric
3. **CORS lockdown:** Configurable origin allowlist
4. **Payload size limits:** Zod refinements on envelope payload and metadata
5. **Production env validation:** Reject weak defaults in production mode
6. **CSP headers:** Baseline content security policy on client
7. **Metrics auth:** Gate Prometheus endpoint in production
8. **Log scanning:** Automated secret-in-log detection

## 5. Observability Notes
- This review recommends adding the following metrics in future stories:
  - `cybaworld_ws_connections_total` (gauge)
  - `cybaworld_ws_commands_total` (counter, by type)
  - `cybaworld_ws_rate_limited_total` (counter)
  - `cybaworld_ws_errors_total` (counter, by error type)
- All security-relevant events should emit structured log entries with `context: "Security"`.
