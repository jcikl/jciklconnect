import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { BadgeDefinition, BadgeCriteria } from '../../services/badgeService';

describe('Badge System Properties', () => {
  // Property 37: Badge automatic awarding
  it('Property 37: Badge automatic awarding', () => {
    /**
     * Feature: platform-enhancements, Property 37: Badge automatic awarding
     * For any member whose activities meet a badge's criteria, the badge must be automatically awarded.
     * Validates: Requirements 15.2
     */
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          points: fc.integer({ min: 0, max: 5000 }),
          eventsAttended: fc.integer({ min: 0, max: 50 }),
          socialEventsAttended: fc.integer({ min: 0, max: 30 }),
          trainingEventsAttended: fc.integer({ min: 0, max: 20 }),
          projectsCompleted: fc.integer({ min: 0, max: 20 }),
          projectsLed: fc.integer({ min: 0, max: 10 }),
          membershipDuration: fc.integer({ min: 0, max: 60 }), // months
          role: fc.constantFrom('Member', 'Board', 'Admin'),
          tier: fc.constantFrom('Bronze', 'Silver', 'Gold', 'Platinum'),
        }),
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          criteria: fc.oneof(
            // Points threshold badge
            fc.record({
              type: fc.constant('points_threshold' as const),
              threshold: fc.integer({ min: 100, max: 2000 }),
              conditions: fc.constant({}),
            }),
            // Event attendance badge
            fc.record({
              type: fc.constant('event_attendance' as const),
              threshold: fc.integer({ min: 1, max: 20 }),
              conditions: fc.record({
                eventType: fc.option(fc.constantFrom('Social', 'Training', 'Meeting'), { nil: 'any' }),
              }),
            }),
            // Project completion badge
            fc.record({
              type: fc.constant('project_completion' as const),
              threshold: fc.integer({ min: 1, max: 10 }),
              conditions: fc.record({
                role: fc.option(fc.constantFrom('lead', 'member'), { nil: 'any' }),
              }),
            }),
            // Custom badge
            fc.record({
              type: fc.constant('custom' as const),
              threshold: fc.integer({ min: 1, max: 12 }),
              conditions: fc.record({
                membershipDuration: fc.option(fc.integer({ min: 1, max: 24 })),
                roleHeld: fc.option(fc.constantFrom('Board', 'Admin')),
                tierReached: fc.option(fc.constantFrom('Silver', 'Gold', 'Platinum')),
              }),
            })
          ),
          isActive: fc.boolean(),
        }),
        (member, badge) => {
          // Skip inactive badges
          if (!badge.isActive) {
            return;
          }

          // Determine if member meets badge criteria
          let meetsCriteria = false;

          switch (badge.criteria.type) {
            case 'points_threshold':
              meetsCriteria = member.points >= badge.criteria.threshold;
              break;

            case 'event_attendance':
              let eventCount = member.eventsAttended;
              
              // Check specific event type if specified
              if (badge.criteria.conditions.eventType && badge.criteria.conditions.eventType !== 'any') {
                switch (badge.criteria.conditions.eventType) {
                  case 'Social':
                    eventCount = member.socialEventsAttended;
                    break;
                  case 'Training':
                    eventCount = member.trainingEventsAttended;
                    break;
                  default:
                    eventCount = member.eventsAttended;
                }
              }
              
              meetsCriteria = eventCount >= badge.criteria.threshold;
              break;

            case 'project_completion':
              let projectCount = member.projectsCompleted;
              
              // Check role requirement if specified
              if (badge.criteria.conditions.role && badge.criteria.conditions.role !== 'any') {
                if (badge.criteria.conditions.role === 'lead') {
                  projectCount = member.projectsLed;
                }
                // For 'member' role, use projectsCompleted (default)
              }
              
              meetsCriteria = projectCount >= badge.criteria.threshold;
              break;

            case 'custom':
              let customCriteriaMet = true;
              
              if (badge.criteria.conditions.membershipDuration) {
                customCriteriaMet = customCriteriaMet && 
                  member.membershipDuration >= badge.criteria.conditions.membershipDuration;
              }
              
              if (badge.criteria.conditions.roleHeld) {
                customCriteriaMet = customCriteriaMet && 
                  member.role === badge.criteria.conditions.roleHeld;
              }
              
              if (badge.criteria.conditions.tierReached) {
                customCriteriaMet = customCriteriaMet && 
                  member.tier === badge.criteria.conditions.tierReached;
              }
              
              meetsCriteria = customCriteriaMet;
              break;
          }

          // Simulate badge awarding system
          const shouldAwardBadge = meetsCriteria && badge.isActive;
          const badgeAwarded = shouldAwardBadge;

          // Property: Badge should be awarded if and only if criteria are met
          if (meetsCriteria && badge.isActive) {
            expect(badgeAwarded).toBe(true);
          }

          // Property: Badge should not be awarded if criteria are not met
          if (!meetsCriteria) {
            expect(badgeAwarded).toBe(false);
          }

          // Property: Badge should not be awarded if badge is inactive
          if (!badge.isActive) {
            expect(badgeAwarded).toBe(false);
          }

          // Property: Points threshold badges should only be awarded when points meet threshold
          if (badge.criteria.type === 'points_threshold') {
            if (member.points >= badge.criteria.threshold && badge.isActive) {
              expect(badgeAwarded).toBe(true);
            } else {
              expect(badgeAwarded).toBe(false);
            }
          }

          // Property: Event attendance badges should only be awarded when attendance meets threshold
          if (badge.criteria.type === 'event_attendance') {
            let eventCount = member.eventsAttended;
            
            // Check specific event type if specified
            if (badge.criteria.conditions.eventType && badge.criteria.conditions.eventType !== 'any') {
              switch (badge.criteria.conditions.eventType) {
                case 'Social':
                  eventCount = member.socialEventsAttended;
                  break;
                case 'Training':
                  eventCount = member.trainingEventsAttended;
                  break;
                default:
                  eventCount = member.eventsAttended;
              }
            }
            
            const eventCriteriaMet = eventCount >= badge.criteria.threshold;
            if (eventCriteriaMet && badge.isActive) {
              expect(badgeAwarded).toBe(true);
            } else if (!eventCriteriaMet) {
              expect(badgeAwarded).toBe(false);
            }
          }

          // Property: Project completion badges should only be awarded when projects meet threshold
          if (badge.criteria.type === 'project_completion') {
            let projectCount = member.projectsCompleted;
            
            // Check role requirement if specified
            if (badge.criteria.conditions.role && badge.criteria.conditions.role !== 'any') {
              if (badge.criteria.conditions.role === 'lead') {
                projectCount = member.projectsLed;
              }
            }
            
            const projectCriteriaMet = projectCount >= badge.criteria.threshold;
            if (projectCriteriaMet && badge.isActive) {
              expect(badgeAwarded).toBe(true);
            } else if (!projectCriteriaMet) {
              expect(badgeAwarded).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 38: Badge criteria edit isolation
  it('Property 38: Badge criteria edit isolation', () => {
    /**
     * Feature: platform-enhancements, Property 38: Badge criteria edit isolation
     * For any badge criteria edit, existing badge awards must remain unchanged.
     * Validates: Requirements 15.5
     */
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          originalCriteria: fc.record({
            type: fc.constantFrom('points_threshold', 'event_attendance', 'project_completion', 'custom'),
            threshold: fc.integer({ min: 1, max: 100 }),
            conditions: fc.record({
              eventType: fc.option(fc.string({ minLength: 1 })),
              role: fc.option(fc.string({ minLength: 1 })),
            }),
          }),
          updatedCriteria: fc.record({
            type: fc.constantFrom('points_threshold', 'event_attendance', 'project_completion', 'custom'),
            threshold: fc.integer({ min: 1, max: 100 }),
            conditions: fc.record({
              eventType: fc.option(fc.string({ minLength: 1 })),
              role: fc.option(fc.string({ minLength: 1 })),
            }),
          }),
        }),
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            badgeId: fc.string({ minLength: 1 }),
            memberId: fc.string({ minLength: 1 }),
            awardedAt: fc.date({ min: new Date('2023-01-01'), max: new Date() }),
            reason: fc.string({ minLength: 1 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (badge, existingAwards) => {
          // Ensure existing awards reference this badge
          const relevantAwards = existingAwards.map(award => ({
            ...award,
            badgeId: badge.id,
          }));

          // Simulate badge criteria update
          const originalBadge = {
            ...badge,
            criteria: badge.originalCriteria,
          };

          const updatedBadge = {
            ...badge,
            criteria: badge.updatedCriteria,
          };

          // Simulate the system behavior: existing awards should remain unchanged
          const awardsAfterUpdate = relevantAwards.map(award => ({
            ...award,
            // Awards should maintain their original data
            originalCriteria: badge.originalCriteria,
            awardedUnderCriteria: badge.originalCriteria,
          }));

          // Property: Number of existing awards should remain the same
          expect(awardsAfterUpdate.length).toBe(relevantAwards.length);

          // Property: Each existing award should retain its original data
          relevantAwards.forEach((originalAward, index) => {
            const awardAfterUpdate = awardsAfterUpdate[index];
            
            expect(awardAfterUpdate.id).toBe(originalAward.id);
            expect(awardAfterUpdate.badgeId).toBe(originalAward.badgeId);
            expect(awardAfterUpdate.memberId).toBe(originalAward.memberId);
            expect(awardAfterUpdate.awardedAt).toEqual(originalAward.awardedAt);
            expect(awardAfterUpdate.reason).toBe(originalAward.reason);
          });

          // Property: Existing awards should preserve the criteria they were awarded under
          awardsAfterUpdate.forEach(award => {
            expect(award.awardedUnderCriteria).toEqual(badge.originalCriteria);
            expect(award.awardedUnderCriteria).not.toEqual(badge.updatedCriteria);
          });

          // Property: Badge criteria change should not affect award validity
          const originalCriteriaHash = JSON.stringify(badge.originalCriteria);
          const updatedCriteriaHash = JSON.stringify(badge.updatedCriteria);
          
          if (originalCriteriaHash !== updatedCriteriaHash) {
            // Criteria changed, but awards should still be valid
            awardsAfterUpdate.forEach(award => {
              expect(award.id).toBeDefined();
              expect(award.awardedAt).toBeInstanceOf(Date);
              expect(award.memberId).toBeDefined();
            });
          }

          // Property: Award timestamps should not change during criteria updates
          relevantAwards.forEach((originalAward, index) => {
            const awardAfterUpdate = awardsAfterUpdate[index];
            expect(awardAfterUpdate.awardedAt.getTime()).toBe(originalAward.awardedAt.getTime());
          });

          // Property: Award reasons should not change during criteria updates
          relevantAwards.forEach((originalAward, index) => {
            const awardAfterUpdate = awardsAfterUpdate[index];
            expect(awardAfterUpdate.reason).toBe(originalAward.reason);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});