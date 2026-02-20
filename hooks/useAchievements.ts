// useAchievements Hook
import { useState, useEffect } from 'react';
import { AchievementService } from '../services/achievementService';
import { Achievement, AchievementAward, MemberAchievementProgress } from '../types';
import { useToast } from '../components/ui/Common';

export type EnrichedAchievementAward = AchievementAward & {
  achievement?: Achievement;
};

export const useAchievements = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [memberAchievements, setMemberAchievements] = useState<EnrichedAchievementAward[]>([]);
  const [memberProgress, setMemberProgress] = useState<MemberAchievementProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadAchievements = async () => {
    try {
      setLoading(true);
      setError(null);
      const allAchievements = await AchievementService.getAllAchievements();
      setAchievements(allAchievements);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load achievements';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMemberAchievements = async (memberId: string) => {
    try {
      const awards = await AchievementService.getMemberAchievements(memberId);
      // Enrich awards with achievement details
      const enrichedAwards = await Promise.all(
        awards.map(async (award) => {
          const achievement = await AchievementService.getAchievementById(award.achievementId);
          return {
            ...award,
            achievement,
          };
        })
      );
      setMemberAchievements(enrichedAwards);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load member achievements';
      showToast(errorMessage, 'error');
    }
  };

  const createAchievement = async (achievement: Partial<Achievement>): Promise<string> => {
    try {
      const id = await AchievementService.saveAchievement(achievement);
      await loadAchievements();
      showToast('Achievement created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create achievement';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateAchievement = async (achievementId: string, updates: Partial<Achievement>): Promise<void> => {
    try {
      await AchievementService.saveAchievement({ ...updates, id: achievementId });
      await loadAchievements();
      showToast('Achievement updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update achievement';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const loadMemberProgress = async (memberId: string) => {
    try {
      const progressList: MemberAchievementProgress[] = [];
      for (const achievement of achievements) {
        if (achievement.id) {
          const progress = await AchievementService.getMemberAchievementProgress(memberId, achievement.id);
          if (progress) {
            progressList.push(progress);
          }
        }
      }
      setMemberProgress(progressList);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load member progress';
      showToast(errorMessage, 'error');
    }
  };

  const updateMemberProgress = async (memberId: string, achievementId: string, currentProgress: number): Promise<void> => {
    try {
      const achievement = achievements.find(a => a.id === achievementId);
      if (!achievement) {
        throw new Error('Achievement not found');
      }

      const completedMilestones = AchievementService.detectCompletedMilestones(achievement, currentProgress);
      await AchievementService.updateMemberAchievementProgress(
        memberId,
        achievementId,
        currentProgress,
        completedMilestones.map(m => m.level)
      );
      
      await loadMemberProgress(memberId);
      showToast('Progress updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update progress';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const calculateProgress = (achievement: Achievement, currentProgress: number): number => {
    return AchievementService.calculateAchievementProgress(achievement, currentProgress);
  };

  const awardAchievement = async (memberId: string, achievementId: string): Promise<void> => {
    try {
      await AchievementService.awardAchievement(memberId, achievementId);
      await loadMemberAchievements(memberId);
      showToast('Achievement awarded successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to award achievement';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  useEffect(() => {
    loadAchievements();
  }, []);

  return {
    achievements,
    memberAchievements,
    memberProgress,
    loading,
    error,
    loadAchievements,
    loadMemberAchievements,
    loadMemberProgress,
    createAchievement,
    updateAchievement,
    updateMemberProgress,
    awardAchievement,
    calculateProgress,
  };
};

