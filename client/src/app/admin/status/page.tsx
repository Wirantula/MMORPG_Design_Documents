'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchServiceStatus, type ServiceStatus } from '../../../lib/admin-api';

const POLL_MS = 5_000;

function statusColor(status: string): string {
  switch (status) {
    case 'connected':
    case 'healthy':
      return '#4eff8e';
    case 'degraded':
      return '#ffcc4e';
    default:
      return '#ff6b6b';
  }
}

export default function AdminStatusPage() {
  const [data, setData] = useState<ServiceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const status = await fetchServiceStatus();
      setData(status);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className="panel" aria-label="Service Status" tabIndex={0}>
      <h2>Service Status</h2>

      {error && <p role="alert" style={{ color: '#ff6b6b' }}>{error}</p>}

      {!data && !error && <p className="muted">Loading…</p>}

      {data && (
        <>
          <div className="row">
            <span className="muted">Database</span>
            <strong style={{ color: statusColor(data.database) }}>{data.database}</strong>
          </div>
          <div className="row">
            <span className="muted">Redis</span>
            <strong style={{ color: statusColor(data.redis) }}>{data.redis}</strong>
          </div>
          <div className="row">
            <span className="muted">Tick Health</span>
            <strong style={{ color: statusColor(data.tickHealth) }}>{data.tickHealth}</strong>
          </div>
          <div className="row">
            <span className="muted">Last Tick Duration</span>
            <strong>{data.lastTickDurationMs.toFixed(1)} ms</strong>
          </div>
          <div className="row">
            <span className="muted">Tick Drift</span>
            <strong>{data.tickDriftMs.toFixed(1)} ms</strong>
          </div>
        </>
      )}
    </section>
  );
}
