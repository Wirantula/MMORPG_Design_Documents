import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CurrencyService } from '../src/modules/currency/currency.service';
import { DomainEventBus } from '../src/common/domain-events';

function createCurrencyService() {
  const eventBus = new DomainEventBus();
  const service = new CurrencyService(eventBus);
  return { service, eventBus };
}

describe('CurrencyService', () => {
  let ctx: ReturnType<typeof createCurrencyService>;

  beforeEach(() => {
    ctx = createCurrencyService();
  });

  // ── Starter currencies ─────────────────────────────────────────

  it('seeds World Gold and Settlement Credit on construction', () => {
    const currencies = ctx.service.getCurrencies();
    const names = currencies.map((c) => c.name);
    expect(names).toContain('World Gold');
    expect(names).toContain('Settlement Credit');

    const primary = currencies.find((c) => c.isPrimary);
    expect(primary?.name).toBe('World Gold');
  });

  // ── seedWallet ─────────────────────────────────────────────────

  it('credits a wallet via seedWallet', () => {
    ctx.service.seedWallet('char-1', 500);
    expect(ctx.service.getBalance('char-1')).toBe(500);
  });

  it('rejects seedWallet with non-positive amount', () => {
    expect(() => ctx.service.seedWallet('char-1', 0)).toThrow('Amount must be positive');
    expect(() => ctx.service.seedWallet('char-1', -10)).toThrow('Amount must be positive');
  });

  it('rejects seedWallet for unknown currency', () => {
    expect(() => ctx.service.seedWallet('char-1', 100, 'fake-coin')).toThrow('Unknown currency');
  });

  // ── deductFee ──────────────────────────────────────────────────

  it('deducts a fee from a funded wallet', () => {
    ctx.service.seedWallet('char-1', 1000);
    ctx.service.deductFee('char-1', 200);
    expect(ctx.service.getBalance('char-1')).toBe(800);
  });

  it('rejects deductFee when balance is insufficient', () => {
    ctx.service.seedWallet('char-1', 50);
    expect(() => ctx.service.deductFee('char-1', 100)).toThrow('Insufficient balance');
    // Balance unchanged
    expect(ctx.service.getBalance('char-1')).toBe(50);
  });

  // ── transfer ──────────────────────────────────────────────────

  it('transfers funds between two characters', () => {
    ctx.service.seedWallet('alice', 1000);
    ctx.service.seedWallet('bob', 200);

    const tx = ctx.service.transfer({
      fromId: 'alice',
      toId: 'bob',
      currencyId: 'world-gold',
      amount: 300,
      reason: 'trade',
      idempotencyKey: 'tx-001',
    });

    expect(tx.amount).toBe(300);
    expect(ctx.service.getBalance('alice')).toBe(700);
    expect(ctx.service.getBalance('bob')).toBe(500);
  });

  it('rejects transfer with insufficient balance (overdraft protection)', () => {
    ctx.service.seedWallet('alice', 100);

    expect(() =>
      ctx.service.transfer({
        fromId: 'alice',
        toId: 'bob',
        currencyId: 'world-gold',
        amount: 500,
        reason: 'trade',
        idempotencyKey: 'tx-overdraft',
      }),
    ).toThrow('Insufficient balance');

    // Balances unchanged
    expect(ctx.service.getBalance('alice')).toBe(100);
    expect(ctx.service.getBalance('bob')).toBe(0);
  });

  it('rejects transfer to self', () => {
    ctx.service.seedWallet('alice', 1000);
    expect(() =>
      ctx.service.transfer({
        fromId: 'alice',
        toId: 'alice',
        currencyId: 'world-gold',
        amount: 100,
        reason: 'self',
        idempotencyKey: 'tx-self',
      }),
    ).toThrow('Cannot transfer to self');
  });

  it('rejects transfer with non-positive amount', () => {
    ctx.service.seedWallet('alice', 1000);
    expect(() =>
      ctx.service.transfer({
        fromId: 'alice',
        toId: 'bob',
        currencyId: 'world-gold',
        amount: 0,
        reason: 'zero',
        idempotencyKey: 'tx-zero',
      }),
    ).toThrow('Amount must be positive');
  });

  it('rejects transfer for unknown currency', () => {
    ctx.service.seedWallet('alice', 1000);
    expect(() =>
      ctx.service.transfer({
        fromId: 'alice',
        toId: 'bob',
        currencyId: 'nonexistent',
        amount: 100,
        reason: 'bad-currency',
        idempotencyKey: 'tx-bad-cur',
      }),
    ).toThrow('Unknown currency');
  });

  // ── Idempotency ───────────────────────────────────────────────

  it('replays a transfer idempotently without double-debiting', () => {
    ctx.service.seedWallet('alice', 1000);

    const tx1 = ctx.service.transfer({
      fromId: 'alice',
      toId: 'bob',
      currencyId: 'world-gold',
      amount: 250,
      reason: 'trade',
      idempotencyKey: 'idem-replay',
    });

    // Replay same idempotency key
    const tx2 = ctx.service.transfer({
      fromId: 'alice',
      toId: 'bob',
      currencyId: 'world-gold',
      amount: 250,
      reason: 'trade',
      idempotencyKey: 'idem-replay',
    });

    expect(tx1.id).toBe(tx2.id);
    expect(ctx.service.getBalance('alice')).toBe(750); // debited once, not twice
    expect(ctx.service.getBalance('bob')).toBe(250);
  });

  it('replays seedWallet idempotently', () => {
    ctx.service.seedWallet('char-1', 500, 'world-gold', 'reward', 'seed-key-1');
    ctx.service.seedWallet('char-1', 500, 'world-gold', 'reward', 'seed-key-1');
    expect(ctx.service.getBalance('char-1')).toBe(500); // credited once
  });

  it('replays deductFee idempotently', () => {
    ctx.service.seedWallet('char-1', 1000);
    ctx.service.deductFee('char-1', 200, 'world-gold', 'tax', 'fee-key-1');
    ctx.service.deductFee('char-1', 200, 'world-gold', 'tax', 'fee-key-1');
    expect(ctx.service.getBalance('char-1')).toBe(800); // deducted once
  });

  // ── Audit log ─────────────────────────────────────────────────

  it('records all transactions in the audit log', () => {
    ctx.service.seedWallet('alice', 1000);
    ctx.service.transfer({
      fromId: 'alice',
      toId: 'bob',
      currencyId: 'world-gold',
      amount: 300,
      reason: 'payment',
      idempotencyKey: 'audit-1',
    });

    const aliceLog = ctx.service.getTransactionLog('alice');
    expect(aliceLog.length).toBe(2); // seed + transfer
    expect(aliceLog[0].reason).toBe('system_seed');
    expect(aliceLog[1].reason).toBe('payment');

    const bobLog = ctx.service.getTransactionLog('bob');
    expect(bobLog.length).toBe(1);
    expect(bobLog[0].fromId).toBe('alice');
    expect(bobLog[0].toId).toBe('bob');
    expect(bobLog[0].amount).toBe(300);
  });

  // ── Wallet query ──────────────────────────────────────────────

  it('returns multi-currency wallet entries', () => {
    ctx.service.seedWallet('char-1', 500, 'world-gold');
    ctx.service.seedWallet('char-1', 100, 'settlement-credit');

    const wallet = ctx.service.getWallet('char-1');
    expect(wallet.length).toBe(2);

    const wg = wallet.find((w) => w.currencyId === 'world-gold');
    const sc = wallet.find((w) => w.currencyId === 'settlement-credit');
    expect(wg?.balance).toBe(500);
    expect(sc?.balance).toBe(100);
  });

  it('returns empty wallet for unknown character', () => {
    const wallet = ctx.service.getWallet('ghost');
    expect(wallet).toEqual([]);
  });

  // ── Domain event emission ─────────────────────────────────────

  it('emits CurrencyTransferred event on transfer', () => {
    const listener = vi.fn();
    ctx.eventBus.on('CurrencyTransferred', listener);

    ctx.service.seedWallet('alice', 1000);
    ctx.service.transfer({
      fromId: 'alice',
      toId: 'bob',
      currencyId: 'world-gold',
      amount: 100,
      reason: 'gift',
      idempotencyKey: 'evt-1',
    });

    // seedWallet emits 1, transfer emits 1 = 2 total
    expect(listener).toHaveBeenCalledTimes(2);

    const transferEvent = listener.mock.calls[1][0];
    expect(transferEvent.type).toBe('CurrencyTransferred');
    expect(transferEvent.payload.fromId).toBe('alice');
    expect(transferEvent.payload.toId).toBe('bob');
    expect(transferEvent.payload.amount).toBe(100);
    expect(transferEvent.payload.reason).toBe('gift');
  });
});
