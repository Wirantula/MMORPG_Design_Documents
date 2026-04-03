import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ContractsService } from '../src/modules/economy/contracts/contracts.service';
import { MarketService } from '../src/modules/economy/market.service';
import { DomainEventBus } from '../src/common/domain-events';

function createServices() {
  const eventBus = new DomainEventBus();
  const marketService = new MarketService(eventBus);
  const contractsService = new ContractsService(eventBus, marketService);
  return { contractsService, marketService, eventBus };
}

describe('ContractsService', () => {
  let ctx: ReturnType<typeof createServices>;

  beforeEach(() => {
    ctx = createServices();
  });

  // ── Contract creation ─────────────────────────────────────────

  it('creates a contract and locks escrow', () => {
    ctx.marketService.creditBalance('offerer-1', 5000);

    const contract = ctx.contractsService.createContract({
      type: 'work',
      offererId: 'offerer-1',
      termsJson: { task: 'deliver goods' },
      escrowAmount: 1000,
      deadlineGameDay: 30,
      currentGameDay: 1,
    });

    expect(contract.status).toBe('open');
    expect(contract.escrowAmount).toBe(1000);
    expect(ctx.marketService.getBalance('offerer-1')).toBe(4000);
  });

  it('rejects contract when offerer cannot cover escrow', () => {
    expect(() =>
      ctx.contractsService.createContract({
        type: 'delivery',
        offererId: 'broke-offerer',
        termsJson: {},
        escrowAmount: 500,
        deadlineGameDay: 10,
        currentGameDay: 1,
      }),
    ).toThrow('Insufficient balance');
  });

  it('allows zero-escrow contracts', () => {
    const contract = ctx.contractsService.createContract({
      type: 'construction',
      offererId: 'offerer-1',
      termsJson: { milestone: 'build wall' },
      escrowAmount: 0,
      deadlineGameDay: 60,
      currentGameDay: 1,
    });

    expect(contract.status).toBe('open');
    expect(contract.escrowAmount).toBe(0);
  });

  // ── Accept ────────────────────────────────────────────────────

  it('accepts an open contract', () => {
    ctx.marketService.creditBalance('offerer-1', 5000);

    const contract = ctx.contractsService.createContract({
      type: 'work',
      offererId: 'offerer-1',
      termsJson: {},
      escrowAmount: 100,
      deadlineGameDay: 30,
      currentGameDay: 1,
    });

    const accepted = ctx.contractsService.acceptContract(contract.id, 'acceptor-1');
    expect(accepted.status).toBe('accepted');
    expect(accepted.acceptorId).toBe('acceptor-1');
  });

  it('rejects self-acceptance', () => {
    ctx.marketService.creditBalance('offerer-1', 5000);

    const contract = ctx.contractsService.createContract({
      type: 'work',
      offererId: 'offerer-1',
      termsJson: {},
      escrowAmount: 100,
      deadlineGameDay: 30,
      currentGameDay: 1,
    });

    expect(() =>
      ctx.contractsService.acceptContract(contract.id, 'offerer-1'),
    ).toThrow('Cannot accept your own contract');
  });

  // ── Complete ──────────────────────────────────────────────────

  it('completes contract and releases escrow to acceptor', () => {
    const listener = vi.fn();
    ctx.eventBus.on('ContractCompleted', listener);

    ctx.marketService.creditBalance('offerer-1', 5000);

    const contract = ctx.contractsService.createContract({
      type: 'work',
      offererId: 'offerer-1',
      termsJson: {},
      escrowAmount: 1000,
      deadlineGameDay: 30,
      currentGameDay: 1,
    });

    ctx.contractsService.acceptContract(contract.id, 'acceptor-1');
    const completed = ctx.contractsService.completeContract(contract.id);

    expect(completed.status).toBe('completed');
    expect(ctx.marketService.getBalance('acceptor-1')).toBe(1000);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].payload.escrowAmount).toBe(1000);
  });

  it('rejects completion of non-accepted contract', () => {
    ctx.marketService.creditBalance('offerer-1', 5000);

    const contract = ctx.contractsService.createContract({
      type: 'work',
      offererId: 'offerer-1',
      termsJson: {},
      escrowAmount: 100,
      deadlineGameDay: 30,
      currentGameDay: 1,
    });

    expect(() =>
      ctx.contractsService.completeContract(contract.id),
    ).toThrow('not in accepted state');
  });

  // ── Breach ────────────────────────────────────────────────────

  it('breaches contract and releases escrow to non-breaching party (acceptor breaches)', () => {
    const listener = vi.fn();
    ctx.eventBus.on('ContractBreached', listener);

    ctx.marketService.creditBalance('offerer-1', 5000);

    const contract = ctx.contractsService.createContract({
      type: 'delivery',
      offererId: 'offerer-1',
      termsJson: {},
      escrowAmount: 500,
      deadlineGameDay: 30,
      currentGameDay: 1,
    });

    ctx.contractsService.acceptContract(contract.id, 'acceptor-1');
    const breached = ctx.contractsService.breachContract(contract.id, 'acceptor-1');

    expect(breached.status).toBe('breached');
    // Escrow returned to offerer (non-breaching party): 5000 - 500 (locked) + 500 (returned) = 5000
    expect(ctx.marketService.getBalance('offerer-1')).toBe(5000);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].payload.nonBreachingId).toBe('offerer-1');
  });

  it('breaches contract and releases escrow to acceptor when offerer breaches', () => {
    ctx.marketService.creditBalance('offerer-1', 5000);

    const contract = ctx.contractsService.createContract({
      type: 'construction',
      offererId: 'offerer-1',
      termsJson: {},
      escrowAmount: 500,
      deadlineGameDay: 30,
      currentGameDay: 1,
    });

    ctx.contractsService.acceptContract(contract.id, 'acceptor-1');
    ctx.contractsService.breachContract(contract.id, 'offerer-1');

    expect(ctx.marketService.getBalance('acceptor-1')).toBe(500);
  });

  // ── Queries ───────────────────────────────────────────────────

  it('tracks active contract count', () => {
    ctx.marketService.creditBalance('offerer-1', 50_000);

    ctx.contractsService.createContract({
      type: 'work',
      offererId: 'offerer-1',
      termsJson: {},
      escrowAmount: 0,
      deadlineGameDay: 30,
      currentGameDay: 1,
    });

    ctx.contractsService.createContract({
      type: 'delivery',
      offererId: 'offerer-1',
      termsJson: {},
      escrowAmount: 0,
      deadlineGameDay: 30,
      currentGameDay: 1,
    });

    expect(ctx.contractsService.getActiveContractCount()).toBe(2);
  });
});
