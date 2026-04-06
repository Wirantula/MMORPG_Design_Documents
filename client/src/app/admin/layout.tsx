'use client';

import { useEffect, useState } from 'react';

/**
 * Admin layout: gates all /admin/* routes behind a localStorage JWT check.
 * If no token is found, redirects to /admin/login (a simple login form).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authorised, setAuthorised] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }
    setAuthorised(true);
  }, []);

  if (!authorised) {
    return (
      <main className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="muted">Checking admin credentials…</p>
      </main>
    );
  }

  return (
    <div>
      <nav
        style={{
          display: 'flex',
          gap: '1rem',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
        }}
      >
        <strong style={{ color: 'var(--accent)' }}>CybaWorld Admin</strong>
        <a href="/admin" style={{ color: 'var(--text)' }}>Dashboard</a>
        <a href="/admin/status" style={{ color: 'var(--text)' }}>Status</a>
        <a href="/admin/audit" style={{ color: 'var(--text)' }}>Audit Log</a>
        <button
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            cursor: 'pointer',
            borderRadius: '4px',
            padding: '0.25rem 0.5rem',
            fontFamily: 'inherit',
          }}
          onClick={() => {
            localStorage.removeItem('admin_token');
            window.location.href = '/admin/login';
          }}
        >
          Logout
        </button>
      </nav>
      <main className="page" style={{ gridTemplateColumns: '1fr' }}>
        {children}
      </main>
    </div>
  );
}
