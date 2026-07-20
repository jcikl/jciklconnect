// Projects Service - CRUD Operations
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, POINT_CATEGORIES } from '../config/constants';
import { Project, Task } from '../types';
import { PointsService } from './pointsService';
import { withDevMode, isDevMode } from '../utils/devMode';
import { invalidateFinanceCache } from './financeService';
import { apiCache } from './cacheService';
import { MOCK_PROJECTS, MOCK_TASKS } from './mockData';
import { errorLoggingService } from './errorLoggingService';

const CACHE_KEY_ALL_PROJECTS = 'projects:all';
const PROJECTS_TTL = 3 * 60 * 1000; // 3 minutes

export class ProjectsService {
  static invalidateProjectsCache(): void {
    apiCache.delete(CACHE_KEY_ALL_PROJECTS);
  }

  // Get all projects (includes all statuses - no filtering)
  static async getAllProjects(): Promise<Project[]> {
    return withDevMode(
      () => MOCK_PROJECTS,
      () => apiCache.getOrSet(CACHE_KEY_ALL_PROJECTS, async () => {
        try {
          const snapshot = await getDocs(
            query(collection(db, COLLECTIONS.PROJECTS), orderBy('createdAt', 'desc'))
          );
          return snapshot.docs.map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() ?? d.data().createdAt,
            updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() ?? d.data().updatedAt,
          } as Project));
        } catch (error) {
          errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectsService.getAllProjects' });
          throw error;
        }
      }, PROJECTS_TTL, 'projectsService.getAllProjects')
    );
  }

  // Get project by ID
  static async getProjectById(projectId: string): Promise<Project | null> {
    if (isDevMode()) { return MOCK_PROJECTS?.find(p => p.id === projectId) ?? null; }
    try {
      const docRef = doc(db, COLLECTIONS.PROJECTS, projectId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Project;
      }
      return null;
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectsService.getProjectById', projectId });
      throw error;
    }
  }

  // Create new project
  // P1-B: accept optional currentUserId so organizerId is reliably written
  static async createProject(projectData: Omit<Project, 'id'>, currentUserId?: string): Promise<string> {
    if (isDevMode()) { return 'mock-project-' + Math.floor(Math.random() * 10000); }
    try {
      // P1-A: write both name and title for backward-compat callers that use either field
      // VAL-04: budget must not be negative
      if (projectData.budget !== undefined && projectData.budget < 0) throw new Error('Project budget cannot be negative');

      const resolvedName = projectData.name || projectData.title || '';
      const resolvedTitle = projectData.title || projectData.name || '';

      const payload: Record<string, unknown> = {
        name: resolvedName,
        title: resolvedTitle,
        lead: projectData.lead ?? null,
        status: projectData.status ?? 'Planning',
        budget: projectData.budget ?? 0,
        spent: projectData.spent ?? 0,
        completion: projectData.completion ?? 0,
        teamSize: projectData.teamSize ?? 0,
        // P1-B: organizerId from caller-supplied auth user, falling back to data field
        organizerId: currentUserId || projectData.organizerId || '',
        // P1-D: initialise versioning fields
        version: projectData.version ?? 1,
        previousVersionId: projectData.previousVersionId ?? null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      if (projectData.description != null) payload.description = projectData.description;
      if (projectData.team != null) payload.team = projectData.team;
      if (projectData.financialAccountId != null) payload.financialAccountId = projectData.financialAccountId;
      if (projectData.startDate != null) payload.startDate = projectData.startDate;
      if (projectData.endDate != null) payload.endDate = projectData.endDate;
      if (projectData.level != null) payload.level = projectData.level;
      if (projectData.pillar != null) payload.pillar = projectData.pillar;
      if (projectData.category != null) payload.category = projectData.category;
      if (projectData.type != null) payload.type = projectData.type;
      if (projectData.proposedDate != null) payload.proposedDate = projectData.proposedDate;
      if (projectData.proposedBudget != null) payload.proposedBudget = projectData.proposedBudget;
      if (projectData.objectives != null) payload.objectives = projectData.objectives;
      if (projectData.expectedImpact != null) payload.expectedImpact = projectData.expectedImpact;
      if (projectData.targetAudience != null) payload.targetAudience = projectData.targetAudience;
      if (projectData.eventStartDate != null) payload.eventStartDate = projectData.eventStartDate;
      if (projectData.eventEndDate != null) payload.eventEndDate = projectData.eventEndDate;
      if (projectData.eventStartTime != null) payload.eventStartTime = projectData.eventStartTime;
      if (projectData.eventEndTime != null) payload.eventEndTime = projectData.eventEndTime;
      if (projectData.committee != null) payload.committee = projectData.committee;
      if (projectData.submittedBy != null) payload.submittedBy = projectData.submittedBy;
      if (projectData.logoUrl != null) payload.logoUrl = projectData.logoUrl;
      if (projectData.galleryUrls != null) payload.galleryUrls = projectData.galleryUrls;
      if (projectData.priceMin != null) payload.priceMin = projectData.priceMin;
      if (projectData.priceMax != null) payload.priceMax = projectData.priceMax;
      if (projectData.roadmapUrl != null) payload.roadmapUrl = projectData.roadmapUrl;

      const docRef = await addDoc(collection(db, COLLECTIONS.PROJECTS), payload);
      this.invalidateProjectsCache();
      return docRef.id;
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectsService.createProject' });
      throw error;
    }
  }

  // Clone a project as a new version (P1-D)
  static async cloneProject(originalId: string, overrides: Partial<Omit<Project, 'id'>> = {}, currentUserId?: string): Promise<string> {
    const original = await this.getProjectById(originalId);
    if (!original) throw new Error(`Project ${originalId} not found`);
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = original;
    return this.createProject(
      {
        ...rest,
        ...overrides,
        version: (original.version ?? 1) + 1,
        previousVersionId: originalId,
        status: 'Draft',
      },
      currentUserId,
    );
  }

  // Update project
  // P1-C: pass currentUserId so review approval/rejection stamps reviewedBy + reviewedDate together
  static async updateProject(projectId: string, updates: Partial<Project>, currentUserId?: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);

          // Determine members to recalculate if committee or trainers change
          const memberIdsToRecalculate = new Set<string>();
          if (updates.committee !== undefined || updates.trainers !== undefined) {
            const oldSnap = await getDoc(projectRef);
            if (oldSnap.exists()) {
              const oldData = oldSnap.data() as Project;
              if (oldData.committee && Array.isArray(oldData.committee)) {
                oldData.committee.forEach((c: any) => {
                  if (c.memberId) memberIdsToRecalculate.add(c.memberId);
                });
              }
              if (oldData.trainers && Array.isArray(oldData.trainers)) {
                oldData.trainers.forEach((t: any) => {
                  if (t.memberId) memberIdsToRecalculate.add(t.memberId);
                });
              }
            }

            if (updates.committee && Array.isArray(updates.committee)) {
              updates.committee.forEach((c: any) => {
                if (c.memberId) memberIdsToRecalculate.add(c.memberId);
              });
            }
            if (updates.trainers && Array.isArray(updates.trainers)) {
              updates.trainers.forEach((t: any) => {
                if (t.memberId) memberIdsToRecalculate.add(t.memberId);
              });
            }
          }

          // Strip out undefined values to avoid Firestore errors
          const updateData: Record<string, unknown> = {
            updatedAt: Timestamp.now(),
            ...(currentUserId && { updatedBy: currentUserId }),
          };
          Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
              updateData[key] = value;
            }
          });

          // P1-C: when a review decision is made, stamp reviewedBy + reviewedDate atomically
          const reviewStatus = updates.status as string | undefined;
          if (
            (reviewStatus === 'Approved' || reviewStatus === 'Rejected') &&
            currentUserId
          ) {
            updateData.reviewedBy = currentUserId;
            updateData.reviewedDate = new Date().toISOString();
          }

          // P1-ST: status transition pre-validation — read current status and enforce allowed moves.
          if (updates.status !== undefined) {
            const ALLOWED_TRANSITIONS: Record<string, string[]> = {
              'Draft':        ['Planning', 'Submitted', 'Cancelled'],
              'Planning':     ['Draft', 'Submitted', 'Active', 'Cancelled'],
              'Submitted':    ['Under Review', 'Approved', 'Rejected', 'Cancelled'],
              'Under Review': ['Approved', 'Rejected', 'Cancelled'],
              'Approved':     ['Active', 'Rejected', 'Cancelled'],
              'Rejected':     ['Submitted', 'Cancelled'],
              'Active':       ['Completed', 'Cancelled'],
              'Completed':    [],          // terminal — no further transitions allowed
              'Cancelled':    [],          // terminal
            };
            const currentSnap = await getDoc(projectRef);
            if (currentSnap.exists()) {
              const currentStatus = (currentSnap.data() as Record<string, unknown>).status as string | undefined;
              if (currentStatus) {
                const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
                if (!allowed.includes(updates.status as string)) {
                  throw new Error(
                    `Invalid project status transition: "${currentStatus}" → "${updates.status}". ` +
                    (allowed.length
                      ? `Allowed next statuses: ${allowed.join(', ')}.`
                      : 'This status is terminal and cannot be changed.')
                  );
                }
              }
            }
          }

          await updateDoc(projectRef, updateData);
          this.invalidateProjectsCache();
          (await import('./eventsService')).EventsService.invalidateEventsCache();

          // SYNC-006: Sync project.budget → projectFinancialAccount.budget.
          // In production, projectFinancialService.getProjectFinancialAccount derives budget
          // directly from the projects Firestore document (project.budget || project.proposedBudget),
          // so there is no separate document to update — the read is always fresh after this updateDoc.
          // In dev mode, projectFinancialService holds an in-memory Map; sync it if budget changed.
          if (updates.budget !== undefined && isDevMode()) {
            try {
              const { projectFinancialService } = await import('./projectFinancialService');
              const existingAcc = await projectFinancialService.getProjectFinancialAccount(projectId);
              if (existingAcc) {
                // Patch the in-memory account directly so dev-mode reads stay consistent.
                (projectFinancialService as any).accounts?.set(existingAcc.id, {
                  ...existingAcc,
                  budget: updates.budget,
                  startingBalance: updates.budget,
                });
              }
            } catch (syncErr) {
              // Non-fatal: dev-mode in-memory sync only. Budget reads in production are always live.
              console.warn('SYNC-006: dev-mode projectFinancialAccount budget sync failed (non-fatal):', syncErr);
            }
          }
          // TODO (SYNC-006): If a separate projectFinancialAccounts Firestore collection is ever
          // introduced, add a batch.update here to keep its budget field in sync with project.budget.

          // Recalculate radar stats for affected members
          if (memberIdsToRecalculate.size > 0) {
            for (const memberId of memberIdsToRecalculate) {
              await PointsService.recalculateMemberRadarStats(memberId);
            }
          }
        } catch (error) {
          errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectsService.updateProject', projectId });
          throw error;
        }
      }
    );
  }

  // Delete project
  static async deleteProject(projectId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
          const oldSnap = await getDoc(projectRef);
          const memberIdsToRecalculate = new Set<string>();
          if (oldSnap.exists()) {
            const oldData = oldSnap.data() as Project;
            if (oldData.committee && Array.isArray(oldData.committee)) {
              oldData.committee.forEach((c: any) => {
                if (c.memberId) memberIdsToRecalculate.add(c.memberId);
              });
            }
            if (oldData.trainers && Array.isArray(oldData.trainers)) {
              oldData.trainers.forEach((t: any) => {
                if (t.memberId) memberIdsToRecalculate.add(t.memberId);
              });
            }
          }

          // P1 FIX: fetch orphan collections linked to this project.
          const [txSnap, tasksSnap, reportsSnap, plansSnap, projectTrxGuardSnap] = await Promise.all([
            // Clear projectId from bank transactions (unlink, not delete)
            getDocs(query(collection(db, COLLECTIONS.TRANSACTIONS), where('projectId', '==', projectId))),
            // Hard-delete tasks, projectReports, and activityPlans that belong to this project.
            getDocs(query(collection(db, COLLECTIONS.TASKS), where('projectId', '==', projectId))),
            getDocs(query(collection(db, COLLECTIONS.PROJECT_REPORTS), where('projectId', '==', projectId))),
            // P1 FIX: ActivityPlan uses parentProjectId (not projectId) for its project link
            getDocs(query(collection(db, COLLECTIONS.ACTIVITY_PLANS), where('parentProjectId', '==', projectId))),
            // Guard: block deletion if project financial ledger (projectTrx) records exist —
            // deleting financial records silently would destroy audit history.
            getDocs(query(collection(db, COLLECTIONS.PROJECT_TRANSACTIONS), where('projectId', '==', projectId), limit(1))),
          ]);

          if (!projectTrxGuardSnap.empty) {
            throw new Error('Cannot delete project with existing financial records. Remove or reassign project transactions first.');
          }

          // Atomically delete the project, unlink transactions, and remove orphan docs.
          const BATCH_SIZE = 490;
          const now = Timestamp.now();
          const orphanDeleteDocs = [...tasksSnap.docs, ...reportsSnap.docs, ...plansSnap.docs];
          const allBatchOps: Array<{ type: 'delete' | 'update'; ref: import('firebase/firestore').DocumentReference; data?: Record<string, unknown> }> = [
            { type: 'delete', ref: projectRef },
            ...txSnap.docs.map(d => ({ type: 'update' as const, ref: d.ref, data: { projectId: null, updatedAt: now } })),
            ...orphanDeleteDocs.map(d => ({ type: 'delete' as const, ref: d.ref })),
          ];
          for (let i = 0; i < allBatchOps.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            allBatchOps.slice(i, i + BATCH_SIZE).forEach(op => {
              if (op.type === 'delete') batch.delete(op.ref);
              else batch.update(op.ref, op.data!);
            });
            await batch.commit();
          }

          this.invalidateProjectsCache();
          invalidateFinanceCache();
          (await import('./eventsService')).EventsService.invalidateEventsCache();

          // Recalculate radar stats for affected members (revocation)
          if (memberIdsToRecalculate.size > 0) {
            for (const memberId of memberIdsToRecalculate) {
              await PointsService.recalculateMemberRadarStats(memberId);
            }
          }
        } catch (error) {
          errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectsService.deleteProject', projectId });
          throw error;
        }
      }
    );
  }

  // P1-E: Register a member with capacity guard
  static async registerMember(projectId: string, memberId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          // P0 FIX: use runTransaction so capacity check + write are atomic — prevents
          // over-registration when multiple members register concurrently.
          const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
          await runTransaction(db, async (txn) => {
            const snap = await txn.get(projectRef);
            if (!snap.exists()) throw new Error(`Project ${projectId} not found`);
            const data = snap.data() as import('../types').Project;
            const current: string[] = data.registeredMembers ?? [];
            const max = data.maxAttendees ?? 500;
            if (current.includes(memberId)) {
              throw new Error('Member is already registered for this project.');
            }
            if (current.length >= max) {
              throw new Error('Project has reached maximum capacity.');
            }
            txn.update(projectRef, {
              registeredMembers: arrayUnion(memberId),
              updatedAt: Timestamp.now(),
            });
          });
          this.invalidateProjectsCache();
        } catch (error) {
          errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectsService.registerMember', projectId, memberId });
          throw error;
        }
      }
    );
  }

  // Unregister a member from a project
  static async unregisterMember(projectId: string, memberId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          // P1 FIX: use arrayRemove instead of reading and rewriting the full array,
          // which prevents overwriting concurrent writes.
          const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
          await updateDoc(projectRef, {
            registeredMembers: arrayRemove(memberId),
            updatedAt: Timestamp.now(),
          });
          this.invalidateProjectsCache();
        } catch (error) {
          errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectsService.unregisterMember', projectId, memberId });
          throw error;
        }
      }
    );
  }

  // Get tasks for a project
  // P1-C: supports optional filters (priority). Requires composite Firestore index on (projectId, priority).
  // NOTE: Requires composite index on (projectId, priority) — add to firestore.indexes.json if filtering by priority.
  static async getProjectTasks(projectId: string, filters?: { priority?: Task['priority'] }): Promise<Task[]> {
    return withDevMode(
      () => {
        let tasks = MOCK_TASKS.filter(task => task.projectId === projectId);
        if (filters?.priority) tasks = tasks.filter(t => t.priority === filters.priority);
        return tasks;
      },
      async () => {
        try {
          let q = query(
            collection(db, COLLECTIONS.TASKS),
            where('projectId', '==', projectId),
            orderBy('dueDate', 'asc')
          );

          // P1-C: Firestore-side priority filter (avoids full collection scan)
          if (filters?.priority) {
            q = query(
              collection(db, COLLECTIONS.TASKS),
              where('projectId', '==', projectId),
              where('priority', '==', filters.priority),
              orderBy('dueDate', 'asc')
            );
          }

          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              status: data.status || 'Todo', // 确保状态字段存在
              priority: data.priority || 'Medium', // 确保优先级字段存在
              assignee: data.assignee || '', // 确保 assignee 字段存在
              dueDate: data.dueDate?.toDate?.()?.toISOString() || data.dueDate || new Date().toISOString().split('T')[0],
            } as Task;
          });
        } catch (error) {
          errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectsService.getProjectTasks', projectId });
          throw error;
        }
      }
    );
  }

  // Get task by ID
  static async getTaskById(taskId: string): Promise<Task | null> {
    return withDevMode(
      () => MOCK_TASKS.find(t => t.id === taskId) || null,
      async () => {
        try {
          const taskDoc = await getDoc(doc(db, COLLECTIONS.TASKS, taskId));
          if (!taskDoc.exists()) {
            return null;
          }

          const data = taskDoc.data();
          return {
            id: taskDoc.id,
            ...data,
            dueDate: data.dueDate?.toDate?.()?.toISOString() || data.dueDate,
          } as Task;
        } catch (error) {
          errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectsService.getTaskById', taskId });
          throw error;
        }
      }
    );
  }

  // Create or update task (if taskId is provided, use it as document ID)
  static async createTask(taskData: Omit<Task, 'id'>, taskId?: string): Promise<string> {
    return withDevMode(
      () => taskId || `mock-task-${Date.now()}`,
      async () => {
        try {
          // P1-D: prevent self-dependency
          if (taskId && taskData.dependencies?.includes(taskId)) {
            throw new Error('A task cannot depend on itself.');
          }
          // TODO: Implement DFS cycle detection with visited set to prevent infinite loops in task chains

          const now = Timestamp.now();
          const rawTask = {
            ...taskData,
            status: taskData.status || 'Todo' as const,
            createdAt: now,
            updatedAt: now,
            dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
          };

          // Strip out undefined values to avoid Firestore errors
          const newTask: Record<string, unknown> = {};
          Object.entries(rawTask).forEach(([key, value]) => {
            if (value !== undefined) {
              newTask[key] = value;
            }
          });

          // 如果提供了 taskId，使用 setDoc 创建/更新（使用指定的文档 ID）
          if (taskId) {
            const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
            const existingTask = await getDoc(taskRef);

            // 如果 task 已存在，保留原有的 createdAt，只更新其他字段
            if (existingTask.exists()) {
              const existingData = existingTask.data();
              if (existingData.createdAt) {
                newTask.createdAt = existingData.createdAt;
              } else {
                newTask.createdAt = now;
              }
            } else {
              // 新任务，确保 createdAt 已设置
              newTask.createdAt = now;
            }

            await setDoc(taskRef, newTask, { merge: true });
            return taskId;
          } else {
            // 否则使用 addDoc 让 Firestore 自动生成 ID
            const docRef = await addDoc(collection(db, COLLECTIONS.TASKS), newTask);
            return docRef.id;
          }
        } catch (error) {
          errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectsService.createTask' });
          throw error;
        }
      }
    );
  }

  // Update task
  static async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    return withDevMode(
      async () => {
        // P1 fix (dev mode): simulate the task write FIRST, then award points —
        // mirrors production order where runTransaction commits the task update
        // atomically before the points side-effect fires.
        if (updates.status === 'Done' && updates.assignee && updates.projectId) {
          console.log(`[DEV MODE] updateTask: writing task ${taskId} status → Done`);
          await PointsService.awardTaskCompletionPoints(
            updates.assignee,
            updates.projectId,
            taskId,
            updates.priority
          );
        }
      },
      async () => {
        try {
          // P1-D: prevent self-dependency on update
          if (updates.dependencies?.includes(taskId)) {
            throw new Error('A task cannot depend on itself.');
          }
          // TODO: Implement DFS cycle detection with visited set to prevent infinite loops in task chains

          const taskRef = doc(db, COLLECTIONS.TASKS, taskId);

          // 获取现有任务数据以合并 statusHistory 和 remarks
          const existingTask = await getDoc(taskRef);
          const existingData = existingTask.exists() ? existingTask.data() : {};

          const updateData: any = {
            updatedAt: Timestamp.now(),
          };

          // 处理 status 更新：记录到 statusHistory
          if (updates.status && updates.status !== existingData.status) {
            updateData.status = updates.status;
            const statusHistory = existingData.statusHistory || {};
            const statusChangeId = `status-${Date.now()}`;
            statusHistory[statusChangeId] = {
              status: updates.status,
              timestamp: new Date().toISOString(),
              changedBy: (updates as any).changedBy || 'unknown',
            };
            updateData.statusHistory = statusHistory;

            // P1-A: set completedAt when task transitions to Done
            if (updates.status === 'Done') {
              updateData.completedAt = Timestamp.now();
            }
          }

          // 处理 remarks：如果提供了新的 remark，添加到 remarks map
          if (updates.remarks) {
            updateData.remarks = updates.remarks;
          }

          // 处理其他字段更新
          Object.keys(updates).forEach(key => {
            if (key !== 'status' && key !== 'remarks' && key !== 'statusHistory' && key !== 'id') {
              updateData[key] = updates[key as keyof Task];
            }
          });

          if (updates.dueDate) {
            updateData.dueDate = updates.dueDate;
          }

          // P0 FIX: When completing a task, write the task update and points award in a
          // single runTransaction so both succeed or both fail atomically.
          const mergedTask = { ...existingData, ...updates } as Task;
          const isCompletionWithPoints =
            updates.status === 'Done' &&
            mergedTask.assignee &&
            mergedTask.projectId;

          if (isCompletionWithPoints) {
            const memberId = mergedTask.assignee!;
            const priority = mergedTask.priority ?? 'Medium';
            const awardYear = new Date().getFullYear();
            const dedupRef = doc(db, COLLECTIONS.POINTS, `${memberId}_${taskId}_task_completion`);
            const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);

            // Resolve the point value the same way awardTaskCompletionPoints does.
            const rule = await PointsService.getPointRule(POINT_CATEGORIES.PROJECT_TASK);
            const priorityMultipliers: Record<string, number> = {
              Urgent: 2.0, High: 1.5, Medium: 1.0, Low: 0.5,
            };
            let points: number;
            if (rule?.basePoints !== undefined) {
              points = Math.floor(
                rule.basePoints * (rule.multiplier ?? 1) * (priorityMultipliers[priority] ?? 1)
              );
            } else {
              const fallback: Record<string, number> = { Urgent: 25, High: 20, Medium: 15, Low: 10 };
              points = fallback[priority] ?? 15;
            }

            await runTransaction(db, async (txn) => {
              const dedup = await txn.get(dedupRef);
              if (dedup.exists()) {
                // Already awarded — still update the task doc (idempotent).
                txn.update(taskRef, updateData);
                return;
              }
              const memberSnap = await txn.get(memberRef);
              if (!memberSnap.exists()) throw new Error('Assignee member not found');
              const currentPoints: number = memberSnap.data()?.points || 0;

              txn.update(taskRef, updateData);
              txn.set(dedupRef, {
                memberId,
                points,
                amount: points,
                category: POINT_CATEGORIES.PROJECT_TASK,
                description: `Completed ${priority} priority task`,
                relatedEntityId: taskId,
                sourceId: taskId,
                relatedEntityType: 'task',
                sourceType: 'task',
                metadata: { projectId: mergedTask.projectId, priority },
                createdAt: Timestamp.now(),
              });
              txn.update(memberRef, {
                points: increment(points),
                tier: PointsService.calculateTier(currentPoints + points),
                [`yearlyPoints.${awardYear}`]: increment(points),
                updatedAt: Timestamp.now(),
              });
            });
            PointsService.invalidatePointsCache();
            // MembersService cache invalidated via import to avoid circular dep.
            const { MembersService } = await import('./membersService');
            MembersService.invalidateMembersCache();
          } else {
            await updateDoc(taskRef, updateData);
          }

          // P1 FIX: always invalidate project cache after any task update
          this.invalidateProjectsCache();

          // P1 FIX: after any status change, recalculate project completion percentage
          if (updates.status !== undefined && mergedTask.projectId) {
            try {
              await this.updateProjectCompletion(mergedTask.projectId);
            } catch (completionErr) {
              // Non-fatal: completion percentage is derived data; log but don't fail the task update
              console.warn('[updateTask] updateProjectCompletion failed (non-fatal):', completionErr);
            }
          }
        } catch (error) {
          errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectsService.updateTask', taskId });
          throw error;
        }
      }
    );
  }

  // Delete a task by ID and update project completion
  static async deleteTask(taskId: string, projectId?: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
          // Fetch task to get projectId if not provided
          if (!projectId) {
            const snap = await getDoc(taskRef);
            if (snap.exists()) {
              projectId = (snap.data() as Task).projectId;
            }
          }
          await deleteDoc(taskRef);
          this.invalidateProjectsCache();
          // P1 FIX: update project completion after task deletion
          if (projectId) {
            try {
              await this.updateProjectCompletion(projectId);
            } catch (completionErr) {
              console.warn('[deleteTask] updateProjectCompletion failed (non-fatal):', completionErr);
            }
          }
        } catch (error) {
          errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectsService.deleteTask', taskId });
          throw error;
        }
      }
    );
  }

  // Update project completion percentage
  static async updateProjectCompletion(projectId: string): Promise<void> {
    try {
      const tasks = await this.getProjectTasks(projectId);
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'Done').length;
      const completion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      await this.updateProject(projectId, { completion });
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectsService.updateProjectCompletion', projectId });
      throw error;
    }
  }
}
