// Points Service - Point management and gamification engine
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, POINT_CATEGORIES, MEMBER_TIERS } from '../config/constants';
import { Member, MemberTier } from '../types';
import { isDevMode } from '../utils/devMode';
import { MembersService } from './membersService';

export interface PointTransaction {
  id?: string;
  memberId: string;
  points: number; // Alias for amount for backward compatibility
  amount?: number; // Preferred field name
  category: string;
  description: string;
  sourceId?: string; // ID of the source (event, task, etc.) - backward compatibility
  relatedEntityId?: string; // Preferred field name
  sourceType?: string; // Type of source (event, task, role, etc.) - backward compatibility
  relatedEntityType?: string; // Preferred field name
  createdAt: string | Date | Timestamp;
  expiresAt?: Date | Timestamp;
  metadata?: Record<string, any>;
}

export interface PointRule {
  id?: string;
  category: string;
  name: string;
  basePoints: number;
  multiplier?: number; // For weighted rules
  conditions?: Record<string, any>; // Additional conditions
  active: boolean;
  priority?: number; // Higher priority rules are evaluated first
  createdAt?: string | Date | Timestamp;
  updatedAt?: string | Date | Timestamp;
}

export class PointsService {
  // Award points to a member
  static async awardPoints(
    memberId: string,
    pointsOrCategory: number | string,
    categoryOrAmount?: string | number,
    description?: string,
    sourceIdOrRelatedEntityId?: string,
    sourceTypeOrRelatedEntityType?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    // Support both old and new signatures for backward compatibility
    let points: number;
    let category: string;
    let desc: string;
    let relatedEntityId: string | undefined;
    let relatedEntityType: string | undefined;

    if (typeof pointsOrCategory === 'number') {
      // Old signature: awardPoints(memberId, points, category, description, sourceId?, sourceType?, metadata?)
      points = pointsOrCategory;
      category = categoryOrAmount as string;
      desc = description || '';
      relatedEntityId = sourceIdOrRelatedEntityId;
      relatedEntityType = sourceTypeOrRelatedEntityType;
    } else {
      // New signature: awardPoints(memberId, category, amount, description, relatedEntityId?, relatedEntityType?)
      category = pointsOrCategory;
      points = categoryOrAmount as number;
      desc = description || '';
      relatedEntityId = sourceIdOrRelatedEntityId;
      relatedEntityType = sourceTypeOrRelatedEntityType;
    }

    if (isDevMode()) {
      console.log(`[DEV MODE] Awarding ${points} points to member ${memberId} for ${category}`);
      return `mock-point-transaction-${Date.now()}`;
    }

    try {
      // Create point transaction - filter out undefined values
      const transaction: Omit<PointTransaction, 'id'> = {
        memberId,
        points, // For backward compatibility
        amount: points, // Preferred field
        category,
        description: desc,
        ...(relatedEntityId && { 
          sourceId: relatedEntityId, // Backward compatibility
          relatedEntityId 
        }),
        ...(relatedEntityType && { 
          sourceType: relatedEntityType, // Backward compatibility
          relatedEntityType 
        }),
        ...(metadata && { metadata }),
        createdAt: Timestamp.now(),
      };

      const transactionRef = await addDoc(
        collection(db, COLLECTIONS.POINTS),
        transaction
      );

      // Update member's total points
      await this.updateMemberPoints(memberId, points);

      return transactionRef.id;
    } catch (error) {
      console.error('Error awarding points:', error);
      throw error;
    }
  }

