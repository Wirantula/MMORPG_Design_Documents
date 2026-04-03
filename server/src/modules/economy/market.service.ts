import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type MarketTradeExecuted,
} from '../../common/domain-events';
import type {
  MarketListing,
  MarketOrder,
  PriceHistoryEntry,
  EconomyMetricsSnapshot,
} from './economy.types';

const MAX_ACTIVE_LISTINGS_PER_CHARACTER = 20;
const LISTING_FEE_RATE = 0.01; // 1 %
const MAX_PRICE_HISTORY_PER_ITEM = 30;
const DEFAULT_LISTING_DURATION_DAYS = 30;

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  // ── In-memory stores ──────────────────────────────────────────
  private readonly listings = new Map<string, MarketListing>();
  private readonly orders = new Map<string, MarketOrder>();
  private readonly priceHistory = new Map<string, PriceHistoryEntry[]>();
  private readonly balances = new Map<string, number>();

  private totalTradeCount = 0;
  private totalFeesCollected = 0;

  constructor(
    private readonly eventBus: DomainEventBus,
  ) {}

  // ── Balance helpers (placeholder until accounts module exists) ─
  getBalance(characterId: string): number {
    return this.balances.get(characterId) ?? 0;
  }

  creditBalance(characterId: string, amount: number): void {
    this.balances.set(characterId, this.getBalance(characterId) + amount);
  }

  debitBalance(characterId: string, amount: number): boolean {
    const current = this.getBalance(characterId);
    if (current < amount) return false;
    this.balances.set(characterId, current - amount);
    return true;
  }

  // ── Listings ──────────────────────────────────────────────────

  createListing(params: {
    sellerId: string;
    itemInstanceId: string;
    canonicalId: string;
    price: number;
    quantity: number;
    currentGameDay: number;
    expiresAtGameDay?: number;
  }): MarketListing {
    // Anti-spam check
    const activeCount = this.getActiveListingsForCharacter(params.sellerId).length;
    if (activeCount >= MAX_ACTIVE_LISTINGS_PER_CHARACTER) {
      throw new Error(
        `Character ${params.sellerId} has reached the maximum of ${MAX_ACTIVE_LISTINGS_PER_CHARACTER} active listings`,
      );
    }

    if (params.price <= 0) throw new Error('Price must be positive');
    if (params.quantity <= 0) throw new Error('Quantity must be positive');

    const fee = Math.ceil(params.price * params.quantity * LISTING_FEE_RATE);

    // Debit fee from seller
    if (!this.debitBalance(params.sellerId, fee)) {
      throw new Error('Insufficient balance to cover listing fee');
    }

    this.totalFeesCollected += fee;

    const listing: MarketListing = {
      id: nextId('lst'),
      sellerId: params.sellerId,
      itemInstanceId: params.itemInstanceId,
      canonicalId: params.canonicalId,
      price: params.price,
      quantity: params.quantity,
      fee,
      status: 'active',
      createdAtGameDay: params.currentGameDay,
      expiresAtGameDay:
        params.expiresAtGameDay ?? params.currentGameDay + DEFAULT_LISTING_DURATION_DAYS,
    };

    this.listings.set(listing.id, listing);

    this.logger.log(
      `Listing ${listing.id} created by ${params.sellerId} for ${params.canonicalId} @ ${params.price}`,
      'MarketService',
    );

    return listing;
  }

  // ── Orders ────────────────────────────────────────────────────

  createOrder(params: {
    buyerId: string;
    canonicalId: string;
    maxPrice: number;
    quantity: number;
    currentGameDay: number;
  }): MarketOrder {
    if (params.maxPrice <= 0) throw new Error('Max price must be positive');
    if (params.quantity <= 0) throw new Error('Quantity must be positive');

    const order: MarketOrder = {
      id: nextId('ord'),
      buyerId: params.buyerId,
      canonicalId: params.canonicalId,
      maxPrice: params.maxPrice,
      quantity: params.quantity,
      status: 'active',
      createdAtGameDay: params.currentGameDay,
    };

    this.orders.set(order.id, order);

    this.logger.log(
      `Order ${order.id} placed by ${params.buyerId} for ${params.canonicalId} max ${params.maxPrice}`,
      'MarketService',
    );

    return order;
  }

  // ── Matching ──────────────────────────────────────────────────

  matchOrders(currentGameDay: number): number {
    // Expire old listings
    for (const listing of this.listings.values()) {
      if (listing.status === 'active' && listing.expiresAtGameDay <= currentGameDay) {
        listing.status = 'expired';
      }
    }

    let matchCount = 0;

    // Group active listings by canonical ID
    const listingsByCanonical = new Map<string, MarketListing[]>();
    for (const listing of this.listings.values()) {
      if (listing.status !== 'active') continue;
      const group = listingsByCanonical.get(listing.canonicalId) ?? [];
      group.push(listing);
      listingsByCanonical.set(listing.canonicalId, group);
    }

    for (const order of this.orders.values()) {
      if (order.status !== 'active') continue;

      const candidates = listingsByCanonical.get(order.canonicalId);
      if (!candidates || candidates.length === 0) continue;

      // Sort by price ascending (best ask first)
      candidates.sort((a, b) => a.price - b.price);

      for (const listing of candidates) {
        if (listing.status !== 'active') continue;
        if (listing.price > order.maxPrice) break; // sorted — no cheaper available

        // Execute trade
        const tradeQty = Math.min(listing.quantity, order.quantity);
        const tradePrice = listing.price;
        const tradeCost = tradePrice * tradeQty;

        // Debit buyer
        if (!this.debitBalance(order.buyerId, tradeCost)) continue;

        // Credit seller (fee already deducted at listing time)
        this.creditBalance(listing.sellerId, tradeCost);

        // Adjust quantities
        listing.quantity -= tradeQty;
        order.quantity -= tradeQty;

        if (listing.quantity <= 0) listing.status = 'fulfilled';
        if (order.quantity <= 0) order.status = 'fulfilled';

        // Record price history
        this.recordPriceHistory({
          canonicalId: listing.canonicalId,
          price: tradePrice,
          quantity: tradeQty,
          tradedAtGameDay: currentGameDay,
          timestamp: new Date().toISOString(),
        });

        // Emit domain event
        const event: MarketTradeExecuted = {
          eventId: generateEventId(),
          type: 'MarketTradeExecuted',
          timestamp: new Date().toISOString(),
          payload: {
            listingId: listing.id,
            orderId: order.id,
            canonicalId: listing.canonicalId,
            sellerId: listing.sellerId,
            buyerId: order.buyerId,
            price: tradePrice,
            quantity: tradeQty,
            fee: listing.fee,
          },
        };
        this.eventBus.emit(event);

        matchCount += 1;
        this.totalTradeCount += 1;

        this.logger.log(
          `Trade: ${listing.canonicalId} x${tradeQty} @ ${tradePrice} (${listing.sellerId} -> ${order.buyerId})`,
          'MarketService',
        );

        if (order.quantity <= 0) break;
      }
    }

    return matchCount;
  }

  // ── Price history ─────────────────────────────────────────────

  private recordPriceHistory(entry: PriceHistoryEntry): void {
    const history = this.priceHistory.get(entry.canonicalId) ?? [];
    history.push(entry);
    // Keep only last N entries
    if (history.length > MAX_PRICE_HISTORY_PER_ITEM) {
      history.splice(0, history.length - MAX_PRICE_HISTORY_PER_ITEM);
    }
    this.priceHistory.set(entry.canonicalId, history);
  }

  getPriceHistory(canonicalId: string): PriceHistoryEntry[] {
    return [...(this.priceHistory.get(canonicalId) ?? [])];
  }

  // ── Queries ───────────────────────────────────────────────────

  getActiveListings(canonicalId?: string): MarketListing[] {
    const results: MarketListing[] = [];
    for (const listing of this.listings.values()) {
      if (listing.status !== 'active') continue;
      if (canonicalId && listing.canonicalId !== canonicalId) continue;
      results.push(listing);
    }
    return results;
  }

  getActiveListingsForCharacter(characterId: string): MarketListing[] {
    const results: MarketListing[] = [];
    for (const listing of this.listings.values()) {
      if (listing.status === 'active' && listing.sellerId === characterId) {
        results.push(listing);
      }
    }
    return results;
  }

  getActiveOrders(canonicalId?: string): MarketOrder[] {
    const results: MarketOrder[] = [];
    for (const order of this.orders.values()) {
      if (order.status !== 'active') continue;
      if (canonicalId && order.canonicalId !== canonicalId) continue;
      results.push(order);
    }
    return results;
  }

  getListing(id: string): MarketListing | undefined {
    return this.listings.get(id);
  }

  // ── Metrics ───────────────────────────────────────────────────

  getEconomyMetrics(contractCount: number): EconomyMetricsSnapshot {
    return {
      totalTradeCount: this.totalTradeCount,
      activeListings: this.getActiveListings().length,
      activeOrders: this.getActiveOrders().length,
      activeContracts: contractCount,
      totalFeesCollected: this.totalFeesCollected,
    };
  }

  getTotalFeesCollected(): number {
    return this.totalFeesCollected;
  }

  getAllPriceHistory(): Map<string, PriceHistoryEntry[]> {
    return this.priceHistory;
  }
}
