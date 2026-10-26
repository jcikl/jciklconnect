// @vitest-environment node
/**
 * eventRegistrations.jciMalaysiaRegcode is server-written only (Admin SDK via netlify/functions/jci-malaysia-regcode).
 * A member must never set/forge it on their own registration: it is in the self-update locked (deny) list
 * eventRegSelfUpdateOnlyTouchesOwnFields(). A member may still self-edit genuinely own fields (e.g. tshirtSize).
 * The Admin SDK (owner token) bypasses rules and can write it.
 *
 * Emulator only; skipped otherwise.
 *   firebase emulators:exec --only firestore --project demo-jcikl-rules "npx vitest run tests/rules --no-file-parallelism"
 */
import { describe, it, expect, beforeAll } from 'vitest';

type Plain = null | boolean | number | string | Plain[] | { [key: string]: Plain };
type Doc = { [key: string]: Plain };

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = 'demo-jcikl-regcode';
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `http://${HOST}/v1/${ROOT}`;

function toValue(v: Plain): Record<string, unknown> {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}
const toFields = (d: Doc) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, toValue(v)]));
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

function authHeader(uid: string): Record<string, string> {
  if (uid === 'owner') return { Authorization: 'Bearer owner' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, auth_time: now, iat: now, exp: now + 3600,
    sub: uid, user_id: uid, email: `${uid}@example.test`, email_verified: true,
    firebase: { sign_in_provider: 'password', identities: {} },
  };
  return { Authorization: `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.` };
}

/** Full-document write (seed) or masked partial update (updateMask = the top-level keys of `data`). */
async function write(uid: string, path: string, data: Doc, fullReplace = false): Promise<number> {
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST',
    headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [{
        update: { name: `${ROOT}/${path}`, fields: toFields(data) },
        ...(fullReplace ? {} : { updateMask: { fieldPaths: Object.keys(data) } }),
      }],
    }),
  });
  return res.status;
}

describe.skipIf(!HOST)('firestore.rules — eventRegistrations.jciMalaysiaRegcode is not member-writable (emulator)', () => {
  beforeAll(async () => {
    await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    expect(await write('owner', 'members/mem1', { role: 'MEMBER', loId: 'jcikl', general: { name: 'Kay' }, contact: { email: 'kay@example.test' } }, true)).toBe(200);
    expect(await write('owner', 'eventRegistrations/ev1_mem1', {
      eventId: 'ev1', memberId: 'mem1', status: 'registered', loId: 'jcikl', createdAt: '2026-10-26T00:00:00.000Z',
    }, true)).toBe(200);
  });

  it('member CAN self-update a genuinely own field (tshirtSize)', async () => {
    // updatedAt is itself in the locked list, so a self-edit touches only the free field.
    expect(await write('mem1', 'eventRegistrations/ev1_mem1', { tshirtSize: 'L' })).toBe(200);
  });

  it('member CANNOT set jciMalaysiaRegcode on their own registration', async () => {
    expect(await write('mem1', 'eventRegistrations/ev1_mem1', { jciMalaysiaRegcode: 'HACK01' })).toBe(403);
  });

  it('member CANNOT sneak jciMalaysiaRegcode in alongside an allowed field', async () => {
    expect(await write('mem1', 'eventRegistrations/ev1_mem1', { tshirtSize: 'M', jciMalaysiaRegcode: 'HACK02' })).toBe(403);
  });

  it('the Admin SDK (owner) CAN write jciMalaysiaRegcode (server path)', async () => {
    expect(await write('owner', 'eventRegistrations/ev1_mem1', { jciMalaysiaRegcode: 'REAL01' })).toBe(200);
  });
});
