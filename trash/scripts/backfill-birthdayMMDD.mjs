/**
 * One-time migration: backfill birthdayMMDD field for all existing members.
 * Run: node scripts/backfill-birthdayMMDD.mjs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load service account — expects scripts/serviceAccount.json
const serviceAccountPath = resolve(__dirname, 'serviceAccount.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

function toMMDD(dobStr) {
  if (!dobStr || typeof dobStr !== 'string') return null;
  // Supports "YYYY-MM-DD" and "DD/MM/YYYY"
  if (dobStr.includes('-') && dobStr.length >= 10) {
    return dobStr.slice(5, 7) + dobStr.slice(8, 10); // "YYYY-MM-DD" → "MMDD"
  }
  if (dobStr.includes('/') && dobStr.length >= 10) {
    const parts = dobStr.split('/');
    if (parts.length === 3) return parts[1].padStart(2, '0') + parts[0].padStart(2, '0'); // "DD/MM/YYYY" → "MMDD"
  }
  return null;
}

async function backfill() {
  console.log('Fetching all members...');
  const snap = await db.collection('members').get();
  console.log(`Total members: ${snap.size}`);

  let updated = 0;
  let skipped = 0;
  let noDate = 0;

  const BATCH_SIZE = 400; // Firestore batch limit is 500
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();

    // Already has the field and it looks valid — skip
    if (data.birthdayMMDD && /^\d{4}$/.test(data.birthdayMMDD)) {
      skipped++;
      continue;
    }

    // Try root-level dateOfBirth first, then general.dob
    const dob = data.dateOfBirth || data.general?.dob || null;
    const mmdd = toMMDD(dob);

    if (!mmdd) {
      noDate++;
      continue;
    }

    batch.update(docSnap.ref, { birthdayMMDD: mmdd });
    batchCount++;
    updated++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Committed batch of ${batchCount}...`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount}.`);
  }

  console.log('\n✅ Backfill complete.');
  console.log(`   Updated : ${updated}`);
  console.log(`   Skipped (already set): ${skipped}`);
  console.log(`   No date found: ${noDate}`);
}

backfill().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
