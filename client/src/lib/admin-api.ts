import { readRuntimeConfig } from './config';

// ── Response types matching server DTOs ──────────────────────────────

export interface AdminDashboardStatus {
  serverUptimeSeconds: number;
  connectedClients: number;
  activeCharacters: number;
  lastTickAt: string;
  maintenanceMode: boolean;
}

export interface ServiceStatus {
  database: 'connected' | 'unavailable';
  redis: 'connected' | 'unavailable';
  tickHealth: 'healthy' | 'degraded' | 'stalled';
  lastTickDurationMs: number;
  tickDriftMs: number;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  target: Record<string, unknown> | null;
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiBaseUrl } = readRuntimeConfig();
  const res = await fetch(`${apiBaseUrl}/admin${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
    cache: 'no-store',
  });

  if (res.status === 401 || res.status === 403) {
    // Clear stale token and redirect
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`Admin request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

// ── Public API ───────────────────────────────────────────────────────

export function fetchDashboard(): Promise<AdminDashboardStatus> {
  return adminFetch<AdminDashboardStatus>('/dashboard');
}

export function fetchServiceStatus(): Promise<ServiceStatus> {
  return adminFetch<ServiceStatus>('/status');
}

export function toggleMaintenance(enabled: boolean): Promise<{ maintenanceMode: boolean }> {
  return adminFetch<{ maintenanceMode: boolean }>('/maintenance', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

export function fetchAuditLog(): Promise<AuditLogEntry[]> {
  return adminFetch<AuditLogEntry[]>('/audit-log');
}
