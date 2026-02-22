// Board Management Service - Handles "One Year to Lead" principle
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Member, UserRole, BoardPosition, BoardMember, BoardTransition } from '../types';
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
    if (isDevMode()) {
      return [];
    }

    try {
      const boardMembersRef = collection(db, 'boardMembers');
      const q = query(boardMembersRef, where('term', '==', year));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BoardMember[];
    } catch (error) {
      console.error('Error getting board members by year:', error);
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

      // Update member role to regular member
      await MembersService.updateMember(boardMember.memberId, {
        role: UserRole.MEMBER,
        currentBoardYear: undefined,
        currentBoardPosition: undefined,
      });
    } catch (error) {
      console.error('Error archiving board member:', error);
      throw error;
    }
  }

  // Activate a board member
  private static async activateBoardMember(boardMember: BoardMember): Promise<void> {
    try {
      const boardMemberData = {
        ...boardMember,
        isActive: true,
        startDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const boardMembersRef = collection(db, 'boardMembers');
      await addDoc(boardMembersRef, boardMemberData);

      // Update member role to board member
      await MembersService.updateMember(boardMember.memberId, {
        role: UserRole.BOARD,
        currentBoardYear: parseInt(boardMember.term),
        currentBoardPosition: boardMember.position,
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
      'Vice President': ['board', 'events', 'projects', 'members'],
      'Secretary': ['board', 'events', 'members'],
      'Treasurer': ['board', 'finance'],
      'Director': ['board', 'projects'],
      'Committee Chair': ['board', 'events'],
    };

    return permissionMap[position] || ['board'];
  }

  /** Default board positions for each term (can be used by UI for dropdowns) */
  static getDefaultBoardPositions(): string[] {
    return [
      'President',
      'Immediate Past President',
      'Secretary',
      'Honorary Treasurer',
      'Executive Vice President',
      'Vice President (Individual)',
      'Vice President (Business)',
      'Vice President (Community)',
      'Vice President (International Affairs)',
      'Vice President (LOM)'
    ];
  }

  /**
   * Set board of directors for a given term (year).
   * Deactivates existing board members for that term and creates new records for the assignments.
   */
  static async setBoardForTerm(
    year: string,
    assignments: Array<{ memberId: string; position: string; commissionDirectorIds?: string[] }>,
    updatedBy?: string
  ): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would set board for term ${year}`, assignments);
      return;
    }

    try {
      const boardMembersRef = collection(db, 'boardMembers');
      const existing = await this.getBoardMembersByYear(year);

      // Deactivate existing board members for this term
      for (const bm of existing) {
        if (bm.isActive) {
          const boardMemberRef = doc(db, 'boardMembers', bm.id);
          await updateDoc(boardMemberRef, {
            isActive: false,
            endDate: new Date().toISOString().slice(0, 10),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      const now = new Date().toISOString();
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      for (const { memberId, position, commissionDirectorIds } of assignments) {
        if (!memberId || !position) continue;

        const permissions = this.getRolePermissions(position);
        const newMember: Omit<BoardMember, 'id'> = {
          memberId,
          position,
          term: year,
          startDate,
          endDate,
          isActive: true,
          permissions,
          commissionDirectorIds: commissionDirectorIds || [],
          createdAt: now,
          updatedAt: now,
        };
        await addDoc(boardMembersRef, newMember);
      }
    } catch (error) {
      console.error('Error setting board for term:', error);
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

