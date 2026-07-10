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
} from 'firebase/firestore';
import {
  getCurrentBoardCalendarYear,
  hasActiveBoardRecordForCurrentYear,
  isActiveBoardRecordForYear,
} from '../utils/boardMembership';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Member, UserRole, BoardPosition, BoardMember, BoardTransition, BoardTermSettings } from '../types';
import { isDevMode } from '../utils/devMode';
import { MembersService } from './membersService';
import { CommunicationService } from './communicationService';

export class BoardManagementService {
  // Get current active board members
  static async getCurrentBoardMembers(): Promise<BoardMember[]> {
    if (isDevMode()) {
      // Return mock data for development
      return [
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
      ];
    }

    try {
      const boardMembersRef = collection(db, 'boardMembers');
      const q = query(boardMembersRef, where('isActive', '==', true));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BoardMember[];
    } catch (error) {
      console.error('Error getting current board members:', error);
      throw error;
    }
  }

  // Get board members for a specific year
  static async getBoardMembersByYear(year: string): Promise<BoardMember[]> {
    try {
      const boardMembersRef = collection(db, 'boardMembers');
      const q = query(boardMembersRef, where('term', '==', year));
      const snapshot = await getDocs(q);

      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BoardMember[];

      if (docs.length === 0 && isDevMode()) {
        return [];
      }
      return docs;
    } catch (error) {
      console.error('Error getting board members by year:', error);
      if (isDevMode()) {
        return [];
      }
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
    if (isDevMode()) {
      console.log(`[Dev Mode] Would create board transition for year ${year}`);
      return {
        id: 'transition1',
        year,
        outgoingBoard,
        incomingBoard: incomingBoard as BoardMember[],
        transitionDate: new Date().toISOString(),
        completedBy,
        status: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

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

      const transitionsRef = collection(db, 'boardTransitions');
      const docRef = await addDoc(transitionsRef, transitionData);

      return {
        id: docRef.id,
        ...transitionData,
      };
    } catch (error) {
      console.error('Error creating board transition:', error);
      throw error;
    }
  }

  // Execute board transition
  static async executeBoardTransition(transitionId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would execute board transition ${transitionId}`);
      return;
    }

    try {
      // Get the transition record
      const transitionRef = doc(db, 'boardTransitions', transitionId);
      const transitionDoc = await getDoc(transitionRef);

      if (!transitionDoc.exists()) {
        throw new Error('Board transition not found');
      }

      const transition = { id: transitionDoc.id, ...transitionDoc.data() } as BoardTransition;

      // Archive outgoing board members
      for (const outgoingMember of transition.outgoingBoard) {
        await this.archiveBoardMember(outgoingMember);
      }

      // Activate incoming board members
      for (const incomingMember of transition.incomingBoard) {
        await this.activateBoardMember(incomingMember);
      }

      // Update transition status
      await updateDoc(transitionRef, {
        status: 'completed',
        updatedAt: new Date().toISOString(),
      });

      // Send notifications
      await this.sendTransitionNotifications(transition);

    } catch (error) {
      console.error('Error executing board transition:', error);
      throw error;
    }
  }

  // Archive a board member
  private static async archiveBoardMember(boardMember: BoardMember): Promise<void> {
    try {
      const boardMemberRef = doc(db, 'boardMembers', boardMember.id);
      await updateDoc(boardMemberRef, {
        isActive: false,
        endDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await MembersService.updateMember(boardMember.memberId, {
        role: UserRole.MEMBER,
      });
      await this.clearMemberCurrentBoardStatus(boardMember.memberId);
    } catch (error) {
      console.error('Error archiving board member:', error);
      throw error;
    }
  }

  // Activate a board member
  private static async activateBoardMember(boardMember: BoardMember): Promise<void> {
    try {
      const display = await this.getMemberDisplayFields(boardMember.memberId);
      const boardMemberData = {
        ...boardMember,
        ...display,
        isActive: true,
        startDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const boardMembersRef = collection(db, 'boardMembers');
      await addDoc(boardMembersRef, boardMemberData);

      const termYear = parseInt(boardMember.term, 10);
      const isCurrentTerm = termYear === getCurrentBoardCalendarYear();
      await MembersService.updateMember(boardMember.memberId, {
        role: UserRole.BOARD,
        currentBoardYear: termYear,
        currentBoardPosition: boardMember.position,
        ...(isCurrentTerm ? { isCurrentBoardMember: true } : {}),
      });
    } catch (error) {
      console.error('Error activating board member:', error);
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
      console.error('Error sending transition notifications:', error);
      throw error;
    }
  }

  // Get board transition history
  static async getBoardTransitionHistory(): Promise<BoardTransition[]> {
    if (isDevMode()) {
      return [];
    }

    try {
      const transitionsRef = collection(db, 'boardTransitions');
      const q = query(transitionsRef, orderBy('transitionDate', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BoardTransition[];
    } catch (error) {
      console.error('Error getting board transition history:', error);
      throw error;
    }
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

      const memberAny = member as any;
      const firstText = (...values: unknown[]): string | undefined => {
        const found = values.find((value) => typeof value === 'string' && value.trim().length > 0);
        return typeof found === 'string' ? found.trim() : undefined;
      };

      const display = {
        memberName: firstText(
          memberAny.general?.name,
          memberAny.general?.fullName,
          memberAny.fullName,
          memberAny.name
        ),
        avatarUrl: firstText(
          memberAny.general?.avatar,
          memberAny.general?.avatarUrl,
          memberAny.avatarUrl,
          memberAny.avatar,
          memberAny.profilePicture,
          memberAny.photoUrl
        ),
        companyName: firstText(
          memberAny.business?.companyName,
          memberAny.companyName,
          memberAny.profession,
          memberAny.business?.departmentAndPosition ?? memberAny.departmentAndPosition
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
    if (isDevMode()) {
      console.log(`[Dev Mode] Would set board for term ${year}`, assignments);
      return;
    }

    try {
      const boardMembersRef = collection(db, 'boardMembers');
      const existing = await this.getBoardMembersByYear(year);

      // Delete ALL existing records for this term (reconfiguration replaces them fully).
      // Using deleteDoc ensures superseded / erroneous assignments never surface in Career Path.
      for (const bm of existing) {
        const boardMemberRef = doc(db, 'boardMembers', bm.id);
        await deleteDoc(boardMemberRef);
      }

      const now = new Date().toISOString();
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

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

        const newMember: Omit<BoardMember, 'id'> = {
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
        await addDoc(boardMembersRef, newMember);
      }

      await this.syncMemberDocumentsForTerm(year, assignments, existing);
    } catch (error) {
      console.error('Error setting board for term:', error);
      throw error;
    }
  }

  /** Clear current-board fields on a member (used when term ends or assignment removed). */
  static async clearMemberCurrentBoardStatus(memberId: string): Promise<void> {
    if (isDevMode()) return;
    const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
    await updateDoc(memberRef, {
      currentBoardYear: deleteField(),
      currentBoardPosition: deleteField(),
      isCurrentBoardMember: false,
      isCurrentCommissionDirector: false,
      updatedAt: new Date().toISOString(),
    });
  }

  /** Clear commission director flag only (member may still be a regular member). */
  private static async clearCommissionDirectorStatus(memberId: string): Promise<void> {
    if (isDevMode()) return;
    const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
    await updateDoc(memberRef, {
      isCurrentCommissionDirector: false,
      updatedAt: new Date().toISOString(),
    });
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
      // Update board member docs
      for (const { memberId, position } of assignments) {
        if (!memberId) continue;
        await MembersService.updateMember(memberId, {
          currentBoardYear: yearNum,
          currentBoardPosition: position,
          isCurrentBoardMember: true,
          isCurrentCommissionDirector: false,
        });
      }

      // Clear docs for board members removed from this term
      const previousIds = new Set(previousBoardRecords.map((b) => b.memberId));
      for (const memberId of previousIds) {
        if (!newMemberIds.has(memberId)) {
          await this.clearMemberCurrentBoardStatus(memberId);
        }
      }

      // Sync commission director flags
      const newCommDirIds = new Set(
        assignments.flatMap((a) => a.commissionDirectorIds ?? []).filter(Boolean)
      );
      // Remove board members from comm dir set (they take precedence as board)
      for (const id of newMemberIds) newCommDirIds.delete(id);

      const prevCommDirIds = new Set(
        previousBoardRecords.flatMap((b) => (b as any).commissionDirectorIds ?? []).filter(Boolean)
      );

      for (const id of newCommDirIds) {
        await MembersService.updateMember(id, { isCurrentCommissionDirector: true });
      }
      for (const id of prevCommDirIds) {
        if (!newCommDirIds.has(id)) {
          await this.clearCommissionDirectorStatus(id);
        }
      }
      return;
    }

    // Past/future term edit: only clear stale flags pointing at this non-current year
    for (const memberId of newMemberIds) {
      const member = await MembersService.getMemberById(memberId);
      if (member?.currentBoardYear === yearNum) {
        await this.clearMemberCurrentBoardStatus(memberId);
      }
    }
  }

  /** Push current-year boardMembers assignments onto member docs (fixes legacy data). */
  static async syncCurrentYearBoardAssignees(): Promise<void> {
    if (isDevMode()) return;
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
      .map((d) => ({ id: d.id, memberId: d.id, position: '', term: year } as unknown as BoardMember));

    // Also clear ghost commission directors
    const commDirGhostSnap = await getDocs(
      query(collection(db, COLLECTIONS.MEMBERS), where('isCurrentCommissionDirector', '==', true))
    );
    const activeCommDirIds = new Set(
      active.flatMap((b) => (b as any).commissionDirectorIds ?? [])
    );
    for (const d of commDirGhostSnap.docs) {
      if (!activeCommDirIds.has(d.id)) {
        await this.clearCommissionDirectorStatus(d.id);
      }
    }

    await this.syncMemberDocumentsForTerm(
      year,
      active.map((b) => ({ memberId: b.memberId, position: b.position, commissionDirectorIds: (b as any).commissionDirectorIds })),
      [...active, ...ghostRecords]
    );
  }

  /**
   * Self-heal: if boardMembers shows an active current-year position but member doc is out of sync, fix it.
   * Returns fields to merge into in-memory member state when updated.
   */
  static async ensureMemberBoardFieldsSynced(
    member: Member
  ): Promise<Partial<Member> | null> {
    if (isDevMode()) return null;

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

  // ─── Presidential Term Settings ──────────────────────────────────────────

  static async getBoardTermSettings(year: string): Promise<BoardTermSettings | null> {
    try {
      const ref = doc(db, COLLECTIONS.BOARD_TERM_SETTINGS, year);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return { year, ...snap.data() } as BoardTermSettings;
    } catch (error) {
      console.error('Error getting board term settings:', error);
      return null;
    }
  }

  static async setBoardTermSettings(year: string, settings: Partial<Omit<BoardTermSettings, 'year' | 'updatedAt'>>): Promise<void> {
    try {
      const ref = doc(db, COLLECTIONS.BOARD_TERM_SETTINGS, year);
      // Strip undefined values — Firestore rejects them
      const clean: Record<string, unknown> = { year, updatedAt: new Date().toISOString() };
      for (const [k, v] of Object.entries(settings)) {
        if (v !== undefined) clean[k] = v;
      }
      await setDoc(ref, clean, { merge: true });
    } catch (error) {
      console.error('Error setting board term settings:', error);
      throw error;
    }
  }

  // Legacy methods for backward compatibility
  static async transitionBoardMembers(newYear: number): Promise<{
    transitioned: number;
    archived: number;
    notificationsSent: number;
  }> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would transition board members for year ${newYear}`);
      return { transitioned: 0, archived: 0, notificationsSent: 0 };
    }

    try {
      // Get all current board members
      const allMembers = await MembersService.getAllMembers();
      const currentBoardMembers = allMembers.filter(m =>
        m.role === UserRole.BOARD || m.role === UserRole.ADMIN
      );

      let transitioned = 0;
      let archived = 0;
      let notificationsSent = 0;

      for (const member of currentBoardMembers) {
        try {
          // Archive current board position
          const boardHistory = member.boardHistory || [];
          if (member.currentBoardYear && member.currentBoardPosition) {
            const archivedPosition: BoardPosition = {
              year: member.currentBoardYear,
              position: member.currentBoardPosition,
              startDate: `${member.currentBoardYear}-01-01`,
              endDate: `${member.currentBoardYear}-12-31`,
            };
            boardHistory.push(archivedPosition);
            archived++;
          }

          // Transition member role based on "one year to lead" principle
          const updatedMember: Partial<Member> = {
            boardHistory: boardHistory,
            currentBoardYear: undefined,
            currentBoardPosition: undefined,
            role: UserRole.MEMBER,
          };

          await MembersService.updateMember(member.id, updatedMember);
          transitioned++;

          // Send notification to member
          await CommunicationService.createNotification({
            memberId: member.id,
            title: `Board Term Completion - ${member.currentBoardYear || 'Previous Year'}`,
            message: `Your board term for ${member.currentBoardYear || 'the previous year'} has been completed. Thank you for your leadership! Your board position has been archived.`,
            type: 'info',
          });

          notificationsSent++;
        } catch (error) {
          console.error(`Error transitioning board member ${member.id}:`, error);
        }
      }

      console.log(`Board transition completed for year ${newYear}: ${transitioned} members transitioned, ${archived} positions archived`);

      return {
        transitioned,
        archived,
        notificationsSent,
      };
    } catch (error) {
      console.error('Error transitioning board members:', error);
      throw error;
    }
  }

