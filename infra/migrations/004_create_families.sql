-- Migration 004: Create families table for family protection system
-- Story 5.2 — Life Stages and Family Protection

BEGIN;

-- Families table: one row per character, tracks guardian NPC and household state
CREATE TABLE IF NOT EXISTS families (
  id              TEXT PRIMARY KEY,
  character_id    TEXT NOT NULL REFERENCES characters(id),
  guardian_npc_id TEXT NOT NULL,
  household_state JSONB NOT NULL DEFAULT '{"foodSupplied": true, "shelterProvided": true, "lastCheckedGameDay": 0}',
  created_at_game_day INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_families_character_id ON families (character_id);
CREATE INDEX idx_families_guardian_npc ON families (guardian_npc_id);

-- Life-stage transition log (audit trail / observability)
CREATE TABLE IF NOT EXISTS life_stage_transitions (
  id              SERIAL PRIMARY KEY,
  character_id    TEXT NOT NULL REFERENCES characters(id),
  previous_stage  TEXT NOT NULL CHECK (previous_stage IN ('infant', 'child', 'teen', 'adult', 'elder')),
  new_stage       TEXT NOT NULL CHECK (new_stage IN ('infant', 'child', 'teen', 'adult', 'elder')),
  age_in_game_years INTEGER NOT NULL,
  game_day        INTEGER NOT NULL,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_life_stage_transitions_character ON life_stage_transitions (character_id);

-- Safety alerts log
CREATE TABLE IF NOT EXISTS family_safety_alerts (
  id              SERIAL PRIMARY KEY,
  family_id       TEXT NOT NULL REFERENCES families(id),
  character_id    TEXT NOT NULL REFERENCES characters(id),
  reason          TEXT NOT NULL,
  game_day        INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_safety_alerts_character ON family_safety_alerts (character_id);

COMMIT;
