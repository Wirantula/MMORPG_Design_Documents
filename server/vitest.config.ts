import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'test/security/**/*.test.ts'],
    environment: 'node',
  },
  server: {
    host: '127.0.0.1',
  },
});
