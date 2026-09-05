import http from 'node:http';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { Readable } from 'node:stream';
import { createSiteHandler } from './site-handler.mjs';

// Serve only public assets; backend files and secrets never leave this server.
const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const configSource = await fs.readFile(new URL('../app-config.js', import.meta.url), 'utf8');
const context = vm.createContext({ window: {} });
new vm.Script(configSource).runInContext(context, { timeout: 1000 });
const handle = createSiteHandler({ html, configSource, ...context.window.SNORING_CONFIG });
http.createServer(async (request, response) => {
  try {
    const input = new Request(new URL(request.url, 'http://' + request.headers.host), {
      method: request.method, headers: request.headers,
      ...(!['GET', 'HEAD'].includes(request.method) ? { body: Readable.toWeb(request), duplex: 'half' } : {})
    });
    const output = await handle(input);
    response.writeHead(output.status, Object.fromEntries(output.headers));
    response.end(Buffer.from(await output.arrayBuffer()));
  } catch { response.writeHead(500); response.end('Unable to process request'); }
}).listen(5173, '127.0.0.1', () => console.log('Open http://localhost:5173'));
