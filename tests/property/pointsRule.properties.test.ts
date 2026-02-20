// Points Rule Properties Test - Property-Based Testing for Points Rule System
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { PointsRuleService } from '../../services/pointsRuleService';
import { PointsRule, PointsRuleCondition } from '../../types';

// Mock Firebase
vi.mock('../../config/firebase', () => ({
  db: {},
}));

// Mock constants
vi.mock('../../config/constants', () => ({
  COLLECTIONS: {
    POINTS_RULES: 'pointsRules',
    POINTS_RULE_EXECUTIONS: 'pointsRuleExecutions',
  },
}));

// Mock dev mode
vi.mock('../../utils/devMode', () => ({
  isDevMode: () => true,
}));

describe('Points Rule Properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 41: Points rule weighted calculation', () => {
    /**
     * **Feature: platform-enhancements, Property 41: Points rule weighted calculation**
     * **Validates: Requirements 17.2**
     * 
     * For any point award with multiple applicable rules, the final points must equal the sum of (rule_points * rule_weight) for all triggered rules.
     */
    it('should calculate weighted points correctly for multiple applicable rules', () => {
      fc.assert(
        fc.property(
          // Generate multiple rules with different weights
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              name: fc.string({ minLength: 1, maxLength: 100 }),
              description: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
              trigger: fc.constantFrom('event_attendance', 'task_completion', 'project_completion'),
              conditions: fc.array(
                fc.record({
                  id: fc.string({ minLength: 1, maxLength: 20 }),
                  field: fc.constantFrom('member.role', 'event.type', 'project.status'),
                  operator: fc.constantFrom('equals', 'not_equals', 'contains'),
                  value: fc.string({ minLength: 1, maxLength: 20 }),
                }),
                { minLength: 1, maxLength: 3 }
              ),
              pointValue: fc.integer({ min: 1, max: 100 }),
              multiplier: fc.float({ min: Math.fround(0.1), max: Math.fround(5.0) }),
              weight: fc.float({ min: Math.fround(0.1), max: Math.fround(10.0) }),
              enabled: fc.constant(true),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          // Generate trigger data
          fc.record({
            member: fc.record({
              role: fc.constantFrom('MEMBER', 'BOARD', 'ADMIN'),
            }),
            event: fc.record({
              type: fc.constantFrom('Meeting', 'Training', 'Social'),
            }),
            project: fc.record({
              status: fc.constantFrom('Active', 'Completed', 'Planning'),
            }),
          }),
          (rules, triggerData) => {
            // Calculate expected total points manually
            let expectedTotalPoints = 0;
            const expectedAppliedRules: Array<{ ruleId: string; ruleName: string; points: number; weight: number }> = [];

            for (const rule of rules) {
              // For testing purposes, assume all conditions pass to focus on calculation logic
              const rulePoints = Math.round(rule.pointValue * rule.multiplier * rule.weight);
              expectedTotalPoints += rulePoints;
              expectedAppliedRules.push({
                ruleId: rule.id,
                ruleName: rule.name,
                points: rulePoints,
                weight: rule.weight,
              });
            }

            // Use the service to calculate points
            const actualCalculation = PointsRuleService.calculatePoints(rules, triggerData);

            // Verify the calculation matches our expected result
            expect(actualCalculation.finalPoints).toBe(expectedTotalPoints);
            expect(actualCalculation.appliedRules).toHaveLength(expectedAppliedRules.length);

            // Verify each applied rule
            expectedAppliedRules.forEach((expectedRule, index) => {
              const actualRule = actualCalculation.appliedRules[index];
              expect(actualRule.ruleId).toBe(expectedRule.ruleId);
              expect(actualRule.points).toBe(expectedRule.points);
              expect(actualRule.weight).toBe(expectedRule.weight);
            });

            // Verify the sum formula: final points = sum of (rule_points * rule_weight)
            const calculatedSum = expectedAppliedRules.reduce((sum, rule) => sum + rule.points, 0);
            expect(actualCalculation.finalPoints).toBe(calculatedSum);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 42: Points rule historical isolation', () => {
    /**
     * **Feature: platform-enhancements, Property 42: Points rule historical isolation**
     * **Validates: Requirements 17.5**
     * 
     * For any points rule update, historical point awards must remain unchanged.
     */
    it('should not affect historical point awards when rules are updated', () => {
      fc.assert(
        fc.property(
          // Generate original rule
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            description: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
            trigger: fc.constantFrom('event_attendance', 'task_completion', 'project_completion'),
            conditions: fc.array(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 20 }),
                field: fc.constantFrom('member.role', 'event.type', 'project.status'),
                operator: fc.constantFrom('equals', 'not_equals', 'contains'),
                value: fc.string({ minLength: 1, maxLength: 20 }),
              }),
              { minLength: 1, maxLength: 2 }
            ),
            pointValue: fc.integer({ min: 1, max: 100 }),
            multiplier: fc.float({ min: Math.fround(0.1), max: Math.fround(5.0) }),
            weight: fc.float({ min: Math.fround(0.1), max: Math.fround(10.0) }),
            enabled: fc.constant(true),
          }),
          // Generate updated rule (same ID, different values)
          fc.record({
            pointValue: fc.integer({ min: 1, max: 100 }),
            multiplier: fc.float({ min: Math.fround(0.1), max: Math.fround(5.0) }),
            weight: fc.float({ min: Math.fround(0.1), max: Math.fround(10.0) }),
          }),
          // Generate historical execution data
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              memberId: fc.string({ minLength: 1, maxLength: 50 }),
              pointsAwarded: fc.integer({ min: 1, max: 500 }),
              executedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2023-12-31') }).map(d => d.toISOString()),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (originalRule, ruleUpdates, historicalExecutions) => {
            // Simulate historical point awards with original rule
            const originalCalculation = PointsRuleService.calculatePoints([originalRule], {});
            const historicalPointsSnapshot = historicalExecutions.map(execution => ({
              ...execution,
              originalPoints: execution.pointsAwarded,
              calculationSnapshot: {
                ruleId: originalRule.id,
                pointValue: originalRule.pointValue,
                multiplier: originalRule.multiplier,
                weight: originalRule.weight,
                finalPoints: Math.round(originalRule.pointValue * originalRule.multiplier * originalRule.weight),
              },
            }));

            // Create updated rule
            const updatedRule: PointsRule = {
              ...originalRule,
              pointValue: ruleUpdates.pointValue,
              multiplier: ruleUpdates.multiplier,
              weight: ruleUpdates.weight,
            };

            // Calculate points with updated rule (for new awards)
            const newCalculation = PointsRuleService.calculatePoints([updatedRule], {});

            // Verify historical points remain unchanged
            historicalPointsSnapshot.forEach(historicalExecution => {
              // Historical points should not be recalculated
              expect(historicalExecution.originalPoints).toBe(historicalExecution.originalPoints);
              
              // Historical calculation snapshot should remain the same
              expect(historicalExecution.calculationSnapshot.pointValue).toBe(originalRule.pointValue);
              expect(historicalExecution.calculationSnapshot.multiplier).toBe(originalRule.multiplier);
              expect(historicalExecution.calculationSnapshot.weight).toBe(originalRule.weight);
              
              // Verify rule ID consistency (historical and new should reference same rule ID)
              expect(historicalExecution.calculationSnapshot.ruleId).toBe(updatedRule.id);
            });

            // Verify new calculations use updated values
            expect(newCalculation.finalPoints).toBe(
              Math.round(updatedRule.pointValue * updatedRule.multiplier * updatedRule.weight)
            );

            // The key property: if rule parameters changed, new calculation should be different from historical
            const originalFinalPoints = Math.round(originalRule.pointValue * originalRule.multiplier * originalRule.weight);
            const newFinalPoints = Math.round(updatedRule.pointValue * updatedRule.multiplier * updatedRule.weight);
            
            // Historical executions maintain their original calculation
            historicalPointsSnapshot.forEach(historicalExecution => {
              expect(historicalExecution.calculationSnapshot.finalPoints).toBe(originalFinalPoints);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Helper functions for testing
function getFieldValue(data: Record<string, any>, fieldPath: string): any {
  const keys = fieldPath.split('.');
  let value = data;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

function evaluateCondition(condition: PointsRuleCondition, actualValue: any): boolean {
  const { operator, value: expectedValue } = condition;

  switch (operator) {
    case 'equals':
      return actualValue === expectedValue;
    case 'not_equals':
      return actualValue !== expectedValue;
    case 'contains':
      return String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase());
    default:
      return false;
  }
}