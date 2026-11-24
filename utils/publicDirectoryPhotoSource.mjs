// Allowlisted profile image reader shared by the owner preview and the
// server-side public directory proxy after checking card-sharing consent.
export const MAX_PHOTO_SOURCE_BYTES = 12 * 1024 * 1024;
const profileHosts = new Set([
  'res.cloudinary.com', 'firebasestorage.googleapis.com', 'lh3.googleusercontent.com',
]);
export const isPhotoSourceType = type => ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(type);

export async function readOwnProfilePhoto(value, signal, fetchImage = fetch) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !profileHosts.has(url.hostname)) {
    throw new Error('Unsupported profile photo source.');
  }
  const response = await fetchImage(url.href, {
    signal, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
    redirect: 'error', cache: 'no-store',
  });
  const type = (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
  const size = Number(response.headers.get('content-length'));
  if (!response.ok || !response.body || !isPhotoSourceType(type) || size > MAX_PHOTO_SOURCE_BYTES) {
    await response.body?.cancel();
    throw new Error('Unable to read profile photo as an image.');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value: bytes } = await reader.read();
      if (done) break;
      total += bytes.byteLength;
      if (total > MAX_PHOTO_SOURCE_BYTES) {
        await reader.cancel();
        throw new Error('Profile photo exceeds the size limit.');
      }
      chunks.push(bytes);
    }
  } finally {
    reader.releaseLock();
  }
  if (!total) throw new Error('Empty profile photo.');
  return new Blob(chunks, { type });
}

export function isCurrentPhotoDraft(draft, ownerId, profileSource) {
  return !!draft && draft.ownerId === ownerId &&
    (draft.profileSource === undefined || draft.profileSource === profileSource);
}

export function approvedPhotoBytes(preview, readyDraft, consentedDraft) {
  return preview && preview.draft === readyDraft && preview.draft === consentedDraft
    ? preview.draft.jpeg
    : null;
}
