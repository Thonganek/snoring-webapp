// Used by both the local server and the published Worker.
export function createSiteHandler({ html, configSource, supabaseUrl, publishableKey, fetcher = (...args) => fetch(...args) }) {
  const pages = new Map([
    ['/', [html, 'text/html; charset=utf-8']],
    ['/index.html', [html, 'text/html; charset=utf-8']],
    ['/app-config.js', [configSource, 'text/javascript; charset=utf-8']]
  ]);
  const endpoint = new URL('/functions/v1/snoring-api', supabaseUrl).href;
  const json = (status, message) => Response.json({ ok: false, message }, { status, headers: { 'Cache-Control': 'no-store' } });
  return async function handle(request) {
    const path = new URL(request.url).pathname;
    if (path === '/api') {
      if (request.method !== 'POST') return json(405, 'Method not allowed');
      // Sessions are sent explicitly in the JSON body; never forward site cookies or authorization.
      const origin = request.headers.get('origin');
      if (origin && origin !== new URL(request.url).origin) return json(403, 'Origin not allowed');
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return json(415, 'Expected JSON');
      const maxBytes = 1024 * 1024;
      if (Number(request.headers.get('content-length')) > maxBytes) return json(413, 'Request too large');
      const reader = request.body?.getReader();
      const chunks = [];
      let size = 0;
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) { await reader.cancel(); return json(413, 'Request too large'); }
          chunks.push(value);
        }
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const body = new TextDecoder().decode(bytes);
      try { JSON.parse(body); } catch { return json(400, 'Invalid JSON'); }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const upstream = await fetcher(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: publishableKey },
          body, redirect: 'error', signal: controller.signal
        });
        if (!upstream.headers.get('content-type')?.includes('application/json')) return json(502, 'ระบบฐานข้อมูลตอบกลับไม่สมบูรณ์ กรุณาลองใหม่');
        return new Response(await upstream.text(), { status: upstream.status, headers: {
          'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
        } });
      } catch (error) {
        console.error('Supabase gateway request failed:', error.name, error.message);
        return json(503, 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      } finally { clearTimeout(timeout); }
    }
    const item = pages.get(path);
    if (!item || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : item[0], { headers: {
      'Content-Type': item[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
    } });
  };
}
