import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const source = await fs.readFile(new URL('app-config.js', root), 'utf8');
const context = vm.createContext({ window: {} });
new vm.Script(source).runInContext(context, { timeout: 1000 });
const config = context.window.SNORING_CONFIG;
assert(config, 'Missing SNORING_CONFIG');
const url = new URL(config.supabaseUrl);
assert(url.protocol === 'https:' && !/YOUR_PROJECT|REPLACE/i.test(url.href), 'Set the real Supabase project URL before publishing');
assert(typeof config.publishableKey === 'string' && !/REPLACE/i.test(config.publishableKey), 'Set the real Supabase public key before publishing');
if (!config.publishableKey.startsWith('sb_publishable_')) {
  let payload;
  try { payload = JSON.parse(Buffer.from(config.publishableKey.split('.')[1], 'base64url').toString()); } catch {}
  assert(payload?.role === 'anon', 'Only a publishable or legacy anon key may be published');
}

const output = new URL('dist/', root);
await fs.mkdir(output, { recursive: true });
// Refuse unexpected files instead of inadvertently publishing source or secrets.
const publicFiles = ['index.html', 'app-config.js'];
const existing = await fs.readdir(output);
assert(existing.every(name => publicFiles.includes(name) || name === 'server'), 'dist contains unexpected files; review before publishing');
for (const name of publicFiles) await fs.copyFile(new URL(name, root), new URL(name, output));
const server = new URL('server/', output);
await fs.mkdir(server, { recursive: true });
assert((await fs.readdir(server)).every(name => name === 'index.js'), 'Unexpected worker output');
const html = await fs.readFile(new URL('index.html', output), 'utf8');
const configSource = await fs.readFile(new URL('app-config.js', output), 'utf8');
const worker = `const pages = new Map(${JSON.stringify([
  ['/', [html, 'text/html; charset=utf-8']],
  ['/index.html', [html, 'text/html; charset=utf-8']],
  ['/app-config.js', [configSource, 'text/javascript; charset=utf-8']]
])});
export default { async fetch(request) {
  const item = pages.get(new URL(request.url).pathname);
  if (!item || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', { status: 404 });
  return new Response(request.method === 'HEAD' ? null : item[0], { headers: {
    'Content-Type': item[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
  } });
} };
`;
await fs.writeFile(new URL('index.js', server), worker);
console.log('Public website and Sites worker built in dist/; only public assets are served.');
