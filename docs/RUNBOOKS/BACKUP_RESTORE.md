# Runbook — Backup & Restore

**Story:** 12.3 | **Owner:** Live Ops Agent | **Last updated:** 2026-04-16

---

## 1. Overview

CybaWorld uses automated daily `pg_dump` backups compressed with gzip. Backups
are stored in `infra/backups/` with a retention policy of **7 daily** and
**4 weekly** snapshots. Weekly snapshots are created every Sunday.

## 2. Backup Schedule

| Type   | Frequency | Retention | Naming pattern                         |
|--------|-----------|-----------|----------------------------------------|
| Daily  | Every day | 7 days    | `backup_{YYYYMMDD}T{HHMMSS}Z.sql.gz`  |
| Weekly | Sundays   | 28 days   | `backup_weekly_{YYYYMMDD}T{HHMMSS}Z.sql.gz` |

## 3. Manual Backup

```bash
# From the repo root:
PGPASSWORD=$PGPASSWORD ./tools/scripts/backup.sh
```

Environment variables (all have sensible defaults):
- `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`
- `BACKUP_DIR` — override backup output path
- `DAILY_RETENTION`, `WEEKLY_RETENTION`

## 4. Listing Backups

### Via API (requires admin JWT)

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:1545/api/admin/ops/backups
```

Returns JSON array of `{ filename, sizeBytes, createdAt, isWeekly }`.

### Via filesystem

```bash
ls -lhS infra/backups/*.sql.gz
```

## 5. Validating a Backup (Dry Run)

Before restoring, validate gzip integrity:

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "backup_20260416T080000Z.sql.gz"}' \
  http://localhost:1545/api/admin/ops/restore/dry-run
```

Response: `{ filename, valid, reason, sizeBytes }`.

## 6. Full Restore Procedure

> **WARNING:** This replaces all data in the target database. Perform on a
> staging instance first when possible.

### Step 1 — Enable maintenance mode

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}' \
  http://localhost:1545/api/admin/maintenance
```

### Step 2 — Stop the application server

```bash
# systemd example
sudo systemctl stop cybaworld-server
```

### Step 3 — Validate backup integrity

```bash
gunzip -t infra/backups/backup_20260416T080000Z.sql.gz
```

### Step 4 — Drop and recreate the database

```bash
PGPASSWORD=$PGPASSWORD psql -h localhost -U cybaworld -d postgres \
  -c "DROP DATABASE IF EXISTS cybaworld;"
PGPASSWORD=$PGPASSWORD psql -h localhost -U cybaworld -d postgres \
  -c "CREATE DATABASE cybaworld OWNER cybaworld;"
```

### Step 5 — Restore the dump

```bash
gunzip -c infra/backups/backup_20260416T080000Z.sql.gz \
  | PGPASSWORD=$PGPASSWORD psql -h localhost -U cybaworld -d cybaworld
```

### Step 6 — Verify migration state

```bash
PGPASSWORD=$PGPASSWORD psql -h localhost -U cybaworld -d cybaworld \
  -c "SELECT count(*) FROM pg_migrations;"
```

### Step 7 — Restart the server

```bash
sudo systemctl start cybaworld-server
```

The server runs a migration pre-flight check on startup. If any migrations are
missing, it will refuse to start and log the mismatch.

### Step 8 — Disable maintenance mode

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}' \
  http://localhost:1545/api/admin/maintenance
```

### Step 9 — Verify health

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:1545/api/admin/status
```

Confirm `database: "connected"` and `tickHealth: "healthy"`.

## 7. Version Check

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:1545/api/admin/ops/version
```

Returns `{ commitHash, deployTimestamp }`.

## 8. Troubleshooting

| Symptom | Likely cause | Action |
|---------|-------------|--------|
| Server won't start after restore | Missing migrations | Check logs for `Migration check FAILED`, run pending migrations manually |
| `Gzip integrity check failed` | Corrupt backup file | Try a different backup; check disk for errors |
| Backup script fails | Wrong `PGPASSWORD` or DB unreachable | Verify env vars and Postgres connectivity |
| Retention not cleaning up | `find -mtime` uses filesystem mtime | Ensure server clock is correct |

## 9. Observability

- Backup script logs to stdout with `[backup]` prefix — redirect to your log collector.
- `OpsService` emits structured JSON logs via `AppLogger` for all operations.
- Migration check result is logged at server startup under the `Bootstrap` context.
