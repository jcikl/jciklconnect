/**
 * In-app JCI Malaysia sync (developer accounts only). Everything runs in the Netlify function jci-malaysia-sync:
 * the source key, the overrides and the run backups are Admin SDK only (firestore.rules deny all client access).
 * preview / pick / apply are not cached: each is a server-side computation over the live source and members.
 */
import { auth } from '../config/firebase';
import { isDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';
import { MembersService } from './membersService';

export type JciMalaysiaMatchBy = 'manual' | 'userId' | 'membershipNo' | 'email' | 'phone';

export interface JciMalaysiaFields {
  membershipNo: string | null;
  joinDate: string | null;
  userId: string | null;
}

export interface JciMalaysiaSyncWrite {
  memberId: string;
  name: string;
  by: JciMalaysiaMatchBy;
  chapter: string;
  before: JciMalaysiaFields;
  after: JciMalaysiaFields;
}

/** A source record as the server returns it (never an email or phone). */
export interface JciMalaysiaCandidate {
  sourceId: string;
  fullname: string;
  chapter: string;
  membershipNo: string;
  joinDate: string;
}

export interface JciMalaysiaConflict {
  memberId: string;
  name: string;
  /** A = the record found by email, B = the record found by phone. */
  candidates: { A: JciMalaysiaCandidate | null; B: JciMalaysiaCandidate | null };
}

export interface JciMalaysiaSyncCounts {
  members: number;
  byManual: number;
  byUserId: number;
  byMembershipNo: number;
  byEmail: number;
  byPhone: number;
  conflict: number;
  otherChapter: number;
  none: number;
  toWrite: number;
  unchanged: number;
}

export interface JciMalaysiaSyncPreview {
  sourceRows: number;
  counts: JciMalaysiaSyncCounts;
  writes: JciMalaysiaSyncWrite[];
  conflicts: JciMalaysiaConflict[];
  otherChapter: { memberId: string; name: string; chapter: string; by: JciMalaysiaMatchBy }[];
  notFound: { memberId: string; name: string }[];
  elapsedMs?: number;
}

export interface JciMalaysiaSyncApplyResult {
  runId: string | null;
  written: number;
  counts: JciMalaysiaSyncCounts;
  elapsedMs?: number;
}

const ENDPOINT = '/.netlify/functions/jci-malaysia-sync';

const MOCK_COUNTS: JciMalaysiaSyncCounts = {
  members: 3, byManual: 0, byUserId: 1, byMembershipNo: 0, byEmail: 1, byPhone: 0,
  conflict: 1, otherChapter: 0, none: 0, toWrite: 1, unchanged: 1,
};
const MOCK_PREVIEW: JciMalaysiaSyncPreview = {
  sourceRows: 3,
  counts: MOCK_COUNTS,
  writes: [{
    memberId: 'mock-1', name: 'Mock Member', by: 'email', chapter: 'JCI Kuala Lumpur',
    before: { membershipNo: null, joinDate: null, userId: null },
    after: { membershipNo: 'JCIKL-000-0001', joinDate: '2024-01-15', userId: '10001' },
  }],
  conflicts: [{
    memberId: 'mock-2', name: 'Mock Conflict',
    candidates: {
      A: { sourceId: '10002', fullname: 'Mock Conflict', chapter: 'JCI Kuala Lumpur', membershipNo: 'JCIKL-000-0002', joinDate: '2023-02-01' },
      B: { sourceId: '10003', fullname: 'Mock C. Other', chapter: 'JCI Kuala Lumpur', membershipNo: 'JCIKL-000-0003', joinDate: '2022-03-01' },
    },
  }],
  otherChapter: [],
  notFound: [],
};

export class JciMalaysiaSyncService {
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
        throw new Error(data?.error || `jci-malaysia-sync failed (${res.status})`);
      }
      return (await res.json()) as T;
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), {
        context: `JciMalaysiaSyncService.${context}`,
        additionalData: { action: body.action },
      });
      throw error;
    }
  }

  /** The plan: counts, changes (before/after), conflicts with candidates A/B, other chapter, not found. */
  static async preview(): Promise<JciMalaysiaSyncPreview> {
    if (isDevMode()) return MOCK_PREVIEW;
    return this.call<JciMalaysiaSyncPreview>('preview', { action: 'preview' });
  }

  /** Save a manual pick for one conflict (server validates the source record). */
  static async pick(memberId: string, sourceId: string): Promise<void> {
    if (isDevMode()) return;
    await this.call('pick', { action: 'pick', memberId, sourceId });
  }

  /** Apply: the server recomputes the plan, backs up old values, writes, audits. No plan is sent. */
  static async apply(): Promise<JciMalaysiaSyncApplyResult> {
    if (isDevMode()) return { runId: 'mock-run', written: MOCK_COUNTS.toWrite, counts: MOCK_COUNTS };
    const res = await this.call<JciMalaysiaSyncApplyResult>('apply', { action: 'apply' });
    // The server wrote member docs: drop cached member lists (all + per-LO keys).
    if (res.written > 0) MembersService.invalidateMembersCache();
    return res;
  }
}
