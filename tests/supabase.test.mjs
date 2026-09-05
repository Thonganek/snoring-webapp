import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createApplication } from '../Supabase/functions/snoring-api/app.js';
import { createHandler } from '../Supabase/functions/snoring-api/handler.js';

async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
  const migrations = fs.readdirSync(new URL('../Supabase/migrations/', import.meta.url)).sort();
  for (let i = 0; i < 2; i++) for (const name of migrations) await db.exec(fs.readFileSync(new URL('../Supabase/migrations/' + name, import.meta.url), 'utf8'));
  const config = { SUPABASE_URL: 'https://test.supabase.co', APP_SUPABASE_SECRET_KEY: 'sb_secret_test', APP_SECRET: 'a-random-test-secret-with-at-least-32-characters', ADMIN_USERNAME: 'staff', ADMIN_PASSWORD: 'test-password', APP_ALLOWED_ORIGINS: 'http://localhost:5173' };
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push({ url, options });
    const parsed = new URL(url);
    const table = parsed.pathname.split('/').pop();
    assert(/^[a-z_]+$/.test(table));
    const params = parsed.searchParams;
    const values = [];
    const bind = value => { values.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : value); return '$' + values.length; };
    const filters = [...params].filter(([, value]) => value.startsWith('eq.'));
    const where = () => filters.length ? ' WHERE ' + filters.map(([key, value]) => { assert(/^[a-z_]+$/.test(key)); return key + '=' + bind(value.slice(3)); }).join(' AND ') : '';
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      const columns = Object.keys(body);
      assert(columns.every(key => /^[a-z_][a-z_0-9]*$/.test(key)));
      await db.query(`INSERT INTO public.${table} (${columns.join(',')}) VALUES (${columns.map(key => bind(body[key])).join(',')})`, values);
      return new Response(null, { status: 201 });
    }
    if (options.method === 'PATCH') {
      const body = JSON.parse(options.body);
      const set = Object.entries(body).map(([key, value]) => { assert(/^[a-z_]+$/.test(key)); return key + '=' + bind(value); }).join(',');
      await db.query(`UPDATE public.${table} SET ${set}${where()}`, values);
      return new Response(null, { status: 204 });
    }
    const clause = where();
    const count = (await db.query(`SELECT count(*)::integer AS total FROM public.${table}${clause}`, values)).rows[0].total;
    const fields = params.get('select') || '*';
    assert(/^[a-z_0-9,*]+$/.test(fields));
    const order = (params.get('order') || '').split(',').filter(Boolean).map(item => {
      const [column, direction] = item.split('.');
      assert(/^[a-z_]+$/.test(column) && ['asc', 'desc'].includes(direction));
      return column + ' ' + direction;
    });
    const sql = `SELECT ${fields} FROM public.${table}${clause}${order.length ? ' ORDER BY ' + order.join(',') : ''} LIMIT ${Number(params.get('limit') || 1000)} OFFSET ${Number(params.get('offset') || 0)}`;
    const { rows } = await db.query(sql, values);
    return Response.json(rows, { headers: { 'content-range': '*/' + count } });
  };
  const objects = new Map();
  const storage = { from: bucket => {
    assert.equal(bucket, 'screening-videos');
    return {
      createSignedUploadUrl: async path => ({ data: { signedUrl: 'https://test.supabase.co/upload/' + path } }),
      list: async (folder, options) => ({ data: objects.has(folder + '/' + options.search) ? [{ name: options.search, metadata: objects.get(folder + '/' + options.search) }] : [] }),
      createSignedUrl: async (path, seconds) => { assert.equal(seconds, 600); return { data: { signedUrl: 'https://test.supabase.co/signed/' + path } }; }
    };
  } };
  const env = name => config[name] || '';
  const app = createApplication({ env, fetcher, storage });
  return { db, app, config, objects, requests, handler: createHandler({ app, env }) };
}
const child = { childCidNumber: '1234567890123', birthDate: '2020-01-02', childName: 'เด็กทดสอบ', nickname: 'ทดสอบ', weightKg: 20, heightCm: 110 };

