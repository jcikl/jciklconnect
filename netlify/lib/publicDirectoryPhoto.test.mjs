import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import { approvedPhotoBytes, isCurrentPhotoDraft, MAX_PHOTO_SOURCE_BYTES, readOwnProfilePhoto } from '../../utils/publicDirectoryPhotoSource.mjs';
import { makePublicDirectoryPhotoHandler } from './publicDirectoryPhoto.mjs';

const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==', 'base64');
const owner = 'member-a';
const guest = 'member-b';
const listing = 'publicBusinessListings/' + owner;
const member = 'members/' + owner;
const asset = 'publicDirectoryPhotoAssets/' + owner;
const endpoint = 'https://fixture.test/.netlify/functions/public-directory-photo';
const remove = Symbol('delete');

function fixture(fetchImage) {
  const records = new Map([
    [member, { role: 'MEMBER', loId: 'jcikl', general: { avatarUrl: 'https://example.invalid/private.jpg' }, privacy: { shareCardInternationally: true } }],
    [listing, { memberId: owner, companyName: 'Fixture', logo: 'https://res.cloudinary.com/fixture/logo' }],
    ['members/' + guest, { role: 'GUEST', privacy: { shareCardInternationally: true } }],
  ]);
  const auth = { async verifyIdToken(token, checkRevoked) {
    assert.equal(checkRevoked, true);
    if (![owner, guest].includes(token)) throw new Error('invalid');
    return { uid: token };
  } };
  const db = {
    collection: collection => ({ doc: id => collection + '/' + id }),
    async runTransaction(run) {
      const writes = [];
      const get = async path => ({ exists: records.has(path), data: () => records.get(path) });
      const result = await run({
        get, async getAll(path, { fieldMask }) {
          const snap = await get(path);
          if (path.startsWith('members/')) assert.ok(
            JSON.stringify(fieldMask) === JSON.stringify(['role', 'loId', 'deletedAt', 'privacy.shareCardInternationally']) ||
            JSON.stringify(fieldMask) === JSON.stringify(['role', 'loId', 'deletedAt', 'privacy.shareCardInternationally', 'general.avatarUrl']));
          else assert.deepEqual(fieldMask, ['key']);
          const data = snap.data();
          if (!data) return [snap];
          const projected = {};
          for (const field of fieldMask) {
            const [outer, nested] = field.split('.');
            if (!Object.hasOwn(data, outer)) continue;
            if (nested) projected[outer] = { [nested]: data[outer]?.[nested] };
            else projected[outer] = data[outer];
          }
          return [{ ...snap, data: () => projected }];
        },
        set: (path, value) => writes.push(() => records.set(path, value)),
        delete: path => writes.push(() => records.delete(path)),
        update: (path, value) => writes.push(() => {
          const updated = { ...records.get(path) };
          for (const [key, data] of Object.entries(value)) {
            if (data === remove) delete updated[key];
            else updated[key] = data;
          }
          records.set(path, updated);
        }),
      });
      writes.forEach(write => write());
      return result;
    },
  };
  const handler = makePublicDirectoryPhotoHandler({ db, auth, deleteField: () => remove, fetchImage });
  const request = (path = '', { method = 'GET', token, consent = true, body, mime = 'image/jpeg' } = {}) =>
    handler(new Request(endpoint + path, { method, body, headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'Content-Type': mime } : {}),
      ...(body && consent ? { 'X-Public-Photo-Consent': 'yes' } : {}),
    } }));
  const publish = (options = {}) => request('', { method: 'POST', body: jpeg, token: owner, ...options });
  const link = () => '?id=' + owner + '&key=' + (records.get(listing)?.publicDirectoryPhotoKey || '0'.repeat(32));
  return { records, request, link, publish };
}

test('shared cards serve the current profile photo without a separate upload', async () => {
  let reads = 0;
  const f = fixture(async () => { reads++; return new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } }); });
  f.records.get(member).general.avatarUrl = 'https://res.cloudinary.com/fixture/profile.jpg';
  const path = '?mode=profile&id=' + owner;
  const response = await f.request(path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), jpeg);
  assert.equal(f.records.has(asset), false);
  assert.equal(reads, 1);
  f.records.get(member).privacy.shareCardInternationally = false;
  assert.equal((await f.request(path)).status, 404);
  assert.equal(reads, 1);
  f.records.get(member).privacy.shareCardInternationally = true;
  for (const source of ['', 'http://127.0.0.1/private', 'https://outside.invalid/photo.jpg']) {
    f.records.get(member).general.avatarUrl = source;
    assert.equal((await f.request(path)).status, 404);
  }
  assert.equal(reads, 1);
});

