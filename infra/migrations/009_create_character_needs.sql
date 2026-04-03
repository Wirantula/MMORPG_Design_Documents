-- Migration 009: Create character needs table
-- Story 7.1 — Needs System
--
-- Five need dimensions: nutrition, fatigue, hygiene, morale, belonging.
-- Each is 0–100, defaulting to 100 (fully satisfied).

BEGIN;

CREATE TABLE IF NOT EXISTS character_needs (
  character_id  TEXT PRIMARY KEY REFERENCES characters(id),
  nutrition     SMALLINT NOT NULL DEFAULT 100 CHECK (nutrition  BETWEEN 0 AND 100),
  fatigue       SMALLINT NOT NULL DEFAULT 100 CHECK (fatigue   BETWEEN 0 AND 100),
  hygiene       SMALLINT NOT NULL DEFAULT 100 CHECK (hygiene   BETWEEN 0 AND 100),
  morale        SMALLINT NOT NULL DEFAULT 100 CHECK (morale    BETWEEN 0 AND 100),
  belonging     SMALLINT NOT NULL DEFAULT 100 CHECK (belonging BETWEEN 0 AND 100),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_character_needs_updated ON character_needs (updated_at);

COMMIT;
