-- Migration 010: Create character conditions table
-- Story 7.2 — Health, Injury and Recovery
--
-- Tracks active health conditions (wounds, illness, exhaustion, poisoning)
-- with severity, duration, and optional treatment skill linkage.

BEGIN;

CREATE TABLE IF NOT EXISTS character_conditions (
  id              TEXT PRIMARY KEY,
  character_id    TEXT NOT NULL REFERENCES characters(id),
  type            TEXT NOT NULL CHECK (type IN ('wound', 'illness', 'exhaustion', 'poisoning')),
  severity        SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 5),
  duration_days   SMALLINT NOT NULL CHECK (duration_days > 0),
  stat_penalty    REAL NOT NULL DEFAULT 0.0 CHECK (stat_penalty BETWEEN 0.0 AND 1.0),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolves_at     TIMESTAMPTZ NOT NULL,
  treated_by_skill TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_character_conditions_character ON character_conditions (character_id);
CREATE INDEX idx_character_conditions_resolves  ON character_conditions (resolves_at);

COMMIT;
