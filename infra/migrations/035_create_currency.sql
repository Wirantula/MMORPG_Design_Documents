-- Migration: 035_create_currency
-- Story 20.1 — Currency System
-- Forward-only. Rollback notes in docs/stories/story-20.1-currency-system.md

BEGIN;

-- ── Currencies registry ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS currencies (
  id            TEXT PRIMARY KEY,
  name          TEXT        NOT NULL,
  symbol        TEXT        NOT NULL,
  issuer_type   TEXT        NOT NULL CHECK (issuer_type IN ('world', 'settlement', 'nation')),
  is_primary    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_currencies_name ON currencies (name);

-- ── Character wallets ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS character_wallets (
  character_id  TEXT        NOT NULL,
  currency_id   TEXT        NOT NULL REFERENCES currencies(id),
  balance       BIGINT      NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, currency_id)
);

CREATE INDEX IF NOT EXISTS idx_character_wallets_character ON character_wallets (character_id);

-- ── Settlement treasuries ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlement_treasuries (
  settlement_id TEXT        NOT NULL,
  currency_id   TEXT        NOT NULL REFERENCES currencies(id),
  balance       BIGINT      NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (settlement_id, currency_id)
);

-- ── Transaction log (audit + idempotency) ────────────────────────
CREATE TABLE IF NOT EXISTS currency_transactions (
  id              TEXT PRIMARY KEY,
  from_id         TEXT,
  to_id           TEXT,
  currency_id     TEXT        NOT NULL REFERENCES currencies(id),
  amount          BIGINT      NOT NULL CHECK (amount > 0),
  reason          TEXT        NOT NULL,
  idempotency_key TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_currency_tx_idempotency
  ON currency_transactions (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_currency_tx_from ON currency_transactions (from_id);
CREATE INDEX IF NOT EXISTS idx_currency_tx_to   ON currency_transactions (to_id);

-- ── Seed starter currencies ──────────────────────────────────────
INSERT INTO currencies (id, name, symbol, issuer_type, is_primary)
VALUES
  ('world-gold',         'World Gold',         'WG',  'world',      TRUE),
  ('settlement-credit',  'Settlement Credit',  'SC',  'settlement', FALSE)
ON CONFLICT (id) DO NOTHING;

COMMIT;
