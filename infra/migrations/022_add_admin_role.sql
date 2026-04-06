-- 022_add_admin_role.sql
-- Story 12.1: Admin Panel Skeleton
-- Adds role column to accounts and creates admin_audit_log table.

ALTER TABLE accounts ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'player';

CREATE TABLE admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES accounts(id),
  action        VARCHAR(128) NOT NULL,
  target        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
