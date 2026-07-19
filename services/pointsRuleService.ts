// Points Rule Service - Points Rule Configuration Management
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import {
  PointsRule,
  PointsRuleCondition,
  PointsRuleExecution,
  PointsCalculationBreakdown,
  PointsRuleTestResult,
  PointsRuleAnalytics,
  Member
} from '../types';
import { isDevMode, withDevMode } from '../utils/devMode';
import { apiCache } from './cacheService';
import { PointsService } from './pointsService';
import { errorLoggingService } from './errorLoggingService';

const CACHE_PREFIX_POINTS_RULES = 'pointsRules:';
const CACHE_TTL_POINTS_RULES = 5 * 60 * 1000; // 5 minutes

function invalidatePointsRulesCache(): void {
  apiCache.deleteByPrefix(CACHE_PREFIX_POINTS_RULES);
}

export class PointsRuleService {
  // Get all points rules
  static async getAllPointsRules(): Promise<PointsRule[]> {
    if (isDevMode()) return this.getDefaultPointsRules();
    const cacheKey = `${CACHE_PREFIX_POINTS_RULES}all`;
    return apiCache.getOrSet(
      cacheKey,
      async () => {
        try {
          const snapshot = await getDocs(
            query(
              collection(db, COLLECTIONS.POINTS_RULES),
              orderBy('weight', 'desc'),
              orderBy('name', 'asc')
            )
          );
          return snapshot.docs.map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate?.()?.toISOString() || d.data().createdAt,
            updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() || d.data().updatedAt,
          } as PointsRule));
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'PointsRuleService.getAllPointsRules' });
          throw error;
        }
      },
      CACHE_TTL_POINTS_RULES
    );
  }

  // Get enabled points rules
  static async getEnabledPointsRules(): Promise<PointsRule[]> {
    if (isDevMode()) return this.getDefaultPointsRules().filter(r => r.enabled);
    const cacheKey = `${CACHE_PREFIX_POINTS_RULES}enabled`;
    return apiCache.getOrSet(
      cacheKey,
      async () => {
        const allRules = await this.getAllPointsRules();
        return allRules.filter(rule => rule.enabled);
      },
      CACHE_TTL_POINTS_RULES
    );
  }

  // Get points rule by ID
  static async getPointsRuleById(ruleId: string): Promise<PointsRule | null> {
    return withDevMode(
      () => {
        const defaultRules = this.getDefaultPointsRules();
        return defaultRules.find(rule => rule.id === ruleId) || null;
      },
      async () => {
    try {
      const docRef = doc(db, COLLECTIONS.POINTS_RULES, ruleId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        } as PointsRule;
      }
      return null;
    } catch (error) {
      console.error('Error fetching points rule:', error);
      throw error;
    }
  });
  }

  // Create or update points rule
  static async savePointsRule(rule: Partial<PointsRule>): Promise<string> {
    if (isDevMode()) {
      console.log('[DEV MODE] Would save points rule:', rule);
      return `rule-${Date.now()}`;
    }
    try {
      let savedId: string;
      if (rule.id) {
        const docRef = doc(db, COLLECTIONS.POINTS_RULES, rule.id);
        await updateDoc(docRef, {
          ...rule,
          updatedAt: Timestamp.now(),
        });
        savedId = rule.id;
      } else {
        const newRule = {
          ...rule,
          enabled: rule.enabled ?? true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        const docRef = await addDoc(collection(db, COLLECTIONS.POINTS_RULES), newRule);
        savedId = docRef.id;
      }
      invalidatePointsRulesCache();
      return savedId;
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'PointsRuleService.savePointsRule' });
      throw error;
    }
  }

  // Delete points rule and all associated execution records
  static async deletePointsRule(ruleId: string): Promise<void> {
    if (isDevMode()) {
      console.log('[DEV MODE] Would delete points rule and executions for:', ruleId);
      return;
    }
    try {
      const batch = writeBatch(db);

      // Delete the rule document itself
      batch.delete(doc(db, COLLECTIONS.POINTS_RULES, ruleId));

      // Delete all execution records for this rule
      const executionsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.POINTS_RULE_EXECUTIONS),
          where('ruleId', '==', ruleId)
        )
      );
      executionsSnap.docs.forEach(execDoc => batch.delete(execDoc.ref));

      await batch.commit();
      invalidatePointsRulesCache();
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'PointsRuleService.deletePointsRule' });
      throw error;
    }
  }

  // Validate rule conditions
  static validateRuleConditions(conditions: PointsRuleCondition[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (conditions.length === 0) {
      errors.push('At least one condition is required');
    }

    conditions.forEach((condition, index) => {
      if (!condition.field) {
        errors.push(`Condition ${index + 1}: Field is required`);
      }
      if (!condition.operator) {
        errors.push(`Condition ${index + 1}: Operator is required`);
      }
      if (condition.value === undefined || condition.value === null || condition.value === '') {
        errors.push(`Condition ${index + 1}: Value is required`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Test rule execution
  static async testRule(rule: PointsRule, testData: Record<string, any>): Promise<PointsRuleTestResult> {
    try {
      // Validate conditions
      const validation = this.validateRuleConditions(rule.conditions);
      if (!validation.isValid) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          testData,
          conditionResults: [],
          pointsAwarded: 0,
          calculation: {
            basePoints: 0,
            multiplier: 1,
            weight: rule.weight,
            finalPoints: 0,
            appliedRules: [],
          },
          passed: false,
          errors: validation.errors,
        };
      }

      // Evaluate conditions
      const conditionResults = rule.conditions.map(condition => {
        const actualValue = this.getFieldValue(testData, condition.field);
        const passed = this.evaluateCondition(condition, actualValue);
        
        return {
          conditionId: condition.id,
          field: condition.field,
          operator: condition.operator,
          expectedValue: condition.value,
          actualValue,
          passed,
        };
      });

      // Check if all conditions pass
      const allConditionsPassed = conditionResults.every(result => result.passed);
      
      let pointsAwarded = 0;
      let calculation: PointsCalculationBreakdown = {
        basePoints: 0,
        multiplier: 1,
        weight: rule.weight,
        finalPoints: 0,
        appliedRules: [],
      };

      if (allConditionsPassed) {
        calculation = this.calculatePoints([rule], testData);
        pointsAwarded = calculation.finalPoints;
      }

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        testData,
        conditionResults,
        pointsAwarded,
        calculation,
        passed: allConditionsPassed,
      };
    } catch (error) {
      console.error('Error testing rule:', error);
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        testData,
        conditionResults: [],
        pointsAwarded: 0,
        calculation: {
          basePoints: 0,
          multiplier: 1,
          weight: rule.weight,
          finalPoints: 0,
          appliedRules: [],
        },
        passed: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // Execute rules for a trigger
  static async executeRules(
    trigger: string,
    triggerData: Record<string, any>,
    memberId: string,
    triggerId?: string, // deterministic de-dup key (e.g. eventId, taskId)
    loId?: string       // FIX 5: pass through for loId field on execution record
  ): Promise<PointsRuleExecution[]> {
    if (isDevMode()) {
      console.log('[DEV MODE] executeRules called:', { trigger, memberId, triggerId });
      return [];
    }
    try {
      const enabledRules = await this.getEnabledPointsRules();
      const applicableRules = enabledRules.filter(rule => rule.trigger === trigger);

      const executions: PointsRuleExecution[] = [];

      for (const rule of applicableRules) {
        const conditionsPassed = rule.conditions.every(condition => {
          const actualValue = this.getFieldValue(triggerData, condition.field);
          return this.evaluateCondition(condition, actualValue);
        });

        if (!conditionsPassed) continue;

        const calculation = this.calculatePoints([rule], triggerData);

        // FIX 3: repeatable rules skip all dedup checks
        if (!rule.isRepeatable) {
          // --- Duplicate-execution prevention ---
          const dedupeId = triggerId
            ? `${rule.id}_${memberId}_${triggerId}`
            : null;

          if (dedupeId) {
            // FIX 2: atomic dedup via runTransaction — reserve slot or detect existing
            const dedupeRef = doc(db, COLLECTIONS.POINTS_RULE_EXECUTIONS, dedupeId);
            let alreadyExecuted = false;
            try {
              await runTransaction(db, async (transaction) => {
                const existing = await transaction.get(dedupeRef);
                if (existing.exists()) {
                  alreadyExecuted = true;
                  return;
                }
                // Reserve the slot atomically; full payload written after awardPoints succeeds
                transaction.set(dedupeRef, {
                  ruleId: rule.id,
                  memberId,
                  trigger,
                  reservedAt: serverTimestamp(),
                  status: 'pending',
                });
              });
            } catch (txError) {
              errorLoggingService.logError(txError as Error, {
                action: 'PointsRuleService.executeRules.dedupeTransaction',
                additionalData: { ruleId: rule.id, memberId },
              });
              continue;
            }
            if (alreadyExecuted) continue;
          } else {
            // Fallback: query-based de-dup (no triggerId → non-repeatable rule)
            const dupSnap = await getDocs(
              query(
                collection(db, COLLECTIONS.POINTS_RULE_EXECUTIONS),
                where('ruleId', '==', rule.id),
                where('memberId', '==', memberId),
                limit(1)
              )
            );
            if (!dupSnap.empty) continue;
          }
        }

        const dedupeId = triggerId
          ? `${rule.id}_${memberId}_${triggerId}`
          : null;

        // FIX 1: award points FIRST — if this throws, no committed record exists.
        // P1 note: awardPoints uses runTransaction internally so it cannot be nested
        // inside another transaction. The dedup slot reserved above prevents re-execution
        // if the execution record write below fails — the slot stays 'pending' which is
        // safe: analytics will be incomplete but points are not double-awarded.
        await PointsService.awardPoints(
          memberId,
          calculation.finalPoints,
          'rule_execution',
          `Points rule: ${rule.name}`,
          dedupeId ?? rule.id,
          'points_rule',
          undefined,
          // P0 self-award guard bypass: pass memberId as awardedBy so the guard
          // in awardPoints knows this is an authorised automated award, not an
          // unauthenticated SDK call on behalf of another member.
          memberId
        );

        // --- Write (or overwrite) the full execution record after successful award ---
        // FIX 5: include loId if provided.
        // P1 fix: wrap in try/catch — if Firestore rules block the write (e.g. non-admin
        // caller), the dedup slot already prevents re-execution; log and continue.
        const executionPayload: Record<string, any> = {
          ruleId: rule.id,
          ruleName: rule.name,
          memberId,
          trigger,
          triggerData,
          pointsAwarded: calculation.finalPoints,
          calculation,
          executedAt: Timestamp.now(),
          status: 'completed',
          ...(loId ? { loId } : {}),
        };

        try {
          if (dedupeId) {
            await setDoc(doc(db, COLLECTIONS.POINTS_RULE_EXECUTIONS, dedupeId), executionPayload);
          } else {
            await addDoc(collection(db, COLLECTIONS.POINTS_RULE_EXECUTIONS), executionPayload);
          }
        } catch (recordWriteErr) {
          // Non-fatal: points were already awarded atomically above.
          // The dedup slot (status='pending') prevents re-execution.
          // Log so an admin can identify stuck execution records.
          errorLoggingService.logError(recordWriteErr as Error, {
            action: 'PointsRuleService.executeRules.writeExecutionRecord',
            additionalData: { ruleId: rule.id, memberId, dedupeId },
          });
        }

        const execution: PointsRuleExecution = {
          id: dedupeId ?? `exec-${Date.now()}`,
          ruleId: rule.id,
          ruleName: rule.name,
          memberId,
          trigger,
          triggerData,
          pointsAwarded: calculation.finalPoints,
          calculation,
          executedAt: new Date().toISOString(),
          ...(loId ? { loId } : {}),
        };
        executions.push(execution);
        // P2 fix: invalidate analytics cache so getRuleAnalytics reflects the new execution
        invalidatePointsRulesCache();
      }

      return executions;
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'PointsRuleService.executeRules' });
      throw error;
    }
  }

  // Calculate points with weights
  static calculatePoints(rules: PointsRule[], triggerData: Record<string, any>): PointsCalculationBreakdown {
    let totalPoints = 0;
    const appliedRules: Array<{ ruleId: string; ruleName: string; points: number; weight: number }> = [];

    for (const rule of rules) {
      const basePoints = rule.pointValue;
      const multiplier = rule.multiplier;
      const weight = rule.weight;
      
      const rulePoints = Math.round(basePoints * multiplier * weight);
      totalPoints += rulePoints;

      appliedRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        points: rulePoints,
        weight,
      });
    }

    return {
      basePoints: rules.reduce((sum, rule) => sum + rule.pointValue, 0),
      multiplier: rules.length > 0 ? rules.reduce((sum, rule) => sum + rule.multiplier, 0) / rules.length : 1,
      weight: rules.length > 0 ? rules.reduce((sum, rule) => sum + rule.weight, 0) / rules.length : 1,
      finalPoints: totalPoints,
      appliedRules,
    };
  }

  // Get field value from nested object
  private static getFieldValue(data: Record<string, any>, fieldPath: string): any {
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

  // Evaluate condition
  private static evaluateCondition(condition: PointsRuleCondition, actualValue: any): boolean {
    const { operator, value: expectedValue } = condition;

    switch (operator) {
      case 'equals':
        return actualValue === expectedValue;
      case 'not_equals':
        return actualValue !== expectedValue;
      case 'greater_than':
        return Number(actualValue) > Number(expectedValue);
      case 'less_than':
        return Number(actualValue) < Number(expectedValue);
      case 'contains':
        return String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      case 'not_contains':
        return !String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(actualValue);
      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(actualValue);
      default:
        return false;
    }
  }

  // Get rule analytics
  static async getRuleAnalytics(ruleId: string): Promise<PointsRuleAnalytics | null> {
    return withDevMode(
      () => ({
        ruleId,
        ruleName: 'Sample Rule',
        executionCount: 42,
        totalPointsAwarded: 1250,
        averagePointsPerExecution: 29.8,
        lastExecuted: new Date().toISOString(),
        topTriggers: [
          { trigger: 'event_attendance', count: 25 },
          { trigger: 'task_completion', count: 17 },
        ],
      }),
      async () => {
    // FIX 4: TTL cache for analytics (5 min)
    const analyticsCacheKey = `${CACHE_PREFIX_POINTS_RULES}analytics-${ruleId}`;
    return apiCache.getOrSet(
      analyticsCacheKey,
      async () => {
    try {
      const rule = await this.getPointsRuleById(ruleId);
      if (!rule) return null;

      // FIX 4: cap at 500 docs to avoid full collection scan
      const executionsSnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.POINTS_RULE_EXECUTIONS),
          where('ruleId', '==', ruleId),
          orderBy('executedAt', 'desc'),
          limit(500)
        )
      );

      const executions = executionsSnapshot.docs.map(d => d.data() as PointsRuleExecution);

      const executionCount = executions.length;
      const totalPointsAwarded = executions.reduce((sum, exec) => sum + exec.pointsAwarded, 0);
      const averagePointsPerExecution = executionCount > 0 ? totalPointsAwarded / executionCount : 0;

      const triggerCounts: Record<string, number> = {};
      executions.forEach(exec => {
        triggerCounts[exec.trigger] = (triggerCounts[exec.trigger] || 0) + 1;
      });

      const topTriggers = Object.entries(triggerCounts)
        .map(([trigger, count]) => ({ trigger, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        ruleId,
        ruleName: rule.name,
        executionCount,
        totalPointsAwarded,
        averagePointsPerExecution,
        lastExecuted: executions.length > 0 ? executions[0].executedAt : undefined,
        topTriggers,
      };
    } catch (error) {
      console.error('Error getting rule analytics:', error);
      throw error;
    }
      },
      CACHE_TTL_POINTS_RULES
    );
  });
  }

  // Get default points rules for dev mode
  static getDefaultPointsRules(): PointsRule[] {
    return [
      {
        id: 'event-attendance-basic',
        name: 'Event Attendance - Basic',
        description: 'Points for attending any event',
        trigger: 'event_attendance',
        conditions: [
          {
            id: 'cond-1',
            field: 'event.type',
            operator: 'in',
            value: ['Meeting', 'Training', 'Social', 'Project'],
          }
        ],
        pointValue: 10,
        multiplier: 1,
        weight: 1,
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'event-attendance-board',
        name: 'Event Attendance - Board Bonus',
        description: 'Extra points for board members attending events',
        trigger: 'event_attendance',
        conditions: [
          {
            id: 'cond-2',
            field: 'member.role',
            operator: 'equals',
            value: 'BOARD',
          }
        ],
        pointValue: 5,
        multiplier: 1,
        weight: 1.5,
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'project-completion',
        name: 'Project Completion',
        description: 'Points for completing projects',
        trigger: 'project_completion',
        conditions: [
          {
            id: 'cond-3',
            field: 'project.status',
            operator: 'equals',
            value: 'Completed',
          }
        ],
        pointValue: 50,
        multiplier: 1,
        weight: 2,
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'training-completion',
        name: 'Training Completion',
        description: 'Points for completing training modules',
        trigger: 'training_completion',
        conditions: [
          {
            id: 'cond-4',
            field: 'training.type',
            operator: 'in',
            value: ['JCI Official', 'Leadership', 'Local Skill'],
          }
        ],
        pointValue: 25,
        multiplier: 1,
        weight: 1.2,
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'recruitment-success',
        name: 'Recruitment Success',
        description: 'Points for successful member recruitment',
        trigger: 'recruitment',
        conditions: [
          {
            id: 'cond-5',
            field: 'recruitment.status',
            operator: 'equals',
            value: 'approved',
          }
        ],
        pointValue: 100,
        multiplier: 1,
        weight: 3,
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    ];
  }
}