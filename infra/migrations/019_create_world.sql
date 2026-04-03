-- Migration: 019_create_world
-- Story 11.1 — Universe / Planet / Plane / Region graph
-- Forward-only. Rollback notes in docs/stories/story-11.1-world-graph.md

CREATE TABLE IF NOT EXISTS world_nodes (
  id              TEXT PRIMARY KEY,
  name            TEXT        NOT NULL,
  type            TEXT        NOT NULL CHECK (type IN ('universe', 'planet', 'plane', 'region', 'settlement_zone')),
  parent_id       TEXT                 REFERENCES world_nodes (id),
  env_tags        JSONB       NOT NULL DEFAULT '[]',
  travel_cost     INTEGER     NOT NULL DEFAULT 0 CHECK (travel_cost >= 0),
  unlock_status   TEXT        NOT NULL DEFAULT 'locked' CHECK (unlock_status IN ('locked', 'unlocked')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_world_nodes_type      ON world_nodes (type);
CREATE INDEX IF NOT EXISTS idx_world_nodes_parent    ON world_nodes (parent_id);
CREATE INDEX IF NOT EXISTS idx_world_nodes_unlock    ON world_nodes (unlock_status);

CREATE TABLE IF NOT EXISTS world_edges (
  from_node_id          TEXT    NOT NULL REFERENCES world_nodes (id),
  to_node_id            TEXT    NOT NULL REFERENCES world_nodes (id),
  travel_time_minutes   INTEGER NOT NULL CHECK (travel_time_minutes > 0),
  currency_cost         INTEGER NOT NULL DEFAULT 0 CHECK (currency_cost >= 0),
  hazard_level          INTEGER NOT NULL DEFAULT 0 CHECK (hazard_level >= 0 AND hazard_level <= 10),
  PRIMARY KEY (from_node_id, to_node_id)
);

CREATE INDEX IF NOT EXISTS idx_world_edges_from ON world_edges (from_node_id);
CREATE INDEX IF NOT EXISTS idx_world_edges_to   ON world_edges (to_node_id);
