import test from 'node:test';
import assert from 'node:assert/strict';
import { createSiteHandler } from '../scripts/site-handler.mjs';

const config = { html: '<html>test</html>', configSource: '', supabaseUrl: 'https://example.supabase.co', publishableKey: 'public-key' };
const request = (body = { method: 'loginAdmin', args: ['test', 'test'] }, headers = {}) => new Request('https://site.test/api', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body)
});

test('same-origin API forwards to the fixed Supabase endpoint without website credentials', async () => {
  const handle = createSiteHandler({ ...config, fetcher: async (url, options) => {
    assert.equal(url, 'https://example.supabase.co/functions/v1/snoring-api');
    assert.deepEqual(options.headers, { 'Content-Type': 'application/json', apikey: 'public-key' });
    assert.deepEqual(JSON.parse(options.body), { method: 'loginAdmin', args: ['test', 'test'] });
    assert.equal(options.redirect, 'manual');
    return Response.json({ ok: false, message: 'Invalid credentials' }, { status: 400, headers: { 'set-cookie': 'upstream=secret' } });
  } });
  const response = await handle(request(undefined, {
    origin: 'https://site.test', cookie: 'site=secret', authorization: 'Bearer site-secret', 'OAI-Sites-Authorization': 'Bearer bypass-secret'
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, message: 'Invalid credentials' });
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('API rejects cross-origin requests, invalid bodies and unsupported methods before forwarding', async () => {
  let calls = 0;
  const handle = createSiteHandler({ ...config, fetcher: async () => { calls++; return Response.json({ ok: true }); } });
  assert.equal((await handle(request(undefined, { origin: 'https://other.test' }))).status, 403);
  assert.equal((await handle(request(undefined, { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await handle(request('{invalid'))).status, 400);
  assert.equal((await handle(request('x'.repeat(1024 * 1024 + 1)))).status, 413);
  assert.equal((await handle(new Request('https://site.test/api'))).status, 405);
  assert.equal(calls, 0);
});

test('upstream network failures and non-JSON responses produce actionable JSON errors', async () => {
  for (const fetcher of [async () => { throw new TypeError('Failed to fetch'); }, async () => new Response('<html>Unavailable</html>', { status: 503 }), async () => Response.json({}, { status: 302, headers: { location: 'https://other.test' } })]) {
    const handle = createSiteHandler({ ...config, fetcher });
    const response = await handle(request());
    assert([502, 503].includes(response.status));
    const result = await response.json();
    assert.equal(result.ok, false);
    assert(result.message.includes('กรุณาลองใหม่'));
    assert(!result.message.includes('Failed to fetch'));
  }
});
