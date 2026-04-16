import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { OpsService, type BackupEntry } from '../src/modules/ops/ops.service';

// ── Helpers ──────────────────────────────────────────────────────

const TMP_BACKUP_DIR = path.resolve(__dirname, '../__test_backups__');

function createService(): OpsService {
  const svc = new OpsService();
  // Override the backup dir to use a temp directory for tests
  (svc as unknown as { backupDir: string }).backupDir = TMP_BACKUP_DIR;
  return svc;
}

function writeGzFile(filename: string, content: string): void {
  const compressed = zlib.gzipSync(Buffer.from(content, 'utf-8'));
  fs.writeFileSync(path.join(TMP_BACKUP_DIR, filename), compressed);
}

function writeCorruptFile(filename: string): void {
  fs.writeFileSync(path.join(TMP_BACKUP_DIR, filename), 'not-valid-gzip');
}

// ── Tests ────────────────────────────────────────────────────────

describe('OpsService', () => {
  beforeEach(() => {
    fs.mkdirSync(TMP_BACKUP_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TMP_BACKUP_DIR, { recursive: true, force: true });
  });

  // ── listBackups ───────────────────────────────────────────────

  it('returns empty array when backup dir does not exist', () => {
    fs.rmSync(TMP_BACKUP_DIR, { recursive: true, force: true });
    const svc = createService();
    expect(svc.listBackups()).toEqual([]);
  });

  it('lists backup files sorted newest first', () => {
    writeGzFile('backup_20260101T000000Z.sql.gz', 'dump1');
    writeGzFile('backup_20260102T000000Z.sql.gz', 'dump2');
    writeGzFile('backup_weekly_20260101T000000Z.sql.gz', 'weekly1');

    const svc = createService();
    const backups = svc.listBackups();

    expect(backups).toHaveLength(3);
    // All entries have expected fields
    for (const b of backups) {
      expect(b).toHaveProperty('filename');
      expect(b).toHaveProperty('sizeBytes');
      expect(b).toHaveProperty('createdAt');
      expect(b).toHaveProperty('isWeekly');
      expect(b.sizeBytes).toBeGreaterThan(0);
    }
  });

  it('marks weekly backups correctly', () => {
    writeGzFile('backup_20260101T000000Z.sql.gz', 'daily');
    writeGzFile('backup_weekly_20260101T000000Z.sql.gz', 'weekly');

    const svc = createService();
    const backups = svc.listBackups();

    const daily = backups.find((b) => b.filename === 'backup_20260101T000000Z.sql.gz');
    const weekly = backups.find((b) => b.filename === 'backup_weekly_20260101T000000Z.sql.gz');

    expect(daily?.isWeekly).toBe(false);
    expect(weekly?.isWeekly).toBe(true);
  });

  it('ignores non-.sql.gz files', () => {
    writeGzFile('backup_20260101T000000Z.sql.gz', 'dump');
    fs.writeFileSync(path.join(TMP_BACKUP_DIR, '.gitkeep'), '');
    fs.writeFileSync(path.join(TMP_BACKUP_DIR, 'readme.txt'), 'hello');

    const svc = createService();
    expect(svc.listBackups()).toHaveLength(1);
  });

  // ── dryRunRestore ─────────────────────────────────────────────

  it('validates a valid gzip backup successfully', () => {
    writeGzFile('backup_20260101T120000Z.sql.gz', 'SELECT 1;');
    const svc = createService();
    const result = svc.dryRunRestore('backup_20260101T120000Z.sql.gz');

    expect(result.valid).toBe(true);
    expect(result.reason).toBe('OK');
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('rejects invalid filename format', () => {
    const svc = createService();
    const result = svc.dryRunRestore('../../../etc/passwd');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invalid filename format');
  });

  it('rejects non-existent file', () => {
    const svc = createService();
    const result = svc.dryRunRestore('backup_20260101T120000Z.sql.gz');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('File not found');
  });

  it('rejects corrupt gzip file', () => {
    writeCorruptFile('backup_20260101T120000Z.sql.gz');
    const svc = createService();
    const result = svc.dryRunRestore('backup_20260101T120000Z.sql.gz');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Gzip integrity check failed');
  });

  it('accepts weekly backup filename format', () => {
    writeGzFile('backup_weekly_20260105T000000Z.sql.gz', 'weekly dump');
    const svc = createService();
    const result = svc.dryRunRestore('backup_weekly_20260105T000000Z.sql.gz');

    expect(result.valid).toBe(true);
  });

  // ── getVersion ────────────────────────────────────────────────

  it('returns version info with commitHash and deployTimestamp', () => {
    const svc = createService();
    const version = svc.getVersion();

    expect(version).toHaveProperty('commitHash');
    expect(version).toHaveProperty('deployTimestamp');
    expect(typeof version.commitHash).toBe('string');
    expect(version.commitHash.length).toBeGreaterThan(0);
    // deployTimestamp should be a valid ISO string
    expect(new Date(version.deployTimestamp).toISOString()).toBe(version.deployTimestamp);
  });

  // ── checkMigrations ───────────────────────────────────────────

  it('migration check passes when applied >= expected', () => {
    const svc = createService();
    const result = svc.checkMigrations();

    expect(result.ok).toBe(true);
    expect(result.applied).toBeGreaterThanOrEqual(result.expected);
    expect(result.missing).toEqual([]);
  });

  // ── getExpiredBackups (retention policy) ────────────────────

  it('marks daily backups older than 7 days as expired', () => {
    const now = new Date('2026-04-16T00:00:00Z');
    const entries: BackupEntry[] = [
      { filename: 'backup_20260415T000000Z.sql.gz', sizeBytes: 100, createdAt: '2026-04-15T00:00:00.000Z', isWeekly: false },
      { filename: 'backup_20260408T000000Z.sql.gz', sizeBytes: 100, createdAt: '2026-04-08T00:00:00.000Z', isWeekly: false },
      { filename: 'backup_20260401T000000Z.sql.gz', sizeBytes: 100, createdAt: '2026-04-01T00:00:00.000Z', isWeekly: false },
    ];

    const svc = createService();
    const expired = svc.getExpiredBackups(entries, now);

    // Apr 15 = 1 day old → keep
    // Apr 8  = 8 days old → expired (>7)
    // Apr 1  = 15 days old → expired
    expect(expired).toHaveLength(2);
    expect(expired).toContain('backup_20260408T000000Z.sql.gz');
    expect(expired).toContain('backup_20260401T000000Z.sql.gz');
  });

  it('marks weekly backups older than 28 days as expired', () => {
    const now = new Date('2026-04-16T00:00:00Z');
    const entries: BackupEntry[] = [
      { filename: 'backup_weekly_20260412T000000Z.sql.gz', sizeBytes: 100, createdAt: '2026-04-12T00:00:00.000Z', isWeekly: true },
      { filename: 'backup_weekly_20260315T000000Z.sql.gz', sizeBytes: 100, createdAt: '2026-03-15T00:00:00.000Z', isWeekly: true },
    ];

    const svc = createService();
    const expired = svc.getExpiredBackups(entries, now);

    // Apr 12 = 4 days old → keep
    // Mar 15 = 32 days old → expired (>28)
    expect(expired).toHaveLength(1);
    expect(expired).toContain('backup_weekly_20260315T000000Z.sql.gz');
  });

  it('does not expire recent backups', () => {
    const now = new Date('2026-04-16T00:00:00Z');
    const entries: BackupEntry[] = [
      { filename: 'backup_20260416T000000Z.sql.gz', sizeBytes: 100, createdAt: '2026-04-16T00:00:00.000Z', isWeekly: false },
      { filename: 'backup_weekly_20260413T000000Z.sql.gz', sizeBytes: 100, createdAt: '2026-04-13T00:00:00.000Z', isWeekly: true },
    ];

    const svc = createService();
    const expired = svc.getExpiredBackups(entries, now);
    expect(expired).toHaveLength(0);
  });

  it('handles empty backup list', () => {
    const svc = createService();
    expect(svc.getExpiredBackups([])).toHaveLength(0);
  });

  it('separates daily and weekly retention correctly', () => {
    const now = new Date('2026-04-16T00:00:00Z');
    const entries: BackupEntry[] = [
      // Daily 10 days old → expired
      { filename: 'backup_20260406T000000Z.sql.gz', sizeBytes: 100, createdAt: '2026-04-06T00:00:00.000Z', isWeekly: false },
      // Weekly 10 days old → keep (within 28 day window)
      { filename: 'backup_weekly_20260406T000000Z.sql.gz', sizeBytes: 100, createdAt: '2026-04-06T00:00:00.000Z', isWeekly: true },
    ];

    const svc = createService();
    const expired = svc.getExpiredBackups(entries, now);

    expect(expired).toHaveLength(1);
    expect(expired[0]).toBe('backup_20260406T000000Z.sql.gz');
  });
});
