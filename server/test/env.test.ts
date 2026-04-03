import { describe, expect, it, beforeEach, afterEach } from 'vitest';

// loadEnv caches its result, so we need a fresh module for each test.
// We use dynamic imports with cache-busting via vi.resetModules.
import { vi } from 'vitest';

describe('loadEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Clear any previously cached env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns defaults when no env vars are set', async () => {
    // Remove all relevant env vars to use defaults
    delete process.env.NODE_ENV;
    delete process.env.SERVER_PORT;
    delete process.env.LOG_LEVEL;
    delete process.env.POSTGRES_HOST;
    delete process.env.POSTGRES_PORT;
    delete process.env.POSTGRES_DB;
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_PASSWORD;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;

    const { loadEnv } = await import('../src/config/env');
    const env = loadEnv();

    expect(env.nodeEnv).toBe('development');
    expect(env.serverPort).toBe(3001);
    expect(env.logLevel).toBe('info');
    expect(env.postgres.host).toBe('localhost');
    expect(env.postgres.port).toBe(5432);
    expect(env.postgres.db).toBe('cybaworld');
    expect(env.redis.host).toBe('localhost');
    expect(env.redis.port).toBe(6379);
  });

  it('parses overridden env vars correctly', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SERVER_PORT = '4000';
    process.env.LOG_LEVEL = 'debug';
    process.env.POSTGRES_HOST = 'db.prod.internal';
    process.env.POSTGRES_PORT = '5433';
    process.env.POSTGRES_DB = 'cybaworld_prod';
    process.env.POSTGRES_USER = 'admin';
    process.env.POSTGRES_PASSWORD = 'super_secret';
    process.env.REDIS_HOST = 'redis.prod.internal';
    process.env.REDIS_PORT = '6380';

    const { loadEnv } = await import('../src/config/env');
    const env = loadEnv();

    expect(env.nodeEnv).toBe('production');
    expect(env.serverPort).toBe(4000);
    expect(env.logLevel).toBe('debug');
    expect(env.postgres.host).toBe('db.prod.internal');
    expect(env.postgres.port).toBe(5433);
    expect(env.postgres.db).toBe('cybaworld_prod');
    expect(env.postgres.user).toBe('admin');
    expect(env.postgres.password).toBe('super_secret');
    expect(env.redis.host).toBe('redis.prod.internal');
    expect(env.redis.port).toBe(6380);
  });

  it('rejects invalid NODE_ENV value', async () => {
    process.env.NODE_ENV = 'staging';

    const { loadEnv } = await import('../src/config/env');
    expect(() => loadEnv()).toThrow();
  });

  it('rejects non-numeric SERVER_PORT', async () => {
    process.env.SERVER_PORT = 'not_a_number';

    const { loadEnv } = await import('../src/config/env');
    expect(() => loadEnv()).toThrow();
  });

  it('rejects invalid LOG_LEVEL', async () => {
    process.env.LOG_LEVEL = 'trace';

    const { loadEnv } = await import('../src/config/env');
    expect(() => loadEnv()).toThrow();
  });

  it('coerces string port values to numbers', async () => {
    process.env.SERVER_PORT = '8080';
    process.env.POSTGRES_PORT = '15432';
    process.env.REDIS_PORT = '16379';

    const { loadEnv } = await import('../src/config/env');
    const env = loadEnv();

    expect(typeof env.serverPort).toBe('number');
    expect(env.serverPort).toBe(8080);
    expect(typeof env.postgres.port).toBe('number');
    expect(env.postgres.port).toBe(15432);
    expect(typeof env.redis.port).toBe('number');
    expect(env.redis.port).toBe(16379);
  });
});
