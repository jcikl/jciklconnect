/**
 * migrateMemberFields.mjs
 *
 * Migrates flat fields on Firestore 'members' documents to nested sub-objects.
 *
 * Usage:
 *   node scripts/migrateMemberFields.mjs            # live run
 *   node scripts/migrateMemberFields.mjs --dry-run  # preview only
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../serviceAccountKey.json');
const BATCH_SIZE = 400;
const LOG_EVERY = 100;
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Migration map
// ---------------------------------------------------------------------------
// Each entry: { flatField, nestedPath, subObject, nestedField, conditionFn? }
// conditionFn(doc) → true means "only migrate if this condition is met"

const MIGRATIONS = [
  // general.*
  { flatField: 'ethnicity',         subObject: 'general',    nestedField: 'ethnicity' },
  { flatField: 'dietaryPreference', subObject: 'general',    nestedField: 'dietaryPreference' },
  {
    flatField: 'birthPlace',
    subObject: 'general',
    nestedField: 'birthPlace',
    // Only migrate birthPlace when general sub-object exists AND general.birthPlace is absent
    conditionFn: (data) =>
      data.general != null && data.general.birthPlace == null,
  },

  // business.*
  { flatField: 'levelOfManagement',     subObject: 'business', nestedField: 'levelOfManagement' },
  { flatField: 'departmentAndPosition', subObject: 'business', nestedField: 'departmentAndPosition' },
  { flatField: 'companyDescription',    subObject: 'business', nestedField: 'companyDescription' },
  { flatField: 'interestedIndustries',  subObject: 'business', nestedField: 'interestedIndustries' },
  { flatField: 'idealReferralTypes',    subObject: 'business', nestedField: 'idealReferralTypes' },

  // jciCareer.*
  { flatField: 'engagementProgress',      subObject: 'jciCareer', nestedField: 'engagementProgress' },
  { flatField: 'radarStats',              subObject: 'jciCareer', nestedField: 'radarStats' },
  { flatField: 'radarStatsByYear',        subObject: 'jciCareer', nestedField: 'radarStatsByYear' },
  { flatField: 'membershipDuesHistory',   subObject: 'jciCareer', nestedField: 'membershipDuesHistory' },
  { flatField: 'leaderboardVisibility',   subObject: 'jciCareer', nestedField: 'leaderboardVisibility' },
  { flatField: 'hasPaidInitiationFee',    subObject: 'jciCareer', nestedField: 'hasPaidInitiationFee' },
  { flatField: 'senatorshipValidatedAt',  subObject: 'jciCareer', nestedField: 'senatorshipValidatedAt' },
  { flatField: 'senatorshipValidatedBy',  subObject: 'jciCareer', nestedField: 'senatorshipValidatedBy' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the Firestore update payload for a single document.
 * Returns null when no changes are required.
 */
function buildUpdate(data) {
  const update = {};

  for (const rule of MIGRATIONS) {
    const { flatField, subObject, nestedField, conditionFn } = rule;

    // Flat field must exist on the document
    if (!(flatField in data)) continue;

    // Nested field must NOT already be populated (avoid overwriting)
    const sub = data[subObject];
    if (sub != null && nestedField in sub) continue;

    // Optional extra condition (e.g. birthPlace special case)
    if (conditionFn && !conditionFn(data)) continue;

    // Copy value to nested path (dot-notation for Firestore merge)
    update[`${subObject}.${nestedField}`] = data[flatField];

    // Schedule deletion of the flat field
    update[flatField] = FieldValue.delete();
  }

  return Object.keys(update).length > 0 ? update : null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n=== Member field migration ===`);
  console.log(`Mode    : ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Batch   : ${BATCH_SIZE}`);
  console.log(`Started : ${new Date().toISOString()}\n`);

  // Initialise Firebase Admin
  let serviceAccount;
  try {
    serviceAccount = require(SERVICE_ACCOUNT_PATH);
  } catch (err) {
    console.error(`ERROR: Could not load serviceAccountKey.json from:\n  ${SERVICE_ACCOUNT_PATH}`);
    console.error(err.message);
    process.exit(1);
  }

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  // Fetch all member documents
  console.log('Fetching members collection…');
  const snapshot = await db.collection('members').get();
  const total = snapshot.size;
  console.log(`Found ${total} documents.\n`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let batchUpdates = []; // { ref, update }

  const flush = async () => {
    if (batchUpdates.length === 0) return;
    if (!DRY_RUN) {
      const batch = db.batch();
      for (const { ref, update } of batchUpdates) {
        batch.update(ref, update);
      }
      await batch.commit();
    }
    updated += batchUpdates.length;
    batchUpdates = [];
  };

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updatePayload = buildUpdate(data);

    if (updatePayload) {
      batchUpdates.push({ ref: doc.ref, update: updatePayload });

      if (DRY_RUN) {
        // Show a compact preview of what would change
        const keys = Object.keys(updatePayload);
        const copies = keys.filter((k) => !k.startsWith('__') && updatePayload[k] !== FieldValue.delete());
        const deletes = keys.filter((k) => updatePayload[k] === FieldValue.delete() || String(updatePayload[k]) === '[object Object]');
        console.log(`[DRY] ${doc.id}`);
        for (const k of Object.keys(updatePayload)) {
          const val = updatePayload[k];
          if (val && typeof val === 'object' && val.constructor && val.constructor.name === 'FieldTransform') {
            console.log(`       DELETE  ${k}`);
          } else {
            console.log(`       SET     ${k} = ${JSON.stringify(val)?.substring(0, 80)}`);
          }
        }
      }

      if (batchUpdates.length >= BATCH_SIZE) {
        await flush();
      }
    } else {
      skipped++;
    }

    processed++;
    if (processed % LOG_EVERY === 0 || processed === total) {
      const pendingCount = batchUpdates.length;
      console.log(
        `Progress: ${processed}/${total} docs processed` +
        ` | committed: ${updated}` +
        ` | pending: ${pendingCount}` +
        ` | skipped (no changes): ${skipped}`
      );
    }
  }

  // Flush remaining
  await flush();

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n=== Migration summary ===');
  console.log(`Total documents  : ${total}`);
  console.log(`Documents updated: ${updated}`);
  console.log(`Documents skipped: ${skipped}`);
  console.log(`Mode             : ${DRY_RUN ? 'DRY RUN — no writes were committed' : 'LIVE — writes committed to Firestore'}`);
  console.log(`Finished         : ${new Date().toISOString()}`);

  if (DRY_RUN) {
    console.log('\nRe-run without --dry-run to apply changes.');
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
