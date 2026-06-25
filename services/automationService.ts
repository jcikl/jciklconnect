// Automation & Workflow Service
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
import { COLLECTIONS, POINT_CATEGORIES } from '../config/constants';
import { AutomationRule, WorkflowExecution, WorkflowExecutionStep } from '../types';
import { isDevMode } from '../utils/devMode';
import { MOCK_AUTOMATION_RULES } from './mockData';
import { PointsService } from './pointsService';
import { CommunicationService } from './communicationService';

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

export class AutomationService {
  // Get all workflows
  static async getAllWorkflows(): Promise<Workflow[]> {
    if (isDevMode()) {
      // Return mock workflows based on automation rules
      return MOCK_AUTOMATION_RULES.map((rule, index) => ({
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
      }));
    }

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
      console.error('Error fetching workflows:', error);
      throw error;
    }
  }

  // Get workflow by ID
  static async getWorkflowById(workflowId: string): Promise<Workflow | null> {
    if (isDevMode()) {
      const mockWorkflows = await this.getAllWorkflows();
      return mockWorkflows.find(w => w.id === workflowId) || null;
    }

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
      console.error('Error fetching workflow:', error);
      throw error;
    }
  }

  // Create workflow
  static async createWorkflow(workflowData: Omit<Workflow, 'id' | 'executions' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (isDevMode()) {
      const newId = `mock-workflow-${Date.now()}`;
      console.log(`[DEV MODE] Simulating creation of workflow with ID: ${newId}`);
      return newId;
    }

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
      console.error('Error creating workflow:', error);
      throw error;
    }
  }

  // Update workflow
  static async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<void> {
    if (isDevMode()) {
      // In dev mode, just return without doing anything
      return;
    }

    try {
      const workflowRef = doc(db, COLLECTIONS.WORKFLOWS, workflowId);
      await updateDoc(workflowRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating workflow:', error);
      throw error;
    }
  }

  // Delete workflow
  static async deleteWorkflow(workflowId: string): Promise<void> {
    if (isDevMode()) {
      // In dev mode, just return without doing anything
      return;
    }

    try {
      await deleteDoc(doc(db, COLLECTIONS.WORKFLOWS, workflowId));
    } catch (error) {
      console.error('Error deleting workflow:', error);
      throw error;
    }
  }

  // Execute workflow
  static async executeWorkflow(
    workflowId: string,
    context: Record<string, any>,
    triggeredBy: 'manual' | 'event' | 'schedule' | 'webhook' | 'condition' = 'manual'
  ): Promise<WorkflowExecution> {
    const executionStartTime = Date.now();
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (isDevMode()) {
      // In dev mode, return mock execution
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
        status: 'success',
        startedAt: new Date(executionStartTime).toISOString(),
        completedAt: new Date().toISOString(),
        duration: Date.now() - executionStartTime,
        triggeredBy,
        executedSteps: mockSteps,
        nodeExecutions: [],
      };
    }

    try {
      const workflow = await this.getWorkflowById(workflowId);
      if (!workflow || !workflow.active) {
        throw new Error('Workflow not found or inactive');
      }

      // Create execution record
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
          startedAt: Timestamp.now(),
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
            await this.executeStep(step, { ...context, executionId, workflowId });
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

        // Update workflow execution count
        await updateDoc(doc(db, COLLECTIONS.WORKFLOWS, workflowId), {
          executions: workflow.executions + 1,
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
      console.error('Error executing workflow:', error);
      throw error;
    }
  }

  // Execute a single workflow step
  private static async executeStep(step: WorkflowStep, context: Record<string, any>): Promise<void> {
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
              .map(m => m!.email);
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

          console.log(`Email sent successfully to ${Array.isArray(recipientEmail) ? recipientEmail.join(', ') : recipientEmail}`);
        } catch (error) {
          console.error('Error sending email in workflow:', error);
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
        console.log('Data update step:', step.config, context);
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
            console.log(`Awarded ${amount} points to member ${memberId}`);
          } else {
            console.warn('No memberId provided for award_points step');
          }
        } catch (error) {
          console.error('Error awarding points in workflow:', error);
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
            console.log(`Created notification for member ${memberId}`);
          } else {
            console.warn('No memberId provided for create_notification step');
          }
        } catch (error) {
          console.error('Error creating notification in workflow:', error);
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

            console.log(`Webhook called successfully: ${url}`);
          } else {
            console.warn('No URL provided for call_webhook step');
          }
        } catch (error) {
          console.error('Error calling webhook in workflow:', error);
          // Don't throw - webhook failures shouldn't stop the workflow
          console.warn('Continuing workflow despite webhook error');
        }
        break;

      case 'conditional':
        // Conditional logic - evaluate condition and potentially skip steps
        const condition = step.config.condition;
        const conditionMet = this.evaluateCondition(condition, context);
        console.log(`Condition evaluated: ${conditionMet}`, condition);
        // This would affect which steps execute next
        context._conditionResult = conditionMet;
        break;

      default:
        console.warn('Unknown step type:', step.type);
    }
  }

  // Helper method to evaluate conditions
  private static evaluateCondition(condition: any, context: Record<string, any>): boolean {
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
          return fieldValue > condition.value;
        case '<':
          return fieldValue < condition.value;
        case '>=':
          return fieldValue >= condition.value;
        case '<=':
          return fieldValue <= condition.value;
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        default:
          return false;
      }
    }

    return true;
  }

  // Helper method to get nested object values
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  // Get automation rules
  static async getAllRules(): Promise<AutomationRule[]> {
    if (isDevMode()) {
      return MOCK_AUTOMATION_RULES;
    }

    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.AUTOMATION_RULES), orderBy('name'))
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as AutomationRule));
    } catch (error) {
      console.error('Error fetching automation rules:', error);
      throw error;
    }
  }

  // Create automation rule
  static async createRule(ruleData: Omit<AutomationRule, 'id' | 'executions'>): Promise<string> {
    if (isDevMode()) {
      console.log('[Dev Mode] Mocking automation rule creation');
      return `mock-rule-${Date.now()}`;
    }

    try {
      const newRule = {
        ...ruleData,
        executions: 0,
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.AUTOMATION_RULES), newRule);
      return docRef.id;
    } catch (error) {
      console.error('Error creating automation rule:', error);
      throw error;
    }
  }

  // Update automation rule
  static async updateRule(ruleId: string, updates: Partial<AutomationRule>): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Simulating update of automation rule ${ruleId} with updates:`, updates);
      return;
    }

    try {
      await updateDoc(doc(db, COLLECTIONS.AUTOMATION_RULES, ruleId), updates);
    } catch (error) {
      console.error('Error updating automation rule:', error);
      throw error;
    }
  }

  // Get execution logs for a workflow or all workflows
  static async getExecutionLogs(workflowId?: string, limitCount: number = 50): Promise<WorkflowExecution[]> {
    if (isDevMode()) {
      // Return mock execution logs
      return [
        {
          id: 'exec1',
          workflowId: 'wf1',
          workflowName: 'New Member Onboarding',
          status: 'success',
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          completedAt: new Date(Date.now() - 3590000).toISOString(),
          duration: 1000,
          triggeredBy: 'event',

          context: {},
          nodeExecutions: [],
          executedSteps: [
            {
              stepId: 'step1',
              stepType: 'send_email',
              stepOrder: 1,
              status: 'success',
              startedAt: new Date(Date.now() - 3600000).toISOString(),
              completedAt: new Date(Date.now() - 3595000).toISOString(),
              duration: 500,
            },
            {
              stepId: 'step2',
              stepType: 'award_points',
              stepOrder: 2,
              status: 'success',
              startedAt: new Date(Date.now() - 3595000).toISOString(),
              completedAt: new Date(Date.now() - 3590000).toISOString(),
              duration: 500,
            },
          ],
        },
      ];
    }

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
      console.error('Error fetching execution logs:', error);
      throw error;
    }
  }

  // Get execution by ID
  static async getExecutionById(executionId: string): Promise<WorkflowExecution | null> {
    if (isDevMode()) {
      return null;
    }

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
      console.error('Error fetching execution:', error);
      throw error;
    }
  }
}