test('report: full pagination, Thai date boundaries, scopes and clinical/admin permissions', async () => {
  const { app, db } = await fixture();
  try {
    const parent = await app.registerChildPublic(child);
    const admin = await app.loginAdmin('staff', 'test-password');
    await assert.rejects(app.getReportData(parent.token, {}));
    await assert.rejects(app.getReportData('invalid', {}));
    const demo = await app.saveChildProfile(admin.token, { ...child, childCidNumber: '', childName: 'Demo report', consentVersion: 'demo-data' });
    const demoId = demo.child.childId;
    await db.query(`INSERT INTO screenings (screening_id,child_id,submitted_at,osa18_total,risk_level,clinical_status)
      SELECT 'report-' || n, $1, '2026-09-04T17:00:00Z'::timestamptz,36,'low','new' FROM generate_series(1,1001) n`, [parent.child.childId]);
    await db.query(`INSERT INTO screenings (screening_id,child_id,submitted_at) VALUES
      ('before',$1,'2026-09-04T16:59:59Z'),('after',$1,'2026-09-05T17:00:00Z'),('demo',$2,'2026-09-05T16:59:59Z')`, [parent.child.childId, demoId]);
    const all = await app.getReportData(admin.token, { includeAudit: true });
    assert.equal(all.children.length, 2);
    assert.equal(all.screenings.length, 1004);
    assert.equal(new Set(all.screenings.map(row=>row.screeningId)).size, 1004);
    assert.equal(all.children.filter(row=>row.isTestData).length, 1);
    assert.equal(all.users.length, 2);
    assert(all.auditLogs.length > 0);
    assert.equal(all.schema.osa18Items.length, 18);
    const serialized = JSON.stringify(all);
    for (const secret of [child.childCidNumber, parent.token, admin.token, 'test-password', 'a-random-test-secret-with-at-least-32-characters']) assert(!serialized.includes(secret));
    const day = await app.getReportData(admin.token, { from: '2026-09-05', to: '2026-09-05', scope: 'real' });
    assert.equal(day.screenings.length, 1001);
    assert.equal(day.children.length, 1);
    assert(day.screenings.every(row=>row.screeningId.startsWith('report-')));
    const testOnly = await app.getReportData(admin.token, { scope: 'test' });
    assert.deepEqual(testOnly.screenings.map(row=>row.screeningId), ['demo']);
    assert.equal(testOnly.children[0].childId, demoId);
    for (const options of [{from:'2026-02-30'},{from:'2026-09-06',to:'2026-09-05'},{scope:'invalid'}]) await assert.rejects(app.getReportData(admin.token, options));
    await app.updateUserByAdmin(admin.token, { userId: parent.user.userId, role: 'nurse' });
    const clinical = await app.getReportData(parent.token, { includeAudit: true });
    assert.equal(clinical.screenings.length, 1004);
    assert.equal(clinical.adminSections, false);
    assert.equal(clinical.filters.includeAudit, false);
    assert.deepEqual(clinical.users, []);
    assert.deepEqual(clinical.auditLogs, []);
  } finally { await db.close(); }
});

test('Supabase database: repeatable migrations, RLS and private video bucket', async () => {
  const { db } = await fixture();
  try {
    const tables = (await db.query("SELECT relname, relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid = relnamespace WHERE nspname='public' AND relkind='r'")).rows;
    assert.equal(tables.length, 7);
    assert(tables.every(table => table.relrowsecurity));
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      for (const { relname } of tables) await assert.rejects(db.query('SELECT * FROM public.' + relname), /permission denied/);
      await db.exec('RESET ROLE');
    }
    const bucket = (await db.query('SELECT * FROM storage.buckets')).rows[0];
    assert.equal(bucket.public, false);
    assert.equal(Number(bucket.file_size_limit), 52428800);
  } finally { await db.close(); }
});

