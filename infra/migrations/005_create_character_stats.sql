-- Migration 005: Create dual stat layer tables
-- Story 5.3 — Dual Stat Layer System
--
-- Two separate tables for visible stats and hidden potential.
-- Both reference characters(id) from migration 003.
-- Stats stored as JSONB per family for flexibility.

BEGIN;

-- ── Visible / current stats ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS character_current_stats (
  character_id  TEXT PRIMARY KEY REFERENCES characters(id),
  physical      JSONB NOT NULL DEFAULT '{}',
  mental        JSONB NOT NULL DEFAULT '{}',
  social        JSONB NOT NULL DEFAULT '{}',
  perceptual    JSONB NOT NULL DEFAULT '{}',
  spiritual     JSONB NOT NULL DEFAULT '{}',
  economic      JSONB NOT NULL DEFAULT '{}',
  initialised_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Hidden potential stats (server-only, never player-facing) ───

CREATE TABLE IF NOT EXISTS character_potential_stats (
  character_id        TEXT PRIMARY KEY REFERENCES characters(id),
  growth_elasticity   SMALLINT NOT NULL CHECK (growth_elasticity   BETWEEN 0 AND 100),
  ceiling_bias        SMALLINT NOT NULL CHECK (ceiling_bias        BETWEEN 0 AND 100),
  fortune_bias        SMALLINT NOT NULL CHECK (fortune_bias        BETWEEN 0 AND 100),
  craft_intuition     SMALLINT NOT NULL CHECK (craft_intuition     BETWEEN 0 AND 100),
  combat_instinct     SMALLINT NOT NULL CHECK (combat_instinct     BETWEEN 0 AND 100),
  research_spark      SMALLINT NOT NULL CHECK (research_spark      BETWEEN 0 AND 100),
  trauma_susceptibility SMALLINT NOT NULL CHECK (trauma_susceptibility BETWEEN 0 AND 100),
  initialised_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for potential admin queries
CREATE INDEX idx_potential_growth ON character_potential_stats (growth_elasticity);
CREATE INDEX idx_potential_ceiling ON character_potential_stats (ceiling_bias);

COMMIT;