  // Award points for event attendance
  static async awardEventAttendancePoints(
    memberId: string,
    eventId: string,
    eventType: string,
    duration?: number
  ): Promise<string> {
    // Get point rule for event attendance
    const rule = await this.getPointRule(POINT_CATEGORIES.EVENT_ATTENDANCE);
    
    let points = rule?.basePoints || 10; // Default points if no rule found

    // Apply multipliers based on event type and rule
    if (rule?.multiplier) {
      if (eventType === 'Training') {
        points = Math.floor(points * rule.multiplier);
      } else if (eventType === 'International') {
        points = Math.floor(points * (rule.multiplier * 1.5));
      }
    } else {
      // Fallback to hardcoded values if no rule
      switch (eventType) {
        case 'Training':
          points = 20;
          break;
        case 'International':
          points = 30;
          break;
        case 'Project':
          points = 15;
          break;
        case 'Social':
          points = 10;
          break;
        case 'Meeting':
          points = 5;
          break;
      }
    }

    // Apply duration multiplier if provided
    if (duration) {
      const hours = duration / 60; // Convert minutes to hours
      points = Math.round(points * Math.max(1, hours));
    }

    return this.awardPoints(
      memberId,
      points,
      POINT_CATEGORIES.EVENT_ATTENDANCE,
      `Attended ${eventType} event`,
      eventId,
      'event'
    );
  }

  // Award points for task completion
  static async awardTaskCompletionPoints(
    memberId: string,
    projectId: string,
    taskId: string,
    priority: 'Low' | 'Medium' | 'High' | 'Urgent' = 'Medium'
  ): Promise<string> {
    // Get point rule for task completion
    const rule = await this.getPointRule(POINT_CATEGORIES.PROJECT_TASK);
    
    let points = rule?.basePoints || 10; // Default points if no rule found

    // Apply priority multiplier
    const priorityMultipliers: Record<string, number> = { 
      Urgent: 2.0, 
      High: 1.5, 
      Medium: 1.0, 
      Low: 0.5 
    };
    
    if (rule?.multiplier) {
      points = Math.floor(points * rule.multiplier * (priorityMultipliers[priority] || 1.0));
    } else {
      // Fallback to hardcoded values if no rule
      switch (priority) {
        case 'Urgent':
          points = 25;
          break;
        case 'High':
          points = 20;
          break;
        case 'Medium':
          points = 15;
          break;
        case 'Low':
          points = 10;
          break;
      }
    }

    return this.awardPoints(
      memberId,
      points,
      POINT_CATEGORIES.PROJECT_TASK,
      `Completed ${priority} priority task`,
      taskId,
      'task',
      { projectId, priority }
    );
  }

