/**
 * Developer-only back-fill of JCI Malaysia senator numbers onto members. Runs in the Netlify function
 * jci-malaysia-regcode (Admin SDK) so the source key never reaches the client. Board-validated numbers are
 * preserved; the write only ever touches jciCareer.senatorship.senatorNumber.
 */
import { auth } from '../config/firebase';
import { isDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';
import { MembersService } from './membersService';

export interface SenatorshipCounts {
  members: number;
  matched: number;
  wouldWrite: number;
  skippedBoardValidated: number;
  skippedNoValue: number;
  conflicts: number;
  alreadySame: number;
  unmatched: number;
}

/** One proposed write, for the developer to verify before applying. `before` = the member's current senator number. */
export interface SenatorshipPreviewItem {
  name: string;
  before: string | null;
  incoming: string;
  by?: string;
}

export interface SenatorshipPreview {
  counts: SenatorshipCounts;
  items?: SenatorshipPreviewItem[];
  elapsedMs?: number;
}

export interface SenatorshipApplyResult {
  runId: string | null;
  written: number;
  counts: SenatorshipCounts;
  elapsedMs?: number;
}

const ENDPOINT = '/.netlify/functions/jci-malaysia-regcode';

const MOCK_COUNTS: SenatorshipCounts = {
  members: 5, matched: 3, wouldWrite: 1, skippedBoardValidated: 1, skippedNoValue: 1,
  conflicts: 0, alreadySame: 0, unmatched: 2,
};

export class SenatorshipSyncService {
  private static async call<T>(context: string, body: Record<string, unknown>): Promise<T> {
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in');
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `jci-malaysia-regcode failed (${res.status})`);
      }
      return (await res.json()) as T;
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), {
        context: `SenatorshipSyncService.${context}`,
        additionalData: { action: body.action },
      });
      throw error;
    }
  }

  /** Developer only: counts + the per-member list of proposed writes (name · old → new) for verification. */
  static async preview(): Promise<SenatorshipPreview> {
    if (isDevMode()) return { counts: MOCK_COUNTS, items: [{ name: 'Mock Member', before: null, incoming: 'S-MOCK1', by: 'ic' }] };
    return this.call<SenatorshipPreview>('preview', { action: 'previewSenatorship' });
  }

  /** Developer only: recompute, back up prior numbers, write (board-validated preserved), audit. */
  static async apply(): Promise<SenatorshipApplyResult> {
    if (isDevMode()) return { runId: 'mock-run', written: MOCK_COUNTS.wouldWrite, counts: MOCK_COUNTS };
    const res = await this.call<SenatorshipApplyResult>('apply', { action: 'applySenatorship' });
    if (res.written > 0) MembersService.invalidateMembersCache();
    return res;
  }
}
