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
        results.push({
          actionId: action.id,
          status: 'success',
          result,
          duration: Date.now() - startTime,
        });
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
  ): Promise<any> {
    if (testMode) {
      // In test mode, simulate action execution
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
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Simulate action execution for testing
   */
  private simulateAction(
    action: Rule['actions'][0],
    data: Record<string, any>
  ): any {
    const simulatedResults = {
      send_email: { messageId: 'test_email_123', sent: true },
      send_notification: { notificationId: 'test_notif_123', delivered: true },
      update_field: { updated: true, fieldPath: action.config.field },
      create_task: { taskId: 'test_task_123', created: true },
      award_points: { pointsAwarded: action.config.points || 10, memberId: data.member?.id },
      award_badge: { badgeId: action.config.badgeId, awarded: true },
      trigger_workflow: { workflowId: action.config.workflowId, triggered: true },
      webhook: { status: 200, response: 'OK' },
      log_event: { eventId: 'test_log_123', logged: true },
    };

    return simulatedResults[action.type] || { simulated: true };
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
   * Log rule execution
   */
  private logExecution(execution: RuleExecution): void {
    this.executionHistory.push(execution);
    
    // Keep only last 1000 executions to prevent memory issues
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-1000);
    }

    // In a real implementation, this would save to database
    console.log('Rule execution logged:', {
      ruleId: execution.ruleId,
      status: execution.status,
      duration: execution.duration,
      conditionsCount: execution.conditionsEvaluated.length,
      actionsCount: execution.actionsExecuted.length,
    });
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

  // Action implementation methods (simplified for demo)
  private async sendEmail(config: any, data: any): Promise<any> {
    // Implementation would integrate with email service
    return { messageId: `email_${Date.now()}`, sent: true };
  }

  private async sendNotification(config: any, data: any): Promise<any> {
    // Implementation would integrate with notification service
    return { notificationId: `notif_${Date.now()}`, delivered: true };
  }

  private async updateField(config: any, data: any): Promise<any> {
    // Implementation would update database field
    return { updated: true, fieldPath: config.field };
  }

  private async createTask(config: any, data: any): Promise<any> {
    // Implementation would create task in project management system
    return { taskId: `task_${Date.now()}`, created: true };
  }

  private async awardPoints(config: any, data: any): Promise<any> {
    // Implementation would update member points
    return { pointsAwarded: config.points, memberId: data.member?.id };
  }

  private async awardBadge(config: any, data: any): Promise<any> {
    // Implementation would award badge to member
    return { badgeId: config.badgeId, awarded: true };
  }

  private async triggerWorkflow(config: any, data: any): Promise<any> {
    // Implementation would trigger another workflow
    return { workflowId: config.workflowId, triggered: true };
  }

  private async callWebhook(config: any, data: any): Promise<any> {
    // Implementation would make HTTP request
    return { status: 200, response: 'OK' };
  }

  private async logEvent(config: any, data: any): Promise<any> {
    // Implementation would log custom event
    return { eventId: `log_${Date.now()}`, logged: true };
  }
}

export const ruleExecutionService = new RuleExecutionService();