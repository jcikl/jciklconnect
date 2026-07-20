/**
 * Rule Execution Service
 * Feature: platform-enhancements
 * 
 * Provides rule execution engine and comprehensive logging capabilities.
 * Validates: Requirements 5.4, 5.5
 */

import {
  Rule,
  RuleExecution,
  RuleConditionResult,
  RuleActionResult,
  Member,
  Event,
  Project,
  Transaction
} from '../types';
import { errorLoggingService } from './errorLoggingService';
import { isDevMode } from '../utils/devMode';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';

export type ActionResult = { ok: true; data?: Record<string, unknown> } | { ok: false; reason: string };

export interface RuleTestData {
  member?: Partial<Member>;
  event?: Partial<Event>;
  project?: Partial<Project>;
  transaction?: Partial<Transaction>;
  [key: string]: any;
}

export interface RuleExecutionContext {
  userId: string;
  timestamp: string;
  testMode?: boolean;
  testData?: RuleTestData;
}

class RuleExecutionService {
  private executionHistory: RuleExecution[] = [];

  /**
   * Execute a rule with given context and data
   */
  async executeRule(
    rule: Rule, 
    context: RuleExecutionContext, 
    triggerData: Record<string, any> = {}
  ): Promise<RuleExecution> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    const execution: RuleExecution = {
      id: executionId,
      ruleId: rule.id,
      status: 'success',
      executedAt: context.timestamp,
      triggeredBy: context.userId,
      triggerData: context.testMode ? (context.testData || {}) : triggerData,
      conditionsEvaluated: [],
      actionsExecuted: [],
      duration: 0,
    };

