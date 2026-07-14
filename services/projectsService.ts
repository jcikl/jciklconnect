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
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Project, Task } from '../types';
import { PointsService } from './pointsService';
import { withDevMode } from '../utils/devMode';
import { apiCache } from './cacheService';
import { MOCK_PROJECTS, MOCK_TASKS } from './mockData';

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
          console.error('Error fetching projects:', error);
          throw error;
        }
      }, PROJECTS_TTL, 'projectsService.getAllProjects')
    );
  }

  // Get project by ID
  static async getProjectById(projectId: string): Promise<Project | null> {
    try {
      const docRef = doc(db, COLLECTIONS.PROJECTS, projectId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Project;
      }
      return null;
    } catch (error) {
      console.error('Error fetching project:', error);
      throw error;
    }
  }

  // Create new project
  static async createProject(projectData: Omit<Project, 'id'>): Promise<string> {
    try {
      const payload: Record<string, unknown> = {
        name: projectData.name ?? null,
        lead: projectData.lead ?? null,
        status: projectData.status ?? 'Planning',
        budget: projectData.budget ?? 0,
        spent: projectData.spent ?? 0,
        completion: projectData.completion ?? 0,
        teamSize: projectData.teamSize ?? 0,
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
      console.error('Error creating project:', error);
      throw error;
    }
  }

  // Update project
  static async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
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
          const updateData: Record<string, unknown> = { updatedAt: Timestamp.now() };
          Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
              updateData[key] = value;
            }
          });
          await updateDoc(projectRef, updateData);
          this.invalidateProjectsCache();

          // Recalculate radar stats for affected members
          if (memberIdsToRecalculate.size > 0) {
            for (const memberId of memberIdsToRecalculate) {
              await PointsService.recalculateMemberRadarStats(memberId);
            }
          }
        } catch (error) {
          console.error('Error updating project:', error);
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

          await deleteDoc(projectRef);
          this.invalidateProjectsCache();

          // Clear projectId from bank transactions that reference this project (情景 M)
          const txQuery = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            where('projectId', '==', projectId)
          );
          const txSnap = await getDocs(txQuery);
          await Promise.all(txSnap.docs.map(d =>
            updateDoc(d.ref, { projectId: null, updatedAt: Timestamp.now() })
          ));

          // Recalculate radar stats for affected members (revocation)
          if (memberIdsToRecalculate.size > 0) {
            for (const memberId of memberIdsToRecalculate) {
              await PointsService.recalculateMemberRadarStats(memberId);
            }
          }
        } catch (error) {
          console.error('Error deleting project:', error);
          throw error;
        }
      }
    );
  }

  // Get tasks for a project
  static async getProjectTasks(projectId: string): Promise<Task[]> {
    return withDevMode(
      () => MOCK_TASKS.filter(task => task.projectId === projectId),
      async () => {
        try {
          const q = query(
            collection(db, 'tasks'),
            where('projectId', '==', projectId),
            orderBy('dueDate', 'asc')
          );

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
          console.error('Error fetching project tasks:', error);
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
          const taskDoc = await getDoc(doc(db, 'tasks', taskId));
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
          console.error('Error fetching task by ID:', error);
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
            const taskRef = doc(db, 'tasks', taskId);
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
            const docRef = await addDoc(collection(db, 'tasks'), newTask);
            return docRef.id;
          }
        } catch (error) {
          console.error('Error creating/updating task:', error);
          throw error;
        }
      }
    );
  }

  // Update task
  static async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    return withDevMode(
      async () => {
        // Simulate awarding points if task is completed
        if (updates.status === 'Done' && updates.assignee && updates.projectId) {
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
          const taskRef = doc(db, 'tasks', taskId);

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
            };
            updateData.statusHistory = statusHistory;
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

          await updateDoc(taskRef, updateData);

          // If task is completed, award points
          if (updates.status === 'Done') {
            const taskDoc = await getDoc(taskRef);
            const task = taskDoc.data() as Task;

            if (task.assignee && task.projectId) {
              await PointsService.awardTaskCompletionPoints(
                task.assignee,
                task.projectId,
                taskId,
                task.priority
              );
            }
          }
        } catch (error) {
          console.error('Error updating task:', error);
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
      console.error('Error updating project completion:', error);
      throw error;
    }
  }
}
