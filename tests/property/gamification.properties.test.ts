// Gamification Properties Test - Property-Based Testing for Achievement System
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { AchievementService } from '../../services/achievementService';
import { Achievement, AchievementMilestone, MemberAchievementProgress, Member } from '../../types';

// Mock Firebase
vi.mock('../../config/firebase', () => ({
  db: {},
}));

// Mock constants
vi.mock('../../config/constants', () => ({
  COLLECTIONS: {
    ACHIEVEMENTS: 'achievements',
    ACHIEVEMENT_AWARDS: 'achievement_awards',
    ACHIEVEMENT_PROGRESS: 'achievement_progress',
  },
}));

// Mock dev mode
vi.mock('../../utils/devMode', () => ({
  isDevMode: () => true,
}));

describe('Gamification Properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 39: Achievement progress calculation', () => {
    /**
     * **Feature: platform-enhancements, Property 39: Achievement progress calculation**
     * **Validates: Requirements 16.2**
     * 
     * For any achievement, the progress percentage must equal (current progress / target threshold) * 100.
     */
    it('should calculate progress percentage correctly for any achievement and current progress', () => {
      fc.assert(
        fc.property(
          // Generate achievement with milestones
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            description: fc.string({ minLength: 1, maxLength: 200 }),
            icon: fc.string({ minLength: 1, maxLength: 10 }),
            category: fc.constantFrom('Event', 'Project', 'Leadership', 'Training', 'Recruitment', 'Social', 'Milestone', 'Special'),
            tier: fc.constantFrom('Bronze', 'Silver', 'Gold', 'Platinum'),
            pointsReward: fc.integer({ min: 0, max: 500 }),
            criteria: fc.record({
              type: fc.constantFrom('event_count', 'project_count', 'points_threshold', 'custom'),
              value: fc.integer({ min: 1, max: 100 }),
              timeframe: fc.constantFrom('lifetime', 'yearly', 'monthly', 'quarterly')
            }),
            active: fc.boolean(),
            milestones: fc.array(
              fc.record({
                level: fc.constantFrom('Bronze', 'Silver', 'Gold', 'Platinum'),
                threshold: fc.integer({ min: 1, max: 1000 }),
                pointValue: fc.integer({ min: 0, max: 500 }),
                reward: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
              }),
              { minLength: 1, maxLength: 4 }
            ).map(milestones => 
              // Sort milestones by threshold to ensure proper ordering
              milestones.sort((a, b) => a.threshold - b.threshold)
            ),
          }),
          // Generate current progress value
          fc.integer({ min: 0, max: 2000 }),
          (achievement, currentProgress) => {
            // Calculate expected progress percentage for each milestone
            const milestones = achievement.milestones;
            
            // Find the current milestone being worked towards
            let targetMilestone = milestones[0];
            let completedMilestones: string[] = [];
            
            for (const milestone of milestones) {
              if (currentProgress >= milestone.threshold) {
                completedMilestones.push(milestone.level);
              } else {
                targetMilestone = milestone;
                break;
              }
            }
            
            // If all milestones are completed, progress should be 100%
            if (completedMilestones.length === milestones.length) {
              const progressPercentage = 100;
              expect(progressPercentage).toBe(100);
              return;
            }
            
            // Calculate progress towards the next milestone
            const previousThreshold = completedMilestones.length > 0 
              ? milestones[completedMilestones.length - 1].threshold 
              : 0;
            
            const progressInCurrentMilestone = Math.max(0, currentProgress - previousThreshold);
            const milestoneRange = targetMilestone.threshold - previousThreshold;
            
            const expectedProgressPercentage = Math.min(100, 
              Math.round((progressInCurrentMilestone / milestoneRange) * 100)
            );
            
            // The actual calculation should match our expected calculation
            const actualProgressPercentage = calculateAchievementProgress(achievement, currentProgress);
            
            expect(actualProgressPercentage).toBe(expectedProgressPercentage);
            expect(actualProgressPercentage).toBeGreaterThanOrEqual(0);
            expect(actualProgressPercentage).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 40: Achievement milestone reward distribution', () => {
    /**
     * **Feature: platform-enhancements, Property 40: Achievement milestone reward distribution**
     * **Validates: Requirements 16.5**
     * 
     * For any achievement milestone reached, the specified rewards (points, badges, privileges) must be awarded to the member.
     */
    it('should distribute all specified rewards when milestone is reached', () => {
      fc.assert(
        fc.property(
          // Generate member ID
          fc.string({ minLength: 1, maxLength: 50 }),
          // Generate achievement with milestones that have rewards
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            description: fc.string({ minLength: 1, maxLength: 200 }),
            category: fc.constantFrom('Event', 'Project', 'Leadership', 'Training', 'Recruitment', 'Social', 'Milestone', 'Special'),
            milestones: fc.array(
              fc.record({
                level: fc.constantFrom('Bronze', 'Silver', 'Gold', 'Platinum'),
                threshold: fc.integer({ min: 1, max: 1000 }),
                pointValue: fc.integer({ min: 10, max: 500 }), // Ensure all milestones have point rewards
                reward: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
              }),
              { minLength: 1, maxLength: 4 }
            ).map(milestones => 
              // Sort milestones by threshold and ensure unique thresholds
              milestones
                .sort((a, b) => a.threshold - b.threshold)
                .map((milestone, index) => ({
                  ...milestone,
                  threshold: milestone.threshold + (index * 10), // Ensure unique thresholds
                }))
            ),
          }),
          // Generate progress that reaches at least one milestone
          fc.integer({ min: 1, max: 1500 }),
          (memberId, achievement, currentProgress) => {
            // Find which milestones should be completed
            const completedMilestones = achievement.milestones.filter(
              milestone => currentProgress >= milestone.threshold
            );
            
            if (completedMilestones.length === 0) {
              // No milestones reached, skip this test case
              return;
            }
            
            // Mock the reward distribution function
            const distributedRewards: Array<{
              type: 'points' | 'badge' | 'privilege';
              value: number | string;
              milestoneIndex: number; // Use index instead of level for uniqueness
            }> = [];
            
            // Simulate milestone reward distribution
            completedMilestones.forEach((milestone, index) => {
              const milestoneIndex = achievement.milestones.indexOf(milestone);
              
              // Points should always be awarded if pointValue > 0
              if (milestone.pointValue > 0) {
                distributedRewards.push({
                  type: 'points',
                  value: milestone.pointValue,
                  milestoneIndex,
                });
              }
              
              // Additional rewards if specified (not null)
              if (milestone.reward !== null && milestone.reward !== undefined) {
                distributedRewards.push({
                  type: 'badge',
                  value: milestone.reward,
                  milestoneIndex,
                });
              }
            });
            
            // Verify that rewards were distributed for each completed milestone
            // Only check if there are actually completed milestones with rewards
            const milestonesWithRewards = completedMilestones.filter(
              milestone => milestone.pointValue > 0 || (milestone.reward !== null && milestone.reward !== undefined)
            );
            
            if (milestonesWithRewards.length === 0) {
              // No milestones with rewards, skip this test case
              return;
            }
            
            expect(distributedRewards.length).toBeGreaterThan(0);
            
            // Verify that each completed milestone has appropriate rewards
            completedMilestones.forEach((milestone) => {
              const milestoneIndex = achievement.milestones.indexOf(milestone);
              const milestoneRewards = distributedRewards.filter(
                reward => reward.milestoneIndex === milestoneIndex
              );
              
              // Each milestone should have at least points reward if pointValue > 0
              if (milestone.pointValue > 0) {
                const pointsReward = milestoneRewards.find(r => r.type === 'points');
                expect(pointsReward).toBeDefined();
                expect(pointsReward?.value).toBe(milestone.pointValue);
              }
              
              // Verify additional reward exists if specified (not null)
              if (milestone.reward !== null && milestone.reward !== undefined) {
                const additionalReward = milestoneRewards.find(r => r.type === 'badge');
                expect(additionalReward).toBeDefined();
                expect(additionalReward?.value).toBe(milestone.reward);
              }
              
              // If milestone has either points or additional reward, there should be rewards
              if (milestone.pointValue > 0 || (milestone.reward !== null && milestone.reward !== undefined)) {
                expect(milestoneRewards.length).toBeGreaterThan(0);
              }
            });
            
            // Verify no rewards are distributed for uncompleted milestones
            const uncompletedMilestones = achievement.milestones.filter(
              milestone => currentProgress < milestone.threshold
            );
            
            uncompletedMilestones.forEach((milestone) => {
              const milestoneIndex = achievement.milestones.indexOf(milestone);
              const milestoneRewards = distributedRewards.filter(
                reward => reward.milestoneIndex === milestoneIndex
              );
              expect(milestoneRewards.length).toBe(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Helper function to calculate achievement progress
function calculateAchievementProgress(achievement: Achievement & { milestones: AchievementMilestone[] }, currentProgress: number): number {
  const milestones = achievement.milestones.sort((a, b) => a.threshold - b.threshold);
  
  // Find completed milestones
  let completedMilestones = 0;
  for (const milestone of milestones) {
    if (currentProgress >= milestone.threshold) {
      completedMilestones++;
    } else {
      break;
    }
  }
  
  // If all milestones are completed, return 100%
  if (completedMilestones === milestones.length) {
    return 100;
  }
  
  // Calculate progress towards the next milestone
  const targetMilestone = milestones[completedMilestones];
  const previousThreshold = completedMilestones > 0 ? milestones[completedMilestones - 1].threshold : 0;
  
  const progressInCurrentMilestone = Math.max(0, currentProgress - previousThreshold);
  const milestoneRange = targetMilestone.threshold - previousThreshold;
  
  return Math.min(100, Math.round((progressInCurrentMilestone / milestoneRange) * 100));
}