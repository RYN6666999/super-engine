import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/smoke/**/*.test.ts'],
    testTimeout: 180_000, // 3 min for real browser ops
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
});
