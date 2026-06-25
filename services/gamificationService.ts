// gamificationService.ts - Unified Service for Awards (Achievements + Badges)
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
    limit,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import {
    AwardDefinition,
    MemberAward,
    AwardCriteria,
    AwardMilestone,
    Member,
    Badge as UserBadge
} from '../types';
import { PointsService } from './pointsService';

export class GamificationService {
    // === Unified Award Methods ===

    /**
     * Create a new award.
     */
    static async createAward(awardData: Omit<AwardDefinition, 'id'>): Promise<string> {
        if (isDevMode()) return 'mock-new-award-id';
        try {
            const data = {
                ...awardData,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };
            const docRef = await addDoc(collection(db, COLLECTIONS.BADGES), data);
            return docRef.id;
        } catch (error) {
            console.error('Error creating award:', error);
            throw error;
        }
    }

    /**
     * Update an existing award definition.
     */
    static async updateAward(awardId: string, awardData: Partial<AwardDefinition>): Promise<void> {
        if (isDevMode()) return;
        try {
            const data = {
                ...awardData,
                updatedAt: Timestamp.now()
            };
            await updateDoc(doc(db, COLLECTIONS.BADGES, awardId), data);
        } catch (error) {
            console.error('Error updating award:', error);
            throw error;
        }
    }

