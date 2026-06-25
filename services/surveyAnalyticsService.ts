// Survey Analytics Service - Analyzes survey responses and generates statistics
import { SurveysService, Survey, SurveyResponse, SurveyQuestion } from './surveysService';
import { isDevMode } from '../utils/devMode';

export interface QuestionAnalytics {
  questionId: string;
  questionText: string;
  questionType: SurveyQuestion['type'];
  totalResponses: number;
  analytics: {
    // For multiple-choice questions
    optionCounts?: Record<string, number>;
    optionPercentages?: Record<string, number>;
    // For rating questions
    averageRating?: number;
    ratingDistribution?: Record<number, number>;
    // For yes-no questions
    yesCount?: number;
    noCount?: number;
    yesPercentage?: number;
    noPercentage?: number;
    // For text questions
    textResponses?: string[];
    wordCloud?: Record<string, number>;
  };
}

export interface SurveyAnalytics {
  surveyId: string;
  surveyTitle: string;
  totalResponses: number;
  responseRate: number; // Percentage of target audience who responded
  completionRate: number; // Percentage of started surveys that were completed
  questionAnalytics: QuestionAnalytics[];
  averageCompletionTime?: number; // In minutes
  responseTrend?: Array<{
    date: string;
    count: number;
  }>;
}

