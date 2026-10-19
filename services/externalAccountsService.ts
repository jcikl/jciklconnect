/** External (sister-chapter) accounts: calls the Netlify function external-accounts (uid = member doc id). */
import { auth } from '../config/firebase';
import { isDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';
import { MembersService } from './membersService';
import { MemberCardsService } from './memberCardsService';
import type { AffiliationStatus } from '../types/member';

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
      MembersService.invalidateMembersCache();
      MemberCardsService.invalidateCardsCache();
      return res;
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: `ExternalAccountsService.${context}`, additionalData: extra });
      throw error;
    }
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
