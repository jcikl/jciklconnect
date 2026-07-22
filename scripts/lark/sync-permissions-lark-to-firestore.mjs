#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const API_ORIGIN = (process.env.LARK_API_ORIGIN || 'https://open.larksuite.com').replace(/\/$/, '');
const APP_ID = process.env.LARK_APP_ID || 'cli_aaea739ab3219eef';
const STATE_PATH = resolve(process.cwd(), process.env.LARK_BASE_STATE_FILE || '.lark-jcikl-state.json');
const REPORT_PATH = resolve(process.cwd(), 'lark-permissions-sync-report.json');
const CREDENTIAL_PATH = resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS || 'serviceAccountKey.json');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function cleanText(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return cleanText(value[0]);
  if (typeof value === 'object') return cleanText(value.text || value.name || value.value);
  return String(value).trim() || undefined;
}

function asBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return asBoolean(value[0]);
  if (typeof value === 'string') return /^(true|yes|1)$/i.test(value);
  return Boolean(value);
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fieldsOf(record) {
  return record.fields || record.record?.fields || {};
}

function docId(value) {
  return String(value).trim().replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
}

async function request(path, { method = 'GET', token, body } = {}) {
  for (let attempt = 1; attempt <= 7; attempt += 1) {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = JSON.parse((await response.text()) || '{}');
    const code = payload.code ?? response.status;
    const message = payload.msg || payload.message || response.statusText;
    const limited = response.status === 429 || code === 1254290 || code === 800004135 || /limited|too many/i.test(message || '');
    if (limited && attempt < 7) {
      await sleep(Math.min(1000 * 2 ** (attempt - 1), 8000));
      continue;
    }
    if (!response.ok || (typeof payload.code === 'number' && payload.code !== 0)) {
      throw new Error(`${method} ${path} failed: ${message} (code ${code})`);
    }
    return payload.data ?? payload;
  }
}

async function tenantToken() {
  if (!process.env.LARK_APP_SECRET) throw new Error('LARK_APP_SECRET is required. Set it only in your local terminal.');
  const data = await request('/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    body: { app_id: APP_ID, app_secret: process.env.LARK_APP_SECRET },
  });
  return data.tenant_access_token;
}

async function listRecords(token, baseToken, tableId) {
  const records = [];
  let pageToken;
  while (true) {
    const params = new URLSearchParams({ page_size: '500' });
    if (pageToken) params.set('page_token', pageToken);
    const data = await request(`/open-apis/bitable/v1/apps/${encodeURIComponent(baseToken)}/tables/${encodeURIComponent(tableId)}/records?${params}`, { token });
    const page = data.records || data.items || [];
    records.push(...page);
    if (!data.has_more || page.length === 0) break;
    pageToken = data.page_token;
    if (!pageToken) break;
  }
  return records;
}

async function loadFirebase() {
  const serviceAccount = JSON.parse(await readFile(CREDENTIAL_PATH, 'utf8'));
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

async function main() {
  const state = JSON.parse(await readFile(STATE_PATH, 'utf8'));
  const baseToken = process.env.LARK_BASE_TOKEN || state.baseToken;
  const tableIds = state.tableIds || {};
  for (const key of ['permission_catalog', 'user_role_permissions', 'membership_type_permissions', 'position_permissions']) {
    if (!tableIds[key]) throw new Error(`Missing tableIds.${key}. Run create-lark-permission-schema.ps1 first.`);
  }

  const [token, db] = await Promise.all([tenantToken(), loadFirebase()]);
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  const report = {
    generatedAt: new Date().toISOString(),
    source: 'lark',
    collections: { permissionCatalog: 0, userRolePermissions: 0, membershipTypePermissions: 0, positionPermissions: 0 },
  };

  const permissions = await listRecords(token, baseToken, tableIds.permission_catalog);
  for (const record of permissions) {
    const fields = fieldsOf(record);
    const key = cleanText(fields['Permission Key']);
    if (!key) continue;
    batch.set(db.collection('permissionCatalog').doc(key), {
      key,
      name: cleanText(fields['Permission Name']) || key,
      category: cleanText(fields.Category) || 'Core',
      description: cleanText(fields.Description) || '',
      active: asBoolean(fields.Active),
      updatedAt: now,
    }, { merge: true });
    report.collections.permissionCatalog += 1;
  }

  const roleRules = await listRecords(token, baseToken, tableIds.user_role_permissions);
  for (const record of roleRules) {
    const fields = fieldsOf(record);
    const userRole = cleanText(fields['User Role']);
    const permissionKey = cleanText(fields['Permission Key']);
    if (!userRole || !permissionKey) continue;
    batch.set(db.collection('userRolePermissions').doc(docId(`${userRole}_${permissionKey}`)), {
      userRole,
      permissionKey,
      allowed: asBoolean(fields.Allowed),
      priority: asNumber(fields.Priority, 100),
      notes: cleanText(fields.Notes) || '',
      active: true,
      updatedAt: now,
    }, { merge: true });
    report.collections.userRolePermissions += 1;
  }

  const membershipRules = await listRecords(token, baseToken, tableIds.membership_type_permissions);
  for (const record of membershipRules) {
    const fields = fieldsOf(record);
    const membershipType = cleanText(fields['Membership Type']);
    const permissionKey = cleanText(fields['Permission Key']);
    if (!membershipType || !permissionKey) continue;
    batch.set(db.collection('membershipTypePermissions').doc(docId(`${membershipType}_${permissionKey}`)), {
      membershipType,
      permissionKey,
      allowed: asBoolean(fields.Allowed),
      priority: asNumber(fields.Priority, 50),
      notes: cleanText(fields.Notes) || '',
      active: true,
      updatedAt: now,
    }, { merge: true });
    report.collections.membershipTypePermissions += 1;
  }

  const positionRules = await listRecords(token, baseToken, tableIds.position_permissions);
  for (const record of positionRules) {
    const fields = fieldsOf(record);
    const position = cleanText(fields.Position);
    const permissionKey = cleanText(fields['Permission Key']);
    if (!position || !permissionKey) continue;
    batch.set(db.collection('positionPermissions').doc(docId(`${position}_${permissionKey}`)), {
      position,
      scope: cleanText(fields.Scope) || 'Global',
      permissionKey,
      allowed: asBoolean(fields.Allowed),
      priority: asNumber(fields.Priority, 80),
      notes: cleanText(fields.Notes) || '',
      active: true,
      updatedAt: now,
    }, { merge: true });
    report.collections.positionPermissions += 1;
  }

  await batch.commit();
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log('Lark permission rules synced to Firestore.');
  console.log(`Report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(`Lark permission sync failed: ${error.message}`);
  process.exitCode = 1;
});
