'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchAuditLog, type AuditLogEntry } from '../../../lib/admin-api';

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const log = await fetchAuditLog();
      setEntries(log);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="panel" aria-label="Audit Log" tabIndex={0}>
      <h2>Audit Log</h2>

      {error && <p role="alert" style={{ color: '#ff6b6b' }}>{error}</p>}

      {loading && <p className="muted">Loading…</p>}

      {!loading && entries.length === 0 && !error && (
        <p className="muted">No admin actions recorded yet.</p>
      )}

      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            padding: '0.5rem 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="row">
            <span>
              <strong>{entry.action}</strong>
            </span>
            <span className="muted" style={{ fontSize: '0.85em' }}>
              {new Date(entry.createdAt).toLocaleString()}
            </span>
          </div>
          <div style={{ fontSize: '0.85em' }}>
            <span className="muted">Admin: </span>{entry.adminId}
            {entry.target && (
              <span className="muted"> — {JSON.stringify(entry.target)}</span>
            )}
          </div>
        </div>
      ))}

      {!loading && entries.length > 0 && (
        <button
          onClick={load}
          style={{
            marginTop: '0.75rem',
            padding: '0.25rem 0.75rem',
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Refresh
        </button>
      )}
    </section>
  );
}
