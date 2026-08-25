import { useCallback, useState } from 'react';
import { EventFeedbackService, type EventFeedbackSummary } from '../../../services/eventFeedbackService';

type ShowToast = (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

export const useEventFeedbackSummary = (eventId: string, showToast: ShowToast) => {
  const [eventFeedback, setEventFeedback] = useState<EventFeedbackSummary | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const loadEventFeedback = useCallback(async () => {
    setLoadingFeedback(true);
    try {
      const summary = await EventFeedbackService.getFeedbackSummary(eventId);
      setEventFeedback(summary);
    } catch {
      showToast('Failed to load event feedback', 'error');
    } finally {
      setLoadingFeedback(false);
    }
  }, [eventId, showToast]);

  return {
    eventFeedback,
    loadingFeedback,
    loadEventFeedback,
  };
};
