import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

/** The production security headers, from the nginx snippet (the single source). */
function nginxSecurityHeaders(): Map<string, string> {
  return new Map(
    [
      ...readFileSync('nginx/security-headers.conf', 'utf8').matchAll(
        /^add_header\s+(\S+)\s+"([^"]*)"\s+always;$/gm,
      ),
    ].map((match): [string, string] => [match[1] ?? '', match[2] ?? '']),
  );
}

/**
 * The Render Blueprint cannot include nginx's configuration, so it repeats the security
 * headers. This keeps the two identical. It reads files only and needs no browser, so it
 * runs in one project.
 */
test('render.yaml sends the same security headers as nginx', () => {
  test.skip(test.info().project.name !== 'desktop', 'Configuration check; one run is enough');

  const nginx = nginxSecurityHeaders();
  expect(nginx.size).toBe(5);

  // Rules for every path ("- path: /*"), with values quoted or plain.
  const render = new Map(
    [
      ...readFileSync('render.yaml', 'utf8').matchAll(
        /- path: \/\*\n\s+name: (\S+)\n\s+value: (?:"([^"]*)"|'([^']*)'|(.+))\n/g,
      ),
    ].map((match) => [match[1], match[2] ?? match[3] ?? match[4]?.trim()]),
  );
  expect(render).toEqual(nginx);
});

/**
 * The configuration files agreeing is not proof the server applies them, so this checks the
 * headers actually served by whichever server the suite targets: the preview, the container,
 * or the live demo (E2E_BASE_URL). The preview has no caching rules and falls back to the
 * page for unknown paths, so caching and the 404 are checked only on an external server.
 */
test('the server sends the production headers', async ({ request }) => {
  test.skip(test.info().project.name !== 'desktop', 'HTTP check; one run is enough');

  const expected = Object.fromEntries(
    [...nginxSecurityHeaders()].map(([name, value]) => [name.toLowerCase(), value]),
  );

  const index = await request.get('/');
  expect(index.status()).toBe(200);
  expect(index.headers()).toMatchObject(expected);

  const asset = /\/assets\/[^"]+\.js/.exec(await index.text())?.[0];
  if (!asset) throw new Error('index.html references no hashed script');
  const assetResponse = await request.get(asset);
  expect(assetResponse.status()).toBe(200);
  expect(assetResponse.headers()).toMatchObject(expected);

  if (process.env.E2E_BASE_URL) {
    expect(index.headers()['cache-control']).toBe('no-cache');
    expect(assetResponse.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
    expect((await request.get('/does-not-exist')).status()).toBe(404);
  }
});

/**
 * The in-browser mock API is a service worker, so its script is part of what the host must
 * serve: as JavaScript, from the site root (so its scope can be "/"), never cached for long,
 * and under the same security headers as everything else (docs/API.md).
 */
test('the mock API worker script is served as revalidated JavaScript', async ({ request }) => {
  test.skip(test.info().project.name !== 'desktop', 'HTTP check; one run is enough');

  const expected = Object.fromEntries(
    [...nginxSecurityHeaders()].map(([name, value]) => [name.toLowerCase(), value]),
  );
  const worker = await request.get('/mockServiceWorker.js');
  expect(worker.status()).toBe(200);
  expect(worker.headers()['content-type']).toMatch(/javascript/);
  expect(worker.headers()).toMatchObject(expected);
  expect(await worker.text()).toContain('Mock Service Worker');
  if (process.env.E2E_BASE_URL) {
    expect(worker.headers()['cache-control']).toBe('no-cache');
  }
});

test('render.yaml revalidates the worker script on every visit', () => {
  test.skip(test.info().project.name !== 'desktop', 'Configuration check; one run is enough');

  expect(readFileSync('render.yaml', 'utf8')).toMatch(
    /- path: \/mockServiceWorker\.js\n\s+name: Cache-Control\n\s+value: no-cache\n/,
  );
});
