import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Limit the number of workers to avoid OOM errors in CI
    // Testing on 2026-10-19, limiting to 8 workers didn't slow down the test execution
    maxWorkers: 8,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'integration-tests/support/**/*.test.ts'],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@openshift-console/dynamic-plugin-sdk': fileURLToPath(
        new URL('./src/__mocks__/dynamic-plugin-sdk.ts', import.meta.url),
      ),
    },
  },
});
