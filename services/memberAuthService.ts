/** 会员登录账号（Firebase Auth）的建立与补建；调用 Netlify 函数 member-auth（uid = 会员文档 ID）。 */
import { auth } from '../config/firebase';
import { isDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';

export type MemberAuthStatus =
  | 'ready' | 'create' | 'replace_orphan'   // plan (dry run)
  | 'created' | 'replaced'                  // applied
  | 'skipped' | 'conflict' | 'error';

export interface MemberAuthResult {
  memberId: string;
  status: MemberAuthStatus;
  reason?: string;
  phoneNote?: string;
  emailSent?: boolean;
  emailError?: string;
}

export interface MemberAuthResponse {
  mode: 'create' | 'fix';
  dryRun: boolean;
  summary: Partial<Record<MemberAuthStatus, number>>;
  results: MemberAuthResult[];
  nextCursor: string | null;
}

export interface FixAuthOptions {
  dryRun: boolean;
  replaceOrphans?: boolean;
  sendSetupEmail?: boolean;
}

const ENDPOINT = '/.netlify/functions/member-auth';
const CREATE_CHUNK = 50;

export class MemberAuthService {
  private static async call(body: Record<string, unknown>): Promise<MemberAuthResponse> {
    const idToken = await auth?.currentUser?.getIdToken();
    if (!idToken) throw new Error('Not signed in');
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `member-auth failed (${res.status})`);
    }
    return res.json();
  }

  /** After a batch import: create Auth accounts for newly created member ids (ADMIN+). */
  static async createForMembers(memberIds: string[]): Promise<MemberAuthResult[]> {
    if (isDevMode()) return memberIds.map(memberId => ({ memberId, status: 'created' as const }));
    const results: MemberAuthResult[] = [];
    try {
      for (let i = 0; i < memberIds.length; i += CREATE_CHUNK) {
        const res = await this.call({ mode: 'create', memberIds: memberIds.slice(i, i + CREATE_CHUNK) });
        results.push(...res.results);
      }
      return results;
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MemberAuthService.createForMembers', additionalData: { count: memberIds.length } });
      throw error;
    }
  }

  /** SUPER_ADMIN back-fill over all member profiles, page by page. */
  static async fixAll(options: FixAuthOptions, onProgress?: (processed: number) => void): Promise<MemberAuthResponse> {
    if (isDevMode()) {
      return { mode: 'fix', dryRun: options.dryRun, summary: { ready: 1 }, results: [{ memberId: 'mock-member', status: 'ready', reason: 'dev mode' }], nextCursor: null };
    }
    const all: MemberAuthResult[] = [];
    let cursor: string | null = null;
    try {
      do {
        const page: MemberAuthResponse = await this.call({ mode: 'fix', ...options, cursor });
        all.push(...page.results);
        onProgress?.(all.length);
        cursor = page.nextCursor;
      } while (cursor);
      const summary = all.reduce<MemberAuthResponse['summary']>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
      return { mode: 'fix', dryRun: options.dryRun, summary, results: all, nextCursor: null };
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MemberAuthService.fixAll', additionalData: { dryRun: options.dryRun, processed: all.length } });
      throw error;
    }
  }
}
