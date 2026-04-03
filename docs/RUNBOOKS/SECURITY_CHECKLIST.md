# Security Checklist — CybaWorld MMORPG
Last reviewed: 2026-04-03 (Story 13.3)

## Authentication and session management
- [x] Passwords hashed with bcrypt (AccountsService)
- [x] JWT access tokens with short expiry (15 min default)
- [x] Refresh-token rotation — old token invalidated on each refresh
- [x] Rate limiting on all `/api/auth/*` endpoints: 10 req/min per IP
- [x] Bearer-token verification guard (`JwtAuthGuard`) for protected routes
- [ ] Account lockout after N failed login attempts (not yet implemented)
- [ ] Multi-factor authentication (future roadmap)

## CSRF protection
- [x] SameSite=Strict attribute enforced on all cookies (`main.ts` middleware)
- [x] HttpOnly flag on cookies
- [ ] Double-submit cookie token for non-browser API clients (future)

## XSS protection
- [x] Global `XssSanitizeInterceptor` strips HTML tags from all request body strings
- [x] `X-Content-Type-Options: nosniff` header
- [x] `X-XSS-Protection: 1; mode=block` header
- [x] `X-Frame-Options: DENY` header (clickjacking prevention)
- [ ] Content Security Policy header (future — requires frontend coordination)

## Rate limiting
- [x] Global default: 60 req/min per IP (`SecurityModule` / `ThrottlerModule`)
- [x] Auth endpoints: 10 req/min per IP (`AuthController @Throttle`)
- [x] Market listings: 60 listings/hour per IP (`MarketController @Throttle`)
- [ ] WebSocket connection rate limiting (future — realtime gateway)
- [ ] Per-account rate limiting via JWT subject (future enhancement)

## Bot and abuse detection
- [x] `BotDetectionService`: flags > 5 identical actions in 1-second rolling window
- [x] Flagged requests produce structured log (`bot_flag` event)
- [ ] Automated escalation: temp-ban after repeated bot flags (future)
- [ ] CAPTCHA challenge on registration (future)
- [ ] Redis-backed sorted set for production scale (current: in-memory)

## Input validation
- [x] All auth DTOs validated via Zod schemas (`auth.dto.ts`)
- [x] Market listing / order bodies validated in controller
- [x] Character creation validated via Zod schemas
- [ ] Maximum payload size limit on Express (future — `body-parser` limit)
- [ ] File upload scanning (N/A currently — no upload endpoints)

## Data protection
- [x] Passwords never stored in plain text (bcrypt)
- [x] JWT secret loaded from environment variable
- [ ] Encryption at rest for database (infrastructure concern — future)
- [ ] PII handling policy for player data (future)

## Infrastructure / deployment
- [ ] TLS termination (infrastructure concern — handled by reverse proxy)
- [ ] Secrets management (currently env vars; Vault or similar recommended for prod)
- [ ] WAF or API gateway (future)
- [ ] DDoS protection (infrastructure concern — CDN/CloudFlare layer)

## Observability of security events
- [x] Structured logs for `AccountCreated`, `AccountLoggedIn` domain events
- [x] Structured `bot_flag` warning logs with character + action details
- [x] Rate-limit rejections produce HTTP 429 responses (ThrottlerGuard default)
- [ ] Security-specific Prometheus metrics (e.g. `auth_failures_total`) (future)
- [ ] Alert rules for anomalous auth failure spikes (future)

## Known risks — current state
1. **No account lockout** — brute-force is mitigated only by rate limiting.
2. **In-memory bot detection** — state lost on restart; needs Redis for prod.
3. **No CSP header** — XSS risk if frontend renders user content unsafely.
4. **No per-account rate limiting** — IP-based only; shared IPs may cause false positives.
5. **WebSocket not rate-limited** — realtime gateway has no throttle yet.

## Review cadence
This checklist must be re-reviewed before every public-facing release and
updated whenever new endpoints, controllers, or data flows are added.
