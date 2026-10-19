/**
 * backfillMemberCards.mjs
 *
 * Creates/refreshes memberCards/{memberId} for every member with role MEMBER, BOARD, ADMIN or
 * SUPER_ADMIN (Phase 0 WP2), using the same builder as the app (utils/memberCard.mjs).
 * The opt-in is never changed: card.international is derived from members.privacy.shareCardInternationally
 * (missing = false), exactly what firestore.rules requires.
 *
 * Usage:
 *   node scripts/backfillMemberCards.mjs            # DRY RUN: counts + samples, writes nothing
 *   node scripts/backfillMemberCards.mjs --apply    # write, in batches of <= 400
 *
 * Re-running --apply is safe: cards that already match are skipped; orphan cards (member no longer
 * qualifies) are only reported, never deleted.
 * Credentials: FIREBASE_ADMIN_* from the project .env (same as the Netlify functions). With
 * FIRESTORE_EMULATOR_HOST set it talks to the emulator and needs no credentials.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildMemberCard, shouldHaveCard } from '../utils/memberCard.mjs';

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

const BATCH_SIZE = 400;
const ROLES = ['MEMBER', 'BOARD', 'ADMIN', 'SUPER_ADMIN'];
const APPLY = process.argv.includes('--apply');

console.log(`target: ${process.env.FIRESTORE_EMULATOR_HOST ? `EMULATOR ${process.env.FIRESTORE_EMULATOR_HOST}` : `PROJECT ${process.env.FIREBASE_ADMIN_PROJECT_ID}`}`);
console.log(APPLY ? 'mode: APPLY (writes)' : 'mode: DRY RUN (no writes)');

const [memberSnap, cardSnap] = await Promise.all([
  db.collection('members').where('role', 'in', ROLES).get(),
  db.collection('memberCards').get(),
]);
const existingCards = new Map(cardSnap.docs.map(d => [d.id, d.data()]));

const writes = [];
const perRole = {};
let optedIn = 0, unchanged = 0, noName = 0;
for (const d of memberSnap.docs) {
  const member = { id: d.id, ...d.data() };
  perRole[member.role] = (perRole[member.role] ?? 0) + 1;
  if (!shouldHaveCard(member)) continue;
  const card = buildMemberCard(member);
  if (!card.displayName) noName++;
  if (card.international) optedIn++;
  const existing = existingCards.get(d.id);
  // Skip when the stored card already equals the one we would write (ignoring updatedAt).
  if (existing) {
    const { updatedAt: _a, ...a } = existing;
    const { updatedAt: _b, ...b } = card;
    if (JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())) { unchanged++; continue; }
  }
  writes.push({ id: d.id, card, isNew: !existing });
}
const memberIds = new Set(memberSnap.docs.map(d => d.id));
const orphans = [...existingCards.keys()].filter(id => !memberIds.has(id));

console.log(`members scanned (${ROLES.join('/')}): ${memberSnap.size}  ${JSON.stringify(perRole)}`);
console.log(`cards existing: ${existingCards.size}`);
console.log(`to write: ${writes.length}  (new: ${writes.filter(w => w.isNew).length}, refresh: ${writes.filter(w => !w.isNew).length})`);
console.log(`already up to date: ${unchanged}`);
console.log(`opted in (international=true): ${optedIn}`);
if (noName) console.log(`WARNING: ${noName} member(s) have no name; displayName will be empty`);
if (orphans.length) console.log(`orphan cards (no MEMBER+ member doc; NOT deleted): ${orphans.length} e.g. ${orphans.slice(0, 3).join(', ')}`);
console.log('samples:');
for (const w of writes.slice(0, 2)) console.log(`  ${w.id}: ${JSON.stringify(w.card)}`);

if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply to write.');
  process.exit(0);
}

let written = 0;
for (let i = 0; i < writes.length; i += BATCH_SIZE) {
  const batch = db.batch();
  for (const w of writes.slice(i, i + BATCH_SIZE)) batch.set(db.collection('memberCards').doc(w.id), w.card);
  await batch.commit();
  written += Math.min(BATCH_SIZE, writes.length - i);
  console.log(`written ${written}/${writes.length}`);
}
console.log('done');
process.exit(0);
