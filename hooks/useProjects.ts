// Projects Data Hook
import { useRef } from 'react';
import { ProjectsService } from '../services/projectsService';
import { Project, Task } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isDevMode } from '../utils/devMode';
import { useFirestoreCollection } from './useFirestoreCollection';

export const useProjects = () => {
  const { showToast } = useToast();
  const { member, loading: authLoading, isDevMode: isDevModeFromAuth } = useAuth();
  const isSubmittingRef = useRef(false);

  const inDevMode = isDevMode() || isDevModeFromAuth;
  const enabled = !authLoading && (!!member || inDevMode);

  const { data: projects, loading: loading1, error, reload: loadProjects } = useFirestoreCollection<Project>({
    loader: () => ProjectsService.getAllProjects(),
    enabled,
    deps: [enabled],
  });

  // Keep auth spinner going while auth is still resolving
  const loading = authLoading || loading1;

  const createProject = async (projectData: Omit<Project, 'id'>) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const id = await ProjectsService.createProject(projectData);
      await loadProjects();
      showToast('Project created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await ProjectsService.updateProject(projectId, updates);
      await loadProjects();
      showToast('Project updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update project';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const deleteProject = async (projectId: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await ProjectsService.deleteProject(projectId);
      await loadProjects();
      showToast('Project deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const getProjectTasksRef = useRef(false);
  const getProjectTasks = async (projectId: string): Promise<Task[]> => {
    if (getProjectTasksRef.current) return [];
    getProjectTasksRef.current = true;
    try {
      return await ProjectsService.getProjectTasks(projectId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tasks';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      getProjectTasksRef.current = false;
    }
  };

  const createTask = async (taskData: Omit<Task, 'id'>, taskId?: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const id = await ProjectsService.createTask(taskData, taskId);
      await loadProjects();
      showToast('Task created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create task';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const getTaskByIdRef = useRef(false);
  const getTaskById = async (taskId: string): Promise<Task | null> => {
    if (getTaskByIdRef.current) return null;
    getTaskByIdRef.current = true;
    try {
      return await ProjectsService.getTaskById(taskId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load task';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      getTaskByIdRef.current = false;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await ProjectsService.updateTask(taskId, updates);
      await loadProjects();
      showToast('Task updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update task';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return {
    projects,
    loading,
    error,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    getProjectTasks,
    createTask,
    updateTask,
    getTaskById,
  };
};
