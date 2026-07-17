// useGamification.ts - Unified Hook for Awards (Achievements + Badges)
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import {
    AwardDefinition,
    MemberAward,
} from '../types';
import {
    GamificationService
} from '../services/gamificationService';
import { useToast } from '../components/ui/Common';
import { isDevMode } from '../utils/devMode';
import { useFirestoreCollection } from './useFirestoreCollection';

export interface EnrichedAward extends AwardDefinition {
    earnedAt?: any;
    progress?: number;
    isEarned?: boolean;
    completedMilestones?: string[];
}

export const useGamification = (memberId?: string) => {
    const { showToast } = useToast();
    const queryClient = useQueryClient();

    const { data: awards = [], isLoading: awardsLoading } = useQuery({
        queryKey: ['awards'],
        queryFn: () => GamificationService.getAllAwards(),
        staleTime: 3 * 60 * 1000,
    });

    const { data: memberAwardsRaw, loading: memberAwardsLoading, error } = useFirestoreCollection<MemberAward>({
        loader: async () => {
            const snap = await getDocs(query(
                collection(db, COLLECTIONS.BADGE_AWARDS),
                where('memberId', '==', memberId!),
                orderBy('earnedAt', 'desc')
            ));
            return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as MemberAward));
        },
        enabled: !!memberId && !isDevMode(),
        deps: [memberId],
    });

    const memberAwards = useMemo((): EnrichedAward[] => {
        if (isDevMode() && memberId) {
            return awards.slice(0, 2).map(a => ({
                ...a,
                earnedAt: new Date().toISOString(),
                isEarned: true,
                progress: 100
            }));
        }
        return memberAwardsRaw
            .map(res => {
                const def = awards.find(a => a.id === res.awardId);
                return def ? {
                    ...def,
                    earnedAt: res.earnedAt,
                    progress: res.progress || 100,
                    isEarned: (res.progress || 100) === 100,
                    completedMilestones: res.completedMilestones || []
                } : null;
            })
            .filter(Boolean) as EnrichedAward[];
    }, [memberAwardsRaw, awards, memberId]);

    const loading = awardsLoading || (!!memberId && memberAwardsLoading);

    const loadAllAwards = () => queryClient.invalidateQueries({ queryKey: ['awards'] });

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
        loading,
        error,
        awardAward,
        createAward,
        updateAward,
        deleteAward,
        refresh: loadAllAwards
    };
};
