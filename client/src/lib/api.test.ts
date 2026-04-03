import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { HealthResponse } from './api';

const mockHealthResponse: HealthResponse = {
  status: 'ok',
  uptimeSeconds: 120,
  simulation: {
    realtimeUtc: '2026-04-03T09:00:00.000Z',
    worldUtc: '2200-01-01T00:00:00.000Z',
    acceleration: 30,
    realtimeDayToWorldDayRatio: '1:30',
  },
};

describe('fetchHealth', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns parsed health data on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHealthResponse),
    });

    const { fetchHealth } = await import('./api');
    const result = await fetchHealth();

    expect(result.status).toBe('ok');
    expect(result.uptimeSeconds).toBe(120);
    expect(result.simulation.acceleration).toBe(30);
    expect(result.simulation.realtimeDayToWorldDayRatio).toBe('1:30');
  });

  it('calls the correct URL with expected headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHealthResponse),
    });
    globalThis.fetch = mockFetch;

    const { fetchHealth } = await import('./api');
    await fetchHealth();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/health');
    expect(options.method).toBe('GET');
    expect(options.headers.Accept).toBe('application/json');
    expect(options.cache).toBe('no-store');
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const { fetchHealth } = await import('./api');
    await expect(fetchHealth()).rejects.toThrow('Health request failed with status 503');
  });

  it('throws on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { fetchHealth } = await import('./api');
    await expect(fetchHealth()).rejects.toThrow('Network error');
  });
});
