-- Migration 002: Create characters table
-- Story 2.2 — Single-Character Enforcement

BEGIN;

CREATE TABLE characters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'alive'
              CHECK (status IN ('alive', 'dead', 'unborn')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  died_at     TIMESTAMPTZ
);

-- The critical constraint: only one alive character per account.
-- Race conditions are handled at the DB level — concurrent INSERTs with
-- status='alive' for the same account_id will cause a unique violation (23505).
CREATE UNIQUE INDEX one_alive_per_account
  ON characters (account_id)
  WHERE status = 'alive';

CREATE INDEX idx_characters_account_id ON characters (account_id);

COMMIT;
