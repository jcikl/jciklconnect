// Workflow Service — CRUD + execution for the `workflows` collection.
// Fixes applied:
//   P0-A  executeWorkflow idempotency guard (duplicate-trigger prevention)
//   P1-B  currentStepIndex written to Firestore after every step
//   P1-C  lastExecutedAt + executionCount updated with serverTimestamp / increment
//   P1-D  evaluateCondition: 'contains', 'startsWith', 'regex' operators implemented
//   P2-E  createWorkflow accepts optional status defaulting to 'active'

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
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { COLLECTIONS, POINT_CATEGORIES } from '../config/constants';
import {
  Workflow,
  WorkflowExecution,
  WorkflowExecutionStep,
} from '../types';
import { withDevMode, isDevMode } from '../utils/devMode';
import { MOCK_AUTOMATION_RULES } from './mockData';
import { PointsService } from './pointsService';
import { CommunicationService } from './communicationService';
import { errorLoggingService } from './errorLoggingService';
import { apiCache as cacheService } from './cacheService';

// ─── Local step-shape used inside this service ────────────────────────────────
export interface WorkflowStep {
  id: string;
  type:
    | 'send_email'
    | 'update_data'
    | 'award_points'
    | 'create_notification'
    | 'call_webhook'
    | 'conditional';
  config: Record<string, any>;
  order: number;
  conditions?: Record<string, any>;
}

// ─── Input type for createWorkflow ────────────────────────────────────────────
// Omits server-managed fields; status defaults to 'active'.
export type CreateWorkflowInput = Omit<
  Workflow,
  'id' | 'executionCount' | 'createdAt' | 'updatedAt' | 'version'
> & {
  status?: 'draft' | 'active' | 'paused' | 'archived';
};

// ─── Collection name helper ───────────────────────────────────────────────────
const WF_COL = () => COLLECTIONS.WORKFLOWS ?? 'workflows';
const EXEC_COL = () => COLLECTIONS.WORKFLOW_EXECUTIONS ?? 'workflow_executions';

