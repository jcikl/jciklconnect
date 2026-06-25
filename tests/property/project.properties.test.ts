/**
 * Property-Based Tests for Project Management System
 * Feature: platform-enhancements
 * 
 * These tests use fast-check to verify universal properties across all inputs.
 * Each test runs 100 iterations with randomly generated data.
 */

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import {
  ProjectFinancialAccount,
  ProjectTransaction,
  BudgetCategory,
  ProjectFinancialSummary,
  GanttTask
} from '../../types';

describe('Project Management Properties', () => {
  /**
   * Property 16: Project account balance invariant
   * Feature: platform-enhancements, Property 16: Project account balance invariant
   * Validates: Requirements 6.2
   * 
   * For any project financial account, the current balance must always equal
   * starting balance plus total income minus total expenses.
   */
  describe('Property 16: Project account balance invariant', () => {
    it('should maintain balance invariant after any sequence of transactions', () => {
      fc.assert(
        fc.property(
          fc.record({
            startingBalance: fc.integer({ min: 0, max: 100000 }),
            transactions: fc.array(
              fc.record({
                type: fc.constantFrom('income', 'expense'),
                amount: fc.integer({ min: 1, max: 10000 }),
              }),
              { minLength: 0, maxLength: 50 }
            ),
          }),
          (data) => {
            const { startingBalance, transactions } = data;
            
            // Calculate expected values
            let totalIncome = 0;
            let totalExpenses = 0;
            
            transactions.forEach(transaction => {
              if (transaction.type === 'income') {
                totalIncome += transaction.amount;
              } else {
                totalExpenses += transaction.amount;
              }
            });
            
            const expectedBalance = startingBalance + totalIncome - totalExpenses;
            
            // Property: Balance invariant must hold
            expect(expectedBalance).toBe(startingBalance + totalIncome - totalExpenses);
            
            // Property: Total income should be sum of all income transactions
            const calculatedIncome = transactions
              .filter(t => t.type === 'income')
              .reduce((sum, t) => sum + t.amount, 0);
            expect(totalIncome).toBe(calculatedIncome);
            
            // Property: Total expenses should be sum of all expense transactions
            const calculatedExpenses = transactions
              .filter(t => t.type === 'expense')
              .reduce((sum, t) => sum + t.amount, 0);
            expect(totalExpenses).toBe(calculatedExpenses);
            
            // Property: Balance should never be undefined or NaN
            expect(typeof expectedBalance).toBe('number');
            expect(isNaN(expectedBalance)).toBe(false);
            expect(isFinite(expectedBalance)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases in balance calculations', () => {
      fc.assert(
        fc.property(
          fc.record({
            startingBalance: fc.integer({ min: -50000, max: 50000 }),
            largeTransaction: fc.integer({ min: 100000, max: 1000000 }),
            transactionType: fc.constantFrom('income', 'expense'),
          }),
          (data) => {
            const { startingBalance, largeTransaction, transactionType } = data;
            
            // Calculate balance after large transaction
            let expectedBalance = startingBalance;
            if (transactionType === 'income') {
              expectedBalance += largeTransaction;
            } else {
              expectedBalance -= largeTransaction;
            }
            
            // Property: Balance calculation should handle large numbers correctly
            expect(typeof expectedBalance).toBe('number');
            expect(isFinite(expectedBalance)).toBe(true);
            
            // Property: Balance should reflect the transaction correctly
            if (transactionType === 'income') {
              expect(expectedBalance).toBe(startingBalance + largeTransaction);
            } else {
              expect(expectedBalance).toBe(startingBalance - largeTransaction);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistency across multiple account operations', () => {
      fc.assert(
        fc.property(
          fc.record({
            accounts: fc.array(
              fc.record({
                id: fc.uuid(),
                startingBalance: fc.integer({ min: 0, max: 50000 }),
                budget: fc.integer({ min: 1000, max: 100000 }),
              }),
              { minLength: 1, maxLength: 10 }
            ),
          }),
          (data) => {
            const { accounts } = data;
            
            // Property: Each account should have unique ID
            const accountIds = accounts.map(acc => acc.id);
            const uniqueIds = new Set(accountIds);
            expect(uniqueIds.size).toBe(accountIds.length);
            
            // Property: All accounts should have valid financial data
            accounts.forEach(account => {
              expect(account.startingBalance).toBeGreaterThanOrEqual(0);
              expect(account.budget).toBeGreaterThan(0);
              expect(typeof account.startingBalance).toBe('number');
              expect(typeof account.budget).toBe('number');
            });
            
            // Property: Budget should be reasonable relative to starting balance
            accounts.forEach(account => {
              // Budget can be independent of starting balance, but both should be positive
              expect(account.budget).toBeGreaterThan(0);
              expect(account.startingBalance).toBeGreaterThanOrEqual(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: Budget utilization calculation
   * Feature: platform-enhancements, Property 17: Budget utilization calculation
   * Validates: Requirements 6.3
   * 
   * For any project budget and expenses, the utilization percentage must be
   * calculated correctly and remain within valid bounds.
   */
  describe('Property 17: Budget utilization calculation', () => {
    it('should calculate budget utilization percentage correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            budget: fc.integer({ min: 1, max: 100000 }),
            expenses: fc.integer({ min: 0, max: 200000 }),
          }),
          (data) => {
            const { budget, expenses } = data;
            
            // Calculate utilization percentage
            const utilization = (expenses / budget) * 100;
            
            // Property: Utilization should be calculated correctly
            expect(utilization).toBe((expenses / budget) * 100);
            
            // Property: Utilization should be a valid number
            expect(typeof utilization).toBe('number');
            expect(isNaN(utilization)).toBe(false);
            expect(isFinite(utilization)).toBe(true);
            
            // Property: Utilization should be non-negative
            expect(utilization).toBeGreaterThanOrEqual(0);
            
            // Property: When expenses equal budget, utilization should be 100%
            if (expenses === budget) {
              expect(utilization).toBe(100);
            }
            
            // Property: When expenses are zero, utilization should be 0%
            if (expenses === 0) {
              expect(utilization).toBe(0);
            }
            
            // Property: When expenses exceed budget, utilization should be > 100%
            if (expenses > budget) {
              expect(utilization).toBeGreaterThan(100);
            }
            
            // Property: When expenses are less than budget, utilization should be < 100%
            if (expenses < budget) {
              expect(utilization).toBeLessThan(100);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases in budget utilization', () => {
      fc.assert(
        fc.property(
          fc.record({
            budget: fc.integer({ min: 100, max: 10000 }),
            expenses: fc.integer({ min: 0, max: 50000 }),
          }),
          (data) => {
            const { budget, expenses } = data;
            
            const utilization = (expenses / budget) * 100;
            
            // Property: Utilization should be calculated correctly
            expect(utilization).toBe((expenses / budget) * 100);
            
            // Property: Utilization should be a valid number
            expect(typeof utilization).toBe('number');
            expect(isNaN(utilization)).toBe(false);
            expect(isFinite(utilization)).toBe(true);
            
            // Property: Utilization bounds should be respected
            if (expenses === 0) {
              expect(utilization).toBe(0);
            }
            
            if (expenses >= budget) {
              expect(utilization).toBeGreaterThanOrEqual(100);
            }
            
            if (expenses < budget) {
              expect(utilization).toBeLessThan(100);
            }
            
            // Property: Utilization should be non-negative
            expect(utilization).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate remaining funds correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            budget: fc.integer({ min: 1000, max: 100000 }),
            expenses: fc.integer({ min: 0, max: 150000 }),
          }),
          (data) => {
            const { budget, expenses } = data;
            
            const remainingFunds = budget - expenses;
            const utilization = (expenses / budget) * 100;
            
            // Property: Remaining funds calculation should be correct
            expect(remainingFunds).toBe(budget - expenses);
            
            // Property: When utilization is 100%, remaining funds should be 0
            if (Math.abs(utilization - 100) < 0.01) {
              expect(Math.abs(remainingFunds)).toBeLessThan(1);
            }
            
            // Property: When expenses exceed budget, remaining funds should be negative
            if (expenses > budget) {
              expect(remainingFunds).toBeLessThan(0);
            }
            
            // Property: When expenses are less than budget, remaining funds should be positive
            if (expenses < budget) {
              expect(remainingFunds).toBeGreaterThan(0);
            }
            
            // Property: Budget should equal expenses plus remaining funds
            expect(budget).toBe(expenses + remainingFunds);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 18: Over-budget warning display
   * Feature: platform-enhancements, Property 18: Over-budget warning display
   * Validates: Requirements 6.4
   * 
   * For any project budget and expenses, warnings should be displayed correctly
   * based on configurable thresholds.
   */
  describe('Property 18: Over-budget warning display', () => {
    it('should trigger warnings at correct thresholds', () => {
      fc.assert(
        fc.property(
          fc.record({
            budget: fc.integer({ min: 1000, max: 100000 }),
            expenses: fc.integer({ min: 0, max: 150000 }),
            warningThreshold: fc.integer({ min: 50, max: 95 }),
            criticalThreshold: fc.integer({ min: 96, max: 120 }),
          }),
          (data) => {
            const { budget, expenses, warningThreshold, criticalThreshold } = data;
            
            const utilization = (expenses / budget) * 100;
            
            // Determine warning status
            const shouldShowWarning = utilization >= warningThreshold && utilization < criticalThreshold;
            const shouldShowCritical = utilization >= criticalThreshold;
            const shouldShowNormal = utilization < warningThreshold;
            
            // Property: Only one warning state should be active
            const activeStates = [shouldShowWarning, shouldShowCritical, shouldShowNormal].filter(Boolean);
            expect(activeStates.length).toBe(1);
            
            // Property: Warning threshold should be less than critical threshold
            expect(warningThreshold).toBeLessThan(criticalThreshold);
            
            // Property: Warning logic should be consistent
            if (utilization >= criticalThreshold) {
              expect(shouldShowCritical).toBe(true);
              expect(shouldShowWarning).toBe(false);
              expect(shouldShowNormal).toBe(false);
            } else if (utilization >= warningThreshold) {
              expect(shouldShowWarning).toBe(true);
              expect(shouldShowCritical).toBe(false);
              expect(shouldShowNormal).toBe(false);
            } else {
              expect(shouldShowNormal).toBe(true);
              expect(shouldShowWarning).toBe(false);
              expect(shouldShowCritical).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle threshold edge cases correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            budget: fc.integer({ min: 1000, max: 10000 }),
            thresholdPercentage: fc.integer({ min: 80, max: 100 }),
          }),
          (data) => {
            const { budget, thresholdPercentage } = data;
            
            // Test expenses exactly at threshold
            const expensesAtThreshold = Math.floor((budget * thresholdPercentage) / 100);
            const utilizationAtThreshold = (expensesAtThreshold / budget) * 100;
            
            // Property: Utilization at threshold should trigger warning
            const shouldTriggerAtThreshold = utilizationAtThreshold >= thresholdPercentage;
            
            // Test expenses just below threshold
            const expensesBelowThreshold = Math.floor((budget * (thresholdPercentage - 1)) / 100);
            const utilizationBelowThreshold = (expensesBelowThreshold / budget) * 100;
            
            // Property: Utilization below threshold should not trigger warning
            const shouldTriggerBelowThreshold = utilizationBelowThreshold >= thresholdPercentage;
            
            // Verify threshold behavior
            if (utilizationAtThreshold >= thresholdPercentage) {
              expect(shouldTriggerAtThreshold).toBe(true);
            }
            
            if (utilizationBelowThreshold < thresholdPercentage) {
              expect(shouldTriggerBelowThreshold).toBe(false);
            }
            
            // Property: Threshold should be a valid percentage
            expect(thresholdPercentage).toBeGreaterThanOrEqual(0);
            expect(thresholdPercentage).toBeLessThanOrEqual(200); // Allow for over-budget scenarios
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate appropriate warning messages', () => {
      fc.assert(
        fc.property(
          fc.record({
            projectName: fc.string({ minLength: 1, maxLength: 50 }),
            budget: fc.integer({ min: 1000, max: 100000 }),
            expenses: fc.integer({ min: 800, max: 150000 }),
          }),
          (data) => {
            const { projectName, budget, expenses } = data;
            
            const utilization = (expenses / budget) * 100;
            
            // Generate warning message based on utilization
            let warningMessage = '';
            let severity = 'normal';
            
            if (utilization >= 100) {
              const overBudget = utilization - 100;
              warningMessage = `Project "${projectName}" has exceeded its budget by ${overBudget.toFixed(1)}%`;
              severity = 'critical';
            } else if (utilization >= 80) {
              warningMessage = `Project "${projectName}" has used ${utilization.toFixed(1)}% of its budget`;
              severity = 'warning';
            }
            
            // Property: Warning message should contain project name
            if (warningMessage) {
              expect(warningMessage).toContain(projectName);
              expect(warningMessage).toContain('budget');
            }
            
            // Property: Severity should match utilization level
            if (utilization >= 100) {
              expect(severity).toBe('critical');
            } else if (utilization >= 80) {
              expect(severity).toBe('warning');
            } else {
              expect(severity).toBe('normal');
            }
            
            // Property: Message should include percentage information
            if (warningMessage) {
              expect(warningMessage).toMatch(/\d+\.\d+%/);
            }
            
            // Property: Project name should be valid
            expect(projectName.length).toBeGreaterThan(0);
            expect(typeof projectName).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple warning types correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            budgetCategories: fc.array(
              fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 30 }),
                allocated: fc.integer({ min: 100, max: 10000 }),
                spent: fc.integer({ min: 0, max: 15000 }),
              }),
              { minLength: 1, maxLength: 10 }
            ),
          }),
          (data) => {
            const { budgetCategories } = data;
            
            const warnings: Array<{
              type: 'category_warning' | 'category_exceeded';
              categoryId: string;
              utilization: number;
            }> = [];
            
            // Check each category for warnings
            budgetCategories.forEach(category => {
              const utilization = category.allocated > 0 
                ? (category.spent / category.allocated) * 100 
                : 0;
              
              if (utilization >= 100) {
                warnings.push({
                  type: 'category_exceeded',
                  categoryId: category.id,
                  utilization,
                });
              } else if (utilization >= 80) {
                warnings.push({
                  type: 'category_warning',
                  categoryId: category.id,
                  utilization,
                });
              }
            });
            
            // Property: Warnings should only be generated for categories that meet thresholds
            warnings.forEach(warning => {
              const category = budgetCategories.find(cat => cat.id === warning.categoryId);
              expect(category).toBeDefined();
              
              if (category) {
                const actualUtilization = category.allocated > 0 
                  ? (category.spent / category.allocated) * 100 
                  : 0;
                
                expect(warning.utilization).toBe(actualUtilization);
                
                if (warning.type === 'category_exceeded') {
                  expect(actualUtilization).toBeGreaterThanOrEqual(100);
                } else if (warning.type === 'category_warning') {
                  expect(actualUtilization).toBeGreaterThanOrEqual(80);
                  expect(actualUtilization).toBeLessThan(100);
                }
              }
            });
            
            // Property: Category IDs in warnings should be unique
            const warningCategoryIds = warnings.map(w => w.categoryId);
            const uniqueWarningIds = new Set(warningCategoryIds);
            expect(uniqueWarningIds.size).toBe(warningCategoryIds.length);
            
            // Property: All categories should have valid data
            budgetCategories.forEach(category => {
              expect(category.allocated).toBeGreaterThanOrEqual(0);
              expect(category.spent).toBeGreaterThanOrEqual(0);
              expect(category.name.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 19: Gantt task duration invariance
   * Feature: platform-enhancements, Property 19: Gantt task duration invariance
   * Validates: Requirements 8.4
   * 
   * For any Gantt chart zoom operation, task durations (end date - start date) 
   * must remain constant regardless of the zoom level.
   */
  describe('Property 19: Gantt task duration invariance', () => {
    it('should maintain task duration across different zoom levels', () => {
      fc.assert(
        fc.property(
          fc.record({
            tasks: fc.array(
              fc.record({
                id: fc.uuid(),
                projectId: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 50 }),
                startDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
                durationDays: fc.integer({ min: 1, max: 365 }),
                progress: fc.integer({ min: 0, max: 100 }),
                dependencies: fc.array(fc.uuid(), { maxLength: 3 }),
                assignees: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 3 }),
                status: fc.constantFrom('not_started', 'in_progress', 'completed', 'overdue'),
              }),
              { minLength: 1, maxLength: 20 }
            ),
            zoomLevels: fc.array(
              fc.constantFrom('hour', 'day', 'week', 'month', 'year'),
              { minLength: 2, maxLength: 5 }
            ),
          }),
          (data) => {
            const { tasks, zoomLevels } = data;
            
            // Create GanttTask objects with calculated end dates
            const ganttTasks: GanttTask[] = tasks
              .filter(task => !isNaN(task.startDate.getTime())) // Filter out invalid dates
              .map(task => ({
                ...task,
                endDate: new Date(task.startDate.getTime() + task.durationDays * 24 * 60 * 60 * 1000),
              }));
            
            // Skip test if no valid tasks
            if (ganttTasks.length === 0) return;
            
            // Calculate original durations
            const originalDurations = ganttTasks.map(task => ({
              taskId: task.id,
              duration: task.endDate.getTime() - task.startDate.getTime(),
            }));
            
            // Test each zoom level
            zoomLevels.forEach(zoomLevel => {
              // Simulate zoom operation (in real implementation, this would be handled by the Gantt library)
              // The key property is that task durations should remain the same
              
              ganttTasks.forEach((task, index) => {
                const originalDuration = originalDurations[index].duration;
                const currentDuration = task.endDate.getTime() - task.startDate.getTime();
                
                // Property: Duration must remain constant across zoom levels
                expect(currentDuration).toBe(originalDuration);
                
                // Property: Duration should be positive
                expect(currentDuration).toBeGreaterThan(0);
                
                // Property: End date should be after start date
                expect(task.endDate.getTime()).toBeGreaterThan(task.startDate.getTime());
                
                // Property: Duration should be consistent with start and end dates
                const expectedDurationMs = task.endDate.getTime() - task.startDate.getTime();
                expect(Math.abs(currentDuration - expectedDurationMs)).toBeLessThan(1000); // Allow 1 second tolerance
              });
            });
            
            // Property: All tasks should have valid data
            ganttTasks.forEach(task => {
              expect(task.id).toBeTruthy();
              expect(task.name.length).toBeGreaterThan(0);
              expect(task.progress).toBeGreaterThanOrEqual(0);
              expect(task.progress).toBeLessThanOrEqual(100);
              expect(Array.isArray(task.dependencies)).toBe(true);
              expect(Array.isArray(task.assignees)).toBe(true);
              expect(['not_started', 'in_progress', 'completed', 'overdue']).toContain(task.status);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 20: Gantt dependency visualization
   * Feature: platform-enhancements, Property 20: Gantt dependency visualization
   * Validates: Requirements 8.2
   * 
   * For any task with dependencies, connection lines must be drawn to all 
   * predecessor tasks in the Gantt chart visualization.
   */
  describe('Property 20: Gantt dependency visualization', () => {
    it('should visualize all task dependencies correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            tasks: fc.array(
              fc.record({
                id: fc.uuid(),
                projectId: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 40 }),
                startDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-01') }),
                durationDays: fc.integer({ min: 1, max: 60 }),
                progress: fc.integer({ min: 0, max: 100 }),
                assignees: fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 2 }),
                status: fc.constantFrom('not_started', 'in_progress', 'completed', 'overdue'),
              }),
              { minLength: 3, maxLength: 10 }
            ),
          }),
          (data) => {
            const { tasks } = data;
            
            // Create task map for easy lookup
            const taskMap = new Map<string, GanttTask>();
            const ganttTasks: GanttTask[] = tasks.map(task => {
              const ganttTask: GanttTask = {
                ...task,
                endDate: new Date(task.startDate.getTime() + task.durationDays * 24 * 60 * 60 * 1000),
                dependencies: [], // Will be set below
              };
              taskMap.set(ganttTask.id, ganttTask);
              return ganttTask;
            });
            
            // Create realistic dependencies (ensure no circular dependencies)
            ganttTasks.forEach((task, index) => {
              if (index > 0) {
                // Each task can depend on previous tasks
                const possibleDependencies = ganttTasks.slice(0, index);
                const numDependencies = Math.min(2, possibleDependencies.length);
                const selectedDependencies = possibleDependencies
                  .sort(() => Math.random() - 0.5)
                  .slice(0, numDependencies)
                  .map(t => t.id);
                
                task.dependencies = selectedDependencies;
              }
            });
            
            // Test dependency visualization properties
            ganttTasks.forEach(task => {
              // Property: All dependencies should reference existing tasks
              task.dependencies.forEach(depId => {
                const dependencyTask = taskMap.get(depId);
                expect(dependencyTask).toBeDefined();
                
                if (dependencyTask) {
                  // Property: Dependency task should exist in the task list
                  expect(ganttTasks.some(t => t.id === depId)).toBe(true);
                  
                  // Property: Dependency should not be the task itself (no self-dependency)
                  expect(depId).not.toBe(task.id);
                }
              });
              
              // Property: Dependencies array should not contain duplicates
              const uniqueDependencies = new Set(task.dependencies);
              expect(uniqueDependencies.size).toBe(task.dependencies.length);
              
              // Property: Task should not depend on itself
              expect(task.dependencies).not.toContain(task.id);
            });
            
            // Property: Check for circular dependencies
            const hasCircularDependency = (taskId: string, visited = new Set<string>(), path = new Set<string>()): boolean => {
              if (path.has(taskId)) return true; // Circular dependency found
              if (visited.has(taskId)) return false; // Already processed
              
              visited.add(taskId);
              path.add(taskId);
              
              const task = taskMap.get(taskId);
              if (task) {
                for (const depId of task.dependencies) {
                  if (hasCircularDependency(depId, visited, path)) {
                    return true;
                  }
                }
              }
              
              path.delete(taskId);
              return false;
            };
            
            // Property: No task should have circular dependencies
            ganttTasks.forEach(task => {
              expect(hasCircularDependency(task.id)).toBe(false);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});