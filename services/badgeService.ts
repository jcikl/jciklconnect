// Badge Service - Manages achievement badges and awards
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import { Badge } from '../types';

export interface BadgeDefinition {
  id?: string;
  name: string;
  description: string;
  icon: string; // Emoji or icon identifier
  category: 'achievement' | 'milestone' | 'special' | 'event' | 'leadership';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'legendary';
  pointsRequired?: number; // Points needed to earn this badge
  criteria: BadgeCriteria;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  pointValue: number; // Points awarded when badge is earned
  isActive: boolean;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface BadgeCriteria {
  type: 'event_attendance' | 'project_completion' | 'points_threshold' | 'custom';
  threshold: number;
  conditions: Record<string, any>;
}

export interface BadgeAward {
  id?: string;
  badgeId: string;
  memberId: string;
  awardedAt: Date | Timestamp;
  awardedBy?: string; // System or admin ID
  reason?: string;
  metadata?: Record<string, any>;
}

export class BadgeService {
  // Get all badge definitions
  static async getAllBadges(): Promise<BadgeDefinition[]> {
    if (isDevMode()) {
      return this.getMockBadges();
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.BADGES),
          where('isActive', '==', true),
          orderBy('tier', 'asc'),
          orderBy('name', 'asc')
        )
      );

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      } as BadgeDefinition));
    } catch (error) {
      console.error('Error fetching badges:', error);
      throw error;
    }
  }

  // Get badges by category
  static async getBadgesByCategory(category: BadgeDefinition['category']): Promise<BadgeDefinition[]> {
    const allBadges = await this.getAllBadges();
    return allBadges.filter(b => b.category === category);
  }

  // Get badges by tier
  static async getBadgesByTier(tier: BadgeDefinition['tier']): Promise<BadgeDefinition[]> {
    const allBadges = await this.getAllBadges();
    return allBadges.filter(b => b.tier === tier);
  }

  // Create a new badge definition
  static async createBadge(badge: Omit<BadgeDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would create badge:', badge);
      return 'mock-badge-id';
    }

    try {
      const badgeData = {
        ...badge,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.BADGES), badgeData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating badge:', error);
      throw error;
    }
  }

  // Update a badge definition
  static async updateBadge(badgeId: string, updates: Partial<BadgeDefinition>): Promise<void> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would update badge:', badgeId, updates);
      return;
    }

    try {
      const badgeRef = doc(db, COLLECTIONS.BADGES, badgeId);
      await updateDoc(badgeRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating badge:', error);
      throw error;
    }
  }

  // Delete a badge definition
  static async deleteBadge(badgeId: string): Promise<void> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would delete badge:', badgeId);
      return;
    }

    try {
      // Soft delete by setting isActive to false
      await this.updateBadge(badgeId, { isActive: false });
    } catch (error) {
      console.error('Error deleting badge:', error);
      throw error;
    }
  }

  // Award a badge to a member
  static async awardBadge(
    badgeId: string,
    memberId: string,
    awardedBy?: string,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would award badge:', { badgeId, memberId, reason });
      return 'mock-award-id';
    }

    try {
      // Check if member already has this badge
      const existingAward = await this.getMemberBadgeAward(memberId, badgeId);
      if (existingAward) {
        throw new Error('Member already has this badge');
      }

      const awardData: Omit<BadgeAward, 'id'> = {
        badgeId,
        memberId,
        awardedAt: Timestamp.now(),
        awardedBy,
        reason,
        metadata,
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.BADGE_AWARDS), awardData);

      // Import MembersService to update member's badges
      const { MembersService } = await import('./membersService');
      const member = await MembersService.getMemberById(memberId);
      
      if (member) {
        const badge = await this.getBadgeById(badgeId);
        if (badge) {
          const newBadge: Badge = {
            id: badgeId,
            name: badge.name,
            icon: badge.icon,
            description: badge.description,
          };

          const currentBadges = member.badges || [];
          await MembersService.updateMember(memberId, {
            badges: [...currentBadges, newBadge],
          });

          // Send notification about badge award
          await this.sendBadgeAwardNotification(memberId, badge);
        }
      }

      return docRef.id;
    } catch (error) {
      console.error('Error awarding badge:', error);
      throw error;
    }
  }

  // Get badge by ID
  static async getBadgeById(badgeId: string): Promise<BadgeDefinition | null> {
    if (isDevMode()) {
      const mockBadges = this.getMockBadges();
      return mockBadges.find(b => b.id === badgeId) || null;
    }

    try {
      const badgeDoc = await getDoc(doc(db, COLLECTIONS.BADGES, badgeId));
      if (!badgeDoc.exists()) {
        return null;
      }

      return {
        id: badgeDoc.id,
        ...badgeDoc.data(),
        createdAt: badgeDoc.data().createdAt?.toDate?.() || badgeDoc.data().createdAt,
        updatedAt: badgeDoc.data().updatedAt?.toDate?.() || badgeDoc.data().updatedAt,
      } as BadgeDefinition;
    } catch (error) {
      console.error('Error fetching badge:', error);
      return null;
    }
  }

  // Get all badges awarded to a member
  static async getMemberBadges(memberId: string): Promise<Array<BadgeDefinition & { awardedAt: Date }>> {
    if (isDevMode()) {
      return [];
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.BADGE_AWARDS),
          where('memberId', '==', memberId),
          orderBy('awardedAt', 'desc')
        )
      );

      const awards = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        awardedAt: doc.data().awardedAt?.toDate?.() || doc.data().awardedAt,
      } as BadgeAward));

      // Fetch badge definitions for each award
      const badgesWithAwards = await Promise.all(
        awards.map(async (award) => {
          const badge = await this.getBadgeById(award.badgeId);
          if (badge) {
            return {
              ...badge,
              awardedAt: award.awardedAt as Date,
            };
          }
          return null;
        })
      );

      return badgesWithAwards.filter(Boolean) as Array<BadgeDefinition & { awardedAt: Date }>;
    } catch (error) {
      console.error('Error fetching member badges:', error);
      throw error;
    }
  }

  // Get specific badge award for a member
  static async getMemberBadgeAward(memberId: string, badgeId: string): Promise<BadgeAward | null> {
    if (isDevMode()) {
      return null;
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.BADGE_AWARDS),
          where('memberId', '==', memberId),
          where('badgeId', '==', badgeId)
        )
      );

      if (snapshot.empty) {
        return null;
      }

      const award = snapshot.docs[0];
      return {
        id: award.id,
        ...award.data(),
        awardedAt: award.data().awardedAt?.toDate?.() || award.data().awardedAt,
      } as BadgeAward;
    } catch (error) {
      console.error('Error fetching badge award:', error);
      return null;
    }
  }

  // Check and award badges based on member activity (called by automation)
  static async checkAndAwardBadges(memberId: string): Promise<string[]> {
    if (isDevMode()) {
      return [];
    }

    try {
      const { MembersService } = await import('./membersService');
      const { EventsService } = await import('./eventsService');
      const { ProjectsService } = await import('./projectsService');

      const member = await MembersService.getMemberById(memberId);
      if (!member) return [];

      const allBadges = await this.getAllBadges();
      const awardedBadgeIds: string[] = [];

      for (const badge of allBadges) {
        // Skip if member already has this badge
        const existingAward = await this.getMemberBadgeAward(memberId, badge.id!);
        if (existingAward) continue;

        let shouldAward = false;

        // Check criteria based on type
        switch (badge.criteria.type) {
          case 'points_threshold':
            if (member.points >= badge.criteria.threshold) {
              shouldAward = true;
            }
            break;

          case 'event_attendance':
            // Check if member has attended enough events
            const events = await EventsService.getAllEvents();
            const attendedEventsCount = this.countMemberEventAttendance(events, memberId);
            if (attendedEventsCount >= badge.criteria.threshold) {
              shouldAward = true;
            }
            break;

          case 'project_completion':
            // Check if member has completed enough projects
            const projects = await ProjectsService.getAllProjects();
            const completedProjectsCount = this.countMemberProjectCompletions(projects, memberId);
            if (completedProjectsCount >= badge.criteria.threshold) {
              shouldAward = true;
            }
            break;

          case 'custom':
            // Custom criteria evaluation based on conditions
            shouldAward = await this.evaluateCustomCriteria(badge.criteria, member);
            break;
        }

        if (shouldAward) {
          try {
            await this.awardBadge(
              badge.id!, 
              memberId, 
              'system', 
              `Automatically earned by meeting criteria: ${badge.criteria.type} >= ${badge.criteria.threshold}`
            );
            awardedBadgeIds.push(badge.id!);
          } catch (error) {
            console.error(`Error awarding badge ${badge.id} to member ${memberId}:`, error);
          }
        }
      }

      return awardedBadgeIds;
    } catch (error) {
      console.error('Error checking and awarding badges:', error);
      return [];
    }
  }

  // Helper method to count member event attendance
  private static countMemberEventAttendance(events: any[], memberId: string): number {
    // This would need to check actual attendance records
    // For now, simplified implementation
    return events.filter(event => {
      // Check if member attended this event
      // This would typically check an attendance collection
      return event.attendees && event.attendees.includes(memberId);
    }).length;
  }

  // Helper method to count member project completions
  private static countMemberProjectCompletions(projects: any[], memberId: string): number {
    return projects.filter(project => {
      return (project.team?.includes(memberId) || project.lead === memberId) && 
             project.status === 'Completed';
    }).length;
  }

  // Helper method to evaluate custom criteria
  private static async evaluateCustomCriteria(criteria: BadgeCriteria, member: any): Promise<boolean> {
    // Implement custom criteria evaluation based on conditions
    const conditions = criteria.conditions || {};
    
    // Example custom criteria evaluations
    if (conditions.membershipDuration) {
      const joinDate = new Date(member.joinDate);
      const monthsSinceJoining = (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsSinceJoining >= conditions.membershipDuration) {
        return true;
      }
    }

    if (conditions.roleHeld && member.role === conditions.roleHeld) {
      return true;
    }

    if (conditions.tierReached && member.tier === conditions.tierReached) {
      return true;
    }

    return false;
  }

  // Send notification when badge is awarded
  private static async sendBadgeAwardNotification(memberId: string, badge: BadgeDefinition): Promise<void> {
    try {
      // Import notification service
      const { addDoc, collection } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      
      const notification = {
        memberId,
        title: `🎉 Badge Earned: ${badge.name}`,
        message: `Congratulations! You've earned the "${badge.name}" badge. ${badge.description}`,
        type: 'success',
        read: false,
        timestamp: new Date().toISOString(),
      };

      await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), notification);
    } catch (error) {
      console.error('Error sending badge award notification:', error);
      // Don't throw error as notification failure shouldn't prevent badge awarding
    }
  }

  // Mock badges for dev mode
  private static getMockBadges(): BadgeDefinition[] {
    return [
      {
        id: 'b1',
        name: 'First Steps',
        description: 'Attended your first event',
        icon: '🎯',
        category: 'milestone',
        tier: 'bronze',
        criteria: { 
          type: 'event_attendance', 
          threshold: 1, 
          conditions: { eventType: 'any' } 
        },
        rarity: 'common',
        pointValue: 50,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b2',
        name: 'Social Butterfly',
        description: 'Attended 10 social events',
        icon: '🦋',
        category: 'achievement',
        tier: 'silver',
        criteria: { 
          type: 'event_attendance', 
          threshold: 10, 
          conditions: { eventType: 'Social' } 
        },
        rarity: 'rare',
        pointValue: 200,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b3',
        name: 'Project Leader',
        description: 'Led a successful project',
        icon: '🚀',
        category: 'leadership',
        tier: 'gold',
        criteria: { 
          type: 'project_completion', 
          threshold: 1, 
          conditions: { role: 'lead' } 
        },
        rarity: 'epic',
        pointValue: 500,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b4',
        name: 'Point Master',
        description: 'Reached 1000 points',
        icon: '⭐',
        category: 'achievement',
        tier: 'gold',
        criteria: { 
          type: 'points_threshold', 
          threshold: 1000, 
          conditions: {} 
        },
        rarity: 'epic',
        pointValue: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }
}