export class WorkflowService {
  // ─── Get all workflows ───────────────────────────────────────────────────────
  static async getAllWorkflows(): Promise<Workflow[]> {
    return withDevMode<Workflow[]>(
      () =>
        MOCK_AUTOMATION_RULES.map((rule, index) => ({
          id: `wf${index + 1}`,
          name: rule.name,
          description: `Automated workflow: ${rule.trigger} → ${rule.action}`,
          nodes: [],
          connections: [],
          triggers: [{ id: 't1', type: 'event' as const, config: { event: rule.trigger }, enabled: rule.active }],
          status: rule.active ? ('active' as const) : ('paused' as const),
          version: 1,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          executionCount: rule.executions,
          tags: [],
        })),
      async () => {
        try {
          const snapshot = await getDocs(
            query(collection(db, WF_COL()), orderBy('createdAt', 'desc'))
          );
          return snapshot.docs.map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? d.data().createdAt,
            updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? d.data().updatedAt,
            lastExecuted: d.data().lastExecuted?.toDate?.()?.toISOString() ?? d.data().lastExecuted,
          } as Workflow));
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'WorkflowService.getAllWorkflows' });
          throw error;
        }
      }
    );
  }

  // ─── Get workflow by ID ──────────────────────────────────────────────────────
  static async getWorkflowById(workflowId: string): Promise<Workflow | null> {
    return withDevMode(
      async () => {
        const all = await this.getAllWorkflows();
        return all.find(w => w.id === workflowId) ?? null;
      },
      async () => {
        try {
          const snap = await getDoc(doc(db, WF_COL(), workflowId));
          if (!snap.exists()) return null;
          const data = snap.data();
          return {
            id: snap.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? data.updatedAt,
            lastExecuted: data.lastExecuted?.toDate?.()?.toISOString() ?? data.lastExecuted,
          } as Workflow;
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'WorkflowService.getWorkflowById', additionalData: { workflowId } });
          throw error;
        }
      }
    );
  }

  // ─── Create workflow ─────────────────────────────────────────────────────────
  // P2-E: accepts optional status, defaults to 'active'.
  static async createWorkflow(workflowData: CreateWorkflowInput): Promise<string> {
    return withDevMode(
      () => {
        const id = `mock-workflow-${Date.now()}`;
        console.log(`[DEV] Simulating createWorkflow → ${id}`);
        return id;
      },
      async () => {
        try {
          const payload: Record<string, any> = {
            name: workflowData.name,
            nodes: workflowData.nodes ?? [],
            connections: workflowData.connections ?? [],
            triggers: workflowData.triggers ?? [],
            // P2-E: default status to 'active' when not supplied
            status: workflowData.status ?? 'active',
            version: 1,
            createdBy: workflowData.createdBy ?? '',
            executionCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          if (workflowData.description !== undefined) payload.description = workflowData.description;
          if (workflowData.tags !== undefined) payload.tags = workflowData.tags;

          const ref = await addDoc(collection(db, WF_COL()), payload);
          return ref.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'WorkflowService.createWorkflow' });
          throw error;
        }
      }
    );
  }

  // ─── Update workflow ─────────────────────────────────────────────────────────
  static async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          await updateDoc(doc(db, WF_COL(), workflowId), {
            ...updates,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'WorkflowService.updateWorkflow', additionalData: { workflowId } });
          throw error;
        }
      }
    );
  }

  // ─── Delete workflow ─────────────────────────────────────────────────────────
  // P1: cascade-archives all workflow_executions for the deleted workflow.
  static async deleteWorkflow(workflowId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          // P1 — archive all execution records BEFORE deleting the parent workflow
          // so that execution records are not orphaned on partial failure.
          let hasMore = true;
          while (hasMore) {
            // P0: filter out already-archived docs so the loop terminates naturally.
            const execSnap = await getDocs(
              query(
                collection(db, EXEC_COL()),
                where('workflowId', '==', workflowId),
                where('status', '!=', 'archived'),
                limit(400)
              )
            );
            if (execSnap.empty) {
              hasMore = false;
              break;
            }
            const batch = writeBatch(db);
            execSnap.docs.forEach(execDoc => {
              batch.update(execDoc.ref, { status: 'archived' });
            });
            await batch.commit();
            // If fewer than 400 came back, we've processed the last page.
            if (execSnap.docs.length < 400) hasMore = false;
          }

          // Delete the parent workflow document only after executions are archived.
          await deleteDoc(doc(db, WF_COL(), workflowId));
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'WorkflowService.deleteWorkflow', additionalData: { workflowId } });
          throw error;
        }
      }
    );
  }

  // ─── Execute workflow ────────────────────────────────────────────────────────
  // P0-A: idempotency guard prevents duplicate executions for the same trigger.
  // P1-B: currentStepIndex updated in Firestore after each step.
  // P1-C: lastExecutedAt and executionCount updated via serverTimestamp/increment.
  static async executeWorkflow(
    workflowId: string,
    context: Record<string, any>,
    triggeredBy: 'manual' | 'event' | 'schedule' | 'webhook' | 'condition' = 'manual'
  ): Promise<WorkflowExecution> {
    const executionStartTime = Date.now();

    return withDevMode<WorkflowExecution>(
      () => {
        const id = `exec-dev-${Date.now()}`;
        const mockSteps: WorkflowExecutionStep[] = [
          {
            stepId: 'step1',
            stepType: 'create_notification',
            stepOrder: 1,
            status: 'success',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            duration: 45,
          },
        ];
        return {
          id,
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
          // Fix 7 (P1): execution-depth guard prevents infinite workflow loops
          if ((context._executionDepth ?? 0) >= 5) {
            throw new Error('Workflow execution depth limit exceeded (max 5). Possible infinite loop detected.');
          }

          const workflow = await this.getWorkflowById(workflowId);
          if (!workflow || workflow.status !== 'active') {
            throw new Error('Workflow not found or not active');
          }

          // ── P0-A: Idempotency guard ─────────────────────────────────────────
          // Build a key from workflowId + triggerId (or minute-boundary timestamp).
          // P1: fallback uses randomUUID so two simultaneous "no-triggerId" calls
          // each get a unique key and are never incorrectly deduplicated.
          // Callers should always pass context.triggerId to get proper dedup.
          const triggerId: string = context.triggerId ?? (() => {
            console.warn(
              'WorkflowService.executeWorkflow: no triggerId in context; ' +
              'generating random idempotency key — pass context.triggerId for dedup'
            );
            return crypto.randomUUID();
          })();
          const idempotencyKey = `${workflowId}_${triggerId}`;

          // Fix 8 (P1): atomic dedup via runTransaction prevents TOCTOU race condition.
          // Using a deterministic document ID ensures only one execution record is
          // ever created for a given idempotencyKey, even under concurrent calls.
          const executionDocId = `${workflowId}_${triggerId}`;
          const executionRef = doc(db, EXEC_COL(), executionDocId);

          const executionPayload: Omit<WorkflowExecution, 'id'> & {
            idempotencyKey: string;
            currentStepIndex: number;
          } = {
            workflowId,
            workflowName: workflow.name,
            status: 'running',
            startedAt: new Date().toISOString(),
            triggeredBy,
            executedSteps: [],
            nodeExecutions: [],
            context,
            idempotencyKey,
            currentStepIndex: 0,
          };

          let isDuplicate = false;
          let duplicateExecution: WorkflowExecution | undefined;
          await runTransaction(db, async (txn) => {
            const existing = await txn.get(executionRef);
            if (existing.exists()) {
              isDuplicate = true;
              duplicateExecution = {
                id: existing.id,
                ...existing.data(),
                startedAt: existing.data().startedAt?.toDate?.()?.toISOString() ?? existing.data().startedAt,
                completedAt: existing.data().completedAt?.toDate?.()?.toISOString() ?? existing.data().completedAt,
              } as WorkflowExecution;
              return; // do not write — transaction will commit as a no-op read
            }
            txn.set(executionRef, { ...executionPayload, startedAt: serverTimestamp() });
          });

          if (isDuplicate && duplicateExecution) {
            console.log(
              `WorkflowService: workflow already executed for this trigger, skipping. executionId=${executionDocId}`
            );
            return duplicateExecution;
          }
          // ─────────────────────────────────────────────────────────────────────

          const executedSteps: WorkflowExecutionStep[] = [];
          let executionError: WorkflowExecution['error'] | undefined;

          // The workflow from types/automation.ts stores nodes+connections, not
          // a flat steps array. Retrieve steps from context if provided, else
          // treat nodes of non-trigger type as ordered steps.
          const steps: WorkflowStep[] =
            context._steps ??
            workflow.nodes
              .filter(n => n.type !== 'trigger')
              .map((n, idx) => ({
                id: n.id,
                type: (n.type as any) ?? 'update_data',
                config: n.config ?? {},
                order: idx + 1,
              }));

          try {
            for (const [stepIndex, step] of steps
              .sort((a, b) => a.order - b.order)
              .entries()) {
              const stepStartTime = Date.now();
              const stepExecution: WorkflowExecutionStep = {
                stepId: step.id,
                stepType: step.type,
                stepOrder: step.order,
                status: 'running',
                startedAt: new Date().toISOString(),
              };

              try {
                await this.executeStep(step, { ...context, executionId: executionRef.id, workflowId });
                stepExecution.status = 'success';
                stepExecution.completedAt = new Date().toISOString();
                stepExecution.duration = Date.now() - stepStartTime;
                executedSteps.push(stepExecution);

                // P1-B: persist real-time progress so admins can monitor execution.
                await updateDoc(executionRef, {
                  currentStepIndex: stepIndex + 1,
                  executedSteps,
                  updatedAt: serverTimestamp(),
                });
              } catch (stepError) {
                const msg = stepError instanceof Error ? stepError.message : 'Unknown error';
                stepExecution.status = 'failed';
                stepExecution.completedAt = new Date().toISOString();
                stepExecution.duration = Date.now() - stepStartTime;
                stepExecution.error = msg;
                executedSteps.push(stepExecution);

                executionError = {
                  message: msg,
                  stepId: step.id,
                  stepType: step.type,
                  stack: stepError instanceof Error ? stepError.stack : undefined,
                };

                // Persist the failing step index before breaking.
                await updateDoc(executionRef, {
                  currentStepIndex: stepIndex + 1,
                  executedSteps,
                  updatedAt: serverTimestamp(),
                });
                break;
              }
            }

            // Final execution record update.
            const executionDuration = Date.now() - executionStartTime;
            await updateDoc(executionRef, {
              status: executionError ? 'failed' : 'success',
              completedAt: serverTimestamp(),
              duration: executionDuration,
              executedSteps,
              ...(executionError && { error: executionError }),
            });

            // P1-C: update workflow's own counters using atomic increment
            //        so concurrent executions don't race.
            await updateDoc(doc(db, WF_COL(), workflowId), {
              lastExecutedAt: serverTimestamp(),
              executionCount: increment(1),
            });

            return {
              id: executionRef.id,
              ...executionPayload,
              status: executionError ? 'failed' : 'success',
              completedAt: new Date().toISOString(),
              duration: executionDuration,
              executedSteps,
              error: executionError,
            };
          } catch (error) {
            // Outer catch: mark execution failed and re-throw.
            const executionDuration = Date.now() - executionStartTime;
            const msg = error instanceof Error ? error.message : 'Unknown error';
            await updateDoc(executionRef, {
              status: 'failed',
              completedAt: serverTimestamp(),
              duration: executionDuration,
              executedSteps,
              error: { message: msg, stack: error instanceof Error ? error.stack : undefined },
            });
            errorLoggingService.logError(error as Error, {
              action: 'WorkflowService.executeWorkflow',
              additionalData: { workflowId },
            });
            throw error;
          }
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            action: 'WorkflowService.executeWorkflow (outer)',
            additionalData: { workflowId },
          });
          throw error;
        }
      }
    );
  }

  // ─── Execute a single workflow step ─────────────────────────────────────────
  private static async executeStep(
    step: WorkflowStep,
    context: Record<string, any>
  ): Promise<void> {
    switch (step.type) {
      case 'send_email': {
        try {
          const { EmailService } = await import('./emailService');
          const { MembersService } = await import('./membersService');

          let recipientEmail: string | string[] =
            step.config.recipientEmail || step.config.to;

          if (step.config.recipientId && !recipientEmail) {
            const member = await MembersService.getMemberById(step.config.recipientId);
            if (member?.email) {
              recipientEmail = member.email;
            } else {
              throw new Error(`Member ${step.config.recipientId} not found or has no email`);
            }
          }

          if (step.config.recipientIds && Array.isArray(step.config.recipientIds)) {
            const members = await Promise.all(
              step.config.recipientIds.map((id: string) =>
                MembersService.getMemberById(id)
              )
            );
            recipientEmail = members.filter(m => m?.email).map(m => m!.email);
          }

          if (!recipientEmail) throw new Error('No recipient email specified');

          await EmailService.sendEmail({
            to: recipientEmail,
            subject: step.config.subject || context.subject || 'Notification',
            html: step.config.html || step.config.body || step.config.message || '',
            text: step.config.text,
            cc: step.config.cc,
            bcc: step.config.bcc,
            replyTo: step.config.replyTo,
            tags: step.config.tags || ['automation', 'workflow'],
            metadata: { workflowId: context.workflowId, stepId: step.id, ...context },
          });
        } catch (error) {
          console.error('WorkflowService: send_email step failed:', error);
          // Fallback to notification if a memberId is available.
          if (step.config.recipientId) {
            await CommunicationService.createNotification({
              memberId: step.config.recipientId,
              title: step.config.subject || 'Notification',
              message: step.config.body || step.config.message || '',
              type: 'info',
            });
          }
          // Do not re-throw — allow the workflow to continue.
        }
        break;
      }

      case 'update_data': {
        // P2: actually perform the update using config.collection, config.docId, config.fields.
        const config = step.config;
        if (!config.collection || !config.docId || !config.fields) {
          throw new Error(
            'update_data step requires config.collection, config.docId, and config.fields'
          );
        }
        await updateDoc(doc(db, config.collection as string, config.docId as string), config.fields as Record<string, unknown>);
        // Fix 9 (P2): invalidate cache for the updated collection so stale reads don't persist
        cacheService.deleteByPrefix((config.collection as string) + ':');
        break;
      }

      case 'award_points': {
        const memberId = step.config.memberId || context.memberId;
        const category = step.config.category || POINT_CATEGORIES.MEDIA_CONTRIBUTION;
        const amount = step.config.amount || step.config.points || 10;
        const description =
          step.config.description || context.description || 'Automated points award';
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
        } else {
          console.warn('WorkflowService: award_points step has no memberId');
        }
        break;
      }

      case 'create_notification': {
        const memberId = step.config.memberId || context.memberId;
        if (memberId) {
          await CommunicationService.createNotification({
            memberId,
            title: step.config.title || 'Notification',
            message: step.config.message || step.config.body || '',
            type: (step.config.type as 'info' | 'success' | 'warning' | 'error') || 'info',
          });
        } else {
          console.warn('WorkflowService: create_notification step has no memberId');
        }
        break;
      }

      case 'call_webhook': {
        const url = step.config.url || step.config.webhookUrl;
        if (url) {
          try {
            const response = await fetch(url, {
              method: step.config.method || 'POST',
              headers: step.config.headers || { 'Content-Type': 'application/json' },
              body: JSON.stringify(step.config.body || context),
            });
            if (!response.ok) {
              throw new Error(`Webhook ${url} returned ${response.status} ${response.statusText}`);
            }
          } catch (error) {
            console.error('WorkflowService: call_webhook step failed:', error);
            // Webhook failures are non-fatal by design.
          }
        } else {
          console.warn('WorkflowService: call_webhook step has no URL');
        }
        break;
      }

      case 'conditional': {
        const conditionMet = this.evaluateCondition(step.config.condition, context);
        console.log(`WorkflowService: conditional step evaluated → ${conditionMet}`);
        context._conditionResult = conditionMet;
        break;
      }

      default:
        console.warn('WorkflowService: unknown step type:', (step as any).type);
    }
  }

  // ─── Condition evaluator ─────────────────────────────────────────────────────
  // P1-D: implements 'contains', 'startsWith', 'regex' in addition to comparison operators.
  private static evaluateCondition(
    condition: any,
    context: Record<string, any>
  ): boolean {
    if (!condition) return true;

    if (
      condition.field &&
      condition.operator &&
      condition.value !== undefined
    ) {
      const fieldValue = this.getNestedValue(context, condition.field);
      const conditionValue = condition.value;

      switch (condition.operator) {
        case '==':
          return fieldValue === conditionValue;
        case '!=':
          return fieldValue !== conditionValue;
        case '>':
          return fieldValue > conditionValue;
        case '<':
          return fieldValue < conditionValue;
        case '>=':
          return fieldValue >= conditionValue;
        case '<=':
          return fieldValue <= conditionValue;

        // P1-D: string-match operators that were previously unimplemented.
        case 'contains':
          return String(fieldValue).includes(String(conditionValue));
        case 'startsWith':
          return String(fieldValue).startsWith(String(conditionValue));
        case 'regex': {
          try {
            return new RegExp(String(conditionValue)).test(String(fieldValue));
          } catch {
            console.warn('WorkflowService: invalid regex in condition:', conditionValue);
            return false;
          }
        }

        default:
          console.warn('WorkflowService: unknown condition operator:', condition.operator);
          return false;
      }
    }

    return true;
  }

  // ─── Nested-value accessor ────────────────────────────────────────────────────
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((cur, key) => cur?.[key], obj);
  }

  // ─── Execution logs ──────────────────────────────────────────────────────────
  // P1: restricted to BOARD / ADMIN / SUPER_ADMIN callers only.
  static async getExecutionLogs(
    workflowId?: string,
    limitCount = 50
  ): Promise<WorkflowExecution[]> {
    return withDevMode<WorkflowExecution[]>(
      () => [],
      async () => {
        try {
          // P2: JS-layer role guard (belt-and-suspenders).
          // TODO: add isAdmin()||isBoard() to firestore.rules workflow_executions
          //       read rule so direct SDK access is also restricted.
          const currentUid = auth?.currentUser?.uid;
          if (!currentUid) throw new Error('Unauthenticated');
          const callerSnap = await getDoc(doc(db, 'members', currentUid));
          const callerRole: string = callerSnap.exists()
            ? (callerSnap.data() as any).role ?? ''
            : '';
          const allowedRoles = ['board', 'admin', 'super_admin', 'BOARD', 'ADMIN', 'SUPER_ADMIN'];
          if (!allowedRoles.includes(callerRole)) {
            throw new Error('Permission denied: execution logs require BOARD or ADMIN role');
          }

          const col = collection(db, EXEC_COL());
          const q = workflowId
            ? query(
                col,
                where('workflowId', '==', workflowId),
                orderBy('startedAt', 'desc'),
                limit(limitCount)
              )
            : query(col, orderBy('startedAt', 'desc'), limit(limitCount));

          const snap = await getDocs(q);
          return snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            startedAt:
              d.data().startedAt?.toDate?.()?.toISOString() ?? d.data().startedAt,
            completedAt:
              d.data().completedAt?.toDate?.()?.toISOString() ?? d.data().completedAt,
          } as WorkflowExecution));
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            action: 'WorkflowService.getExecutionLogs',
            additionalData: { workflowId },
          });
          throw error;
        }
      }
    );
  }

  // ─── Get single execution ────────────────────────────────────────────────────
  static async getExecutionById(executionId: string): Promise<WorkflowExecution | null> {
    return withDevMode(
      () => null,
      async () => {
        try {
          const snap = await getDoc(doc(db, EXEC_COL(), executionId));
          if (!snap.exists()) return null;
          const data = snap.data();
          return {
            id: snap.id,
            ...data,
            startedAt: data.startedAt?.toDate?.()?.toISOString() ?? data.startedAt,
            completedAt: data.completedAt?.toDate?.()?.toISOString() ?? data.completedAt,
          } as WorkflowExecution;
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            action: 'WorkflowService.getExecutionById',
            additionalData: { executionId },
          });
          throw error;
        }
      }
    );
  }
}
