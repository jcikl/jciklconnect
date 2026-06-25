// Projects Data Hook
import { useState, useEffect } from 'react';
import { ProjectsService } from '../services/projectsService';
import { Project, Task } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isDevMode } from '../utils/devMode';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { member, loading: authLoading, isDevMode: isDevModeFromAuth } = useAuth();

  const loadProjects = async () => {
    const inDevMode = isDevMode() || isDevModeFromAuth;
    if (!member && !inDevMode) {
      setProjects([]);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await ProjectsService.getAllProjects();
      setProjects(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load projects';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    const inDevMode = isDevMode() || isDevModeFromAuth;
    if (!member && !inDevMode) {
      setProjects([]);
      setLoading(false);
      setError(null);
      return;
    }
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, authLoading, isDevModeFromAuth]);

  const createProject = async (projectData: Omit<Project, 'id'>) => {
    try {
      const id = await ProjectsService.createProject(projectData);
      await loadProjects();
      showToast('Project created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    try {
      await ProjectsService.updateProject(projectId, updates);
      await loadProjects();
      showToast('Project updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update project';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await ProjectsService.deleteProject(projectId);
      await loadProjects();
      showToast('Project deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const getProjectTasks = async (projectId: string): Promise<Task[]> => {
    try {
      return await ProjectsService.getProjectTasks(projectId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tasks';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const createTask = async (taskData: Omit<Task, 'id'>, taskId?: string) => {
    try {
      const id = await ProjectsService.createTask(taskData, taskId);
      await loadProjects();
      showToast('Task created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create task';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const getTaskById = async (taskId: string): Promise<Task | null> => {
    try {
      return await ProjectsService.getTaskById(taskId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load task';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      await ProjectsService.updateTask(taskId, updates);
      await loadProjects();
      showToast('Task updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update task';
      showToast(errorMessage, 'error');
      throw err;
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

