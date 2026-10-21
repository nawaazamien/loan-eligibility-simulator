import { defineConfig, devices } from '@playwright/test';

// E2E_BASE_URL points the suite at an already-running server (for example the Docker
// container on http://127.0.0.1:8080). Without it, Playwright builds the app and serves
// the production bundle with `vite preview`, never the dev server.
const externalBaseUrl = process.env.E2E_BASE_URL;
const baseURL = externalBaseUrl ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // The in-browser mock API starts a service worker before the page renders; under heavy
  // parallel load (several browsers at once) that start was measured taking up to ~20 s, so
  // assertions wait longer than Playwright's 5 s default. Real failures still fail, only later.
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    // Chromium runs the full suite (layout, interactions, axe) at three widths.
    {
      name: 'desktop',
      testIgnore: /(smoke|large-text)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'mobile',
      testIgnore: /(smoke|large-text)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 800 }, hasTouch: true },
    },
    {
      name: 'narrow-320',
      testIgnore: /(smoke|large-text)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 640 } },
    },
    // Firefox and WebKit run a core-flow smoke suite rather than every test again.
    // Playwright's WebKit is the WebKit engine on this OS, not Safari on a real iPhone.
    {
      name: 'firefox',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'firefox-large-text',
      testMatch: /large-text\.spec\.ts/,
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 360, height: 800 },
        launchOptions: { firefoxUserPrefs: { 'font.size.variable.x-western': 32 } },
      },
    },
    {
      name: 'webkit',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Safari'], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: 'npm run build && npm run preview -- --host 127.0.0.1',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
