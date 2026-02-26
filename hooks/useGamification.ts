// useGamification.ts - Unified Hook for Awards (Achievements + Badges)
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import {
    AwardDefinition,
    MemberAward,
    AwardMilestone,
    Member
} from '../types';
import {
    GamificationService
} from '../services/gamificationService';
import { useToast } from '../components/ui/Common';
import { isDevMode } from '../utils/devMode';

export interface EnrichedAward extends AwardDefinition {
    earnedAt?: any;
    progress?: number;
    isEarned?: boolean;
    completedMilestones?: string[];
}

export const useGamification = (memberId?: string) => {
    const [awards, setAwards] = useState<AwardDefinition[]>([]);
    const [memberAwards, setMemberAwards] = useState<EnrichedAward[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { showToast } = useToast();

    const loadAllAwards = useCallback(async () => {
        try {
            setLoading(true);
            const allAwards = await GamificationService.getAllAwards();
            setAwards(allAwards);
        } catch (err) {
            console.error('Error loading awards:', err);
            setError('Failed to load award definitions');
        } finally {
            if (!memberId) setLoading(false);
        }
    }, [memberId]);

    useEffect(() => {
        loadAllAwards();
    }, [loadAllAwards]);

    useEffect(() => {
        if (!memberId || isDevMode()) {
            if (isDevMode() && memberId) {
                // In dev mode, simulate some earned awards
                setMemberAwards(awards.slice(0, 2).map(a => ({
                    ...a,
                    earnedAt: new Date().toISOString(),
                    isEarned: true,
                    progress: 100
                })));
                setLoading(false);
            }
            return;
        }

        // We listen to the shared awards collection for the member
        const unsubAwards = onSnapshot(
            query(
                collection(db, COLLECTIONS.BADGE_AWARDS),
                where('memberId', '==', memberId),
                orderBy('earnedAt', 'desc')
            ),
            (snapshot) => {
                const results = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MemberAward));

                // Enroll definitions into member awards
                const enrichedResults = results.map(res => {
                    const def = awards.find(a => a.id === res.awardId);
                    return def ? {
                        ...def,
                        earnedAt: res.earnedAt,
                        progress: res.progress || 100,
                        isEarned: (res.progress || 100) === 100,
                        completedMilestones: res.completedMilestones || []
                    } : null;
                }).filter(Boolean) as EnrichedAward[];

                setMemberAwards(enrichedResults);
                setLoading(false);
            },
            (err) => {
                console.error('Error listening to member awards:', err);
                setError('Could not keep track of earned awards');
                setLoading(false);
            }
        );

        return () => unsubAwards();
    }, [memberId, awards]);

    const awardAward = async (awardId: string, targetMemberId: string, reason?: string) => {
        try {
            await GamificationService.awardAward(awardId, targetMemberId, memberId, reason);
            showToast('Recognition awarded successfully!', 'success');
        } catch (err) {
            showToast('Failed to award recognition', 'error');
            throw err;
        }
    };

    const createAward = async (awardData: Omit<AwardDefinition, 'id'>) => {
        try {
            await GamificationService.createAward(awardData);
            showToast('Award definition created!', 'success');
            loadAllAwards();
        } catch (err) {
            showToast('Failed to create award definition', 'error');
            throw err;
        }
    };

    const updateAward = async (awardId: string, awardData: Partial<AwardDefinition>) => {
        try {
            await GamificationService.updateAward(awardId, awardData);
            showToast('Award definition updated!', 'success');
            loadAllAwards();
        } catch (err) {
            showToast('Failed to update award definition', 'error');
            throw err;
        }
    };

    const deleteAward = async (awardId: string) => {
        try {
            await GamificationService.deleteAward(awardId);
            showToast('Award definition deleted!', 'success');
            loadAllAwards();
        } catch (err) {
            showToast('Failed to delete award definition', 'error');
            throw err;
        }
    };

    return {
        awards,
        memberAwards,
        // UI expects achievements/badges separately for now, so we expose them unified
        achievements: awards, // Compatibility alias
        badges: awards,      // Compatibility alias
        memberBadges: memberAwards,
        memberAchievements: memberAwards,
        loading,
        error,
        awardAward,
        createAward,
        updateAward,
        deleteAward,
        // Compatibility aliases for the UI
        awardBadge: awardAward,
        awardAchievement: (memberId: string, awardId: string) => awardAward(awardId, memberId),
        refresh: loadAllAwards
    };
};
