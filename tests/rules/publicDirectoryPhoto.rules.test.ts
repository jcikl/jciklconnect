// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';

const host = process.env.FIRESTORE_EMULATOR_HOST || '';
const loopbackOnly = /^(?:127\.0\.0\.1|localhost):\d+$/.test(host);
const project = 'demo-jcikl-public-photo-rules';
const root = 'projects/' + project + '/databases/(default)/documents';
const base = 'http://' + host + '/v1/' + root;
const member = 'testMember';
const admin = 'testAdmin';
const memberPath = 'members/' + member;
const listingPath = 'publicBusinessListings/' + member;
const assetPath = 'publicDirectoryPhotoAssets/' + member;
const photoKey = 'a'.repeat(32);

function authHeader(uid?: string): Record<string, string> {
  if (!uid) return {};
  if (uid === 'owner') return { Authorization: 'Bearer owner' };
  const now = Math.floor(Date.now() / 1000);
  const b64 = (data: object) => Buffer.from(JSON.stringify(data)).toString('base64url');
  const payload = {
    iss: 'https://securetoken.google.com/' + project, aud: project, auth_time: now,
    iat: now, exp: now + 3600, sub: uid, user_id: uid, email: uid + '@example.test',
    firebase: { sign_in_provider: 'password', identities: {} },
  };
  return { Authorization: 'Bearer ' + b64({ alg: 'none', typ: 'JWT' }) + '.' + b64(payload) + '.' };
}

async function write(uid: string, path: string, fields: Record<string, string>, mask?: string[]): Promise<number> {
  return (await fetch(base + ':commit', {
    method: 'POST',
    headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: [{
      update: { name: root + '/' + path, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { stringValue: v }])) },
      ...(mask ? { updateMask: { fieldPaths: mask } } : {}),
    }] }),
  })).status;
}

describe.skipIf(!loopbackOnly)('public directory photos Firestore rules (local emulator only)', () => {
  beforeAll(async () => {
    await fetch('http://' + host + '/emulator/v1/projects/' + project + '/databases/(default)/documents', { method: 'DELETE' });
    expect(await write('owner', memberPath, { role: 'MEMBER', loId: 'jcikl' })).toBe(200);
    expect(await write('owner', 'members/' + admin, { role: 'ADMIN', loId: 'jcikl' })).toBe(200);
    expect(await write('owner', assetPath, { key: photoKey, jpeg: 'fixture' })).toBe(200);
  });

  it('normal client listing sync works but neither owner nor board can mint or change the marker', async () => {
    expect(await write(member, listingPath, { memberId: member, companyName: 'Fixture', publicDirectoryPhotoKey: photoKey })).toBe(403);
    const avatarUrl = '/.netlify/functions/public-directory-photo?id=' + member + '&key=' + photoKey;
    expect(await write(member, listingPath, { memberId: member, companyName: 'Fixture', avatarUrl })).toBe(403);
    expect(await write(member, listingPath, { memberId: member, companyName: 'Fixture' })).toBe(200);
    expect(await write(member, listingPath, { avatarUrl }, ['avatarUrl'])).toBe(403);
    expect(await write(admin, listingPath, { avatarUrl }, ['avatarUrl'])).toBe(403);
    expect(await write('owner', listingPath, { avatarUrl }, ['avatarUrl'])).toBe(200);
    expect(await write(member, listingPath, {}, ['avatarUrl'])).toBe(403);
    expect(await write(admin, listingPath, { publicDirectoryPhotoKey: photoKey }, ['publicDirectoryPhotoKey'])).toBe(403);
    expect(await write('owner', listingPath, { publicDirectoryPhotoKey: photoKey }, ['publicDirectoryPhotoKey'])).toBe(200);
    expect(await write(member, listingPath, { companyName: 'Edited' }, ['companyName'])).toBe(200);
    expect(await write(member, listingPath, {}, ['publicDirectoryPhotoKey'])).toBe(403);
    expect(await write(admin, listingPath, { publicDirectoryPhotoKey: 'b'.repeat(32) }, ['publicDirectoryPhotoKey'])).toBe(403);
    const res = await fetch(base + '/' + listingPath);
    expect(res.status).toBe(200);
    const fields = (await res.json()).fields;
    expect(fields.publicDirectoryPhotoKey.stringValue).toBe(photoKey);
    expect(fields.avatarUrl.stringValue).toBe(avatarUrl);
  });

  it('guests do not gain member access, and no Firestore client can read or write the private asset', async () => {
    expect((await fetch(base + '/' + memberPath)).status).toBe(403);
    for (const uid of [undefined, member, admin]) {
      expect((await fetch(base + '/' + assetPath, { headers: authHeader(uid) })).status).toBe(403);
    }
    expect(await write(member, assetPath, { key: 'b'.repeat(32) })).toBe(403);
    expect(await write(admin, assetPath, { key: 'b'.repeat(32) })).toBe(403);
  });
});