  // Get member's point history
  static async getMemberPointHistory(
    memberId: string,
    daysOrLimit?: number,
    limitCount?: number
  ): Promise<PointTransaction[]> {
    if (isDevMode()) {
      // Return mock data
      return [
        {
          id: 'mock-1',
          memberId,
          points: 20,
          amount: 20,
          category: POINT_CATEGORIES.EVENT_ATTENDANCE,
          description: 'Attended Training event',
          sourceId: 'event-1',
          relatedEntityId: 'event-1',
          sourceType: 'event',
          relatedEntityType: 'event',
          createdAt: new Date().toISOString(),
        },
      ];
    }

    try {
      // Support both days (old) and limit (new) parameters
      const limitValue = limitCount || (daysOrLimit && daysOrLimit > 100 ? daysOrLimit : undefined);
      const days = daysOrLimit && daysOrLimit <= 100 ? daysOrLimit : undefined;

      let q;
      if (days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        q = query(
          collection(db, COLLECTIONS.POINTS),
          where('memberId', '==', memberId),
          where('createdAt', '>=', Timestamp.fromDate(cutoffDate)),
          orderBy('createdAt', 'desc')
        );
        if (limitValue) {
          q = query(q, limit(limitValue));
        }
      } else {
        q = query(
          collection(db, COLLECTIONS.POINTS),
          where('memberId', '==', memberId),
          orderBy('createdAt', 'desc')
        );
        if (limitValue) {
          q = query(q, limit(limitValue));
        }
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data() as any;
        const createdAt = data.createdAt?.toDate?.() || data.createdAt;
        const expiresAt = data.expiresAt?.toDate?.();
        
        return {
          id: doc.id,
          memberId: data.memberId,
          category: data.category,
          description: data.description,
          points: data.points || data.amount || 0, // Support both field names
          amount: data.amount || data.points || 0,
          sourceId: data.sourceId || data.relatedEntityId,
          relatedEntityId: data.relatedEntityId || data.sourceId,
          sourceType: data.sourceType || data.relatedEntityType,
          relatedEntityType: data.relatedEntityType || data.sourceType,
          createdAt: createdAt instanceof Date ? createdAt.toISOString() : (typeof createdAt === 'string' ? createdAt : new Date().toISOString()),
          expiresAt,
          metadata: data.metadata,
        } as PointTransaction;
      });
    } catch (error) {
      console.error('Error fetching point history:', error);
      throw error;
    }
  }

  // Get member's total points
  static async getMemberPoints(memberId: string): Promise<PointTransaction[]> {
    return this.getMemberPointHistory(memberId);
  }

  // Get leaderboard with visibility filtering
  static async getLeaderboard(
    limitCount: number = 10,
    visibility: 'public' | 'members_only' | 'private' = 'public',
    requestingMemberId?: string
  ): Promise<Member[]> {
    if (isDevMode()) {
      const members = await MembersService.getAllMembers();
      return members
        .filter(m => {
          if (visibility === 'private') {
            return requestingMemberId ? m.id === requestingMemberId : false;
          }
          if (visibility === 'members_only') {
            return m.leaderboardVisibility === 'members_only' || m.leaderboardVisibility === 'public';
          }
          return m.leaderboardVisibility === 'public' || !m.leaderboardVisibility;
        })
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, limitCount);
    }

    try {
      let q = query(
        collection(db, COLLECTIONS.MEMBERS),
        orderBy('points', 'desc'),
        limit(limitCount)
      );

      // Apply visibility filter
      if (visibility === 'private') {
        // Only show requesting member's own rank
        if (requestingMemberId) {
          q = query(
            collection(db, COLLECTIONS.MEMBERS),
            where('id', '==', requestingMemberId),
            orderBy('points', 'desc')
          );
        } else {
          return [];
        }
      } else if (visibility === 'members_only') {
        // Only show members who opted in to leaderboard
        q = query(
          collection(db, COLLECTIONS.MEMBERS),
          where('leaderboardVisibility', 'in', ['public', 'members_only']),
          orderBy('points', 'desc'),
          limit(limitCount)
        );
      }
      // 'public' - show all members (no filter)

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Member));
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  }

  // Update member's total points
  static async updateMemberPoints(memberId: string, pointsDelta: number): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Updating points for member ${memberId} by ${pointsDelta}`);
      return;
    }

    try {
      const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
      const memberDoc = await getDoc(memberRef);

      if (!memberDoc.exists()) {
        throw new Error('Member not found');
      }

      const currentPoints = memberDoc.data().points || 0;
      const newPoints = currentPoints + pointsDelta;

      // Update points and tier
      const tier = this.calculateTier(newPoints);

      await updateDoc(memberRef, {
        points: newPoints,
        tier,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating member points:', error);
      throw error;
    }
  }

  // Calculate member tier based on points
  static calculateTier(points: number): MemberTier {
    if (points >= MEMBER_TIERS.PLATINUM.minPoints) {
      return MemberTier.PLATINUM;
    } else if (points >= MEMBER_TIERS.GOLD.minPoints) {
      return MemberTier.GOLD;
    } else if (points >= MEMBER_TIERS.SILVER.minPoints) {
      return MemberTier.SILVER;
    } else {
      return MemberTier.BRONZE;
    }
  }

  // Update leaderboard visibility
  static async updateLeaderboardVisibility(
    memberId: string,
    visibility: 'public' | 'members_only' | 'private'
  ): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Updating leaderboard visibility for member ${memberId} to ${visibility}`);
      return;
    }

    try {
      const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
      await updateDoc(memberRef, {
        leaderboardVisibility: visibility,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating leaderboard visibility:', error);
      throw error;
    }
  }

  // Get point rule for a specific category
  static async getPointRule(category: string): Promise<PointRule | null> {
    if (isDevMode()) {
      return {
        id: 'rule-1',
        category: POINT_CATEGORIES.EVENT_ATTENDANCE,
        name: 'Event Attendance',
        basePoints: 10,
        active: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    try {
      const q = query(
        collection(db, COLLECTIONS.POINT_RULES),
        where('category', '==', category),
        where('active', '==', true),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
      } as PointRule;
    } catch (error) {
      console.error('Error fetching point rule:', error);
      throw error;
    }
  }

  // Get all point rules
  static async getPointRules(includeInactive: boolean = false): Promise<PointRule[]> {
    if (isDevMode()) {
      return [
        {
          id: 'rule-1',
          category: POINT_CATEGORIES.EVENT_ATTENDANCE,
          name: 'Event Attendance',
          basePoints: 10,
          active: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }

    try {
      let q;
      if (includeInactive) {
        q = query(
          collection(db, COLLECTIONS.POINT_RULES),
          orderBy('category')
        );
      } else {
        q = query(
          collection(db, COLLECTIONS.POINT_RULES),
          where('active', '==', true),
          orderBy('category')
        );
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          category: data.category,
          name: data.name,
          basePoints: data.basePoints,
          multiplier: data.multiplier,
          conditions: data.conditions,
          active: data.active,
          priority: data.priority,
          createdAt: (data.createdAt as Timestamp)?.toDate?.() || data.createdAt || new Date(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate?.() || data.updatedAt || new Date(),
        } as PointRule;
      });
    } catch (error) {
      console.error('Error fetching all point rules:', error);
      throw error;
    }
  }

  // Alias for backward compatibility
  static async getAllPointRules(includeInactive: boolean = false): Promise<PointRule[]> {
    return this.getPointRules(includeInactive);
  }

  // Create or update point rule
  static async savePointRule(rule: Partial<PointRule> | Omit<PointRule, 'id'> | PointRule): Promise<string> {
    if (isDevMode()) {
      console.log('[DEV MODE] Saving point rule:', rule);
      return `mock-rule-${Date.now()}`;
    }

    try {
      const ruleId = 'id' in rule ? rule.id : undefined;
      if (ruleId) {
        // Update existing rule
        const ruleRef = doc(db, COLLECTIONS.POINT_RULES, ruleId);
        await updateDoc(ruleRef, {
          ...rule,
          updatedAt: Timestamp.now(),
        });
        return ruleId;
      } else {
        // Create new rule
        const newRule = {
          ...rule,
          active: rule.active ?? true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        const docRef = await addDoc(collection(db, COLLECTIONS.POINT_RULES), newRule);
        return docRef.id;
      }
    } catch (error) {
      console.error('Error saving point rule:', error);
      throw error;
    }
  }

  // Delete point rule
  static async deletePointRule(ruleId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Deleting point rule ${ruleId}`);
      return;
    }

    try {
      const ruleRef = doc(db, COLLECTIONS.POINT_RULES, ruleId);
      await updateDoc(ruleRef, {
        active: false,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error deleting point rule:', error);
      throw error;
    }
  }

  // Get points summary for a member
  static async getMemberPointsSummary(memberId: string): Promise<{
    totalPoints: number;
    tier: MemberTier;
    pointsByCategory: Record<string, number>;
    recentTransactions: PointTransaction[];
  }> {
    const history = await this.getMemberPointHistory(memberId);
    const totalPoints = history.reduce((sum, t) => sum + t.points, 0);
    const tier = this.calculateTier(totalPoints);

    // Group points by category
    const pointsByCategory: Record<string, number> = {};
    history.forEach(transaction => {
      pointsByCategory[transaction.category] = 
        (pointsByCategory[transaction.category] || 0) + transaction.points;
    });

    return {
      totalPoints,
      tier,
      pointsByCategory,
      recentTransactions: history.slice(0, 10),
    };
  }
}