test('automatic photos reject revoked consent during fetch, ineligible members and upstream failures', async () => {
  const f = fixture(async () => {
    f.records.get(member).privacy.shareCardInternationally = false;
    return new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } });
  });
  const path = '?mode=profile&id=' + owner;
  f.records.get(member).general.avatarUrl = 'https://res.cloudinary.com/fixture/profile.jpg';
  assert.equal((await f.request(path)).status, 404);
  const saved = { ...f.records.get(member), privacy: { shareCardInternationally: true } };
  for (const change of [{ role: 'GUEST' }, { deletedAt: true }, { loId: 'other' }]) {
    f.records.set(member, { ...saved, ...change });
    assert.equal((await f.request(path)).status, 404);
  }
  const failed = fixture(async () => new Response('upstream failed', { status: 503 }));
  failed.records.get(member).general.avatarUrl = 'https://res.cloudinary.com/fixture/profile.jpg';
  assert.equal((await failed.request(path)).status, 404);
  failed.records.delete(listing);
  assert.equal((await failed.request(path)).status, 404);
});

test('legacy is off; consent and a separate owner upload produce only an opted-in JPEG', async () => {
  const f = fixture();
  assert.deepEqual(await (await f.request('?mode=status', { token: owner })).json(), { eligible: true, published: false, stored: false });
  assert.equal((await f.request(f.link())).status, 404);
  assert.equal((await f.publish({ consent: false })).status, 400);
  assert.equal(f.records.has(asset), false);
  assert.equal((await f.publish()).status, 200);
  const publishedRow = f.records.get(listing);
  assert.deepEqual(Object.keys(publishedRow).sort(), ['avatarUrl', 'companyName', 'logo', 'memberId', 'publicDirectoryPhotoKey']);
  assert.equal(publishedRow.avatarUrl, '/.netlify/functions/public-directory-photo' + f.link());
  assert.doesNotMatch(JSON.stringify(publishedRow), /private\.jpg|https:\/\/example\.invalid/);
  const res = await f.request(f.link());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/jpeg');
  assert.match(res.headers.get('cache-control'), /no-store/);
  assert.equal(res.headers.get('netlify-cdn-cache-control'), 'no-store');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.doesNotMatch(f.records.get(asset).jpeg.toString(), /private\.jpg/);
});

test('authentication/current eligibility and same-owner scope are enforced', async () => {
  const f = fixture();
  assert.equal((await f.publish({ token: undefined })).status, 401);
  assert.equal((await f.publish({ token: 'bad-token' })).status, 401);
  assert.equal((await f.publish({ token: guest })).status, 403);
  assert.equal((await f.request('?id=' + owner, { method: 'POST', token: guest, body: jpeg })).status, 400);
  assert.equal((await f.publish()).status, 200);
  assert.equal((await f.request('?id=' + owner, { method: 'DELETE', token: guest })).status, 400);
  assert.equal((await f.request('?mode=status')).status, 401);
  assert.equal((await f.request()).status, 404);
  const current = f.link();
  assert.equal((await f.request(current)).status, 200);
  const saved = f.records.get(member);
  for (const change of [{ role: 'INACTIVE' }, { role: 'CHAPTER_ADMIN' }, { loId: 'different-chapter' }, { deletedAt: true }, { privacy: { shareCardInternationally: false } }]) {
    f.records.set(member, { ...saved, ...change });
    assert.equal((await f.request(current)).status, 404);
    assert.equal((await f.publish()).status, 403);
  }
});

test('direct upload strips metadata and rejects oversize/non-JPEG', async () => {
  const f = fixture();
  function segment(marker, text) {
    const payload = Buffer.from(text);
    const bytes = Buffer.alloc(4 + payload.length);
    bytes[0] = 0xff; bytes[1] = marker; bytes.writeUInt16BE(payload.length + 2, 2);
    payload.copy(bytes, 4);
    return bytes;
  }
  assert.equal((await f.publish({ body: Buffer.alloc(121 * 1024) })).status, 400);
  assert.equal((await f.publish({ mime: 'text/html' })).status, 400);
  assert.equal((await f.publish({ body: Buffer.from('<svg/>') })).status, 400);
  assert.equal((await f.publish({ body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) })).status, 400);
  const input = Buffer.concat([jpeg.subarray(0,2), segment(0xe1, 'Exif\0\0 GPS_LOCATION'), segment(0xfe, 'PRIVATE_COMMENT'), jpeg.subarray(2)]);
  assert.equal((await f.publish({ body: input })).status, 200);
  assert.doesNotMatch(f.records.get(asset).jpeg.toString(), /GPS_LOCATION|PRIVATE_COMMENT|Exif/);
  assert.doesNotMatch(Buffer.from(await (await f.request(f.link())).arrayBuffer()).toString(), /GPS_LOCATION|PRIVATE_COMMENT|Exif/);
});

