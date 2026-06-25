// Achievement Progress Visualizer - Visual progress tracking for awards
import React from 'react';
import { Trophy, Star, Target, CheckCircle, Clock } from 'lucide-react';
import { Card, Badge, ProgressBar } from '../ui/Common';
import { AwardDefinition, AwardMilestone, MemberAward } from '../../types';
import { GamificationService } from '../../services/gamificationService';

interface AchievementProgressVisualizerProps {
  achievement: AwardDefinition;
  progress?: MemberAward;
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
  const progressPercentage = GamificationService.calculateAwardProgress(achievement, currentProgress);
  const completedMilestones = GamificationService.detectCompletedMilestones(achievement, currentProgress);
  const milestones = achievement.milestones || [];

  const getTierIcon = (tier: AwardDefinition['tier']) => {
    switch (tier) {
      case 'Bronze': return '🥉';
      case 'Silver': return '🥈';
      case 'Gold': return '🥇';
      case 'Platinum': return '💎';
      case 'Legendary': return '👑';
      default: return '⭐';
    }
  };

  const getTierColor = (tier: AwardDefinition['tier']) => {
    switch (tier) {
      case 'Bronze': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Silver': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Gold': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Platinum': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Legendary': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getMilestoneStatus = (milestone: AwardMilestone) => {
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
                    className={`w-2 h-2 rounded-full ${status.isCompleted
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
                  className={`flex items-center justify-between p-2 rounded-lg border ${status.isCompleted
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
                    <span className={`text-sm font-medium ${status.isCompleted
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
        {progress && progress.metadata?.lastUpdated && (
          <Badge variant="neutral">
            Last updated: {new Date(progress.metadata.lastUpdated).toLocaleDateString()}
          </Badge>
        )}
      </div>
    </Card>
  );
};