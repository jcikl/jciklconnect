import { randomUUID } from 'node:crypto';
import { readOwnProfilePhoto } from '../../utils/publicDirectoryPhotoSource.mjs';
import { normalizeMyPhone } from '../../utils/phoneNumber.mjs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';

const MAX_BYTES = 120 * 1024;
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const VALID_KEY = /^[a-f0-9]{32}$/;
const PHOTO_ROLES = new Set(['MEMBER', 'BOARD', 'ADMIN', 'SUPER_ADMIN']);
const photoPath = (uid, key) => '/.netlify/functions/public-directory-photo?id=' + uid + '&key=' + key;
const safeHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Netlify-CDN-Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
const reply = (data, status = 200) => Response.json(data, { status, headers: safeHeaders });
const missing = () => new Response(null, { status: 404, headers: safeHeaders });

function listingEligible(memberSnap, listingSnap, uid) {
  const member = memberSnap.data();
  const listing = listingSnap.data();
  return !!(member && !member.deletedAt &&
    (member.loId === undefined || member.loId === 'jcikl') && PHOTO_ROLES.has(member.role) &&
    member.privacy?.shareCardInternationally === true &&
    listing?.memberId === uid &&
    typeof listing.companyName === 'string' && listing.companyName.trim());
}

// Strip all APPn/COM segments, even for direct API callers that did not use
// the browser's canvas. Accept only small, single-scan baseline JPEGs.
function sanitizeJpeg(bytes) {
  if (bytes.length < 16 || bytes.length > MAX_BYTES ||
      bytes[0] !== 0xff || bytes[1] !== 0xd8 ||
      bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return null;
  const chunks = [bytes.subarray(0, 2)];
  let pos = 2;
  let hasFrame = false;
  while (pos + 3 < bytes.length) {
    const start = pos;
    if (bytes[pos++] !== 0xff) return null;
    while (bytes[pos] === 0xff) pos++;
    const marker = bytes[pos++];
    if (pos + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(pos);
    const end = pos + length;
    if (length < 2 || end > bytes.length - 2) return null;
    if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) {
      pos = end;
      continue;
    }
    if (marker === 0xc0) {
      if (hasFrame || length < 8 || bytes[pos + 2] !== 8) return null;
      const height = bytes.readUInt16BE(pos + 3);
      const width = bytes.readUInt16BE(pos + 5);
      const components = bytes[pos + 7];
      if (!width || !height || width > 384 || height > 384 ||
          ![1, 3].includes(components) || length !== 8 + 3 * components) return null;
      hasFrame = true;
    } else if (marker === 0xda) {
      if (!hasFrame || length < 6 || end >= bytes.length - 2) return null;
      for (let i = end; i < bytes.length - 2; i++) {
        if (bytes[i] !== 0xff) continue;
        // Only byte stuffing and restart markers are permitted in the scan.
        const escaped = bytes[++i];
        if (escaped !== 0 && !(escaped >= 0xd0 && escaped <= 0xd7)) return null;
      }
      chunks.push(bytes.subarray(start));
      return Buffer.concat(chunks);
    } else if (![0xc4, 0xdb, 0xdd].includes(marker)) {
      return null;
    }
    chunks.push(bytes.subarray(start, end));
    pos = end;
  }
  return null;
}

async function readPhoto(req) {
  if (!req.body || Number(req.headers.get('content-length')) > MAX_BYTES) return null;
  const reader = req.body.getReader();
  const chunks = [];
  let count = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > MAX_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks, count);
    return sanitizeJpeg(bytes);
  } finally {
    reader.releaseLock();
  }
}

