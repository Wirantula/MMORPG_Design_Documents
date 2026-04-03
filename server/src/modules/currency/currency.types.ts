// ── Currency domain types ─────────────────────────────────────────

export type IssuerType = 'world' | 'settlement' | 'nation';

export interface Currency {
  id: string;
  name: string;
  symbol: string;
  issuerType: IssuerType;
  isPrimary: boolean;
}

export interface WalletEntry {
  currencyId: string;
  balance: number;
}

export interface TransferParams {
  fromId: string;
  toId: string;
  currencyId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}

export interface CurrencyTransaction {
  id: string;
  fromId: string | null;
  toId: string | null;
  currencyId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
  createdAt: string;
}
