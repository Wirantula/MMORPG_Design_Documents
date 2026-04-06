'use client';

import { useState, type FormEvent } from 'react';
import { readRuntimeConfig } from '../../../lib/config';

/**
 * Minimal admin login page. Not wrapped in the admin layout (no auth gate).
 * Stores the JWT in localStorage on success and redirects to /admin.
 */
export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { apiBaseUrl } = readRuntimeConfig();
      const res = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Login failed (${res.status})`);
      }

      const data = (await res.json()) as { accessToken: string };
      localStorage.setItem('admin_token', data.accessToken);
      window.location.href = '/admin';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="page"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <section className="panel" style={{ maxWidth: '360px', width: '100%' }}>
        <h2>Admin Login</h2>

        {error && (
          <p role="alert" style={{ color: '#ff6b6b' }}>
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label>
            <span className="muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem',
                marginTop: '0.25rem',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text)',
                fontFamily: 'inherit',
              }}
            />
          </label>

          <label>
            <span className="muted">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem',
                marginTop: '0.25rem',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text)',
                fontFamily: 'inherit',
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.5rem',
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              fontWeight: 'bold',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  );
}
