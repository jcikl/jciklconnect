#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const API_ORIGIN = (process.env.LARK_API_ORIGIN || 'https://open.larksuite.com').replace(/\/$/, '');
const APP_ID = process.env.LARK_APP_ID || 'cli_aaea739ab3219eef';
const APPLY = process.argv.includes('--apply');
const STATE_PATH = resolve(process.cwd(), process.env.LARK_BASE_STATE_FILE || '.lark-jcikl-state.json');
const REPORT_PATH = resolve(process.cwd(), 'lark-relation-backfill-report.json');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const TABLES = [
  'members', 'board_members', 'projects', 'project_committee', 'tasks', 'events',
  'event_registrations', 'event_budgets', 'bank_accounts', 'transactions',
  'transaction_splits', 'payment_requests', 'inventory', 'stock_movements',
  'sponsorships', 'points_ledger', 'mentorship_matches', 'member_benefits',
  'benefit_usage',
];

const RELATIONS = [
  { source: 'board_members', field: 'Member', target: 'members', sourceId: 'Member Firebase ID' },
  { source: 'projects', field: 'Project Lead', target: 'members', sourceId: 'Lead Firebase ID' },
  { source: 'project_committee', field: 'Project', target: 'projects', sourceId: 'Project Firebase ID' },
  { source: 'project_committee', field: 'Member', target: 'members', sourceId: 'Member Firebase ID' },
  { source: 'tasks', field: 'Project', target: 'projects', sourceId: 'Project Firebase ID' },
  { source: 'tasks', field: 'Assignee', target: 'members', sourceId: 'Assignee Firebase ID' },
  { source: 'events', field: 'Organizer', target: 'members', sourceId: 'Organizer Firebase ID' },
  { source: 'event_registrations', field: 'Project / Event', target: 'projects', sourceId: 'Event Firebase ID' },
  { source: 'event_registrations', field: 'Member', target: 'members', sourceId: 'Member Firebase ID' },
  { source: 'event_registrations', field: 'Finance Transaction', target: 'transactions', sourceId: 'Finance Transaction Firebase ID', transaction: true },
  { source: 'event_budgets', field: 'Project / Event', target: 'projects', sourceId: 'Event Firebase ID' },
  { source: 'transactions', field: 'Bank Account', target: 'bank_accounts', sourceId: 'Bank Account Firebase ID' },
  { source: 'transactions', field: 'Project', target: 'projects', sourceId: 'Project Firebase ID' },
  { source: 'transactions', field: 'Member', target: 'members', sourceId: 'Member Firebase ID' },
  { source: 'transactions', field: 'Payment Request', target: 'payment_requests', sourceId: 'Payment Request Firebase ID' },
  { source: 'transaction_splits', field: 'Parent Transaction', target: 'transactions', sourceId: 'Parent Transaction Firebase ID', transaction: true },
  { source: 'transaction_splits', field: 'Project', target: 'projects', sourceId: 'Project Firebase ID' },
  { source: 'transaction_splits', field: 'Member', target: 'members', sourceId: 'Member Firebase ID' },
  { source: 'transaction_splits', field: 'Payment Request', target: 'payment_requests', sourceId: 'Payment Request Firebase ID' },
  { source: 'payment_requests', field: 'Applicant', target: 'members', sourceId: 'Applicant Firebase ID' },
  { source: 'payment_requests', field: 'Activity / Project', target: 'projects', sourceId: 'Activity Firebase ID' },
  { source: 'payment_requests', field: 'Bank Account', target: 'bank_accounts', sourceId: 'Bank Account Number', targetId: 'Account Number', uniqueTextMatch: true },
  { source: 'inventory', field: 'Custodian', target: 'members', sourceId: 'Custodian Firebase ID' },
  { source: 'stock_movements', field: 'Inventory Item', target: 'inventory', sourceId: 'Item Firebase ID' },
  { source: 'stock_movements', field: 'Performed By', target: 'members', sourceId: 'Performed By Firebase ID' },
  { source: 'sponsorships', field: 'Member', target: 'members', sourceId: 'Member Firebase ID' },
  { source: 'points_ledger', field: 'Member', target: 'members', sourceId: 'Member Firebase ID' },
  { source: 'points_ledger', field: 'Awarded By', target: 'members', sourceId: 'Awarded By Firebase ID' },
  { source: 'mentorship_matches', field: 'Mentor', target: 'members', sourceId: 'Mentor Firebase ID' },
  { source: 'mentorship_matches', field: 'Mentee', target: 'members', sourceId: 'Mentee Firebase ID' },
  { source: 'benefit_usage', field: 'Member', target: 'members', sourceId: 'Member Firebase ID' },
  { source: 'benefit_usage', field: 'Benefit', target: 'member_benefits', sourceId: 'Benefit Firebase ID' },
];

