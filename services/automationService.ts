// Automation & Workflow Service
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  increment,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { COLLECTIONS, POINT_CATEGORIES } from '../config/constants';
import { AutomationRule, WorkflowExecution, WorkflowExecutionStep } from '../types';
import { withDevMode } from '../utils/devMode';
import { MOCK_AUTOMATION_RULES } from './mockData';
import { PointsService } from './pointsService';
import { CommunicationService } from './communicationService';
import { errorLoggingService } from './errorLoggingService';

export interface Workflow {
  id?: string;
  name: string;
  description?: string;
  trigger: {
    type: 'event' | 'schedule' | 'condition' | 'webhook';
    config: Record<string, any>;
  };
  steps: WorkflowStep[];
  active: boolean;
  executions: number;
  lastExecuted?: Date | Timestamp;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface WorkflowStep {
  id: string;
  type: 'send_email' | 'update_data' | 'award_points' | 'create_notification' | 'call_webhook' | 'conditional';
  config: Record<string, any>;
  order: number;
  conditions?: Record<string, any>;
}

export interface WorkflowCondition {
  field: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains';
  value: unknown;
}

export class AutomationService {
  // Get all workflows
  static async getAllWorkflows(): Promise<Workflow[]> {
    return withDevMode<Workflow[]>(
      () => MOCK_AUTOMATION_RULES.map((rule, index) => ({
        id: `wf${index + 1}`,
        name: rule.name,
        description: `Automated workflow: ${rule.trigger} → ${rule.action}`,
        trigger: {
          type: 'event' as const,
          config: { event: rule.trigger },
        },
        steps: [
          {
            id: `step1`,
            type: 'create_notification' as const,
            config: { message: rule.action },
            order: 1,
          },
        ],
        active: rule.active,
        executions: rule.executions,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      async () => {
        try {
          const snapshot = await getDocs(
            query(collection(db, COLLECTIONS.WORKFLOWS), orderBy('createdAt', 'desc'))
          );
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
            lastExecuted: doc.data().lastExecuted?.toDate(),
          } as Workflow));
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.getAllWorkflows' });
          throw error;
        }
      }
    );
  }

  // Get workflow by ID
  static async getWorkflowById(workflowId: string): Promise<Workflow | null> {
    return withDevMode(
      async () => {
        const mockWorkflows = await this.getAllWorkflows();
        return mockWorkflows.find(w => w.id === workflowId) || null;
      },
      async () => {
        try {
          const docRef = doc(db, COLLECTIONS.WORKFLOWS, workflowId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
              lastExecuted: data.lastExecuted?.toDate(),
            } as Workflow;
          }
          return null;
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.getWorkflow' });
          throw error;
        }
      }
    );
  }

