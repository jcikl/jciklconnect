// Knowledge Data Hook
import { useState, useEffect } from 'react';
import { KnowledgeService } from '../services/knowledgeService';
import { TrainingModule, Document } from '../types';
import { useToast } from '../components/ui/Common';

export const useKnowledge = () => {
  const [trainingModules, setTrainingModules] = useState<TrainingModule[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [modules, docs] = await Promise.all([
        KnowledgeService.getAllTrainingModules(),
        KnowledgeService.getAllDocuments(),
      ]);
      setTrainingModules(modules);
      setDocuments(docs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load knowledge data';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createDocument = async (documentData: Omit<Document, 'id'>) => {
    try {
      const id = await KnowledgeService.createDocument(documentData);
      await loadData();
      showToast('Document uploaded successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload document';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      await KnowledgeService.deleteDocument(documentId);
      await loadData();
      showToast('Document deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
      showToast(errorMessage, 'error');
      throw err;
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

