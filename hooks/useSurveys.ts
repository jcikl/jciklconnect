import { useRef } from 'react';
import { useFirestoreCollection } from './useFirestoreCollection';
import { SurveysService, Survey, SurveyResponse } from '../services/surveysService';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';

export const useSurveys = () => {
  const { member } = useAuth();
  const { showToast } = useToast();
  const isSubmittingRef = useRef(false);

  const { data: surveys, loading, error, reload: loadSurveys } = useFirestoreCollection<Survey>({
    loader: () => SurveysService.getAllSurveys(),
  });

  const createSurvey = async (surveyData: Omit<Survey, 'id' | 'responsesCount' | 'createdAt'>) => {
    try {
      if (!member) throw new Error('You must be logged in to create a survey');
      const id = await SurveysService.createSurvey({ ...surveyData, createdBy: member.id });
      await loadSurveys();
      showToast('Survey created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create survey';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateSurvey = async (surveyId: string, updates: Partial<Survey>) => {
    try {
      await SurveysService.updateSurvey(surveyId, updates);
      await loadSurveys();
      showToast('Survey updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update survey';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteSurvey = async (surveyId: string) => {
    try {
      await SurveysService.deleteSurvey(surveyId);
      await loadSurveys();
      showToast('Survey deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete survey';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const submitResponse = async (surveyId: string, answers: Record<string, any>) => {
    if (!member) { showToast('Please login to submit survey', 'error'); return; }
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await SurveysService.submitResponse({ surveyId, memberId: member.id, answers });
      await loadSurveys();
      showToast('Survey response submitted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit survey';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const getSurveyResponses = async (surveyId: string): Promise<SurveyResponse[]> => {
    try {
      return await SurveysService.getSurveyResponses(surveyId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load survey responses';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  return {
    surveys,
    loading,
    error,
    loadSurveys,
    createSurvey,
    updateSurvey,
    deleteSurvey,
    submitResponse,
    getSurveyResponses,
  };
};
