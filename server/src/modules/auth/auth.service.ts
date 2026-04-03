import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { AccountsService } from '../accounts/accounts.service';
import {
  DomainEventBus,
  generateEventId,
  type AccountCreated,
  type AccountLoggedIn,
} from '../../common/domain-events';
import type { RegisterDto, LoginDto } from './auth.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  statusCode?: number;
  tokens?: TokenPair;
  accountId?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly accountsService: AccountsService,
    private readonly jwtService: JwtService,
    private readonly eventBus: DomainEventBus,
  ) {}

  // ── Register ───────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthResult> {
    try {
      const account = await this.accountsService.createAccount(dto.email, dto.password);

      // Emit AccountCreated domain event
      const event: AccountCreated = {
        eventId: generateEventId(),
        type: 'AccountCreated',
        timestamp: new Date().toISOString(),
        payload: { accountId: account.id },
      };
      this.eventBus.emit(event);

      this.logger.log(`AccountCreated: ${account.id}`, 'AuthService');

      const tokens = await this.issueTokens(account.id);
      return { ok: true, tokens, accountId: account.id };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      if (message === 'Email already registered') {
        return { ok: false, error: message, statusCode: 409 };
      }
      return { ok: false, error: message, statusCode: 500 };
    }
  }

  // ── Login ──────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<AuthResult> {
    const account = this.accountsService.findByEmail(dto.email);
    if (!account) {
      return { ok: false, error: 'Invalid email or password', statusCode: 401 };
    }

    const valid = await this.accountsService.validatePassword(account, dto.password);
    if (!valid) {
      return { ok: false, error: 'Invalid email or password', statusCode: 401 };
    }

    // Emit AccountLoggedIn domain event
    const event: AccountLoggedIn = {
      eventId: generateEventId(),
      type: 'AccountLoggedIn',
      timestamp: new Date().toISOString(),
      payload: { accountId: account.id },
    };
    this.eventBus.emit(event);

    this.logger.log(`AccountLoggedIn: ${account.id}`, 'AuthService');

    const tokens = await this.issueTokens(account.id);
    return { ok: true, tokens, accountId: account.id };
  }

  // ── Refresh ────────────────────────────────────────────────────

  async refresh(accountId: string, rawRefreshToken: string): Promise<AuthResult> {
    const existing = await this.accountsService.findValidRefreshToken(accountId, rawRefreshToken);
    if (!existing) {
      return { ok: false, error: 'Invalid or expired refresh token', statusCode: 401 };
    }

    // Rotate: invalidate old token and issue new pair
    this.accountsService.invalidateRefreshToken(existing.id);
    const tokens = await this.issueTokens(accountId);
    return { ok: true, tokens, accountId };
  }

  // ── Logout ─────────────────────────────────────────────────────

  async logout(accountId: string, rawRefreshToken: string): Promise<AuthResult> {
    const existing = await this.accountsService.findValidRefreshToken(accountId, rawRefreshToken);
    if (existing) {
      this.accountsService.invalidateRefreshToken(existing.id);
    }
    return { ok: true };
  }

  // ── Token helpers ──────────────────────────────────────────────

  private async issueTokens(accountId: string): Promise<TokenPair> {
    const accessToken = this.jwtService.sign({ sub: accountId });
    const refreshToken = randomUUID();

    // Store refresh token with 7-day expiry
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.accountsService.storeRefreshToken(accountId, refreshToken, expiresAt);

    return { accessToken, refreshToken };
  }

  /** Verify and decode an access token. Returns the account ID or undefined. */
  verifyAccessToken(token: string): string | undefined {
    try {
      const payload = this.jwtService.verify(token) as { sub?: string };
      return payload.sub;
    } catch {
      return undefined;
    }
  }
}
