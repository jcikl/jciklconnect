/**
 * Run `read`; if Firestore answers permission-denied, refresh the auth credential and try again.
 * On a page reload Firebase Auth can report the restored user before Firestore attaches the ID
 * token, so the member's read of their own profile is sometimes rejected as unauthenticated —
 * which used to sign the member out. A genuinely forbidden read still fails after the retries.
 */
export async function retryOnPermissionDenied<T>(
  read: () => Promise<T>,
  refreshCredential: () => Promise<unknown>,
  { retries = 2, delayMs = 300 }: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (err) {
      if ((err as { code?: string } | null)?.code !== 'permission-denied' || attempt >= retries) throw err;
      await refreshCredential().catch(() => undefined);
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
}
