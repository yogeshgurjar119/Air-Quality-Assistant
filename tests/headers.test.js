import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { clientKey, describeError } from '../server/app.js';
import { HttpError } from '../server/errors.js';
import { cspHeaderValue, PERMISSIONS_POLICY } from '../server/securityHeaders.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

describe('security header policy (single source of truth)', () => {
  it('builds the CSP string from the directive map', () => {
    assert.equal(
      cspHeaderValue(),
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; " +
        "object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
  });

  it('is applied identically by vercel.json', () => {
    const headers = JSON.parse(read('vercel.json')).headers[0].headers;
    const value = (key) => headers.find((header) => header.key === key)?.value;
    assert.equal(value('Content-Security-Policy'), cspHeaderValue());
    assert.equal(value('Permissions-Policy'), PERMISSIONS_POLICY);
  });

  it('is applied identically by netlify.toml', () => {
    const toml = read('netlify.toml');
    assert.ok(toml.includes(`Content-Security-Policy = "${cspHeaderValue()}"`), 'CSP differs from the shared policy');
    assert.ok(toml.includes(`Permissions-Policy = "${PERMISSIONS_POLICY}"`), 'Permissions-Policy differs');
  });
});

describe('clientKey', () => {
  it('prefers the socket address, then the platform header, then the forwarded-for header', () => {
    const headers = { 'x-nf-client-connection-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1, 10.0.0.1' };
    assert.equal(clientKey({ ip: '192.0.2.1', headers }), '192.0.2.1');
    assert.equal(clientKey({ headers }), '203.0.113.7', 'a spoofable forwarded-for must not win');
    assert.equal(clientKey({ headers: { 'x-forwarded-for': '198.51.100.1, 10.0.0.1' } }), '198.51.100.1');
    assert.equal(clientKey({ headers: {} }), 'anonymous');
  });
});

describe('describeError', () => {
  it('maps known errors to safe client messages and flags only unexpected ones', () => {
    assert.deepEqual(describeError(new HttpError(404, 'Nope.')), { status: 404, message: 'Nope.' });
    assert.deepEqual(describeError({ type: 'entity.too.large' }), { status: 413, message: 'Request is too large.' });
    assert.deepEqual(describeError({ type: 'entity.parse.failed' }), { status: 400, message: 'Invalid JSON.' });
    assert.deepEqual(describeError(new Error('secret detail')), {
      status: 500,
      message: 'Something went wrong.',
      unexpected: true,
    });
  });
});
