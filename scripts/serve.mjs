import http from 'node:http';
import fs from 'node:fs/promises';

// Serve only public assets; backend files and secrets never leave this server.
const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app-config.js', ['app-config.js', 'text/javascript; charset=utf-8']]
]);
http.createServer(async (request, response) => {
  const entry = publicFiles.get(new URL(request.url, 'http://localhost').pathname);
  if (!entry || request.method !== 'GET') { response.writeHead(404); response.end(); return; }
  try {
    response.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store' });
    response.end(await fs.readFile(new URL('../' + entry[0], import.meta.url)));
  } catch { response.writeHead(500); response.end('Unable to read file'); }
}).listen(5173, '127.0.0.1', () => console.log('Open http://localhost:5173'));