function clean(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return value;
}

function asText(value) {
  value = clean(value);
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return asText(value[0]);
  if (typeof value === 'object') return asText(value.text || value.name || value.value);
  return String(value).trim() || undefined;
}

function fieldsOf(record) {
  return record.fields || record.record?.fields || {};
}

function recordIdOf(record) {
  return record.record_id || record.recordId || record.id || record.record?.record_id;
}

function linkedRecordIds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return item;
    return item?.record_id || item?.recordId || item?.id;
  }).filter(Boolean);
}

function sameLink(current, expected) {
  const currentIds = linkedRecordIds(current);
  return currentIds.length === expected.length && expected.every((id) => currentIds.includes(id));
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

async function updateRecords(token, baseToken, tableId, updates) {
  for (let index = 0; index < updates.length; index += 100) {
    const batch = updates.slice(index, index + 100);
    try {
      await request(`/open-apis/bitable/v1/apps/${encodeURIComponent(baseToken)}/tables/${encodeURIComponent(tableId)}/records/batch_update?ignore_consistency_check=true`, {
        method: 'POST',
        token,
        body: { records: batch },
      });
    } catch (error) {
      if (!/800030005|not_found/i.test(error.message)) throw error;
      console.warn('  batch_update is unavailable for this tenant; falling back to single-record updates');
      for (const update of batch) {
        await request(`/open-apis/bitable/v1/apps/${encodeURIComponent(baseToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(update.record_id)}?ignore_consistency_check=true`, {
          method: 'PUT',
          token,
          body: { fields: update.fields },
        });
        await sleep(260);
      }
    }
    console.log(`  updated ${Math.min(index + batch.length, updates.length)}/${updates.length}`);
    await sleep(650);
  }
}

function addUnique(index, key, recordId) {
  key = asText(key);
  if (!key || !recordId) return;
  const existing = index.get(key);
  if (!existing) index.set(key, recordId);
  else if (existing !== recordId) index.set(key, null);
}

function buildIndexes(recordsByTable) {
  const byFirebaseId = new Map();
  const byText = new Map();

  for (const [table, records] of recordsByTable) {
    const idIndex = new Map();
    const textIndexes = new Map();
    for (const record of records) {
      const fields = fieldsOf(record);
      const recordId = recordIdOf(record);
      addUnique(idIndex, fields['Firebase ID'], recordId);
      for (const fieldName of ['Account Number']) {
        if (!textIndexes.has(fieldName)) textIndexes.set(fieldName, new Map());
        addUnique(textIndexes.get(fieldName), fields[fieldName], recordId);
      }
    }
    byFirebaseId.set(table, idIndex);
    byText.set(table, textIndexes);
  }

  const txBySourceKey = new Map();
  const txByFirebaseId = new Map();
  for (const record of recordsByTable.get('transactions') || []) {
    const fields = fieldsOf(record);
    const recordId = recordIdOf(record);
    const firebaseId = asText(fields['Firebase ID']);
    const source = asText(fields.Source) || 'transactions';
    addUnique(txBySourceKey, `${source}/${firebaseId}`, recordId);
    addUnique(txByFirebaseId, firebaseId, recordId);
  }

  return { byFirebaseId, byText, txBySourceKey, txByFirebaseId };
}

function resolveTarget(spec, sourceFields, indexes) {
  const sourceValue = asText(sourceFields[spec.sourceId]);
  if (!sourceValue) return { status: 'missing-source-id' };

  if (spec.transaction) {
    const exact = indexes.txBySourceKey.get(`transactions/${sourceValue}`) || indexes.txBySourceKey.get(`projectTrx/${sourceValue}`);
    if (exact) return { status: 'resolved', recordId: exact };
    if (exact === null) return { status: 'ambiguous-target' };
    const fallback = indexes.txByFirebaseId.get(sourceValue);
    if (fallback) return { status: 'resolved', recordId: fallback };
    if (fallback === null) return { status: 'ambiguous-target' };
    return { status: 'missing-target' };
  }

  if (spec.uniqueTextMatch) {
    const target = indexes.byText.get(spec.target)?.get(spec.targetId)?.get(sourceValue);
    if (target) return { status: 'resolved', recordId: target };
    if (target === null) return { status: 'ambiguous-target' };
    return { status: 'missing-target' };
  }

  const target = indexes.byFirebaseId.get(spec.target)?.get(sourceValue);
  if (target) return { status: 'resolved', recordId: target };
  if (target === null) return { status: 'ambiguous-target' };
  return { status: 'missing-target' };
}

async function main() {
  const state = JSON.parse(await readFile(STATE_PATH, 'utf8'));
  const baseToken = process.env.LARK_BASE_TOKEN || state.baseToken;
  if (!baseToken) throw new Error('Base token missing from environment and state file.');
  const token = await tenantToken();

  const recordsByTable = new Map();
  for (const table of TABLES) {
    const tableId = state.tableIds?.[table];
    if (!tableId) throw new Error(`Missing table ID in state: ${table}`);
    console.log(`${table}: reading records...`);
    recordsByTable.set(table, await listRecords(token, baseToken, tableId));
  }

  const indexes = buildIndexes(recordsByTable);
  const report = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry-run',
    baseToken,
    totals: { relations: RELATIONS.length, recordsScanned: 0, updates: 0, alreadyLinked: 0, missingSourceId: 0, missingTarget: 0, ambiguousTarget: 0 },
    relations: {},
  };

  for (const spec of RELATIONS) {
    const records = recordsByTable.get(spec.source) || [];
    const updates = [];
    const stats = { scanned: records.length, updates: 0, alreadyLinked: 0, missingSourceId: 0, missingTarget: 0, ambiguousTarget: 0 };
    for (const record of records) {
      const fields = fieldsOf(record);
      const sourceRecordId = recordIdOf(record);
      const target = resolveTarget(spec, fields, indexes);
      if (target.status === 'missing-source-id') { stats.missingSourceId += 1; continue; }
      if (target.status === 'missing-target') { stats.missingTarget += 1; continue; }
      if (target.status === 'ambiguous-target') { stats.ambiguousTarget += 1; continue; }
      const nextValue = [target.recordId];
      if (sameLink(fields[spec.field], nextValue)) { stats.alreadyLinked += 1; continue; }
      updates.push({ record_id: sourceRecordId, fields: { [spec.field]: nextValue } });
    }

    stats.updates = updates.length;
    report.relations[`${spec.source}.${spec.field}`] = stats;
    report.totals.recordsScanned += stats.scanned;
    report.totals.updates += stats.updates;
    report.totals.alreadyLinked += stats.alreadyLinked;
    report.totals.missingSourceId += stats.missingSourceId;
    report.totals.missingTarget += stats.missingTarget;
    report.totals.ambiguousTarget += stats.ambiguousTarget;

    console.log(`${spec.source}.${spec.field}: ${updates.length} update(s), ${stats.alreadyLinked} already linked, ${stats.missingTarget} missing target`);
    if (APPLY && updates.length) {
      await updateRecords(token, baseToken, state.tableIds[spec.source], updates);
    }
  }

  if (APPLY) report.completedAt = new Date().toISOString();
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(`\nRelation backfill ${APPLY ? 'complete' : 'plan complete'}. Report: ${REPORT_PATH}`);
  if (!APPLY) console.log('No Lark records were changed. Re-run with --apply to update linked-record fields.');
}

main().catch((error) => {
  console.error(`Relation backfill stopped: ${error.message}`);
  console.error('Re-run safely: only linked-record fields are updated, and already-linked records are skipped.');
  process.exitCode = 1;
});
