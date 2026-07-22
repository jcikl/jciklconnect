#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const API_ORIGIN = (process.env.LARK_API_ORIGIN || 'https://open.larksuite.com').replace(/\/$/, '');
const APP_ID = process.env.LARK_APP_ID || 'cli_aaea739ab3219eef';
const APPLY = process.argv.includes('--apply');
const STATE_PATH = resolve(process.cwd(), process.env.LARK_BASE_STATE_FILE || '.lark-jcikl-state.json');
const REPORT_PATH = resolve(process.cwd(), 'lark-migration-report.json');
const CREDENTIAL_PATH = resolve(
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  (await exists(resolve(process.cwd(), 'serviceAccountKey.json')) ? 'serviceAccountKey.json' : 'serviceAccount.json'),
);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function exists(path) {
  try { await readFile(path); return true; } catch { return false; }
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

function title(value, fallback) {
  return asText(first(value, fallback, 'Untitled'));
}

function baseFields(document, data) {
  return {
    'Firebase ID': document.id,
    'LO ID': asText(data.loId),
    'Source Created At': asDate(data.createdAt),
    'Source Updated At': asDate(data.updatedAt),
  };
}

const MAPPERS = {
  members: (doc, d) => compact({
    'Member Name': title(first(d.fullName, d.name, d.general?.fullName), doc.id), ...baseFields(doc, d),
    Email: asText(first(d.email, d.contact?.email)), Phone: asText(first(d.phone, d.contact?.phone)),
    Role: asText(d.role), 'Membership Type': asText(first(d.membershipType, d.membership?.type)),
    'Membership Tier': asText(d.tier), 'Dues Status': asText(first(d.duesStatus, d.membership?.duesStatus)),
    'Join Date': asDate(first(d.joinDate, d.membership?.joinDate)), Points: asNumber(d.points),
    Company: asText(first(d.companyName, d.business?.companyName)),
    Position: asText(first(d.departmentAndPosition, d.business?.position, d.business?.title)),
    Industry: asText(first(d.industry, d.business?.industry)), Address: asText(first(d.address, d.contact?.address)),
    'Current Board Position': asText(d.currentBoardPosition), Active: first(d.status === 'active' ? true : undefined, d.active),
  }),
  boardMembers: (doc, d) => compact({
    'Board Appointment': title(`${first(d.memberName, 'Member')} — ${first(d.position, 'Board')}`, doc.id), ...baseFields(doc, d),
    'Member Firebase ID': asText(d.memberId), 'Member Name': asText(d.memberName), Position: asText(d.position),
    Term: asText(d.term), 'Start Date': asDate(d.startDate), 'End Date': asDate(d.endDate), Active: d.isActive,
    'Permissions JSON': asText(d.permissions),
  }),
  projects: (doc, d) => compact({
    'Project Name': title(first(d.name, d.title), doc.id), ...baseFields(doc, d), Description: asText(d.description),
    Status: asText(d.status), 'Lead Firebase ID': asText(first(d.lead?.id, d.leadId, d.organizerId, d.submittedBy)),
    'Lead Name': asText(first(d.lead?.name, d.organizerName)), Level: asText(d.level), Pillar: asText(d.pillar),
    Category: asText(d.category), 'Start Date': asDate(first(d.eventStartDate, d.proposedDate, d.date)),
    'End Date': asDate(d.eventEndDate), Budget: asNumber(first(d.budget, d.proposedBudget)), Spent: asNumber(d.spent),
    'Completion %': asNumber(d.completion), 'Team Size': asNumber(d.teamSize), Location: asText(d.location),
    Objectives: asText(d.objectives), Impact: asText(first(d.expectedImpact, d.impact)),
    'Target Audience': asText(d.targetAudience),
  }),
  flagship_projects: (doc, d) => compact({
    'Project Name': title(d.title, doc.id), ...baseFields(doc, d), Description: asText(d.description), Status: asText(d.status),
    'Completion %': asNumber(d.completion), 'Team Size': asNumber(d.teamSize), Objectives: asText(d.unsdg),
  }),
  tasks: (doc, d) => compact({
    'Task Title': title(d.title, doc.id), ...baseFields(doc, d), 'Project Firebase ID': asText(d.projectId),
    'Project Name': asText(d.projectTitle), 'Assignee Firebase ID': asText(d.assigneeId),
    'Assignee Name': asText(first(d.assigneeName, d.assignee)), 'Committee Role': asText(d.role), Status: asText(d.status),
    Priority: asText(d.priority), 'Start Date': asDate(d.startDate), 'Due Date': asDate(d.dueDate),
    'Progress %': asNumber(d.progress), Dependencies: asText(d.dependencies), Notes: asText(first(d.remarks, d.notes)),
  }),
  eventRegistrations: (doc, d) => compact({
    Registration: title(`${first(d.memberName, d.memberId, 'Member')} — ${first(d.eventId, 'Event')}`, doc.id), ...baseFields(doc, d),
    'Event Firebase ID': asText(d.eventId), 'Event Title': asText(d.eventTitle), 'Member Firebase ID': asText(d.memberId),
    'Member Name': asText(d.memberName), Status: asText(d.status), 'Registered At': asDate(d.createdAt),
    'Paid At': asDate(d.paidAt), 'Checked In At': asDate(d.checkedInAt), 'Payment Method': asText(d.paymentMethod),
    'Finance Transaction Firebase ID': asText(d.financeTransactionId), 'Dietary Requirements': asText(d.dietaryRequirements),
    'Emergency Contact': asText(d.emergencyContact), 'Payment Reference': asText(d.paymentReference),
  }),
  bankAccounts: (doc, d) => compact({
    'Account Name': title(d.name, doc.id), ...baseFields(doc, d), 'Bank Name': asText(d.bankName),
    'Account Number': asText(d.accountNumber), 'Account Type': asText(d.accountType), Currency: asText(d.currency),
    'Opening Balance': asNumber(d.initialBalance), 'Current Balance': asNumber(first(d.balance, d.currentBalance)),
    'Last Reconciled At': asDate(d.lastReconciled), 'Reconciled Balance': asNumber(d.reconciledBalance), Active: d.active,
    Notes: asText(d.notes),
  }),
  transactions: (doc, d) => compact({
    Transaction: title(first(d.description, d.purpose, d.referenceNumber), doc.id), ...baseFields(doc, d),
    'Transaction Date': asDate(d.date), Description: asText(d.description), Purpose: asText(d.purpose),
    Amount: asNumber(first(d.amount, d.income || d.expense)), Type: asText(d.type), Category: asText(d.category),
    Status: asText(d.status), 'Bank Account Firebase ID': asText(d.bankAccountId),
    'Project Firebase ID': asText(d.projectId), 'Member Firebase ID': asText(d.memberId),
    'Payment Request Firebase ID': asText(d.paymentRequestId), Reference: asText(d.referenceNumber),
    'Payment Method': asText(d.paymentMethod), 'Financial Year': asNumber(d.year), 'Match Status': asText(d.matchStatus),
    Source: 'transactions',
  }),
  projectTrx: (doc, d) => compact({
    Transaction: title(first(d.description, d.purpose, d.referenceNumber), doc.id), ...baseFields(doc, d),
    'Transaction Date': asDate(d.date), Description: asText(d.description), Purpose: asText(d.purpose),
    Amount: asNumber(d.amount), Type: asText(d.type), Category: asText(d.category), Status: asText(d.status),
    'Project Firebase ID': asText(d.projectId), Reference: asText(d.referenceNumber),
    'Match Status': asText(d.matchStatus), Source: 'projectTrx',
  }),
  transactionSplits: (doc, d) => compact({
    Split: title(first(d.description, d.purpose), doc.id), ...baseFields(doc, d),
    'Parent Transaction Firebase ID': asText(d.parentTransactionId), 'Project Firebase ID': asText(d.projectId),
    'Member Firebase ID': asText(d.memberId), 'Payment Request Firebase ID': asText(d.paymentRequestId),
    Amount: asNumber(d.amount), Type: asText(d.type), Category: asText(d.category), Description: asText(d.description),
    'Financial Year': asNumber(d.year), Reconciled: d.reconciled,
  }),
  paymentRequests: (doc, d) => compact({
    Request: title(first(d.referenceNumber, d.purpose), doc.id), ...baseFields(doc, d),
    'Applicant Firebase ID': asText(d.applicantId), 'Applicant Name': asText(d.applicantName),
    'Request Date': asDate(first(d.date, d.createdAt)), Category: asText(d.category),
    'Activity Firebase ID': asText(first(d.activityId, d.activityRef)), 'Activity Name': asText(d.activityName),
    Amount: asNumber(first(d.totalAmount, d.amount)), Remark: asText(first(d.remark, d.purpose)),
    'Bank Name': asText(d.bankName), 'Bank Account Number': asText(d.accountNumber),
    'Bank Account Holder': asText(d.accountHolder), Reference: asText(d.referenceNumber), Status: asText(d.status),
    'Reviewer Firebase ID': asText(d.reviewedBy), 'Review Notes': asText(d.reviewNotes),
    'Reviewed At': asDate(d.reviewedAt), 'Paid At': asDate(d.paidAt),
  }),
  inventory: (doc, d) => compact({
    'Item Name': title(d.name, doc.id), ...baseFields(doc, d), Category: asText(d.category), Quantity: asNumber(d.quantity),
    'Minimum Quantity': asNumber(d.minimumQuantity), Location: asText(d.location), Status: asText(d.status),
    'Custodian Firebase ID': asText(d.checkedOutTo), 'Custodian Name': asText(d.custodianName), Condition: asText(d.condition),
    'Purchase Date': asDate(d.purchaseDate), 'Purchase Value': asNumber(d.purchasePrice),
    'Current Value': asNumber(d.currentValue), Notes: asText(d.description),
  }),
  points: (doc, d) => compact({
    'Point Entry': title(first(d.description, d.category), doc.id), ...baseFields(doc, d),
    'Member Firebase ID': asText(d.memberId), 'Member Name': asText(d.memberName),
    Points: asNumber(first(d.points, d.amount)), Category: asText(d.category), Description: asText(d.description),
    'Source Type': asText(first(d.sourceType, d.relatedEntityType)),
    'Source Firebase ID': asText(first(d.sourceId, d.relatedEntityId)), 'Awarded At': asDate(d.createdAt),
    'Expires At': asDate(d.expiresAt), 'Awarded By Firebase ID': asText(d.awardedBy), 'Awarded By Name': asText(d.awardedByName),
  }),
  memberBenefits: (doc, d) => compact({
    'Benefit Name': title(d.name, doc.id), ...baseFields(doc, d), Description: asText(d.description), Type: asText(d.type),
    Category: asText(d.category), Eligibility: asText(d.eligibilityCriteria), 'Valid From': asDate(d.validFrom),
    'Valid Until': asDate(d.validUntil), 'Usage Limit': asNumber(d.usageLimit), 'Usage Count': asNumber(d.currentUsage),
    Status: asText(d.status), Provider: asText(d.provider), Terms: asText(d.termsAndConditions),
  }),
  benefitUsage: (doc, d) => compact({
    'Benefit Usage': title(`${first(d.memberId, 'Member')} — ${first(d.benefitId, 'Benefit')}`, doc.id), ...baseFields(doc, d),
    'Member Firebase ID': asText(d.memberId), 'Member Name': asText(d.memberName),
    'Benefit Firebase ID': asText(d.benefitId), 'Benefit Name': asText(d.benefitName),
    'Used At': asDate(d.usedAt), Notes: asText(first(d.details, d.notes)),
  }),
};

const JOBS = [
  ['members', 'members', 'members'], ['boardMembers', 'board_members', 'boardMembers'],
  ['projects', 'projects', 'projects'], ['flagship_projects', 'projects', 'flagship_projects'],
  ['tasks', 'tasks', 'tasks'], ['eventRegistrations', 'event_registrations', 'eventRegistrations'],
  ['bankAccounts', 'bank_accounts', 'bankAccounts'], ['transactions', 'transactions', 'transactions'],
  ['projectTrx', 'transactions', 'projectTrx'], ['transactionSplits', 'transaction_splits', 'transactionSplits'],
  ['paymentRequests', 'payment_requests', 'paymentRequests'], ['inventory', 'inventory', 'inventory'],
  ['points', 'points_ledger', 'points'], ['memberBenefits', 'member_benefits', 'memberBenefits'],
  ['benefitUsage', 'benefit_usage', 'benefitUsage'],
];

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
    if (limited && attempt < 7) { await sleep(Math.min(1000 * 2 ** (attempt - 1), 8000)); continue; }
    if (!response.ok || (typeof payload.code === 'number' && payload.code !== 0)) {
      throw new Error(`${method} ${path} failed: ${message} (code ${code})`);
    }
    return payload.data ?? payload;
  }
}