    try {
      // Evaluate conditions
      const conditionResults = await this.evaluateConditions(
        rule.conditions, 
        rule.logicalOperator, 
        execution.triggerData
      );
      execution.conditionsEvaluated = conditionResults;

      // Check if conditions are met
      const conditionsMet = this.checkConditionsResult(conditionResults, rule.logicalOperator);

      if (conditionsMet) {
        // Execute actions
        const actionResults = await this.executeActions(
          rule.actions, 
          execution.triggerData,
          context.testMode || false
        );
        execution.actionsExecuted = actionResults;

        // Check if any actions failed
        const hasFailedActions = actionResults.some(result => result.status === 'failed');
        if (hasFailedActions) {
          execution.status = 'partial';
        }
      } else {
        // Conditions not met, skip actions
        execution.actionsExecuted = rule.actions.map(action => ({
          actionId: action.id,
          status: 'skipped' as const,
          duration: 0,
        }));
      }

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), {
        action: 'ruleExecutionService.executeRule',
        additionalData: { ruleId: rule.id },
      });
    }

    execution.duration = Date.now() - startTime;

    // Log execution (skip in test mode for performance)
    if (!context.testMode) {
      this.logExecution(execution);
    }

    return execution;
  }

  /**
   * Evaluate rule conditions
   */
  private async evaluateConditions(
    conditions: Rule['conditions'],
    logicalOperator: 'AND' | 'OR',
    data: Record<string, any>
  ): Promise<RuleConditionResult[]> {
    const results: RuleConditionResult[] = [];

    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, data);
      results.push(result);

      // Short-circuit evaluation for performance
      if (logicalOperator === 'AND' && !result.result) {
        // If AND and this condition failed, no need to evaluate remaining
        break;
      } else if (logicalOperator === 'OR' && result.result) {
        // If OR and this condition passed, no need to evaluate remaining
        break;
      }
    }

    return results;
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(
    condition: Rule['conditions'][0],
    data: Record<string, any>
  ): Promise<RuleConditionResult> {
    const actualValue = this.getFieldValue(condition.field, data);
    const expectedValue = condition.value;

    let result = false;

    try {
      switch (condition.operator) {
        case 'equals':
          result = actualValue === expectedValue;
          break;
        case 'not_equals':
          result = actualValue !== expectedValue;
          break;
        case 'greater_than':
          result = Number(actualValue) > Number(expectedValue);
          break;
        case 'less_than':
          result = Number(actualValue) < Number(expectedValue);
          break;
        case 'greater_equal':
          result = Number(actualValue) >= Number(expectedValue);
          break;
        case 'less_equal':
          result = Number(actualValue) <= Number(expectedValue);
          break;
        case 'contains':
          if (Array.isArray(actualValue)) {
            result = actualValue.includes(expectedValue);
          } else if (typeof actualValue === 'string') {
            result = actualValue.includes(String(expectedValue));
          }
          break;
        case 'not_contains':
          if (Array.isArray(actualValue)) {
            result = !actualValue.includes(expectedValue);
          } else if (typeof actualValue === 'string') {
            result = !actualValue.includes(String(expectedValue));
          }
          break;
        case 'starts_with':
          result = String(actualValue).startsWith(String(expectedValue));
          break;
        case 'ends_with':
          result = String(actualValue).endsWith(String(expectedValue));
          break;
        case 'exists':
          result = actualValue !== undefined && actualValue !== null;
          break;
        case 'not_exists':
          result = actualValue === undefined || actualValue === null;
          break;
        case 'in':
          if (Array.isArray(expectedValue)) {
            result = expectedValue.includes(actualValue);
          }
          break;
        case 'not_in':
          if (Array.isArray(expectedValue)) {
            result = !expectedValue.includes(actualValue);
          }
          break;
        default:
          throw new Error(`Unknown operator: ${condition.operator}`);
      }
    } catch (error) {
      result = false;
    }

    return {
      conditionId: condition.id,
      result,
      actualValue,
      expectedValue,
      operator: condition.operator,
    };
  }

  /**
   * Execute rule actions
   */
  private async executeActions(
    actions: Rule['actions'],
    data: Record<string, any>,
    testMode: boolean = false
  ): Promise<RuleActionResult[]> {
    const results: RuleActionResult[] = [];

    // Sort actions by order
    const sortedActions = [...actions].sort((a, b) => a.order - b.order);

    for (const action of sortedActions) {
      if (!action.enabled) {
        results.push({
          actionId: action.id,
          status: 'skipped',
          duration: 0,
        });
        continue;
      }

      const startTime = Date.now();
      try {
        const result = await this.executeAction(action, data, testMode);
        if (!result.ok) {
          const failReason = 'reason' in result ? (result as { ok: false; reason: string }).reason : 'Action failed';
          errorLoggingService.logError(new Error(failReason), {
            action: 'ruleExecutionService.executeActions',
            additionalData: { actionId: action.id, actionType: action.type },
          });
          results.push({
            actionId: action.id,
            status: 'failed',
            error: failReason,
            duration: Date.now() - startTime,
          });
        } else {
          results.push({
            actionId: action.id,
            status: 'success',
            result,
            duration: Date.now() - startTime,
          });
        }
      } catch (error) {
        results.push({
          actionId: action.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: Rule['actions'][0],
    data: Record<string, any>,
    testMode: boolean = false
  ): Promise<ActionResult> {
    if (testMode) {
      return this.simulateAction(action, data);
    }

    switch (action.type) {
      case 'send_email':
        return this.sendEmail(action.config, data);
      case 'send_notification':
        return this.sendNotification(action.config, data);
      case 'update_field':
        return this.updateField(action.config, data);
      case 'create_task':
        return this.createTask(action.config, data);
      case 'award_points':
        return this.awardPoints(action.config, data);
      case 'award_badge':
        return this.awardBadge(action.config, data);
      case 'trigger_workflow':
        return this.triggerWorkflow(action.config, data);
      case 'webhook':
        return this.callWebhook(action.config, data);
      case 'log_event':
        return this.logEvent(action.config, data);
      default:
        return { ok: false, reason: `Unknown action type: ${action.type}` };
    }
  }

  /**
   * Simulate action execution for testing
   */
  private simulateAction(
    action: Rule['actions'][0],
    _data: Record<string, any>
  ): ActionResult {
    return { ok: true, data: { simulated: true, actionType: action.type } };
  }

  /**
   * Check if conditions are met based on logical operator
   */
  private checkConditionsResult(
    results: RuleConditionResult[],
    logicalOperator: 'AND' | 'OR'
  ): boolean {
    if (results.length === 0) return false;

    if (logicalOperator === 'AND') {
      return results.every(result => result.result);
    } else {
      return results.some(result => result.result);
    }
  }

  /**
   * Get field value from data using dot notation
   */
  private getFieldValue(fieldPath: string, data: Record<string, any>): any {
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

  /**
   * Log rule execution — in-memory cache + async Firestore write.
   * P1 fix: persist to workflow_executions so logs survive page reloads.
   */
  private logExecution(execution: RuleExecution): void {
    this.executionHistory.push(execution);

    // Keep only last 1000 executions to prevent memory issues
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-1000);
    }

    // P1 fix: persist to Firestore (best-effort — never block the rule execution flow)
    // NOTE: This collection requires an authenticated-user create rule in firestore.rules. See: workflow_executions allow create: if isAuthenticated();
    if (!isDevMode()) {
      addDoc(collection(db, COLLECTIONS.WORKFLOW_EXECUTIONS), {
        ...execution,
        workflowId: execution.ruleId,
        createdAt: Timestamp.now(),
      }).catch(err => {
        errorLoggingService.logError(err instanceof Error ? err : new Error(String(err)), { component: 'RuleExecutionService', action: 'logExecution', additionalData: { ruleId: execution.ruleId } });
        console.warn('[RuleExecutionService] Failed to persist execution log to Firestore:', err);
      });
    } else {
      console.log('Rule execution logged:', {
        ruleId: execution.ruleId,
        status: execution.status,
        duration: execution.duration,
        conditionsCount: execution.conditionsEvaluated.length,
        actionsCount: execution.actionsExecuted.length,
      });
    }
  }

  /**
   * Get execution history for a rule
   */
  getExecutionHistory(ruleId?: string, limit: number = 50): RuleExecution[] {
    let history = [...this.executionHistory];
    
    if (ruleId) {
      history = history.filter(exec => exec.ruleId === ruleId);
    }

    return history
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(ruleId?: string): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    partialExecutions: number;
    averageDuration: number;
  } {
    let executions = this.executionHistory;
    
    if (ruleId) {
      executions = executions.filter(exec => exec.ruleId === ruleId);
    }

    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(exec => exec.status === 'success').length;
    const failedExecutions = executions.filter(exec => exec.status === 'failed').length;
    const partialExecutions = executions.filter(exec => exec.status === 'partial').length;
    const averageDuration = totalExecutions > 0 
      ? executions.reduce((sum, exec) => sum + exec.duration, 0) / totalExecutions 
      : 0;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      partialExecutions,
      averageDuration,
    };
  }

  // Action implementation methods
  private async sendEmail(_config: any, _data: any): Promise<ActionResult> {
    // P1 fix: was returning hard-coded ok:true (stub). Now returns a visible failure so
    // automation dashboards can detect that email delivery is not yet wired up.
    console.warn('[AutomationService] Stub action type: send_email — configure or implement before enabling automation rules that use this type.');
    return { ok: false, reason: 'send_email action not yet wired to email provider' };
  }

  private async sendNotification(config: any, data: any): Promise<ActionResult> {
    const memberId: string | undefined = config.memberId || data.member?.id;
    if (!memberId) {
      return { ok: false, reason: 'sendNotification: no memberId in config or data' };
    }

    if (isDevMode()) {
      return { ok: true, data: { notificationId: `notif_dev_${Date.now()}`, delivered: true } };
    }

    try {
      const { CommunicationService } = await import('./communicationService');
      const notificationId = await CommunicationService.createNotification({
        memberId,
        title: config.title || 'Notification',
        message: config.message || config.body || '',
        type: config.type || 'info',
      });
      return { ok: true, data: { notificationId, delivered: true } };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errorLoggingService.logError(err, {
        action: 'ruleExecutionService.sendNotification',
        additionalData: { memberId, config },
      });
      return { ok: false, reason: err.message };
    }
  }

  private async updateField(_config: any, _data: any): Promise<ActionResult> {
    console.warn('[AutomationService] Stub action type: update_field — configure or implement before enabling automation rules that use this type.');
    return { ok: false, reason: 'update_field action not yet implemented' };
  }

  private async createTask(_config: any, _data: any): Promise<ActionResult> {
    console.warn('[AutomationService] Stub action type: create_task — configure or implement before enabling automation rules that use this type.');
    return { ok: false, reason: 'create_task action not yet implemented' };
  }

  private async awardPoints(config: any, data: any): Promise<ActionResult> {
    const memberId: string | undefined = config.memberId || data.member?.id;
    const points: number | undefined = config.points;
    if (!memberId || !points) {
      return { ok: false, reason: `award_points requires memberId and points; got memberId=${memberId}, points=${points}` };
    }
    if (isDevMode()) {
      return { ok: true, data: { pointsAwarded: points, memberId } };
    }
    try {
      const { PointsService } = await import('./pointsService');
      const txId = await PointsService.awardPoints(
        memberId,
        config.category || 'automation',
        points,
        config.description || 'Awarded by automation rule',
        config.relatedEntityId,
        config.relatedEntityType
      );
      return { ok: true, data: { pointsAwarded: points, memberId, txId } };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errorLoggingService.logError(err, {
        action: 'ruleExecutionService.awardPoints',
        additionalData: { memberId, points, config },
      });
      return { ok: false, reason: err.message };
    }
  }

  private async awardBadge(config: any, data: any): Promise<ActionResult> {
    const badgeId: string | undefined = config.badgeId;
    const memberId: string | undefined = config.memberId || data.member?.id;

    if (!badgeId || !memberId) {
      return {
        ok: false,
        reason: `award_badge requires badgeId and memberId; got badgeId=${badgeId}, memberId=${memberId}`,
      };
    }
    try {
      const { GamificationService } = await import('./gamificationService');
      const awardRecordId = await GamificationService.awardAward(
        badgeId,
        memberId,
        'system',
        config.reason
      );
      return { ok: true, data: { badgeId, memberId, awardRecordId } };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errorLoggingService.logError(err, {
        action: 'ruleExecutionService.awardBadge',
        additionalData: { badgeId, memberId, config },
      });
      return { ok: false, reason: err.message };
    }
  }

  private async triggerWorkflow(_config: any, _data: any): Promise<ActionResult> {
    console.warn('[AutomationService] Stub action type: trigger_workflow — configure or implement before enabling automation rules that use this type.');
    return { ok: false, reason: 'trigger_workflow action not yet implemented' };
  }

  private async callWebhook(_config: any, _data: any): Promise<ActionResult> {
    console.warn('[AutomationService] Stub action type: call_webhook — configure or implement before enabling automation rules that use this type.');
    return { ok: false, reason: 'call_webhook action not yet implemented' };
  }

  private async logEvent(_config: any, _data: any): Promise<ActionResult> {
    console.warn('[AutomationService] Stub action type: log_event — configure or implement before enabling automation rules that use this type.');
    return { ok: false, reason: 'log_event action not yet implemented' };
  }
}

export const ruleExecutionService = new RuleExecutionService();