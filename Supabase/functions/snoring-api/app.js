export function createApplication({ env, fetcher = fetch, storage }) {
const APP_CONFIG = {
  appName: 'Snoring Child OSA Screening',
  version: 'Supabase 1.0',
  sessionDays: 7,
  tables: {
    users: 'Users',
    sessions: 'Sessions',
    children: 'Children',
    screenings: 'Screenings',
    videos: 'Videos',
    auditLogs: 'AuditLogs'
  }
};
const TABLE_FIELDS = {
  Users: ['userId', 'role', 'email', 'displayName', 'phone', 'status', 'createdAt', 'lastLoginAt'],
  Sessions: ['sessionId', 'userId', 'tokenHash', 'expiresAt', 'createdAt', 'revokedAt'],
  Children: ['childId', 'parentId', 'childCode', 'childName', 'nickname', 'sex', 'birthDate', 'ageYears', 'weightKg', 'heightCm', 'bmi', 'tonsilSize', 'adenoidXrayResult', 'childCidNumber', 'comorbiditiesJson', 'consentVersion', 'notes', 'createdAt', 'updatedAt'],
  Screenings: ['screeningId', 'childId', 'parentId', 'submittedAt', 'coreAnswersJson', 'osa18AnswersJson', 'riskFactorsJson', 'osa18Total', 'osa18Group', 'riskLevel', 'recommendation', 'clinicalStatus', 'reviewerNotes', 'updatedAt'],
  Videos: ['videoId', 'screeningId', 'childId', 'parentId', 'storagePath', 'fileName', 'mimeType', 'sizeBytes', 'uploadedAt', 'uploadStatus', 'aiStatus', 'aiResultJson', 'aiConfidence', 'reviewStatus', 'reviewerNotes', 'updatedAt'],
  AuditLogs: ['logId', 'actorUserId', 'action', 'targetType', 'targetId', 'createdAt', 'detailJson']
};
for (const table of ['Children','Screenings','Videos']) TABLE_FIELDS[table].push('deletedAt');
const SUPABASE_TABLES = {
  Users: {
    table: 'users',
    primaryKey: 'userId',
    orderBy: 'createdAt',
    timestampFields: ['createdAt', 'lastLoginAt']
  },
  Sessions: {
    table: 'sessions',
    primaryKey: 'sessionId',
    orderBy: 'createdAt',
    timestampFields: ['expiresAt', 'createdAt', 'revokedAt']
  },
  Children: {
    table: 'children',
    primaryKey: 'childId',
    orderBy: 'createdAt',
    jsonFields: ['comorbiditiesJson'],
    numberFields: ['ageYears', 'weightKg', 'heightCm', 'bmi'],
    dateFields: ['birthDate'],
    timestampFields: ['createdAt', 'updatedAt']
  },
  Screenings: {
    table: 'screenings',
    primaryKey: 'screeningId',
    orderBy: 'submittedAt',
    jsonFields: ['coreAnswersJson', 'osa18AnswersJson', 'riskFactorsJson'],
    numberFields: ['osa18Total'],
    timestampFields: ['submittedAt', 'updatedAt']
  },
  Videos: {
    table: 'videos',
    primaryKey: 'videoId',
    orderBy: 'uploadedAt',
    jsonFields: ['aiResultJson'],
    numberFields: ['sizeBytes', 'aiConfidence'],
    timestampFields: ['uploadedAt', 'updatedAt']
  },
  AuditLogs: {
    table: 'audit_logs',
    primaryKey: 'logId',
    orderBy: 'createdAt',
    jsonFields: ['detailJson'],
    timestampFields: ['createdAt']
  }
};
for (const table of ['Children','Screenings','Videos']) SUPABASE_TABLES[table].timestampFields.push('deletedAt');
const CORE_QUESTIONS = [{
  key: 'shakeToBreathe',
  label: 'ผู้ปกครองต้องเขย่าตัวเด็กขณะหลับเพื่อกระตุ้นให้หายใจ'
}, {
  key: 'witnessedApnea',
  label: 'เด็กมีการหยุดหายใจขณะหลับ'
}, {
  key: 'breathingDifficulty',
  label: 'เด็กมีอาการหายใจลำบากขณะหลับ'
}, {
  key: 'caregiverConcernBreathing',
  label: 'ผู้ปกครองกังวลกับการหายใจของลูกขณะหลับ'
}, {
  key: 'loudSnoring',
  label: 'ระดับความดังของเสียงกรน'
}, {
  key: 'frequentSnoring',
  label: 'ความถี่หรือความบ่อยของการกรน'
}];
const OSA18_ITEMS = [{
  key: 'sd_loud_snoring',
  domain: 'Sleep disturbance',
  label: 'นอนกรนเสียงดัง'
}, {
  key: 'sd_breath_holding',
  domain: 'Sleep disturbance',
  label: 'มีหยุดหายใจเป็นช่วง ๆ'
}, {
  key: 'sd_choking_gasping',
  domain: 'Sleep disturbance',
  label: 'สำลักหรือสะดุ้ง/หายใจเฮือกขณะหลับ'
}, {
  key: 'sd_restless_sleep',
  domain: 'Sleep disturbance',
  label: 'นอนกระสับกระส่ายหรือตื่นบ่อย'
}, {
  key: 'ps_mouth_breathing',
  domain: 'Physical suffering',
  label: 'หายใจทางปากเพราะหายใจทางจมูกไม่สะดวก'
}, {
  key: 'ps_frequent_colds',
  domain: 'Physical suffering',
  label: 'เป็นหวัดหรือติดเชื้อทางเดินหายใจส่วนต้นบ่อย'
}, {
  key: 'ps_nasal_discharge',
  domain: 'Physical suffering',
  label: 'น้ำมูกไหล'
}, {
  key: 'ps_swallowing',
  domain: 'Physical suffering',
  label: 'กลืนอาหารลำบาก'
}, {
  key: 'ed_mood',
  domain: 'Emotional distress',
  label: 'อารมณ์แปรปรวนหรือร้องไห้ง่าย'
}, {
  key: 'ed_aggressive',
  domain: 'Emotional distress',
  label: 'ก้าวร้าวหรือซุกซนมากผิดปกติ'
}, {
  key: 'ed_discipline',
  domain: 'Emotional distress',
  label: 'ควบคุมยาก/ดื้อผิดปกติ'
}, {
  key: 'dt_sleepy',
  domain: 'Daytime problems',
  label: 'เผลอหลับเวลากลางวัน'
}, {
  key: 'dt_attention',
  domain: 'Daytime problems',
  label: 'ขาดสมาธิหรือสมาธิสั้น'
}, {
  key: 'dt_wake_up',
  domain: 'Daytime problems',
  label: 'ปลุกตื่นยากในตอนเช้า'
}, {
  key: 'cc_general_health',
  domain: 'Caregiver concern',
  label: 'กังวลสุขภาพทั่วไปของลูก'
}, {
  key: 'cc_not_enough_air',
  domain: 'Caregiver concern',
  label: 'กังวลว่าลูกจะหายใจได้ไม่เพียงพอ/ขาดอากาศหายใจ'
}, {
  key: 'cc_daily_life',
  domain: 'Caregiver concern',
  label: 'ความกังวลรบกวนจนทำกิจวัตรประจำวันไม่ได้'
}, {
  key: 'cc_frustrated',
  domain: 'Caregiver concern',
  label: 'รู้สึกหงุดหงิดกับปัญหาที่เกิดขึ้น'
}];
const RISK_FACTORS = [{
  key: 'ageUnder3',
  label: 'อายุน้อยกว่า 3 ปี'
}, {
  key: 'obesity',
  label: 'อ้วน หรือ weight for height มากกว่าร้อยละ 140'
}, {
  key: 'tonsilAdenoid',
  label: 'ต่อมทอนซิลโต/สงสัยอะดีนอยด์โต'
}, {
  key: 'downSyndrome',
  label: 'Down syndrome'
}, {
  key: 'craniofacial',
  label: 'โครงสร้างใบหน้าหรือกะโหลกผิดปกติ'
}, {
  key: 'neuromuscular',
  label: 'โรคระบบประสาทและกล้ามเนื้อ/สมองพิการ'
}, {
  key: 'chronicLung',
  label: 'โรคปอดเรื้อรัง'
}, {
  key: 'sickleCell',
  label: 'sickle cell disease'
}, {
  key: 'geneticMetabolic',
  label: 'genetic/metabolic/storage disease'
}, {
  key: 'failureToThrive',
  label: 'เลี้ยงไม่โต/น้ำหนักขึ้นไม่ดี'
}, {
  key: 'enuresis',
  label: 'ปัสสาวะรดที่นอน'
}, {
  key: 'learningBehavior',
  label: 'ปัญหาพฤติกรรมหรือการเรียน'
}];
async function loginAdmin(username, password) {
  ensureAppReady_();
  const expectedUser = env('ADMIN_USERNAME');
  const expectedPassword = env('ADMIN_PASSWORD');
  if (!expectedUser || !expectedPassword) throw new Error('ยังไม่ได้ตั้งค่าบัญชีเจ้าหน้าที่ใน Edge Function');
  const actual = await hash_(String(username) + ':' + String(password));
  const expected = await hash_(expectedUser + ':' + expectedPassword);
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  if (mismatch) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  const user = await ensureAdminUser_();
  const session = await createSession_(user);
  await audit_(user.userId, 'adminLogin', 'User', user.userId, {});
  return {
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: publicUser_(user)
  };
}
async function loginWithCid(cid, birthDate) {
  ensureAppReady_();
  cid = cleanText_(cid || '').replace(/[-\s]/g, '');
  birthDate = cleanText_(birthDate || '');
  if (!(/^\d{13}$/).test(cid)) throw new Error('เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก');
  if (!birthDate) throw new Error('กรุณาระบุวันเกิดของเด็ก');
  const children = await readObjects_(APP_CONFIG.tables.children);
  const child = children.find(function (c) {
    return cleanText_(c.childCidNumber || '').replace(/[-\s]/g, '') === cid;
  });
  if (!child) throw new Error('ไม่พบข้อมูลเด็กในระบบ\nกรุณาติดต่อพยาบาลเพื่อลงทะเบียนก่อนใช้งาน');
  const storedBd = normDateStr_(child.birthDate);
  const inputBd = normDateStr_(birthDate);
  if (!storedBd || storedBd !== inputBd) {
    throw new Error('วันเกิดไม่ตรงกับที่บันทึกไว้ในระบบ กรุณาตรวจสอบอีกครั้ง');
  }
  const user = await ensureCidParentUser_(child.childId, cid, child.birthDate, cleanText_(child.nickname || child.childName));
  if (!user || user.status === 'disabled') {
    throw new Error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าหน้าที่');
  }
  await updateObjectRow_(APP_CONFIG.tables.users, user._id, {
    lastLoginAt: iso_(new Date())
  });
  const session = await createSession_(user);
  await audit_(user.userId, 'loginWithCid', 'User', user.userId, {});
  return {
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: publicUser_(user)
  };
}
async function loginParentLookup(query, birthDate) {
  ensureAppReady_();
  query = cleanText_(query || '');
  birthDate = cleanText_(birthDate || '');
  if (!query) throw new Error('กรุณากรอกเลขบัตรประชาชน หรือชื่อ-สกุลของเด็ก');
  if (!birthDate) throw new Error('กรุณาระบุวันเกิดของเด็ก');
  const digits = query.replace(/[-\s]/g, '');
  const isCid = (/^\d{13}$/).test(digits);
  const inputBd = normDateStr_(birthDate);
  const children = await readObjects_(APP_CONFIG.tables.children);
  var matches;
  if (isCid) {
    matches = children.filter(function (c) {
      return cleanText_(c.childCidNumber || '').replace(/[-\s]/g, '') === digits;
    });
    if (!matches.length) throw new Error('ไม่พบข้อมูลเด็กจากเลขบัตรที่กรอก\nกรุณาตรวจสอบ หรือลงทะเบียนเด็กใหม่');
  } else {
    const q = normNameForSearch_(query);
    matches = children.filter(function (c) {
      const nm = normNameForSearch_(c.childName);
      const nk = normNameForSearch_(c.nickname);
      return nm && (nm === q || nm.indexOf(q) !== -1) || nk && (nk === q || nk.indexOf(q) !== -1);
    });
    if (!matches.length) throw new Error('ไม่พบข้อมูลเด็กจากชื่อที่กรอก\nลองกรอกเลขบัตรประชาชนแทน หรือลงทะเบียนเด็กใหม่');
  }
  const verified = matches.filter(function (c) {
    return normDateStr_(c.birthDate) === inputBd;
  });
  if (!verified.length) {
    throw new Error('วันเกิดไม่ตรงกับข้อมูลที่ลงทะเบียนไว้ กรุณาตรวจสอบอีกครั้ง');
  }
  if (verified.length > 1) {
    throw new Error('พบเด็กมากกว่าหนึ่งรายที่ตรงกับข้อมูล\nกรุณากรอกเลขบัตรประชาชนเพื่อระบุให้ชัดเจน');
  }
  const child = verified[0];
  const user = await ensureCidParentUser_(child.childId, cleanText_(child.childCidNumber || '').replace(/[-\s]/g, ''), child.birthDate, cleanText_(child.nickname || child.childName));
  if (!user || user.status === 'disabled') {
    throw new Error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าหน้าที่');
  }
  await updateObjectRow_(APP_CONFIG.tables.users, user._id, {
    lastLoginAt: iso_(new Date())
  });
  const session = await createSession_(user);
  await audit_(user.userId, 'loginParentLookup', 'User', user.userId, {
    by: isCid ? 'cid' : 'name'
  });
  return {
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: publicUser_(user)
  };
}
async function ensureCidParentUser_(childId, cid, birthDate, displayName) {
  const userId = 'parent_' + childId;
  const users = await readObjects_(APP_CONFIG.tables.users);
  const existing = users.find(function (u) {
    return u.userId === userId;
  });
  if (existing) return existing;
  const user = {
    userId: userId,
    role: 'parent',
    email: '',
    displayName: (displayName || 'ผู้ปกครอง') + ' (ผู้ปกครอง)',
    phone: '',
    status: 'active',
    createdAt: iso_(new Date()),
    lastLoginAt: ''
  };
  user._id = await appendObject_(APP_CONFIG.tables.users, user);
  return user;
}
async function requireSession_(token) {
  const session = await getSessionUser_(token);
  if (!session) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  return session;
}
async function getSessionUser_(token) {
  if (!token) return null;
  const tokenHash = await hash_(token);
  const session = (await readObjectsByField_(APP_CONFIG.tables.sessions, 'tokenHash', tokenHash)).find(function (row) {
    return row.tokenHash === tokenHash && !row.revokedAt && new Date(row.expiresAt).getTime() >= Date.now();
  });
  if (!session) return null;
  const user = (await readObjectsByField_(APP_CONFIG.tables.users, 'userId', session.userId)).find(function (row) {
    return row.userId === session.userId && row.status === 'active';
  });
  if (!user) return null;
  const result = {
    session: session,
    user: user
  };
  return result;
}
function requireClinicalRole_(user) {
  if (!['admin', 'nurse', 'ent', 'doctor'].includes(user.role)) throw new Error('สิทธิ์ไม่เพียงพอสำหรับเจ้าหน้าที่');
}
function requireAdminRole_(user) {
  if (user.role !== 'admin') throw new Error('ต้องเป็น admin เท่านั้น');
}
async function createSession_(user) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + APP_CONFIG.sessionDays * 24 * 60 * 60 * 1000);
  const session = {
    sessionId: crypto.randomUUID(),
    userId: user.userId,
    tokenHash: await hash_(token),
    expiresAt: iso_(expiresAt),
    createdAt: iso_(new Date()),
    revokedAt: ''
  };
  session._id = await appendObject_(APP_CONFIG.tables.sessions, session);
  return {
    token: token,
    expiresAt: iso_(expiresAt)
  };
}
async function ensureAdminUser_() {
  const existing = (await readObjectsByField_(APP_CONFIG.tables.users, 'userId', 'staff-admin'))[0];
  if (existing) {
    if (existing.status !== 'active' || existing.role !== 'admin') throw new Error('บัญชีเจ้าหน้าที่ถูกระงับหรือไม่มีสิทธิ์');
    return existing;
  }
  const user = {
    userId: 'staff-admin',
    role: 'admin',
    email: '',
    displayName: 'Admin',
    phone: '',
    status: 'active',
    createdAt: iso_(new Date()),
    lastLoginAt: iso_(new Date())
  };
  user._id = await appendObject_(APP_CONFIG.tables.users, user);
  return user;
}
async function hash_(value) {
  ensureAppReady_();
  const bytes = new TextEncoder().encode(env('APP_SECRET') + '|' + value);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function saveChildProfile(token, payload) {
  const session = await requireSession_(token);
  payload = payload || ({});
  const isStaff = ['nurse', 'ent', 'doctor', 'admin'].indexOf(session.user.role) !== -1;
  const now = new Date();
  const childId = cleanText_(payload.childId) || crypto.randomUUID();
  let cid = cleanText_(payload.childCidNumber || '').replace(/[-\s]/g, '');
  var parentId;
  const allChildren = await fetchSupabaseRows_(APP_CONFIG.tables.children, { includeDeleted: true });
  const existing = allChildren.find(function (row) {
    if (isStaff) return row.childId === childId;
    return row.childId === childId && row.parentId === session.user.userId;
  });
  if (existing?.deletedAt) throw new Error('เด็กอยู่ในถังขยะ กรุณากู้คืนก่อนแก้ไข');
  if (allChildren.some(row => row.childId === childId) && !existing) throw new Error('ไม่มีสิทธิ์แก้ไขข้อมูลเด็กคนนี้');
  if (existing) {
    if (!cid) cid = existing.childCidNumber || '';
    const defaults = { ...existing, birthDate: normDateStr_(existing.birthDate), comorbidities: parseJsonObject_(existing.comorbiditiesJson) };
    payload = { ...defaults, ...payload };
  }
  if (cid && !/^\d{13}$/.test(cid)) throw new Error('เลขบัตรประชาชนต้องมี 13 หลัก');
  if (!cleanText_(payload.childName) && !cleanText_(payload.nickname)) throw new Error('กรุณาระบุชื่อหรือชื่อเล่นเด็ก');
  if (payload.birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(payload.birthDate) || isNaN(Date.parse(payload.birthDate)) || new Date(payload.birthDate).toISOString().slice(0,10) !== payload.birthDate || payload.birthDate > iso_(now).slice(0,10))) throw new Error('วันเกิดไม่ถูกต้อง');
  for (const [field, max] of [['ageYears',120],['weightKg',500],['heightCm',300]]) {
    const value = payload[field];
    if (value !== '' && value != null && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > max || field !== 'ageYears' && Number(value) === 0)) throw new Error('อายุ น้ำหนัก หรือส่วนสูงไม่ถูกต้อง');
  }
  const bmi = calculateBmi_(payload.weightKg, payload.heightCm);
  if (isStaff) {
    parentId = existing ? existing.parentId : cid ? 'parent_' + childId : session.user.userId;
  } else {
    parentId = session.user.userId;
  }
  if (cid) {
    const dupCid = allChildren.find(function (c) {
      return cleanText_(c.childCidNumber || '').replace(/[-\s]/g, '') === cid && c.childId !== childId;
    });
    if (dupCid) throw new Error('เลข CID ' + cid + ' มีในระบบแล้ว (' + (dupCid.nickname || dupCid.childCode || dupCid.childId) + ')');
  }
  const base = {
    childId: childId,
    parentId: parentId,
    childCode: cleanText_(payload.childCode) || childId.slice(0, 8),
    childName: cleanText_(payload.childName),
    nickname: cleanText_(payload.nickname),
    sex: cleanText_(payload.sex),
    birthDate: cleanText_(payload.birthDate),
    ageYears: cleanNumber_(payload.ageYears),
    weightKg: cleanNumber_(payload.weightKg),
    heightCm: cleanNumber_(payload.heightCm),
    bmi: bmi,
    tonsilSize: cleanText_(payload.tonsilSize),
    adenoidXrayResult: cleanText_(payload.adenoidXrayResult),
    childCidNumber: cid,
    comorbiditiesJson: JSON.stringify(payload.comorbidities || ({})),
    consentVersion: cleanText_(payload.consentVersion || 'v1'),
    notes: cleanText_(payload.notes),
    updatedAt: iso_(now)
  };
  if (existing) {
    await updateObjectRow_(APP_CONFIG.tables.children, existing._id, base);
  } else {
    base.createdAt = iso_(now);
    await appendObject_(APP_CONFIG.tables.children, base);
  }
  if (cid && cleanText_(payload.birthDate)) {
    await ensureCidParentUser_(childId, cid, cleanText_(payload.birthDate), cleanText_(payload.nickname || payload.childName));
  }
  await audit_(session.user.userId, 'saveChildProfile', 'Child', childId, {});
  return {
    ok: true,
    child: publicChild_(await getChildById_(childId))
  };
}
async function getChildForEdit(token, childId) {
  const session = await requireSession_(token);
  requireClinicalRole_(session.user);
  const child = await getChildById_(childId);
  if (!child) throw new Error('ไม่พบข้อมูลเด็ก');
  return { ...publicChild_(child), birthDate: normDateStr_(child.birthDate), consentVersion: child.consentVersion, comorbidities: parseJsonObject_(child.comorbiditiesJson) };
}
async function listChildTrash(token) {
  const session = await requireSession_(token);
  requireAdminRole_(session.user);
  return (await fetchSupabaseRows_(APP_CONFIG.tables.children, { includeDeleted: true })).filter(child => child.deletedAt).map(child => ({ ...publicChild_(child), deletedAt: child.deletedAt }));
}
async function setChildTrash(token, payload) {
  const { childId, deleted, confirmation } = payload || {};
  const session = await requireSession_(token);
  requireAdminRole_(session.user);
  if (typeof deleted !== 'boolean' || confirmation !== childId) throw new Error('กรุณายืนยันรายการเด็ก');
  const children = await fetchSupabaseRows_(APP_CONFIG.tables.children, { includeDeleted: true });
  const child = children.find(row => row.childId === childId);
  if (!child) throw new Error('ไม่พบข้อมูลเด็ก');
  if (!deleted && child.childCidNumber && children.some(row => row.childId !== childId && !row.deletedAt && row.childCidNumber === child.childCidNumber)) throw new Error('มีเลขบัตรนี้ในทะเบียนปัจจุบัน กรุณาตรวจสอบก่อนกู้คืน');
  if (!!child.deletedAt !== deleted) {
    await updateObjectRow_(APP_CONFIG.tables.children, childId, { deletedAt: deleted ? iso_(new Date()) : null, updatedAt: iso_(new Date()) });
    await audit_(session.user.userId, deleted ? 'trashChild' : 'restoreChild', 'Child', childId, {});
  }
  return { ok: true };
}
async function registerChildPublic(payload) {
  ensureAppReady_();
  payload = payload || ({});
  const now = new Date();
  const cid = cleanText_(payload.childCidNumber || '').replace(/[-\s]/g, '');
  const birthDate = cleanText_(payload.birthDate || '');
  if (!(/^\d{13}$/).test(cid)) throw new Error('กรุณากรอกเลขบัตรประชาชนเด็ก 13 หลักให้ครบถ้วน');
  if (!birthDate) throw new Error('กรุณาระบุวันเกิดของเด็ก');
  if (!cleanText_(payload.childCode) && !cleanText_(payload.nickname) && !cleanText_(payload.childName)) {
    throw new Error('กรุณาระบุชื่อเล่นหรือชื่อ-สกุลเด็กอย่างน้อยหนึ่งรายการ');
  }
  const allChildren = await readObjects_(APP_CONFIG.tables.children);
  const dup = allChildren.find(function (c) {
    return cleanText_(c.childCidNumber || '').replace(/[-\s]/g, '') === cid;
  });
  if (dup) {
    throw new Error('เลขบัตรประชาชนนี้ลงทะเบียนไว้แล้ว\nหากต้องการประเมินเพิ่ม กรุณาใช้เมนู "ประเมินครั้งต่อไป" โดยกรอกเลขบัตร + วันเกิดของเด็ก');
  }
  const childId = crypto.randomUUID();
  const parentId = 'parent_' + childId;
  const bmi = calculateBmi_(payload.weightKg, payload.heightCm);
  const record = {
    childId: childId,
    parentId: parentId,
    childCode: cleanText_(payload.childCode) || childId.slice(0, 8),
    childName: cleanText_(payload.childName),
    nickname: cleanText_(payload.nickname),
    sex: cleanText_(payload.sex),
    birthDate: birthDate,
    ageYears: cleanNumber_(payload.ageYears),
    weightKg: cleanNumber_(payload.weightKg),
    heightCm: cleanNumber_(payload.heightCm),
    bmi: bmi,
    tonsilSize: cleanText_(payload.tonsilSize),
    adenoidXrayResult: cleanText_(payload.adenoidXrayResult),
    childCidNumber: cid,
    comorbiditiesJson: JSON.stringify(payload.comorbidities || ({})),
    consentVersion: cleanText_(payload.consentVersion || 'v1'),
    notes: cleanText_(payload.notes),
    createdAt: iso_(now),
    updatedAt: iso_(now)
  };
  await appendObject_(APP_CONFIG.tables.children, record);
  const user = await ensureCidParentUser_(childId, cid, birthDate, cleanText_(payload.nickname || payload.childName));
  if (!user) throw new Error('ไม่สามารถสร้างบัญชีผู้ปกครองได้ กรุณาลองใหม่อีกครั้ง');
  await updateObjectRow_(APP_CONFIG.tables.users, user._id, {
    lastLoginAt: iso_(now)
  });
  const session = await createSession_(user);
  await audit_(parentId, 'registerChildPublic', 'Child', childId, {});
  return {
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: publicUser_(user),
    child: await getChildById_(childId)
  };
}
async function getChildById_(childId) {
  return (await readObjectsByField_(APP_CONFIG.tables.children, 'childId', childId))[0] || null;
}
async function submitScreening(token, payload) {
  const session = await requireSession_(token);
  payload = payload || ({});
  const isStaff = ['nurse', 'ent', 'doctor', 'admin'].indexOf(session.user.role) !== -1;
  const child = await getChildById_(payload.childId);
  if (!child || !isStaff && child.parentId !== session.user.userId) {
    throw new Error('ไม่พบข้อมูลเด็ก หรือไม่มีสิทธิ์เข้าถึง');
  }
  const score = scoreScreening_(payload, child);
  const screeningId = crypto.randomUUID();
  const screeningParentId = isStaff ? child.parentId : session.user.userId;
  const record = {
    screeningId: screeningId,
    childId: child.childId,
    parentId: screeningParentId,
    submittedAt: iso_(new Date()),
    coreAnswersJson: JSON.stringify(payload.coreAnswers || ({})),
    osa18AnswersJson: JSON.stringify(payload.osa18Answers || ({})),
    riskFactorsJson: JSON.stringify(payload.riskFactors || ({})),
    osa18Total: score.osa18Total,
    osa18Group: score.osa18Group,
    riskLevel: score.riskLevel,
    recommendation: score.recommendation,
    clinicalStatus: 'new',
    reviewerNotes: '',
    updatedAt: iso_(new Date())
  };
  await appendObject_(APP_CONFIG.tables.screenings, record);
  await audit_(session.user.userId, 'submitScreening', 'Screening', screeningId, {
    riskLevel: score.riskLevel
  });
  return {
    ok: true,
    screening: record,
    score: score
  };
}
function getQuestionnaireSchema_() {
  return {
    coreQuestions: CORE_QUESTIONS,
    osa18Items: OSA18_ITEMS,
    riskFactors: RISK_FACTORS,
    scoreLabels: [{
      value: 1,
      label: '1 = ไม่เกิดขึ้นเลย'
    }, {
      value: 2,
      label: '2 = แทบไม่เกิดขึ้น'
    }, {
      value: 3,
      label: '3 = เกิดขึ้นน้อยมาก'
    }, {
      value: 4,
      label: '4 = เกิดขึ้นบ้างบางครั้ง'
    }, {
      value: 5,
      label: '5 = เกิดขึ้นบ่อยพอควร'
    }, {
      value: 6,
      label: '6 = เกิดขึ้นบ่อยมาก'
    }, {
      value: 7,
      label: '7 = ตลอดเวลา'
    }]
  };
}
function scoreScreening_(payload, child) {
  const osaAnswers = payload.osa18Answers || ({});
  const values = OSA18_ITEMS.map(function (item) {
    const value = Number(osaAnswers[item.key]);
    if (!value || value < 1 || value > 7) {
      throw new Error('กรุณาตอบ OSA-18 ให้ครบทุกข้อ');
    }
    return value;
  });
  const osa18Total = values.reduce(function (sum, value) {
    return sum + value;
  }, 0);
  const osa18Group = osa18Total < 60 ? 'low' : osa18Total <= 80 ? 'moderate' : 'high';
  const core = payload.coreAnswers || ({});
  const risks = payload.riskFactors || ({});
  const majorRisk = ['ageUnder3', 'obesity', 'downSyndrome', 'craniofacial', 'neuromuscular', 'chronicLung', 'sickleCell', 'geneticMetabolic'].some(function (key) {
    return risks[key] === true;
  });
  const breathingRedFlag = core.witnessedApnea === true || core.breathingDifficulty === true || core.shakeToBreathe === true;
  const snoringSignal = core.loudSnoring === true || core.frequentSnoring === true || Number(osaAnswers.sd_loud_snoring) >= 5;
  let riskLevel = 'low';
  if (breathingRedFlag || osa18Total > 80 || majorRisk && snoringSignal) {
    riskLevel = 'high';
  } else if (osa18Total >= 60 || snoringSignal || core.caregiverConcernBreathing === true || risks.tonsilAdenoid === true) {
    riskLevel = 'moderate';
  }
  if (core.shakeToBreathe === true || risks.ageUnder3 === true && breathingRedFlag) {
    riskLevel = 'urgent-review';
  }
  const recommendation = makeRecommendation_(riskLevel, osa18Total, osa18Group);
  return {
    osa18Total: osa18Total,
    osa18Group: osa18Group,
    riskLevel: riskLevel,
    recommendation: recommendation
  };
}
function makeRecommendation_(riskLevel, osa18Total, osa18Group) {
  if (riskLevel === 'urgent-review') {
    return 'ควรให้ทีมคลินิกทบทวนโดยเร็ว เนื่องจากมีสัญญาณเสี่ยงสำคัญ ระบบนี้ไม่ใช่การวินิจฉัยแทนแพทย์';
  }
  if (riskLevel === 'high') {
    return 'พบความเสี่ยงสูง ควรนัดประเมินโดยแพทย์/ENT และพิจารณาตรวจเพิ่มเติมตามดุลยพินิจ';
  }
  if (riskLevel === 'moderate') {
    return 'พบความเสี่ยงปานกลาง ควรติดตามอาการ อัปโหลดวิดีโอ และให้เจ้าหน้าที่คัดกรองทบทวน';
  }
  return 'ความเสี่ยงเบื้องต้นต่ำ แต่หากยังมีนอนกรนบ่อย หยุดหายใจ หรือผู้ปกครองกังวล ควรปรึกษาแพทย์';
}
async function getScreeningById_(screeningId) {
  return (await readObjectsByField_(APP_CONFIG.tables.screenings, 'screeningId', screeningId))[0] || null;
}
async function listParentDashboard(token, forceRefresh) {
  const session = await requireSession_(token);
  const children = await readObjectsByField_(APP_CONFIG.tables.children, 'parentId', session.user.userId);
  const screenings = (await readObjectsByField_(APP_CONFIG.tables.screenings, 'parentId', session.user.userId)).sort(sortByDateDesc_('submittedAt'));
  const result = {
    ok: true,
    children: children.map(publicChild_),
    screenings: screenings.map(publicScreeningDetailed_),
    videos: [],
    metrics: {
      children: children.length,
      screenings: screenings.length,
      highRisk: screenings.filter(function (row) {
        return row.riskLevel === 'high' || row.riskLevel === 'urgent-review';
      }).length
    }
  };
  return result;
}
async function listClinicalDashboard(token, forceRefresh) {
  const session = await requireSession_(token);
  requireClinicalRole_(session.user);
  const totalScreenings = await countDataRows_(APP_CONFIG.tables.screenings);
  const totalVideos = await countDataRows_(APP_CONFIG.tables.videos);
  const screenings = (totalScreenings > 150 ? await readLatestObjects_(APP_CONFIG.tables.screenings, 50) : await readObjects_(APP_CONFIG.tables.screenings)).sort(sortByDateDesc_('submittedAt'));
  const videos = totalVideos > 150 ? [] : (await readObjects_(APP_CONFIG.tables.videos)).sort(sortByDateDesc_('uploadedAt'));
  const children = await readObjects_(APP_CONFIG.tables.children);
  const result = makeClinicalDashboardData_(screenings, videos, children);
  if (totalScreenings > 150) {
    const riskLevels = await readColumnValues_(APP_CONFIG.tables.screenings, 'riskLevel');
    const clinicalStatuses = await readColumnValues_(APP_CONFIG.tables.screenings, 'clinicalStatus');
    result.metrics.totalScreenings = totalScreenings;
    result.metrics.highRisk = riskLevels.filter(function (value) {
      return value === 'high' || value === 'urgent-review';
    }).length;
    result.metrics.pendingReview = clinicalStatuses.filter(function (value) {
      return value === 'new';
    }).length;
  }
  if (totalVideos > 150) {
    const aiStatuses = await readColumnValues_(APP_CONFIG.tables.videos, 'aiStatus');
    const reviewStatuses = await readColumnValues_(APP_CONFIG.tables.videos, 'reviewStatus');
    result.metrics.videoUploaded = totalVideos;
    result.metrics.aiPending = aiStatuses.filter(function (value) {
      return value === 'queued' || value === 'pending';
    }).length;
    result.metrics.humanReviewNeeded = reviewStatuses.filter(function (value) {
      return value === 'pending-human-review' || value === 'needs-human-review';
    }).length;
  }
  return result;
}
function makeClinicalDashboardData_(screenings, videos, children) {
  const childById = {};
  children.forEach(function (child) {
    childById[child.childId] = child;
  });
  const latest = screenings.slice(0, 50).map(function (screening) {
    const child = childById[screening.childId] || ({});
    return {
      screeningId: screening.screeningId,
      childCode: child.childCode || '',
      nickname: child.nickname || '',
      ageYears: child.ageYears || '',
      submittedAt: screening.submittedAt,
      osa18Total: screening.osa18Total,
      riskLevel: screening.riskLevel,
      clinicalStatus: screening.clinicalStatus,
      recommendation: screening.recommendation
    };
  });
  return {
    ok: true,
    metrics: {
      totalChildren: children.length,
      totalScreenings: screenings.length,
      highRisk: screenings.filter(function (r) {
        return r.riskLevel === 'high' || r.riskLevel === 'urgent-review';
      }).length,
      pendingReview: screenings.filter(function (r) {
        return r.clinicalStatus === 'new';
      }).length,
      videoUploaded: videos.length,
      aiPending: videos.filter(function (v) {
        return v.aiStatus === 'queued' || v.aiStatus === 'pending';
      }).length,
      humanReviewNeeded: videos.filter(function (v) {
        return v.reviewStatus === 'pending-human-review' || v.reviewStatus === 'needs-human-review';
      }).length
    },
    latest: latest
  };
}
async function listAdminDashboard(token, forceRefresh) {
  const session = await requireSession_(token);
  requireAdminRole_(session.user);
  const users = await readObjects_(APP_CONFIG.tables.users);
  const children = await readObjects_(APP_CONFIG.tables.children);
  const totalScreenings = await countDataRows_(APP_CONFIG.tables.screenings);
  const totalVideos = await countDataRows_(APP_CONFIG.tables.videos);
  const screenings = (totalScreenings > 150 ? await readLatestObjects_(APP_CONFIG.tables.screenings, 100) : await readObjects_(APP_CONFIG.tables.screenings)).sort(sortByDateDesc_('submittedAt'));
  const videos = (totalVideos > 150 ? await readLatestObjects_(APP_CONFIG.tables.videos, 100) : await readObjects_(APP_CONFIG.tables.videos)).sort(sortByDateDesc_('uploadedAt'));
  const riskLevels = totalScreenings > 150 ? await readColumnValues_(APP_CONFIG.tables.screenings, 'riskLevel') : screenings.map(function (row) {
    return row.riskLevel;
  });
  const clinicalStatuses = totalScreenings > 150 ? await readColumnValues_(APP_CONFIG.tables.screenings, 'clinicalStatus') : screenings.map(function (row) {
    return row.clinicalStatus;
  });
  const aiStatuses = totalVideos > 150 ? await readColumnValues_(APP_CONFIG.tables.videos, 'aiStatus') : videos.map(function (row) {
    return row.aiStatus;
  });
  const reviewStatuses = totalVideos > 150 ? await readColumnValues_(APP_CONFIG.tables.videos, 'reviewStatus') : videos.map(function (row) {
    return row.reviewStatus;
  });
  const clinical = makeClinicalDashboardData_(screenings, videos, children);
  clinical.metrics.totalScreenings = totalScreenings;
  clinical.metrics.videoUploaded = totalVideos;
  clinical.metrics.highRisk = riskLevels.filter(function (value) {
    return value === 'high' || value === 'urgent-review';
  }).length;
  clinical.metrics.pendingReview = clinicalStatuses.filter(function (value) {
    return value === 'new';
  }).length;
  clinical.metrics.aiPending = aiStatuses.filter(function (value) {
    return value === 'queued' || value === 'pending';
  }).length;
  clinical.metrics.humanReviewNeeded = reviewStatuses.filter(function (value) {
    return value === 'pending-human-review' || value === 'needs-human-review';
  }).length;
  const result = {
    ok: true,
    metrics: {
      totalUsers: users.length,
      totalChildren: children.length,
      totalScreenings: totalScreenings,
      totalVideos: totalVideos,
      activeParents: users.filter(function (u) {
        return u.role === 'parent' && u.status === 'active';
      }).length,
      admins: users.filter(function (u) {
        return u.role === 'admin';
      }).length,
      highRisk: riskLevels.filter(function (value) {
        return value === 'high' || value === 'urgent-review';
      }).length,
      pendingClinicalReview: clinicalStatuses.filter(function (value) {
        return value === 'new';
      }).length
    },
    users: users.map(publicUser_),
    children: children.map(publicChild_),
    screenings: screenings.slice(0, 100).map(publicScreeningDetailed_),
    videos: videos.slice(0, 100).map(publicVideo_),
    clinical: clinical
  };
  return result;
}
async function getReportData(token, options) {
  const session = await requireSession_(token);
  requireClinicalRole_(session.user);
  options = options || {};
  const dateValue = value => {
    if (!value) return '';
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('วันที่รายงานไม่ถูกต้อง');
    return value;
  };
  const from = dateValue(options.from), to = dateValue(options.to);
  if (from && to && from > to) throw new Error('วันเริ่มต้นต้องไม่เกินวันสิ้นสุด');
  const scope = options.scope || 'all';
  if (!['all', 'real', 'test'].includes(scope)) throw new Error('ขอบเขตข้อมูลไม่ถูกต้อง');
  const inRange = value => {
    if (!from && !to) return true;
    const date = new Date(value);
    if (isNaN(date.getTime())) return false;
    const day = new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  };
  const admin = session.user.role === 'admin';
  // Full paginated reads: report data must never inherit dashboard display limits.
  const [allChildren, allScreenings, allVideos, allUsers, allLogs] = await Promise.all([
    readObjects_(APP_CONFIG.tables.children), readObjects_(APP_CONFIG.tables.screenings), readObjects_(APP_CONFIG.tables.videos),
    admin ? readObjects_(APP_CONFIG.tables.users) : Promise.resolve([]),
    admin && options.includeAudit ? readObjects_(APP_CONFIG.tables.auditLogs) : Promise.resolve([])
  ]);
  const isTest = child => child.consentVersion === 'demo-data';
  let children = allChildren.filter(child => scope === 'all' || (scope === 'test' ? isTest(child) : !isTest(child)));
  const childIds = new Set(children.map(child => child.childId));
  const screenings = allScreenings.filter(row => childIds.has(row.childId) && inRange(row.submittedAt)).sort(sortByDateDesc_('submittedAt'));
  if (from || to) { const assessed = new Set(screenings.map(row => row.childId)); children = children.filter(child => assessed.has(child.childId)); }
  const includedIds = new Set(children.map(child => child.childId));
  const screeningIds = new Set(screenings.map(row => row.screeningId));
  const videos = allVideos.filter(row => includedIds.has(row.childId) && screeningIds.has(row.screeningId)).sort(sortByDateDesc_('uploadedAt'));
  const result = {
    exportedAt: iso_(new Date()), exportedBy: { displayName: session.user.displayName, role: session.user.role },
    filters: { from, to, scope, includeAudit: !!(admin && options.includeAudit) }, schema: getQuestionnaireSchema_(),
    children: children.map(child => ({ ...publicChild_(child), createdAt: child.createdAt, updatedAt: child.updatedAt, isTestData: isTest(child), comorbidities: parseJsonObject_(child.comorbiditiesJson) })),
    screenings: screenings.map(publicScreeningDetailed_),
    videos: videos.map(video => ({ ...publicVideo_(video), childId: video.childId, mimeType: video.mimeType, sizeBytes: video.sizeBytes, reviewerNotes: video.reviewerNotes || '', updatedAt: video.updatedAt })),
    users: admin ? allUsers.map(user => ({ ...publicUser_(user), createdAt: user.createdAt, lastLoginAt: user.lastLoginAt })) : [],
    auditLogs: allLogs.filter(row => inRange(row.createdAt)).map(row => ({ logId: row.logId, actorUserId: row.actorUserId, action: row.action, targetType: row.targetType, targetId: row.targetId, createdAt: row.createdAt })),
    adminSections: admin
  };
  await audit_(session.user.userId, 'exportReport', 'Report', '', { ...result.filters, children: children.length, screenings: screenings.length });
  return result;
}

