-- Migration: 015_create_contracts
-- Story 9.2 — Labor & delivery contracts with escrow
-- Forward-only. Rollback notes in docs/stories/story-9.2-contracts.md
--
-- NOTE: The contracts table was originally created in
-- 202604031100_create_market_tables.sql as part of the combined economy module
-- migration. This file exists as the canonical, story-specific migration reference.

CREATE TABLE IF NOT EXISTS contracts (
  id                  TEXT PRIMARY KEY,
  type                TEXT        NOT NULL CHECK (type IN ('work', 'delivery', 'construction')),
  offerer_id          TEXT        NOT NULL,
  acceptor_id         TEXT,
  terms_json          JSONB       NOT NULL DEFAULT '{}',
  escrow_amount       INTEGER     NOT NULL DEFAULT 0 CHECK (escrow_amount >= 0),
  status              TEXT        NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open', 'accepted', 'completed', 'breached')),
  deadline_game_day   INTEGER     NOT NULL,
  created_at_game_day INTEGER     NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_status   ON contracts (status);
CREATE INDEX IF NOT EXISTS idx_contracts_offerer  ON contracts (offerer_id, status);
