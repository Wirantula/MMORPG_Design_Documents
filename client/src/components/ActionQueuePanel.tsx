'use client';

import type { ActionEntry } from '../lib/contracts';

export interface ActionQueuePanelProps {
  actions: ActionEntry[];
  loading: boolean;
  error: string | null;
}

function statusBadge(status: ActionEntry['status']): string {
  switch (status) {
    case 'active':
      return '▶ active';
    case 'queued':
      return '◻ queued';
    case 'resolved':
      return '✓ done';
    case 'cancelled':
      return '✗ cancelled';
  }
}

export function ActionQueuePanel({ actions, loading, error }: ActionQueuePanelProps) {
  return (
    <section className="panel" aria-label="Action Queue" tabIndex={0}>
      <h2>Action Queue</h2>

      {loading && <p className="muted">Waiting for action data…</p>}

      {error && <p role="alert" style={{ color: '#ff6b6b' }}>⚠ {error}</p>}

      {!loading && !error && actions.length === 0 && (
        <p className="muted">No actions queued.</p>
      )}

      {actions.map((action, i) => (
        <div className="row" key={`${action.definitionId}-${i}`}>
          <span>{action.label}</span>
          <span className="muted">{statusBadge(action.status)}</span>
        </div>
      ))}
    </section>
  );
}
