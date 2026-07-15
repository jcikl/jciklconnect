/**
 * migrateLoId.mjs
 *
 * Batch-updates every document that has  loId == 'default-lo'  to  loId == 'jcikl'.
 *
 * Affected collections (flat loId field):
 *   members, paymentRequests, eventRegistrations,
 *   incentiveSubmissions, loStarProgress, nonMemberLeads,
 *   events, points, transactions, bankAccounts, publications
 *
 * Nested field:
 *   members → boardHistory[].loId  (array items patched individually)
 *
 * Usage:
 *   node scripts/migrateLoId.mjs            # live run
 *   node scripts/migrateLoId.mjs --dry-run  # preview counts only
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service-account
 * JSON key, or run from a machine already authenticated via `gcloud auth`.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require  = createRequire(import.meta.url);

// ── Firebase init ─────────────────────────────────────────────────────────────
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  path.join(__dirname, '..', 'serviceAccount.json');

let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch {
  console.error(`Cannot load service account from: ${serviceAccountPath}`);
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccount.json in project root.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Config ────────────────────────────────────────────────────────────────────
const OLD_LO_ID  = 'default-lo';
const NEW_LO_ID  = 'jcikl';
const DRY_RUN    = process.argv.includes('--dry-run');
const BATCH_SIZE = 400;

const FLAT_COLLECTIONS = [
  'members',
  'paymentRequests',
  'eventRegistrations',
  'incentiveSubmissions',
  'loStarProgress',
  'nonMemberLeads',
  'events',
  'bankAccounts',
  'publications',
];

// ── Flat migration ────────────────────────────────────────────────────────────
async function migrateFlat(colName) {
  const snap = await db.collection(colName).where('loId', '==', OLD_LO_ID).get();

  if (snap.empty) {
    console.log(`  ${colName}: 0 documents — nothing to do`);
    return 0;
  }

  console.log(`  ${colName}: ${snap.size} document(s) found`);
  if (DRY_RUN) return snap.size;

  const docs   = snap.docs;
  let updated  = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach(d => batch.update(d.ref, { loId: NEW_LO_ID }));
    await batch.commit();
    updated += Math.min(BATCH_SIZE, docs.length - i);
    console.log(`    committed ${updated}/${docs.length}`);
  }

  return updated;
}

// ── Nested migration: members.boardHistory[].loId ─────────────────────────────
async function migrateBoardHistory() {
  const snap  = await db.collection('members').get();
  const dirty = snap.docs.filter(d => {
    const history = d.data().boardHistory ?? [];
    return history.some(h => h?.loId === OLD_LO_ID);
  });

  if (dirty.length === 0) {
    console.log(`  members[boardHistory]: 0 documents — nothing to do`);
    return 0;
  }

  console.log(`  members[boardHistory]: ${dirty.length} document(s) with old loId in boardHistory`);
  if (DRY_RUN) return dirty.length;

  let updated = 0;

  for (let i = 0; i < dirty.length; i += BATCH_SIZE) {
    const batch = db.batch();
    dirty.slice(i, i + BATCH_SIZE).forEach(d => {
      const patched = (d.data().boardHistory ?? []).map(h =>
        h?.loId === OLD_LO_ID ? { ...h, loId: NEW_LO_ID } : h
      );
      batch.update(d.ref, { boardHistory: patched });
    });
    await batch.commit();
    updated += Math.min(BATCH_SIZE, dirty.length - i);
    console.log(`    committed ${updated}/${dirty.length}`);
  }

  return updated;
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
console.log(`  migrateLoId  |  ${OLD_LO_ID}  →  ${NEW_LO_ID}`);
console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
console.log(`${'─'.repeat(55)}\n`);

let totalUpdated = 0;

console.log('── Flat collections ──────────────────────────────────');
for (const col of FLAT_COLLECTIONS) {
  totalUpdated += await migrateFlat(col);
}

console.log('\n── Nested fields ─────────────────────────────────────');
totalUpdated += await migrateBoardHistory();

console.log(`\n${'─'.repeat(55)}`);
console.log(`  ${DRY_RUN ? 'Documents that WOULD be updated' : 'Total updated'}: ${totalUpdated}`);
if (DRY_RUN) {
  console.log('  Re-run without --dry-run to apply changes.');
}
console.log(`${'─'.repeat(55)}\n`);
