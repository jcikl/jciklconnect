/**
 * One-off (owner decision 2026-10-25, "B 选 3"): KL members who have filled in a company name and
 * have NEVER set the international card-sharing preference get it switched on, so sister-chapter
 * members can see their card. Members who chose a value (true or false) are left alone.
 *
 *   node scripts/defaultShareBusinessCards.mjs            # dry run (default): prints counts + samples, writes nothing
 *   node scripts/defaultShareBusinessCards.mjs --apply    # sets privacy.shareCardInternationally = true and
 *                                                         # rewrites each member's memberCards doc (international: true)
 *
 * Credentials: FIREBASE_ADMIN_* from the project .env. With FIRESTORE_EMULATOR_HOST set it uses the emulator.
 * Safe to re-run: a member already set to true is skipped.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildMemberCard, shouldHaveCard, isExternalMember, KL_LO_ID } from '../utils/memberCard.mjs';

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

const MEMBERS_PER_BATCH = 200; // 2 writes per member (member + card) → 400 ops
const APPLY = process.argv.includes('--apply');

console.log(`target: ${process.env.FIRESTORE_EMULATOR_HOST ? `EMULATOR ${process.env.FIRESTORE_EMULATOR_HOST}` : `PROJECT ${process.env.FIREBASE_ADMIN_PROJECT_ID}`}`);
console.log(APPLY ? 'mode: APPLY (writes)' : 'mode: DRY RUN (no writes)');

const companyOf = m => String(m.business?.companyName ?? m.companyName ?? '').trim();

const snap = await db.collection('members').get();
const counts = { kl: 0, noCard: 0, alreadyOn: 0, chosenOff: 0, noCompany: 0, toSwitch: 0 };
const targets = [];
for (const d of snap.docs) {
  const m = { ...d.data(), id: d.id };
  if ((m.loId ?? KL_LO_ID) !== KL_LO_ID || isExternalMember(m)) continue;
  counts.kl++;
  if (!shouldHaveCard(m)) { counts.noCard++; continue; }
  const pref = m.privacy?.shareCardInternationally;
  if (pref === true) { counts.alreadyOn++; continue; }
  if (pref === false) { counts.chosenOff++; continue; }
  if (!companyOf(m)) { counts.noCompany++; continue; }
  counts.toSwitch++;
  targets.push(m);
}

console.log('KL member docs:', counts.kl);
console.log('  no card (GUEST / INACTIVE):', counts.noCard);
console.log('  already sharing:', counts.alreadyOn);
console.log('  chose NOT to share (left alone):', counts.chosenOff);
console.log('  never chose, no company name (left alone):', counts.noCompany);
console.log('  never chose, has company name → switch ON:', counts.toSwitch);
console.log('samples:', targets.slice(0, 5).map(m => `${m.general?.name ?? m.id} — ${companyOf(m)}`).join(' | ') || '(none)');

if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply to switch these members on.');
  process.exit(0);
}

const nowIso = new Date().toISOString();
let written = 0;
for (let i = 0; i < targets.length; i += MEMBERS_PER_BATCH) {
  const batch = db.batch();
  for (const m of targets.slice(i, i + MEMBERS_PER_BATCH)) {
    const after = { ...m, privacy: { ...(m.privacy ?? {}), shareCardInternationally: true } };
    batch.update(db.collection('members').doc(m.id), { 'privacy.shareCardInternationally': true });
    batch.set(db.collection('memberCards').doc(m.id), buildMemberCard(after, nowIso));
  }
  await batch.commit();
  written += Math.min(MEMBERS_PER_BATCH, targets.length - i);
  console.log(`switched on ${written}/${targets.length}`);
}
console.log('done');
process.exit(0);
