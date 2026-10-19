/**
 * External (sister-chapter) accounts. Writes go through the Netlify function external-accounts
 * (uid = member doc id); reads (chapter roster, KL approval queue) are plain Firestore queries the rules allow:
 * an active CHAPTER_ADMIN lists where('loId','==',own chapter); KL admins list anything.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';
import { apiCache, CACHE_TTL_3MIN } from './cacheService';
import { MembersService } from './membersService';
import { MemberCardsService } from './memberCardsService';
import type { Member } from '../types';
import type { AffiliationStatus } from '../types/member';

const CACHE_PREFIX = 'externalAccounts:';
const CACHE_KEY_CHAPTER = (loId: string) => `${CACHE_PREFIX}chapter:${loId}`;
const CACHE_KEY_PENDING_KL = `${CACHE_PREFIX}pendingKl`;

const byName = (a: Member, b: Member) => (a.general?.name ?? '').localeCompare(b.general?.name ?? '');

export interface ExternalInvitee {
  name: string;
  email: string;
  /** Optional, 'YYYY-MM-DD'. */
  dob?: string;
}

export type ExternalCreateStatus = 'created' | 'skipped' | 'error';

export interface ExternalCreateResult {
  /** Position in the submitted list (responses never contain emails). */
  index: number;
  memberId?: string;
  status: ExternalCreateStatus;
  reason?: string;
  emailSent?: boolean;
}

export interface ExternalCreateResponse {
  action: 'createChapterAdmin' | 'inviteMember';
  loId: string;
  summary: Partial<Record<ExternalCreateStatus, number>>;
  results: ExternalCreateResult[];
}

const ENDPOINT = '/.netlify/functions/external-accounts';

export class ExternalAccountsService {
  private static async call<T>(body: Record<string, unknown>): Promise<T> {
    const idToken = await auth?.currentUser?.getIdToken();
    if (!idToken) throw new Error('Not signed in');
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `external-accounts failed (${res.status})`);
    }
    return res.json();
  }

  private static mockCreate(action: ExternalCreateResponse['action'], loId: string, members: ExternalInvitee[]): ExternalCreateResponse {
    return {
      action, loId, summary: { created: members.length },
      results: members.map((_, index) => ({ index, memberId: `mock-external-${Date.now()}-${index}`, status: 'created' as const, emailSent: true })),
    };
  }

  private static async run<T>(context: string, body: Record<string, unknown>, extra: Record<string, unknown>): Promise<T> {
    try {
      const res = await this.call<T>(body);
      // Server wrote member docs / cards: drop cached member lists (all + per-LO keys).
      this.invalidateCache();
      return res;
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: `ExternalAccountsService.${context}`, additionalData: extra });
      throw error;
    }
  }

  /** Server wrote member docs / cards: drop cached member lists (all + per-LO keys), cards, and our own lists. */
  static invalidateCache(): void {
    MembersService.invalidateMembersCache();
    MemberCardsService.invalidateCardsCache();
    apiCache.deleteByPrefix(CACHE_PREFIX);
  }

  /**
   * All member docs of one chapter (any status), sorted by name. No orderBy: self-registered docs carry no
   * updatedAt, which an orderBy('updatedAt') query would silently drop.
   */
  static async getChapterMembers(loId: string): Promise<Member[]> {
    if (isDevMode()) return [];
    return apiCache.getOrSet(CACHE_KEY_CHAPTER(loId), async () => {
      try {
        const snap = await getDocs(query(collection(db, COLLECTIONS.MEMBERS), where('loId', '==', loId)));
        return snap.docs.map(d => ({ ...(d.data() as Omit<Member, 'id'>), id: d.id } as Member)).sort(byName);
      } catch (error) {
        errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ExternalAccountsService.getChapterMembers', additionalData: { loId } });
        throw error;
      }
    }, CACHE_TTL_3MIN, 'externalAccountsService.getChapterMembers');
  }

  /** KL admins: external members waiting for KL approval (affiliation.status == 'pending_kl'), all chapters. */
  static async getPendingKlApprovals(): Promise<Member[]> {
    if (isDevMode()) return [];
    return apiCache.getOrSet(CACHE_KEY_PENDING_KL, async () => {
      try {
        const snap = await getDocs(query(collection(db, COLLECTIONS.MEMBERS), where('affiliation.status', '==', 'pending_kl')));
        return snap.docs.map(d => ({ ...(d.data() as Omit<Member, 'id'>), id: d.id } as Member)).sort(byName);
      } catch (error) {
        errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ExternalAccountsService.getPendingKlApprovals' });
        throw error;
      }
    }, CACHE_TTL_3MIN, 'externalAccountsService.getPendingKlApprovals');
  }

  /** KL ADMIN / SUPER_ADMIN: create CHAPTER_ADMIN accounts for a sister chapter (1–20 per call). */
  static async createChapterAdmins(loId: string, members: ExternalInvitee[]): Promise<ExternalCreateResponse> {
    if (isDevMode()) return this.mockCreate('createChapterAdmin', loId, members);
    return this.run('createChapterAdmins', { action: 'createChapterAdmin', loId, members }, { loId, count: members.length });
  }

  /**
   * Invite AFFILIATE members (active immediately). A chapter admin's own chapter is enforced by the
   * server (loId ignored); a KL admin must pass loId.
   */
  static async inviteMembers(members: ExternalInvitee[], loId?: string): Promise<ExternalCreateResponse> {
    if (isDevMode()) return this.mockCreate('inviteMember', loId ?? 'mock-chapter', members);
    return this.run('inviteMembers', { action: 'inviteMember', loId, members }, { loId: loId ?? null, count: members.length });
  }

  /** Change an external member's affiliation status (server checks the transition table and syncs the card). */
  static async setStatus(memberId: string, status: AffiliationStatus): Promise<void> {
    if (isDevMode()) return;
    await this.run('setStatus', { action: 'setStatus', memberId, status }, { memberId, status });
  }

  /** Send the password setup email again. Returns whether the email was sent. */
  static async resendInvite(memberId: string): Promise<boolean> {
    if (isDevMode()) return true;
    const res = await this.run<{ emailSent: boolean }>('resendInvite', { action: 'resendInvite', memberId }, { memberId });
    return res.emailSent;
  }
}
