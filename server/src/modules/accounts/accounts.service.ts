import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { Account, RefreshToken } from './accounts.types';

const BCRYPT_ROUNDS = 10;

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

/**
 * In-memory account store. Will be replaced by PostgreSQL persistence once
 * the DB connection layer lands.
 */
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  private readonly accounts = new Map<string, Account>();
  private readonly emailIndex = new Map<string, string>(); // email → account id
  private readonly refreshTokens = new Map<string, RefreshToken>();

  // ── Account CRUD ───────────────────────────────────────────────

  async createAccount(email: string, password: string): Promise<Account> {
    const normalised = email.trim().toLowerCase();

    if (this.emailIndex.has(normalised)) {
      throw new Error('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = new Date().toISOString();
    const account: Account = {
      id: randomUUID(),
      email: normalised,
      passwordHash,
      role: 'player',
      createdAt: now,
      updatedAt: now,
    };

    this.accounts.set(account.id, account);
    this.emailIndex.set(normalised, account.id);

    this.logger.log(`Account created: ${account.id}`, 'AccountsService');
    return account;
  }

  findByEmail(email: string): Account | undefined {
    const normalised = email.trim().toLowerCase();
    const id = this.emailIndex.get(normalised);
    return id ? this.accounts.get(id) : undefined;
  }

  findById(id: string): Account | undefined {
    return this.accounts.get(id);
  }

  async validatePassword(account: Account, password: string): Promise<boolean> {
    return bcrypt.compare(password, account.passwordHash);
  }

  // ── Refresh tokens ─────────────────────────────────────────────

  async storeRefreshToken(accountId: string, rawToken: string, expiresAt: string): Promise<RefreshToken> {
    const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);
    const record: RefreshToken = {
      id: nextId('rt'),
      accountId,
      tokenHash,
      expiresAt,
    };
    this.refreshTokens.set(record.id, record);
    return record;
  }

  async findValidRefreshToken(accountId: string, rawToken: string): Promise<RefreshToken | undefined> {
    const now = new Date().toISOString();
    for (const rt of this.refreshTokens.values()) {
      if (rt.accountId !== accountId) continue;
      if (rt.expiresAt <= now) continue;
      const matches = await bcrypt.compare(rawToken, rt.tokenHash);
      if (matches) return rt;
    }
    return undefined;
  }

  invalidateRefreshToken(tokenId: string): boolean {
    return this.refreshTokens.delete(tokenId);
  }

  invalidateAllRefreshTokens(accountId: string): number {
    let count = 0;
    for (const [id, rt] of this.refreshTokens.entries()) {
      if (rt.accountId === accountId) {
        this.refreshTokens.delete(id);
        count += 1;
      }
    }
    return count;
  }
}
