import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert(!/<\?!=|google\.script|script\.google|DriveApp|Google Drive/.test(index));
assert(!/sb_secret_|service_role/.test(index));
const app = fs.readFileSync(new URL('../Supabase/functions/snoring-api/app.js', import.meta.url), 'utf8');
assert(!/PropertiesService|Utilities|CacheService|MailApp|DriveApp|SpreadsheetApp/.test(app));
const exported = app.slice(app.lastIndexOf('return {'));
for (const [, script] of index.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  new vm.Script(script);
  for (const [, endpoint] of script.matchAll(/callServer\('([^']+)'/g)) assert(exported.includes(endpoint), 'Missing endpoint: ' + endpoint);
}
assert(index.includes('src="app-config.js"'));
console.log('Root index, inline scripts and Supabase endpoints passed.');
