import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MarketService } from '../src/modules/economy/market.service';
import { DomainEventBus } from '../src/common/domain-events';

function createMarketService() {
  const eventBus = new DomainEventBus();
  const service = new MarketService(eventBus);
  return { service, eventBus };
}

describe('MarketService', () => {
  let ctx: ReturnType<typeof createMarketService>;

  beforeEach(() => {
    ctx = createMarketService();
  });

  // ── Listing creation ──────────────────────────────────────────

  it('creates a listing and deducts 1% fee', () => {
    ctx.service.creditBalance('seller-1', 10_000);

    const listing = ctx.service.createListing({
      sellerId: 'seller-1',
      itemInstanceId: 'item-1',
      canonicalId: 'iron-sword',
      price: 100,
      quantity: 5,
      currentGameDay: 1,
    });

    expect(listing.status).toBe('active');
    expect(listing.fee).toBe(5); // ceil(100 * 5 * 0.01) = 5
    expect(ctx.service.getBalance('seller-1')).toBe(9_995);
  });

  it('rejects listing when seller has insufficient balance for fee', () => {
    expect(() =>
      ctx.service.createListing({
        sellerId: 'broke-seller',
        itemInstanceId: 'item-1',
        canonicalId: 'iron-sword',
        price: 100,
        quantity: 1,
        currentGameDay: 1,
      }),
    ).toThrow('Insufficient balance');
  });

  it('rejects price <= 0', () => {
    ctx.service.creditBalance('seller-1', 10_000);
    expect(() =>
      ctx.service.createListing({
        sellerId: 'seller-1',
        itemInstanceId: 'item-1',
        canonicalId: 'iron-sword',
        price: 0,
        quantity: 1,
        currentGameDay: 1,
      }),
    ).toThrow('Price must be positive');
  });

  // ── Anti-spam ─────────────────────────────────────────────────

  it('enforces max 20 active listings per character', () => {
    ctx.service.creditBalance('spammer', 1_000_000);

    for (let i = 0; i < 20; i++) {
      ctx.service.createListing({
        sellerId: 'spammer',
        itemInstanceId: `item-${i}`,
        canonicalId: 'iron-sword',
        price: 10,
        quantity: 1,
        currentGameDay: 1,
      });
    }

    expect(() =>
      ctx.service.createListing({
        sellerId: 'spammer',
        itemInstanceId: 'item-21',
        canonicalId: 'iron-sword',
        price: 10,
        quantity: 1,
        currentGameDay: 1,
      }),
    ).toThrow('maximum of 20');
  });

  // ── Order creation ────────────────────────────────────────────

  it('creates a buy order', () => {
    const order = ctx.service.createOrder({
      buyerId: 'buyer-1',
      canonicalId: 'iron-sword',
      maxPrice: 150,
      quantity: 3,
      currentGameDay: 1,
    });

    expect(order.status).toBe('active');
    expect(order.maxPrice).toBe(150);
  });

  // ── Order matching ────────────────────────────────────────────

  it('matches best ask with best bid and records price history', () => {
    const listener = vi.fn();
    ctx.eventBus.on('MarketTradeExecuted', listener);

    ctx.service.creditBalance('seller-1', 10_000);
    ctx.service.creditBalance('buyer-1', 10_000);

    ctx.service.createListing({
      sellerId: 'seller-1',
      itemInstanceId: 'item-a',
      canonicalId: 'iron-sword',
      price: 100,
      quantity: 2,
      currentGameDay: 1,
    });

    ctx.service.createOrder({
      buyerId: 'buyer-1',
      canonicalId: 'iron-sword',
      maxPrice: 120,
      quantity: 2,
      currentGameDay: 1,
    });

    const matchCount = ctx.service.matchOrders(1);

    expect(matchCount).toBe(1);
    expect(listener).toHaveBeenCalledOnce();

    const tradeEvent = listener.mock.calls[0][0];
    expect(tradeEvent.payload.price).toBe(100);
    expect(tradeEvent.payload.quantity).toBe(2);

    // Price history recorded
    const history = ctx.service.getPriceHistory('iron-sword');
    expect(history.length).toBe(1);
    expect(history[0].price).toBe(100);
  });

  it('does not match when order max price is below listing price', () => {
    ctx.service.creditBalance('seller-1', 10_000);
    ctx.service.creditBalance('buyer-1', 10_000);

    ctx.service.createListing({
      sellerId: 'seller-1',
      itemInstanceId: 'item-a',
      canonicalId: 'iron-sword',
      price: 200,
      quantity: 1,
      currentGameDay: 1,
    });

    ctx.service.createOrder({
      buyerId: 'buyer-1',
      canonicalId: 'iron-sword',
      maxPrice: 100,
      quantity: 1,
      currentGameDay: 1,
    });

    const matchCount = ctx.service.matchOrders(1);
    expect(matchCount).toBe(0);
  });

  it('skips match when buyer has insufficient balance', () => {
    ctx.service.creditBalance('seller-1', 10_000);
    ctx.service.creditBalance('buyer-1', 50); // not enough

    ctx.service.createListing({
      sellerId: 'seller-1',
      itemInstanceId: 'item-a',
      canonicalId: 'iron-sword',
      price: 100,
      quantity: 1,
      currentGameDay: 1,
    });

    ctx.service.createOrder({
      buyerId: 'buyer-1',
      canonicalId: 'iron-sword',
      maxPrice: 100,
      quantity: 1,
      currentGameDay: 1,
    });

    const matchCount = ctx.service.matchOrders(1);
    expect(matchCount).toBe(0);
  });

  // ── Listing expiry ────────────────────────────────────────────

  it('expires listings past their expiry day', () => {
    ctx.service.creditBalance('seller-1', 10_000);

    ctx.service.createListing({
      sellerId: 'seller-1',
      itemInstanceId: 'item-a',
      canonicalId: 'iron-sword',
      price: 100,
      quantity: 1,
      currentGameDay: 1,
      expiresAtGameDay: 5,
    });

    // Tick at day 5 should expire
    ctx.service.matchOrders(5);
    const active = ctx.service.getActiveListings('iron-sword');
    expect(active.length).toBe(0);
  });

  // ── Price history cap ─────────────────────────────────────────

  it('caps price history to 30 entries per canonical item', () => {
    ctx.service.creditBalance('seller-1', 1_000_000);
    ctx.service.creditBalance('buyer-1', 1_000_000);

    for (let i = 0; i < 35; i++) {
      ctx.service.createListing({
        sellerId: 'seller-1',
        itemInstanceId: `item-${i}`,
        canonicalId: 'iron-sword',
        price: 10,
        quantity: 1,
        currentGameDay: i,
      });

      ctx.service.createOrder({
        buyerId: 'buyer-1',
        canonicalId: 'iron-sword',
        maxPrice: 10,
        quantity: 1,
        currentGameDay: i,
      });

      ctx.service.matchOrders(i);
    }

    const history = ctx.service.getPriceHistory('iron-sword');
    expect(history.length).toBe(30);
  });

  // ── Fee calculation ───────────────────────────────────────────

  it('accumulates total fees collected', () => {
    ctx.service.creditBalance('seller-1', 100_000);

    ctx.service.createListing({
      sellerId: 'seller-1',
      itemInstanceId: 'item-a',
      canonicalId: 'iron-sword',
      price: 1000,
      quantity: 10,
      currentGameDay: 1,
    });

    // fee = ceil(1000 * 10 * 0.01) = 100
    expect(ctx.service.getTotalFeesCollected()).toBe(100);
  });
});