async function tenantToken() {
  if (!process.env.LARK_APP_SECRET) throw new Error('LARK_APP_SECRET is required only for --apply.');
  const data = await request('/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', body: { app_id: APP_ID, app_secret: process.env.LARK_APP_SECRET },
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

async function batchCreate(token, baseToken, tableId, rows) {
  let singleRecordFallback = false;
  for (let index = 0; index < rows.length; index += 100) {
    const batch = rows.slice(index, index + 100);
    if (!singleRecordFallback) {
      try {
        await request(`/open-apis/base/v3/bases/${baseToken}/tables/${tableId}/records/batch_create`, {
          method: 'POST', token, body: { create_records: batch },
        });
      } catch (error) {
        if (!/800030005|not_found/i.test(error.message)) throw error;
        singleRecordFallback = true;
        console.warn('  batch_create is unavailable for this tenant; falling back to single-record writes');
      }
    }
    if (singleRecordFallback) {
      for (const fields of batch) {
        await request(`/open-apis/base/v3/bases/${baseToken}/tables/${tableId}/records`, {
          method: 'POST', token, body: fields,
        });
        await sleep(260);
      }
    }
    console.log(`  wrote ${Math.min(index + batch.length, rows.length)}/${rows.length}`);
    await sleep(650);
  }
}

async function loadFirebase() {
  const serviceAccount = JSON.parse(await readFile(CREDENTIAL_PATH, 'utf8'));
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

async function buildRows(db, collection, mapperKey) {
  const snapshot = await db.collection(collection).get();
  return snapshot.docs.map((document) => ({
    sourceKey: `${collection}/${document.id}`,
    firebaseId: document.id,
    source: collection,
    fields: MAPPERS[mapperKey](document, document.data()),
  }));
}

async function buildCommitteeRows(db) {
  const snapshot = await db.collection('projects').get();
  const rows = [];
  for (const project of snapshot.docs) {
    const data = project.data();
    for (const [index, member] of (Array.isArray(data.committee) ? data.committee : []).entries()) {
      const id = `${project.id}:${member.memberId || member.id || index}`;
      rows.push({
        sourceKey: `projects[].committee/${id}`, firebaseId: id, source: 'projects[].committee',
        fields: compact({
          'Committee Assignment': title(`${first(member.memberName, member.name, 'Member')} — ${first(data.name, data.title, 'Project')}`, id),
          'Firebase ID': id, 'Project Firebase ID': project.id,
          'Member Firebase ID': asText(first(member.memberId, member.id)),
          'Member Name': asText(first(member.memberName, member.name)), Role: asText(member.role),
          Status: asText(first(member.status, 'Active')), Responsibilities: asText(first(member.tasks, member.responsibilities)),
        }),
      });
    }
  }
  return rows;
}

function recordFields(record) { return record.fields || record.record?.fields || {}; }

async function main() {
  const state = JSON.parse(await readFile(STATE_PATH, 'utf8'));
  const baseToken = process.env.LARK_BASE_TOKEN || state.baseToken;
  if (!baseToken) throw new Error('Base token missing from environment and state file.');
  const db = await loadFirebase();
  const grouped = new Map();

  for (const [collection, tableKey, mapperKey] of JOBS) {
    const rows = await buildRows(db, collection, mapperKey);
    if (!grouped.has(tableKey)) grouped.set(tableKey, []);
    grouped.get(tableKey).push(...rows);
  }
  grouped.set('project_committee', await buildCommitteeRows(db));

  const report = { generatedAt: new Date().toISOString(), mode: APPLY ? 'apply' : 'dry-run', baseToken, tables: {}, totals: { source: 0, create: 0, existing: 0 } };
  if (!APPLY) {
    for (const [tableKey, rows] of grouped) {
      const duplicateSourceKeys = rows.length - new Set(rows.map((row) => row.sourceKey)).size;
      const duplicateFirebaseIds = rows.length - new Set(rows.map((row) => row.firebaseId)).size;
      report.tables[tableKey] = { source: rows.length, create: rows.length, duplicateSourceKeys, duplicateFirebaseIds };
      report.totals.source += rows.length;
      report.totals.create += rows.length;
      console.log(`${tableKey}: ${rows.length} rows${duplicateSourceKeys ? `, ${duplicateSourceKeys} duplicate source keys` : ''}${duplicateFirebaseIds ? `, ${duplicateFirebaseIds} duplicate Firebase IDs across sources` : ''}`);
    }
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    console.log(`\nDry run complete: ${report.totals.create} rows planned. No Lark data was changed.`);
    console.log(`Report: ${REPORT_PATH}`);
    return;
  }

  const token = await tenantToken();
  for (const [tableKey, rows] of grouped) {
    const tableId = state.tableIds?.[tableKey];
    if (!tableId) throw new Error(`Missing table ID in state: ${tableKey}`);
    console.log(`\n${tableKey}: checking existing records...`);
    const existingRecords = await listRecords(token, baseToken, tableId);
    const existing = new Set(existingRecords.map((record) => {
      const fields = recordFields(record);
      if (tableKey === 'transactions') return `${first(fields.Source, 'transactions')}/${fields['Firebase ID']}`;
      return fields['Firebase ID'];
    }));
    const createRows = rows.filter((row) => !existing.has(tableKey === 'transactions' ? row.sourceKey : row.firebaseId));
    report.tables[tableKey] = { source: rows.length, existing: rows.length - createRows.length, create: createRows.length };
    report.totals.source += rows.length;
    report.totals.existing += rows.length - createRows.length;
    report.totals.create += createRows.length;
    console.log(`  existing ${rows.length - createRows.length}; creating ${createRows.length}`);
    if (createRows.length) await batchCreate(token, baseToken, tableId, createRows.map((row) => row.fields));
  }

  report.completedAt = new Date().toISOString();
  report.note = 'Base records imported. Linked-record backfill is intentionally a separate verified pass.';
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(`\nRecord import complete. Report: ${REPORT_PATH}`);
  console.log('Next: run the verified relationship backfill pass.');
}

main().catch((error) => {
  console.error(`Migration stopped: ${error.message}`);
  console.error('Re-run safely: existing records are detected by source collection and Firebase ID.');
  process.exitCode = 1;
});
