import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { writeReportAssets } from './report-assets.mjs';

const root = new URL('../', import.meta.url);
const source = await fs.readFile(new URL('app-config.js', root), 'utf8');
const context = vm.createContext({ window: {} });
new vm.Script(source).runInContext(context, { timeout: 1000 });
const config = context.window.SNORING_CONFIG;
assert(config, 'Missing public Supabase config');
assert(new URL(config.supabaseUrl).protocol === 'https:', 'Supabase must use HTTPS');
assert(!/YOUR_PROJECT|REPLACE/.test(config.supabaseUrl + config.publishableKey), 'Configure Supabase before publishing');
if (!config.publishableKey?.startsWith('sb_publishable_')) {
  const payload = JSON.parse(Buffer.from(config.publishableKey.split('.')[1], 'base64url').toString());
  assert.equal(payload.role, 'anon', 'Only a public key may be published');
}
// GitHub Pages serves static files. Its browser calls the Supabase Edge API directly.
const output = new URL('dist-pages/', root);
await fs.mkdir(output, { recursive: true });
assert((await fs.readdir(output)).every(name => ['index.html', 'app-config.js', '.nojekyll', 'assets'].includes(name)), 'Unexpected files in Pages build');
await fs.copyFile(new URL('index.html', root), new URL('index.html', output));
await fs.writeFile(new URL('app-config.js', output), '// Public configuration only.\nwindow.SNORING_CONFIG = Object.freeze(' + JSON.stringify({ ...config, apiMode: 'supabase' }, null, 2) + ');\n');
await fs.writeFile(new URL('.nojekyll', output), '');
await writeReportAssets(output);
console.log('GitHub Pages website built in dist-pages/ with public report assets.');