test('register, assess, revisit and staff review through asynchronous Supabase API', async () => {
  const { app, db, requests } = await fixture();
  try {
    const registration = await app.registerChildPublic(child);
    const schema = (await app.apiBootstrap(registration.token)).schema;
    const answers = Object.fromEntries(schema.osa18Items.map(item => [item.key, 1]));
    const assessment = await app.submitScreening(registration.token, { childId: registration.child.childId, osa18Answers: answers, coreAnswers: { loudSnoring: false }, riskFactors: { tonsilAdenoid: false } });
    assert.equal(assessment.score.osa18Total, 18);
    assert.equal((await app.listParentDashboard(registration.token, true)).screenings.length, 1);
    const login = await app.loginWithCid(child.childCidNumber, child.birthDate);
    assert.equal((await app.listParentDashboard(login.token, true)).children.length, 1);
    await assert.rejects(app.loginWithCid(child.childCidNumber, '2019-01-01'), /วันเกิด/);
    await assert.rejects(app.registerChildPublic(child), /ลงทะเบียนไว้แล้ว/);
    const admin = await app.loginAdmin('staff', 'test-password');
    await app.saveClinicalReview(admin.token, { screeningId: assessment.screening.screeningId, clinicalStatus: 'reviewed', reviewerNotes: 'ทดสอบ' });
    assert.equal((await db.query('SELECT reviewer_notes FROM screenings')).rows[0].reviewer_notes, 'ทดสอบ');
    const dashboard = await app.listAdminDashboard(admin.token, true);
    assert(dashboard.ok);
    assert.deepEqual(dashboard.screenings[0].osa18Answers, answers);
    assert.deepEqual(dashboard.screenings[0].coreAnswers, { loudSnoring: false });
    assert.deepEqual(dashboard.screenings[0].riskFactors, { tonsilAdenoid: false });
    assert.equal(dashboard.screenings[0].reviewerNotes, 'ทดสอบ');
    await assert.rejects(app.listAdminDashboard(registration.token, true), /admin/);
    assert(requests.every(request => request.options.headers.apikey === 'sb_secret_test'));
  } finally { await db.close(); }
});

test('private storage upload validates ownership and completion before signing read URLs', async () => {
  const { app, db, objects } = await fixture();
  try {
    const first = await app.registerChildPublic(child);
    const other = await app.registerChildPublic({ ...child, childCidNumber: '9876543210123' });
    const schema = (await app.apiBootstrap(first.token)).schema;
    const screening = await app.submitScreening(first.token, { childId: first.child.childId, osa18Answers: Object.fromEntries(schema.osa18Items.map(item => [item.key, 1])) });
    const payload = { screeningId: screening.screening.screeningId, fileName: 'sleep.mp4', mimeType: 'video/mp4', sizeBytes: 1024 };
    await assert.rejects(app.prepareVideoUpload(other.token, payload), /สิทธิ์/);
    await assert.rejects(app.prepareVideoUpload(first.token, { ...payload, sizeBytes: 52428801 }), /50 MB/);
    const prepared = await app.prepareVideoUpload(first.token, payload);
    await assert.rejects(app.completeVideoUpload(first.token, prepared.videoId), /ไม่ครบ/);
    const stored = (await db.query('SELECT storage_path FROM videos')).rows[0];
    objects.set(stored.storage_path, { size: 1024, mimetype: 'video/mp4' });
    const completed = await app.completeVideoUpload(first.token, prepared.videoId);
    assert(completed.video.url.includes('/signed/'));
    await assert.rejects(app.getVideoUrl(other.token, prepared.videoId), /สิทธิ์/);
    await app.revokeSession(first.token);
    await assert.rejects(app.getVideoUrl(first.token, prepared.videoId), /เข้าสู่ระบบ/);
  } finally { await db.close(); }
});

test('HTTP handler: CORS, malformed input, method allowlist and protected access', async () => {
  const { app, handler, db } = await fixture();
  const send = (body, origin = 'http://localhost:5173') => handler(new Request('https://test/api', { method: 'POST', headers: { origin }, body: JSON.stringify(body) }));
  try {
    assert.equal((await send({ method: 'apiBootstrap', args: [] })).status, 200);
    assert.equal((await send({ method: 'constructor', args: [] })).status, 400);
    assert.equal((await send({ method: 'apiBootstrap', args: [] }, 'https://untrusted.example')).status, 403);
    const preflight = await handler(new Request('https://test/api', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }));
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(preflight.status, 204);
    await assert.rejects(app.listAdminDashboard('invalid'), /เข้าสู่ระบบ/);
    await assert.rejects(app.loginAdmin('staff', 'wrong'), /ไม่ถูกต้อง/);
    const user = await app.registerChildPublic(child);
    await assert.rejects(app.listAdminDashboard(user.token), /admin/);
    await db.query("UPDATE users SET status='disabled' WHERE user_id=$1", [user.user.userId]);
    await assert.rejects(app.listParentDashboard(user.token), /เข้าสู่ระบบ/);
  } finally { await db.close(); }
});
