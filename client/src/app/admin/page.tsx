'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchDashboard, toggleMaintenance, type AdminDashboardStatus } from '../../lib/admin-api';

/** Polling interval for dashboard data. */
const POLL_MS = 5_000;

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const status = await fetchDashboard();
      setData(status);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  async function handleToggleMaintenance() {
    if (!data) return;
    setToggling(true);
    try {
      const result = await toggleMaintenance(!data.maintenanceMode);
      setData((prev) => (prev ? { ...prev, maintenanceMode: result.maintenanceMode } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed');
    } finally {
      setToggling(false);
    }
  }

  function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  }

  return (
    <section className="panel" aria-label="Admin Dashboard" tabIndex={0}>
      <h2>Dashboard</h2>

      {error && <p role="alert" style={{ color: '#ff6b6b' }}>{error}</p>}

      {!data && !error && <p className="muted">Loading…</p>}

      {data && (
        <>
          <div className="row">
            <span className="muted">Server Uptime</span>
            <strong>{formatUptime(data.serverUptimeSeconds)}</strong>
          </div>
          <div className="row">
            <span className="muted">Connected Clients</span>
            <strong>{data.connectedClients}</strong>
          </div>
          <div className="row">
            <span className="muted">Active Characters</span>
            <strong>{data.activeCharacters}</strong>
          </div>
          <div className="row">
            <span className="muted">Last Tick At</span>
            <strong>{data.lastTickAt || '—'}</strong>
          </div>
          <div className="row" style={{ marginTop: '1rem' }}>
            <span className="muted">Maintenance Mode</span>
            <button
              onClick={handleToggleMaintenance}
              disabled={toggling}
              style={{
                padding: '0.25rem 0.75rem',
                background: data.maintenanceMode ? '#ff6b6b' : 'var(--accent)',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: toggling ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                fontWeight: 'bold',
              }}
            >
              {data.maintenanceMode ? 'Disable' : 'Enable'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