test('replacement invalidates prior link; removing consent and recreating listing cannot republish', async () => {
  const f = fixture();
  assert.equal((await f.publish()).status, 200);
  const first = f.link();
  assert.equal((await f.publish()).status, 200);
  const second = f.link();
  assert.notEqual(first, second);
  assert.equal((await f.request(first)).status, 404);
  const l = f.records.get(listing);
  f.records.delete(listing);
  assert.equal((await f.request(second)).status, 404);
  f.records.set(listing, { memberId: owner, companyName: 'Backfill' });
  assert.equal((await f.request(second)).status, 404);
  f.records.set(listing, l);
  f.records.set(member, { ...f.records.get(member), role: 'INACTIVE' });
  assert.equal((await f.request('', { method: 'DELETE', token: owner })).status, 200);
  assert.equal(Object.hasOwn(f.records.get(listing), 'publicDirectoryPhotoKey'), false);
  assert.equal(Object.hasOwn(f.records.get(listing), 'avatarUrl'), false);
  assert.equal(f.records.has(asset), false);
  f.records.set(member, { ...f.records.get(member), role: 'MEMBER' });
  f.records.set(listing, { ...f.records.get(listing), companyName: 'After legacy merge' });
  assert.equal((await f.request(second)).status, 404);
});

test('guest renderer: automatic profile photo, retry company logo, then initials', async () => {
  const html = await readFile(new URL('../../public/business-connect.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\nloadDirectory\(\);\s*$/, '');
  let onError;
  class Img {
    constructor(logo) { this.logo = logo; this.nextElementSibling = { hidden: true }; }
    hasAttribute(name) { return name === 'data-avatar-image'; }
    getAttribute(name) { return name === 'data-avatar-logo' && this.logo; }
    removeAttribute() { this.logo = ''; }
    remove() { this.removed = true; }
  }
  const render = vm.runInNewContext(script + '\n(fields)=>renderPage(mapDoc(fields),0,1)', {
    URL, HTMLImageElement: Img, document: {
      baseURI: 'https://fixture.test/business-connect.html',
      getElementById() { return { addEventListener(name, fn, capture) {
        assert.equal(name, 'error'); assert.equal(capture, true); onError = fn;
      } }; },
    },
  });
  const fields = { ownerName: { stringValue: 'Pat Yu' }, logo: { stringValue: 'https://res.cloudinary.com/fixture/logo' },
    general: { mapValue: { fields: { avatarUrl: { stringValue: 'https://example.invalid/private.jpg' } } } } };
  const name = 'projects/demo/databases/(default)/documents/publicBusinessListings/member-a';
  const key = 'a'.repeat(32);
  const published = render({ name, fields: { ...fields, publicDirectoryPhotoKey: { stringValue: key } } });
  const automaticPath = '/public-directory-photo?mode=profile&amp;id=member-a';
  assert.ok(published.includes(automaticPath));
  const safeUrl = '/.netlify/functions/public-directory-photo?id=member-a&key=' + key;
  const publishWithUrl = url => render({ name, fields: { ...fields,
    publicDirectoryPhotoKey: { stringValue: key }, avatarUrl: { stringValue: url } } });
  assert.ok(publishWithUrl(safeUrl).includes(automaticPath));
  for (const untrusted of ['https://outside.invalid/photo.jpg', '//outside.invalid/a.jpg', safeUrl + '&q=1', '/.netlify/functions/public-directory-photo?id=member-b&key=' + key]) {
    const markup = publishWithUrl(untrusted);
    assert.doesNotMatch(markup, /outside/);
    assert.ok(markup.includes(automaticPath));
  }
  assert.match(published, /data-avatar-logo="https:\/\/res\.cloudinary\.com\/fixture\/logo"/);
  const old = render({ name, fields });
  assert.doesNotMatch(old, /private\.jpg/);
  assert.ok(old.includes(automaticPath));
  assert.match(render({ name, fields: { ...fields, logo: undefined } }), /avatar-mono" hidden>PY<\/span>/);
  const image = new Img('https://res.cloudinary.com/fixture/logo');
  onError({ target: image });
  assert.equal(image.src, 'https://res.cloudinary.com/fixture/logo');
  assert.equal(image.nextElementSibling.hidden, true);
  onError({ target: image });
  assert.equal(image.removed, true);
  assert.equal(image.nextElementSibling.hidden, false);

  // A fresh guest render and a cached/old image link are distinct checks.
  const f = fixture();
  const freshFields = () => Object.fromEntries(Object.entries(f.records.get(listing))
    .map(([field, value]) => [field, { stringValue: value }]));
  assert.equal((await f.publish()).status, 200);
  const previouslyPublishedUrl = f.link();
  assert.ok(render({ name, fields: freshFields() }).includes('/public-directory-photo?'));
  assert.equal((await f.request(previouslyPublishedUrl)).status, 200);
  assert.equal((await f.request('', { method: 'DELETE', token: owner })).status, 200);
  const freshGuestPage = render({ name, fields: freshFields() });
  assert.ok(freshGuestPage.includes(automaticPath));
  assert.ok(freshGuestPage.includes('data-avatar-logo="https://res.cloudinary.com/fixture/logo"'));
  assert.equal((await f.request(previouslyPublishedUrl)).status, 404);
});


test('legacy marker-only photo links still work; invalid public URLs fail closed', async () => {
  const f = fixture();
  await f.publish();
  const copiedUrl = f.link();
  const row = f.records.get(listing);
  f.records.set(listing, { ...row, avatarUrl: 'https://outside.invalid/unrelated-image' });
  assert.equal((await f.request(copiedUrl)).status, 404);
  const { avatarUrl, ...legacy } = row;
  f.records.set(listing, legacy);
  assert.equal((await f.request(copiedUrl)).status, 200);
});

test('profile choice uses exact approved HTTPS host without credentials, referrer or redirects', async () => {
  const controller = new AbortController();
  let count = 0;
  const source = 'https://res.cloudinary.com/fixture/photo.jpg?signature=example';
  const fetchImage = async (url, options) => {
    count++;
    assert.equal(url, source);
    assert.deepEqual(options, { signal: controller.signal, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
      redirect: 'error', cache: 'no-store' });
    return new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } });
  };
  const photo = await readOwnProfilePhoto(source, controller.signal, fetchImage);
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), jpeg);
  for (const url of ['http://res.cloudinary.com/fixture/portrait', 'https://res.cloudinary.com.evil.invalid/pic.jpg',
    'https://user:pass@res.cloudinary.com/photo.jpg', 'https://res.cloudinary.com:444/pic.jpg', 'blob:synthetic',
    'https://unapproved.example.test/x.jpg']) {
    await assert.rejects(readOwnProfilePhoto(url, controller.signal, fetchImage), /Unsupported profile photo source/);
  }
  assert.equal(count, 1);
});

