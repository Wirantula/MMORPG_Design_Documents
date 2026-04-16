#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# CybaWorld — Automated PostgreSQL Backup Script
# Story 12.3 — Backups, Restore and Deployment Controls
#
# Usage:
#   PGPASSWORD=<pw> ./tools/scripts/backup.sh
#
# Environment variables:
#   PGPASSWORD       — (required) Postgres password
#   PGHOST           — default: localhost
#   PGPORT           — default: 5432
#   PGUSER           — default: cybaworld
#   PGDATABASE       — default: cybaworld
#   BACKUP_DIR       — default: <repo_root>/infra/backups
#   DAILY_RETENTION  — default: 7  (number of daily backups to keep)
#   WEEKLY_RETENTION — default: 4  (number of weekly backups to keep)
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Config ────────────────────────────────────────────────────────
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-cybaworld}"
PGDATABASE="${PGDATABASE:-cybaworld}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/infra/backups}"
DAILY_RETENTION="${DAILY_RETENTION:-7}"
WEEKLY_RETENTION="${WEEKLY_RETENTION:-4}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DAY_OF_WEEK="$(date -u +%u)"  # 1=Monday … 7=Sunday
FILENAME="backup_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "$BACKUP_DIR"

# ── Dump ──────────────────────────────────────────────────────────
echo "[backup] Starting pg_dump → ${FILEPATH}"

pg_dump \
  -h "$PGHOST" \
  -p "$PGPORT" \
  -U "$PGUSER" \
  -d "$PGDATABASE" \
  --no-password \
  --format=plain \
  | gzip > "$FILEPATH"

echo "[backup] Dump complete ($(du -h "$FILEPATH" | cut -f1))"

# ── Weekly snapshot ───────────────────────────────────────────────
# On Sundays (day 7), copy the daily backup as a weekly snapshot.
if [ "$DAY_OF_WEEK" -eq 7 ]; then
  WEEKLY_NAME="backup_weekly_${TIMESTAMP}.sql.gz"
  cp "$FILEPATH" "${BACKUP_DIR}/${WEEKLY_NAME}"
  echo "[backup] Weekly snapshot created: ${WEEKLY_NAME}"
fi

# ── Retention policy ─────────────────────────────────────────────
# Remove daily backups older than DAILY_RETENTION days (exclude weekly).
find "$BACKUP_DIR" \
  -maxdepth 1 \
  -name 'backup_[0-9]*.sql.gz' \
  -not -name 'backup_weekly_*' \
  -mtime "+${DAILY_RETENTION}" \
  -type f \
  -delete \
  -print | while read -r f; do echo "[backup] Deleted old daily: $f"; done

# Remove weekly backups older than WEEKLY_RETENTION weeks.
WEEKLY_DAYS=$(( WEEKLY_RETENTION * 7 ))
find "$BACKUP_DIR" \
  -maxdepth 1 \
  -name 'backup_weekly_*.sql.gz' \
  -mtime "+${WEEKLY_DAYS}" \
  -type f \
  -delete \
  -print | while read -r f; do echo "[backup] Deleted old weekly: $f"; done

echo "[backup] Retention policy applied. Done."
