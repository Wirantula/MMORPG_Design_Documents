'use client';

import type { NotificationEntry } from '../lib/contracts';

export interface NotificationsPanelProps {
  notifications: NotificationEntry[];
  loading: boolean;
  error: string | null;
}

function levelIcon(level: NotificationEntry['level']): string {
  switch (level) {
    case 'info':
      return '•';
    case 'warn':
      return '⚠';
    case 'error':
      return '✗';
  }
}

export function NotificationsPanel({ notifications, loading, error }: NotificationsPanelProps) {
  return (
    <section className="panel" aria-label="Notifications" tabIndex={0}>
      <h2>Notifications</h2>

      {loading && <p className="muted">Waiting for notifications…</p>}

      {error && <p role="alert" style={{ color: '#ff6b6b' }}>⚠ {error}</p>}

      {!loading && !error && notifications.length === 0 && (
        <p className="muted">No notifications.</p>
      )}

      {notifications.map((n) => (
        <p
          key={n.id}
          className="muted"
          style={n.level === 'error' ? { color: '#ff6b6b' } : undefined}
        >
          {levelIcon(n.level)} {n.text}
        </p>
      ))}
    </section>
  );
}
