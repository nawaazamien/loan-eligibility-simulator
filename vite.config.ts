/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // Fonts are tiny woff2 subsets; keep them as files so the CSP stays font-src 'self'.
    assetsInlineLimit: 0,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    coverage: {
      provider: 'v8',
      // Reported for all application code; enforced only where the lending logic lives.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/**/*.d.ts'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        // The pure model and the form reducer decide every figure and outcome shown, so
        // each branch has a behavioural test. UI components are covered by component and
        // browser tests instead of a number.
        'src/features/loan-simulator/model/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'src/features/loan-simulator/formState.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'src/features/loan-simulator/expenseHelperState.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
