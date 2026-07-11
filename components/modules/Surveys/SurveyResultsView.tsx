import React from 'react';
import { BarChart2, ArrowRight, Download, X, Star } from 'lucide-react';
import { Card, Button, ProgressBar } from '../../ui/Common';
import { Survey } from '../../../services/surveysService';
import { SurveyAnalytics } from '../../../services/surveyAnalyticsService';

interface SurveyResultsViewProps {
    surveys: Survey[];
    selectedSurveyId: string | null;
    analytics: SurveyAnalytics | null;
    loading: boolean;
    onSelectSurvey: (surveyId: string) => void;
    onExport: (surveyId: string) => void;
}

export const SurveyResultsView: React.FC<SurveyResultsViewProps> = ({
    surveys,
    selectedSurveyId,
    analytics,
    loading,
    onSelectSurvey,
    onExport,
}) => {
    const closedSurveys = surveys.filter(s => s.status === 'Closed');

    if (closedSurveys.length === 0) {
        return (
            <div className="text-center py-10 text-slate-400">
                <BarChart2 className="mx-auto mb-4 text-slate-300" size={48} />
                <p>No completed surveys available for analysis</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {!selectedSurveyId && (
                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Select a Survey to View Results</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        {closedSurveys.map(survey => (
                            <Card key={survey.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelectSurvey(survey.id)}>
                                <h4 className="font-bold text-slate-900 mb-2">{survey.title}</h4>
                                <p className="text-sm text-slate-500 mb-3">{survey.description}</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600">{survey.responsesCount} responses</span>
                                    <Button variant="outline" size="sm">
                                        View Results <ArrowRight size={14} className="ml-2" />
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {selectedSurveyId && (
                <div>
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">
                                {analytics?.surveyTitle || 'Survey Results'}
                            </h3>
                            <p className="text-sm text-slate-500">Analytics and response breakdown</p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onExport(selectedSurveyId)}
                            >
                                <Download size={16} className="mr-2" /> Export CSV
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onSelectSurvey('')}
                            >
                                <X size={16} />
                            </Button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-10">Loading analytics...</div>
                    ) : analytics ? (
                        <div className="space-y-6">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-4">
                                <Card>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-slate-900">{analytics.totalResponses}</div>
                                        <div className="text-sm text-slate-500">Total Responses</div>
                                    </div>
                                </Card>
                                <Card>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-slate-900">{analytics.responseRate}%</div>
                                        <div className="text-sm text-slate-500">Response Rate</div>
                                    </div>
                                </Card>
                                <Card>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-slate-900">{analytics.completionRate}%</div>
                                        <div className="text-sm text-slate-500">Completion Rate</div>
                                    </div>
                                </Card>
                            </div>

                            {/* Question Analytics */}
                            <div className="space-y-6">
                                {analytics.questionAnalytics.map((qa, index) => (
                                    <Card key={qa.questionId}>
                                        <h4 className="font-bold text-slate-900 mb-4">
                                            {index + 1}. {qa.questionText}
                                        </h4>
                                        <p className="text-sm text-slate-500 mb-4">
                                            {qa.totalResponses} responses • Type: {qa.questionType}
                                        </p>

                                        {qa.questionType === 'multiple-choice' && qa.analytics.optionCounts && (
                                            <div className="space-y-3">
                                                {Object.entries(qa.analytics.optionCounts).map(([option, count]) => {
                                                    const percentage = qa.analytics.optionPercentages?.[option] || 0;
                                                    return (
                                                        <div key={option}>
                                                            <div className="flex justify-between text-sm mb-1">
                                                                <span className="font-medium text-slate-700">{option}</span>
                                                                <span className="text-slate-600">{count} ({percentage.toFixed(1)}%)</span>
                                                            </div>
                                                            <ProgressBar progress={percentage} color="bg-jci-blue" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {qa.questionType === 'rating' && qa.analytics.averageRating && (
                                            <div className="space-y-3">
                                                <div className="text-center">
                                                    <div className="text-3xl font-bold text-jci-blue">{qa.analytics.averageRating}</div>
                                                    <div className="text-sm text-slate-500">Average Rating</div>
                                                </div>
                                                {qa.analytics.ratingDistribution && (
                                                    <div className="space-y-2">
                                                        {[5, 4, 3, 2, 1].map(rating => {
                                                            const count = qa.analytics.ratingDistribution?.[rating] || 0;
                                                            const percentage = qa.totalResponses > 0 ? (count / qa.totalResponses) * 100 : 0;
                                                            return (
                                                                <div key={rating}>
                                                                    <div className="flex justify-between text-sm mb-1">
                                                                        <span className="font-medium text-slate-700">
                                                                            {rating} <Star size={14} className="inline text-yellow-400" fill="currentColor" />
                                                                        </span>
                                                                        <span className="text-slate-600">{count} ({percentage.toFixed(1)}%)</span>
                                                                    </div>
                                                                    <ProgressBar progress={percentage} color="bg-yellow-400" />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {qa.questionType === 'yes-no' && (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span className="font-medium text-green-700">Yes</span>
                                                            <span className="text-slate-600">
                                                                {qa.analytics.yesCount} ({qa.analytics.yesPercentage?.toFixed(1)}%)
                                                            </span>
                                                        </div>
                                                        <ProgressBar progress={qa.analytics.yesPercentage || 0} color="bg-green-500" />
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span className="font-medium text-red-700">No</span>
                                                            <span className="text-slate-600">
                                                                {qa.analytics.noCount} ({qa.analytics.noPercentage?.toFixed(1)}%)
                                                            </span>
                                                        </div>
                                                        <ProgressBar progress={qa.analytics.noPercentage || 0} color="bg-red-500" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {qa.questionType === 'text' && qa.analytics.textResponses && (
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {qa.analytics.textResponses.slice(0, 10).map((response, idx) => (
                                                    <div key={idx} className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
                                                        "{response}"
                                                    </div>
                                                ))}
                                                {qa.analytics.textResponses.length > 10 && (
                                                    <p className="text-xs text-slate-500 text-center">
                                                        Showing 10 of {qa.analytics.textResponses.length} responses
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-10 text-slate-400">No analytics available</div>
                    )}
                </div>
            )}
        </div>
    );
};
