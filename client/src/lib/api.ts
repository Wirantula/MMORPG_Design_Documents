import { readRuntimeConfig } from './config';

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  simulation: {
    realtimeUtc: string;
    worldUtc: string;
    acceleration: number;
    realtimeDayToWorldDayRatio: string;
  };
}

export async function fetchHealth(): Promise<HealthResponse> {
  const { apiBaseUrl } = readRuntimeConfig();
  const response = await fetch(`${apiBaseUrl}/health`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
