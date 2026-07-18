import { useRef } from 'react';
import { useFirestoreCollection } from './useFirestoreCollection';
import { KnowledgeService } from '../services/knowledgeService';
import { TrainingModule, Document } from '../types';
import { useToast } from '../components/ui/Common';

export const useKnowledge = () => {
  const { showToast } = useToast();
  const isSubmittingRef = useRef(false);

  const { data: trainingModules, loading: modulesLoading, error: modulesError, reload: reloadModules } =
    useFirestoreCollection<TrainingModule>({ loader: () => KnowledgeService.getAllTrainingModules() });

  const { data: documents, loading: docsLoading, error: docsError, reload: reloadDocs } =
    useFirestoreCollection<Document>({ loader: () => KnowledgeService.getAllDocuments() });

  const loading = modulesLoading || docsLoading;
  const error = modulesError || docsError;

  const loadData = async () => {
    await Promise.all([reloadModules(), reloadDocs()]);
  };

  const createDocument = async (documentData: Omit<Document, 'id'>) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const id = await KnowledgeService.createDocument(documentData);
      await reloadDocs();
      showToast('Document uploaded successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload document';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await KnowledgeService.deleteDocument(documentId);
      await reloadDocs();
      showToast('Document deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return {
    trainingModules,
    documents,
    loading,
    error,
    loadData,
    createDocument,
    deleteDocument,
  };
};