export function makePublicDirectoryPhotoHandler({ auth, db, deleteField, fetchImage = fetch }) {
  // Project just the eligibility fields; never read the private general.avatarUrl.
  const currentMember = async (tx, ref) => (await tx.getAll(ref, {
    fieldMask: ['role', 'loId', 'deletedAt', 'privacy.shareCardInternationally'],
  }))[0];
  const refs = uid => [
    db.collection('members').doc(uid),
    db.collection('publicBusinessListings').doc(uid),
    db.collection('publicDirectoryPhotoAssets').doc(uid),
  ];

  return async req => {
    const params = new URL(req.url).searchParams;
    const operation = params.get('mode');
    if (req.method === 'GET' && (operation === 'profile' || operation === 'whatsapp')) {
      const id = params.get('id');
      if (!db || !VALID_ID.test(id || '')) return missing();
      try {
        const [member, listing] = refs(id);
        const readSource = () => db.runTransaction(async tx => {
          const [m, l] = await Promise.all([
            tx.getAll(member, { fieldMask: ['role', 'loId', 'deletedAt', 'privacy.shareCardInternationally', operation === 'whatsapp' ? 'contact.phone' : 'general.avatarUrl'] }).then(rows => rows[0]),
            tx.get(listing),
          ]);
          return listingEligible(m, l, id)
            ? (operation === 'whatsapp' ? m.data()?.contact?.phone : m.data()?.general?.avatarUrl)
            : null;
        }, { readOnly: true });
        const source = await readSource();
        if (operation === 'whatsapp') {
          const phone = normalizeMyPhone(source);
          if (!phone) return missing();
          const svg = renderToStaticMarkup(createElement(QRCodeSVG, {
            value: 'https://wa.me/' + phone.slice(1), size: 96,
            level: 'M', marginSize: 4, bgColor: '#ffffff', fgColor: '#111827',
          }));
          if (await readSource() !== source) return missing();
          return new Response(svg, { headers: {
            ...safeHeaders, 'Content-Type': 'image/svg+xml',
            'Content-Security-Policy': "default-src 'none'; sandbox",
          } });
        }
        if (typeof source !== 'string' || !source) return missing();
        const photo = await readOwnProfilePhoto(source, AbortSignal.timeout(8000), fetchImage);
        // Consent or the profile photo may change while the upstream image loads.
        if (await readSource() !== source) return missing();
        return new Response(photo, { headers: {
          ...safeHeaders, 'Content-Type': photo.type, 'Content-Length': String(photo.size),
          'Content-Security-Policy': "default-src 'none'; sandbox",
        } });
      } catch { return missing(); }
    }
    const authHeader = req.headers.get('authorization') || '';
    const publicRead = req.method === 'GET' && operation === null;
    if (publicRead && (!VALID_ID.test(params.get('id') || '') || !VALID_KEY.test(params.get('key') || ''))) return missing();
    if (!publicRead && !((req.method === 'GET' && operation === 'status') ||
        (operation === null && ['POST', 'DELETE'].includes(req.method)))) return reply({ error: 'Method not allowed.' }, 405);
    // Mutations/status act on the verified caller only, never on a supplied target id.
    if (!publicRead && (params.has('id') || params.has('key'))) return reply({ error: 'Unexpected target.' }, 400);
    if (!db || !auth) return publicRead ? missing() : reply({ error: 'Public directory photos are unavailable.' }, 503);

    let uid = params.get('id');
    if (!publicRead) {
      if (!authHeader.startsWith('Bearer ')) return reply({ error: 'Sign in first.' }, 401);
      try {
        ({ uid } = await auth.verifyIdToken(authHeader.slice(7), true));
      } catch { return reply({ error: 'Sign in again.' }, 401); }
      if (!VALID_ID.test(uid || '')) return reply({ error: 'Not eligible.' }, 403);
    }

    try {
      const [member, listing, asset] = refs(uid);
      if (publicRead) {
        const key = params.get('key');
        const photo = await db.runTransaction(async tx => {
          const [m, l] = await Promise.all([currentMember(tx, member), tx.get(listing)]);
          if (!listingEligible(m, l, uid) || l.data().publicDirectoryPhotoKey !== key) return null;
          const listingData = l.data();
          if (Object.hasOwn(listingData, 'avatarUrl') && listingData.avatarUrl !== photoPath(uid, key)) return null;
          const a = await tx.get(asset);
          if (a.data()?.key !== key) return null;
          const bytes = a.data()?.jpeg;
          return Buffer.isBuffer(bytes) ? sanitizeJpeg(bytes) : null;
        }, { readOnly: true });
        return photo ? new Response(photo, {
          headers: { ...safeHeaders, 'Content-Type': 'image/jpeg', 'Content-Length': String(photo.byteLength) },
        }) : missing();
      }

      if (operation === 'status') {
        const status = await db.runTransaction(async tx => {
          const [m, l, [a]] = await Promise.all([
            currentMember(tx, member), tx.get(listing), tx.getAll(asset, { fieldMask: ['key'] }),
          ]);
          const eligible = listingEligible(m, l, uid);
          const row = l.data();
          const key = row?.publicDirectoryPhotoKey;
          const hasUrl = !!row && Object.hasOwn(row, 'avatarUrl');
          return {
            eligible,
            published: !!(eligible && VALID_KEY.test(key || '') &&
              (!hasUrl || row.avatarUrl === photoPath(uid, key)) && a.data()?.key === key),
            stored: !!(a.exists || (row && Object.hasOwn(row, 'publicDirectoryPhotoKey')) || hasUrl),
          };
        }, { readOnly: true });
        return reply(status);
      }

      if (req.method === 'DELETE') {
        // Former members may still revoke their own photo; publishing requires current eligibility.
        await db.runTransaction(async tx => {
          const l = await tx.get(listing);
          const fields = ['publicDirectoryPhotoKey', 'avatarUrl'];
          const removal = l.exists && Object.fromEntries(fields
            .filter(field => Object.hasOwn(l.data(), field))
            .map(field => [field, deleteField()]));
          if (removal && Object.keys(removal).length) tx.update(listing, removal);
          tx.delete(asset);
        });
        return reply({ published: false, stored: false });
      }

      if (req.headers.get('content-type') !== 'image/jpeg' || req.headers.get('x-public-photo-consent') !== 'yes') {
        return reply({ error: 'Choose a photo and confirm that guests may see it.' }, 400);
      }
      const photo = await readPhoto(req);
      if (!photo) return reply({ error: 'Invalid image or image too large.' }, 400);
      const key = randomUUID().replaceAll('-', '');
      const published = await db.runTransaction(async tx => {
        const [m, l] = await Promise.all([currentMember(tx, member), tx.get(listing)]);
        if (!listingEligible(m, l, uid)) return false;
        tx.set(asset, { key, jpeg: photo });
        tx.update(listing, { publicDirectoryPhotoKey: key, avatarUrl: photoPath(uid, key) });
        return true;
      });
      return published ? reply({ published: true, stored: true }) : reply({ error: 'Your public business listing is not eligible.' }, 403);
    } catch {
      // No profile, photo, token or identifiers in a response or log.
      return publicRead ? missing() : reply({ error: 'Public directory photos are unavailable.' }, 503);
    }
  };
}