    /**
     * Delete an award definition (soft delete by setting active to false).
     */
    static async deleteAward(awardId: string): Promise<void> {
        if (isDevMode()) return;
        try {
            await updateDoc(doc(db, COLLECTIONS.BADGES, awardId), {
                active: false,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error('Error deleting award:', error);
            throw error;
        }
    }

    /**
     * Fetch all active award definitions.
     * In this unified model, an Award is both the challenge (Achievement) and the reward (Badge).
     */
    static async getAllAwards(): Promise<AwardDefinition[]> {
        if (isDevMode()) return this.getMockAwards();
        try {
            // We'll use the 'badges' collection as the unified source for all Awards
            const snapshot = await getDocs(
                query(
                    collection(db, COLLECTIONS.BADGES),
                    where('active', '==', true),
                    orderBy('tier', 'asc'),
                    orderBy('name', 'asc')
                )
            );
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
                updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
            } as AwardDefinition));
        } catch (error) {
            console.error('Error fetching awards:', error);
            throw error;
        }
    }

    /**
     * Award a specific recognition to a member.
     * This handles point distribution and updating the member's profile.
     */
    static async awardAward(
        awardId: string,
        memberId: string,
        awardedBy: string = 'system',
        reason?: string,
        metadata?: Record<string, any>
    ): Promise<string> {
        if (isDevMode()) return 'mock-award-id';
        try {
            const award = await this.getAwardById(awardId);
            if (!award) throw new Error('Award definition not found');

            // 1. Create the award record
            const awardData: Omit<MemberAward, 'id'> = {
                awardId,
                memberId,
                earnedAt: Timestamp.now(),
                awardedBy,
                reason: reason || `Earned award: ${award.name}`,
                metadata,
                progress: 100, // Fully earned
            };
            const docRef = await addDoc(collection(db, COLLECTIONS.BADGE_AWARDS), awardData);

            // 2. Award points if configured
            if (award.pointsReward > 0) {
                await PointsService.awardPoints(
                    memberId,
                    'achievement',
                    award.pointsReward,
                    `Award unlocked: ${award.name}`
                );
            }

            // 3. Update member's badge list for visual display
            const { MembersService } = await import('./membersService');
            const member = await MembersService.getMemberById(memberId);
            if (member) {
                const userBadge: UserBadge = {
                    id: awardId,
                    name: award.name,
                    icon: award.icon,
                    description: award.description,
                    earnedDate: new Date().toISOString()
                };
                const currentBadges = member.badges || [];
                // Avoid duplicates
                if (!currentBadges.find(b => b.id === awardId)) {
                    await MembersService.updateMember(memberId, {
                        badges: [...currentBadges, userBadge],
                    });
                }
            }

            return docRef.id;
        } catch (error) {
            console.error('Error awarding recognition:', error);
            throw error;
        }
    }

    static async getAwardById(awardId: string): Promise<AwardDefinition | null> {
        if (isDevMode()) return this.getMockAwards().find(a => a.id === awardId) || null;
        const awardDoc = await getDoc(doc(db, COLLECTIONS.BADGES, awardId));
        if (!awardDoc.exists()) return null;
        return { id: awardDoc.id, ...awardDoc.data() } as AwardDefinition;
    }

    /**
     * Calculate progress toward an award based on current member activity.
     */
    static calculateAwardProgress(award: AwardDefinition, currentProgressValue: number): number {
        // If it's a milestone-based award, use milestone logic
        if (award.milestones && award.milestones.length > 0) {
            const sortedMilestones = [...award.milestones].sort((a, b) => a.threshold - b.threshold);
            let lastThreshold = 0;
            let currentTarget = sortedMilestones[0];

            for (const milestone of sortedMilestones) {
                if (currentProgressValue >= milestone.threshold) {
                    lastThreshold = milestone.threshold;
                } else {
                    currentTarget = milestone;
                    break;
                }
            }

            // If all milestones reached
            if (currentProgressValue >= sortedMilestones[sortedMilestones.length - 1].threshold) {
                return 100;
            }

            const range = currentTarget.threshold - lastThreshold;
            const progressInRange = currentProgressValue - lastThreshold;
            return Math.min(100, Math.round((progressInRange / range) * 100));
        }

        // Simple threshold based award
        const threshold = award.criteria.value;
        if (threshold <= 0) return 0;
        return Math.min(100, Math.round((currentProgressValue / threshold) * 100));
    }

    /**
     * Identify which milestones have been completed.
     */
    static detectCompletedMilestones(award: AwardDefinition, currentValue: number): AwardMilestone[] {
        if (!award.milestones) return [];
        return award.milestones
            .filter(m => currentValue >= m.threshold)
            .sort((a, b) => a.threshold - b.threshold);
    }

    // === Mock Data (Updated to Unified Model) ===

    private static getMockAwards(): AwardDefinition[] {
        const now = new Date();
        return [
            {
                id: 'a1',
                name: 'First Steps',
                description: 'Attend your first JCI event',
                icon: '🎯',
                category: 'Event',
                tier: 'Bronze',
                rarity: 'Common',
                pointsReward: 50,
                criteria: { type: 'event_count', value: 1 },
                active: true,
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'a2',
                name: 'Event Enthusiast',
                description: 'Attend multiple events and build your network',
                icon: '🎉',
                category: 'Event',
                tier: 'Silver',
                rarity: 'Rare',
                pointsReward: 200,
                criteria: { type: 'event_count', value: 25 },
                milestones: [
                    { level: 'Bronze', threshold: 5, pointValue: 100 },
                    { level: 'Silver', threshold: 15, pointValue: 150 },
                    { level: 'Gold', threshold: 25, pointValue: 200 }
                ],
                active: true,
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'a3',
                name: 'Project Captain',
                description: 'Lead community projects to success',
                icon: '🚀',
                category: 'Project',
                tier: 'Gold',
                rarity: 'Epic',
                pointsReward: 500,
                criteria: { type: 'project_count', value: 5 },
                active: true,
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'a4',
                name: 'Point Master',
                description: 'Reach high standing in the community',
                icon: '👑',
                category: 'Milestone',
                tier: 'Platinum',
                rarity: 'Legendary',
                pointsReward: 1000,
                criteria: { type: 'points_threshold', value: 5000 },
                active: true,
                createdAt: now,
                updatedAt: now
            }
        ];
    }

    // Backward compatibility aliases
    static getAllBadges = this.getAllAwards;
    static getAllAchievements = this.getAllAwards;
    static awardBadge = this.awardAward;
    static awardAchievement = (memberId: string, awardId: string) => this.awardAward(awardId, memberId);
    static getBadgeById = this.getAwardById;
    static getAchievementById = this.getAwardById;
    static calculateAchievementProgress = this.calculateAwardProgress;
}
