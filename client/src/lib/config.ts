const DEFAULT_API_BASE = 'http://localhost:1545/api';
const DEFAULT_WS_BASE = 'ws://localhost:1545/ws';

export interface RuntimeConfig {
  apiBaseUrl: string;
  wsBaseUrl: string;
}

export function readRuntimeConfig(): RuntimeConfig {
  return {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE,
    wsBaseUrl: process.env.NEXT_PUBLIC_WS_BASE_URL ?? DEFAULT_WS_BASE,
  };
}
