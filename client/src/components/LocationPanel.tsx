'use client';

export interface LocationPanelProps {
  settlement: string;
  node: string;
  worldUtc: string;
  realtimeUtc: string;
  acceleration: number;
  loading: boolean;
  error: string | null;
}

export function LocationPanel({
  settlement,
  node,
  worldUtc,
  realtimeUtc,
  acceleration,
  loading,
  error,
}: LocationPanelProps) {
  return (
    <section className="panel" aria-label="Location and Time" tabIndex={0}>
      <h2>Location + Time</h2>

      {loading && <p className="muted">Waiting for world snapshot…</p>}

      {error && <p role="alert" style={{ color: '#ff6b6b' }}>⚠ {error}</p>}

      {!loading && !error && (
        <>
          <p>Settlement: <strong>{settlement || '—'}</strong></p>
          <p>Node: <strong>{node || '—'}</strong></p>
          <p>World UTC: <strong>{worldUtc || '—'}</strong></p>
          <p>Real UTC: <span className="muted">{realtimeUtc || '—'}</span></p>
          <p>World ratio: <strong>1 real day : {acceleration} game days</strong></p>
        </>
      )}
    </section>
  );
}
