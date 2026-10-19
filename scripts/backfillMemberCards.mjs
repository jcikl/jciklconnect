/**
 * backfillMemberCards.mjs
 *
 * Creates/refreshes memberCards/{memberId} for every member that qualifies (role MEMBER, BOARD, ADMIN,
 * SUPER_ADMIN, or an active external; Phase 0 WP2), rewrites stale cards, and with --apply deletes orphan
 * cards (member missing / no longer eligible). Also prints a loId report (no changes). Uses the same
 * builder as the app (utils/memberCard.mjs).
 * The opt-in is never changed: card.international is derived from members.privacy.shareCardInternationally
 * (missing = false), exactly what firestore.rules requires.
 *
 * Usage:
 *   node scripts/backfillMemberCards.mjs            # DRY RUN: counts + samples, writes nothing
 *   node scripts/backfillMemberCards.mjs --apply    # write, in batches of <= 400
 *
 * Re-running --apply is safe: cards that already match are skipped.
 * Credentials: FIREBASE_ADMIN_* from the project .env (same as the Netlify functions). With
 * FIRESTORE_EMULATOR_HOST set it talks to the emulator and needs no credentials.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildMemberCard, shouldHaveCard, KL_LO_ID } from '../utils/memberCard.mjs';

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
const APPLY = process.argv.includes('--apply');

console.log(`target: ${process.env.FIRESTORE_EMULATOR_HOST ? `EMULATOR ${process.env.FIRESTORE_EMULATOR_HOST}` : `PROJECT ${process.env.FIREBASE_ADMIN_PROJECT_ID}`}`);
console.log(APPLY ? 'mode: APPLY (writes)' : 'mode: DRY RUN (no writes)');

const [memberSnap, cardSnap] = await Promise.all([
  db.collection('members').get(),
  db.collection('memberCards').get(),
]);
const existingCards = new Map(cardSnap.docs.map(d => [d.id, d.data()]));
const membersById = new Map(memberSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));

const writes = [];
const perRole = {};
let optedIn = 0, unchanged = 0, noName = 0;
for (const member of membersById.values()) {
  if (!shouldHaveCard(member)) continue;
  perRole[member.role] = (perRole[member.role] ?? 0) + 1;
  const card = buildMemberCard(member);
  if (!card.displayName) noName++;
  if (card.international) optedIn++;
  const existing = existingCards.get(member.id);
  // Skip when the stored card already equals the one we would write (ignoring updatedAt).
  // A stale card (international / loId / any field differs) is simply rewritten.
  if (existing) {
    const { updatedAt: _a, ...a } = existing;
    const { updatedAt: _b, ...b } = card;
    if (JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())) { unchanged++; continue; }
  }
  writes.push({ id: member.id, card, isNew: !existing });
}

// Orphan cards: member doc missing, or the member no longer qualifies (GUEST, INACTIVE, external not active).
const orphans = [];
for (const id of existingCards.keys()) {
  const m = membersById.get(id);
  if (!m) orphans.push({ id, reason: 'member missing' });
  else if (!shouldHaveCard(m)) orphans.push({ id, reason: `member not eligible (role=${m.role ?? 'none'})` });
}

// loId REPORT (not a fix): KL list queries filter loId == 'jcikl', so members without it are invisible there.
const loIdCounts = {};
const loIdSamples = [];
for (const m of membersById.values()) {
  if (m.loId === KL_LO_ID) continue;
  const key = m.loId == null || m.loId === '' ? '(missing)' : String(m.loId);
  loIdCounts[key] = (loIdCounts[key] ?? 0) + 1;
  if (loIdSamples.length < 5) loIdSamples.push(`${m.id} role=${m.role ?? '-'} loId=${key} name=${m.general?.name ?? m.name ?? ''}`);
}
const loIdTotal = Object.values(loIdCounts).reduce((a, b) => a + b, 0);

console.log(`members in collection: ${membersById.size}`);
console.log(`members that get a card: ${Object.values(perRole).reduce((a, b) => a + b, 0)}  ${JSON.stringify(perRole)}`);
console.log(`cards existing: ${existingCards.size}`);
console.log(`to write: ${writes.length}  (new: ${writes.filter(w => w.isNew).length}, refresh/stale: ${writes.filter(w => !w.isNew).length})`);
console.log(`already up to date: ${unchanged}`);
console.log(`opted in (international=true): ${optedIn}`);
if (noName) console.log(`WARNING: ${noName} member(s) have no name; displayName will be empty`);
console.log(`orphan cards ${APPLY ? 'to DELETE' : 'that --apply would DELETE'}: ${orphans.length}` + (orphans.length ? `  e.g. ${orphans.slice(0, 3).map(o => `${o.id} (${o.reason})`).join(', ')}` : ''));
console.log(`\nloId REPORT (no changes made): members whose loId is missing or not '${KL_LO_ID}': ${loIdTotal}`);
if (loIdTotal) {
  console.log(`  by value: ${JSON.stringify(loIdCounts)}`);
  console.log('  sample:'); for (const l of loIdSamples) console.log(`    ${l}`);
  console.log(`  NOTE: KL list queries filter loId == '${KL_LO_ID}'; members listed above would be invisible to them.`);
}
console.log('\ncard samples:');
for (const w of writes.slice(0, 2)) console.log(`  ${w.id}: ${JSON.stringify(w.card)}`);

if (!APPLY) {
  console.log('\nDry run — nothing written or deleted. Re-run with --apply to write cards and delete orphan cards.');
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
let deleted = 0;
for (let i = 0; i < orphans.length; i += BATCH_SIZE) {
  const batch = db.batch();
  for (const o of orphans.slice(i, i + BATCH_SIZE)) batch.delete(db.collection('memberCards').doc(o.id));
  await batch.commit();
  deleted += Math.min(BATCH_SIZE, orphans.length - i);
  console.log(`deleted orphans ${deleted}/${orphans.length}`);
}
console.log('done');
process.exit(0);
