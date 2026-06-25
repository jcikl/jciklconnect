// Badge Progress Tracker - Shows progress toward earning awards (unified)
import React from 'react';
import { Award, Target, TrendingUp } from 'lucide-react';
import { Card, ProgressBar, Badge } from '../ui/Common';
import { AwardDefinition, Member } from '../../types';

interface BadgeProgressTrackerProps {
  member: Member;
  availableBadges: AwardDefinition[];
  earnedBadgeIds: string[];
}

interface BadgeProgress {
  badge: AwardDefinition;
  progress: number;
  currentValue: number;
  targetValue: number;
  isEarned: boolean;
}

export const BadgeProgressTracker: React.FC<BadgeProgressTrackerProps> = ({
  member,
  availableBadges,
  earnedBadgeIds,
}) => {
  const calculateBadgeProgress = (award: AwardDefinition): BadgeProgress => {
    const isEarned = earnedBadgeIds.includes(award.id!);
    let currentValue = 0;
    let targetValue = award.criteria.value;
    let progressValue = 0;

    if (isEarned) {
      return {
        badge: award,
        progress: 100,
        currentValue: targetValue,
        targetValue,
        isEarned: true,
      };
    }

    switch (award.criteria.type) {
      case 'points_threshold':
        currentValue = member.points;
        break;

      case 'event_attendance':
      case 'event_count':
        // Simplified mapping for the mock/MVP
        currentValue = member.points ? Math.floor(member.points / 50) : 0;
        break;

      case 'project_completion':
      case 'project_count':
        const tierProjectCounts = { Bronze: 1, Silver: 5, Gold: 15, Platinum: 30 };
        currentValue = tierProjectCounts[member.tier as keyof typeof tierProjectCounts] || 0;
        break;

      case 'custom':
        if (award.criteria.conditions?.membershipDuration) {
          const joinDate = new Date(member.joinDate);
          const monthsSinceJoining = (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
          currentValue = Math.floor(monthsSinceJoining);
          targetValue = award.criteria.conditions.membershipDuration;
        } else if (award.criteria.conditions?.tierReached) {
          const tierValues = { Bronze: 1, Silver: 2, Gold: 3, Platinum: 4, Legendary: 5 };
          const currentTierValue = tierValues[member.tier as keyof typeof tierValues] || 1;
          const targetTierValue = tierValues[award.criteria.conditions.tierReached as keyof typeof tierValues] || 4;
          currentValue = currentTierValue;
          targetValue = targetTierValue;
        }
        break;
    }

    progressValue = targetValue > 0 ? Math.min(100, (currentValue / targetValue) * 100) : 0;

    return {
      badge: award,
      progress: Math.round(progressValue),
      currentValue,
      targetValue,
      isEarned: false,
    };
  };

  const badgeProgresses = availableBadges
    .map(calculateBadgeProgress)
    .filter(bp => !bp.isEarned && bp.progress > 0)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 6);

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

  const getRarityColor = (rarity: AwardDefinition['rarity']) => {
    switch (rarity) {
      case 'Common': return 'bg-slate-100 text-slate-700';
      case 'Rare': return 'bg-blue-100 text-blue-700';
      case 'Epic': return 'bg-purple-100 text-purple-700';
      case 'Legendary': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getCriteriaDescription = (award: AwardDefinition): string => {
    switch (award.criteria.type) {
      case 'points_threshold':
        return `Reach ${award.criteria.value} points`;
      case 'event_attendance':
      case 'event_count':
        return `Attend ${award.criteria.value} events`;
      case 'project_completion':
      case 'project_count':
        return `Complete ${award.criteria.value} projects`;
      case 'custom':
        return award.criteria.description || 'Meet custom criteria';
      default:
        return 'Meet award criteria';
    }
  };

  if (badgeProgresses.length === 0) {
    return (
      <Card title="Award Progress">
        <div className="text-center py-8 text-slate-400">
          <Award className="mx-auto mb-2 text-slate-300" size={32} />
          <p className="text-sm">No awards in progress</p>
          <p className="text-xs text-slate-400 mt-1">Keep participating to unlock new recognition!</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Award Progress" className="h-fit">
      <div className="space-y-4">
        {badgeProgresses.map((bp) => (
          <div key={bp.badge.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 mb-3">
              <div className="text-3xl">{bp.badge.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-slate-900 text-sm truncate">
                    {bp.badge.name}
                  </h4>
                  <Badge variant="neutral" className={`text-xs ${getRarityColor(bp.badge.rarity)}`}>
                    {bp.badge.rarity}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                  {bp.badge.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                  <Target size={12} />
                  <span>{getCriteriaDescription(bp.badge)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 mb-1">
                  {getTierIcon(bp.badge.tier)} {bp.badge.tier}
                </div>
                <div className="text-xs font-medium text-jci-blue">
                  +{bp.badge.pointsReward} pts
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Progress</span>
                <span className="font-medium text-slate-900">
                  {bp.currentValue} / {bp.targetValue}
                </span>
              </div>
              <ProgressBar
                progress={bp.progress}
                color={bp.progress >= 80 ? 'bg-green-500' : 'bg-jci-blue'}
              />
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">{bp.progress}% complete</span>
                {bp.progress >= 80 && (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <TrendingUp size={12} />
                    Almost there!
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};