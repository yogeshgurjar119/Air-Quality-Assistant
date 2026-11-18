import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { before, describe, it } from 'node:test';

const lambdaEvent = (path) => ({
  httpMethod: 'GET',
  path,
  headers: { host: 'example.netlify.app', 'x-forwarded-for': '203.0.113.9' },
  queryStringParameters: null,
  body: null,
  isBase64Encoded: false,
});

describe('serverless entry points', () => {
  let vercelApp;
  let netlifyHandler;

  before(async () => {
    // Hosts set these variables at runtime; they must be present before the app is built.
    process.env.NETLIFY = 'true';
    process.env.VERCEL = '1';
    vercelApp = (await import('../api/index.js')).default;
    netlifyHandler = (await import('../netlify/functions/api.js')).handler;
  });

  it('Vercel exports a request handler (Express app)', () => {
    assert.equal(typeof vercelApp, 'function');
  });

  it('Netlify serves /api/health whether invoked via the redirect or the function path', async () => {
    for (const path of ['/api/health', '/.netlify/functions/api/health']) {
      const result = await netlifyHandler(lambdaEvent(path), {});
      assert.equal(result.statusCode, 200, path);
      assert.equal(JSON.parse(result.body).status, 'ok');
    }
  });
});

describe('serverless bundling safety', () => {
  // Netlify bundles functions to CommonJS, where `import.meta` is empty. A module-level
  // `fileURLToPath(import.meta.url)` crashed the function on load (every /api route returned 502).
  const collect = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? collect(join(dir, entry.name)) : entry.name.endsWith('.js') ? [join(dir, entry.name)] : [],
    );
  const root = fileURLToPath(new URL('..', import.meta.url));
  const bundled = [...collect(join(root, 'server')), ...collect(join(root, 'api')), ...collect(join(root, 'netlify'))]
    // server/index.js is the local-only entry point and is never bundled for a host.
    .filter((file) => !file.endsWith(join('server', 'index.js')));

  it('keeps import.meta out of every module a serverless function loads', () => {
    assert.ok(bundled.length > 10, 'found the function module graph');
    const offenders = bundled.filter((file) => readFileSync(file, 'utf8').includes('import.meta'));
    assert.deepEqual(offenders, []);
  });

  it('builds the app without a static directory (CDN serves public/ on hosts)', async () => {
    const { createDefaultApp } = await import('../server/bootstrap.js');
    const { app } = createDefaultApp({});
    assert.equal(typeof app, 'function');
  });
});
