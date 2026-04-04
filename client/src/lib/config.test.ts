import { describe, expect, it, beforeEach, afterEach } from 'vitest';

describe('readRuntimeConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns default values when env vars are not set', async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_WS_BASE_URL;

    const { readRuntimeConfig } = await import('./config');
    const config = readRuntimeConfig();

    expect(config.apiBaseUrl).toBe('http://localhost:1545/api');
    expect(config.wsBaseUrl).toBe('ws://localhost:1545/ws');
  });

  it('reads overridden env vars', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.cybaworld.com/api';
    process.env.NEXT_PUBLIC_WS_BASE_URL = 'wss://api.cybaworld.com/ws';

    const { readRuntimeConfig } = await import('./config');
    const config = readRuntimeConfig();

    expect(config.apiBaseUrl).toBe('https://api.cybaworld.com/api');
    expect(config.wsBaseUrl).toBe('wss://api.cybaworld.com/ws');
  });

  it('returns object with apiBaseUrl and wsBaseUrl keys', async () => {
    const { readRuntimeConfig } = await import('./config');
    const config = readRuntimeConfig();

    expect(config).toHaveProperty('apiBaseUrl');
    expect(config).toHaveProperty('wsBaseUrl');
    expect(typeof config.apiBaseUrl).toBe('string');
    expect(typeof config.wsBaseUrl).toBe('string');
  });
});
