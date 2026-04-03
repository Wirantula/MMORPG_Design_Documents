import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVER_PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().default('cybaworld'),
  POSTGRES_USER: z.string().default('cybaworld'),
  POSTGRES_PASSWORD: z.string().default('cybaworld_dev_password'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  WORLD_SEED_ISO: z.string().default('2200-01-01T00:00:00.000Z'),
  TIME_ACCELERATION: z.coerce.number().int().positive().default(30),
  TICK_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
});

export type AppEnv = {
  nodeEnv: 'development' | 'test' | 'production';
  serverPort: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  postgres: {
    host: string;
    port: number;
    db: string;
    user: string;
    password: string;
  };
  redis: {
    host: string;
    port: number;
  };
  simulation: {
    worldSeedMs: number;
    acceleration: number;
    tickIntervalMs: number;
  };
};

let cachedEnv: AppEnv | null = null;

export function loadEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.parse(process.env);
  cachedEnv = {
    nodeEnv: parsed.NODE_ENV,
    serverPort: parsed.SERVER_PORT,
    logLevel: parsed.LOG_LEVEL,
    postgres: {
      host: parsed.POSTGRES_HOST,
      port: parsed.POSTGRES_PORT,
      db: parsed.POSTGRES_DB,
      user: parsed.POSTGRES_USER,
      password: parsed.POSTGRES_PASSWORD,
    },
    redis: {
      host: parsed.REDIS_HOST,
      port: parsed.REDIS_PORT,
    },
    simulation: {
      worldSeedMs: new Date(parsed.WORLD_SEED_ISO).getTime(),
      acceleration: parsed.TIME_ACCELERATION,
      tickIntervalMs: parsed.TICK_INTERVAL_MS,
    },
  };

  return cachedEnv;
}
