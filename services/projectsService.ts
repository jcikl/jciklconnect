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
import { isDevMode } from '../utils/devMode';
import { MOCK_PROJECTS, MOCK_TASKS } from './mockData';

export class ProjectsService {
  // Get all projects (includes all statuses - no filtering)
  static async getAllProjects(): Promise<Project[]> {
    if (isDevMode()) {
      return MOCK_PROJECTS;
    }

    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.PROJECTS), orderBy('createdAt', 'desc'))
      );
      // Return all projects regardless of status
      return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() ?? d.data().createdAt,
        updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() ?? d.data().updatedAt,
      } as Project));
    } catch (error) {
      if (isDevMode()) {
        return MOCK_PROJECTS;
      }
      console.error('Error fetching projects:', error);
      throw error;
    }
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

      const docRef = await addDoc(collection(db, COLLECTIONS.PROJECTS), payload);
      return docRef.id;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  // Update project
  static async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    try {
      const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
      // Strip out undefined values to avoid Firestore errors
      const updateData: Record<string, unknown> = { updatedAt: Timestamp.now() };
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[key] = value;
        }
      });
      await updateDoc(projectRef, updateData);
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }

  // Delete project
  static async deleteProject(projectId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }

  // Get tasks for a project
  static async getProjectTasks(projectId: string): Promise<Task[]> {
    if (isDevMode()) {
      // Return mock tasks filtered by projectId
      return MOCK_TASKS.filter(task => task.projectId === projectId);
    }

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

  // Get task by ID
  static async getTaskById(taskId: string): Promise<Task | null> {
    if (isDevMode()) {
      const mockTask = MOCK_TASKS.find(t => t.id === taskId);
      return mockTask || null;
    }

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

  // Create or update task (if taskId is provided, use it as document ID)
  static async createTask(taskData: Omit<Task, 'id'>, taskId?: string): Promise<string> {
    if (isDevMode()) {
      const newId = taskId || `mock-task-${Date.now()}`;
      console.log(`[DEV MODE] Simulating creation of task with ID: ${newId}`);
      return newId;
    }

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

  // Update task
  static async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Simulating update of task ${taskId} with updates:`, updates);
      // Simulate awarding points if task is completed
      if (updates.status === 'Done' && updates.assignee && updates.projectId) {
        await PointsService.awardTaskCompletionPoints(
          updates.assignee,
          updates.projectId,
          taskId,
          updates.priority
        );
      }
      return;
    }

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

