import { describe, expect, it, beforeEach } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { DomainEventBus, type KnownDomainEvent } from '../src/common/domain-events';

const JWT_SECRET = 'test-secret';

function createServices() {
  const eventBus = new DomainEventBus();
  const accountsService = new AccountsService();
  const jwtService = new JwtService({
    secret: JWT_SECRET,
    signOptions: { expiresIn: '15m' },
  });
  const authService = new AuthService(accountsService, jwtService, eventBus);

  return { eventBus, accountsService, jwtService, authService };
}

describe('AuthService', () => {
  let authService: AuthService;
  let accountsService: AccountsService;
  let jwtService: JwtService;
  let eventBus: DomainEventBus;

  beforeEach(() => {
    const services = createServices();
    authService = services.authService;
    accountsService = services.accountsService;
    jwtService = services.jwtService;
    eventBus = services.eventBus;
  });

  // ── Register ────────────────────────────────────────────────────

  describe('register', () => {
    it('creates an account and returns tokens', async () => {
      const result = await authService.register({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      expect(result.ok).toBe(true);
      expect(result.accountId).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.tokens!.accessToken).toBeTruthy();
      expect(result.tokens!.refreshToken).toBeTruthy();

      // Verify the access token is valid
      const decoded = jwtService.verify(result.tokens!.accessToken) as { sub: string };
      expect(decoded.sub).toBe(result.accountId);
    });

    it('emits AccountCreated domain event', async () => {
      const events: KnownDomainEvent[] = [];
      eventBus.on('AccountCreated', (e) => events.push(e));

      const result = await authService.register({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('AccountCreated');
      expect(events[0].payload).toEqual({ accountId: result.accountId });
    });

    it('rejects duplicate email with 409', async () => {
      await authService.register({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      const result = await authService.register({
        email: 'player@cybaworld.com',
        password: 'differentPass456',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Email already registered');
      expect(result.statusCode).toBe(409);
    });

    it('normalises email to lowercase', async () => {
      const result = await authService.register({
        email: 'Player@CybaWorld.com',
        password: 'securePass123',
      });

      expect(result.ok).toBe(true);
      const account = accountsService.findByEmail('player@cybaworld.com');
      expect(account).toBeDefined();
      expect(account!.email).toBe('player@cybaworld.com');
    });
  });

  // ── Login ───────────────────────────────────────────────────────

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      await authService.register({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      const result = await authService.login({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      expect(result.ok).toBe(true);
      expect(result.tokens).toBeDefined();
      expect(result.accountId).toBeDefined();
    });

    it('emits AccountLoggedIn domain event', async () => {
      await authService.register({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      const events: KnownDomainEvent[] = [];
      eventBus.on('AccountLoggedIn', (e) => events.push(e));

      await authService.login({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('AccountLoggedIn');
    });

    it('rejects unknown email with 401', async () => {
      const result = await authService.login({
        email: 'nobody@cybaworld.com',
        password: 'anyPass',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Invalid email or password');
      expect(result.statusCode).toBe(401);
    });

    it('rejects wrong password with 401', async () => {
      await authService.register({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      const result = await authService.login({
        email: 'player@cybaworld.com',
        password: 'wrongPassword',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Invalid email or password');
      expect(result.statusCode).toBe(401);
    });
  });

  // ── Refresh ─────────────────────────────────────────────────────

  describe('refresh', () => {
    it('issues new tokens with valid refresh token', async () => {
      const registerResult = await authService.register({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      const refreshResult = await authService.refresh(
        registerResult.accountId!,
        registerResult.tokens!.refreshToken,
      );

      expect(refreshResult.ok).toBe(true);
      expect(refreshResult.tokens).toBeDefined();
      expect(refreshResult.tokens!.accessToken).toBeTruthy();
      expect(refreshResult.tokens!.refreshToken).toBeTruthy();

      // New refresh token should be different (rotated)
      expect(refreshResult.tokens!.refreshToken).not.toBe(
        registerResult.tokens!.refreshToken,
      );
    });

    it('rejects invalid refresh token with 401', async () => {
      const registerResult = await authService.register({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      const result = await authService.refresh(
        registerResult.accountId!,
        'completely-invalid-token',
      );

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('invalidates old refresh token after rotation', async () => {
      const registerResult = await authService.register({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      const oldRefreshToken = registerResult.tokens!.refreshToken;

      // First refresh succeeds
      await authService.refresh(registerResult.accountId!, oldRefreshToken);

      // Reusing the old token should fail (it was rotated)
      const result = await authService.refresh(
        registerResult.accountId!,
        oldRefreshToken,
      );

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(401);
    });
  });

  // ── Logout ──────────────────────────────────────────────────────

  describe('logout', () => {
    it('invalidates the refresh token', async () => {
      const registerResult = await authService.register({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      const logoutResult = await authService.logout(
        registerResult.accountId!,
        registerResult.tokens!.refreshToken,
      );

      expect(logoutResult.ok).toBe(true);

      // Refresh with the same token should now fail
      const refreshResult = await authService.refresh(
        registerResult.accountId!,
        registerResult.tokens!.refreshToken,
      );

      expect(refreshResult.ok).toBe(false);
      expect(refreshResult.statusCode).toBe(401);
    });

    it('succeeds even with an invalid refresh token (idempotent)', async () => {
      const registerResult = await authService.register({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      const result = await authService.logout(
        registerResult.accountId!,
        'not-a-real-token',
      );

      expect(result.ok).toBe(true);
    });
  });

  // ── Access token verification ──────────────────────────────────

  describe('verifyAccessToken', () => {
    it('returns account ID for valid token', async () => {
      const result = await authService.register({
        email: 'player@cybaworld.com',
        password: 'securePass123',
      });

      const accountId = authService.verifyAccessToken(result.tokens!.accessToken);
      expect(accountId).toBe(result.accountId);
    });

    it('returns undefined for invalid token', () => {
      const result = authService.verifyAccessToken('invalid.jwt.token');
      expect(result).toBeUndefined();
    });

    it('returns undefined for expired token', () => {
      const expiredJwtService = new JwtService({
        secret: JWT_SECRET,
        signOptions: { expiresIn: '0s' },
      });
      const token = expiredJwtService.sign({ sub: 'test-id' });

      const result = authService.verifyAccessToken(token);
      expect(result).toBeUndefined();
    });
  });

  // ── Full lifecycle ─────────────────────────────────────────────

  describe('full lifecycle: register → login → refresh → logout', () => {
    it('completes the full auth cycle', async () => {
      // 1. Register
      const reg = await authService.register({
        email: 'lifecycle@cybaworld.com',
        password: 'lifecyclePass1',
      });
      expect(reg.ok).toBe(true);

      // 2. Login
      const login = await authService.login({
        email: 'lifecycle@cybaworld.com',
        password: 'lifecyclePass1',
      });
      expect(login.ok).toBe(true);

      // 3. Refresh
      const refresh = await authService.refresh(
        login.accountId!,
        login.tokens!.refreshToken,
      );
      expect(refresh.ok).toBe(true);

      // 4. Logout
      const logout = await authService.logout(
        refresh.accountId!,
        refresh.tokens!.refreshToken,
      );
      expect(logout.ok).toBe(true);

      // 5. Confirm refresh token is dead
      const postLogout = await authService.refresh(
        refresh.accountId!,
        refresh.tokens!.refreshToken,
      );
      expect(postLogout.ok).toBe(false);
    });
  });
});
