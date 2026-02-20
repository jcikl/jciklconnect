// Badge Progress Tracker - Shows progress toward earning badges
import React from 'react';
import { Award, Target, TrendingUp } from 'lucide-react';
import { Card, ProgressBar, Badge } from '../ui/Common';
import { BadgeDefinition } from '../../services/badgeService';
import { Member } from '../../types';

interface BadgeProgressTrackerProps {
  member: Member;
  availableBadges: BadgeDefinition[];
  earnedBadgeIds: string[];
}

interface BadgeProgress {
  badge: BadgeDefinition;
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
  const calculateBadgeProgress = (badge: BadgeDefinition): BadgeProgress => {
    const isEarned = earnedBadgeIds.includes(badge.id!);
    let currentValue = 0;
    let targetValue = badge.criteria.threshold;
    let progress = 0;

    if (isEarned) {
      return {
        badge,
        progress: 100,
        currentValue: targetValue,
        targetValue,
        isEarned: true,
      };
    }

    switch (badge.criteria.type) {
      case 'points_threshold':
        currentValue = member.points;
        progress = Math.min(100, (currentValue / targetValue) * 100);
        break;

      case 'event_attendance':
        // This would need to be calculated from actual attendance records
        // For now, using a simplified calculation
        currentValue = Math.floor(member.points / 50); // Assume 50 points per event
        progress = Math.min(100, (currentValue / targetValue) * 100);
        break;

      case 'project_completion':
        // This would need to be calculated from actual project records
        // For now, using a simplified calculation based on tier
        const tierProjectCounts = { Bronze: 0, Silver: 1, Gold: 2, Platinum: 3 };
        currentValue = tierProjectCounts[member.tier as keyof typeof tierProjectCounts] || 0;
        progress = Math.min(100, (currentValue / targetValue) * 100);
        break;

      case 'custom':
        // Custom criteria evaluation
        if (badge.criteria.conditions.membershipDuration) {
          const joinDate = new Date(member.joinDate);
          const monthsSinceJoining = (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
          currentValue = Math.floor(monthsSinceJoining);
          targetValue = badge.criteria.conditions.membershipDuration;
          progress = Math.min(100, (currentValue / targetValue) * 100);
        } else if (badge.criteria.conditions.tierReached) {
          const tierValues = { Bronze: 1, Silver: 2, Gold: 3, Platinum: 4 };
          const currentTierValue = tierValues[member.tier as keyof typeof tierValues] || 1;
          const targetTierValue = tierValues[badge.criteria.conditions.tierReached as keyof typeof tierValues] || 4;
          currentValue = currentTierValue;
          targetValue = targetTierValue;
          progress = Math.min(100, (currentValue / targetValue) * 100);
        }
        break;
    }

    return {
      badge,
      progress: Math.round(progress),
      currentValue,
      targetValue,
      isEarned: false,
    };
  };

  const badgeProgresses = availableBadges
    .map(calculateBadgeProgress)
    .filter(bp => !bp.isEarned && bp.progress > 0) // Show only unearned badges with some progress
    .sort((a, b) => b.progress - a.progress) // Sort by progress descending
    .slice(0, 6); // Show top 6 badges

  const getTierIcon = (tier: BadgeDefinition['tier']) => {
    switch (tier) {
      case 'bronze': return '🥉';
      case 'silver': return '🥈';
      case 'gold': return '🥇';
      case 'platinum': return '💎';
      case 'legendary': return '👑';
      default: return '⭐';
    }
  };

  const getRarityColor = (rarity: BadgeDefinition['rarity']) => {
    switch (rarity) {
      case 'common': return 'bg-slate-100 text-slate-700';
      case 'rare': return 'bg-blue-100 text-blue-700';
      case 'epic': return 'bg-purple-100 text-purple-700';
      case 'legendary': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getCriteriaDescription = (badge: BadgeDefinition): string => {
    switch (badge.criteria.type) {
      case 'points_threshold':
        return `Reach ${badge.criteria.threshold} points`;
      case 'event_attendance':
        const eventType = badge.criteria.conditions.eventType || 'any';
        return `Attend ${badge.criteria.threshold} ${eventType !== 'any' ? eventType.toLowerCase() : ''} events`;
      case 'project_completion':
        const role = badge.criteria.conditions.role || 'any';
        return `Complete ${badge.criteria.threshold} projects${role !== 'any' ? ` as ${role}` : ''}`;
      case 'custom':
        if (badge.criteria.conditions.membershipDuration) {
          return `Be a member for ${badge.criteria.conditions.membershipDuration} months`;
        }
        if (badge.criteria.conditions.tierReached) {
          return `Reach ${badge.criteria.conditions.tierReached} tier`;
        }
        return 'Meet custom criteria';
      default:
        return 'Meet badge criteria';
    }
  };

  if (badgeProgresses.length === 0) {
    return (
      <Card title="Badge Progress">
        <div className="text-center py-8 text-slate-400">
          <Award className="mx-auto mb-2 text-slate-300" size={32} />
          <p className="text-sm">No badges in progress</p>
          <p className="text-xs text-slate-400 mt-1">Keep participating to unlock new badges!</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Badge Progress" className="h-fit">
      <div className="space-y-4">
        {badgeProgresses.map((badgeProgress) => (
          <div key={badgeProgress.badge.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 mb-3">
              <div className="text-3xl">{badgeProgress.badge.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-slate-900 text-sm truncate">
                    {badgeProgress.badge.name}
                  </h4>
                  <Badge variant="neutral" className={`text-xs ${getRarityColor(badgeProgress.badge.rarity)}`}>
                    {badgeProgress.badge.rarity}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                  {badgeProgress.badge.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                  <Target size={12} />
                  <span>{getCriteriaDescription(badgeProgress.badge)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 mb-1">
                  {getTierIcon(badgeProgress.badge.tier)} {badgeProgress.badge.tier}
                </div>
                <div className="text-xs font-medium text-jci-blue">
                  +{badgeProgress.badge.pointValue} pts
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Progress</span>
                <span className="font-medium text-slate-900">
                  {badgeProgress.currentValue} / {badgeProgress.targetValue}
                </span>
              </div>
              <ProgressBar 
                progress={badgeProgress.progress} 
                color={badgeProgress.progress >= 80 ? 'bg-green-500' : 'bg-jci-blue'} 
              />
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">{badgeProgress.progress}% complete</span>
                {badgeProgress.progress >= 80 && (
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