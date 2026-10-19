// Own-chapter birthdays for external users (owner decision 8). Externals cannot list member docs, so the
// server reads them with the Admin SDK and returns only { id, displayName, avatarUrl, mmdd } for one month.
//   POST { month: 1-12 }  →  { month, birthdays: [...] }
// Caller must be an active external (AFFILIATE / CHAPTER_ADMIN, affiliation active, non-KL loId), read from
// the caller's Firestore doc. Members with privacy.hideBirthday are skipped; the year is never returned.
import { db, auth, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';
import { isActiveExternal, parseMonth, buildChapterBirthdays } from '../lib/chapterBirthdays.mjs';

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

export default async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  const json = (body, status = 200) => Response.json(body, { status, headers: cors });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });
  if (!hasAdminCredentials) return json({ error: 'Missing Firebase Admin credentials' }, 500);

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  let caller;
  try {
    const decoded = await auth.verifyIdToken(authHeader.slice(7));
    caller = (await db.collection('members').doc(decoded.uid).get()).data() ?? null;
  } catch {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!isActiveExternal(caller)) return json({ error: 'Forbidden' }, 403);

  const body = await req.json().catch(() => ({}));
  const month = parseMonth(body.month);
  if (!month) return json({ error: 'month must be 1-12' }, 400);

  try {
    const snap = await db.collection('members').where('loId', '==', caller.loId).get();
    const birthdays = buildChapterBirthdays(snap.docs.map(d => ({ id: d.id, data: d.data() })), caller.loId, month);
    return json({ month, birthdays });
  } catch (err) {
    console.error('[chapter-birthdays] error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
};
