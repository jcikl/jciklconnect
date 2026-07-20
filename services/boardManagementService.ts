// Board Management Service - Handles "One Year to Lead" principle
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  orderBy,
  deleteField,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import {
  getCurrentBoardCalendarYear,
  hasActiveBoardRecordForCurrentYear,
  isActiveBoardRecordForYear,
} from '../utils/boardMembership';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Member, UserRole, BoardPosition, BoardMember, BoardTransition, BoardTermSettings } from '../types';
import { isDevMode, withDevMode } from '../utils/devMode';
import { MembersService } from './membersService';
import { CommunicationService } from './communicationService';
import { apiCache, CACHE_TTL_5MIN, CACHE_TTL_10MIN } from './cacheService';
import { logError as logServiceError } from './errorLoggingService';

const CACHE_PREFIX_BOARD_TERM = 'boardTermSettings:';
const BOARD_TERM_TTL = CACHE_TTL_10MIN;

function invalidateBoardTermCache(year: string): void {
  apiCache.delete(CACHE_PREFIX_BOARD_TERM + year);
}

export class BoardManagementService {
  // Get current active board members
  static async getCurrentBoardMembers(): Promise<BoardMember[]> {
    return withDevMode<BoardMember[]>(
      () => [
        {
          id: 'board1',
          memberId: 'member1',
          position: 'President',
          term: '2024',
          startDate: '2024-01-01',
          isActive: true,
          permissions: ['admin', 'board', 'finance'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'board2',
          memberId: 'member2',
          position: 'Vice President',
          term: '2024',
          startDate: '2024-01-01',
          isActive: true,
          permissions: ['board', 'events'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      async () => {
        try {
          const boardMembersRef = collection(db, COLLECTIONS.BOARD_MEMBERS);
          const q = query(boardMembersRef, where('isActive', '==', true));
          const snapshot = await getDocs(q);

          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as BoardMember[];
        } catch (error) {
          logServiceError(
            error instanceof Error ? error : new Error(String(error)),
            { component: 'BoardManagementService', action: 'getCurrentBoardMembers' }
          );
          throw error;
        }
      }
    );
  }

  // Get all board members across all years in a single query, then group by term in memory
  static async getAllBoardMembers(loId?: string): Promise<BoardMember[]> {
    if (isDevMode()) return [];
    const cacheKey = 'boardMembers:all:' + (loId || 'all');
    const cached = apiCache.get<BoardMember[]>(cacheKey);
    if (cached) return cached;
    try {
      const col = collection(db, COLLECTIONS.BOARD_MEMBERS);
      const q = loId ? query(col, where('loId', '==', loId)) : col;
      const snap = await getDocs(q);
      const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as BoardMember));
      apiCache.set(cacheKey, result, CACHE_TTL_5MIN);
      return result;
    } catch (error) {
      logServiceError(
        error instanceof Error ? error : new Error(String(error)),
        { component: 'BoardManagementService', action: 'getAllBoardMembers' }
      );
      throw error;
    }
  }

  // Get board members for a specific year
  static async getBoardMembersByYear(year: string): Promise<BoardMember[]> {
    if (isDevMode()) { return []; }
    try {
      const boardMembersRef = collection(db, COLLECTIONS.BOARD_MEMBERS);
      const q = query(boardMembersRef, where('term', '==', year));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BoardMember[];
    } catch (error) {
      logServiceError(
        error instanceof Error ? error : new Error(String(error)),
        { component: 'BoardManagementService', action: 'getBoardMembersByYear', additionalData: { year } }
      );
      throw error;
    }
  }

  // Create a new board transition
  static async createBoardTransition(
    year: string,
    outgoingBoard: BoardMember[],
    incomingBoard: Partial<BoardMember>[],
    completedBy: string
  ): Promise<BoardTransition> {
    return withDevMode<BoardTransition>(
      () => {
        console.log(`[Dev Mode] Would create board transition for year ${year}`);
        return {
          id: 'transition1',
          year,
          outgoingBoard,
          incomingBoard: incomingBoard as BoardMember[],
          transitionDate: new Date().toISOString(),
          completedBy,
          status: 'completed' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      },
      async () => {
        try {
          const transitionData: Omit<BoardTransition, 'id'> = {
            year,
            outgoingBoard,
            incomingBoard: incomingBoard as BoardMember[],
            transitionDate: new Date().toISOString(),
            completedBy,
            status: 'in_progress',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const transitionsRef = collection(db, COLLECTIONS.BOARD_TRANSITIONS);
          const docRef = await addDoc(transitionsRef, transitionData);

          return {
            id: docRef.id,
            ...transitionData,
          };
        } catch (error) {
          logServiceError(
            error instanceof Error ? error : new Error(String(error)),
            { component: 'BoardManagementService', action: 'createBoardTransition' }
          );
          throw error;
        }
      }
    );
  }

  // Execute board transition
  static async executeBoardTransition(transitionId: string): Promise<void> {
    return withDevMode(
      () => { console.log(`[Dev Mode] Would execute board transition ${transitionId}`); },
      async () => {
        try {
          const transitionRef = doc(db, COLLECTIONS.BOARD_TRANSITIONS, transitionId);

          // P1 fix: idempotency guard — atomically claim this execution by setting
          // status='completed' inside a runTransaction. A second concurrent call will
          // see status='completed' and exit early, preventing duplicate boardMember records.
          let shouldProceed = false;
          const nowForGuard = new Date().toISOString();
          await runTransaction(db, async (txn) => {
            const freshSnap = await txn.get(transitionRef);
            if (!freshSnap.exists()) throw new Error('Board transition not found');
            if (freshSnap.data()?.status === 'completed') {
              return; // Already completed — idempotent exit
            }
            txn.update(transitionRef, { status: 'completed', completedAt: nowForGuard });
            shouldProceed = true;
          });
          if (!shouldProceed) return;

          // Get the transition record (re-read for full data after guard)
          const transitionDoc = await getDoc(transitionRef);

          if (!transitionDoc.exists()) {
            throw new Error('Board transition not found');
          }

          const transition = { id: transitionDoc.id, ...transitionDoc.data() } as BoardTransition;

          // --- Phase 1: gather display fields for incoming members (reads only) ---
          const incomingDisplayFields = await Promise.all(
            transition.incomingBoard.map((m) => this.getMemberDisplayFields(m.memberId))
          );

          // --- Phase 2: build a single writeBatch for all boardMembers writes + transition status ---
          const batch = writeBatch(db);
          const now = new Date().toISOString();

          // Archive outgoing boardMembers docs
          for (const outgoingMember of transition.outgoingBoard) {
            const boardMemberRef = doc(db, COLLECTIONS.BOARD_MEMBERS, outgoingMember.id);
            batch.update(boardMemberRef, {
              isActive: false,
              endDate: now,
              updatedAt: now,
            });
          }

          // Activate incoming boardMembers docs (add new docs via batch.set)
          const incomingNewRefs = transition.incomingBoard.map((incomingMember, i) => {
            const display = incomingDisplayFields[i];
            const termYear = parseInt(incomingMember.term, 10);
            const isCurrentTerm = termYear === getCurrentBoardCalendarYear();
            const boardMemberData = {
              ...incomingMember,
              ...display,
              isActive: true,
              startDate: now,
              createdAt: now,
              updatedAt: now,
              ...(isCurrentTerm ? { isCurrentBoardMember: true } : {}),
            };
            const newRef = doc(collection(db, COLLECTIONS.BOARD_MEMBERS));
            batch.set(newRef, boardMemberData);
            return { ref: newRef, incomingMember };
          });
          void incomingNewRefs; // refs used only to register in batch

          // Mark transition complete in the same batch
          batch.update(transitionRef, {
            status: 'completed',
            updatedAt: now,
          });

          // --- Phase 3: member role updates — added to the same batch so boardMembers and members stay in sync ---
          for (const m of transition.outgoingBoard) {
            batch.update(doc(db, COLLECTIONS.MEMBERS, m.memberId), {
              role: UserRole.MEMBER,
              currentBoardYear: deleteField(),
              currentBoardPosition: deleteField(),
              isCurrentBoardMember: false,
              isCurrentCommissionDirector: false,
              updatedAt: now,
            });
          }
          for (const m of transition.incomingBoard) {
            const termYear = parseInt(m.term, 10);
            const isCurrentTerm = termYear === getCurrentBoardCalendarYear();
            batch.update(doc(db, COLLECTIONS.MEMBERS, m.memberId), {
              role: UserRole.BOARD,
              currentBoardYear: termYear,
              currentBoardPosition: m.position,
              updatedAt: now,
              ...(isCurrentTerm ? { isCurrentBoardMember: true } : {}),
            });
          }

          await batch.commit();
          MembersService.invalidateMembersCache();
          // Fix 12 (P2): invalidate getAllBoardMembers cache after transition writes
          apiCache.deleteByPrefix('boardMembers:');

          // --- Phase 4: notifications (best-effort, non-atomic) ---
          await this.sendTransitionNotifications(transition);

        } catch (error) {
          logServiceError(
            error instanceof Error ? error : new Error(String(error)),
            { component: 'BoardManagementService', action: 'executeBoardTransition', additionalData: { transitionId } }
          );
          throw error;
        }
      }
    );
  }

  // Archive a board member (kept for standalone use outside executeBoardTransition)
  private static async archiveBoardMember(boardMember: BoardMember): Promise<void> {
    try {
      const now = new Date().toISOString();
      const boardMemberRef = doc(db, COLLECTIONS.BOARD_MEMBERS, boardMember.id);
      const memberRef = doc(db, COLLECTIONS.MEMBERS, boardMember.memberId);

      // Fix 10 (P1): consolidate three sequential writes into one atomic writeBatch so
      // partial failure cannot leave boardMembers and member role in an inconsistent state.
      const archiveBatch = writeBatch(db);
      archiveBatch.update(boardMemberRef, {
        isActive: false,
        endDate: now,
        updatedAt: now,
      });
      archiveBatch.update(memberRef, {
        role: UserRole.MEMBER,
        currentBoardYear: deleteField(),
        currentBoardPosition: deleteField(),
        isCurrentBoardMember: false,
        isCurrentCommissionDirector: false,
        updatedAt: now,
      });
      await archiveBatch.commit();
      MembersService.invalidateMembersCache();

      // Best-effort notification — must not roll back the already-committed updates
      try {
        await CommunicationService.createNotification({
          memberId: boardMember.memberId,
          title: 'Board Term Ended',
          message: `Your board term as ${boardMember.position} has ended. Thank you for your service!`,
          type: 'info',
        });
      } catch (notifErr) {
        logServiceError(notifErr instanceof Error ? notifErr : new Error(String(notifErr)), { component: 'BoardManagementService', action: 'archiveBoardMember' });
      }
    } catch (error) {
      logServiceError(
        error instanceof Error ? error : new Error(String(error)),
        { component: 'BoardManagementService', action: 'archiveBoardMember', additionalData: { boardMemberId: boardMember.id } }
      );
      throw error;
    }
  }

  // Activate a board member (kept for standalone use outside executeBoardTransition)
  private static async activateBoardMember(boardMember: BoardMember): Promise<void> {
    try {
      const display = await this.getMemberDisplayFields(boardMember.memberId);
      const now = new Date().toISOString();
      const boardMemberData = {
        ...boardMember,
        ...display,
        isActive: true,
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      const termYear = parseInt(boardMember.term, 10);
      const isCurrentTerm = termYear === getCurrentBoardCalendarYear();

      // Atomic: boardMembers record + member role update in a single batch
      const batch = writeBatch(db);
      const newBoardMemberRef = doc(collection(db, COLLECTIONS.BOARD_MEMBERS));
      batch.set(newBoardMemberRef, boardMemberData);
      batch.update(doc(db, COLLECTIONS.MEMBERS, boardMember.memberId), {
        role: UserRole.BOARD,
        currentBoardYear: termYear,
        currentBoardPosition: boardMember.position,
        updatedAt: now,
        ...(isCurrentTerm ? { isCurrentBoardMember: true } : {}),
      });
      await batch.commit();
      MembersService.invalidateMembersCache();

      // Best-effort notification — must not roll back the committed batch
      try {
        await CommunicationService.createNotification({
          memberId: boardMember.memberId,
          title: 'Board Position Assigned',
          message: `You have been assigned the board position of ${boardMember.position} for ${boardMember.term}.`,
          type: 'success',
        });
      } catch (notifErr) {
        logServiceError(notifErr instanceof Error ? notifErr : new Error(String(notifErr)), { component: 'BoardManagementService', action: 'activateBoardMember' });
      }
    } catch (error) {
      logServiceError(
        error instanceof Error ? error : new Error(String(error)),
        { component: 'BoardManagementService', action: 'activateBoardMember', additionalData: { boardMemberId: boardMember.id } }
      );
      throw error;
    }
  }

  // Send transition notifications
  private static async sendTransitionNotifications(transition: BoardTransition): Promise<void> {
    try {
      // Notify outgoing board members
      for (const outgoingMember of transition.outgoingBoard) {
        await CommunicationService.createNotification({
          memberId: outgoingMember.memberId,
          title: `Board Term Completion - ${transition.year}`,
          message: `Your board term as ${outgoingMember.position} for ${transition.year} has been completed. Thank you for your leadership!`,
          type: 'info',
        });
      }

      // Notify incoming board members
      for (const incomingMember of transition.incomingBoard) {
        await CommunicationService.createNotification({
          memberId: incomingMember.memberId,
          title: `Board Position Assigned - ${transition.year}`,
          message: `Congratulations! You have been assigned to the board position: ${incomingMember.position} for ${transition.year}.`,
          type: 'success',
        });
      }
    } catch (error) {
      // Fix 8 (P1): intentionally do not rethrow — notification failure must not roll back
      // a board transition that has already committed to Firestore.
      logServiceError(
        error instanceof Error ? error : new Error(String(error)),
        { component: 'BoardManagementService', action: 'sendTransitionNotifications' }
      );
    }
  }

  // Get board transition history
  static async getBoardTransitionHistory(): Promise<BoardTransition[]> {
    return withDevMode(
      () => [],
      async () => {
        try {
          const transitionsRef = collection(db, COLLECTIONS.BOARD_TRANSITIONS);
          const q = query(transitionsRef, orderBy('transitionDate', 'desc'));
          const snapshot = await getDocs(q);

          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as BoardTransition[];
        } catch (error) {
          logServiceError(
            error instanceof Error ? error : new Error(String(error)),
            { component: 'BoardManagementService', action: 'getBoardTransitionHistory' }
          );
          throw error;
        }
      }
    );
  }

  // Get role-based permissions
  static getRolePermissions(position: string): string[] {
    const permissionMap: Record<string, string[]> = {
      'President': ['admin', 'board', 'finance', 'events', 'projects', 'members'],
      'General Legal Council': ['board', 'members'],
      'Secretary': ['board', 'events', 'members'],
      'Treasurer': ['board', 'finance'],
      'Vice President': ['board', 'events', 'projects', 'members'],
      'Director': ['board', 'projects'],
      'Committee Chair': ['board', 'events'],

    };

    return permissionMap[position] || ['board'];
  }

  private static async getMemberDisplayFields(memberId: string): Promise<{
    memberName?: string;
    avatarUrl?: string;
    companyName?: string;
  }> {
    try {
      const member = await MembersService.getMemberById(memberId);
      if (!member) return {};

      const firstText = (...values: unknown[]): string | undefined => {
        const found = values.find((value) => typeof value === 'string' && value.trim().length > 0);
        return typeof found === 'string' ? found.trim() : undefined;
      };

      const display = {
        memberName: firstText(
          member.general?.name,
          member.general?.fullName,
          member.fullName,
          member.name
        ),
        avatarUrl: firstText(
          member.general?.avatar,
          member.general?.avatarUrl,
          member.avatarUrl,
          member.avatar,
          member.profilePicture,
          member.photoUrl
        ),
        companyName: firstText(
          member.business?.companyName,
          member.companyName,
          member.business?.position,
          member.business?.departmentAndPosition ?? member.departmentAndPosition
        ),
      };

      return Object.fromEntries(
        Object.entries(display).filter(([, value]) => value !== undefined)
      );
    } catch {
      return {};
    }
  }

  /** Default board positions for each term (can be used by UI for dropdowns) */
  static getDefaultBoardPositions(): string[] {
    return [
      'President',
      'Immediate Past President',
      'General Legal Council',
      'Secretary',
      'Honorary Treasurer',
      'Executive Vice President',
      'Vice President (Individual)',
      'Vice President (Business)',
      'Vice President (Community)',
      'Vice President (International Affairs)',
      'Vice President (LOM)',
      'Area Officer',
      'National Officer',
      'JCI Officer'
    ];
  }

  /**
   * Set board of directors for a given term (year).
   * Deactivates existing board members for that term and creates new records for the assignments.
   */
  static async setBoardForTerm(
    year: string,
    assignments: Array<{
      memberId: string;
      position: string;
      commissionDirectorIds?: string[];
      boardAvatarUrl?: string;
      commissionDirectorAvatars?: Record<string, string>;
    }>,
    updatedBy?: string
  ): Promise<void> {
    return withDevMode(
      () => { if (isDevMode()) { console.log(`[Dev Mode] Would set board for term ${year}`, assignments); } },
      async () => {
        try {
          const boardMembersRef = collection(db, COLLECTIONS.BOARD_MEMBERS);
      const existing = await this.getBoardMembersByYear(year);

      const now = new Date().toISOString();
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Build all boardMember payloads first (requires async display-field fetches),
      // then write them atomically so the boardMembers doc and member.role always
      // land together (SYNC-005: addDoc cannot join a batch).
      const boardMemberEntries: Array<{ newRef: ReturnType<typeof doc>; data: Omit<BoardMember, 'id'>; memberId: string }> = [];
      for (const { memberId, position, commissionDirectorIds, boardAvatarUrl, commissionDirectorAvatars } of assignments) {
        if (!memberId || !position) continue;

        const permissions = this.getRolePermissions(position);
        const display = await this.getMemberDisplayFields(memberId);

        // Denormalize commission director names for guest page display
        const commissionDirectorNames: Record<string, string> = {};
        for (const dirId of (commissionDirectorIds || [])) {
          const dirDisplay = await this.getMemberDisplayFields(dirId);
          if (dirDisplay.memberName) commissionDirectorNames[dirId] = dirDisplay.memberName;
        }

        const newMemberData: Omit<BoardMember, 'id'> = {
          memberId,
          position,
          term: year,
          startDate,
          endDate,
          isActive: true,
          permissions,
          commissionDirectorIds: commissionDirectorIds || [],
          commissionDirectorAvatars: commissionDirectorAvatars || {},
          commissionDirectorNames,
          ...display,
          ...(boardAvatarUrl ? { boardAvatarUrl } : {}),
          createdAt: now,
          updatedAt: now,
        };
        boardMemberEntries.push({ newRef: doc(boardMembersRef), data: newMemberData, memberId });
      }

      // Single atomic batch: delete existing + boardMembers creation + member.role elevation
      const boardBatch = writeBatch(db);
      // Delete ALL existing records for this term atomically so superseded assignments never surface
      for (const bm of existing) {
        boardBatch.delete(doc(db, COLLECTIONS.BOARD_MEMBERS, bm.id));
      }
      for (const { newRef, data, memberId } of boardMemberEntries) {
        boardBatch.set(newRef, data);
        boardBatch.update(doc(db, COLLECTIONS.MEMBERS, memberId), {
          role: UserRole.BOARD,
          updatedAt: now,
        });
      }

      // P1 Fix: Inline the syncMemberDocumentsForTerm current-term field updates directly
      // into the boardBatch so that boardMembers creation and member.currentBoard* fields
      // land atomically — no window between two separate commits where reads see stale data.
      const yearNum = parseInt(year, 10);
      const isCurrentTerm = yearNum === getCurrentBoardCalendarYear();
      if (isCurrentTerm) {
        const newMemberIds = new Set<string>(
          assignments.map(a => a.memberId).filter((id): id is string => Boolean(id))
        );
        for (const { memberId, position } of assignments) {
          if (!memberId) continue;
          boardBatch.update(doc(db, COLLECTIONS.MEMBERS, memberId), {
            currentBoardYear: yearNum,
            currentBoardPosition: position,
            isCurrentBoardMember: true,
            isCurrentCommissionDirector: false,
            updatedAt: now,
          });
        }
        // Clear currentBoard* fields on members removed from this term
        for (const bm of existing) {
          if (bm.memberId && !newMemberIds.has(bm.memberId)) {
            boardBatch.update(doc(db, COLLECTIONS.MEMBERS, bm.memberId), {
              currentBoardYear: deleteField(),
              currentBoardPosition: deleteField(),
              isCurrentBoardMember: false,
              isCurrentCommissionDirector: false,
              updatedAt: now,
            });
          }
        }
        // Sync commission director flags
        const newCommDirIds = new Set<string>(
          (assignments.flatMap(a => a.commissionDirectorIds ?? []).filter(Boolean)) as string[]
        );
        for (const id of newMemberIds) newCommDirIds.delete(id);
        for (const id of newCommDirIds) {
          boardBatch.update(doc(db, COLLECTIONS.MEMBERS, id), {
            isCurrentCommissionDirector: true,
            updatedAt: now,
          });
        }
      }

      await boardBatch.commit();
      MembersService.invalidateMembersCache();
      apiCache.deleteByPrefix('boardMembers:');
        } catch (error) {
          logServiceError(
            error instanceof Error ? error : new Error(String(error)),
            { component: 'BoardManagementService', action: 'setBoardForTerm', additionalData: { year } }
          );
          throw error;
        }
      }
    );
  }

  /** Clear current-board fields on a member (used when term ends or assignment removed). */
  static async clearMemberCurrentBoardStatus(memberId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
        await updateDoc(memberRef, {
          currentBoardYear: deleteField(),
          currentBoardPosition: deleteField(),
          isCurrentBoardMember: false,
          isCurrentCommissionDirector: false,
          updatedAt: new Date().toISOString(),
        });
        MembersService.invalidateMembersCache();
      }
    );
  }

  /** Clear commission director flag only (member may still be a regular member). */
  private static async clearCommissionDirectorStatus(memberId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
        await updateDoc(memberRef, {
          isCurrentCommissionDirector: false,
          updatedAt: new Date().toISOString(),
        });
        MembersService.invalidateMembersCache();
      }
    );
  }

  /**
   * Keep members/{id} in sync with boardMembers so usePermissions and Firestore rules grant board access.
   */
  private static async syncMemberDocumentsForTerm(
    year: string,
    assignments: Array<{ memberId: string; position: string; commissionDirectorIds?: string[] }>,
    previousBoardRecords: BoardMember[]
  ): Promise<void> {
    const yearNum = parseInt(year, 10);
    const currentYear = getCurrentBoardCalendarYear();
    const isCurrentTerm = yearNum === currentYear;
    const newMemberIds = new Set(
      assignments.map((a) => a.memberId).filter((id): id is string => Boolean(id))
    );

    if (isCurrentTerm) {
      const now = new Date().toISOString();
      const batch = writeBatch(db);

      // Update board member docs
      for (const { memberId, position } of assignments) {
        if (!memberId) continue;
        batch.update(doc(db, COLLECTIONS.MEMBERS, memberId), {
          currentBoardYear: yearNum,
          currentBoardPosition: position,
          isCurrentBoardMember: true,
          isCurrentCommissionDirector: false,
          updatedAt: now,
        });
      }

      // Clear docs for board members removed from this term
      const previousIds = new Set(previousBoardRecords.map((b) => b.memberId));
      for (const memberId of previousIds) {
        if (!newMemberIds.has(memberId)) {
          batch.update(doc(db, COLLECTIONS.MEMBERS, memberId), {
            currentBoardYear: deleteField(),
            currentBoardPosition: deleteField(),
            isCurrentBoardMember: false,
            isCurrentCommissionDirector: false,
            updatedAt: now,
          });
        }
      }

      // Sync commission director flags
      const newCommDirIds = new Set(
        assignments.flatMap((a) => a.commissionDirectorIds ?? []).filter(Boolean)
      );
      // Remove board members from comm dir set (they take precedence as board)
      for (const id of newMemberIds) newCommDirIds.delete(id);

      const prevCommDirIds = new Set(
        previousBoardRecords.flatMap((b) => b.commissionDirectorIds ?? []).filter(Boolean)
      );

      for (const id of newCommDirIds) {
        batch.update(doc(db, COLLECTIONS.MEMBERS, id), {
          isCurrentCommissionDirector: true,
          updatedAt: now,
        });
      }
      for (const id of prevCommDirIds) {
        if (!newCommDirIds.has(id)) {
          batch.update(doc(db, COLLECTIONS.MEMBERS, id), {
            isCurrentCommissionDirector: false,
            updatedAt: now,
          });
        }
      }

      await batch.commit();
      MembersService.invalidateMembersCache();
      return;
    }

    // Past/future term edit: only clear stale flags pointing at this non-current year
    const clearBatch = writeBatch(db);
    let hasClearUpdates = false;
    const clearNow = new Date().toISOString();
    for (const memberId of newMemberIds) {
      const member = await MembersService.getMemberById(memberId);
      if (member?.currentBoardYear === yearNum) {
        clearBatch.update(doc(db, COLLECTIONS.MEMBERS, memberId), {
          currentBoardYear: deleteField(),
          currentBoardPosition: deleteField(),
          isCurrentBoardMember: false,
          isCurrentCommissionDirector: false,
          updatedAt: clearNow,
        });
        hasClearUpdates = true;
      }
    }
    if (hasClearUpdates) {
      await clearBatch.commit();
      MembersService.invalidateMembersCache();
    }
  }

  /** Push current-year boardMembers assignments onto member docs (fixes legacy data). */
  static async syncCurrentYearBoardAssignees(): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        const year = String(getCurrentBoardCalendarYear());
        const board = await this.getBoardMembersByYear(year);
        const active = board.filter((b) => b.isActive !== false);
        const activeMemberIds = new Set(active.map((b) => b.memberId));

        // Build previousBoardRecords from ALL members currently flagged as board,
        // so the clear path fires for ghost records with no active boardMembers doc.
        const ghostSnap = await getDocs(
          query(collection(db, COLLECTIONS.MEMBERS), where('isCurrentBoardMember', '==', true))
        );
        const ghostRecords: BoardMember[] = ghostSnap.docs
          .filter((d) => !activeMemberIds.has(d.id))
          .map((d): BoardMember => ({
            id: d.id,
            memberId: d.id,
            position: 'Member',
            term: year,
            startDate: '',
            isActive: false,
            permissions: [],
            createdAt: '',
            updatedAt: '',
          }));

        // Also clear ghost commission directors
        const commDirGhostSnap = await getDocs(
          query(collection(db, COLLECTIONS.MEMBERS), where('isCurrentCommissionDirector', '==', true))
        );
        const activeCommDirIds = new Set(
          active.flatMap((b) => b.commissionDirectorIds ?? [])
        );
        const ghostCommDirBatch = writeBatch(db);
        let hasGhostCommDirUpdates = false;
        const ghostNow = new Date().toISOString();
        for (const d of commDirGhostSnap.docs) {
          if (!activeCommDirIds.has(d.id)) {
            ghostCommDirBatch.update(doc(db, COLLECTIONS.MEMBERS, d.id), {
              isCurrentCommissionDirector: false,
              updatedAt: ghostNow,
            });
            hasGhostCommDirUpdates = true;
          }
        }
        if (hasGhostCommDirUpdates) {
          await ghostCommDirBatch.commit();
          MembersService.invalidateMembersCache();
        }

        await this.syncMemberDocumentsForTerm(
          year,
          active.map((b) => ({ memberId: b.memberId, position: b.position, commissionDirectorIds: b.commissionDirectorIds })),
          [...active, ...ghostRecords]
        );
      }
    );
  }

  /**
   * Self-heal: if boardMembers shows an active current-year position but member doc is out of sync, fix it.
   * Returns fields to merge into in-memory member state when updated.
   */
  static async ensureMemberBoardFieldsSynced(
    member: Member
  ): Promise<Partial<Member> | null> {
    return withDevMode(
      () => null,
      async () => {
        const currentYear = getCurrentBoardCalendarYear();
        const records = await this.getMemberBoardPositions(member.id);
        const activeRecord = records.find((r) => isActiveBoardRecordForYear(r, currentYear));

        const shouldBeOnBoard = !!activeRecord;
        const flaggedOnBoard =
          member.isCurrentBoardMember === true || member.currentBoardYear === currentYear;

        if (shouldBeOnBoard) {
          const needsUpdate =
            !flaggedOnBoard ||
            member.currentBoardPosition !== activeRecord.position ||
            member.currentBoardYear !== currentYear;

          if (!needsUpdate) return null;

          const updates: Partial<Member> = {
            currentBoardYear: currentYear,
            currentBoardPosition: activeRecord.position,
            isCurrentBoardMember: true,
          };
          await MembersService.updateMember(member.id, updates);
          return updates;
        }

        if (flaggedOnBoard && !hasActiveBoardRecordForCurrentYear(records)) {
          await this.clearMemberCurrentBoardStatus(member.id);
          return {
            currentBoardYear: undefined,
            currentBoardPosition: undefined,
            isCurrentBoardMember: false,
          };
        }

        return null;
      }
    );
  }

  // ─── Presidential Term Settings ──────────────────────────────────────────

  static async getBoardTermSettings(year: string): Promise<BoardTermSettings | null> {
    if (isDevMode()) return null;
    return apiCache.getOrSet<BoardTermSettings | null>(
      CACHE_PREFIX_BOARD_TERM + year,
      async () => {
        try {
          const ref = doc(db, COLLECTIONS.BOARD_TERM_SETTINGS, year);
          const snap = await getDoc(ref);
          if (!snap.exists()) return null;
          return { year, ...snap.data() } as BoardTermSettings;
        } catch (error) {
          logServiceError(
            error instanceof Error ? error : new Error(String(error)),
            { component: 'BoardManagementService', action: 'getBoardTermSettings', additionalData: { year } }
          );
          return null;
        }
      },
      BOARD_TERM_TTL,
      'getBoardTermSettings'
    );
  }

  static async setBoardTermSettings(year: string, settings: Partial<Omit<BoardTermSettings, 'year' | 'updatedAt'>>): Promise<void> {
    if (isDevMode()) return;
    try {
      const ref = doc(db, COLLECTIONS.BOARD_TERM_SETTINGS, year);
      // Strip undefined values — Firestore rejects them
      const clean: Record<string, unknown> = { year, updatedAt: new Date().toISOString() };
      for (const [k, v] of Object.entries(settings)) {
        if (v !== undefined) clean[k] = v;
      }
      await setDoc(ref, clean, { merge: true });
      invalidateBoardTermCache(year);
    } catch (error) {
      logServiceError(
        error instanceof Error ? error : new Error(String(error)),
        { component: 'BoardManagementService', action: 'setBoardTermSettings', additionalData: { year } }
      );
      throw error;
    }
  }

  // Legacy methods for backward compatibility
  static async transitionBoardMembers(newYear: number): Promise<{
    transitioned: number;
    archived: number;
    notificationsSent: number;
  }> {
    return withDevMode(
      () => {
        if (isDevMode()) { console.log(`[Dev Mode] Would transition board members for year ${newYear}`); }
        return { transitioned: 0, archived: 0, notificationsSent: 0 };
      },
      async () => {
        try {
          // Get all current board members
          const allMembers = await MembersService.getAllMembers();
          const currentBoardMembers = allMembers.filter(m =>
            m.role === UserRole.BOARD || m.role === UserRole.ADMIN
          );

          let transitioned = 0;
          let archived = 0;
          let notificationsSent = 0;

          // Collect all member updates then apply atomically via writeBatch
          const transitionBatch = writeBatch(db);
          const notificationPayloads: Array<Parameters<typeof CommunicationService.createNotification>[0]> = [];
          const now = Timestamp.now();

          for (const member of currentBoardMembers) {
            try {
              const boardHistory = [...(member.boardHistory || [])];
              if (member.currentBoardYear && member.currentBoardPosition) {
                const archivedPosition: BoardPosition = {
                  year: member.currentBoardYear,
                  role: member.currentBoardPosition,
                  position: member.currentBoardPosition,
                  startDate: `${member.currentBoardYear}-01-01`,
                  endDate: `${member.currentBoardYear}-12-31`,
                };
                boardHistory.push(archivedPosition);
                archived++;
              }

              transitionBatch.update(doc(db, COLLECTIONS.MEMBERS, member.id), {
                boardHistory,
                currentBoardYear: deleteField(),
                currentBoardPosition: deleteField(),
                role: UserRole.MEMBER,
                updatedAt: now,
              });
              transitioned++;

              notificationPayloads.push({
                memberId: member.id,
                title: `Board Term Completion - ${member.currentBoardYear || 'Previous Year'}`,
                message: `Your board term for ${member.currentBoardYear || 'the previous year'} has been completed. Thank you for your leadership! Your board position has been archived.`,
                type: 'info',
              });
            } catch (error) {
              logServiceError(
                error instanceof Error ? error : new Error(String(error)),
                { component: 'BoardManagementService', action: 'transitionBoardMembers', additionalData: { memberId: member.id, newYear } }
              );
            }
          }

          await transitionBatch.commit();
          MembersService.invalidateMembersCache();

          // Best-effort notifications — failures do not undo the committed transition
          const notifResults = await Promise.allSettled(
            notificationPayloads.map(p => CommunicationService.createNotification(p))
          );
          notifResults.forEach((r, i) => {
            if (r.status === 'fulfilled') {
              notificationsSent++;
            } else {
              logServiceError(r.reason instanceof Error ? r.reason : new Error(String(r.reason)), { component: 'BoardManagementService', action: 'transitionBoardMembers', additionalData: { memberId: notificationPayloads[i].memberId } });
            }
          });

          if (isDevMode()) { console.log(`Board transition completed for year ${newYear}: ${transitioned} members transitioned, ${archived} positions archived`); }

          return {
            transitioned,
            archived,
            notificationsSent,
          };
        } catch (error) {
          logServiceError(
            error instanceof Error ? error : new Error(String(error)),
            { component: 'BoardManagementService', action: 'transitionBoardMembers', additionalData: { newYear } }
          );
          throw error;
        }
      }
    );
  }

  // Assign new board members for a year
  static async assignBoardMembers(
    year: number,
    assignments: Array<{ memberId: string; position: string }>
  ): Promise<void> {
    return withDevMode(
      () => { if (isDevMode()) { console.log(`[Dev Mode] Would assign board members for year ${year}`); } },
      async () => {
        try {
          const assignBatch = writeBatch(db);
          const notificationPayloads: Array<Parameters<typeof CommunicationService.createNotification>[0]> = [];
          const now = Timestamp.now();

          for (const assignment of assignments) {
            const member = await MembersService.getMemberById(assignment.memberId);
            if (!member) {
              if (isDevMode()) { console.warn(`Member ${assignment.memberId} not found`); }
              continue;
            }

            const boardHistory = [...(member.boardHistory || [])];
            const newPosition: BoardPosition = {
              year,
              role: assignment.position,
              position: assignment.position,
              startDate: `${year}-01-01`,
              endDate: `${year}-12-31`,
            };
            boardHistory.push(newPosition);

            assignBatch.update(doc(db, COLLECTIONS.MEMBERS, assignment.memberId), {
              role: UserRole.BOARD,
              currentBoardYear: year,
              currentBoardPosition: assignment.position,
              boardHistory,
              updatedAt: now,
            });

            notificationPayloads.push({
              memberId: assignment.memberId,
              title: `Board Position Assigned - ${year}`,
              message: `Congratulations! You have been assigned to the board position: ${assignment.position} for ${year}.`,
              type: 'success',
            });
          }

          await assignBatch.commit();
          MembersService.invalidateMembersCache();
          // Fix 12 (P2): invalidate getAllBoardMembers cache after assignment writes
          apiCache.deleteByPrefix('boardMembers:');

          // Best-effort notifications
          await Promise.allSettled(
            notificationPayloads.map(p => CommunicationService.createNotification(p))
          );
        } catch (error) {
          logServiceError(
            error instanceof Error ? error : new Error(String(error)),
            { component: 'BoardManagementService', action: 'assignBoardMembers', additionalData: { year } }
          );
          throw error;
        }
      }
    );
  }

  // Get board composition for a specific year
  static async getBoardComposition(year: number): Promise<Member[]> {
    return withDevMode(
      async () => {
        const allMembers = await MembersService.getAllMembers();
        return allMembers.filter(m => m.currentBoardYear === year);
      },
      async () => {
        try {
          const allMembers = await MembersService.getAllMembers();
          return allMembers.filter(m =>
            m.currentBoardYear === year &&
            (m.role === UserRole.BOARD || m.role === UserRole.ADMIN)
          );
        } catch (error) {
          logServiceError(
            error instanceof Error ? error : new Error(String(error)),
            { component: 'BoardManagementService', action: 'getBoardComposition', additionalData: { year } }
          );
          throw error;
        }
      }
    );
  }

  // Get all board positions for a specific member (queries boardMembers collection directly)
  static async getMemberBoardPositions(memberId: string): Promise<BoardMember[]> {
    return withDevMode(
      () => [],
      async () => {
        try {
          const boardMembersRef = collection(db, COLLECTIONS.BOARD_MEMBERS);
          const q = query(boardMembersRef, where('memberId', '==', memberId));
          const snapshot = await getDocs(q);

          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as BoardMember[];
        } catch (error) {
          logServiceError(
            error instanceof Error ? error : new Error(String(error)),
            { component: 'BoardManagementService', action: 'getMemberBoardPositions', additionalData: { memberId } }
          );
          return [];
        }
      }
    );
  }

  // Get all board records where a member serves as a Commission Director
  static async getMemberCommissionDirectorPositions(memberId: string): Promise<BoardMember[]> {
    return withDevMode(
      () => [],
      async () => {
        try {
          const boardMembersRef = collection(db, COLLECTIONS.BOARD_MEMBERS);
          const q = query(boardMembersRef, where('commissionDirectorIds', 'array-contains', memberId));
          const snapshot = await getDocs(q);

          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as BoardMember[];
        } catch (error) {
          logServiceError(
            error instanceof Error ? error : new Error(String(error)),
            { component: 'BoardManagementService', action: 'getMemberCommissionDirectorPositions', additionalData: { memberId } }
          );
          return [];
        }
      }
    );
  }

  // Get board history for a member
  static async getMemberBoardHistory(memberId: string): Promise<BoardPosition[]> {
    try {
      const member = await MembersService.getMemberById(memberId);
      return member?.boardHistory || [];
    } catch (error) {
      logServiceError(
        error instanceof Error ? error : new Error(String(error)),
        { component: 'BoardManagementService', action: 'getMemberBoardHistory', additionalData: { memberId } }
      );
      throw error;
    }
  }
}
