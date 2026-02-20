// Achievement Progress Visualizer - Visual progress tracking for achievements
import React from 'react';
import { Trophy, Star, Target, CheckCircle, Clock } from 'lucide-react';
import { Card, Badge, ProgressBar } from '../ui/Common';
import { Achievement, AchievementMilestone, MemberAchievementProgress } from '../../types';
import { AchievementService } from '../../services/achievementService';

interface AchievementProgressVisualizerProps {
  achievement: Achievement;
  progress?: MemberAchievementProgress;
  currentProgress: number;
  showMilestones?: boolean;
  compact?: boolean;
}

export const AchievementProgressVisualizer: React.FC<AchievementProgressVisualizerProps> = ({
  achievement,
  progress,
  currentProgress,
  showMilestones = true,
  compact = false,
}) => {
  const progressPercentage = AchievementService.calculateAchievementProgress(achievement, currentProgress);
  const completedMilestones = AchievementService.detectCompletedMilestones(achievement, currentProgress);
  const milestones = achievement.milestones || [];

  const getTierIcon = (tier: Achievement['tier']) => {
    switch (tier) {
      case 'Bronze': return '🥉';
      case 'Silver': return '🥈';
      case 'Gold': return '🥇';
      case 'Platinum': return '💎';
      default: return '⭐';
    }
  };

  const getTierColor = (tier: Achievement['tier']) => {
    switch (tier) {
      case 'Bronze': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Silver': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Gold': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Platinum': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getMilestoneStatus = (milestone: AchievementMilestone) => {
    const isCompleted = currentProgress >= milestone.threshold;
    const isInProgress = !isCompleted && milestones.indexOf(milestone) === completedMilestones.length;
    
    return {
      isCompleted,
      isInProgress,
      isFuture: !isCompleted && !isInProgress,
    };
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
        <div className="text-2xl">{achievement.icon}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium text-sm text-slate-900">{achievement.name}</h4>
            <span className="text-xs text-slate-500">{progressPercentage}%</span>
          </div>
          <ProgressBar progress={progressPercentage} />
          {milestones.length > 0 && (
            <div className="flex gap-1 mt-2">
              {milestones.map((milestone, index) => {
                const status = getMilestoneStatus(milestone);
                return (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      status.isCompleted
                        ? 'bg-green-500'
                        : status.isInProgress
                        ? 'bg-blue-500'
                        : 'bg-slate-300'
                    }`}
                    title={`${milestone.level}: ${milestone.threshold} ${achievement.criteria.type.replace(/_/g, ' ')}`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={`hover:shadow-lg transition-shadow border-2 ${getTierColor(achievement.tier)}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="text-5xl">{achievement.icon}</div>
        <Badge variant="neutral" className={getTierColor(achievement.tier)}>
          {getTierIcon(achievement.tier)} {achievement.tier}
        </Badge>
      </div>

      <h3 className="font-bold text-lg text-slate-900 mb-1">{achievement.name}</h3>
      <p className="text-sm text-slate-600 mb-4">{achievement.description}</p>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Progress</span>
          <span className="text-sm text-slate-500">
            {currentProgress} / {achievement.criteria.value} ({progressPercentage}%)
          </span>
        </div>
        <ProgressBar progress={progressPercentage} />
      </div>

      {showMilestones && milestones.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-slate-700 flex items-center gap-2">
            <Target size={16} />
            Milestones
          </h4>
          <div className="space-y-2">
            {milestones.map((milestone, index) => {
              const status = getMilestoneStatus(milestone);
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded-lg border ${
                    status.isCompleted
                      ? 'bg-green-50 border-green-200'
                      : status.isInProgress
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {status.isCompleted ? (
                      <CheckCircle size={16} className="text-green-600" />
                    ) : status.isInProgress ? (
                      <Clock size={16} className="text-blue-600" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                    )}
                    <span className={`text-sm font-medium ${
                      status.isCompleted
                        ? 'text-green-700'
                        : status.isInProgress
                        ? 'text-blue-700'
                        : 'text-slate-600'
                    }`}>
                      {milestone.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {milestone.threshold} {achievement.criteria.type.replace(/_/g, ' ')}
                    </span>
                    {milestone.pointValue > 0 && (
                      <Badge variant="success">
                        +{milestone.pointValue} pts
                      </Badge>
                    )}
                    {milestone.reward && (
                      <Badge variant="info">
                        {milestone.reward}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <Badge variant="info">{achievement.category}</Badge>
        {achievement.pointsReward > 0 && (
          <Badge variant="success">+{achievement.pointsReward} pts</Badge>
        )}
        {progress && (
          <Badge variant="neutral">
            Last updated: {new Date(progress.lastUpdated).toLocaleDateString()}
          </Badge>
        )}
      </div>
    </Card>
  );
};

// Achievement Dashboard Component
interface AchievementDashboardProps {
  memberId: string;
  achievements: Achievement[];
  memberProgress: MemberAchievementProgress[];
  currentMemberData: {
    points: number;
    eventCount: number;
    projectCount: number;
    recruitmentCount: number;
  };
}

export const AchievementDashboard: React.FC<AchievementDashboardProps> = ({
  memberId,
  achievements,
  memberProgress,
  currentMemberData,
}) => {
  const getProgressForAchievement = (achievementId: string) => {
    return memberProgress.find(p => p.achievementId === achievementId);
  };

  const getCurrentProgress = (achievement: Achievement) => {
    switch (achievement.criteria.type) {
      case 'points_threshold':
        return currentMemberData.points;
      case 'event_count':
        return currentMemberData.eventCount;
      case 'project_count':
        return currentMemberData.projectCount;
      case 'recruitment_count':
        return currentMemberData.recruitmentCount;
      default:
        return 0;
    }
  };

  const inProgressAchievements = achievements.filter(achievement => {
    const currentProgress = getCurrentProgress(achievement);
    const progressPercentage = AchievementService.calculateAchievementProgress(achievement, currentProgress);
    return progressPercentage > 0 && progressPercentage < 100;
  });

  const completedAchievements = achievements.filter(achievement => {
    const currentProgress = getCurrentProgress(achievement);
    const progressPercentage = AchievementService.calculateAchievementProgress(achievement, currentProgress);
    return progressPercentage === 100;
  });

  const upcomingAchievements = achievements.filter(achievement => {
    const currentProgress = getCurrentProgress(achievement);
    const progressPercentage = AchievementService.calculateAchievementProgress(achievement, currentProgress);
    return progressPercentage === 0;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{inProgressAchievements.length}</p>
              <p className="text-sm text-slate-600">In Progress</p>
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Trophy className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{completedAchievements.length}</p>
              <p className="text-sm text-slate-600">Completed</p>
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Star className="text-slate-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{upcomingAchievements.length}</p>
              <p className="text-sm text-slate-600">Upcoming</p>
            </div>
          </div>
        </Card>
      </div>

      {inProgressAchievements.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">In Progress</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inProgressAchievements.map(achievement => (
              <AchievementProgressVisualizer
                key={achievement.id}
                achievement={achievement}
                progress={getProgressForAchievement(achievement.id!)}
                currentProgress={getCurrentProgress(achievement)}
              />
            ))}
          </div>
        </div>
      )}

      {completedAchievements.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Completed</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedAchievements.map(achievement => (
              <AchievementProgressVisualizer
                key={achievement.id}
                achievement={achievement}
                progress={getProgressForAchievement(achievement.id!)}
                currentProgress={getCurrentProgress(achievement)}
                showMilestones={false}
                compact={true}
              />
            ))}
          </div>
        </div>
      )}

      {upcomingAchievements.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Upcoming</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingAchievements.slice(0, 6).map(achievement => (
              <AchievementProgressVisualizer
                key={achievement.id}
                achievement={achievement}
                progress={getProgressForAchievement(achievement.id!)}
                currentProgress={getCurrentProgress(achievement)}
                compact={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};