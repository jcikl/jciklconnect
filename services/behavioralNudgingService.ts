// Behavioral Nudging Service - Positive reinforcement and inactivity warnings
import { Member } from '../types';
import { isDevMode } from '../utils/devMode';
import { MembersService } from './membersService';
import { EventsService } from './eventsService';
import { ProjectsService } from './projectsService';
import { CommunicationService } from './communicationService';
import { PointsService } from './pointsService';

export interface Nudge {
  id: string;
  memberId: string;
  type: 'positive_reinforcement' | 'inactivity_warning' | 'opportunity_suggestion' | 'goal_reminder';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  actionUrl?: string;
  actionLabel?: string;
  createdAt: Date;
  dismissed: boolean;
}

export interface NudgeRule {
  id: string;
  name: string;
  description: string;
  condition: {
    type: 'points_threshold' | 'attendance_rate' | 'days_inactive' | 'goal_progress' | 'tier_upgrade';
    value: number;
    operator: 'greater_than' | 'less_than' | 'equals';
  };
  nudgeType: Nudge['type'];
  title: string;
  message: string;
  priority: Nudge['priority'];
  isActive: boolean;
}

export class BehavioralNudgingService {
  // Check and generate nudges for a member
  static async checkAndGenerateNudges(memberId: string): Promise<Nudge[]> {
    if (isDevMode()) {
      return this.getMockNudges(memberId);
    }

    try {
      const member = await MembersService.getMemberById(memberId);
      if (!member) return [];

      const nudges: Nudge[] = [];

      // 1. Positive Reinforcement - Points milestones
      if (member.points >= 100 && member.points < 150) {
        nudges.push({
          id: `nudge-${memberId}-points-100`,
          memberId,
          type: 'positive_reinforcement',
          title: '🎉 Congratulations! You\'ve reached 100 points!',
          message: 'You\'re doing great! Keep up the excellent work and continue engaging with the LO.',
          priority: 'medium',
          createdAt: new Date(),
          dismissed: false,
        });
      }

      // 2. Inactivity Warning - Low attendance
      if (member.attendanceRate < 50) {
        nudges.push({
          id: `nudge-${memberId}-attendance-low`,
          memberId,
          type: 'inactivity_warning',
          title: '📅 We miss you at events!',
          message: `Your attendance rate is ${member.attendanceRate}%. Consider joining upcoming events to stay engaged with the community.`,
          priority: 'high',
          actionUrl: '/events',
          actionLabel: 'View Events',
          createdAt: new Date(),
          dismissed: false,
        });
      }

      // 3. Opportunity Suggestion - Based on skills
      if (member.skills && member.skills.length > 0) {
        const allProjects = await ProjectsService.getAllProjects();
        const relevantProjects = allProjects.filter(p => 
          p.status === 'Active' && 
          member.skills.some(skill => p.description?.toLowerCase().includes(skill.toLowerCase()))
        );

        if (relevantProjects.length > 0) {
          nudges.push({
            id: `nudge-${memberId}-project-opportunity`,
            memberId,
            type: 'opportunity_suggestion',
            title: '💡 Project Opportunity for You!',
            message: `We found ${relevantProjects.length} project(s) that match your skills. Consider joining to contribute and earn more points!`,
            priority: 'medium',
            actionUrl: '/projects',
            actionLabel: 'View Projects',
            createdAt: new Date(),
            dismissed: false,
          });
        }
      }

      // 4. Goal Reminder - Tier upgrade progress
      const nextTier = this.getNextTier(member.tier);
      if (nextTier) {
        const pointsNeeded = nextTier.minPoints - member.points;
        if (pointsNeeded > 0 && pointsNeeded <= 100) {
          nudges.push({
            id: `nudge-${memberId}-tier-upgrade`,
            memberId,
            type: 'goal_reminder',
            title: `🏆 You're ${pointsNeeded} points away from ${nextTier.name}!`,
            message: `Keep engaging to reach the ${nextTier.name} tier and unlock exclusive benefits.`,
            priority: 'low',
            actionUrl: '/gamification',
            actionLabel: 'View Points',
            createdAt: new Date(),
            dismissed: false,
          });
        }
      }

      // 5. Positive Reinforcement - Recent activity
      const recentPoints = await PointsService.getMemberPointHistory(memberId, 7); // Last 7 days
      if (recentPoints.length >= 3) {
        nudges.push({
          id: `nudge-${memberId}-recent-activity`,
          memberId,
          type: 'positive_reinforcement',
          title: '⭐ Great activity this week!',
          message: `You've earned points from ${recentPoints.length} activities this week. Your engagement is making a difference!`,
          priority: 'low',
          createdAt: new Date(),
          dismissed: false,
        });
      }

      return nudges;
    } catch (error) {
      console.error('Error generating nudges:', error);
      return [];
    }
  }

