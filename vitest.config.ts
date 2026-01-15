import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Global test settings
    globals: true, // No need to import describe, it, expect
    environment: 'happy-dom', // Faster than jsdom (per research.md RT-001)

    // Coverage configuration
    coverage: {
      provider: 'v8', // Faster than istanbul, native to V8 engine
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',

      // Global thresholds (FR-009)
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },

      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/main.ts', // Entry point, no logic
        'node_modules/**',
        'dist/',
        '**/*.config.*',
        'tests/setup.ts',
      ],
    },

    // Performance
    isolate: true, // Run each test file in isolation (prevents shared state)

    // Reporters
    reporters: ['verbose'], // Show detailed test output

    // Setup files
    setupFiles: ['./tests/setup.ts'], // Global test setup
  },
});
