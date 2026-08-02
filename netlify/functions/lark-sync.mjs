import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const API_ORIGIN = (process.env.LARK_API_ORIGIN || 'https://open.larksuite.com').replace(/\/$/, '');
const APP_ID = process.env.LARK_APP_ID;
const APP_SECRET = process.env.LARK_APP_SECRET;
const BASE_TOKEN = process.env.LARK_BASE_TOKEN;
const MEMBERS_TABLE_ID = process.env.LARK_MEMBERS_TABLE_ID;

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001'];
const ADMIN_ROLES = new Set(['BOARD', 'ADMIN', 'SUPER_ADMIN']);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function corsHeaders(req) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function clean(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return value;
}

function first(...values) {
  return values.map(clean).find((value) => value !== undefined);
}

function asText(value) {
  value = clean(value);
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value.slice(0, 100000);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value).slice(0, 100000);
}

function asNumber(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function asDate(value) {
  if (value === undefined || value === null || value === '') return undefined;
  let date;
  if (value instanceof Timestamp) date = value.toDate();
  else if (value instanceof Date) date = value;
  else if (typeof value?.toDate === 'function') date = value.toDate();
  else date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function compact(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function memberFields(id, data) {
  return compact({
    'Member Name': asText(first(data.general?.fullName, data.general?.name, data.fullName, data.name, id)),
    'Firebase ID': id,
    'LO ID': asText(data.loId),
    'Source Created At': asDate(data.createdAt),
    'Source Updated At': asDate(data.updatedAt),
    Email: asText(first(data.contact?.email, data.email)),
    Phone: asText(first(data.contact?.phone, data.phone)),
    Role: asText(data.jciCareer?.role ?? data.role),
    'Membership Type': asText(first(data.jciCareer?.membershipType, data.membership?.type, data.membershipType)),
    'Membership Tier': asText(data.tier),
    'Dues Status': asText(first(data.membership?.duesStatus, data.duesStatus)),
    'Join Date': asDate(first(data.jciCareer?.joinDate, data.membership?.joinDate, data.joinDate)),
    Points: asNumber(data.points),
    Company: asText(first(data.business?.companyName, data.companyName)),
    Position: asText(first(data.business?.position, data.business?.title, data.departmentAndPosition)),
    Industry: asText(first(data.business?.industry, data.industry)),
    Address: asText(first(data.contact?.address, data.address)),
    'Current Board Position': asText(data.currentBoardPosition),
    Active: data.deletedAt ? false : first(data.status === 'active' ? true : undefined, data.active),
  });
}

async function larkRequest(path, { method = 'GET', token, body } = {}) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = JSON.parse((await response.text()) || '{}');
    const code = payload.code ?? response.status;
    const message = payload.msg || payload.message || response.statusText;
    const limited = response.status === 429 || code === 1254290 || code === 800004135 || /limited|too many/i.test(message || '');
    if (limited && attempt < 5) {
      await sleep(Math.min(500 * 2 ** (attempt - 1), 5000));
      continue;
    }
    if (!response.ok || (typeof payload.code === 'number' && payload.code !== 0)) {
      throw new Error(`${method} ${path} failed: ${message} (code ${code})`);
    }
    return payload.data ?? payload;
  }
}

async function tenantToken() {
  if (!APP_ID || !APP_SECRET) throw new Error('LARK_APP_ID and LARK_APP_SECRET are required');
  const data = await larkRequest('/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    body: { app_id: APP_ID, app_secret: APP_SECRET },
  });
  return data.tenant_access_token;
}

function recordFields(record) {
  return record.fields || record.record?.fields || {};
}

async function findRecordId(token, tableId, firebaseId) {
  let pageToken;
  while (true) {
    const params = new URLSearchParams({ page_size: '500' });
    if (pageToken) params.set('page_token', pageToken);
    const data = await larkRequest(
      `/open-apis/bitable/v1/apps/${encodeURIComponent(BASE_TOKEN)}/tables/${encodeURIComponent(tableId)}/records?${params}`,
      { token }
    );
    const records = data.records || data.items || [];
    const match = records.find((record) => recordFields(record)['Firebase ID'] === firebaseId);
    if (match) return match.record_id || match.id;
    if (!data.has_more || records.length === 0) return null;
    pageToken = data.page_token;
  }
}

async function upsertRecord(token, tableId, firebaseId, fields) {
  const recordId = await findRecordId(token, tableId, firebaseId);
  if (recordId) {
    await larkRequest(
      `/open-apis/bitable/v1/apps/${encodeURIComponent(BASE_TOKEN)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`,
      { method: 'PUT', token, body: { fields } }
    );
    return { mode: 'updated', recordId };
  }
  const data = await larkRequest(
    `/open-apis/bitable/v1/apps/${encodeURIComponent(BASE_TOKEN)}/tables/${encodeURIComponent(tableId)}/records`,
    { method: 'POST', token, body: { fields } }
  );
  return { mode: 'created', recordId: data.record?.record_id || data.record_id || data.id };
}

export default async (req, context) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return Response.json({ error: 'Missing authorization token' }, { status: 401, headers: cors });

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    return Response.json({ error: 'Invalid or expired token' }, { status: 401, headers: cors });
  }

  let body;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: cors });
  }

  const { collection, id, action = 'upsert' } = body;
  if (collection !== 'members' || typeof id !== 'string' || !id) {
    return Response.json({ error: 'Only members/{id} sync is supported for now' }, { status: 400, headers: cors });
  }
  if (!['upsert', 'delete'].includes(action)) {
    return Response.json({ error: 'Unsupported sync action' }, { status: 400, headers: cors });
  }

  try {
    if (!BASE_TOKEN || !MEMBERS_TABLE_ID) {
      throw new Error('LARK_BASE_TOKEN and LARK_MEMBERS_TABLE_ID are required');
    }

    const db = getFirestore();
    const callerSnap = await db.collection('members').doc(decoded.uid).get();
    const callerData = callerSnap.exists ? callerSnap.data() : {};
    const callerRole = callerData?.role ?? callerData?.jciCareer?.role;
    if (decoded.uid !== id && !ADMIN_ROLES.has(callerRole)) {
      return Response.json({ error: 'Insufficient permission to sync this member' }, { status: 403, headers: cors });
    }

    const memberSnap = await db.collection('members').doc(id).get();
    if (!memberSnap.exists) {
      return Response.json({ error: 'Member not found' }, { status: 404, headers: cors });
    }

    const token = await tenantToken();
    const fields = memberFields(id, memberSnap.data());
    const result = await upsertRecord(token, MEMBERS_TABLE_ID, id, fields);

    return Response.json({ ok: true, collection, id, action, ...result }, { headers: cors });
  } catch (error) {
    console.error('[lark-sync] failed:', error);
    return Response.json({ error: error.message || 'Lark sync failed' }, { status: 500, headers: cors });
  }
};
