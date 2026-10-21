import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

/**
 * Starts the in-browser mock API: a Mock Service Worker answering the four loan endpoints
 * for this page. It is awaited before the app renders, so no request is ever made before it
 * is ready. Requests outside /api (the page, scripts, fonts) pass straight through, and every
 * unknown /api path is answered by the mock itself, so nothing under /api reaches the host.
 *
 * The worker keeps no state and stores nothing: it only turns a request into a response.
 */
let attempt: Promise<void> | null = null;

export function startMockApi(): Promise<void> {
  // One attempt at a time: a repeat call (a retry, a second render) gets the attempt already in
  // flight, so the worker is never set up twice. A failed attempt is forgotten so a retry can
  // start a new one.
  attempt ??= begin().catch((error: unknown) => {
    attempt = null;
    throw error;
  });
  return attempt;
}

async function begin(): Promise<void> {
  const worker = setupWorker(...handlers);
  await worker.start({
    serviceWorker: { url: '/mockServiceWorker.js' },
    onUnhandledRequest: 'bypass',
    quiet: true,
  });
}
