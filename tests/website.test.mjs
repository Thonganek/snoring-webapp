import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('local website serves root index and public config without exposing backend files', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/serve.mjs', import.meta.url))], {
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  try {
    await Promise.race([
      once(child.stdout, 'data'),
      once(child, 'exit').then(([code]) => { throw new Error('Server exited: ' + code); })
    ]);
    const page = await fetch('http://127.0.0.1:5173/');
    assert.equal(page.status, 200);
    const html = await page.text();
    assert(html.includes('app-config.js'));
    assert(!html.includes('<?!='));
    assert.equal((await fetch('http://127.0.0.1:5173/app-config.js')).status, 200);
    assert.equal((await fetch('http://127.0.0.1:5173/Supabase/.env.example')).status, 404);
    assert.equal((await fetch('http://127.0.0.1:5173/Supabase/functions/snoring-api/app.js')).status, 404);
  } finally { child.kill(); }
});
