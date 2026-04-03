-- Migration: 021_create_travel_journeys
-- Story 11.3 — Travel Actions and Risks
-- Forward-only. Rollback notes in docs/stories/story-11.3-travel-actions.md

CREATE TABLE IF NOT EXISTS travel_journeys (
  id              TEXT PRIMARY KEY,
  character_id    TEXT        NOT NULL,
  from_node_id    TEXT        NOT NULL REFERENCES world_nodes (id),
  to_node_id      TEXT        NOT NULL REFERENCES world_nodes (id),
  cargo_json      JSONB       NOT NULL DEFAULT '[]',
  status          TEXT        NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'arrived', 'failed')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  arrives_at      TIMESTAMPTZ NOT NULL,
  hazard_log_json JSONB       NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_travel_journeys_character ON travel_journeys (character_id);
CREATE INDEX IF NOT EXISTS idx_travel_journeys_status    ON travel_journeys (status);
CREATE INDEX IF NOT EXISTS idx_travel_journeys_arrives   ON travel_journeys (arrives_at);
