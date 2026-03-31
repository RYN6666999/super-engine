import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/smoke/**'],
    testTimeout: 15000,
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
});
