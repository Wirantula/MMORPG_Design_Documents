import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type CurrencyTransferred,
} from '../../common/domain-events';
import type {
  Currency,
  WalletEntry,
  TransferParams,
  CurrencyTransaction,
} from './currency.types';

const DEFAULT_CURRENCY = 'world-gold';

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  // ── In-memory stores (mirrors DB schema) ──────────────────────
  private readonly currencies = new Map<string, Currency>();
  // walletKey = `${characterId}:${currencyId}`
  private readonly wallets = new Map<string, number>();
  private readonly transactions: CurrencyTransaction[] = [];
  private readonly idempotencyIndex = new Set<string>();

  constructor(private readonly eventBus: DomainEventBus) {
    // Seed starter currencies matching 035_create_currency.sql
    this.currencies.set('world-gold', {
      id: 'world-gold',
      name: 'World Gold',
      symbol: 'WG',
      issuerType: 'world',
      isPrimary: true,
    });
    this.currencies.set('settlement-credit', {
      id: 'settlement-credit',
      name: 'Settlement Credit',
      symbol: 'SC',
      issuerType: 'settlement',
      isPrimary: false,
    });
  }

  // ── Queries ───────────────────────────────────────────────────

  getCurrencies(): Currency[] {
    return [...this.currencies.values()];
  }

  getBalance(characterId: string, currencyId: string = DEFAULT_CURRENCY): number {
    return this.wallets.get(`${characterId}:${currencyId}`) ?? 0;
  }

  getWallet(characterId: string): WalletEntry[] {
    const entries: WalletEntry[] = [];
    for (const [key, balance] of this.wallets.entries()) {
      if (key.startsWith(`${characterId}:`)) {
        const currencyId = key.slice(characterId.length + 1);
        entries.push({ currencyId, balance });
      }
    }
    return entries;
  }

  getTransactionLog(characterId: string): CurrencyTransaction[] {
    return this.transactions.filter(
      (tx) => tx.fromId === characterId || tx.toId === characterId,
    );
  }

  // ── Mutations ─────────────────────────────────────────────────

  /**
   * Seed (credit) a wallet — used for system grants, rewards, etc.
   * `fromId` is null (minted from system).
   */
  seedWallet(
    characterId: string,
    amount: number,
    currencyId: string = DEFAULT_CURRENCY,
    reason: string = 'system_seed',
    idempotencyKey?: string,
  ): CurrencyTransaction {
    if (amount <= 0) throw new Error('Amount must be positive');
    if (!this.currencies.has(currencyId)) {
      throw new Error(`Unknown currency: ${currencyId}`);
    }

    const key = idempotencyKey ?? nextId('idem');

    // Idempotency check — replay returns existing transaction
    const existing = this.findByIdempotencyKey(key);
    if (existing) return existing;

    const walletKey = `${characterId}:${currencyId}`;
    this.wallets.set(walletKey, (this.wallets.get(walletKey) ?? 0) + amount);

    const tx = this.recordTransaction({
      fromId: null,
      toId: characterId,
      currencyId,
      amount,
      reason,
      idempotencyKey: key,
    });

    this.emitTransferEvent(tx);
    return tx;
  }

  /**
   * Deduct a fee — used for listing fees, taxes, etc.
   * `toId` is null (burned / sent to system sink).
   */
  deductFee(
    characterId: string,
    amount: number,
    currencyId: string = DEFAULT_CURRENCY,
    reason: string = 'fee',
    idempotencyKey?: string,
  ): CurrencyTransaction {
    if (amount <= 0) throw new Error('Amount must be positive');
    if (!this.currencies.has(currencyId)) {
      throw new Error(`Unknown currency: ${currencyId}`);
    }

    const key = idempotencyKey ?? nextId('idem');

    const existing = this.findByIdempotencyKey(key);
    if (existing) return existing;

    const walletKey = `${characterId}:${currencyId}`;
    const current = this.wallets.get(walletKey) ?? 0;
    if (current < amount) {
      throw new Error('Insufficient balance');
    }
    this.wallets.set(walletKey, current - amount);

    const tx = this.recordTransaction({
      fromId: characterId,
      toId: null,
      currencyId,
      amount,
      reason,
      idempotencyKey: key,
    });

    this.emitTransferEvent(tx);
    return tx;
  }

  /**
   * Atomic character-to-character transfer.
   * Debit sender, credit receiver, record single transaction, emit event.
   * Idempotency: duplicate key returns existing tx without re-executing.
   */
  transfer(params: TransferParams): CurrencyTransaction {
    const { fromId, toId, currencyId, amount, reason, idempotencyKey } = params;

    if (amount <= 0) throw new Error('Amount must be positive');
    if (fromId === toId) throw new Error('Cannot transfer to self');
    if (!this.currencies.has(currencyId)) {
      throw new Error(`Unknown currency: ${currencyId}`);
    }

    // Idempotency — replay returns existing transaction
    const existing = this.findByIdempotencyKey(idempotencyKey);
    if (existing) return existing;

    // Debit sender (overdraft protection)
    const senderKey = `${fromId}:${currencyId}`;
    const senderBalance = this.wallets.get(senderKey) ?? 0;
    if (senderBalance < amount) {
      throw new Error('Insufficient balance');
    }
    this.wallets.set(senderKey, senderBalance - amount);

    // Credit receiver
    const receiverKey = `${toId}:${currencyId}`;
    this.wallets.set(
      receiverKey,
      (this.wallets.get(receiverKey) ?? 0) + amount,
    );

    const tx = this.recordTransaction({
      fromId,
      toId,
      currencyId,
      amount,
      reason,
      idempotencyKey,
    });

    this.emitTransferEvent(tx);
    return tx;
  }

  // ── Internal helpers ──────────────────────────────────────────

  private findByIdempotencyKey(key: string): CurrencyTransaction | undefined {
    if (!this.idempotencyIndex.has(key)) return undefined;
    return this.transactions.find((tx) => tx.idempotencyKey === key);
  }

  private recordTransaction(params: {
    fromId: string | null;
    toId: string | null;
    currencyId: string;
    amount: number;
    reason: string;
    idempotencyKey: string;
  }): CurrencyTransaction {
    const tx: CurrencyTransaction = {
      id: nextId('ctx'),
      fromId: params.fromId,
      toId: params.toId,
      currencyId: params.currencyId,
      amount: params.amount,
      reason: params.reason,
      idempotencyKey: params.idempotencyKey,
      createdAt: new Date().toISOString(),
    };
    this.transactions.push(tx);
    this.idempotencyIndex.add(params.idempotencyKey);

    // Observability: log transfer (never log idempotency keys per story spec)
    this.logger.log(
      `Transfer: from=${params.fromId ?? 'SYSTEM'} to=${params.toId ?? 'SINK'} amount=${params.amount} currency=${params.currencyId} reason=${params.reason}`,
    );

    return tx;
  }

  private emitTransferEvent(tx: CurrencyTransaction): void {
    const event: CurrencyTransferred = {
      eventId: generateEventId(),
      type: 'CurrencyTransferred',
      timestamp: new Date().toISOString(),
      payload: {
        transactionId: tx.id,
        fromId: tx.fromId,
        toId: tx.toId,
        currencyId: tx.currencyId,
        amount: tx.amount,
        reason: tx.reason,
      },
    };
    this.eventBus.emit(event);
  }
}
