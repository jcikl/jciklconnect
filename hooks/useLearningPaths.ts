// Learning Paths Data Hook
import { useRef } from 'react';
import { LearningPathsService, LearningPath } from '../services/learningPathsService';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isDevMode } from '../utils/devMode';
import { useFirestoreCollection } from './useFirestoreCollection';

export const useLearningPaths = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isSubmittingRef = useRef(false);

  const { data: paths, loading, error, reload: loadPaths } = useFirestoreCollection<LearningPath>({
    loader: () =>
      LearningPathsService.getAllLearningPaths().catch(err => {
        if (isDevMode()) return [];
        throw err;
      }),
    enabled: !!user || isDevMode(),
    deps: [!!user],
  });

  const createPath = async (pathData: Omit<LearningPath, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const id = await LearningPathsService.createLearningPath(pathData);
      await loadPaths();
      showToast('Learning path created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create learning path';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const updatePath = async (pathId: string, updates: Partial<LearningPath>) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await LearningPathsService.updateLearningPath(pathId, updates);
      await loadPaths();
      showToast('Learning path updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update learning path';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const deletePath = async (pathId: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await LearningPathsService.deleteLearningPath(pathId);
      await loadPaths();
      showToast('Learning path deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete learning path';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
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
