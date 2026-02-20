// Points Rule Service - Points Rule Configuration Management
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
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
import { isDevMode } from '../utils/devMode';

export class PointsRuleService {
  // Get all points rules
  static async getAllPointsRules(): Promise<PointsRule[]> {
    if (isDevMode()) {
      return this.getDefaultPointsRules();
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.POINTS_RULES),
          orderBy('weight', 'desc'),
          orderBy('name', 'asc')
        )
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      } as PointsRule));
    } catch (error) {
      console.error('Error fetching points rules:', error);
      throw error;
    }
  }

  // Get enabled points rules
  static async getEnabledPointsRules(): Promise<PointsRule[]> {
    const allRules = await this.getAllPointsRules();
    return allRules.filter(rule => rule.enabled);
  }

  // Get points rule by ID
  static async getPointsRuleById(ruleId: string): Promise<PointsRule | null> {
    if (isDevMode()) {
      const defaultRules = this.getDefaultPointsRules();
      return defaultRules.find(rule => rule.id === ruleId) || null;
    }

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
  }

  // Create or update points rule
  static async savePointsRule(rule: Partial<PointsRule>): Promise<string> {
    if (isDevMode()) {
      console.log('[DEV MODE] Would save points rule:', rule);
      return `rule-${Date.now()}`;
    }

    try {
      if (rule.id) {
        // Update existing
        const docRef = doc(db, COLLECTIONS.POINTS_RULES, rule.id);
        await updateDoc(docRef, {
          ...rule,
          updatedAt: Timestamp.now(),
        });
        return rule.id;
      } else {
        // Create new
        const newRule = {
          ...rule,
          enabled: rule.enabled ?? true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        const docRef = await addDoc(collection(db, COLLECTIONS.POINTS_RULES), newRule);
        return docRef.id;
      }
    } catch (error) {
      console.error('Error saving points rule:', error);
      throw error;
    }
  }

  // Delete points rule
  static async deletePointsRule(ruleId: string): Promise<void> {
    if (isDevMode()) {
      console.log('[DEV MODE] Would delete points rule:', ruleId);
      return;
    }

    try {
      const docRef = doc(db, COLLECTIONS.POINTS_RULES, ruleId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting points rule:', error);
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
    memberId: string
  ): Promise<PointsRuleExecution[]> {
    try {
      const enabledRules = await this.getEnabledPointsRules();
      const applicableRules = enabledRules.filter(rule => rule.trigger === trigger);
      
      const executions: PointsRuleExecution[] = [];

      for (const rule of applicableRules) {
        const conditionsPassed = rule.conditions.every(condition => {
          const actualValue = this.getFieldValue(triggerData, condition.field);
          return this.evaluateCondition(condition, actualValue);
        });

        if (conditionsPassed) {
          const calculation = this.calculatePoints([rule], triggerData);
          
          const execution: PointsRuleExecution = {
            id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ruleId: rule.id,
            ruleName: rule.name,
            memberId,
            trigger,
            triggerData,
            pointsAwarded: calculation.finalPoints,
            calculation,
            executedAt: new Date().toISOString(),
          };

          executions.push(execution);

          // Log execution in dev mode
          if (isDevMode()) {
            console.log('[DEV MODE] Points rule executed:', execution);
          } else {
            // Save execution to database
            await addDoc(collection(db, COLLECTIONS.POINTS_RULE_EXECUTIONS), {
              ...execution,
              executedAt: Timestamp.now(),
            });
          }
        }
      }

      return executions;
    } catch (error) {
      console.error('Error executing rules:', error);
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
    if (isDevMode()) {
      return {
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
      };
    }

    try {
      const rule = await this.getPointsRuleById(ruleId);
      if (!rule) return null;

      const executionsSnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.POINTS_RULE_EXECUTIONS),
          where('ruleId', '==', ruleId),
          orderBy('executedAt', 'desc')
        )
      );

      const executions = executionsSnapshot.docs.map(doc => doc.data() as PointsRuleExecution);
      
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