  // Assign new board members for a year
  static async assignBoardMembers(
    year: number,
    assignments: Array<{ memberId: string; position: string }>
  ): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would assign board members for year ${year}`);
      return;
    }

    try {
      for (const assignment of assignments) {
        const member = await MembersService.getMemberById(assignment.memberId);
        if (!member) {
          console.warn(`Member ${assignment.memberId} not found`);
          continue;
        }

        // Update member with new board position
        const boardHistory = member.boardHistory || [];
        const newPosition: BoardPosition = {
          year,
          position: assignment.position,
          startDate: `${year}-01-01`,
          endDate: `${year}-12-31`,
        };

        await MembersService.updateMember(assignment.memberId, {
          role: UserRole.BOARD,
          currentBoardYear: year,
          currentBoardPosition: assignment.position,
          boardHistory: [...boardHistory, newPosition],
        });

        // Send notification
        await CommunicationService.createNotification({
          memberId: assignment.memberId,
          title: `Board Position Assigned - ${year}`,
          message: `Congratulations! You have been assigned to the board position: ${assignment.position} for ${year}.`,
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Error assigning board members:', error);
      throw error;
    }
  }

  // Get board composition for a specific year
  static async getBoardComposition(year: number): Promise<Member[]> {
    if (isDevMode()) {
      const allMembers = await MembersService.getAllMembers();
      return allMembers.filter(m => m.currentBoardYear === year);
    }

    try {
      const allMembers = await MembersService.getAllMembers();
      return allMembers.filter(m =>
        m.currentBoardYear === year &&
        (m.role === UserRole.BOARD || m.role === UserRole.ADMIN)
      );
    } catch (error) {
      console.error('Error getting board composition:', error);
      throw error;
    }
  }

  // Get all board positions for a specific member (queries boardMembers collection directly)
  static async getMemberBoardPositions(memberId: string): Promise<BoardMember[]> {
    if (isDevMode()) {
      return [];
    }

    try {
      const boardMembersRef = collection(db, 'boardMembers');
      const q = query(boardMembersRef, where('memberId', '==', memberId));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BoardMember[];
    } catch (error) {
      console.error('Error getting board positions for member:', error);
      return [];
    }
  }

  // Get all board records where a member serves as a Commission Director
  static async getMemberCommissionDirectorPositions(memberId: string): Promise<BoardMember[]> {
    if (isDevMode()) {
      return [];
    }

    try {
      const boardMembersRef = collection(db, 'boardMembers');
      const q = query(boardMembersRef, where('commissionDirectorIds', 'array-contains', memberId));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BoardMember[];
    } catch (error) {
      console.error('Error getting commission director positions for member:', error);
      return [];
    }
  }

  // Get board history for a member
  static async getMemberBoardHistory(memberId: string): Promise<BoardPosition[]> {
    try {
      const member = await MembersService.getMemberById(memberId);
      return member?.boardHistory || [];
    } catch (error) {
      console.error('Error getting member board history:', error);
      throw error;
    }
  }
}
