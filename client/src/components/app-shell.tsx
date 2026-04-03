import { readRuntimeConfig } from '../lib/config';

const queue = ['Train strength (30m)', 'Gather wood (45m)', 'Deliver package (2h)'];
const notifications = [
  'Family support active for infant stage.',
  'Market board updated in settlement Northwatch.',
  'World tick processed successfully.',
];

export function AppShell() {
  const config = readRuntimeConfig();

  return (
    <main className="page">
      <section className="panel">
        <h2>Character</h2>
        <p>Name: <strong>Unborn Slot</strong></p>
        <p>Stage: <strong>Infant</strong></p>
        <p>Visible Stats: <span className="muted">Pending birth wheel</span></p>
        <p>Account Rule: <strong>1 living character</strong></p>
      </section>

      <section className="panel">
        <h2>Location + Time</h2>
        <p>Settlement: <strong>Northwatch</strong></p>
        <p>Node: <strong>Planet A-01 / District 3</strong></p>
        <p>World ratio: <strong>1 real day : 30 game days</strong></p>
        <p className="muted">API: {config.apiBaseUrl}</p>
      </section>

      <section className="panel">
        <h2>Action Queue</h2>
        {queue.map((action) => (
          <div className="row" key={action}>
            <span>{action}</span>
            <span className="muted">queued</span>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Chat</h2>
        <p className="muted">[Global] Welcome to CybaWorld foundation slice.</p>
        <p className="muted">[System] Realtime gateway contract loaded.</p>
      </section>

      <section className="panel">
        <h2>Notifications</h2>
        {notifications.map((notice) => (
          <p key={notice} className="muted">
            • {notice}
          </p>
        ))}
      </section>

      <section className="panel">
        <h2>Operational Status</h2>
        <p>Client shell: <strong>ready</strong></p>
        <p>Contract mode: <strong>foundation</strong></p>
        <p>Observability: <span className="muted">structured logs + runbooks seeded</span></p>
      </section>
    </main>
  );
}
