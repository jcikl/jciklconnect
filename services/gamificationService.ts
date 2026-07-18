// gamificationService.ts - Unified Service for Awards (Achievements + Badges)
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    arrayUnion,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { withDevMode } from '../utils/devMode';
import { calculateAwardProgress as calculateAwardProgressUtil } from '../utils/gamificationUtils';
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
     *
     * TODO: AwardMilestone.reward field is not surfaced in the badge creation form.
     *       When the form is extended, ensure milestones[].reward is written here
     *       alongside milestones[].threshold, milestones[].level, and milestones[].pointValue. (P1-D)
     */
    static async createAward(awardData: Omit<AwardDefinition, 'id'>): Promise<string> {
        return withDevMode(
            () => 'mock-new-award-id',
            async () => {
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
        );
    }

    /**
     * Update an existing award definition.
     */
    static async updateAward(awardId: string, awardData: Partial<AwardDefinition>): Promise<void> {
        return withDevMode(
            () => {},
            async () => {
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
        );
    }

    /**
     * Delete an award definition (soft delete by setting active to false).
     */
    static async deleteAward(awardId: string): Promise<void> {
        return withDevMode(
            () => {},
            async () => {
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
        );
    }

    /**
     * Fetch all active award definitions.
     * In this unified model, an Award is both the challenge (Achievement) and the reward (Badge).
     */
    static async getAllAwards(): Promise<AwardDefinition[]> {
        return withDevMode(
            () => this.getMockAwards(),
            async () => {
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
        );
    }

    /**
     * Award a specific recognition to a member.
     * This handles point distribution and updating the member's profile.
     *
     * Write ordering:
     *   Batch 1 (atomic): badgeAwards record + member.badges array update
     *   Separate: PointsService.awardPoints — kept outside batch due to its own
     *             internal complexity; failure is logged but does not roll back the badge.
     */
    static async awardAward(
        awardId: string,
        memberId: string,
        awardedBy: string = 'system',
        reason?: string,
        metadata?: Record<string, any>
    ): Promise<string> {
        return withDevMode(
            () => 'mock-award-id',
            async () => {
                try {
                    const award = await this.getAwardById(awardId);
                    if (!award) throw new Error('Award definition not found');

                    // Read member data before opening the batch (needed to build the
                    // UserBadge object and check for duplicates)
                    const { MembersService } = await import('./membersService');
                    const member = await MembersService.getMemberById(memberId);
                    const currentBadges = member?.badges || [];
                    const alreadyAwarded = currentBadges.some(b => b.id === awardId);

                    // --- Atomic batch: write 1 (badge award record) + write 3 (member badges) ---
                    const batch = writeBatch(db);

                    // Write 1: Create the badge award record
                    const awardData: Omit<MemberAward, 'id'> = {
                        awardId,
                        memberId,
                        earnedAt: Timestamp.now(),
                        awardedBy,
                        reason: reason || `Earned award: ${award.name}`,
                        metadata,
                        progress: 100, // Fully earned
                    };
                    // Fix 2 (P1): deterministic doc ID prevents concurrent checkEligibleBadgesForMember
                    // calls from both awarding the same badge — last-write-wins on the same doc ID.
                    const badgeAwardRef = doc(db, COLLECTIONS.BADGE_AWARDS, `${memberId}_${awardId}`);
                    batch.set(badgeAwardRef, awardData);

                    // Fix 1 (P0): badges arrayUnion always runs when !alreadyAwarded, regardless of pointsReward.
                    // Points and tier increment are gated on pointsReward > 0 separately.
                    if (!alreadyAwarded) {
                        const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
                        const userBadge: UserBadge = {
                            id: awardId,
                            name: award.name,
                            icon: award.icon,
                            description: award.description,
                            earnedDate: new Date().toISOString()
                        };
                        // Always append badge
                        batch.update(memberRef, { badges: arrayUnion(userBadge), updatedAt: Timestamp.now() });

                        if (award.pointsReward > 0 && member) {
                            const currentPoints: number = (member as any).points || 0;
                            const newPoints = currentPoints + award.pointsReward;
                            // TODO: Tier computed from pre-batch member snapshot may be stale if concurrent
                            // awardPoints commits between this read and batch.commit(). Refactor to runTransaction
                            // for fully atomic tier computation (see approveClaim TODO for the pattern).
                            const newTier = PointsService.calculateTier(newPoints);

                            // Merge points increment + tier into a second update on the same doc (Firestore merges within batch)
                            batch.update(memberRef, {
                                points: increment(award.pointsReward),
                                tier: newTier,
                            });

                            // Fix 1 (P1): points TX record only written when this is a genuinely new award.
                            // Moving this inside !alreadyAwarded prevents ghost TX records when alreadyAwarded=true.
                            const pointsTxRef = doc(collection(db, COLLECTIONS.POINTS));
                            batch.set(pointsTxRef, {
                                memberId,
                                points: award.pointsReward,
                                amount: award.pointsReward,
                                category: 'achievement',
                                description: `Award unlocked: ${award.name}`,
                                relatedEntityId: awardId,
                                relatedEntityType: 'award',
                                createdAt: Timestamp.now(),
                            });
                        }
                    }

                    await batch.commit();

                    // Best-effort notification — must not roll back the committed badge
                    try {
                        const { CommunicationService } = await import('./communicationService');
                        await CommunicationService.createNotification({
                            memberId,
                            title: 'Badge Awarded',
                            message: `You have been awarded the "${award.name}" badge!`,
                            type: 'success',
                        });
                    } catch (notifErr) {
                        console.warn('[awardAward] Notification failed after badge committed:', notifErr);
                    }

                    return badgeAwardRef.id;
                } catch (error) {
                    console.error('Error awarding recognition:', error);
                    throw error;
                }
            }
        );
    }

    /**
     * For each active award definition, resolve the member's current progress value
     * for that criteria type, then award any badge whose threshold is newly crossed
     * and has not already been awarded to this member.
     *
     * Supported criteria types: points_threshold, event_count / event_attendance,
     * project_count / project_completion.
     * Unsupported types (consecutive_attendance, role_held, training_completed,
     * recruitment_count) are silently skipped — they require richer data sources.
     */
    static async checkEligibleBadgesForMember(memberId: string): Promise<void> {
        const [awards, existingAwardsSnap, memberDoc] = await Promise.all([
            GamificationService.getAllAwards(),
            getDocs(query(
                collection(db, COLLECTIONS.BADGE_AWARDS),
                where('memberId', '==', memberId)
            )),
            (async () => {
                const { MembersService } = await import('./membersService');
                return MembersService.getMemberById(memberId);
            })(),
        ]);

        const alreadyAwardedIds = new Set(existingAwardsSnap.docs.map(d => d.data().awardId));
        const memberPoints: number = (memberDoc as any)?.points || 0;

        for (const award of awards) {
            if (!award.id || alreadyAwardedIds.has(award.id)) continue;

            const criteriaType = award.criteria?.type;
            let progressValue = 0;

            if (criteriaType === 'points_threshold') {
                progressValue = memberPoints;
            } else if (criteriaType === 'event_count' || criteriaType === 'event_attendance') {
                // P1 fix: query EVENT_REGISTRATIONS for checked-in attendances instead of
                // counting points transactions (points may be awarded for reasons unrelated
                // to actual event attendance, inflating the count).
                const snap = await getDocs(query(
                    collection(db, COLLECTIONS.EVENT_REGISTRATIONS),
                    where('memberId', '==', memberId),
                    where('status', '==', 'checked_in')
                ));
                progressValue = snap.size;
            } else if (criteriaType === 'project_count' || criteriaType === 'project_completion') {
                const snap = await getDocs(query(
                    collection(db, COLLECTIONS.POINTS),
                    where('memberId', '==', memberId),
                    where('category', '==', 'project_task')
                ));
                progressValue = snap.size;
            } else {
                // Criteria type not yet implemented — skip
                continue;
            }

            if (progressValue >= award.criteria.value) {
                try {
                    await GamificationService.awardAward(award.id, memberId, 'system');
                } catch (err) {
                    console.error('[checkEligibleBadgesForMember] Failed to award badge', award.id, err);
                }
            }
        }
    }

    static async getAwardById(awardId: string): Promise<AwardDefinition | null> {
        return withDevMode(
            () => this.getMockAwards().find(a => a.id === awardId) || null,
            async () => {
                const awardDoc = await getDoc(doc(db, COLLECTIONS.BADGES, awardId));
                if (!awardDoc.exists()) return null;
                return { id: awardDoc.id, ...awardDoc.data() } as AwardDefinition;
            }
        );
    }

    static calculateAwardProgress(award: AwardDefinition, currentProgressValue: number): number {
        // Guard unimplemented criteria types so they return 0 instead of silently
        // falling through to the util with undefined behaviour (P1-C)
        switch (award.criteria?.type) {
            case 'consecutive_attendance':
                console.warn('[GamificationService] consecutive_attendance badge criteria not yet implemented — returning 0 progress');
                return 0;
            case 'role_held':
                console.warn('[GamificationService] role_held badge criteria not yet implemented — returning 0 progress');
                return 0;
            case 'training_completed':
                console.warn('[GamificationService] training_completed badge criteria not yet implemented — returning 0 progress');
                return 0;
            case 'recruitment_count':
                console.warn('[GamificationService] recruitment_count badge criteria not yet implemented — returning 0 progress');
                return 0;
        }
        return calculateAwardProgressUtil(award, currentProgressValue);
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
    /**
     * @deprecated achievements collection has been migrated to the badges collection.
     *             Use awardAward() (or the awardBadge alias) instead. (P2-E)
     */
    static awardAchievement = (memberId: string, awardId: string) => this.awardAward(awardId, memberId);
    /**
     * @deprecated achievements collection has been migrated to the badges collection.
     *             Use getAwardById() instead. (P2-E)
     */
    static getBadgeById = this.getAwardById;
    static getAchievementById = this.getAwardById;
    static calculateAchievementProgress = this.calculateAwardProgress;
}
