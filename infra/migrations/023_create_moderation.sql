-- 023_create_moderation.sql
-- Story 12.2: Moderation Tooling
-- Creates player_reports table and adds moderation columns to accounts.

BEGIN;

-- ── Player reports queue ─────────────────────────────────────────────
CREATE TABLE player_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES accounts(id),
  target_id     UUID NOT NULL REFERENCES accounts(id),
  reason        VARCHAR(64) NOT NULL,
  evidence_text TEXT,
  status        VARCHAR(16) NOT NULL DEFAULT 'open',
  resolved_by   UUID REFERENCES accounts(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_reports_status     ON player_reports (status);
CREATE INDEX idx_player_reports_target_id  ON player_reports (target_id);
CREATE INDEX idx_player_reports_created_at ON player_reports (created_at DESC);

-- ── Moderation columns on accounts ───────────────────────────────────
ALTER TABLE accounts ADD COLUMN muted_until   TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE accounts ADD COLUMN warning_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN banned        BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
