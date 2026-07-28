/**
 * migrateMemberFields.mjs
 *
 * Migrates flat fields on Firestore 'members' documents to nested sub-objects.
 *
 * Usage:
 *   node scripts/migrateMemberFields.mjs            # live run
 *   node scripts/migrateMemberFields.mjs --dry-run  # preview only
 *
 * Each MIGRATIONS entry:
 *   flatField  — top-level flat key that may exist on old documents
 *   nestedPath — Firestore dot-notation write path (e.g. "contact.socials.linkedin")
 *   existsFn   — returns true when the destination is already populated (skip)
 *   deleteFlat — whether to delete the flat field after copying (default true)
 *                Set to false for fields kept as intentional denorm index keys
 *                (e.g. companyName, industry) or fields still used in WHERE queries
 *                without a nested alternative.
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

const MIGRATIONS = [
  // ── general.* ─────────────────────────────────────────────────────────────
  // Core identity fields: copy to nested, keep flat (still used as query index by
  // some WHERE clauses and as backward-compat aliases — Phase 3 will stop the
  // double-write; for now we just ensure nested is populated).
  { flatField: 'name',             nestedPath: 'general.name',             existsFn: (d) => d.general?.name != null,             deleteFlat: false },
  { flatField: 'fullName',         nestedPath: 'general.fullName',         existsFn: (d) => d.general?.fullName != null,         deleteFlat: false },
  { flatField: 'chineseName',      nestedPath: 'general.chineseName',      existsFn: (d) => d.general?.chineseName != null,      deleteFlat: false },
  { flatField: 'chiName',          nestedPath: 'general.chineseName',      existsFn: (d) => d.general?.chineseName != null,      deleteFlat: false },
  { flatField: 'idNumber',         nestedPath: 'general.idNumber',         existsFn: (d) => d.general?.idNumber != null,         deleteFlat: false },
  { flatField: 'nationalId',       nestedPath: 'general.idNumber',         existsFn: (d) => d.general?.idNumber != null,         deleteFlat: false },
  { flatField: 'dob',              nestedPath: 'general.dob',              existsFn: (d) => d.general?.dob != null,              deleteFlat: false },
  { flatField: 'dateOfBirth',      nestedPath: 'general.dob',              existsFn: (d) => d.general?.dob != null,              deleteFlat: false },
  { flatField: 'gender',           nestedPath: 'general.gender',           existsFn: (d) => d.general?.gender != null,           deleteFlat: false },
  { flatField: 'race',             nestedPath: 'general.race',             existsFn: (d) => d.general?.race != null,             deleteFlat: false },
  { flatField: 'nationality',      nestedPath: 'general.nationality',      existsFn: (d) => d.general?.nationality != null,      deleteFlat: false },
  { flatField: 'avatarUrl',        nestedPath: 'general.avatarUrl',        existsFn: (d) => d.general?.avatarUrl != null,        deleteFlat: false },
  { flatField: 'avatar',           nestedPath: 'general.avatarUrl',        existsFn: (d) => d.general?.avatarUrl != null,        deleteFlat: false },
  // Secondary general fields — safe to delete after copying
  { flatField: 'ethnicity',        nestedPath: 'general.ethnicity',        existsFn: (d) => d.general?.ethnicity != null,        deleteFlat: true  },
  { flatField: 'dietaryPreference',nestedPath: 'general.dietaryPreference',existsFn: (d) => d.general?.dietaryPreference != null,deleteFlat: true  },
  { flatField: 'birthPlace',       nestedPath: 'general.birthPlace',       existsFn: (d) => d.general?.birthPlace != null,       deleteFlat: true  },

  // ── contact.* ─────────────────────────────────────────────────────────────
  { flatField: 'email',            nestedPath: 'contact.email',            existsFn: (d) => d.contact?.email != null,            deleteFlat: false },
  { flatField: 'phone',            nestedPath: 'contact.phone',            existsFn: (d) => d.contact?.phone != null,            deleteFlat: false },
  { flatField: 'alternatePhone',   nestedPath: 'contact.alternatePhone',   existsFn: (d) => d.contact?.alternatePhone != null,   deleteFlat: true  },
  { flatField: 'address',          nestedPath: 'contact.address',          existsFn: (d) => d.contact?.address != null,          deleteFlat: false },
  { flatField: 'whatsappJoined',   nestedPath: 'contact.whatsappJoined',   existsFn: (d) => d.contact?.whatsappJoined != null,   deleteFlat: true  },
  { flatField: 'whatsappGroup',    nestedPath: 'contact.whatsappJoined',   existsFn: (d) => d.contact?.whatsappJoined != null,   deleteFlat: true  },
  // Socials (2-level nesting)
  { flatField: 'linkedin',         nestedPath: 'contact.socials.linkedin', existsFn: (d) => d.contact?.socials?.linkedin != null,deleteFlat: true  },
  { flatField: 'linkedIn',         nestedPath: 'contact.socials.linkedin', existsFn: (d) => d.contact?.socials?.linkedin != null,deleteFlat: true  },
  { flatField: 'facebook',         nestedPath: 'contact.socials.facebook', existsFn: (d) => d.contact?.socials?.facebook != null,deleteFlat: true  },
  { flatField: 'instagram',        nestedPath: 'contact.socials.instagram',existsFn: (d) => d.contact?.socials?.instagram != null,deleteFlat: true  },
  { flatField: 'wechat',           nestedPath: 'contact.socials.wechat',   existsFn: (d) => d.contact?.socials?.wechat != null,  deleteFlat: true  },
  { flatField: 'weChat',           nestedPath: 'contact.socials.wechat',   existsFn: (d) => d.contact?.socials?.wechat != null,  deleteFlat: true  },
  // Emergency contact (2-level nesting)
  { flatField: 'emergencyContactName',         nestedPath: 'contact.emergency.name',        existsFn: (d) => d.contact?.emergency?.name != null,        deleteFlat: true  },
  { flatField: 'emergencyContact',             nestedPath: 'contact.emergency.name',        existsFn: (d) => d.contact?.emergency?.name != null,        deleteFlat: true  },
  { flatField: 'emergencyContactPhone',        nestedPath: 'contact.emergency.phone',       existsFn: (d) => d.contact?.emergency?.phone != null,       deleteFlat: true  },
  { flatField: 'emergencyContactRelationship', nestedPath: 'contact.emergency.relationship',existsFn: (d) => d.contact?.emergency?.relationship != null, deleteFlat: true  },

  // ── others.* ──────────────────────────────────────────────────────────────
  { flatField: 'bio',              nestedPath: 'others.bio',              existsFn: (d) => d.others?.bio != null,              deleteFlat: true  },
  { flatField: 'hobbies',          nestedPath: 'others.hobbies',          existsFn: (d) => d.others?.hobbies != null,          deleteFlat: true  },
  { flatField: 'shirtStyle',       nestedPath: 'others.shirtStyle',       existsFn: (d) => d.others?.shirtStyle != null,       deleteFlat: true  },
  { flatField: 'cutStyle',         nestedPath: 'others.shirtStyle',       existsFn: (d) => d.others?.shirtStyle != null,       deleteFlat: true  },
  { flatField: 'tshirtSize',       nestedPath: 'others.tshirtSize',       existsFn: (d) => d.others?.tshirtSize != null,       deleteFlat: true  },
  { flatField: 'jacketSize',       nestedPath: 'others.jacketSize',       existsFn: (d) => d.others?.jacketSize != null,       deleteFlat: true  },
  { flatField: 'embroideredName',  nestedPath: 'others.embroideredName',  existsFn: (d) => d.others?.embroideredName != null,  deleteFlat: true  },
  { flatField: 'tshirtStatus',     nestedPath: 'others.tshirtStatus',     existsFn: (d) => d.others?.tshirtStatus != null,     deleteFlat: true  },

  // ── business.* ────────────────────────────────────────────────────────────
  // companyName + industry intentionally kept flat as denorm query-index fields
  { flatField: 'companyName',      nestedPath: 'business.companyName',      existsFn: (d) => d.business?.companyName != null,      deleteFlat: false },
  { flatField: 'industry',         nestedPath: 'business.industry',         existsFn: (d) => d.business?.industry != null,         deleteFlat: false },
  { flatField: 'companyWebsite',   nestedPath: 'business.companyWebsite',   existsFn: (d) => d.business?.companyWebsite != null,   deleteFlat: true  },
  { flatField: 'companyLogoUrl',   nestedPath: 'business.companyLogoUrl',   existsFn: (d) => d.business?.companyLogoUrl != null,   deleteFlat: true  },
  { flatField: 'introduction',     nestedPath: 'business.introduction',     existsFn: (d) => d.business?.introduction != null,     deleteFlat: true  },
  { flatField: 'companyDescription',nestedPath:'business.companyDescription',existsFn:(d) => d.business?.companyDescription != null,deleteFlat: true  },
  { flatField: 'businessCategory', nestedPath: 'business.businessCategory', existsFn: (d) => d.business?.businessCategory != null, deleteFlat: true  },
  { flatField: 'category',         nestedPath: 'business.businessCategory', existsFn: (d) => d.business?.businessCategory != null, deleteFlat: true  },
  { flatField: 'specialOffer',     nestedPath: 'business.specialOffer',     existsFn: (d) => d.business?.specialOffer != null,     deleteFlat: true  },
  { flatField: 'offerToMember',    nestedPath: 'business.specialOffer',     existsFn: (d) => d.business?.specialOffer != null,     deleteFlat: true  },
  { flatField: 'acceptInternationalBusiness', nestedPath: 'business.acceptInternationalBusiness', existsFn: (d) => d.business?.acceptInternationalBusiness != null, deleteFlat: true },
  { flatField: 'idealReferral',    nestedPath: 'business.idealReferrals',   existsFn: (d) => d.business?.idealReferrals != null,   deleteFlat: true  },
  { flatField: 'idealReferrals',   nestedPath: 'business.idealReferrals',   existsFn: (d) => d.business?.idealReferrals != null,   deleteFlat: true  },
  { flatField: 'connections',      nestedPath: 'business.connections',      existsFn: (d) => d.business?.connections != null,      deleteFlat: true  },
  { flatField: 'levelOfManagement',     nestedPath: 'business.levelOfManagement',     existsFn: (d) => d.business?.levelOfManagement != null,     deleteFlat: true  },
  { flatField: 'departmentAndPosition', nestedPath: 'business.departmentAndPosition', existsFn: (d) => d.business?.departmentAndPosition != null, deleteFlat: true  },
  { flatField: 'interestedIndustries',  nestedPath: 'business.interestedIndustries',  existsFn: (d) => d.business?.interestedIndustries != null,  deleteFlat: true  },
  { flatField: 'idealReferralTypes',    nestedPath: 'business.idealReferralTypes',    existsFn: (d) => d.business?.idealReferralTypes != null,    deleteFlat: true  },
  {
    flatField: 'profession',
    nestedPath: 'business.position',
    existsFn: (d) => d.business?.position != null && d.business.position !== '',
    deleteFlat: true,
  },

  // ── jciCareer.* ───────────────────────────────────────────────────────────
  { flatField: 'joinDate',         nestedPath: 'jciCareer.joinDate',        existsFn: (d) => d.jciCareer?.joinDate != null,        deleteFlat: false },
  { flatField: 'joinedDate',       nestedPath: 'jciCareer.joinDate',        existsFn: (d) => d.jciCareer?.joinDate != null,        deleteFlat: true  },
  { flatField: 'membershipType',   nestedPath: 'jciCareer.membershipType',  existsFn: (d) => d.jciCareer?.membershipType != null,  deleteFlat: false },
  { flatField: 'introducer',       nestedPath: 'jciCareer.introducer',      existsFn: (d) => d.jciCareer?.introducer != null,      deleteFlat: true  },
  { flatField: 'probationTasks',   nestedPath: 'jciCareer.probationTasks',  existsFn: (d) => d.jciCareer?.probationTasks != null,  deleteFlat: true  },
  { flatField: 'promotionProgress',nestedPath: 'jciCareer.promotionProgress',existsFn:(d) => d.jciCareer?.promotionProgress != null,deleteFlat: true  },
  { flatField: 'isDuesPaidCurrentYear', nestedPath: 'jciCareer.isDuesPaidCurrentYear', existsFn: (d) => d.jciCareer?.isDuesPaidCurrentYear != null, deleteFlat: true },
  { flatField: 'attendanceCheckins',nestedPath: 'jciCareer.attendanceCheckins',existsFn:(d) => d.jciCareer?.attendanceCheckins != null,deleteFlat: true },
  { flatField: 'attendanceMonths', nestedPath: 'jciCareer.attendanceMonths',existsFn: (d) => d.jciCareer?.attendanceMonths != null, deleteFlat: true  },
  { flatField: 'attendanceYear',   nestedPath: 'jciCareer.attendanceYear',  existsFn: (d) => d.jciCareer?.attendanceYear != null,  deleteFlat: true  },
  { flatField: 'badgesCount',      nestedPath: 'jciCareer.badgesCount',     existsFn: (d) => d.jciCareer?.badgesCount != null,     deleteFlat: true  },
  { flatField: 'projectsCount',    nestedPath: 'jciCareer.projectsCount',   existsFn: (d) => d.jciCareer?.projectsCount != null,   deleteFlat: true  },
  { flatField: 'trainingsCount',   nestedPath: 'jciCareer.trainingsCount',  existsFn: (d) => d.jciCareer?.trainingsCount != null,  deleteFlat: true  },
  { flatField: 'currentBoardYear',     nestedPath: 'jciCareer.currentBoardYear',     existsFn: (d) => d.jciCareer?.currentBoardYear != null,     deleteFlat: true  },
  { flatField: 'currentBoardPosition', nestedPath: 'jciCareer.currentBoardPosition', existsFn: (d) => d.jciCareer?.currentBoardPosition != null, deleteFlat: true  },
  { flatField: 'isCurrentBoardMember', nestedPath: 'jciCareer.isCurrentBoardMember', existsFn: (d) => d.jciCareer?.isCurrentBoardMember != null, deleteFlat: true  },
  { flatField: 'boardHistory',     nestedPath: 'jciCareer.boardHistory',    existsFn: (d) => d.jciCareer?.boardHistory != null,    deleteFlat: true  },
  { flatField: 'points',           nestedPath: 'jciCareer.points',          existsFn: (d) => d.jciCareer?.points != null,          deleteFlat: false },
  { flatField: 'engagementProgress',    nestedPath: 'jciCareer.engagementProgress',    existsFn: (d) => d.jciCareer?.engagementProgress != null,    deleteFlat: true  },
  { flatField: 'radarStats',            nestedPath: 'jciCareer.radarStats',            existsFn: (d) => d.jciCareer?.radarStats != null,            deleteFlat: true  },
  { flatField: 'radarStatsByYear',      nestedPath: 'jciCareer.radarStatsByYear',      existsFn: (d) => d.jciCareer?.radarStatsByYear != null,      deleteFlat: true  },
  { flatField: 'membershipDuesHistory', nestedPath: 'jciCareer.membershipDuesHistory', existsFn: (d) => d.jciCareer?.membershipDuesHistory != null, deleteFlat: true  },
  { flatField: 'leaderboardVisibility', nestedPath: 'jciCareer.leaderboardVisibility', existsFn: (d) => d.jciCareer?.leaderboardVisibility != null, deleteFlat: true  },
  { flatField: 'hasPaidInitiationFee',  nestedPath: 'jciCareer.hasPaidInitiationFee',  existsFn: (d) => d.jciCareer?.hasPaidInitiationFee != null,  deleteFlat: true  },
  { flatField: 'senatorshipValidatedAt',nestedPath: 'jciCareer.senatorshipValidatedAt',existsFn: (d) => d.jciCareer?.senatorshipValidatedAt != null, deleteFlat: true  },
  { flatField: 'senatorshipValidatedBy',nestedPath: 'jciCareer.senatorshipValidatedBy',existsFn: (d) => d.jciCareer?.senatorshipValidatedBy != null, deleteFlat: true  },
  // Senatorship sub-fields (2-level nesting inside jciCareer.senatorship)
  { flatField: 'senatorCertified',          nestedPath: 'jciCareer.senatorship.senatorCertified',          existsFn: (d) => d.jciCareer?.senatorship?.senatorCertified != null,          deleteFlat: true },
  { flatField: 'senatorshipId',             nestedPath: 'jciCareer.senatorship.senatorshipId',             existsFn: (d) => d.jciCareer?.senatorship?.senatorshipId != null,             deleteFlat: true },
  { flatField: 'senatorshipBoardValidated', nestedPath: 'jciCareer.senatorship.senatorshipBoardValidated', existsFn: (d) => d.jciCareer?.senatorship?.senatorshipBoardValidated != null, deleteFlat: true },
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

  // Special case: rename business.title → business.position (nested field rename)
  if (data.business != null && 'title' in data.business && !('position' in data.business)) {
    update['business.position'] = data.business.title;
    update['business.title'] = FieldValue.delete();
  }

  for (const { flatField, nestedPath, existsFn, deleteFlat = true } of MIGRATIONS) {
    // Flat field must exist and have a non-null value
    if (!(flatField in data) || data[flatField] == null) continue;

    // Skip if destination is already populated
    if (existsFn(data)) continue;

    // Copy value to nested path (Firestore dot-notation)
    update[nestedPath] = data[flatField];

    // Optionally delete the flat field
    if (deleteFlat) {
      update[flatField] = FieldValue.delete();
    }
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
