// useGamification.ts - Unified Hook for Awards (Achievements + Badges)
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    const [memberAwards, setMemberAwards] = useState<EnrichedAward[]>([]);
    const [memberAwardsLoading, setMemberAwardsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { showToast } = useToast();
    const queryClient = useQueryClient();

    const { data: awards = [], isLoading: awardsLoading } = useQuery({
        queryKey: ['awards'],
        queryFn: () => GamificationService.getAllAwards(),
        staleTime: 3 * 60 * 1000,
    });

    const loading = awardsLoading || (!!memberId && memberAwardsLoading);

    const loadAllAwards = () => queryClient.invalidateQueries({ queryKey: ['awards'] });

    useEffect(() => {
        if (!memberId || isDevMode()) {
            if (isDevMode() && memberId) {
                setMemberAwards(awards.slice(0, 2).map(a => ({
                    ...a,
                    earnedAt: new Date().toISOString(),
                    isEarned: true,
                    progress: 100
                })));
                setMemberAwardsLoading(false);
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
                setMemberAwardsLoading(false);
            },
            (err) => {
                console.error('Error listening to member awards:', err);
                setError('Could not keep track of earned awards');
                setMemberAwardsLoading(false);
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
