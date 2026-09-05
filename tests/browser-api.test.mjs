import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('    async function callServer(');
const code = html.slice(start, html.indexOf('    function goWorkflow(', start));

test('browser API supports Supabase on Pages and same-origin API on server hosting', async () => {
  for (const direct of [false, true]) {
    const config = { supabaseUrl: 'https://example.supabase.co/', publishableKey: 'public-key', ...(direct ? { apiMode: 'supabase' } : {}) };
    const context = vm.createContext({
      window: { SNORING_CONFIG: config }, location: { protocol: 'https:' }, AbortSignal,
      fetch: async (url, options) => {
        assert.equal(url, direct ? 'https://example.supabase.co/functions/v1/snoring-api' : '/api');
        assert.equal(options.headers.apikey, direct ? 'public-key' : undefined);
        assert.deepEqual(JSON.parse(options.body), { method: 'loginAdmin', args: ['test', 'test'] });
        return Response.json({ ok: true, result: { role: 'admin' } });
      }
    });
    new vm.Script(code).runInContext(context);
    assert.equal((await context.callServer('loginAdmin', ['test', 'test'])).role, 'admin');
  }
});
