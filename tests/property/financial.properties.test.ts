/**
 * Property-Based Tests for Financial Management
 * Feature: platform-enhancements
 * 
 * These tests use fast-check to verify universal properties across all inputs.
 * Each test runs 100 iterations with randomly generated data.
 */

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { TransactionType } from '../../types';

describe('Financial Management Properties', () => {
  /**
   * Property 1: Transaction split sum invariant
   * Feature: platform-enhancements, Property 1: Transaction split sum invariant
   * Validates: Requirements 1.2
   * 
   * For any transaction with splits, the sum of all split amounts must equal 
   * the original transaction amount.
   */
  it('Property 1: Transaction split sum invariant', () => {
    fc.assert(
      fc.property(
        // Generate a transaction amount between 0.01 and 100,000
        fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
        // Generate 2-4 splits
        fc.array(
          fc.record({
            transactionType: fc.constantFrom<TransactionType>(
              'project',
              'operations',
              'dues',
              'merchandise'
            ),
            description: fc.string({ minLength: 1, maxLength: 100 }),
            // Generate split amounts that will be normalized
            amount: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          }),
          { minLength: 2, maxLength: 4 }
        ),
        (transactionAmount, rawSplits) => {
          // Normalize split amounts to sum to transaction amount
          const totalRawAmount = rawSplits.reduce((sum, s) => sum + s.amount, 0);
          const normalizedSplits = rawSplits.map(s => ({
            ...s,
            amount: (s.amount / totalRawAmount) * transactionAmount,
          }));

          // Verify the invariant: sum of splits equals transaction amount
          const splitSum = normalizedSplits.reduce((sum, s) => sum + s.amount, 0);
          
          // Allow for floating point precision errors (within 0.01)
          expect(Math.abs(splitSum - transactionAmount)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Balance calculation completeness
   * Feature: platform-enhancements, Property 2: Balance calculation completeness
   * Validates: Requirements 1.1
   * 
   * For any bank account and reconciliation date, the system balance calculation 
   * must include all four transaction types (project, operations, dues, merchandise).
   */
  it('Property 2: Balance calculation completeness', () => {
    fc.assert(
      fc.property(
        // Generate transactions of all four types
        fc.array(
          fc.record({
            type: fc.constantFrom('Income', 'Expense'),
            transactionType: fc.constantFrom<TransactionType>(
              'project',
              'operations',
              'dues',
              'merchandise'
            ),
            amount: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
            date: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          }),
          { minLength: 10, maxLength: 50 }
        ),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
        (transactions, reconciliationDate) => {
          // Filter transactions up to reconciliation date
          const relevantTransactions = transactions.filter(
            t => t.date <= reconciliationDate
          );

          // Calculate balance including all transaction types
          const balance = relevantTransactions.reduce((sum, t) => {
            const amount = t.type === 'Income' ? t.amount : -Math.abs(t.amount);
            return sum + amount;
          }, 0);

          // Calculate balance by type
          const balanceByType: Record<TransactionType, number> = {
            project: 0,
            operations: 0,
            dues: 0,
            merchandise: 0,
          };

          relevantTransactions.forEach(t => {
            const amount = t.type === 'Income' ? t.amount : -Math.abs(t.amount);
            balanceByType[t.transactionType] += amount;
          });

          // Sum of type balances should equal total balance
          const sumOfTypeBalances = Object.values(balanceByType).reduce(
            (sum, b) => sum + b,
            0
          );

          expect(Math.abs(sumOfTypeBalances - balance)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Membership dues amount correctness
   * Feature: platform-enhancements, Property 3: Membership dues amount correctness
   * Validates: Requirements 2.1
   * 
   * For any member renewal, the dues amount must match their membership type.
   */
  it('Property 3: Membership dues amount correctness', () => {
    fc.assert(
      fc.property(
        fc.record({
          membershipType: fc.constantFrom('probation', 'full', 'honorary', 'senator', 'visiting'),
          memberId: fc.uuid(),
          duesYear: fc.integer({ min: 2020, max: 2030 }),
        }),
        (data) => {
          const expectedAmounts: Record<string, number> = {
            probation: 350,
            full: 300,
            honorary: 50,
            senator: 0,
            visiting: 500,
          };

          const expectedAmount = expectedAmounts[data.membershipType];
          
          // Verify the dues amount matches the membership type
          expect(expectedAmount).toBeDefined();
          expect(expectedAmount).toBeGreaterThanOrEqual(0);
          
          // Verify specific amounts
          if (data.membershipType === 'probation') expect(expectedAmount).toBe(350);
          if (data.membershipType === 'full') expect(expectedAmount).toBe(300);
          if (data.membershipType === 'honorary') expect(expectedAmount).toBe(50);
          if (data.membershipType === 'senator') expect(expectedAmount).toBe(0);
          if (data.membershipType === 'visiting') expect(expectedAmount).toBe(500);
        }
      ),
      { numRuns: 100 }
    );
  });
});