// Learning Paths Data Hook
import { useState, useEffect, useCallback } from 'react';
import { LearningPathsService, LearningPath, LearningProgress, Certificate } from '../services/learningPathsService';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isDevMode } from '../utils/devMode';

export const useLearningPaths = () => {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { user } = useAuth();

  const loadPaths = useCallback(async () => {
    if (!user && !isDevMode()) {
      setPaths([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await LearningPathsService.getAllLearningPaths();
      setPaths(data);
    } catch (err) {
      if (isDevMode()) {
        setPaths([]);
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load learning paths';
        setError(errorMessage);
        showToast(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [showToast, user]);

  useEffect(() => {
    loadPaths();
  }, [loadPaths]);

  const createPath = async (pathData: Omit<LearningPath, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const id = await LearningPathsService.createLearningPath(pathData);
      await loadPaths();
      showToast('Learning path created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create learning path';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updatePath = async (pathId: string, updates: Partial<LearningPath>) => {
    try {
      await LearningPathsService.updateLearningPath(pathId, updates);
      await loadPaths();
      showToast('Learning path updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update learning path';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deletePath = async (pathId: string) => {
    try {
      await LearningPathsService.deleteLearningPath(pathId);
      await loadPaths();
      showToast('Learning path deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete learning path';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  return {
    paths,
    loading,
    error,
    loadPaths,
    createPath,
    updatePath,
    deletePath,
  };
};

