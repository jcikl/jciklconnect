// Achievement Service - Achievement System Management
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
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Achievement, AchievementAward, AchievementCriteria, AchievementMilestone, MemberAchievementProgress, Member } from '../types';
import { isDevMode } from '../utils/devMode';
import { PointsService } from './pointsService';

export class AchievementService {
  // Get all achievements
  static async getAllAchievements(): Promise<Achievement[]> {
    if (isDevMode()) {
      return this.getDefaultAchievements();
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.ACHIEVEMENTS),
          where('active', '==', true),
          orderBy('tier', 'asc'),
          orderBy('name', 'asc')
        )
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      } as Achievement));
    } catch (error) {
      console.error('Error fetching achievements:', error);
      throw error;
    }
  }

  // Get achievement by ID
  static async getAchievementById(achievementId: string): Promise<Achievement | null> {
    try {
      const docRef = doc(db, COLLECTIONS.ACHIEVEMENTS, achievementId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        } as Achievement;
      }
      return null;
    } catch (error) {
      console.error('Error fetching achievement:', error);
      throw error;
    }
  }

  // Get achievements earned by a member
  static async getMemberAchievements(memberId: string): Promise<AchievementAward[]> {
    if (isDevMode()) {
      return [];
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.ACHIEVEMENT_AWARDS),
          where('memberId', '==', memberId),
          orderBy('earnedAt', 'desc')
        )
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        earnedAt: doc.data().earnedAt?.toDate?.()?.toISOString() || doc.data().earnedAt,
      } as AchievementAward));
    } catch (error) {
      console.error('Error fetching member achievements:', error);
      throw error;
    }
  }

  // Check if member has earned an achievement
  static async hasAchievement(memberId: string, achievementId: string): Promise<boolean> {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.ACHIEVEMENT_AWARDS),
          where('memberId', '==', memberId),
          where('achievementId', '==', achievementId),
          limit(1)
        )
      );
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking achievement:', error);
      return false;
    }
  }

  // Award achievement to member
  static async awardAchievement(
    memberId: string,
    achievementId: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Would award achievement ${achievementId} to member ${memberId}`);
      return `award-${Date.now()}`;
    }

    try {
      // Check if already awarded
      const alreadyAwarded = await this.hasAchievement(memberId, achievementId);
      if (alreadyAwarded) {
        throw new Error('Achievement already awarded to this member');
      }

      // Get achievement details
      const achievement = await this.getAchievementById(achievementId);
      if (!achievement) {
        throw new Error('Achievement not found');
      }

      // Create award record
      const award: Omit<AchievementAward, 'id'> = {
        achievementId,
        memberId,
        earnedAt: new Date().toISOString(),
        metadata,
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.ACHIEVEMENT_AWARDS), {
        ...award,
        earnedAt: Timestamp.now(),
      });

      // Award points if achievement has points reward
      if (achievement.pointsReward > 0) {
        await PointsService.awardPoints(
          memberId,
          'achievement',
          achievement.pointsReward,
          `Achievement unlocked: ${achievement.name}`,
          achievementId,
          'achievement'
        );
      }

      return docRef.id;
    } catch (error) {
      console.error('Error awarding achievement:', error);
      throw error;
    }
  }

  // Check and award achievements based on member activity
  static async checkAndAwardAchievements(memberId: string, member: Member): Promise<AchievementAward[]> {
    try {
      const achievements = await this.getAllAchievements();
      const awardedAchievements: AchievementAward[] = [];

      for (const achievement of achievements) {
        // Skip if already awarded
        if (await this.hasAchievement(memberId, achievement.id!)) {
          continue;
        }

        // Check if criteria is met
        const criteriaMet = await this.checkCriteria(achievement.criteria, memberId, member);
        
        if (criteriaMet) {
          try {
            const awardId = await this.awardAchievement(memberId, achievement.id!);
            awardedAchievements.push({
              id: awardId,
              achievementId: achievement.id!,
              memberId,
              earnedAt: new Date().toISOString(),
            });
          } catch (err) {
            // Skip if already awarded (race condition)
            if (err instanceof Error && !err.message.includes('already awarded')) {
              console.error(`Error awarding achievement ${achievement.id}:`, err);
            }
          }
        }
      }

      return awardedAchievements;
    } catch (error) {
      console.error('Error checking achievements:', error);
      throw error;
    }
  }

  // Check if achievement criteria is met
  private static async checkCriteria(
    criteria: AchievementCriteria,
    memberId: string,
    member: Member
  ): Promise<boolean> {
    try {
      switch (criteria.type) {
        case 'points_threshold':
          return member.points >= criteria.value;

        case 'event_count':
          // Import dynamically to avoid circular dependencies
          const { EventsService } = await import('./eventsService');
          const allEvents = await EventsService.getAllEvents();
          // Filter events where member attended (simplified - would need proper attendance tracking)
          const memberEvents = allEvents.filter(e => {
            // In a real implementation, check event attendees list
            return true; // Placeholder
          });
          const filteredEvents = this.filterByTimeframe(memberEvents, criteria.timeframe);
          return filteredEvents.length >= criteria.value;

        case 'project_count':
          const { ProjectsService } = await import('./projectsService');
          const allProjects = await ProjectsService.getAllProjects();
          // Filter projects where member is lead or in team
          const memberProjects = allProjects.filter(p => 
            p.lead === memberId || (p.team && p.team.includes(memberId))
          );
          const filteredProjects = this.filterByTimeframe(
            memberProjects.map(p => ({ ...p, createdAt: p.startDate })), 
            criteria.timeframe
          );
          return filteredProjects.length >= criteria.value;

        case 'consecutive_attendance':
          const { EventsService: EventsService2 } = await import('./eventsService');
          const allEvents2 = await EventsService2.getAllEvents();
          // Sort by date descending and check for consecutive attendance
          const sortedEvents = allEvents2
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          let consecutiveCount = 0;
          for (const event of sortedEvents) {
            // Simplified check - in production would check actual attendance
            if (event.attendees > 0) {
              consecutiveCount++;
              if (consecutiveCount >= criteria.value) return true;
            } else {
              break;
            }
          }
          return false;

        case 'role_held':
          // Check if member has held specific role
          return member.role === criteria.conditions?.role || false;

        case 'training_completed':
          // Simplified - would need proper training progress tracking
          // For now, return false as training tracking needs to be implemented
          return false;

        case 'recruitment_count':
          // Check recruitment count from points
          const { PointsService: PointsService2 } = await import('./pointsService');
          try {
            const pointHistory = await PointsService2.getMemberPoints(memberId);
            const recruitmentTransactions = pointHistory.filter(p => p.category === 'recruitment');
            // Count unique recruitment transactions (each recruitment = one transaction)
            return recruitmentTransactions.length >= criteria.value;
          } catch {
            // If method doesn't exist, return false
            return false;
          }

        case 'custom':
          // Custom criteria evaluation
          return criteria.conditions?.evaluate?.(member) || false;

        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking criteria:', error);
      return false;
    }
  }

  // Filter items by timeframe
  private static filterByTimeframe<T extends { date?: string; createdAt?: string }>(
    items: T[],
    timeframe?: AchievementCriteria['timeframe']
  ): T[] {
    if (!timeframe || timeframe === 'lifetime') {
      return items;
    }

    const now = new Date();
    let startDate: Date;

    switch (timeframe) {
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return items;
    }

    return items.filter(item => {
      const itemDate = item.date ? new Date(item.date) : (item.createdAt ? new Date(item.createdAt) : null);
      return itemDate && itemDate >= startDate;
    });
  }

  // Create or update achievement
  static async saveAchievement(achievement: Partial<Achievement>): Promise<string> {
    if (isDevMode()) {
      console.log('[DEV MODE] Would save achievement:', achievement);
      return `achievement-${Date.now()}`;
    }

    try {
      if (achievement.id) {
        // Update existing
        const docRef = doc(db, COLLECTIONS.ACHIEVEMENTS, achievement.id);
        await updateDoc(docRef, {
          ...achievement,
          updatedAt: Timestamp.now(),
        });
        return achievement.id;
      } else {
        // Create new
        const newAchievement = {
          ...achievement,
          active: achievement.active ?? true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        const docRef = await addDoc(collection(db, COLLECTIONS.ACHIEVEMENTS), newAchievement);
        return docRef.id;
      }
    } catch (error) {
      console.error('Error saving achievement:', error);
      throw error;
    }
  }

  // Get member achievement progress
  static async getMemberAchievementProgress(memberId: string, achievementId: string): Promise<MemberAchievementProgress | null> {
    if (isDevMode()) {
      return null;
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.ACHIEVEMENT_PROGRESS),
          where('memberId', '==', memberId),
          where('achievementId', '==', achievementId),
          limit(1)
        )
      );
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        ...data,
        lastUpdated: data.lastUpdated?.toDate?.() || new Date(data.lastUpdated),
      } as MemberAchievementProgress;
    } catch (error) {
      console.error('Error fetching member achievement progress:', error);
      throw error;
    }
  }

  // Update member achievement progress
  static async updateMemberAchievementProgress(
    memberId: string,
    achievementId: string,
    currentProgress: number,
    completedMilestones: string[] = []
  ): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Would update progress for member ${memberId}, achievement ${achievementId}: ${currentProgress}`);
      return;
    }

    try {
      const progressData: Omit<MemberAchievementProgress, 'lastUpdated'> & { lastUpdated: any } = {
        memberId,
        achievementId,
        currentProgress,
        completedMilestones,
        lastUpdated: Timestamp.now(),
      };

      // Check if progress record exists
      const existingProgress = await this.getMemberAchievementProgress(memberId, achievementId);
      
      if (existingProgress) {
        // Update existing progress
        const snapshot = await getDocs(
          query(
            collection(db, COLLECTIONS.ACHIEVEMENT_PROGRESS),
            where('memberId', '==', memberId),
            where('achievementId', '==', achievementId),
            limit(1)
          )
        );
        
        if (!snapshot.empty) {
          const docRef = doc(db, COLLECTIONS.ACHIEVEMENT_PROGRESS, snapshot.docs[0].id);
          await updateDoc(docRef, progressData);
        }
      } else {
        // Create new progress record
        await addDoc(collection(db, COLLECTIONS.ACHIEVEMENT_PROGRESS), progressData);
      }
    } catch (error) {
      console.error('Error updating member achievement progress:', error);
      throw error;
    }
  }

  // Calculate achievement progress percentage
  static calculateAchievementProgress(achievement: Achievement, currentProgress: number): number {
    if (!achievement.milestones || achievement.milestones.length === 0) {
      // Fallback to simple criteria-based progress
      if (achievement.criteria.type === 'points_threshold') {
        return Math.min(100, Math.round((currentProgress / achievement.criteria.value) * 100));
      }
      return currentProgress >= achievement.criteria.value ? 100 : 0;
    }

    const milestones = achievement.milestones.sort((a, b) => a.threshold - b.threshold);
    
    // Find completed milestones
    let completedMilestones = 0;
    for (const milestone of milestones) {
      if (currentProgress >= milestone.threshold) {
        completedMilestones++;
      } else {
        break;
      }
    }
    
    // If all milestones are completed, return 100%
    if (completedMilestones === milestones.length) {
      return 100;
    }
    
    // Calculate progress towards the next milestone
    const targetMilestone = milestones[completedMilestones];
    const previousThreshold = completedMilestones > 0 ? milestones[completedMilestones - 1].threshold : 0;
    
    const progressInCurrentMilestone = Math.max(0, currentProgress - previousThreshold);
    const milestoneRange = targetMilestone.threshold - previousThreshold;
    
    return Math.min(100, Math.round((progressInCurrentMilestone / milestoneRange) * 100));
  }

  // Detect completed milestones
  static detectCompletedMilestones(achievement: Achievement, currentProgress: number): AchievementMilestone[] {
    if (!achievement.milestones || achievement.milestones.length === 0) {
      return [];
    }

    return achievement.milestones
      .filter(milestone => currentProgress >= milestone.threshold)
      .sort((a, b) => a.threshold - b.threshold);
  }

  // Distribute milestone rewards
  static async distributeMilestoneRewards(
    memberId: string,
    achievement: Achievement,
    completedMilestones: AchievementMilestone[]
  ): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Would distribute rewards for ${completedMilestones.length} milestones to member ${memberId}`);
      return;
    }

    try {
      for (const milestone of completedMilestones) {
        // Award points if milestone has point value
        if (milestone.pointValue > 0) {
          await PointsService.awardPoints(
            memberId,
            'achievement_milestone',
            milestone.pointValue,
            `Milestone reached: ${achievement.name} - ${milestone.level}`,
            achievement.id!,
            'achievement'
          );
        }

        // Award additional rewards if specified
        if (milestone.reward) {
          // This could be a badge ID, special privilege, etc.
          // For now, we'll log it - in a full implementation, this would trigger other reward systems
          console.log(`Milestone reward awarded: ${milestone.reward} to member ${memberId}`);
        }
      }
    } catch (error) {
      console.error('Error distributing milestone rewards:', error);
      throw error;
    }
  }

  // Check and update achievement progress for a member
  static async checkAndUpdateAchievementProgress(memberId: string, member: Member): Promise<void> {
    try {
      const achievements = await this.getAllAchievements();
      
      for (const achievement of achievements) {
        if (!achievement.id) continue;

        // Calculate current progress based on criteria
        const currentProgress = await this.calculateCurrentProgress(achievement.criteria, memberId, member);
        
        // Get existing progress
        const existingProgress = await this.getMemberAchievementProgress(memberId, achievement.id);
        const previousProgress = existingProgress?.currentProgress || 0;
        const previousCompletedMilestones = existingProgress?.completedMilestones || [];
        
        // Detect newly completed milestones
        const allCompletedMilestones = this.detectCompletedMilestones(achievement, currentProgress);
        const newlyCompletedMilestones = allCompletedMilestones.filter(
          milestone => !previousCompletedMilestones.includes(milestone.level)
        );
        
        // Update progress
        await this.updateMemberAchievementProgress(
          memberId,
          achievement.id,
          currentProgress,
          allCompletedMilestones.map(m => m.level)
        );
        
        // Distribute rewards for newly completed milestones
        if (newlyCompletedMilestones.length > 0) {
          await this.distributeMilestoneRewards(memberId, achievement, newlyCompletedMilestones);
        }
        
        // Check if achievement is fully completed and not yet awarded
        const isFullyCompleted = achievement.milestones 
          ? allCompletedMilestones.length === achievement.milestones.length
          : currentProgress >= achievement.criteria.value;
          
        if (isFullyCompleted && !await this.hasAchievement(memberId, achievement.id)) {
          await this.awardAchievement(memberId, achievement.id);
        }
      }
    } catch (error) {
      console.error('Error checking and updating achievement progress:', error);
      throw error;
    }
  }

  // Calculate current progress based on criteria
  private static async calculateCurrentProgress(
    criteria: AchievementCriteria,
    memberId: string,
    member: Member
  ): Promise<number> {
    try {
      switch (criteria.type) {
        case 'points_threshold':
          return member.points;

        case 'event_count':
          const { EventsService } = await import('./eventsService');
          const allEvents = await EventsService.getAllEvents();
          // In a real implementation, this would check actual attendance records
          // For now, we'll use a simplified approach
          return allEvents.length; // Placeholder

        case 'project_count':
          const { ProjectsService } = await import('./projectsService');
          const allProjects = await ProjectsService.getAllProjects();
          const memberProjects = allProjects.filter(p => 
            p.lead === memberId || (p.team && p.team.includes(memberId))
          );
          return memberProjects.length;

        case 'consecutive_attendance':
          // This would require proper attendance tracking
          return 0; // Placeholder

        case 'role_held':
          return member.role === criteria.conditions?.role ? 1 : 0;

        case 'training_completed':
          // This would require proper training progress tracking
          return 0; // Placeholder

        case 'recruitment_count':
          try {
            const { PointsService: PointsService2 } = await import('./pointsService');
            const pointHistory = await PointsService2.getMemberPoints(memberId);
            const recruitmentTransactions = pointHistory.filter(p => p.category === 'recruitment');
            return recruitmentTransactions.length;
          } catch {
            return 0;
          }

        default:
          return 0;
      }
    } catch (error) {
      console.error('Error calculating current progress:', error);
      return 0;
    }
  }
  static getDefaultAchievements(): Achievement[] {
    return [
      {
        id: 'first-event',
        name: 'First Steps',
        description: 'Attend your first JCI event',
        icon: '🎯',
        category: 'Event',
        tier: 'Bronze',
        pointsReward: 50,
        criteria: {
          type: 'event_count',
          value: 1,
          timeframe: 'lifetime',
        },
        active: true,
        milestones: [
          {
            level: 'Bronze',
            threshold: 1,
            pointValue: 50,
          }
        ],
      },
      {
        id: 'event-enthusiast',
        name: 'Event Enthusiast',
        description: 'Attend multiple events',
        icon: '🎉',
        category: 'Event',
        tier: 'Gold',
        pointsReward: 0, // Points awarded through milestones
        criteria: {
          type: 'event_count',
          value: 25,
          timeframe: 'lifetime',
        },
        active: true,
        milestones: [
          {
            level: 'Bronze',
            threshold: 5,
            pointValue: 100,
          },
          {
            level: 'Silver',
            threshold: 10,
            pointValue: 150,
          },
          {
            level: 'Gold',
            threshold: 25,
            pointValue: 250,
          }
        ],
      },
      {
        id: 'project-leader',
        name: 'Project Leader',
        description: 'Lead multiple projects',
        icon: '🚀',
        category: 'Project',
        tier: 'Platinum',
        pointsReward: 0, // Points awarded through milestones
        criteria: {
          type: 'project_count',
          value: 10,
          timeframe: 'lifetime',
        },
        active: true,
        milestones: [
          {
            level: 'Bronze',
            threshold: 1,
            pointValue: 200,
          },
          {
            level: 'Silver',
            threshold: 3,
            pointValue: 300,
          },
          {
            level: 'Gold',
            threshold: 5,
            pointValue: 400,
          },
          {
            level: 'Platinum',
            threshold: 10,
            pointValue: 500,
          }
        ],
      },
      {
        id: 'points-milestone-500',
        name: 'Rising Star',
        description: 'Reach 500 points',
        icon: '⭐',
        category: 'Milestone',
        tier: 'Silver',
        pointsReward: 0,
        criteria: {
          type: 'points_threshold',
          value: 500,
        },
        active: true,
        milestones: [
          {
            level: 'Silver',
            threshold: 500,
            pointValue: 0,
            reward: 'Rising Star Badge',
          }
        ],
      },
      {
        id: 'points-milestone-1000',
        name: 'Shining Bright',
        description: 'Reach 1000 points',
        icon: '✨',
        category: 'Milestone',
        tier: 'Gold',
        pointsReward: 0,
        criteria: {
          type: 'points_threshold',
          value: 1000,
        },
        active: true,
        milestones: [
          {
            level: 'Gold',
            threshold: 1000,
            pointValue: 0,
            reward: 'Shining Star Badge',
          }
        ],
      },
      {
        id: 'recruiter',
        name: 'Recruiter',
        description: 'Recruit new members',
        icon: '👥',
        category: 'Recruitment',
        tier: 'Gold',
        pointsReward: 0, // Points awarded through milestones
        criteria: {
          type: 'recruitment_count',
          value: 10,
          timeframe: 'lifetime',
        },
        active: true,
        milestones: [
          {
            level: 'Bronze',
            threshold: 1,
            pointValue: 100,
          },
          {
            level: 'Silver',
            threshold: 5,
            pointValue: 200,
          },
          {
            level: 'Gold',
            threshold: 10,
            pointValue: 300,
          }
        ],
      },
      {
        id: 'perfect-attendance',
        name: 'Perfect Attendance',
        description: 'Attend consecutive events',
        icon: '🔥',
        category: 'Event',
        tier: 'Silver',
        pointsReward: 0, // Points awarded through milestones
        criteria: {
          type: 'consecutive_attendance',
          value: 10,
        },
        active: true,
        milestones: [
          {
            level: 'Bronze',
            threshold: 3,
            pointValue: 75,
          },
          {
            level: 'Silver',
            threshold: 5,
            pointValue: 150,
          },
          {
            level: 'Gold',
            threshold: 10,
            pointValue: 300,
          }
        ],
      },
    ];
  }
}