async function saveClinicalReview(token, payload) {
  const session = await requireSession_(token);
  requireClinicalRole_(session.user);
  payload = payload || ({});
  const screening = await getScreeningById_(payload.screeningId);
  if (!screening) throw new Error('ไม่พบแบบคัดกรอง');
  await updateObjectRow_(APP_CONFIG.tables.screenings, screening._id, {
    clinicalStatus: cleanText_(payload.clinicalStatus || screening.clinicalStatus),
    reviewerNotes: cleanText_(payload.reviewerNotes),
    updatedAt: iso_(new Date())
  });
  await audit_(session.user.userId, 'saveClinicalReview', 'Screening', screening.screeningId, {});
  return {
    ok: true
  };
}
async function updateUserByAdmin(token, payload) {
  const session = await requireSession_(token);
  requireAdminRole_(session.user);
  payload = payload || ({});
  const target = (await readObjects_(APP_CONFIG.tables.users)).find(function (row) {
    return row.userId === payload.userId;
  });
  if (!target) throw new Error('ไม่พบผู้ใช้');
  const allowedRoles = ['parent', 'nurse', 'ent', 'doctor', 'admin'];
  const allowedStatuses = ['active', 'disabled'];
  const role = cleanText_(payload.role || target.role);
  const status = cleanText_(payload.status || target.status);
  if (allowedRoles.indexOf(role) === -1) throw new Error('role ไม่ถูกต้อง');
  if (allowedStatuses.indexOf(status) === -1) throw new Error('status ไม่ถูกต้อง');
  await updateObjectRow_(APP_CONFIG.tables.users, target._id, {
    role: role,
    status: status,
    displayName: cleanText_(payload.displayName || target.displayName)
  });
  await audit_(session.user.userId, 'updateUserByAdmin', 'User', target.userId, {
    role: role,
    status: status
  });
  return {
    ok: true
  };
}
async function updateVideoReviewByAdmin(token, payload) {
  const session = await requireSession_(token);
  requireAdminRole_(session.user);
  payload = payload || ({});
  const video = (await readObjects_(APP_CONFIG.tables.videos)).find(function (row) {
    return row.videoId === payload.videoId;
  });
  if (!video) throw new Error('ไม่พบวิดีโอ');
  await updateObjectRow_(APP_CONFIG.tables.videos, video._id, {
    reviewStatus: cleanText_(payload.reviewStatus || video.reviewStatus),
    reviewerNotes: cleanText_(payload.reviewerNotes || video.reviewerNotes),
    updatedAt: iso_(new Date())
  });
  await audit_(session.user.userId, 'updateVideoReviewByAdmin', 'Video', video.videoId, {});
  return {
    ok: true
  };
}
function getSupabaseConfig_() {
  const url = String(env('SUPABASE_URL') || '').replace(/\/+$/, '');
  const key = env('APP_SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('ยังไม่ได้ตั้งค่า Supabase ของ Edge Function');
  if (!(/^https:\/\//).test(url) && !(/^http:\/\(?(localhost|127\.0\.0\.1|kong)(:|\/)/).test(url)) throw new Error('Supabase URL ไม่ถูกต้อง');
  if (key.startsWith('sb_publishable_')) throw new Error('Edge Function ต้องใช้ Secret key');
  return {
    url,
    key,
    restUrl: url + '/rest/v1',
    schema: 'public'
  };
}
function getSupabaseTable_(logicalName) {
  const meta = SUPABASE_TABLES[logicalName];
  if (!meta || !TABLE_FIELDS[logicalName]) {
    throw new Error('Unknown data table: ' + logicalName);
  }
  return meta;
}
function toSnakeCase_(value) {
  return String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
function fieldIsIn_(meta, group, fieldName) {
  return (meta[group] || []).indexOf(fieldName) !== -1;
}
function toSupabaseValue_(meta, fieldName, value) {
  const isEmpty = value === '' || value === null || value === undefined;
  if (fieldIsIn_(meta, 'jsonFields', fieldName)) {
    if (isEmpty) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch (err) {
      return {};
    }
  }
  if (fieldIsIn_(meta, 'numberFields', fieldName)) {
    if (isEmpty) return null;
    const numberValue = Number(value);
    return isNaN(numberValue) ? null : numberValue;
  }
  if (fieldIsIn_(meta, 'dateFields', fieldName)) {
    if (isEmpty) return null;
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return normDateStr_(value);
  }
  if (fieldIsIn_(meta, 'timestampFields', fieldName)) {
    if (isEmpty) return null;
    return value instanceof Date ? iso_(value) : String(value);
  }
  return isEmpty ? '' : value;
}
function fromSupabaseValue_(meta, fieldName, value) {
  if (value === null || value === undefined) return '';
  if (fieldIsIn_(meta, 'jsonFields', fieldName)) {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  return value;
}
function toSupabaseObject_(logicalName, obj) {
  const meta = getSupabaseTable_(logicalName);
  const result = {};
  TABLE_FIELDS[logicalName].forEach(function (fieldName) {
    if (obj[fieldName] !== undefined) {
      result[toSnakeCase_(fieldName)] = toSupabaseValue_(meta, fieldName, obj[fieldName]);
    }
  });
  return result;
}
function fromSupabaseObject_(logicalName, row) {
  const meta = getSupabaseTable_(logicalName);
  const result = {};
  TABLE_FIELDS[logicalName].forEach(function (fieldName) {
    result[fieldName] = fromSupabaseValue_(meta, fieldName, row[toSnakeCase_(fieldName)]);
  });
  result._id = result[meta.primaryKey];
  return result;
}
async function supabaseRequest_(logicalName, method, query, payload, extraHeaders, includeDeleted = false) {
  if (method.toLowerCase() === 'get' && !includeDeleted && ['Children','Screenings','Videos'].includes(logicalName)) query = (query ? query + '&' : '') + 'deleted_at=is.null';
  const config = getSupabaseConfig_();
  const meta = getSupabaseTable_(logicalName);
  const headers = {
    apikey: config.key,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extraHeaders
  };
  if (!config.key.startsWith('sb_')) headers.Authorization = 'Bearer ' + config.key;
  const response = await fetcher(config.restUrl + '/' + meta.table + (query ? '?' + query : ''), {
    method: method.toUpperCase(),
    headers,
    body: payload == null ? undefined : JSON.stringify(payload)
  });
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error('Supabase ส่งข้อมูลไม่ถูกต้อง');
  }
  if (!response.ok) throw new Error('บันทึกหรืออ่านฐานข้อมูลไม่สำเร็จ (' + response.status + ')');
  return {
    status: response.status,
    data,
    headers: Object.fromEntries(response.headers)
  };
}
function getResponseHeader_(headers, headerName) {
  const wanted = String(headerName).toLowerCase();
  const name = Object.keys(headers || ({})).find(function (key) {
    return String(key).toLowerCase() === wanted;
  });
  return name ? headers[name] : '';
}
function parseTotalCount_(headers) {
  const contentRange = String(getResponseHeader_(headers, 'Content-Range') || '');
  const match = contentRange.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}
async function fetchSupabaseRows_(logicalName, options) {
  options = options || ({});
  const meta = getSupabaseTable_(logicalName);
  const selectedFields = options.fields || TABLE_FIELDS[logicalName];
  const baseParts = ['select=' + selectedFields.map(toSnakeCase_).join(',')];
  Object.keys(options.filters || ({})).forEach(function (fieldName) {
    baseParts.push(encodeURIComponent(toSnakeCase_(fieldName)) + '=' + encodeURIComponent('eq.' + String(options.filters[fieldName])));
  });
  const primaryOrder = toSnakeCase_(meta.primaryKey) + '.asc';
  const order = options.orderBy ? toSnakeCase_(options.orderBy) + '.' + (options.ascending ? 'asc' : 'desc') + ',' + primaryOrder : primaryOrder;
  baseParts.push('order=' + encodeURIComponent(order));
  const requestedLimit = options.limit ? Math.max(1, Number(options.limit)) : null;
  const pageSize = Math.min(requestedLimit || 1000, 1000);
  let offset = 0;
  let total = null;
  let rows = [];
  do {
    const limit = requestedLimit ? Math.min(pageSize, requestedLimit - offset) : pageSize;
    const queryParts = baseParts.concat(['limit=' + limit, 'offset=' + offset]);
    const response = await supabaseRequest_(logicalName, 'get', queryParts.join('&'), null, total === null ? {
      Prefer: 'count=exact'
    } : {}, options.includeDeleted);
    const page = Array.isArray(response.data) ? response.data : [];
    if (total === null) total = parseTotalCount_(response.headers);
    rows = rows.concat(page);
    offset += page.length;
    if (page.length === 0 || requestedLimit && offset >= requestedLimit) break;
  } while (total === null || offset < total);
  return rows.map(function (row) {
    return fromSupabaseObject_(logicalName, row);
  });
}
async function readObjects_(logicalName) {
  return await fetchSupabaseRows_(logicalName);
}
async function readObjectsByField_(logicalName, fieldName, value) {
  if (TABLE_FIELDS[logicalName].indexOf(fieldName) === -1) return [];
  const filters = {};
  filters[fieldName] = value;
  return await fetchSupabaseRows_(logicalName, {
    filters: filters
  });
}
async function countDataRows_(logicalName) {
  const meta = getSupabaseTable_(logicalName);
  const response = await supabaseRequest_(logicalName, 'get', 'select=' + toSnakeCase_(meta.primaryKey) + '&limit=1', null, {
    Prefer: 'count=exact'
  });
  const total = parseTotalCount_(response.headers);
  return total === null ? Array.isArray(response.data) ? response.data.length : 0 : total;
}
async function readLatestObjects_(logicalName, maxRows) {
  const meta = getSupabaseTable_(logicalName);
  return await fetchSupabaseRows_(logicalName, {
    limit: Math.max(Number(maxRows) || 50, 1),
    orderBy: meta.orderBy
  });
}
async function readColumnValues_(logicalName, fieldName) {
  if (TABLE_FIELDS[logicalName].indexOf(fieldName) === -1) return [];
  return (await fetchSupabaseRows_(logicalName, {
    fields: [fieldName]
  })).map(function (row) {
    return row[fieldName];
  });
}
async function appendObject_(logicalName, obj) {
  const meta = getSupabaseTable_(logicalName);
  const primaryValue = obj[meta.primaryKey];
  if (primaryValue === '' || primaryValue === null || primaryValue === undefined) {
    throw new Error('Missing primary key ' + meta.primaryKey + ' for ' + meta.table);
  }
  await supabaseRequest_(logicalName, 'post', '', toSupabaseObject_(logicalName, obj), {
    Prefer: 'return=minimal'
  });
  return primaryValue;
}
async function updateObjectRow_(logicalName, recordId, patch) {
  const meta = getSupabaseTable_(logicalName);
  if (recordId === '' || recordId === null || recordId === undefined) {
    throw new Error('Missing row identifier for ' + meta.table);
  }
  await supabaseRequest_(logicalName, 'patch', encodeURIComponent(toSnakeCase_(meta.primaryKey)) + '=' + encodeURIComponent('eq.' + String(recordId)), toSupabaseObject_(logicalName, patch), {
    Prefer: 'return=minimal'
  });
}
function publicUser_(user) {
  return {
    userId: user.userId,
    role: user.role,
    email: user.email,
    displayName: user.displayName,
    status: user.status
  };
}
function publicChild_(child) {
  return {
    childId: child.childId,
    childCode: child.childCode,
    childName: child.childName,
    nickname: child.nickname,
    sex: child.sex,
    birthDate: child.birthDate,
    ageYears: child.ageYears,
    weightKg: child.weightKg,
    heightCm: child.heightCm,
    bmi: child.bmi,
    tonsilSize: child.tonsilSize,
    adenoidXrayResult: child.adenoidXrayResult,
    childCidNumber: child.childCidNumber ? '✓' : '',
    notes: child.notes || ''
  };
}
function publicScreening_(screening) {
  return {
    screeningId: screening.screeningId,
    childId: screening.childId,
    submittedAt: screening.submittedAt,
    osa18Total: screening.osa18Total,
    osa18Group: screening.osa18Group,
    riskLevel: screening.riskLevel,
    recommendation: screening.recommendation,
    clinicalStatus: screening.clinicalStatus
  };
}
function publicScreeningDetailed_(screening) {
  const result = publicScreening_(screening);
  result.coreAnswers = parseJsonObject_(screening.coreAnswersJson);
  result.riskFactors = parseJsonObject_(screening.riskFactorsJson);
  result.osa18Answers = parseJsonObject_(screening.osa18AnswersJson);
  result.reviewerNotes = screening.reviewerNotes || '';
  return result;
}
function parseJsonObject_(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    return {};
  }
}
function publicVideo_(video) {
  return {
    videoId: video.videoId,
    screeningId: video.screeningId,
    fileName: video.fileName,
    uploadStatus: video.uploadStatus,
    uploadedAt: video.uploadedAt,
    aiStatus: video.aiStatus,
    aiConfidence: video.aiConfidence,
    reviewStatus: video.reviewStatus
  };
}
function normNameForSearch_(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
}
function normDateStr_(d) {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  var s = String(d).trim();
  if (s.indexOf('T') >= 0) return s.split('T')[0];
  return s;
}
async function audit_(actorUserId, action, targetType, targetId, detail) {
  await appendObject_(APP_CONFIG.tables.auditLogs, {
    logId: crypto.randomUUID(),
    actorUserId: actorUserId || '',
    action: action,
    targetType: targetType,
    targetId: targetId,
    createdAt: iso_(new Date()),
    detailJson: JSON.stringify(detail || ({}))
  });
}
function calculateBmi_(weightKg, heightCm) {
  const w = Number(weightKg);
  const h = Number(heightCm) / 100;
  if (!w || !h) return '';
  return Math.round(w / (h * h) * 10) / 10;
}
function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}
function cleanText_(value) {
  return String(value || '').trim();
}
function cleanNumber_(value) {
  if (value === '' || value === null || value === undefined) return '';
  const n = Number(value);
  return isNaN(n) ? '' : n;
}
function makeSafeFileName_(name) {
  return String(name || 'video.mp4').replace(/[\\/:*?"<>|#%{}~&]/g, '-').slice(0, 120);
}
function sortByDateDesc_(field) {
  return function (a, b) {
    return new Date(b[field] || 0).getTime() - new Date(a[field] || 0).getTime();
  };
}
function iso_(date) {
  return date.toISOString();
}
function ensureAppReady_() {
  getSupabaseConfig_();
  if (!env('APP_SECRET') || env('APP_SECRET').length < 32) throw new Error('กรุณาตั้งค่า APP_SECRET อย่างน้อย 32 ตัวอักษรใน Edge Function');
}
async function apiBootstrap(token) {
  ensureAppReady_();
  const session = token ? await getSessionUser_(token) : null;
  return {
    ok: true,
    user: session ? publicUser_(session.user) : null,
    schema: getQuestionnaireSchema_()
  };
}
async function revokeSession(token) {
  const current = await requireSession_(token);
  await updateObjectRow_(APP_CONFIG.tables.sessions, current.session.sessionId, {
    revokedAt: iso_(new Date())
  });
  return {
    ok: true
  };
}
async function prepareVideoUpload(token, payload) {
  const session = await requireSession_(token);
  const screening = await getScreeningById_(payload.screeningId);
  const staff = ['admin', 'nurse', 'ent', 'doctor'].includes(session.user.role);
  if (!screening || !staff && screening.parentId !== session.user.userId) throw new Error('ไม่มีสิทธิ์อัปโหลดวิดีโอ');
  const mimeType = String(payload.mimeType || '');
  if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(mimeType)) throw new Error('รองรับวิดีโอ MP4, WebM และ MOV');
  if (!Number.isInteger(payload.sizeBytes) || payload.sizeBytes <= 0 || payload.sizeBytes > 50 * 1024 * 1024) throw new Error('ขนาดวิดีโอต้องไม่เกิน 50 MB');
  const videoId = crypto.randomUUID();
  const storagePath = screening.childId + '/' + videoId;
  const record = {
    videoId,
    screeningId: screening.screeningId,
    childId: screening.childId,
    parentId: screening.parentId,
    storagePath,
    fileName: makeSafeFileName_(payload.fileName),
    mimeType,
    sizeBytes: payload.sizeBytes,
    uploadedAt: '',
    uploadStatus: 'pending',
    aiStatus: 'not-configured',
    aiResultJson: '',
    aiConfidence: '',
    reviewStatus: 'pending-human-review',
    reviewerNotes: '',
    updatedAt: iso_(new Date())
  };
  const {data, error} = await storage.from('screening-videos').createSignedUploadUrl(storagePath);
  if (error) throw new Error('สร้างช่องทางอัปโหลดไม่สำเร็จ');
  await appendObject_(APP_CONFIG.tables.videos, record);
  return {
    ok: true,
    videoId,
    uploadUrl: data.signedUrl
  };
}
async function completeVideoUpload(token, videoId) {
  const session = await requireSession_(token);
  const video = (await readObjectsByField_(APP_CONFIG.tables.videos, 'videoId', videoId))[0];
  if (!video || video.parentId !== session.user.userId && !['admin', 'nurse', 'ent', 'doctor'].includes(session.user.role)) throw new Error('ไม่มีสิทธิ์เข้าถึงวิดีโอ');
  const folder = video.storagePath.split('/').slice(0, -1).join('/');
  const name = video.storagePath.split('/').pop();
  const {data, error} = await storage.from('screening-videos').list(folder, {
    search: name,
    limit: 10
  });
  const object = data?.find(item => item.name === name);
  if (error || !object || Number(object.metadata?.size) !== Number(video.sizeBytes) || object.metadata?.mimetype !== video.mimeType) throw new Error('วิดีโอยังอัปโหลดไม่ครบหรือข้อมูลไฟล์ไม่ตรง');
  const patch = {
    uploadStatus: 'uploaded',
    uploadedAt: iso_(new Date()),
    updatedAt: iso_(new Date())
  };
  await updateObjectRow_(APP_CONFIG.tables.videos, video.videoId, patch);
  return {
    ok: true,
    video: {
      ...publicVideo_({
        ...video,
        ...patch
      }),
      url: await getVideoUrl(token, videoId)
    }
  };
}
async function getVideoUrl(token, videoId) {
  const session = await requireSession_(token);
  const video = (await readObjectsByField_(APP_CONFIG.tables.videos, 'videoId', videoId))[0];
  if (!video || video.uploadStatus !== 'uploaded' || video.parentId !== session.user.userId && !['admin', 'nurse', 'ent', 'doctor'].includes(session.user.role)) throw new Error('ไม่มีสิทธิ์เข้าถึงวิดีโอ');
  const {data, error} = await storage.from('screening-videos').createSignedUrl(video.storagePath, 600);
  if (error) throw new Error('เปิดวิดีโอไม่สำเร็จ');
  return data.signedUrl;
}

return { apiBootstrap, loginWithCid, loginParentLookup, loginAdmin, registerChildPublic, saveChildProfile, getChildForEdit, listChildTrash, setChildTrash, submitScreening, listParentDashboard, listClinicalDashboard, listAdminDashboard, getReportData, saveClinicalReview, updateUserByAdmin, updateVideoReviewByAdmin, prepareVideoUpload, completeVideoUpload, getVideoUrl, revokeSession };
}
