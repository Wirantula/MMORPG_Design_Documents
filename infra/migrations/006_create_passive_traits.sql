-- Migration 006: Create passive hidden traits table
-- Story 5.4 — Passive Hidden Traits and Luck Model
--
-- Stores per-character passive trait weights.
-- Weights range from -100 to +100 and bias scenario selection probability.
-- This data is server-only — never exposed in player-facing API responses.

BEGIN;

CREATE TABLE IF NOT EXISTS character_passive_traits (
  character_id  TEXT NOT NULL REFERENCES characters(id),
  trait_name    TEXT NOT NULL CHECK (trait_name IN (
    'fortune_drift',
    'catastrophe_avoidance',
    'research_spark',
    'combat_instinct',
    'craft_intuition',
    'trauma_susceptibility'
  )),
  weight        SMALLINT NOT NULL CHECK (weight BETWEEN -100 AND 100),
  rolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, trait_name)
);

-- Index for looking up all traits for a character
CREATE INDEX idx_passive_traits_character ON character_passive_traits (character_id);

-- Index for admin analytics queries by trait name
CREATE INDEX idx_passive_traits_name ON character_passive_traits (trait_name);

COMMIT;
