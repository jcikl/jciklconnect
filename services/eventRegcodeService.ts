/**
 * "My event QR": copy each member's JCI Malaysia regcode onto their own eventRegistration.
 * Everything runs in the Netlify function jci-malaysia-regcode (Admin SDK) so the source key and the
 * source project (event_participants) never reach the client.
 *   previewRegcodes / applyRegcodes — developer only (the server checks members.isDeveloper again).
 *   attachMyRegcode               — any authenticated member, their OWN registration only; best effort.
 */
import { auth } from '../config/firebase';
import { isDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';

export interface EventRegcodeCounts {
  registrations: number;
  linkable: number;
  wouldGetRegcode: number;
  conflicts: number;
  alreadySet: number;
  toWrite: number;
  noRoadmapId: number;
  eventNotInSnapshot: number;
  memberNotInList: number;
  memberMissing: number;
}

/** One proposed write, for the developer to verify before applying. */
export interface EventRegcodePreviewItem {
  member: string;
  event: string;
  regcode: string;
  by?: string;
}

export interface EventRegcodePreview {
  counts: EventRegcodeCounts;
  items?: EventRegcodePreviewItem[];
  elapsedMs?: number;
}

export interface EventRegcodeApplyResult {
  runId: string | null;
  written: number;
  counts: EventRegcodeCounts;
  elapsedMs?: number;
}

const ENDPOINT = '/.netlify/functions/jci-malaysia-regcode';

const MOCK_COUNTS: EventRegcodeCounts = {
  registrations: 4, linkable: 3, wouldGetRegcode: 2, conflicts: 1, alreadySet: 1, toWrite: 1,
  noRoadmapId: 1, eventNotInSnapshot: 0, memberNotInList: 0, memberMissing: 0,
};

export class EventRegcodeService {
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
        context: `EventRegcodeService.${context}`,
        additionalData: { action: body.action },
      });
      throw error;
    }
  }

  /** Developer only: counts + the per-registration list of proposed writes (member · event — regcode) for verification. */
  static async preview(): Promise<EventRegcodePreview> {
    if (isDevMode()) return { counts: MOCK_COUNTS, items: [{ member: 'Mock Member', event: 'Mock Event', regcode: 'ABC123', by: 'ic' }] };
    return this.call<EventRegcodePreview>('preview', { action: 'previewRegcodes' });
  }

  /** Developer only: the server recomputes the plan, backs up the ids, writes, audits. */
  static async apply(): Promise<EventRegcodeApplyResult> {
    if (isDevMode()) return { runId: 'mock-run', written: MOCK_COUNTS.toWrite, counts: MOCK_COUNTS };
    return this.call<EventRegcodeApplyResult>('apply', { action: 'applyRegcodes' });
  }

  /**
   * Best-effort: attach the caller's OWN regcode for one event after registering. Never throws — a failure
   * just leaves the regcode null. The server uses the caller's token uid, so it can only touch the caller's doc.
   */
  static async attachMine(eventId: string, memberId: string): Promise<void> {
    if (isDevMode()) return;
    // Only when registering for oneself: the endpoint operates on {eventId}_{callerUid} regardless, but
    // there is no point calling it when an admin registers someone else (that member's regcode is filled by the batch).
    if (auth?.currentUser?.uid !== memberId) return;
    try {
      await this.call('attachMine', { action: 'attachMyRegcode', eventId });
    } catch {
      /* best effort — regcode stays null */
    }
  }
}
