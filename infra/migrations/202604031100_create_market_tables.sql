-- Migration: 202604031100_create_market_tables
-- Economy Module — Stories 9.1, 9.2
-- Forward-only. Rollback notes in docs/stories/story-9.1-market-listings.md

-- ── Market Listings ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_listings (
  id              TEXT PRIMARY KEY,
  seller_id       TEXT        NOT NULL,
  item_instance_id TEXT       NOT NULL,
  canonical_id    TEXT        NOT NULL,
  price           INTEGER     NOT NULL CHECK (price > 0),
  quantity        INTEGER     NOT NULL CHECK (quantity > 0),
  fee             INTEGER     NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'fulfilled', 'cancelled', 'expired')),
  created_at_game_day  INTEGER NOT NULL,
  expires_at_game_day  INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listings_canonical ON market_listings (canonical_id, status);
CREATE INDEX idx_listings_seller    ON market_listings (seller_id, status);

-- ── Market Orders ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_orders (
  id              TEXT PRIMARY KEY,
  buyer_id        TEXT        NOT NULL,
  canonical_id    TEXT        NOT NULL,
  max_price       INTEGER     NOT NULL CHECK (max_price > 0),
  quantity        INTEGER     NOT NULL CHECK (quantity > 0),
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'fulfilled', 'cancelled')),
  created_at_game_day INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_canonical ON market_orders (canonical_id, status);

-- ── Price History ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_price_history (
  id              BIGSERIAL PRIMARY KEY,
  canonical_id    TEXT        NOT NULL,
  price           INTEGER     NOT NULL,
  quantity        INTEGER     NOT NULL,
  traded_at_game_day INTEGER  NOT NULL,
  traded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_canonical ON market_price_history (canonical_id, traded_at_game_day);

-- ── Contracts ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contracts (
  id              TEXT PRIMARY KEY,
  type            TEXT        NOT NULL CHECK (type IN ('work', 'delivery', 'construction')),
  offerer_id      TEXT        NOT NULL,
  acceptor_id     TEXT,
  terms_json      JSONB       NOT NULL DEFAULT '{}',
  escrow_amount   INTEGER     NOT NULL DEFAULT 0 CHECK (escrow_amount >= 0),
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'accepted', 'completed', 'breached')),
  deadline_game_day  INTEGER  NOT NULL,
  created_at_game_day INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_status ON contracts (status);
CREATE INDEX idx_contracts_offerer ON contracts (offerer_id, status);
