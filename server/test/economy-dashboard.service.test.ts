import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DashboardService } from '../src/modules/economy/dashboards/dashboard.service';
import { MarketService } from '../src/modules/economy/market.service';
import { ContractsService } from '../src/modules/economy/contracts/contracts.service';
import { DomainEventBus } from '../src/common/domain-events';
import { AppLogger } from '../src/common/logger.service';

function createServices() {
  const logger = new AppLogger();
  vi.spyOn(logger, 'log').mockImplementation(() => {});
  const eventBus = new DomainEventBus();
  const marketService = new MarketService(logger, eventBus);
  const contractsService = new ContractsService(logger, eventBus, marketService);
  const dashboardService = new DashboardService(logger, eventBus, marketService, contractsService);
  return { dashboardService, marketService, contractsService, eventBus, logger };
}

/** Helper: create a listing + order + match to generate price history. */
function executeTrade(
  ctx: ReturnType<typeof createServices>,
  opts: { canonicalId: string; price: number; quantity: number; gameDay: number },
) {
  ctx.marketService.createListing({
    sellerId: 'seller',
    itemInstanceId: `item-${Math.random()}`,
    canonicalId: opts.canonicalId,
    price: opts.price,
    quantity: opts.quantity,
    currentGameDay: opts.gameDay,
  });
  ctx.marketService.createOrder({
    buyerId: 'buyer',
    canonicalId: opts.canonicalId,
    maxPrice: opts.price,
    quantity: opts.quantity,
    currentGameDay: opts.gameDay,
  });
  ctx.marketService.matchOrders(opts.gameDay);
}

describe('DashboardService', () => {
  let ctx: ReturnType<typeof createServices>;

  beforeEach(() => {
    ctx = createServices();
    // Seed balances so trades succeed
    ctx.marketService.creditBalance('seller', 1_000_000);
    ctx.marketService.creditBalance('buyer', 1_000_000);
  });

  // ── Summary ───────────────────────────────────────────────────

  it('returns trade summary sorted by total value', () => {
    executeTrade(ctx, { canonicalId: 'iron-sword', price: 100, quantity: 5, gameDay: 1 });
    executeTrade(ctx, { canonicalId: 'gold-ring', price: 500, quantity: 2, gameDay: 1 });

    const summary = ctx.dashboardService.getSummary();

    expect(summary.length).toBe(2);
    // gold-ring has higher total value (1000 vs 500)
    expect(summary[0].canonicalId).toBe('gold-ring');
    expect(summary[0].totalValue).toBe(1000);
    expect(summary[1].canonicalId).toBe('iron-sword');
  });

  // ── Sinks ─────────────────────────────────────────────────────

  it('reports total fees as sink', () => {
    executeTrade(ctx, { canonicalId: 'iron-sword', price: 1000, quantity: 1, gameDay: 1 });

    const sinks = ctx.dashboardService.getSinks(1);
    expect(sinks.totalFees).toBeGreaterThan(0);
  });

  // ── Faucets ───────────────────────────────────────────────────

  it('reports faucet totals', () => {
    ctx.dashboardService.recordFaucetReward(500);
    ctx.dashboardService.recordFaucetNpcPurchase(200);

    const faucets = ctx.dashboardService.getFaucets(1);
    expect(faucets.totalRewards).toBe(500);
    expect(faucets.totalNpcPurchases).toBe(200);
  });

  // ── Shortage detection ────────────────────────────────────────

  it('detects shortage when no active listings exist for 3+ game days', () => {
    // Execute a trade on day 1
    executeTrade(ctx, { canonicalId: 'iron-sword', price: 100, quantity: 1, gameDay: 1 });

    // Check at day 5 (4 days since last trade, no active listings)
    const alerts = ctx.dashboardService.detectShortages(5);
    expect(alerts.length).toBe(1);
    expect(alerts[0].canonicalId).toBe('iron-sword');
    expect(alerts[0].daysSinceLastListing).toBe(4);
  });

  it('does not flag shortage when active listings exist', () => {
    executeTrade(ctx, { canonicalId: 'iron-sword', price: 100, quantity: 1, gameDay: 1 });

    // Create a new listing that won't be matched
    ctx.marketService.createListing({
      sellerId: 'seller',
      itemInstanceId: 'item-new',
      canonicalId: 'iron-sword',
      price: 100,
      quantity: 1,
      currentGameDay: 2,
    });

    const alerts = ctx.dashboardService.detectShortages(5);
    expect(alerts.length).toBe(0);
  });

  // ── Inflation detection ───────────────────────────────────────

  it('detects inflation when price rises > 50% in 7 game days', () => {
    executeTrade(ctx, { canonicalId: 'iron-sword', price: 100, quantity: 1, gameDay: 1 });
    executeTrade(ctx, { canonicalId: 'iron-sword', price: 200, quantity: 1, gameDay: 5 });

    const alerts = ctx.dashboardService.detectInflation(8);
    expect(alerts.length).toBe(1);
    expect(alerts[0].canonicalId).toBe('iron-sword');
    expect(alerts[0].priceChangePercent).toBe(100);
  });

  it('does not flag inflation for modest price increases', () => {
    executeTrade(ctx, { canonicalId: 'iron-sword', price: 100, quantity: 1, gameDay: 1 });
    executeTrade(ctx, { canonicalId: 'iron-sword', price: 120, quantity: 1, gameDay: 5 });

    const alerts = ctx.dashboardService.detectInflation(8);
    expect(alerts.length).toBe(0);
  });

  // ── Export ─────────────────────────────────────────────────────

  it('exports a report file and emits EconomyExportCompleted event', () => {
    const listener = vi.fn();
    ctx.eventBus.on('EconomyExportCompleted', listener);

    executeTrade(ctx, { canonicalId: 'iron-sword', price: 100, quantity: 1, gameDay: 1 });

    const filePath = ctx.dashboardService.exportReport(1);

    expect(filePath).toContain('economy_report_day_1');
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].payload.gameDay).toBe(1);
  });
});