test('profile choice rejects invalid MIME, stream over limit, and read/CORS failure', async () => {
  const source = 'https://res.cloudinary.com/fixture/photo.jpg';
  const signal = new AbortController().signal;
  await assert.rejects(readOwnProfilePhoto(source, signal, async () => new Response('<svg/>', {
    headers: { 'Content-Type': 'image/svg+xml' },
  })), /image/);
  await assert.rejects(readOwnProfilePhoto(source, signal, async () => new Response(jpeg, {
    headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(MAX_PHOTO_SOURCE_BYTES + 1) },
  })), /image/);
  await assert.rejects(readOwnProfilePhoto(source, signal, async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(MAX_PHOTO_SOURCE_BYTES + 1)); controller.close(); },
  }), { headers: { 'Content-Type': 'image/jpeg' } })), /size limit/);
  await assert.rejects(readOwnProfilePhoto(source, signal, async () => { throw new TypeError('CORS blocked'); }), /CORS blocked/);
});

test('consent matches the preloaded preview bytes, current profile source, and verified owner', () => {
  const source = 'https://res.cloudinary.com/fixture/profile.jpg';
  const a = { ownerId: owner, profileSource: source, jpeg: new Blob([jpeg]) };
  const b = { ownerId: owner, jpeg: new Blob(['different']) };
  const previewA = { draft: a, src: 'blob:preview-a' };
  const previewB = { draft: b, src: 'blob:preview-b' };
  assert.equal(isCurrentPhotoDraft(a, owner, source), true);
  assert.equal(isCurrentPhotoDraft(a, owner, source + '?changed'), false);
  assert.equal(isCurrentPhotoDraft(a, guest, source), false);
  assert.equal(isCurrentPhotoDraft(b, owner, source + '?changed'), true);
  assert.equal(approvedPhotoBytes(previewA, null, a), null);
  assert.equal(approvedPhotoBytes(previewB, b, a), null);
  assert.equal(approvedPhotoBytes(previewA, a, a), a.jpeg);
  assert.equal(approvedPhotoBytes(previewB, b, b), b.jpeg);
});