  // Get all active nudges for a member
  static async getMemberNudges(memberId: string): Promise<Nudge[]> {
    if (isDevMode()) {
      return this.getMockNudges(memberId);
    }

    // In production, this would fetch from a 'nudges' collection
    // For now, we generate them on-the-fly
    return this.checkAndGenerateNudges(memberId);
  }

  // Dismiss a nudge
  static async dismissNudge(nudgeId: string, memberId: string): Promise<void> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would dismiss nudge:', nudgeId);
      return;
    }

    // In production, update the nudge in Firestore
    // For now, this is handled client-side
  }

  // Send nudges as notifications
  static async sendNudgesAsNotifications(memberId: string): Promise<void> {
    if (isDevMode()) {
      return;
    }

    try {
      const nudges = await this.checkAndGenerateNudges(memberId);
      const undismissedNudges = nudges.filter(n => !n.dismissed);

      for (const nudge of undismissedNudges) {
        await CommunicationService.createNotification({
          memberId,
          title: nudge.title,
          message: nudge.message,
          type: nudge.priority === 'high' ? 'warning' : 'info',
        });
      }
    } catch (error) {
      console.error('Error sending nudges as notifications:', error);
    }
  }

  // Helper: Get next tier
  private static getNextTier(currentTier: string): { name: string; minPoints: number } | null {
    const tiers = [
      { name: 'Bronze', minPoints: 0 },
      { name: 'Silver', minPoints: 500 },
      { name: 'Gold', minPoints: 1000 },
      { name: 'Platinum', minPoints: 2000 },
    ];

    const currentIndex = tiers.findIndex(t => t.name === currentTier);
    if (currentIndex >= 0 && currentIndex < tiers.length - 1) {
      return tiers[currentIndex + 1];
    }
    return null;
  }

  // Mock nudges for dev mode
  private static getMockNudges(memberId: string): Nudge[] {
    return [
      {
        id: 'mock-nudge-1',
        memberId,
        type: 'positive_reinforcement',
        title: '🎉 Great job this week!',
        message: 'You\'ve been very active. Keep up the excellent work!',
        priority: 'low',
        createdAt: new Date(),
        dismissed: false,
      },
    ];
  }

  // CRUD operations for Nudge Rules
  static async createNudgeRule(rule: Omit<NudgeRule, 'id'>): Promise<string> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would create nudge rule:', rule);
      return 'mock-nudge-rule-id';
    }

    try {
      const { collection, addDoc, Timestamp } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      const { COLLECTIONS } = await import('../config/constants');

      const docRef = await addDoc(collection(db, COLLECTIONS.NUDGE_RULES), {
        ...rule,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      return docRef.id;
    } catch (error) {
      console.error('Error creating nudge rule:', error);
      throw error;
    }
  }

  static async getAllNudgeRules(): Promise<NudgeRule[]> {
    if (isDevMode()) {
      return [
        {
          id: 'rule-1',
          name: 'Low Attendance Warning',
          description: 'Warn members with attendance rate below 50%',
          condition: {
            type: 'attendance_rate',
            value: 50,
            operator: 'less_than',
          },
          nudgeType: 'inactivity_warning',
          title: '📅 We miss you at events!',
          message: 'Your attendance rate is below average. Consider joining upcoming events.',
          priority: 'high',
          isActive: true,
        },
      ];
    }

    try {
      const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      const { COLLECTIONS } = await import('../config/constants');

      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.NUDGE_RULES), orderBy('createdAt', 'desc'))
      );

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as NudgeRule[];
    } catch (error) {
      console.error('Error getting nudge rules:', error);
      throw error;
    }
  }

  static async updateNudgeRule(ruleId: string, updates: Partial<NudgeRule>): Promise<void> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would update nudge rule:', ruleId, updates);
      return;
    }

    try {
      const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      const { COLLECTIONS } = await import('../config/constants');

      await updateDoc(doc(db, COLLECTIONS.NUDGE_RULES, ruleId), {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating nudge rule:', error);
      throw error;
    }
  }

  static async deleteNudgeRule(ruleId: string): Promise<void> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would delete nudge rule:', ruleId);
      return;
    }

    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      const { COLLECTIONS } = await import('../config/constants');

      await deleteDoc(doc(db, COLLECTIONS.NUDGE_RULES, ruleId));
    } catch (error) {
      console.error('Error deleting nudge rule:', error);
      throw error;
    }
  }
}

