export function createHandler({ app, env }) {
  return async function handle(request) {
    const origin = request.headers.get('origin') || '';
    const allowed = (env('APP_ALLOWED_ORIGINS') || 'http://localhost:5173').split(',').map(value => value.trim());
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowed.includes(origin)) return json({ ok: false, message: 'Origin not allowed' }, 403);
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'apikey, authorization, content-type, x-client-info';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405);
    try {
      if (Number(request.headers.get('content-length')) > 1000000) return json({ ok: false, message: 'Request too large' }, 413);
      const text = await request.text();
      if (text.length > 1000000) return json({ ok: false, message: 'Request too large' }, 413);
      const body = JSON.parse(text);
      if (!body || typeof body.method !== 'string' || !Object.prototype.hasOwnProperty.call(app, body.method)) return json({ ok: false, message: 'Method not allowed' }, 400);
      if (!Array.isArray(body.args) || body.args.length > 3) return json({ ok: false, message: 'Invalid arguments' }, 400);
      return json({ ok: true, result: await app[body.method](...body.args) });
    } catch (error) {
      return json({ ok: false, message: error instanceof SyntaxError ? 'Invalid JSON' : error.message || 'Request failed' }, 400);
    }
  };
}
