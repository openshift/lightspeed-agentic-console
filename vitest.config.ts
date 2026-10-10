import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', '.tekton/integration-tests/tests/**/*.test.ts'],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@openshift-console/dynamic-plugin-sdk': path.resolve(
        __dirname,
        'src/__mocks__/dynamic-plugin-sdk.ts',
      ),
    },
  },
});