  // Create workflow
  static async createWorkflow(workflowData: Omit<Workflow, 'id' | 'executions' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return withDevMode(
      () => {
        const newId = `mock-workflow-${Date.now()}`;
        if (process.env.NODE_ENV === 'development') {
          console.log(`[DEV MODE] Simulating creation of workflow with ID: ${newId}`);
        }
        return newId;
      },
      async () => {
        try {
          // Filter out undefined values
          const newWorkflow: any = {
            name: workflowData.name,
            trigger: workflowData.trigger,
            steps: workflowData.steps,
            active: workflowData.active ?? true,
            executions: 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          if (workflowData.description !== undefined) newWorkflow.description = workflowData.description;

          const docRef = await addDoc(collection(db, COLLECTIONS.WORKFLOWS), newWorkflow);
          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.createWorkflow' });
          throw error;
        }
      }
    );
  }

  // Update workflow
  static async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const workflowRef = doc(db, COLLECTIONS.WORKFLOWS, workflowId);
          await updateDoc(workflowRef, {
            ...updates,
            updatedAt: Timestamp.now(),
          });
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.updateWorkflow' });
          throw error;
        }
      }
    );
  }

  // Delete workflow
  static async deleteWorkflow(workflowId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          await deleteDoc(doc(db, COLLECTIONS.WORKFLOWS, workflowId));
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.deleteWorkflow' });
          throw error;
        }
      }
    );
  }

  // Execute workflow
  static async executeWorkflow(
    workflowId: string,
    context: Record<string, any>,
    triggeredBy: 'manual' | 'event' | 'schedule' | 'webhook' | 'condition' = 'manual'
  ): Promise<WorkflowExecution> {
    const executionStartTime = Date.now();
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return withDevMode<WorkflowExecution>(
      () => {
        const mockSteps: WorkflowExecutionStep[] = [
          {
            stepId: 'step1',
            stepType: 'create_notification',
            stepOrder: 1,
            status: 'success',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            duration: 45,
            output: { message: 'Automation triggered successfully' }
          },
          {
            stepId: 'step2',
            stepType: 'send_email',
            stepOrder: 2,
            status: 'success',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            duration: 120,
            output: { recipient: 'member@example.com', subject: 'Workflow Notification' }
          }
        ];
        return {
          id: executionId,
          workflowId,
          workflowName: 'Mock Dev Workflow',
          status: 'success' as const,
          startedAt: new Date(executionStartTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration: Date.now() - executionStartTime,
          triggeredBy,
          executedSteps: mockSteps,
          nodeExecutions: [],
        };
      },
      async () => {
        try {
          const workflow = await this.getWorkflowById(workflowId);
      if (!workflow || !workflow.active) {
        throw new Error('Workflow not found or inactive');
      }

      // ── Fix P1: Build idempotency key to match workflowService schema ────────
      const triggerId: string =
        context.triggerId ?? context.entityId ?? triggeredBy ?? 'manual';
      // P1 — exclude timestamp so the same trigger never spawns a second execution
      const idempotencyKey = `${workflowId}_${triggerId}`;

      // ── Fix P1: Recover stuck executions (running > 30 min) ─────────────────
      const thirtyMinutesAgo = Timestamp.fromMillis(Date.now() - 30 * 60 * 1000);
      const stuckQuery = query(
        collection(db, COLLECTIONS.WORKFLOW_EXECUTIONS),
        where('workflowId', '==', workflowId),
        where('status', '==', 'running'),
        where('startedAt', '<', thirtyMinutesAgo),
        limit(20)
      );
      const stuckSnap = await getDocs(stuckQuery);
      if (!stuckSnap.empty) {
        const batch = writeBatch(db);
        stuckSnap.docs.forEach(stuckDoc => {
          batch.update(stuckDoc.ref, {
            status: 'timeout',
            completedAt: serverTimestamp(),
            error: { message: 'Execution timed out after 30 minutes' },
          });
        });
        await batch.commit();
      }
      // ─────────────────────────────────────────────────────────────────────────

      // Create execution record — includes idempotencyKey to match workflowService schema
      const execution: Omit<WorkflowExecution, 'id'> = {
        workflowId,
        workflowName: workflow.name,
        status: 'running',
        startedAt: new Date().toISOString(),
        triggeredBy,
        executedSteps: [],
        nodeExecutions: [],
        context,
      };

      const executionRef = await addDoc(
        collection(db, COLLECTIONS.WORKFLOW_EXECUTIONS),
        {
          ...execution,
          startedAt: serverTimestamp(),
          idempotencyKey,
        }
      );

      const executedSteps: WorkflowExecutionStep[] = [];
      let executionError: WorkflowExecution['error'] | undefined;

      try {
        // Execute steps in order
        for (const step of workflow.steps.sort((a, b) => a.order - b.order)) {
          const stepStartTime = Date.now();
          const stepExecution: WorkflowExecutionStep = {
            stepId: step.id,
            stepType: step.type,
            stepOrder: step.order,
            status: 'success',
            startedAt: new Date().toISOString(),
          };

          try {
            const stepResult = await this.executeStep(step, { ...context, executionId, workflowId });
            // P1 — propagate conditionResult back to outer context so subsequent steps can read it
            if (step.type === 'conditional' && stepResult && stepResult.conditionResult !== undefined) {
              context._conditionResult = stepResult.conditionResult;
            }
            stepExecution.completedAt = new Date().toISOString();
            stepExecution.duration = Date.now() - stepStartTime;
            executedSteps.push(stepExecution);
          } catch (stepError) {
            const errorMessage = stepError instanceof Error ? stepError.message : 'Unknown error';
            stepExecution.status = 'failed';
            stepExecution.completedAt = new Date().toISOString();
            stepExecution.duration = Date.now() - stepStartTime;
            stepExecution.error = errorMessage;
            executedSteps.push(stepExecution);

            executionError = {
              message: errorMessage,
              stepId: step.id,
              stepType: step.type,
              stack: stepError instanceof Error ? stepError.stack : undefined,
            };
            break; // Stop execution on error
          }
        }

        // Update execution record with results
        const executionDuration = Date.now() - executionStartTime;
        await updateDoc(executionRef, {
          status: executionError ? 'failed' : 'success',
          completedAt: Timestamp.now(),
          duration: executionDuration,
          executedSteps,
          ...(executionError && { error: executionError }),
        });

        // Update workflow execution count — P1: use increment() to avoid race
        await updateDoc(doc(db, COLLECTIONS.WORKFLOWS, workflowId), {
          executions: increment(1),
          lastExecuted: Timestamp.now(),
        });

        return {
          id: executionRef.id,
          ...execution,
          status: executionError ? 'failed' : 'success',
          completedAt: new Date().toISOString(),
          duration: executionDuration,
          executedSteps,
          error: executionError,
        };
      } catch (error) {
        // Update execution record with error
        const executionDuration = Date.now() - executionStartTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await updateDoc(executionRef, {
          status: 'failed',
          completedAt: Timestamp.now(),
          duration: executionDuration,
          executedSteps,
          error: {
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });

        throw error;
      }
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.executeWorkflow' });
          throw error;
        }
      }
    );
  }

  // Execute a single workflow step
  private static async executeStep(step: WorkflowStep, context: Record<string, any>): Promise<{ conditionResult?: boolean } | void> {
    switch (step.type) {
      case 'send_email':
        try {
          // Import EmailService dynamically to avoid circular dependencies
          const { EmailService } = await import('./emailService');
          const { MembersService } = await import('./membersService');

          // Get recipient email
          let recipientEmail: string | string[] = step.config.recipientEmail || step.config.to;

          // If recipientId is provided, get member email
          if (step.config.recipientId && !recipientEmail) {
            const member = await MembersService.getMemberById(step.config.recipientId);
            if (member?.email) {
              recipientEmail = member.email;
            } else {
              throw new Error(`Member ${step.config.recipientId} not found or has no email`);
            }
          }

          // If multiple recipientIds, get all emails
          if (step.config.recipientIds && Array.isArray(step.config.recipientIds)) {
            const members = await Promise.all(
              step.config.recipientIds.map(id => MembersService.getMemberById(id))
            );
            recipientEmail = members
              .filter(m => m?.email)
              .flatMap(m => m?.email ? [m.email] : []);
          }

          if (!recipientEmail) {
            throw new Error('No recipient email specified');
          }

          // Send email
          await EmailService.sendEmail({
            to: recipientEmail,
            subject: step.config.subject || context.subject || 'Notification',
            html: step.config.html || step.config.body || step.config.message || '',
            text: step.config.text,
            cc: step.config.cc,
            bcc: step.config.bcc,
            replyTo: step.config.replyTo,
            tags: step.config.tags || ['automation', 'workflow'],
            metadata: {
              workflowId: context.workflowId,
              stepId: step.id,
              ...context,
            },
          });

          if (process.env.NODE_ENV === 'development') {
            console.log(`Email sent successfully to ${Array.isArray(recipientEmail) ? recipientEmail.join(', ') : recipientEmail}`);
          }
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.executeStep.send_email' });
          // Fallback to notification if email fails
          if (step.config.recipientId) {
            await CommunicationService.createNotification({
              memberId: step.config.recipientId,
              title: step.config.subject || 'Notification',
              message: step.config.body || step.config.message || '',
              type: 'info',
            });
          }
          // Don't throw - allow workflow to continue even if email fails
        }
        break;

      case 'update_data':
        // Generic data update - would need to know the collection and document
        if (process.env.NODE_ENV === 'development') {
          console.log('Data update step:', step.config, context);
        }
        // This would require more context about what data to update
        // Could be implemented based on step.config.collection, step.config.docId, etc.
        break;

      case 'award_points':
        // Integrate with PointsService
        try {
          const memberId = step.config.memberId || context.memberId;
          const category = step.config.category || POINT_CATEGORIES.MEDIA_CONTRIBUTION;
          const amount = step.config.amount || step.config.points || 10;
          const description = step.config.description || context.description || 'Automated points award';
          const relatedEntityId = step.config.relatedEntityId || context.entityId;
          const relatedEntityType = step.config.relatedEntityType || context.entityType;

          if (memberId) {
            await PointsService.awardPoints(
              memberId,
              category,
              amount,
              description,
              relatedEntityId,
              relatedEntityType
            );
            if (process.env.NODE_ENV === 'development') {
              console.log(`Awarded ${amount} points to member ${memberId}`);
            }
          } else {
            errorLoggingService.logWarning('No memberId provided for award_points step', { action: 'AutomationService.executeStep' });
          }
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.executeStep.award_points' });
          throw error;
        }
        break;

      case 'create_notification':
        // Create notification using CommunicationService
        try {
          const memberId = step.config.memberId || context.memberId;
          const title = step.config.title || 'Notification';
          const message = step.config.message || step.config.body || '';
          const type = step.config.type || 'info';

          if (memberId) {
            await CommunicationService.createNotification({
              memberId,
              title,
              message,
              type: type as 'info' | 'success' | 'warning' | 'error',
            });
            if (process.env.NODE_ENV === 'development') {
              console.log(`Created notification for member ${memberId}`);
            }
          } else {
            errorLoggingService.logWarning('No memberId provided for create_notification step', { action: 'AutomationService.executeStep' });
          }
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.executeStep.create_notification' });
          throw error;
        }
        break;

      case 'call_webhook':
        // Call external webhook
        try {
          const url = step.config.url || step.config.webhookUrl;
          const method = step.config.method || 'POST';
          const headers = step.config.headers || { 'Content-Type': 'application/json' };
          const body = step.config.body || context;

          if (url) {
            const response = await fetch(url, {
              method,
              headers,
              body: JSON.stringify(body),
            });

            if (!response.ok) {
              throw new Error(`Webhook call failed: ${response.statusText}`);
            }

            if (process.env.NODE_ENV === 'development') {
              console.log(`Webhook called successfully: ${url}`);
            }
          } else {
            errorLoggingService.logWarning('No URL provided for call_webhook step', { action: 'AutomationService.executeStep' });
          }
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.executeStep.call_webhook' });
          // Don't throw - webhook failures shouldn't stop the workflow
        }
        break;

      case 'conditional': {
        // Conditional logic - evaluate condition and potentially skip steps
        const condition = step.config.condition as WorkflowCondition | null | undefined;
        const conditionMet = this.evaluateCondition(condition, context);
        if (process.env.NODE_ENV === 'development') {
          console.log(`Condition evaluated: ${conditionMet}`, condition);
        }
        // P1 — return result so the caller can persist it on the outer context
        return { conditionResult: conditionMet };
      }

      default:
        errorLoggingService.logWarning(`Unknown step type: ${step.type}`, { action: 'AutomationService.executeStep' });
    }
  }

  // Helper method to evaluate conditions
  private static evaluateCondition(condition: WorkflowCondition | null | undefined, context: Record<string, unknown>): boolean {
    if (!condition) return true;

    // Simple condition evaluation
    // Supports: { field: 'member.role', operator: '==', value: 'President' }
    if (condition.field && condition.operator && condition.value !== undefined) {
      const fieldValue = this.getNestedValue(context, condition.field);

      switch (condition.operator) {
        case '==':
          return fieldValue === condition.value;
        case '!=':
          return fieldValue !== condition.value;
        case '>':
          return (fieldValue as number) > (condition.value as number);
        case '<':
          return (fieldValue as number) < (condition.value as number);
        case '>=':
          return (fieldValue as number) >= (condition.value as number);
        case '<=':
          return (fieldValue as number) <= (condition.value as number);
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        default:
          return false;
      }
    }

    return true;
  }

  // Helper method to get nested object values
  private static getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, prop) => (current as Record<string, unknown>)?.[prop], obj);
  }

  // Get automation rules
  static async getAllRules(): Promise<AutomationRule[]> {
    return withDevMode(
      () => MOCK_AUTOMATION_RULES,
      async () => {
        try {
          const snapshot = await getDocs(
            query(collection(db, COLLECTIONS.AUTOMATION_RULES), orderBy('name'))
          );
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          } as AutomationRule));
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.getAutomationRules' });
          throw error;
        }
      }
    );
  }

  // Create automation rule
  static async createRule(ruleData: Omit<AutomationRule, 'id' | 'executions'>): Promise<string> {
    return withDevMode(
      () => { if (process.env.NODE_ENV === 'development') { console.log('[Dev Mode] Mocking automation rule creation'); } return `mock-rule-${Date.now()}`; },
      async () => {
        try {
          const newRule = {
            ...ruleData,
            executions: 0,
          };

          const docRef = await addDoc(collection(db, COLLECTIONS.AUTOMATION_RULES), newRule);
          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.createAutomationRule' });
          throw error;
        }
      }
    );
  }

  // Update automation rule
  static async updateRule(ruleId: string, updates: Partial<AutomationRule>): Promise<void> {
    return withDevMode(
      () => { if (process.env.NODE_ENV === 'development') { console.log(`[DEV MODE] Simulating update of automation rule ${ruleId} with updates:`, updates); } },
      async () => {
        try {
          await updateDoc(doc(db, COLLECTIONS.AUTOMATION_RULES, ruleId), updates);
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.updateAutomationRule' });
          throw error;
        }
      }
    );
  }

  // Get execution logs for a workflow or all workflows
  static async getExecutionLogs(workflowId?: string, limitCount: number = 50): Promise<WorkflowExecution[]> {
    return withDevMode<WorkflowExecution[]>(
      () => [
        {
          id: 'exec1',
          workflowId: 'wf1',
          workflowName: 'New Member Onboarding',
          status: 'success' as const,
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          completedAt: new Date(Date.now() - 3590000).toISOString(),
          duration: 1000,
          triggeredBy: 'event' as const,
          context: {},
          nodeExecutions: [],
          executedSteps: [
            {
              stepId: 'step1',
              stepType: 'send_email',
              stepOrder: 1,
              status: 'success' as const,
              startedAt: new Date(Date.now() - 3600000).toISOString(),
              completedAt: new Date(Date.now() - 3595000).toISOString(),
              duration: 500,
            },
            {
              stepId: 'step2',
              stepType: 'award_points',
              stepOrder: 2,
              status: 'success' as const,
              startedAt: new Date(Date.now() - 3595000).toISOString(),
              completedAt: new Date(Date.now() - 3590000).toISOString(),
              duration: 500,
            },
          ],
        },
      ],
      async () => {
        try {
          let q = query(
            collection(db, COLLECTIONS.WORKFLOW_EXECUTIONS || 'workflowExecutions'),
            orderBy('startedAt', 'desc'),
            limit(limitCount)
          );

          if (workflowId) {
            q = query(
              collection(db, COLLECTIONS.WORKFLOW_EXECUTIONS || 'workflowExecutions'),
              where('workflowId', '==', workflowId),
              orderBy('startedAt', 'desc'),
              limit(limitCount)
            );
          }

          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            startedAt: doc.data().startedAt?.toDate?.()?.toISOString() || doc.data().startedAt,
            completedAt: doc.data().completedAt?.toDate?.()?.toISOString() || doc.data().completedAt,
          } as WorkflowExecution));
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.getExecutionLogs' });
          throw error;
        }
      }
    );
  }

  // Get execution by ID
  static async getExecutionById(executionId: string): Promise<WorkflowExecution | null> {
    return withDevMode(
      () => null,
      async () => {
        try {
          const docRef = doc(db, COLLECTIONS.WORKFLOW_EXECUTIONS || 'workflowExecutions', executionId);
          const docSnap = await getDoc(docRef);

          if (!docSnap.exists()) {
            return null;
          }

          return {
            id: docSnap.id,
            ...docSnap.data(),
            startedAt: docSnap.data().startedAt?.toDate?.()?.toISOString() || docSnap.data().startedAt,
            completedAt: docSnap.data().completedAt?.toDate?.()?.toISOString() || docSnap.data().completedAt,
          } as WorkflowExecution;
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AutomationService.getExecution' });
          throw error;
        }
      }
    );
  }
}

