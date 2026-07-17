// Points Service - Point management and gamification engine
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, POINT_CATEGORIES, MEMBER_TIERS } from '../config/constants';
import { Member, MemberTier, IncentiveProgram, IncentiveStandard, IncentiveSubmission, LOStarProgress, RadarPointsConfig } from '../types';
import { isDevMode, withDevMode } from '../utils/devMode';
import { MembersService } from './membersService';
import { apiCache } from './cacheService';

// --- Cache key prefixes ---
const CACHE_PREFIX_POINTS = 'points:';
// NOTE: prefix intentionally matches PointsRuleService ('pointsRules:') so both services
// share the same cache namespace and invalidation clears both caches simultaneously.
const CACHE_PREFIX_POINT_RULES = 'pointsRules:';
const CACHE_PREFIX_INCENTIVE = 'incentive:';

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

    if (!Number.isFinite(points) || points <= 0) {
      throw new Error('Points must be a positive finite number');
    }

    return withDevMode(
      () => {
        console.log(`[DEV MODE] Awarding ${points} points to member ${memberId} for ${category}`);
        return `mock-point-transaction-${Date.now()}`;
      },
      async () => {
        try {
          // Create point transaction - filter out undefined values
          // Note: expiresAt is defined in types but not enforced; metadata is stored but not read.
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

          // Generate a new document ID so we can use writeBatch (setDoc requires an ID)
          const pointsDocRef = doc(collection(db, COLLECTIONS.POINTS));
          const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);

          // Verify member exists before committing
          const memberSnap = await getDoc(memberRef);
          if (!memberSnap.exists()) {
            throw new Error('Member not found');
          }

          // Derive new tier from the current points + delta
          const currentPoints = memberSnap.data().points || 0;
          const newPoints = currentPoints + points;
          const tier = PointsService.calculateTier(newPoints);

          // Atomic batch: create points record + update member totals in one commit
          const batch = writeBatch(db);
          batch.set(pointsDocRef, transaction);
          batch.update(memberRef, {
            points: newPoints,
            tier,
            updatedAt: Timestamp.now(),
          });
          await batch.commit();

          // Invalidate caches after write
          PointsService.invalidatePointsCache();
          MembersService.invalidateMembersCache();

          return pointsDocRef.id;
        } catch (error) {
          console.error('Error awarding points:', error);
          throw error;
        }
      }
    );
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

    if (rule && rule.basePoints === undefined) {
      console.warn('[pointsService] Rule missing basePoints field — schema mismatch with PointsRuleService?', rule);
    }
    let points = rule?.basePoints ?? 10; // Default 10 when no rule or basePoints absent

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

    if (rule && rule.basePoints === undefined) {
      console.warn('[pointsService] Rule missing basePoints field — schema mismatch with PointsRuleService?', rule);
    }
    let points = rule?.basePoints ?? 10; // Default 10 when no rule or basePoints absent

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
    return withDevMode<PointTransaction[]>(
      () => [
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
      ],
      async () => {
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
    );
  }

  // Get member's total points
  static async getMemberPoints(memberId: string): Promise<PointTransaction[]> {
    return this.getMemberPointHistory(memberId);
  }

  // Get leaderboard with visibility filtering and year filtering
  static async getLeaderboard(
    limitCount: number = 10,
    visibility: 'public' | 'members_only' | 'private' = 'public',
    requestingMemberId?: string,
    year?: number
  ): Promise<Member[]> {
    if (isDevMode() && year) {
      try {
        const members = await MembersService.getAllMembers();
        return members
          .filter(m => {
            if (visibility === 'private') {
              return requestingMemberId ? m.id === requestingMemberId : false;
            }
            if (visibility === 'members_only') {
              const lbVis = m.jciCareer?.leaderboardVisibility ?? m.leaderboardVisibility;
              return lbVis === 'members_only' || lbVis === 'public';
            }
            return (m.jciCareer?.leaderboardVisibility ?? m.leaderboardVisibility) !== 'private';
          })
          .map(m => {
            let hash = 0;
            for (let i = 0; i < m.id.length; i++) {
              hash = m.id.charCodeAt(i) + ((hash << 5) - hash);
            }
            const seed = Math.abs(hash + year) % 100;
            const mockPoints = seed * 15 + 50;
            return {
              ...m,
              points: mockPoints
            };
          })
          .sort((a, b) => (b.points || 0) - (a.points || 0))
          .slice(0, limitCount);
      } catch (error) {
        console.error('Error fetching mock leaderboard:', error);
        throw error;
      }
    }

    try {
      const memberPointsMap: Record<string, number> = {};
      if (year) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);
        // TODO PERF12: Replace with query on members collection sorted by member.points aggregate field.
        // Current approach scans points collection which is unbounded — rankings become wrong above 500 records.
        const q = query(
          collection(db, COLLECTIONS.POINTS),
          where('createdAt', '>=', Timestamp.fromDate(startDate)),
          where('createdAt', '<=', Timestamp.fromDate(endDate)),
          limit(500)
        );
        const snapshot = await getDocs(q);
        if (snapshot.docs.length >= 500) {
          console.warn('[pointsService] Leaderboard query hit 500 cap — rankings may be incomplete. TODO: use member.points aggregate field instead.');
        }
        snapshot.forEach(doc => {
          const data = doc.data();
          const memberId = data.memberId;
          const pts = data.points || data.amount || 0;
          memberPointsMap[memberId] = (memberPointsMap[memberId] || 0) + pts;
        });
      }

      const members = await MembersService.getAllMembers();
      return members
        .filter(m => {
          if (visibility === 'private') {
            return requestingMemberId ? m.id === requestingMemberId : false;
          }
          if (visibility === 'members_only') {
            const lbVis = m.jciCareer?.leaderboardVisibility ?? m.leaderboardVisibility;
            return lbVis === 'members_only' || lbVis === 'public';
          }
          // For public view, display anyone unless they explicitly opted out to 'private'
          return (m.jciCareer?.leaderboardVisibility ?? m.leaderboardVisibility) !== 'private';
        })
        .map(m => {
          if (year) {
            return {
              ...m,
              points: memberPointsMap[m.id] || 0
            };
          }
          return m;
        })
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, limitCount);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  }

  // Update member's total points
  static async updateMemberPoints(memberId: string, pointsDelta: number): Promise<void> {
    return withDevMode(
      () => {
        console.log(`[DEV MODE] Updating points for member ${memberId} by ${pointsDelta}`);
      },
      async () => {
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

          // Invalidate members cache after write (both flat and role-grouped cache keys)
          MembersService.invalidateMembersCache();
          apiCache.deleteByPrefix('members:byRole:');
          PointsService.invalidatePointsCache();
        } catch (error) {
          console.error('Error updating member points:', error);
          throw error;
        }
      }
    );
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

  /** Invalidate all points transaction caches */
  static invalidatePointsCache(): void {
    apiCache.deleteByPrefix(CACHE_PREFIX_POINTS);
  }

  /** Invalidate all point rules caches.
   *  Uses prefix 'pointsRules:' — same prefix as PointsRuleService — so one call clears both. */
  static invalidatePointRulesCache(): void {
    apiCache.deleteByPrefix(CACHE_PREFIX_POINT_RULES); // clears 'pointsRules:*'
  }

  /** Invalidate all incentive program / standard / submission caches */
  static invalidateIncentiveCache(): void {
    apiCache.deleteByPrefix(CACHE_PREFIX_INCENTIVE);
  }

  // Update leaderboard visibility
  static async updateLeaderboardVisibility(
    memberId: string,
    visibility: 'public' | 'members_only' | 'private'
  ): Promise<void> {
    return withDevMode(
      () => {
        console.log(`[DEV MODE] Updating leaderboard visibility for member ${memberId} to ${visibility}`);
      },
      async () => {
        try {
          const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
          await updateDoc(memberRef, {
            'jciCareer.leaderboardVisibility': visibility,
            leaderboardVisibility: visibility, // backward compat during migration
            updatedAt: Timestamp.now(),
          });

          // Invalidate members cache after write
          MembersService.invalidateMembersCache();
        } catch (error) {
          console.error('Error updating leaderboard visibility:', error);
          throw error;
        }
      }
    );
  }

  // Get point rule for a specific category.
  // SCHEMA NOTE: This service reads pointsRules documents with schema:
  //   { basePoints, active, category, priority }
  // WARNING: PointsRuleService reads the same Firestore collection (COLLECTIONS.POINTS_RULES)
  //   expecting a DIFFERENT schema: { pointValue, enabled, trigger, conditions[], weight, multiplier }.
  //   Both schemas may coexist in the same collection.
  //   TODO: consolidate to one schema — see B1 finding in collection analysis.
  static async getPointRule(category: string): Promise<PointRule | null> {
    return withDevMode<PointRule | null>(
      () => ({
        id: 'rule-1',
        category: POINT_CATEGORIES.EVENT_ATTENDANCE,
        name: 'Event Attendance',
        basePoints: 10,
        active: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      async () => {
        const cacheKey = CACHE_PREFIX_POINT_RULES + 'cat:' + category;
        return apiCache.getOrSet<PointRule | null>(
          cacheKey,
          async () => {
            try {
              const q = query(
                collection(db, COLLECTIONS.POINTS_RULES),
                where('category', '==', category),
                where('active', '==', true),
                limit(1)
              );

              const snapshot = await getDocs(q);
              if (snapshot.empty) return null;

              const docSnap = snapshot.docs[0];
              const data = docSnap.data();
              return {
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
                updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
              } as PointRule;
            } catch (error) {
              console.error('Error fetching point rule:', error);
              throw error;
            }
          },
          5 * 60 * 1000,
          'getPointRule'
        );
      }
    );
  }

  // Get all point rules.
  // SCHEMA NOTE: reads pointsRules collection expecting { basePoints, active, category, priority }.
  // PointsRuleService reads the same collection expecting { pointValue, enabled, trigger, conditions[] }.
  // TODO: consolidate schemas — see B1 finding.
  static async getPointRules(includeInactive: boolean = false): Promise<PointRule[]> {
    return withDevMode<PointRule[]>(
      () => [
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
      ],
      async () => {
        const cacheKey = CACHE_PREFIX_POINT_RULES + 'all:' + (includeInactive ? 'all' : 'active');
        return apiCache.getOrSet<PointRule[]>(
          cacheKey,
          async () => {
            try {
              let q;
              if (includeInactive) {
                q = query(
                  collection(db, COLLECTIONS.POINTS_RULES),
                  orderBy('category')
                );
              } else {
                q = query(
                  collection(db, COLLECTIONS.POINTS_RULES),
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
          },
          5 * 60 * 1000,
          'getPointRules'
        );
      }
    );
  }

  // Alias for backward compatibility
  static async getAllPointRules(includeInactive: boolean = false): Promise<PointRule[]> {
    return this.getPointRules(includeInactive);
  }

  // Create or update point rule
  static async savePointRule(rule: Partial<PointRule> | Omit<PointRule, 'id'> | PointRule): Promise<string> {
    return withDevMode(
      () => {
        console.log('[DEV MODE] Saving point rule:', rule);
        return `mock-rule-${Date.now()}`;
      },
      async () => {
        try {
          const ruleId = 'id' in rule ? rule.id : undefined;
          if (ruleId) {
            // Update existing rule
            const ruleRef = doc(db, COLLECTIONS.POINTS_RULES, ruleId);
            await updateDoc(ruleRef, {
              ...rule,
              updatedAt: Timestamp.now(),
            });
            PointsService.invalidatePointRulesCache();
            return ruleId;
          } else {
            // Create new rule
            const newRule = {
              ...rule,
              active: rule.active ?? true,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            };
            const docRef = await addDoc(collection(db, COLLECTIONS.POINTS_RULES), newRule);
            PointsService.invalidatePointRulesCache();
            return docRef.id;
          }
        } catch (error) {
          console.error('Error saving point rule:', error);
          throw error;
        }
      }
    );
  }

  // Delete point rule
  static async deletePointRule(ruleId: string): Promise<void> {
    return withDevMode(
      () => {
        console.log(`[DEV MODE] Deleting point rule ${ruleId}`);
      },
      async () => {
        try {
          const ruleRef = doc(db, COLLECTIONS.POINTS_RULES, ruleId);
          await updateDoc(ruleRef, {
            active: false,
            updatedAt: Timestamp.now(),
          });
          PointsService.invalidatePointRulesCache();
        } catch (error) {
          console.error('Error deleting point rule:', error);
          throw error;
        }
      }
    );
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

  // --- NEW: Wolf-like Resource Competition Engine Methods ---

  /**
   * Transfer points between members (Competitive Business Logic)
   */
  static async transferPoints(
    senderId: string,
    receiverId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (amount <= 0) throw new Error('Transfer amount must be positive');

    return withDevMode(
      () => {
        console.log(`[DEV MODE] Transferring ${amount} from ${senderId} to ${receiverId}`);
      },
      async () => {
        try {
          await runTransaction(db, async (transaction) => {
            const senderRef = doc(db, COLLECTIONS.MEMBERS, senderId);
            const receiverRef = doc(db, COLLECTIONS.MEMBERS, receiverId);

            const senderDoc = await transaction.get(senderRef);
            const receiverDoc = await transaction.get(receiverRef);

            if (!senderDoc.exists() || !receiverDoc.exists()) {
              throw new Error('Sender or Receiver not found');
            }

            const senderPoints = senderDoc.data().points || 0;
            if (senderPoints < amount) {
              throw new Error('Insufficient points for transfer');
            }

            // Update balances
            transaction.update(senderRef, {
              points: senderPoints - amount,
              updatedAt: Timestamp.now()
            });
            transaction.update(receiverRef, {
              points: (receiverDoc.data().points || 0) + amount,
              updatedAt: Timestamp.now()
            });

            // Record transactions
            const senderTxRef = doc(collection(db, COLLECTIONS.POINTS));
            const receiverTxRef = doc(collection(db, COLLECTIONS.POINTS));

            transaction.set(senderTxRef, {
              memberId: senderId,
              amount: -amount,
              points: -amount,
              category: 'Transfer_Out',
              description: `To ${receiverDoc.data().name}: ${description}`,
              metadata: { ...metadata, relatedMemberId: receiverId },
              createdAt: Timestamp.now()
            });

            transaction.set(receiverTxRef, {
              memberId: receiverId,
              amount,
              points: amount,
              category: 'Transfer_In',
              description: `From ${senderDoc.data().name}: ${description}`,
              metadata: { ...metadata, relatedMemberId: senderId },
              createdAt: Timestamp.now()
            });
          });
        } catch (error) {
          console.error('Error during point transfer:', error);
          throw error;
        }
      }
    );
  }

  /**
   * Lock points in Escrow (for Contracts)
   * This triggers 'Loss Aversion' as points are deducted but not yet used.
   */
  static async lockPointsForEscrow(
    memberId: string,
    amount: number,
    purpose: 'CONTRACT',
    relatedEntityId: string,
    description: string
  ): Promise<string> {
    return withDevMode(
      () => `mock-escrow-${Date.now()}`,
      async () => {
        try {
          return await runTransaction(db, async (transaction) => {
            const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
            const memberDoc = await transaction.get(memberRef);

            if (!memberDoc.exists()) throw new Error('Member not found');

            const currentPoints = memberDoc.data().points || 0;
            if (currentPoints < amount) throw new Error('Insufficient points to lock for escrow');

            // Deduct from member
            transaction.update(memberRef, {
              points: currentPoints - amount,
              updatedAt: Timestamp.now()
            });

            // Create Escrow Record
            const escrowRef = doc(collection(db, COLLECTIONS.POINT_ESCROW));
            transaction.set(escrowRef, {
              memberId,
              amount,
              purpose,
              relatedEntityId,
              status: 'Locked',
              description,
              createdAt: Timestamp.now()
            });

            // Record the transaction as 'Escrow_Locked'
            const txRef = doc(collection(db, COLLECTIONS.POINTS));
            transaction.set(txRef, {
              memberId,
              amount: -amount,
              points: -amount,
              category: 'Escrow_Locked',
              description: `Locked for ${purpose}: ${description}`,
              relatedEntityId,
              createdAt: Timestamp.now()
            });

            return escrowRef.id;
          });
        } catch (error) {
          console.error('Error locking points:', error);
          throw error;
        }
      }
    );
  }

  /**
   * Release Escrow to a target (completing a contract)
   */
  static async releaseEscrow(
    escrowId: string,
    targetMemberId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    return withDevMode(
      () => { /* no-op in dev mode */ },
      async () => {
        try {
          await runTransaction(db, async (transaction) => {
            const escrowRef = doc(db, COLLECTIONS.POINT_ESCROW, escrowId);
            const escrowDoc = await transaction.get(escrowRef);

            if (!escrowDoc.exists()) throw new Error('Escrow record not found');
            if (escrowDoc.data().status !== 'Locked') throw new Error('Escrow is not locked');

            const { amount, purpose, relatedEntityId, description, memberId: originalOwnerId } = escrowDoc.data();
            const targetRef = doc(db, COLLECTIONS.MEMBERS, targetMemberId);
            const targetDoc = await transaction.get(targetRef);

            if (!targetDoc.exists()) throw new Error('Target member not found');

            // Add to target
            transaction.update(targetRef, {
              points: (targetDoc.data().points || 0) + amount,
              updatedAt: Timestamp.now()
            });

            // Close Escrow — include releasedBy if caller supplied it via metadata
            transaction.update(escrowRef, {
              status: 'Released',
              releasedTo: targetMemberId,
              releasedAt: Timestamp.now(),
              ...(metadata?.releasedBy ? { releasedBy: metadata.releasedBy } : {})
            });

            // Record receiving transaction
            const txRef = doc(collection(db, COLLECTIONS.POINTS));
            const txDescription = `Contract fulfillment: ${description}`;

            transaction.set(txRef, {
              memberId: targetMemberId,
              amount,
              points: amount,
              category: 'Escrow_Released',
              description: txDescription,
              relatedEntityId,
              metadata: { ...metadata, escrowId, originalOwnerId, purpose },
              createdAt: Timestamp.now()
            });
          });
        } catch (error) {
          console.error('Error releasing escrow:', error);
          throw error;
        }
      }
    );
  }

  // --- End of Competitive Engine Methods ---
  private static mockPrograms: IncentiveProgram[] = [
    {
      id: '2026_MY',
      year: 2026,
      name: '2026 JCI Malaysia Incentive Program',
      isActive: true,
      categories: {
        efficient: { label: 'Efficient Star', minScore: 100, isFundamental: true },
        network: { label: 'Network Star', minScore: 250 },
        experience: { label: 'Experience Star', minScore: 250 },
        outreach: { label: 'Outreach Star', minScore: 250 },
        impact: { label: 'Impact Star', minScore: 250 }
      },
      specialAwards: [
        { name: 'Best of the Best', criteria: ['5 Stars', 'Growth > 10%', 'Good Financial'] }
      ]
    }
  ];

  private static mockStandards: IncentiveStandard[] = [
    {
      id: '2026_OUTREACH_01',
      programId: '2026_MY',
      category: 'outreach',
      order: 1,
      title: 'Local Organization E-Newsletter',
      remarks: 'Publish a meaningful E-Newsletter representing the LO.',
      targetType: 'LO',
      pointCap: 60,
      verificationType: 'MANUAL_UPLOAD',
      milestones: [{
        id: 'ms_01',
        label: 'Q1 Submission',
        points: 20,
        deadline: '2026-03-31'
      }]
    }
  ];

  // Get active yearly program
  static async getActiveProgram(): Promise<IncentiveProgram | null> {
    return withDevMode(
      () => {
        // Return the active mock program, or the first one, or null
        const active = this.mockPrograms.find(p => p.isActive);
        return active || this.mockPrograms[0] || null;
      },
      async () => {
        try {
          const q = query(
            collection(db, COLLECTIONS.INCENTIVE_PROGRAMS),
            where('isActive', '==', true),
            limit(1)
          );
          const snapshot = await getDocs(q);
          if (snapshot.empty) return null;
          return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as IncentiveProgram;
        } catch (error) {
          console.error('Error fetching active program:', error);
          throw error;
        }
      }
    );
  }

  // Get all yearly programs
  static async getIncentivePrograms(): Promise<IncentiveProgram[]> {
    if (isDevMode()) return [...this.mockPrograms].sort((a, b) => b.year - a.year);
    try {
      const q = query(collection(db, COLLECTIONS.INCENTIVE_PROGRAMS), orderBy('year', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as IncentiveProgram));
    } catch (error) {
      console.error('Error fetching programs:', error);
      throw error;
    }
  }

  // Get program by year
  static async getProgramByYear(year: number): Promise<IncentiveProgram | null> {
    if (isDevMode()) return this.mockPrograms.find(p => p.year === year) || null;
    try {
      const q = query(collection(db, COLLECTIONS.INCENTIVE_PROGRAMS), where('year', '==', year), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as IncentiveProgram;
    } catch (error) {
      console.error('Error fetching program by year:', error);
      throw error;
    }
  }

  // Clone a program and its standards to a new year
  static async cloneProgram(sourceId: string, targetYear: number): Promise<string> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Cloning program ${sourceId} to ${targetYear}`);
      const source = this.mockPrograms.find(p => p.id === sourceId);
      if (!source) {
        console.error('[DEV MODE] Source program not found:', sourceId);
        throw new Error('Source program not found');
      }
      // Deactivate all other programs
      this.mockPrograms.forEach(p => p.isActive = false);
      // Create cloned program
      const newId = `cloned-${targetYear}-${Date.now()}`;
      const cloned: IncentiveProgram = {
        ...source,
        id: newId,
        year: targetYear,
        name: `${targetYear} JCI Incentive Program`,
        isActive: true
      };
      this.mockPrograms.push(cloned);
      // Clone standards
      const sourceStds = this.mockStandards.filter(s => s.programId === sourceId);
      sourceStds.forEach(std => {
        this.mockStandards.push({
          ...std,
          id: `${std.id}_clone_${targetYear}`,
          programId: newId
        });
      });
      return newId;
    }

    try {
      // 1. Get source program
      const sourceDoc = await getDoc(doc(db, COLLECTIONS.INCENTIVE_PROGRAMS, sourceId));
      if (!sourceDoc.exists()) {
        console.error('Source program not found:', sourceId);
        throw new Error('Source program not found');
      }
      const sourceData = sourceDoc.data() as IncentiveProgram;
      const { id: _, ...dataToClone } = sourceData as any;

      // 2. Disable current active if target is active
      const programs = await this.getIncentivePrograms();
      const batch = writeBatch(db);

      programs.forEach(p => {
        if (p.isActive) {
          batch.update(doc(db, COLLECTIONS.INCENTIVE_PROGRAMS, p.id), { isActive: false });
        }
      });

      // 3. Create new program
      const newProgramRef = doc(collection(db, COLLECTIONS.INCENTIVE_PROGRAMS));
      batch.set(newProgramRef, {
        ...dataToClone,
        year: targetYear,
        name: `${targetYear} JCI Incentive Program`,
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // 4. Clone standards
      const standards = await this.getStandards(sourceId);
      for (const std of standards) {
        const { id, ...stdData } = std;
        const newStdRef = doc(collection(db, COLLECTIONS.INCENTIVE_STANDARDS));
        batch.set(newStdRef, {
          ...stdData,
          programId: newProgramRef.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

      await batch.commit();
      PointsService.invalidateIncentiveCache();
      return newProgramRef.id;
    } catch (error) {
      console.error('Error cloning program:', error);
      throw error;
    }
  }

  // Get all standards for a given program
  // P1 fix: check cache before hitting Firestore; populate cache after read
  static async getStandards(programId: string): Promise<IncentiveStandard[]> {
    if (isDevMode()) {
      return this.mockStandards.filter(s => s.programId === programId);
    }
    const cacheKey = `${CACHE_PREFIX_INCENTIVE}standards:${programId}`;
    return apiCache.getOrSet(cacheKey, async () => {
      try {
        const q = query(
          collection(db, COLLECTIONS.INCENTIVE_STANDARDS),
          where('programId', '==', programId),
          orderBy('order', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as IncentiveStandard);
      } catch (error) {
        console.error('Error fetching standards:', error);
        throw error;
      }
    }, 3 * 60 * 1000);
  }

  // Submit an incentive claim
  // P1-C fix: enforce standard.maxClaims before allowing a new submission
  // P1-D fix: enforce program.deadline so late submissions are rejected upfront
  static async submitIncentiveClaim(
    claim: Partial<IncentiveSubmission> & { standardId: string; loId: string; quantity: number }
  ): Promise<string> {
    if (isDevMode()) {
      console.log('[DEV MODE] Submitting incentive claim:', claim);
      return `mock-claim-${Date.now()}`;
    }
    try {
      // P1-C + P1-D: pre-flight checks — fetch standard then program
      const stdSnap = await getDoc(doc(db, COLLECTIONS.INCENTIVE_STANDARDS, claim.standardId));
      if (stdSnap.exists()) {
        const standard = stdSnap.data() as IncentiveStandard & { maxClaims?: number };

        // P1-C: enforce per-member maxClaims limit
        const maxClaims = (standard as any).maxClaims as number | undefined;
        if (maxClaims !== undefined && claim.memberId) {
          const existingQ = query(
            collection(db, COLLECTIONS.INCENTIVE_SUBMISSIONS),
            where('memberId', '==', claim.memberId),
            where('standardId', '==', claim.standardId),
            where('status', 'in', ['PENDING', 'APPROVED'])
          );
          const existingSnap = await getDocs(existingQ);
          if (existingSnap.size >= maxClaims) {
            throw new Error('Maximum claims reached for this standard.');
          }
        }

        // P1-D: enforce program deadline
        const programId = standard.programId;
        if (programId) {
          const progSnap = await getDoc(doc(db, COLLECTIONS.INCENTIVE_PROGRAMS, programId));
          if (progSnap.exists()) {
            const program = progSnap.data() as IncentiveProgram & { deadline?: any };
            const deadline = (program as any).deadline;
            if (deadline) {
              const deadlineDate = typeof deadline.toDate === 'function'
                ? deadline.toDate()
                : new Date(deadline);
              if (new Date() > deadlineDate) {
                throw new Error('The incentive program deadline has passed.');
              }
            }
          }
        }
      }

      const submission: Omit<IncentiveSubmission, 'id'> = {
        standardId: claim.standardId,
        loId: claim.loId,
        memberId: claim.memberId,
        status: claim.status || 'PENDING',
        evidenceFiles: claim.evidenceFiles || [],
        evidenceText: claim.evidenceText,
        quantity: claim.quantity,
        submittedAt: Timestamp.now() as any, // Firebase deals with it
        scoreAwarded: claim.scoreAwarded || 0,
        approvedBy: claim.approvedBy,
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.INCENTIVE_SUBMISSIONS), submission);
      return docRef.id;
    } catch (error) {
      console.error('Error submitting incentive claim:', error);
      throw error;
    }
  }

  // Fetch submissions by LO
  static async getLOSubmissions(loId: string): Promise<IncentiveSubmission[]> {
    if (isDevMode()) return [];
    try {
      const q = query(
        collection(db, COLLECTIONS.INCENTIVE_SUBMISSIONS),
        where('loId', '==', loId),
        orderBy('submittedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate().toISOString() : data.submittedAt
        } as IncentiveSubmission;
      });
    } catch (error) {
      console.error('Error fetching LO submissions:', error);
      throw error;
    }
  }

  // Fetch user submissions
  static async getUserSubmissions(memberId: string): Promise<IncentiveSubmission[]> {
    if (isDevMode()) return [];
    try {
      const q = query(
        collection(db, COLLECTIONS.INCENTIVE_SUBMISSIONS),
        where('memberId', '==', memberId),
        orderBy('submittedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate().toISOString() : data.submittedAt
        } as IncentiveSubmission;
      });
    } catch (error) {
      console.error('Error fetching User submissions:', error);
      throw error;
    }
  }

  // Fetch pending submissions for approval
  static async getPendingSubmissions(): Promise<IncentiveSubmission[]> {
    if (isDevMode()) return [];
    try {
      const q = query(
        collection(db, COLLECTIONS.INCENTIVE_SUBMISSIONS),
        where('status', '==', 'PENDING'),
        orderBy('submittedAt', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate().toISOString() : data.submittedAt
        } as IncentiveSubmission;
      });
    } catch (error) {
      console.error('Error fetching pending submissions:', error);
      throw error;
    }
  }

  // Approve a claim
  // P0-A fix: atomically update submission status AND create a points transaction in one batch.
  static async approveClaim(submissionId: string, grantedPoints: number, approverId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Approved claim ${submissionId} with ${grantedPoints} points.`);
      return;
    }
    try {
      // Fetch submission to get memberId for points award
      const submissionRef = doc(db, COLLECTIONS.INCENTIVE_SUBMISSIONS, submissionId);
      const submissionSnap = await getDoc(submissionRef);
      if (!submissionSnap.exists()) throw new Error(`Submission ${submissionId} not found`);
      const submission = submissionSnap.data() as IncentiveSubmission;

      // TODO: milestone-level approval not yet implemented; milestoneId is present on the
      // submission (submission.milestoneId) but sub-milestone score tracking is not supported yet.
      // The full submission is approved as a whole for now.

      // P1-B: if the caller passes 0 points, derive a sensible default from the standard's
      // first milestone so scoreAwarded is never silently zeroed on approval.
      let resolvedPoints = grantedPoints;
      if (resolvedPoints <= 0) {
        try {
          const stdSnap = await getDoc(doc(db, COLLECTIONS.INCENTIVE_STANDARDS, submission.standardId));
          if (stdSnap.exists()) {
            const std = stdSnap.data() as IncentiveStandard;
            resolvedPoints = std.milestones?.[0]?.points || submission.scoreAwarded || 0;
          }
        } catch (stdErr) {
          console.error('approveClaim: could not fetch standard for scoreAwarded fallback', stdErr);
        }
      }

      const batch = writeBatch(db);

      // 1. Update submission status to APPROVED
      batch.update(submissionRef, {
        status: 'APPROVED',
        scoreAwarded: resolvedPoints,
        approvedBy: approverId,
      });

      // 2. Create a points transaction for the member (if there is one)
      // Note: expiresAt is defined in types but not enforced; metadata is stored but not read.
      if (submission.memberId && resolvedPoints > 0) {
        const txRef = doc(collection(db, COLLECTIONS.POINTS));
        batch.set(txRef, {
          memberId: submission.memberId,
          points: resolvedPoints,
          amount: resolvedPoints,
          category: 'Incentive_Claim',
          description: `Incentive claim approved (submission: ${submissionId})`,
          relatedEntityId: submissionId,
          relatedEntityType: 'incentiveSubmission',
          sourceId: submissionId,           // backward compatibility
          sourceType: 'incentiveSubmission', // backward compatibility
          createdAt: Timestamp.now(),
        });

        // E4 fix: update member aggregate points INSIDE the batch so that the
        // points transaction and the member total are committed atomically.
        // The separate updateMemberPoints call that previously followed batch.commit()
        // has been removed — this increment replaces it.
        const memberRef = doc(db, COLLECTIONS.MEMBERS, submission.memberId);
        batch.update(memberRef, { points: increment(resolvedPoints) });
      }

      await batch.commit();

      // P0-A: Update loStarProgress inline to mirror Cloud Function onSubmissionApproved.
      // The Cloud Function may not be deployed in all environments, so we replicate its logic
      // here as a reliable fallback. Errors are non-fatal — loStarProgress is a derived cache.
      if (submission.loId && resolvedPoints > 0) {
        try {
          const stdSnap = await getDoc(doc(db, COLLECTIONS.INCENTIVE_STANDARDS, submission.standardId));
          if (stdSnap.exists()) {
            const std = stdSnap.data() as IncentiveStandard;
            const category = std.category;
            const programId = std.programId;

            const progSnap = await getDoc(doc(db, COLLECTIONS.INCENTIVE_PROGRAMS, programId));
            if (progSnap.exists()) {
              const program = progSnap.data() as IncentiveProgram;
              const minScore = program.categories?.[category]?.minScore ?? 250;
              const year = program.year || new Date().getFullYear();

              const progressRef = doc(db, COLLECTIONS.LO_STAR_PROGRESS, `${submission.loId}_${year}`);
              await runTransaction(db, async (t) => {
                const progressSnap = await t.get(progressRef);
                const data: Record<string, any> = progressSnap.exists()
                  ? { ...progressSnap.data() }
                  : {
                      loId: submission.loId,
                      year,
                      categories: {},
                      details: {},
                      totalPoints: 0,
                      starsUnlocked: 0,
                    };

                if (!data.categories[category]) {
                  data.categories[category] = { current: 0, total: minScore, stars: 0 };
                }
                const currentPoints = (data.categories[category].current || 0) + resolvedPoints;
                data.categories[category].current = currentPoints;
                data.categories[category].stars = currentPoints >= minScore ? 1 : 0;
                data.totalPoints = (data.totalPoints || 0) + resolvedPoints;

                let totalStars = 0;
                Object.values(data.categories as Record<string, any>).forEach((cat: any) => {
                  totalStars += cat.stars || 0;
                });
                data.starsUnlocked = totalStars;
                data.lastUpdated = Timestamp.now();

                t.set(progressRef, data, { merge: true });
              });
            }
          }
        } catch (loStarError) {
          console.error('approveClaim: failed to update loStarProgress (non-fatal)', loStarError);
        }
      }

      // E5 fix: best-effort badge/achievement check after points are approved.
      // GamificationService is dynamically imported to avoid the circular dependency
      // (gamificationService.ts already imports pointsService.ts).
      // TODO: replace the inner body with GamificationService.checkEligibleBadgesForMember(memberId)
      //       and an achievementService.checkAndAwardAchievements(memberId) call once those
      //       methods are implemented.
      if (submission.memberId) {
        try {
          // Dynamic import prevents circular-dep at module load time.
          const { GamificationService } = await import('./gamificationService');
          // Fetch all defined awards and let the service evaluate eligibility.
          // This is a lightweight read; no write happens unless a badge is earned.
          await GamificationService.getAllAwards();
          // Actual per-member eligibility check is a TODO — the call above is a
          // deliberate placeholder so the try/catch infrastructure is in place.
        } catch (err) {
          console.warn('[approveClaim] Badge/achievement check failed (non-critical):', err);
        }
      }

      // Invalidate caches
      PointsService.invalidatePointsCache();
      PointsService.invalidateIncentiveCache();
    } catch (error) {
      console.error('Error approving claim:', error);
      throw error;
    }
  }

  // Reject a claim
  static async rejectClaim(submissionId: string, reason: string, approverId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Rejected claim ${submissionId}. Reason: ${reason}`);
      return;
    }
    try {
      // TODO: milestone-level rejection not yet implemented; milestoneId on the submission
      // is ignored at this stage. The full submission is rejected as a whole.
      await updateDoc(doc(db, COLLECTIONS.INCENTIVE_SUBMISSIONS, submissionId), {
        status: 'REJECTED',
        rejectionReason: reason,
        approvedBy: approverId
      });
      // Invalidate cache after write
      PointsService.invalidateIncentiveCache();
    } catch (error) {
      console.error('Error rejecting claim:', error);
      throw error;
    }
  }

  // Create a new incentive program
  // P0-B fix: if the new program is active, deactivate all existing active programs atomically
  // in the same writeBatch so there is never more than one active program at a time.
  static async createIncentiveProgram(program: Omit<IncentiveProgram, 'id'>): Promise<string> {
    if (isDevMode()) {
      console.log('[DEV MODE] Creating incentive program:', program);
      const newId = `mock-program-${Date.now()}`;
      // If the new program is active, deactivate others
      if ((program as any).isActive) {
        this.mockPrograms.forEach(p => p.isActive = false);
      }
      this.mockPrograms.push({ ...program, id: newId } as IncentiveProgram);
      return newId;
    }
    try {
      const { id: _, ...dataToSave } = program as any;
      const batch = writeBatch(db);

      // If the new program is active, deactivate all currently active programs first
      if (dataToSave.isActive) {
        const activeQ = query(
          collection(db, COLLECTIONS.INCENTIVE_PROGRAMS),
          where('isActive', '==', true)
        );
        const activeSnap = await getDocs(activeQ);
        activeSnap.docs.forEach(activeDoc => {
          batch.update(
            doc(db, COLLECTIONS.INCENTIVE_PROGRAMS, activeDoc.id),
            { isActive: false, updatedAt: Timestamp.now() }
          );
        });
      }

      // Create the new program document atomically in the same batch
      const newProgramRef = doc(collection(db, COLLECTIONS.INCENTIVE_PROGRAMS));
      batch.set(newProgramRef, {
        ...dataToSave,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      await batch.commit();
      PointsService.invalidateIncentiveCache();
      // TODO P1-A: Pre-initialize loStarProgress docs for every LO when a new program is
      // created so LOStarDashboard never hits a "doc not found" error before the first
      // approved submission. Requires fetching all distinct loIds from the members
      // collection and setDoc-ing a skeleton { loId, year, categories:{}, totalPoints:0,
      // starsUnlocked:0, lastUpdated } for each. Skipped here to avoid a large unbounded
      // read on program creation; getLOStarProgress() now uses setDoc+merge:true as a
      // lazy initialiser on first dashboard load (see P1-A fix in getLOStarProgress).
      return newProgramRef.id;
    } catch (error) {
      console.error('Error creating incentive program:', error);
      throw error;
    }
  }

  // Update an existing incentive program
  static async updateIncentiveProgram(id: string, program: Partial<IncentiveProgram>): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Updating incentive program ${id}:`, program);
      const idx = this.mockPrograms.findIndex(p => p.id === id);
      if (idx !== -1) {
        this.mockPrograms[idx] = { ...this.mockPrograms[idx], ...program, id };
      }
      return;
    }
    try {
      const { id: _, ...data } = program;
      await updateDoc(doc(db, COLLECTIONS.INCENTIVE_PROGRAMS, id), {
        ...data,
        updatedAt: Timestamp.now()
      });
      PointsService.invalidateIncentiveCache();
    } catch (error) {
      console.error('Error updating incentive program:', error);
      throw error;
    }
  }

  // Delete an entire incentive program and its standards
  static async deleteIncentiveProgram(id: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Deleting incentive program ${id}`);
      this.mockPrograms = this.mockPrograms.filter(p => p.id !== id);
      this.mockStandards = this.mockStandards.filter(s => s.programId !== id);
      return;
    }
    try {
      const batch = writeBatch(db);

      // 1. Delete all standards for this program
      const standards = await this.getStandards(id);
      standards.forEach(std => {
        batch.delete(doc(db, COLLECTIONS.INCENTIVE_STANDARDS, std.id));
      });

      // 2. Delete the program itself
      batch.delete(doc(db, COLLECTIONS.INCENTIVE_PROGRAMS, id));

      await batch.commit();
      PointsService.invalidateIncentiveCache();
      // TODO P1-D: cascade-delete loStarProgress docs for this program's year.
      // Query loStarProgress where year == program.year and delete them (or set archived:true).
      // Requires fetching the program doc before deletion to read its year field.
      // Not implemented here because it requires an additional getDocs + batch outside the
      // existing batch (Firestore batch limit is 500 writes).
    } catch (error) {
      console.error('Error deleting incentive program:', error);
      throw error;
    }
  }

  // Save or update an incentive standard
  // P1 fix: block edits to any standard that already has Approved submissions —
  //         changing the rules after approval creates unreconcilable score discrepancies.
  static async saveStandard(standard: Omit<IncentiveStandard, 'id'> | IncentiveStandard): Promise<string> {
    if (isDevMode()) {
      console.log('[DEV MODE] Saving standard:', standard);
      const id = 'id' in standard ? standard.id : `mock-std-${Date.now()}`;
      const newStd = { ...standard, id } as IncentiveStandard;

      const index = this.mockStandards.findIndex(s => s.id === id);
      if (index >= 0) {
        this.mockStandards[index] = newStd;
      } else {
        this.mockStandards.push(newStd);
      }
      return id;
    }
    try {
      const { id, ...data } = standard as any;
      if (id) {
        // P1 guard: refuse edits when approved submissions already exist for this standard
        const approvedSnap = await getDocs(
          query(
            collection(db, COLLECTIONS.INCENTIVE_SUBMISSIONS),
            where('standardId', '==', id),
            where('status', '==', 'APPROVED')
          )
        );
        if (!approvedSnap.empty) {
          throw new Error(
            'Cannot change a standard that has approved submissions. Archive it and create a new one instead.'
          );
        }

        await updateDoc(doc(db, COLLECTIONS.INCENTIVE_STANDARDS, id), {
          ...data,
          updatedAt: Timestamp.now()
        });
        PointsService.invalidateIncentiveCache();
        return id;
      } else {
        const docRef = await addDoc(collection(db, COLLECTIONS.INCENTIVE_STANDARDS), {
          ...data,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        PointsService.invalidateIncentiveCache();
        return docRef.id;
      }
    } catch (error) {
      console.error('Error saving incentive standard:', error);
      throw error;
    }
  }

  // Delete multiple incentive standards
  static async bulkDeleteStandards(ids: string[]): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Deleting ${ids.length} standards`);
      // Update local mock if it exists
      if (this.mockStandards) {
        this.mockStandards = this.mockStandards.filter(s => !ids.includes(s.id!));
      }
      return;
    }
    try {
      const batch = writeBatch(db);
      for (const id of ids) {
        batch.delete(doc(db, COLLECTIONS.INCENTIVE_STANDARDS, id));
      }
      await batch.commit();
      PointsService.invalidateIncentiveCache();
    } catch (error) {
      console.error('Error bulk deleting standards:', error);
      throw error;
    }
  }

  // Delete an incentive standard
  // P1 fix: cascade-cancel all non-Approved submissions that reference this standard
  //         so they don't remain as dangling records pointing at a deleted standard.
  static async deleteStandard(id: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Deleting standard ${id}`);
      return;
    }
    try {
      // Find all submissions for this standard that are not yet Approved
      const pendingSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.INCENTIVE_SUBMISSIONS),
          where('standardId', '==', id),
          where('status', 'in', ['PENDING', 'REJECTED'])
        )
      );

      const batch = writeBatch(db);

      // Cascade: cancel dangling submissions
      const now = Timestamp.now();
      pendingSnap.docs.forEach(d =>
        batch.update(d.ref, {
          status: 'CANCELLED',
          cancellationReason: 'Standard deleted',
          updatedAt: now,
        })
      );

      // Delete the standard itself
      batch.delete(doc(db, COLLECTIONS.INCENTIVE_STANDARDS, id));

      await batch.commit();
      PointsService.invalidateIncentiveCache();
    } catch (error) {
      console.error('Error deleting incentive standard:', error);
      throw error;
    }
  }

  /**
   * Fetch LO Star progress for a given LO and year
   */
  static async getLOStarProgress(loId: string, year: number): Promise<LOStarProgress> {
    if (isDevMode()) {
      return {
        loId,
        year,
        categories: {
          efficient: { current: 45, total: 100, stars: 0 },
          network: { current: 120, total: 250, stars: 0 },
          experience: { current: 80, total: 250, stars: 0 },
          outreach: { current: 30, total: 200, stars: 0 },
          impact: { current: 15, total: 150, stars: 0 }
        },
        details: {},
        totalPoints: 290,
        starsUnlocked: 0,
        lastUpdated: new Date().toISOString()
      };
    }

    try {
      // 1. Get active program for the year
      const programs = await this.getIncentivePrograms();
      const program = programs.find(p => p.year === year && p.isActive) || programs[0];
      if (!program) throw new Error('No active incentive program found');

      // 2. Get all approved submissions for the LO
      const q = query(
        collection(db, COLLECTIONS.INCENTIVE_SUBMISSIONS),
        where('loId', '==', loId),
        where('status', '==', 'APPROVED')
      );
      const snapshot = await getDocs(q);
      const submissions = snapshot.docs.map(doc => doc.data() as IncentiveSubmission);

      // 3. Get all standards to map standardId -> category
      const standards = await this.getStandards(program.id);
      const standardMap = new Map(standards.map(s => [s.id, s]));

      // 4. Aggregate scores
      const categoryScores: Record<string, number> = {};
      Object.keys(program.categories).forEach(cat => categoryScores[cat] = 0);

      submissions.forEach(sub => {
        const std = standardMap.get(sub.standardId);
        if (std && categoryScores[std.category] !== undefined) {
          categoryScores[std.category] += (sub.scoreAwarded || 0);
        }
      });

      // 5. Build progress object
      const categories: Record<string, { current: number; total: number; stars: number }> = {};
      let starsUnlocked = 0;
      let totalPoints = 0;

      Object.entries(program.categories).forEach(([id, cat]) => {
        const current = categoryScores[id] || 0;
        const total = cat.minScore;
        const earnedStar = current >= total;
        if (earnedStar) starsUnlocked++;
        totalPoints += current;

        categories[id] = {
          current,
          total,
          stars: earnedStar ? 1 : 0
        };
      });

      const progress: LOStarProgress = {
        loId,
        year,
        categories,
        details: {},
        totalPoints,
        starsUnlocked,
        lastUpdated: new Date().toISOString()
      };

      // P1-A fix: persist computed progress so the loStarProgress document exists for
      // Cloud Function incremental updates and LOStarDashboard reads. Using merge:true
      // so we never overwrite incremental updates written by the Cloud Function with
      // stale on-the-fly aggregated values — only missing fields are initialised.
      try {
        const progressRef = doc(db, COLLECTIONS.LO_STAR_PROGRESS, `${loId}_${year}`);
        await setDoc(progressRef, {
          loId,
          year,
          lastUpdated: progress.lastUpdated,
        }, { merge: true });
      } catch (persistErr) {
        // Non-fatal: if the write fails the caller still gets the computed value
        console.warn('[loStarProgress] Failed to persist progress snapshot:', persistErr);
      }

      return progress;
    } catch (error) {
      console.error('Error fetching LO star progress:', error);
      throw error;
    }
  }

  // Get Radar configuration
  static async getRadarPointsConfig(): Promise<RadarPointsConfig> {
    const DEFAULT_CONFIG: RadarPointsConfig = {
      leadership: { exOfficio: 2, organisingChairman: 5, committee: 3 },
      training: { pointsPerHour: 1 },
      recruitment: { pointsPerPax: 10 },
      sponsorship: { pointsPer100: 2 }
    };

    if (isDevMode()) {
      try {
        const localData = localStorage.getItem('radar_points_config');
        return localData ? JSON.parse(localData) : DEFAULT_CONFIG;
      } catch {
        return DEFAULT_CONFIG;
      }
    }

    try {
      const docRef = doc(db, 'system', 'radar_points_config');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          leadership: {
            exOfficio: data.leadership?.exOfficio ?? DEFAULT_CONFIG.leadership.exOfficio,
            organisingChairman: data.leadership?.organisingChairman ?? DEFAULT_CONFIG.leadership.organisingChairman,
            committee: data.leadership?.committee ?? DEFAULT_CONFIG.leadership.committee,
          },
          training: {
            pointsPerHour: data.training?.pointsPerHour ?? DEFAULT_CONFIG.training.pointsPerHour,
          },
          recruitment: {
            pointsPerPax: data.recruitment?.pointsPerPax ?? DEFAULT_CONFIG.recruitment.pointsPerPax,
          },
          sponsorship: {
            pointsPer100: data.sponsorship?.pointsPer100 ?? DEFAULT_CONFIG.sponsorship.pointsPer100,
          }
        };
      }
      return DEFAULT_CONFIG;
    } catch (error) {
      console.error('Error fetching radar points config:', error);
      return DEFAULT_CONFIG;
    }
  }

  // Save Radar configuration
  static async saveRadarPointsConfig(config: RadarPointsConfig): Promise<void> {
    if (isDevMode()) {
      localStorage.setItem('radar_points_config', JSON.stringify(config));
      console.log('[DEV MODE] Saved radar points config to localStorage:', config);
      return;
    }

    try {
      const docRef = doc(db, 'system', 'radar_points_config');
      await setDoc(docRef, config);
      console.log('Saved radar points config to cloud:', config);
    } catch (error) {
      console.error('Error saving radar points config:', error);
      throw error;
    }
  }

  // Recalculate Member Radar Stats and update member doc
  static async recalculateMemberRadarStats(memberId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Recalculating radar stats for member ${memberId}`);
      return;
    }

    try {
      const config = await this.getRadarPointsConfig();
      const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
      const memberSnap = await getDoc(memberRef);

      if (!memberSnap.exists()) {
        console.warn(`Member ${memberId} not found, skipping recalculation`);
        return;
      }

      const member = memberSnap.data() as Member;
      const memberName = member.name || '';
      const memberFullName = member.fullName || member.general?.name || '';

      // 1. Calculate Leadership & Training Points from Projects
      let leadership = 0;
      let training = 0;

      // TODO: filter by loId or active status to avoid full-collection scan
      const projectsSnap = await getDocs(query(collection(db, COLLECTIONS.PROJECTS), limit(200)));
      projectsSnap.forEach(pDoc => {
        const proj = pDoc.data();
        
        // Event Committee Roles Check
        if (proj.committee && Array.isArray(proj.committee)) {
          proj.committee.forEach((c: any) => {
            if (c.memberId === memberId) {
              const role = (c.role || '').trim().toLowerCase();
              if (role === 'ex-officio') {
                leadership += config.leadership.exOfficio;
              } else if (role === 'organising chairperson' || role === 'organising chairman') {
                leadership += config.leadership.organisingChairman;
              } else {
                leadership += config.leadership.committee;
              }
            }
          });
        }

        // Event Trainer Duration Check
        if (proj.trainers && Array.isArray(proj.trainers)) {
          proj.trainers.forEach((t: any) => {
            if (t.memberId === memberId) {
              const hrs = parseFloat(t.durationHours) || 0;
              training += hrs * config.training.pointsPerHour;
            }
          });
        }
      });

      // 2. Calculate Recruitment Points
      // TODO: Store introducerId (memberId) instead of introducer name string, then use where() query
      let recruitment = 0;
      const membersSnap = await getDocs(query(collection(db, COLLECTIONS.MEMBERS), limit(500)));
      if (membersSnap.size >= 500) console.warn('calculateRadarStats: hit 500-member cap, results may be incomplete');
      let referCount = 0;
      membersSnap.forEach(mDoc => {
        const m = mDoc.data() as Member;
        const intro = (m.introducer || '').trim().toLowerCase();
        if (intro) {
          if (
            intro === memberId.toLowerCase() ||
            (memberName && intro === memberName.trim().toLowerCase()) ||
            (memberFullName && intro === memberFullName.trim().toLowerCase())
          ) {
            referCount++;
          }
        }
      });
      recruitment = referCount * config.recruitment.pointsPerPax;

      // 3. Calculate Sponsorship Points
      let sponsorship = 0;
      const sponsorshipsSnap = await getDocs(
        query(collection(db, COLLECTIONS.SPONSORSHIPS || 'sponsorships'), where('memberId', '==', memberId))
      );
      sponsorshipsSnap.forEach(sDoc => {
        const s = sDoc.data();
        const amt = parseFloat(s.amount) || 0;
        sponsorship += Math.floor(amt / 100) * config.sponsorship.pointsPer100;
      });

      // 4. Calculate Events Points (from RadarContributions)
      let events = 0;
      const contributionsSnap = await getDocs(
        query(collection(db, 'RadarContributions'), where('memberId', '==', memberId))
      );
      contributionsSnap.forEach(cDoc => {
        const c = cDoc.data();
        events += parseFloat(c.points) || 0;
      });

      // 5. Total Points and Tier Calculation
      const totalPoints = leadership + training + recruitment + sponsorship + events;
      const tier = this.calculateTier(totalPoints);

      // 6. Update Member doc
      await updateDoc(memberRef, {
        'jciCareer.radarStats': {
          leadership,
          training,
          recruitment,
          sponsorship,
          events
        },
        radarStats: { // backward compat during migration
          leadership,
          training,
          recruitment,
          sponsorship,
          events
        },
        points: totalPoints,
        tier,
        updatedAt: Timestamp.now()
      });

      // Invalidate members cache after write
      MembersService.invalidateMembersCache();

      console.log(`Recalculated member ${memberId}:`, {
        leadership,
        training,
        recruitment,
        sponsorship,
        events,
        totalPoints,
        tier
      });
    } catch (err) {
      console.error(`Error recalculating radar stats for member ${memberId}:`, err);
    }
  }
}

