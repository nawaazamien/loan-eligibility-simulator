import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { mockSettings } from '../mock-api/handlers';
import { server } from './server';

// Any request that no handler answers fails the test instead of reaching the network.
beforeAll(() => {
  mockSettings.latencyMs = 0;
  server.listen({ onUnhandledRequest: 'error' });
});
afterAll(() => {
  server.close();
});

// jsdom has no layout: report a wide screen with no motion preference unless a test
// overrides it, and accept scroll requests. Real behaviour is covered by Playwright.
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })),
});
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  server.resetHandlers();
  cleanup();
});
