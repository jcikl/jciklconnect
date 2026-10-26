/**
 * Developer-only "Back-fill registrations from JCI Malaysia": create eventRegistrations for KL members who appear
 * in a linked JCI Malaysia event but have no local registration yet (status always 'registered'; no payment).
 *   preview — read-only counts + PII-safe detail + conflicts, on the existing jci-malaysia-regcode function.
 *   apply   — writes ~2,614 docs, so it is a Netlify BACKGROUND function (returns 202 immediately; runs in the
 *             background). The client cannot read the result (rules deny client reads of jciMalaysiaSyncRuns);
 *             it just shows "started" and the developer re-runs the preview to watch wouldCreate drop toward 0.
 * The server (both endpoints) re-checks members.isDeveloper; the source key never reaches the client.
 */
import { auth } from '../config/firebase';
import { isDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';

export interface BackfillWouldCreate {
  approved: number;
  pending: number;
  committee: number;
  trainers: number;
  total: number;
}

export interface BackfillCounts {
  linkedEvents: number;
  personsMatched: number;
  alreadyRegistered: number;
  conflicts: number;
  wouldCreate: BackfillWouldCreate;
}

export type BackfillRole = 'approved' | 'pending' | 'committee' | 'trainer';

/** One PII-safe would-create row for the developer to verify. */
export interface BackfillDetailRow {
  memberName: string | null;
  event: string;
  role: BackfillRole;
  hasRegcode: boolean;
}

/** One conflict: label is masked (regcode or short id — never email/phone). `key` is the resolutions-map key to echo back. */
export interface BackfillConflict {
  key: string;
  label: string;
  memberA: { id: string; name: string };
  memberB: { id: string; name: string };
}

export interface BackfillPreview {
  counts: BackfillCounts;
  detail: BackfillDetailRow[];
  conflicts: BackfillConflict[];
  elapsedMs?: number;
}

/** Per-conflict developer choice (client state only, not persisted). Default (absent) = skip. */
export type BackfillResolution = 'skip' | 'A' | 'B';
/** `${projectId}:${label}` -> resolution. Only 'A' / 'B' are sent; 'skip' is the default. */
export type BackfillResolutions = Record<string, BackfillResolution>;

const PREVIEW_ENDPOINT = '/.netlify/functions/jci-malaysia-regcode';
const APPLY_ENDPOINT = '/.netlify/functions/jci-malaysia-backfill-background';

const MOCK_PREVIEW: BackfillPreview = {
  counts: {
    linkedEvents: 12, personsMatched: 40, alreadyRegistered: 8, conflicts: 1,
    wouldCreate: { approved: 20, pending: 6, committee: 4, trainers: 2, total: 32 },
  },
  detail: [{ memberName: 'Mock Member', event: 'Mock Event', role: 'approved', hasRegcode: true }],
  conflicts: [{ key: 'proj-1:ABC123', label: 'ABC123', memberA: { id: 'm-a', name: 'Member A' }, memberB: { id: 'm-b', name: 'Member B' } }],
};

/** Only the resolved ('A' / 'B') entries are sent to the server; 'skip' is the default there. */
function resolvedOnly(resolutions: BackfillResolutions): Record<string, 'A' | 'B'> {
  const out: Record<string, 'A' | 'B'> = {};
  for (const [k, v] of Object.entries(resolutions)) if (v === 'A' || v === 'B') out[k] = v;
  return out;
}

export class EventRegBackfillService {
  /** Developer only: read-only counts + detail + conflicts. Comfortably under the 10s function limit. */
  static async preview(resolutions: BackfillResolutions = {}): Promise<BackfillPreview> {
    if (isDevMode()) return MOCK_PREVIEW;
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in');
      const res = await fetch(PREVIEW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ action: 'previewBackfill', resolutions: resolvedOnly(resolutions) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `back-fill preview failed (${res.status})`);
      }
      return (await res.json()) as BackfillPreview;
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), {
        context: 'EventRegBackfillService.preview',
      });
      throw error;
    }
  }

  /**
   * Developer only: fire the background apply. Returns once the server has accepted it (202). The server
   * recomputes the plan; only the resolutions map is honoured from the client. There is no result to read back —
   * the developer re-runs the preview in a minute to confirm wouldCreate dropping toward 0.
   */
  static async apply(resolutions: BackfillResolutions = {}): Promise<void> {
    if (isDevMode()) return;
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in');
      const res = await fetch(APPLY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ resolutions: resolvedOnly(resolutions) }),
      });
      // Background functions resolve to 202 Accepted; anything else is an infrastructure error.
      if (res.status !== 202 && !res.ok) throw new Error(`back-fill apply failed (${res.status})`);
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), {
        context: 'EventRegBackfillService.apply',
      });
      throw error;
    }
  }
}
