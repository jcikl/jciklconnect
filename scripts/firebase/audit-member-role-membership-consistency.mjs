#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const INCLUDE_ELEVATED = args.has('--include-elevated');
const REPORT_PATH = resolve(process.cwd(), 'member-role-membership-consistency-report.json');
const CREDENTIAL_PATH = resolve(
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  'serviceAccountKey.json',
);

const VALID_MEMBERSHIP_TYPES = new Set([
  'Guest',
  'Probation',
  'Official',
  'Honorary',
  'Senator',
  'Visiting',
  'Associate',
]);

const VALID_ROLES = new Set([
  'GUEST',
  'MEMBER',
  'BOARD',
  'ADMIN',
  'SUPER_ADMIN',
  'INACTIVE',
]);

const ELEVATED_OR_FROZEN = new Set(['ADMIN', 'SUPER_ADMIN', 'INACTIVE']);

function normalizeRole(value) {
  if (!value) return '';
  const normalized = String(value).trim().replace(/[\s-]+/g, '_').toUpperCase();
  if (normalized === 'SUPERADMIN') return 'SUPER_ADMIN';
  return normalized;
}

function normalizeMembershipType(value) {
  if (!value) return '';
  const normalized = String(value).trim().toLowerCase();
  const match = [...VALID_MEMBERSHIP_TYPES].find((candidate) => candidate.toLowerCase() === normalized);
  return match || String(value).trim();
}

function getCurrentMembershipType(data) {
  return normalizeMembershipType(
    data.membershipType ||
    data.membership?.type ||
    data.membership?.membershipType ||
    data.status?.membershipType ||
    '',
  );
}

function expectedRoleForMembershipType(membershipType, currentRole) {
  if (!membershipType || !VALID_MEMBERSHIP_TYPES.has(membershipType)) return null;

  if (ELEVATED_OR_FROZEN.has(currentRole) && !INCLUDE_ELEVATED) {
    return currentRole;
  }

  if (membershipType === 'Guest') return 'GUEST';
  // Honorary and Senator are membership categories, not board roles.
  // Board access should come from current board position records or a manual role: BOARD assignment.
  if (membershipType === 'Honorary' || membershipType === 'Senator') {
    if (currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN' || currentRole === 'BOARD' || currentRole === 'INACTIVE') return currentRole;
    return 'MEMBER';
  }

  if (currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN' || currentRole === 'BOARD' || currentRole === 'INACTIVE') {
    return currentRole;
  }

  return 'MEMBER';
}

function classifyMember(doc) {
  const data = doc.data();
  const role = normalizeRole(data.role);
  const membershipType = getCurrentMembershipType(data);
  const expectedRole = expectedRoleForMembershipType(membershipType, role);
  const issues = [];

  if (!role) issues.push('missing-role');
  else if (!VALID_ROLES.has(role)) issues.push('unknown-role');

  if (!membershipType) issues.push('missing-membershipType');
  else if (!VALID_MEMBERSHIP_TYPES.has(membershipType)) issues.push('unknown-membershipType');

  if (expectedRole && role !== expectedRole) issues.push('role-membership-mismatch');

  const skipped =
    ELEVATED_OR_FROZEN.has(role) &&
    !INCLUDE_ELEVATED &&
    expectedRole === role &&
    membershipType === 'Guest';

  return {
    id: doc.id,
    name: data.name || data.fullName || data.displayName || '',
    email: data.email || '',
    role: role || data.role || '',
    membershipType,
    expectedRole,
    issues,
    actionable: Boolean(expectedRole && role !== expectedRole && !skipped),
    skipped,
  };
}

async function loadFirebase() {
  const serviceAccount = JSON.parse(await readFile(CREDENTIAL_PATH, 'utf8'));
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

async function commitUpdates(db, updates) {
  let committed = 0;
  for (let i = 0; i < updates.length; i += 450) {
    const batch = db.batch();
    const chunk = updates.slice(i, i + 450);
    for (const item of chunk) {
      batch.update(db.collection('members').doc(item.id), {
        role: item.expectedRole,
        roleMembershipConsistencyFixedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    committed += chunk.length;
    console.log(`Committed ${committed}/${updates.length} member role updates...`);
  }
}

async function main() {
  const db = await loadFirebase();
  const snap = await db.collection('members').get();
  const rows = snap.docs.map(classifyMember);
  const inconsistent = rows.filter((row) => row.issues.length > 0);
  const actionable = rows.filter((row) => row.actionable);
  const skipped = rows.filter((row) => row.skipped);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'audit',
    includeElevated: INCLUDE_ELEVATED,
    totals: {
      membersScanned: rows.length,
      inconsistent: inconsistent.length,
      actionable: actionable.length,
      skippedElevatedOrFrozen: skipped.length,
    },
    actionable,
    skipped,
    inconsistent,
  };

  if (APPLY && actionable.length) {
    await commitUpdates(db, actionable);
    report.applied = actionable.length;
  } else {
    report.applied = 0;
  }

  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });

  console.log(`Mode: ${report.mode}`);
  console.log(`Members scanned: ${report.totals.membersScanned}`);
  console.log(`Inconsistent: ${report.totals.inconsistent}`);
  console.log(`Actionable: ${report.totals.actionable}`);
  console.log(`Applied: ${report.applied}`);
  console.log(`Report: ${REPORT_PATH}`);

  if (!APPLY && actionable.length) {
    console.log('');
    console.log('Dry run only. Review the report, then run with --apply to fix actionable rows.');
  }
}

main().catch((error) => {
  console.error(`Member role/membership audit failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});

