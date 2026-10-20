import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

/**
 * The Render Blueprint cannot include nginx's configuration, so it repeats the security
 * headers. This keeps the two identical, so the live demo cannot drift from the container.
 * It reads files only and needs no browser, so it runs in one project.
 */
test('render.yaml sends the same security headers as nginx', () => {
  test.skip(test.info().project.name !== 'desktop', 'Configuration check; one run is enough');

  const nginx = new Map(
    [
      ...readFileSync('nginx/security-headers.conf', 'utf8').matchAll(
        /^add_header\s+(\S+)\s+"([^"]*)"\s+always;$/gm,
      ),
    ].map((match) => [match[1], match[2]]),
  );
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
