// ── Market types ──────────────────────────────────────────────────

export type ListingStatus = 'active' | 'fulfilled' | 'cancelled' | 'expired';
export type OrderStatus = 'active' | 'fulfilled' | 'cancelled';
export type ContractType = 'work' | 'delivery' | 'construction';
export type ContractStatus = 'open' | 'accepted' | 'completed' | 'breached';

export interface MarketListing {
  id: string;
  sellerId: string;
  itemInstanceId: string;
  canonicalId: string;
  price: number;
  quantity: number;
  fee: number;
  status: ListingStatus;
  createdAtGameDay: number;
  expiresAtGameDay: number;
}

export interface MarketOrder {
  id: string;
  buyerId: string;
  canonicalId: string;
  maxPrice: number;
  quantity: number;
  status: OrderStatus;
  createdAtGameDay: number;
}

export interface PriceHistoryEntry {
  canonicalId: string;
  price: number;
  quantity: number;
  tradedAtGameDay: number;
  timestamp: string;
}

// ── Contract types ────────────────────────────────────────────────

export interface Contract {
  id: string;
  type: ContractType;
  offererId: string;
  acceptorId: string | null;
  termsJson: Record<string, unknown>;
  escrowAmount: number;
  status: ContractStatus;
  deadlineGameDay: number;
  createdAtGameDay: number;
}

// ── Dashboard types ───────────────────────────────────────────────

export interface TradeSummaryItem {
  canonicalId: string;
  totalVolume: number;
  totalValue: number;
  avgPrice: number;
  priceVelocity: number; // % change over observation window
}

export interface SinkReport {
  gameDay: number;
  totalFees: number;
  totalEscrowLost: number;
}

export interface FaucetReport {
  gameDay: number;
  totalRewards: number;
  totalNpcPurchases: number;
}

export interface ShortageAlert {
  canonicalId: string;
  daysSinceLastListing: number;
}

export interface InflationAlert {
  canonicalId: string;
  priceChangePercent: number;
  periodDays: number;
}

export interface EconomyMetricsSnapshot {
  totalTradeCount: number;
  activeListings: number;
  activeOrders: number;
  activeContracts: number;
  totalFeesCollected: number;
}
