#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BASE_SCHEMA, BASE_SCHEMA_VERSION, validateSchema } from './jcikl-base-schema.mjs';

const API_ORIGIN = (process.env.LARK_API_ORIGIN || 'https://open.larksuite.com').replace(/\/$/, '');
const DEFAULT_APP_ID = 'cli_aaea739ab3219eef';
const STATE_FILE = resolve(process.cwd(), process.env.LARK_BASE_STATE_FILE || '.lark-jcikl-state.json');
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function findString(value, keys) {
  if (!value || typeof value !== 'object') return '';
  for (const key of keys) {
    if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
  }
  for (const child of Object.values(value)) {
    const result = findString(child, keys);
    if (result) return result;
  }
  return '';
}

function listFrom(data, candidates) {
  if (Array.isArray(data)) return data;
  for (const key of candidates) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function idOf(value) {
  return findString(value, ['id', 'table_id']);
}

function nameOf(value) {
  return findString(value, ['name', 'table_name', 'field_name']);
}

async function request(path, { method = 'GET', token, body } = {}) {
  const maxAttempts = 7;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(`Lark returned non-JSON (${response.status}) for ${method} ${path}`);
    }

    const message = payload.msg || payload.message || response.statusText || 'Unknown Lark API error';
    const code = payload.code ?? response.status;
    const rateLimited = response.status === 429
      || code === 800004135
      || code === 1254290
      || /limited|too many request/i.test(message);

    if (rateLimited && attempt < maxAttempts) {
      const retryAfterSeconds = Number(response.headers.get('retry-after'));
      const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : Math.min(1000 * (2 ** (attempt - 1)), 8000);
      console.warn(`rate limited; retrying ${method} ${path} in ${delayMs}ms (${attempt}/${maxAttempts})`);
      await sleep(delayMs);
      continue;
    }

    if (!response.ok || (typeof payload.code === 'number' && payload.code !== 0)) {
      throw new Error(`${method} ${path} failed: ${message} (code ${code})`);
    }
    return payload.data ?? payload;
  }
  throw new Error(`${method} ${path} failed after retries.`);
}

async function getTenantToken() {
  const appId = process.env.LARK_APP_ID || DEFAULT_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  if (!appSecret) {
    throw new Error('LARK_APP_SECRET is required for --apply. Set it only in your local terminal; never commit or paste it into chat.');
  }

  const data = await request('/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    body: { app_id: appId, app_secret: appSecret },
  });
  const token = findString(data, ['tenant_access_token']);
  if (!token) throw new Error('Lark token response did not contain tenant_access_token.');
  return token;
}

async function createBase(token) {
  const body = {
    name: process.env.LARK_BASE_NAME || BASE_SCHEMA.name,
    time_zone: process.env.LARK_TIME_ZONE || BASE_SCHEMA.timeZone,
  };
  if (process.env.LARK_FOLDER_TOKEN) body.folder_token = process.env.LARK_FOLDER_TOKEN;

  const data = await request('/open-apis/base/v3/bases', { method: 'POST', token, body });
  const baseToken = findString(data, ['base_token', 'app_token']);
  if (!baseToken) throw new Error('Create Base response did not contain base_token/app_token.');
  return { baseToken, createResponse: data };
}

async function listTables(token, baseToken) {
  const data = await request(`/open-apis/base/v3/bases/${encodeURIComponent(baseToken)}/tables?offset=0&limit=100`, { token });
  return listFrom(data, ['tables', 'items']);
}

async function listFields(token, baseToken, tableId) {
  const data = await request(
    `/open-apis/base/v3/bases/${encodeURIComponent(baseToken)}/tables/${encodeURIComponent(tableId)}/fields?offset=0&limit=200`,
    { token },
  );
  return listFrom(data, ['fields', 'items']);
}

async function createTable(token, baseToken, table) {
  return request(`/open-apis/base/v3/bases/${encodeURIComponent(baseToken)}/tables`, {
    method: 'POST',
    token,
    body: { name: table.name, fields: table.fields },
  });
}

async function renameTable(token, baseToken, tableId, name) {
  return request(
    `/open-apis/base/v3/bases/${encodeURIComponent(baseToken)}/tables/${encodeURIComponent(tableId)}`,
    { method: 'PATCH', token, body: { name } },
  );
}

async function grantOwnerAccess(token, baseToken) {
  const ownerOpenId = process.env.LARK_OWNER_OPEN_ID?.trim();
  if (!ownerOpenId) return false;
  await request(
    `/open-apis/drive/v1/permissions/${encodeURIComponent(baseToken)}/members?need_notification=false&type=bitable`,
    {
      method: 'POST',
      token,
      body: { member_type: 'openid', member_id: ownerOpenId, perm: 'full_access', type: 'user' },
    },
  );
  console.log('granted full access to LARK_OWNER_OPEN_ID');
  return true;
}

async function createField(token, baseToken, tableId, field) {
  return request(
    `/open-apis/base/v3/bases/${encodeURIComponent(baseToken)}/tables/${encodeURIComponent(tableId)}/fields`,
    { method: 'POST', token, body: field },
  );
}

