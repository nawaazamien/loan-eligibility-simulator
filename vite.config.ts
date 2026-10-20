/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The production security headers, read from the nginx snippet so there is one source. The
 * preview server sends them too, so local browser tests run under the same CSP as the
 * container and the Render site (render.yaml mirrors them; e2e/hosting-config.spec.ts checks).
 */
const securityHeaders = Object.fromEntries(
  [
    ...readFileSync(new URL('./nginx/security-headers.conf', import.meta.url), 'utf8').matchAll(
      /^add_header\s+(\S+)\s+"([^"]*)"\s+always;$/gm,
    ),
  ].map((match) => [match[1], match[2]]),
);

export default defineConfig({
  plugins: [react()],
  build: {
    // Fonts are tiny woff2 subsets; keep them as files so the CSP stays font-src 'self'.
    assetsInlineLimit: 0,
  },
  preview: {
    port: 4173,
    strictPort: true,
    headers: securityHeaders,
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
