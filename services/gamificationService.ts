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
    runTransaction,
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
import { apiCache } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

const BADGES_CACHE_PREFIX = 'gamification:badges:';
const BADGES_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export class GamificationService {
    // === Cache helpers ===

    static invalidateBadgesCache(): void {
        apiCache.deleteByPrefix(BADGES_CACHE_PREFIX);
    }

    static invalidateAchievementsCache(): void {
        // achievements are stored in the same badges collection
        this.invalidateBadgesCache();
    }

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
                    GamificationService.invalidateBadgesCache();
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
                    GamificationService.invalidateBadgesCache();

                    // P2 fix: when name or icon changes, sync the denormalised UserBadge
                    // objects stored in each member's badges[] array.
                    if (awardData.name !== undefined || awardData.icon !== undefined) {
                        try {
                            // Find all members who have been awarded this badge
                            const awardsSnap = await getDocs(
                                query(
                                    collection(db, COLLECTIONS.BADGE_AWARDS),
                                    where('awardId', '==', awardId)
                                )
                            );
                            if (!awardsSnap.empty) {
                                const memberIds = [...new Set(awardsSnap.docs.map(d => d.data().memberId as string))];
                                // Batch update member.badges[] — replace old entry with updated one.
                                // Firestore does not support arrayRemove + arrayUnion by partial match,
                                // so we read each member doc and rewrite the badges[] array.
                                const batch = writeBatch(db);
                                const memberDocs = await Promise.all(
                                    memberIds.map(mid => getDoc(doc(db, COLLECTIONS.MEMBERS, mid)))
                                );
                                for (const memberSnap of memberDocs) {
                                    if (!memberSnap.exists()) continue;
                                    const existing: UserBadge[] = memberSnap.data().badges || [];
                                    const updated = existing.map(b => {
                                        if (b.id !== awardId) return b;
                                        return {
                                            ...b,
                                            ...(awardData.name !== undefined ? { name: awardData.name } : {}),
                                            ...(awardData.icon !== undefined ? { icon: awardData.icon } : {}),
                                        };
                                    });
                                    batch.update(memberSnap.ref, { badges: updated, updatedAt: Timestamp.now() });
                                }
                                await batch.commit();
                            }
                        } catch (syncErr) {
                            // Non-fatal: log but don't roll back the definition update
                            errorLoggingService.logError(syncErr as Error, {
                                action: 'GamificationService.updateAward → sync member badges[]',
                                additionalData: { awardId },
                            });
                        }
                    }
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
                    GamificationService.invalidateBadgesCache();
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
                const cacheKey = `${BADGES_CACHE_PREFIX}all`;
                const cached = apiCache.get<AwardDefinition[]>(cacheKey);
                if (cached) return cached;
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
                    const result = snapshot.docs.map(d => ({
                        id: d.id,
                        ...d.data(),
                        createdAt: d.data().createdAt?.toDate?.() || d.data().createdAt,
                        updatedAt: d.data().updatedAt?.toDate?.() || d.data().updatedAt,
                    } as AwardDefinition));
                    apiCache.set(cacheKey, result, BADGES_CACHE_TTL);
                    return result;
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

                    const awardData: Omit<MemberAward, 'id'> = {
                        awardId,
                        memberId,
                        earnedAt: Timestamp.now(),
                        awardedBy,
                        reason: reason || `Earned award: ${award.name}`,
                        metadata,
                        progress: 100, // Fully earned
                    };
                    // Deterministic doc ID — used inside the transaction as the existence check.
                    const badgeAwardRef = doc(db, COLLECTIONS.BADGE_AWARDS, `${memberId}_${awardId}`);
                    const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
                    const userBadge: UserBadge = {
                        id: awardId,
                        name: award.name,
                        icon: award.icon,
                        description: award.description,
                        earnedDate: new Date().toISOString()
                    };

                    // P1 fix: single runTransaction covers badge-grant + member.badges update
                    // + points increment, so all three are atomically consistent.
                    // Previously two separate transactions left a window where the badge
                    // was committed but points had not yet been credited.
                    let isNewAward = false;
                    await runTransaction(db, async (txn) => {
                        const [existing, memberSnap] = await Promise.all([
                            txn.get(badgeAwardRef),
                            txn.get(memberRef),
                        ]);
                        if (existing.exists()) {
                            // Already awarded — idempotent no-op.
                            return;
                        }
                        isNewAward = true;
                        txn.set(badgeAwardRef, awardData);
                        txn.update(memberRef, { badges: arrayUnion(userBadge), updatedAt: Timestamp.now() });

                        if (award.pointsReward > 0) {
                            const currentPoints = memberSnap.exists()
                                ? (memberSnap.data()?.points || 0)
                                : 0;
                            const newTier = PointsService.calculateTier(currentPoints + award.pointsReward);
                            txn.update(memberRef, {
                                points: increment(award.pointsReward),
                                tier: newTier,
                            });
                            const pointsTxRef = doc(collection(db, COLLECTIONS.POINTS));
                            txn.set(pointsTxRef, {
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
                    });

                    if (isNewAward) {
                        GamificationService.invalidateBadgesCache();
                    }

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
                    // P0 fix: when auto-badge award is called from a non-board client,
                    // Firestore may reject the BADGE_AWARDS write with PERMISSION_DENIED.
                    // Log with errorLoggingService so failures are visible in the audit log
                    // rather than silently dropped. Long-term fix: route through a Cloud
                    // Function with admin SDK so client permissions are irrelevant.
                    const isPermissionError =
                        err instanceof Error &&
                        (err.message.includes('PERMISSION_DENIED') || err.message.includes('Missing or insufficient permissions'));
                    errorLoggingService.logError(err as Error, {
                        action: isPermissionError
                            ? 'checkEligibleBadgesForMember → PERMISSION_DENIED (route through Cloud Function)'
                            : 'checkEligibleBadgesForMember → awardAward failed',
                        additionalData: { awardId: award.id, memberId },
                    });
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
