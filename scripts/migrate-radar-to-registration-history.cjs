/**
 * Migration: RadarContributions → RegistrationHistory
 *
 * Usage (Node.js with Firebase Admin SDK):
 *   node scripts/migrate-radar-to-registration-history.js
 *
 * Prerequisites:
 *   npm install firebase-admin
 *   Set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON path,
 *   OR place serviceAccountKey.json in the project root.
 *
 * What this script does:
 *   1. Reads all documents from RadarContributions
 *   2. Writes each document to RegistrationHistory with the same ID
 *   3. Skips documents that already exist in RegistrationHistory
 *   4. Reports counts at the end
 *
 * After verifying the migration, manually delete RadarContributions from
 * the Firebase console, then remove the legacy rules block from firestore.rules.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// Initialize Firebase Admin
let serviceAccount;
try {
  serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
  initializeApp({ credential: cert(serviceAccount) });
} catch {
  initializeApp();
}

const db = getFirestore();

async function migrate() {
  const OLD_COLLECTION = 'RadarContributions';
  const NEW_COLLECTION = 'RegistrationHistory';
  const BATCH_SIZE = 400; // Firestore batch limit is 500

  console.log(`\nMigrating ${OLD_COLLECTION} → ${NEW_COLLECTION}\n`);

  const oldSnap = await db.collection(OLD_COLLECTION).get();
  const total = oldSnap.size;
  console.log(`Found ${total} documents in ${OLD_COLLECTION}`);

  if (total === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  const docs = oldSnap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const docSnap of chunk) {
      const newRef = db.collection(NEW_COLLECTION).doc(docSnap.id);
      const existing = await newRef.get();
      if (existing.exists) {
        skipped++;
        continue;
      }
      batch.set(newRef, docSnap.data());
      migrated++;
    }

    await batch.commit();
    console.log(`Progress: ${Math.min(i + BATCH_SIZE, docs.length)}/${total}`);
  }

  console.log(`\nDone!`);
  console.log(`  Migrated : ${migrated}`);
  console.log(`  Skipped  : ${skipped} (already existed)`);
  console.log(`  Errors   : ${errors}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Verify data in RegistrationHistory collection in Firebase console`);
  console.log(`  2. Deploy updated code (constants, services, components)`);
  console.log(`  3. Deploy firestore.rules: firebase deploy --only firestore:rules`);
  console.log(`  4. After confirming app works, delete RadarContributions from Firebase console`);
  console.log(`  5. Remove the legacy RadarContributions block from firestore.rules`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
