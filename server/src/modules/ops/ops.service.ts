import { Injectable, Logger } from '@nestjs/common';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

// ── Public shapes ────────────────────────────────────────────────

export interface BackupEntry {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  isWeekly: boolean;
}

export interface DryRunResult {
  filename: string;
  valid: boolean;
  reason: string;
  sizeBytes: number;
}

export interface VersionInfo {
  commitHash: string;
  deployTimestamp: string;
}

export interface MigrationCheckResult {
  applied: number;
  expected: number;
  ok: boolean;
  missing: string[];
}

// ── Constants ────────────────────────────────────────────────────

const DAILY_RETENTION_DAYS = 7;
const WEEKLY_RETENTION_DAYS = 28; // 4 weeks

@Injectable()
export class OpsService {
  private readonly logger = new Logger(OpsService.name);
  private readonly backupDir: string;

  /** Timestamp captured once at service creation (≈ deploy time). */
  private readonly deployTimestamp = new Date().toISOString();

  constructor() {
    // Resolve backup dir relative to repo root
    this.backupDir = path.resolve(__dirname, '../../../../infra/backups');
  }

  // ── Backup listing ─────────────────────────────────────────────

  listBackups(): BackupEntry[] {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }

    const files = fs.readdirSync(this.backupDir).filter((f) => f.endsWith('.sql.gz'));

    return files
      .map((filename) => {
        const filepath = path.join(this.backupDir, filename);
        const stat = fs.statSync(filepath);
        return {
          filename,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
          isWeekly: filename.startsWith('backup_weekly_'),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ── Dry-run restore validation ─────────────────────────────────

  dryRunRestore(filename: string): DryRunResult {
    // Sanitise filename — only allow expected backup naming pattern
    if (!/^backup_(?:weekly_)?\d{8}T\d{6}Z\.sql\.gz$/.test(filename)) {
      return { filename, valid: false, reason: 'Invalid filename format', sizeBytes: 0 };
    }

    const filepath = path.join(this.backupDir, filename);

    if (!fs.existsSync(filepath)) {
      return { filename, valid: false, reason: 'File not found', sizeBytes: 0 };
    }

    const stat = fs.statSync(filepath);

    // Verify gzip integrity by attempting decompression
    try {
      const buf = fs.readFileSync(filepath);
      zlib.gunzipSync(buf);
    } catch {
      this.logger.warn(`Backup integrity check failed: ${filename}`, 'OpsService');
      return { filename, valid: false, reason: 'Gzip integrity check failed', sizeBytes: stat.size };
    }

    this.logger.log(`Dry-run restore validated: ${filename}`, 'OpsService');
    return { filename, valid: true, reason: 'OK', sizeBytes: stat.size };
  }

  // ── Version info ───────────────────────────────────────────────

  getVersion(): VersionInfo {
    let commitHash = 'unknown';
    try {
      commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      this.logger.warn('Could not determine git commit hash', 'OpsService');
    }

    return { commitHash, deployTimestamp: this.deployTimestamp };
  }

  // ── Migration check (pre-flight) ──────────────────────────────
  //
  // In-memory stub: until a real Postgres migration runner is wired,
  // the server reports 0 applied / 0 expected (always OK).
  // When the persistence layer lands, replace the body with a real
  // query against the migrations table.

  checkMigrations(): MigrationCheckResult {
    const applied = 0;
    const expected = 0;
    const ok = applied >= expected;

    if (!ok) {
      this.logger.error(
        `Migration mismatch: applied=${applied} expected=${expected}`,
        undefined,
        'OpsService',
      );
    } else {
      this.logger.log(
        `Migration check passed: applied=${applied} expected=${expected}`,
        'OpsService',
      );
    }

    return { applied, expected, ok, missing: [] };
  }

  // ── Retention policy (pure logic, testable) ────────────────────

  /**
   * Given a list of backup entries and a reference date, returns the
   * filenames that should be deleted according to retention policy:
   *   - Daily backups older than DAILY_RETENTION_DAYS
   *   - Weekly backups older than WEEKLY_RETENTION_DAYS
   */
  getExpiredBackups(entries: BackupEntry[], now: Date = new Date()): string[] {
    const expired: string[] = [];
    const nowMs = now.getTime();

    for (const entry of entries) {
      const ageMs = nowMs - new Date(entry.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      if (entry.isWeekly && ageDays > WEEKLY_RETENTION_DAYS) {
        expired.push(entry.filename);
      } else if (!entry.isWeekly && ageDays > DAILY_RETENTION_DAYS) {
        expired.push(entry.filename);
      }
    }

    return expired;
  }
}
