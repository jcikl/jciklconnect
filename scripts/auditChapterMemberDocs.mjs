/**
 * auditChapterMemberDocs.mjs  (Phase 1, owner decision 7)
 *
 * The old Settings → Global Relations "Add Member" button created sister-chapter people as role MEMBER with
 * loId = <sister chapter id>. Those docs count as KL members in several places. This script lists every
 * members doc with role MEMBER and a loId that is set and not 'jcikl', and with --apply converts each to
 * an external member: role AFFILIATE, affiliation { category (from the chapter type), country (from the
 * chapter), status 'active' }, and refreshes its memberCards doc (same builder as the app).
 * Docs whose chapter does not exist in sisterChapters are listed but never changed.
 * Prints member ids, chapter ids and names only (no emails / phones).
 *
 * Usage:
 *   node scripts/auditChapterMemberDocs.mjs            # DRY RUN: list only, writes nothing
 *   node scripts/auditChapterMemberDocs.mjs --apply    # convert, in batches of <= 200 members
 *
 * Re-running is safe: converted docs are no longer role MEMBER.
 * Credentials: FIREBASE_ADMIN_* from the project .env. With FIRESTORE_EMULATOR_HOST set it talks to the
 * emulator and needs no credentials.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildMemberCard, shouldHaveCard, KL_LO_ID } from '../utils/memberCard.mjs';
import { categoryForChapter } from '../netlify/lib/externalAccounts.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(FIREBASE_ADMIN_[A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}
const { db } = await import(pathToFileURL(path.join(root, 'netlify/lib/firebaseAdmin.mjs')).href);
if (!db) { console.error('No Firebase Admin credentials (.env FIREBASE_ADMIN_* or FIRESTORE_EMULATOR_HOST).'); process.exit(1); }

const BATCH_MEMBERS = 200; // 2 writes each (member + card) → 400 per batch
const APPLY = process.argv.includes('--apply');
const ACTOR = 'script:auditChapterMemberDocs';

console.log(`target: ${process.env.FIRESTORE_EMULATOR_HOST ? `EMULATOR ${process.env.FIRESTORE_EMULATOR_HOST}` : `PROJECT ${process.env.FIREBASE_ADMIN_PROJECT_ID}`}`);
console.log(APPLY ? 'mode: APPLY (writes)' : 'mode: DRY RUN (no writes)');

const [memberSnap, chapterSnap] = await Promise.all([
  db.collection('members').where('role', '==', 'MEMBER').get(),
  db.collection('sisterChapters').get(),
]);
const chapters = new Map(chapterSnap.docs.map(d => [d.id, d.data()]));

const convert = [];
const noChapter = [];
for (const d of memberSnap.docs) {
  const m = d.data();
  if (typeof m.loId !== 'string' || m.loId === '' || m.loId === KL_LO_ID) continue;
  const row = { id: d.id, loId: m.loId, name: m.general?.name ?? m.name ?? '(no name)' };
  const chapter = chapters.get(m.loId);
  if (!chapter) { noChapter.push(row); continue; }
  convert.push({ ...row, member: m, chapter });
}

console.log(`\nrole MEMBER docs with a non-KL loId: ${convert.length + noChapter.length}`);
console.log(`  to convert (chapter exists): ${convert.length}`);
for (const r of convert) console.log(`    ${r.id}  loId=${r.loId}  ${r.name}`);
console.log(`  skipped (chapter missing in sisterChapters): ${noChapter.length}`);
for (const r of noChapter) console.log(`    ${r.id}  loId=${r.loId}  ${r.name}`);

if (!APPLY) {
  console.log('\nDry run only. Re-run with --apply to convert.');
  process.exit(0);
}

const nowIso = new Date().toISOString();
let done = 0;
for (let i = 0; i < convert.length; i += BATCH_MEMBERS) {
  const batch = db.batch();
  for (const r of convert.slice(i, i + BATCH_MEMBERS)) {
    const affiliation = {
      category: categoryForChapter(r.chapter),
      country: String(r.chapter.country ?? ''),
      status: 'active',
      activatedAt: nowIso,
      statusUpdatedAt: nowIso,
      statusUpdatedBy: ACTOR,
    };
    batch.update(db.collection('members').doc(r.id), { role: 'AFFILIATE', affiliation, updatedAt: new Date(), updatedBy: ACTOR });
    const after = { ...r.member, role: 'AFFILIATE', affiliation };
    const cardRef = db.collection('memberCards').doc(r.id);
    if (shouldHaveCard(after)) batch.set(cardRef, buildMemberCard(after, nowIso));
    else batch.delete(cardRef);
  }
  await batch.commit();
  done += Math.min(BATCH_MEMBERS, convert.length - i);
  console.log(`  converted ${done}/${convert.length}`);
}

if (convert.length > 0) {
  await db.collection('auditLog').add({
    action: 'external_accounts_convert_chapter_members',
    performedBy: ACTOR,
    targetCollection: 'members',
    targetId: `batch:${convert.length}`,
    before: null,
    after: null,
    metadata: { memberIds: convert.map(r => r.id) },
    timestamp: new Date(),
    _source: 'script',
  });
}
console.log('\nDone.');
