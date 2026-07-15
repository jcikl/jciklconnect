/**
 * migrateLoId.mjs
 *
 * Batch-updates every document that has  loId == 'default-lo'  to  loId == 'jcikl'.
 *
 * Affected collections:
 *   members, paymentRequests, eventRegistrations,
 *   incentiveSubmissions, loStarProgress, nonMemberLeads
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
const OLD_LO_ID = 'default-lo';
const NEW_LO_ID = 'jcikl';
const DRY_RUN   = process.argv.includes('--dry-run');
const BATCH_SIZE = 400; // Firestore batch limit is 500; keep headroom

const COLLECTIONS = [
  'members',
  'paymentRequests',
  'eventRegistrations',
  'incentiveSubmissions',
  'loStarProgress',
  'nonMemberLeads',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function migrateCollection(colName) {
  const colRef  = db.collection(colName);
  const snap    = await colRef.where('loId', '==', OLD_LO_ID).get();

  if (snap.empty) {
    console.log(`  ${colName}: 0 documents — nothing to do`);
    return 0;
  }

  console.log(`  ${colName}: ${snap.size} document(s) found`);

  if (DRY_RUN) return snap.size;

  // Process in batches
  const docs   = snap.docs;
  let updated  = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);

    for (const doc of chunk) {
      batch.update(doc.ref, { loId: NEW_LO_ID });
    }

    await batch.commit();
    updated += chunk.length;
    console.log(`    committed ${updated}/${docs.length}`);
  }

  return updated;
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
console.log(`  migrateLoId  |  ${OLD_LO_ID}  →  ${NEW_LO_ID}`);
console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
console.log(`${'─'.repeat(55)}\n`);

let totalUpdated = 0;

for (const col of COLLECTIONS) {
  totalUpdated += await migrateCollection(col);
}

console.log(`\n${'─'.repeat(55)}`);
console.log(`  ${DRY_RUN ? 'Documents that WOULD be updated' : 'Total updated'}: ${totalUpdated}`);
if (DRY_RUN) {
  console.log('  Re-run without --dry-run to apply changes.');
}
console.log(`${'─'.repeat(55)}\n`);
