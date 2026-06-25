// Surveys Data Hook
import { useState, useEffect } from 'react';
import { SurveysService, Survey, SurveyResponse } from '../services/surveysService';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';

export const useSurveys = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { member } = useAuth();
  const { showToast } = useToast();

  const loadSurveys = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await SurveysService.getAllSurveys();
      setSurveys(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load surveys';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, []);

  const createSurvey = async (surveyData: Omit<Survey, 'id' | 'responsesCount' | 'createdAt'>) => {
    try {
      if (!member) {
        throw new Error('You must be logged in to create a survey');
      }
      
      const surveyWithCreator = {
        ...surveyData,
        createdBy: member.id,
      };
      
      const id = await SurveysService.createSurvey(surveyWithCreator);
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
    if (!member) {
      showToast('Please login to submit survey', 'error');
      return;
    }
    
    try {
      await SurveysService.submitResponse({
        surveyId,
        memberId: member.id,
        answers,
      });
      await loadSurveys();
      showToast('Survey response submitted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit survey';
      showToast(errorMessage, 'error');
      throw err;
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