async function ensureTable(token, baseToken, table, existingTables) {
  const existing = existingTables.find((candidate) => nameOf(candidate) === table.name);
  if (!existing) {
    const created = await createTable(token, baseToken, table);
    const tableId = idOf(created);
    if (!tableId) throw new Error(`Create table response did not include an ID for ${table.name}.`);
    console.log(`created table: ${table.name}`);
    existingTables.push(created);
    // Lark throttles repeated OpenAPIAddTable calls more strictly than field writes.
    await sleep(1100);
    return tableId;
  }

  const tableId = idOf(existing);
  if (!tableId) throw new Error(`Existing table did not include an ID: ${table.name}`);
  const fields = await listFields(token, baseToken, tableId);
  const fieldNames = new Set(fields.map(nameOf));
  for (const field of table.fields) {
    if (fieldNames.has(field.name)) continue;
    await createField(token, baseToken, tableId, field);
    await sleep(130);
    console.log(`created field: ${table.name}.${field.name}`);
  }
  console.log(`reused table: ${table.name}`);
  return tableId;
}

async function ensureRelation(token, baseToken, relation, tableIds) {
  const [sourceKey, fieldName, targetKey] = relation;
  const sourceId = tableIds[sourceKey];
  const targetId = tableIds[targetKey];
  const fields = await listFields(token, baseToken, sourceId);
  if (fields.some((field) => nameOf(field) === fieldName)) {
    console.log(`reused relation: ${sourceKey}.${fieldName}`);
    return;
  }
  await createField(token, baseToken, sourceId, {
    name: fieldName,
    type: 'link',
    link_table: targetId,
    bidirectional: false,
  });
  await sleep(130);
  console.log(`created relation: ${sourceKey}.${fieldName} -> ${targetKey}`);
}

function printPlan() {
  const totalFields = BASE_SCHEMA.tables.reduce((sum, table) => sum + table.fields.length, 0);
  console.log(`Lark Base provisioning plan (schema ${BASE_SCHEMA_VERSION})`);
  console.log(`Base: ${process.env.LARK_BASE_NAME || BASE_SCHEMA.name}`);
  console.log(`Time zone: ${process.env.LARK_TIME_ZONE || BASE_SCHEMA.timeZone}`);
  console.log(`Tables: ${BASE_SCHEMA.tables.length}; fields: ${totalFields}; relations: ${BASE_SCHEMA.relations.length}`);
  for (const table of BASE_SCHEMA.tables) {
    console.log(`- ${table.name}: ${table.fields.length} fields <- ${table.sourceCollections.join(', ')}`);
  }
  console.log(`Excluded internal collections: ${BASE_SCHEMA.excludedCollections.join(', ')}`);
}

async function saveState(state) {
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

async function main() {
  validateSchema();
  printPlan();
  if (!apply) {
    console.log('\nDry run only. No Lark data was changed. Run with --apply after configuring permissions and environment variables.');
    return;
  }

  const token = await getTenantToken();
  let baseToken = process.env.LARK_BASE_TOKEN?.trim();
  let createResponse = null;
  if (!baseToken) {
    ({ baseToken, createResponse } = await createBase(token));
    console.log('created Base');
  } else {
    console.log('resuming existing Base from LARK_BASE_TOKEN');
  }

  const existingTables = await listTables(token, baseToken);
  if (createResponse && existingTables.length === 1) {
    const defaultTableId = idOf(existingTables[0]);
    if (defaultTableId) {
      const renamed = await renameTable(token, baseToken, defaultTableId, '00 Setup');
      existingTables[0] = renamed;
      console.log('renamed default table: 00 Setup');
    }
  }
  const ownerAccessGranted = createResponse ? await grantOwnerAccess(token, baseToken) : false;
  if (createResponse && !ownerAccessGranted && !process.env.LARK_FOLDER_TOKEN) {
    console.warn('warning: set LARK_OWNER_OPEN_ID or LARK_FOLDER_TOKEN if the new Base is not visible in your Lark workspace');
  }
  const tableIds = {};
  const state = {
    schemaVersion: BASE_SCHEMA_VERSION,
    baseName: process.env.LARK_BASE_NAME || BASE_SCHEMA.name,
    baseToken,
    baseUrl: findString(createResponse, ['url']),
    tableIds,
    updatedAt: new Date().toISOString(),
  };
  await saveState(state);

  for (const table of BASE_SCHEMA.tables) {
    tableIds[table.key] = await ensureTable(token, baseToken, table, existingTables);
    state.updatedAt = new Date().toISOString();
    await saveState(state);
  }

  for (const relation of BASE_SCHEMA.relations) {
    await ensureRelation(token, baseToken, relation, tableIds);
  }

  state.updatedAt = new Date().toISOString();
  state.completed = true;
  await saveState(state);
  console.log(`\nProvisioning complete. State saved to ${STATE_FILE}`);
  console.log(`Base token: ${baseToken}`);
  if (state.baseUrl) console.log(`Base URL: ${state.baseUrl}`);
}

main().catch((error) => {
  console.error(`\nProvisioning stopped: ${error.message}`);
  console.error('Nothing is rolled back automatically. Re-run with LARK_BASE_TOKEN to safely resume the same Base.');
  process.exitCode = 1;
});
