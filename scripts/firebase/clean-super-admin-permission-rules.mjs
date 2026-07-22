#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const REPORT_PATH = resolve(process.cwd(), 'super-admin-permission-cleanup-report.json');
const CREDENTIAL_PATH = resolve(
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  'serviceAccountKey.json',
);

async function loadFirebase() {
  const serviceAccount = JSON.parse(await readFile(CREDENTIAL_PATH, 'utf8'));
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

async function main() {
  const db = await loadFirebase();
  const snap = await db
    .collection('userRolePermissions')
    .where('userRole', '==', 'Super Admin')
    .get();

  const records = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  let deleted = 0;

  if (APPLY && snap.docs.length) {
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = db.batch();
      const chunk = snap.docs.slice(i, i + 450);
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deleted += chunk.length;
      console.log(`Deleted ${deleted}/${snap.docs.length} Super Admin permission rules...`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'audit',
    found: records.length,
    deleted,
    records,
  };

  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(`Mode: ${report.mode}`);
  console.log(`Found: ${report.found}`);
  console.log(`Deleted: ${report.deleted}`);
  console.log(`Report: ${REPORT_PATH}`);

  if (!APPLY && records.length) {
    console.log('');
    console.log('Dry run only. Run with --apply to delete these records.');
  }
}

main().catch((error) => {
  console.error(`Super Admin permission cleanup failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
