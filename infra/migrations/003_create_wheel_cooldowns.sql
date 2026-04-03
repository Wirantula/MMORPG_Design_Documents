-- Migration 003: Create wheel cooldowns and characters tables for birth ritual
-- Story 5.1 — Birth and Wheel Generation

BEGIN;

-- Characters table (unborn → in_progress → complete)
CREATE TABLE IF NOT EXISTS characters (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'unborn'
                  CHECK (status IN ('unborn', 'in_progress', 'complete')),
  wheel_results JSONB,
  born_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_characters_account_id ON characters (account_id);

-- Wheel cooldowns: one row per account + wheel type
CREATE TABLE IF NOT EXISTS wheel_cooldowns (
  account_id   TEXT NOT NULL,
  wheel_type   TEXT NOT NULL CHECK (wheel_type IN ('race', 'aptitude', 'trait', 'origin', 'omen')),
  available_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (account_id, wheel_type)
);

CREATE INDEX idx_wheel_cooldowns_account ON wheel_cooldowns (account_id);

-- Wheel spin history (audit trail)
CREATE TABLE IF NOT EXISTS wheel_spin_log (
  id           SERIAL PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  wheel_type   TEXT NOT NULL,
  outcome_id   TEXT NOT NULL,
  is_reroll    BOOLEAN NOT NULL DEFAULT FALSE,
  spun_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wheel_spin_log_character ON wheel_spin_log (character_id);

COMMIT;
