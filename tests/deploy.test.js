import assert from 'node:assert/strict';
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