export class SurveyAnalyticsService {
  // Generate comprehensive analytics for a survey
  static async generateAnalytics(
    surveyId: string,
    totalEligibleMembers: number = 100
  ): Promise<SurveyAnalytics> {
    if (isDevMode()) {
      return this.getMockAnalytics(surveyId, totalEligibleMembers);
    }

    try {
      const survey = await SurveysService.getSurveyById(surveyId);
      if (!survey) {
        throw new Error('Survey not found');
      }

      const responses = await SurveysService.getSurveyResponses(surveyId);
      const totalResponses = responses.length;
      const responseRate = totalEligibleMembers > 0 
        ? (totalResponses / totalEligibleMembers) * 100 
        : 0;

      // Analyze each question
      const questionAnalytics: QuestionAnalytics[] = survey.questions.map(question => {
        const questionResponses = responses
          .map(r => r.answers[question.id])
          .filter(a => a !== undefined && a !== null);

        const analytics: QuestionAnalytics['analytics'] = {};

        switch (question.type) {
          case 'multiple-choice':
            const optionCounts: Record<string, number> = {};
            questionResponses.forEach(answer => {
              if (typeof answer === 'string') {
                optionCounts[answer] = (optionCounts[answer] || 0) + 1;
              }
            });
            const optionPercentages: Record<string, number> = {};
            Object.keys(optionCounts).forEach(option => {
              optionPercentages[option] = questionResponses.length > 0
                ? (optionCounts[option] / questionResponses.length) * 100
                : 0;
            });
            analytics.optionCounts = optionCounts;
            analytics.optionPercentages = optionPercentages;
            break;

          case 'rating':
            const ratings = questionResponses
              .map(a => typeof a === 'number' ? a : parseInt(a))
              .filter(r => !isNaN(r) && r >= 1 && r <= 5);
            const averageRating = ratings.length > 0
              ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
              : 0;
            const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            ratings.forEach(r => {
              ratingDistribution[r] = (ratingDistribution[r] || 0) + 1;
            });
            analytics.averageRating = Math.round(averageRating * 10) / 10;
            analytics.ratingDistribution = ratingDistribution;
            break;

          case 'yes-no':
            const yesCount = questionResponses.filter(a => 
              a === true || a === 'yes' || a === 'Yes' || a === 'YES'
            ).length;
            const noCount = questionResponses.length - yesCount;
            analytics.yesCount = yesCount;
            analytics.noCount = noCount;
            analytics.yesPercentage = questionResponses.length > 0
              ? (yesCount / questionResponses.length) * 100
              : 0;
            analytics.noPercentage = questionResponses.length > 0
              ? (noCount / questionResponses.length) * 100
              : 0;
            break;

          case 'text':
            const textResponses = questionResponses
              .map(a => String(a))
              .filter(t => t.trim().length > 0);
            analytics.textResponses = textResponses;
            // Simple word frequency analysis (basic implementation)
            const wordFreq: Record<string, number> = {};
            textResponses.forEach(text => {
              const words = text.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 3); // Filter out short words
              words.forEach(word => {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
              });
            });
            analytics.wordCloud = wordFreq;
            break;
        }

        return {
          questionId: question.id,
          questionText: question.question,
          questionType: question.type,
          totalResponses: questionResponses.length,
          analytics,
        };
      });

      // Calculate response trend (responses per day)
      const responseTrend: Array<{ date: string; count: number }> = [];
      const dateCounts: Record<string, number> = {};
      responses.forEach(response => {
        const date = new Date(response.submittedAt).toISOString().split('T')[0];
        dateCounts[date] = (dateCounts[date] || 0) + 1;
      });
      Object.keys(dateCounts)
        .sort()
        .forEach(date => {
          responseTrend.push({ date, count: dateCounts[date] });
        });

      return {
        surveyId: survey.id,
        surveyTitle: survey.title,
        totalResponses,
        responseRate: Math.round(responseRate * 10) / 10,
        completionRate: 100, // Assume all responses are complete for now
        questionAnalytics,
        responseTrend,
      };
    } catch (error) {
      console.error('Error generating survey analytics:', error);
      throw error;
    }
  }

  // Export analytics as CSV
  static async exportAnalyticsAsCSV(surveyId: string, totalEligibleMembers: number = 100): Promise<string> {
    const analytics = await this.generateAnalytics(surveyId, totalEligibleMembers);
    
    let csv = `Survey Analytics: ${analytics.surveyTitle}\n`;
    csv += `Survey ID: ${analytics.surveyId}\n`;
    csv += `Total Responses: ${analytics.totalResponses}\n`;
    csv += `Response Rate: ${analytics.responseRate}%\n`;
    csv += `Completion Rate: ${analytics.completionRate}%\n\n`;
    
    csv += `Question Analytics\n`;
    csv += `Question,Type,Total Responses,Analytics\n`;
    
    analytics.questionAnalytics.forEach(qa => {
      let analyticsStr = '';
      switch (qa.questionType) {
        case 'multiple-choice':
          if (qa.analytics.optionCounts) {
            analyticsStr = Object.entries(qa.analytics.optionCounts)
              .map(([option, count]) => `${option}: ${count}`)
              .join('; ');
          }
          break;
        case 'rating':
          analyticsStr = `Average: ${qa.analytics.averageRating}`;
          break;
        case 'yes-no':
          analyticsStr = `Yes: ${qa.analytics.yesCount} (${qa.analytics.yesPercentage?.toFixed(1)}%), No: ${qa.analytics.noCount} (${qa.analytics.noPercentage?.toFixed(1)}%)`;
          break;
        case 'text':
          analyticsStr = `${qa.analytics.textResponses?.length || 0} text responses`;
          break;
      }
      csv += `"${qa.questionText}",${qa.questionType},${qa.totalResponses},"${analyticsStr}"\n`;
    });
    
    return csv;
  }

  // Mock analytics for dev mode
  private static getMockAnalytics(surveyId: string, totalEligibleMembers: number): SurveyAnalytics {
    return {
      surveyId,
      surveyTitle: 'Mock Survey',
      totalResponses: 45,
      responseRate: 45,
      completionRate: 100,
      questionAnalytics: [
        {
          questionId: 'q1',
          questionText: 'How satisfied are you?',
          questionType: 'rating',
          totalResponses: 45,
          analytics: {
            averageRating: 4.2,
            ratingDistribution: { 1: 2, 2: 5, 3: 10, 4: 18, 5: 10 },
          },
        },
        {
          questionId: 'q2',
          questionText: 'What is your preferred event type?',
          questionType: 'multiple-choice',
          totalResponses: 45,
          analytics: {
            optionCounts: { 'Networking': 20, 'Training': 15, 'Social': 10 },
            optionPercentages: { 'Networking': 44.4, 'Training': 33.3, 'Social': 22.2 },
          },
        },
      ],
      responseTrend: [
        { date: '2024-01-01', count: 10 },
        { date: '2024-01-02', count: 15 },
        { date: '2024-01-03', count: 20 },
      ],
    };
  }
}

