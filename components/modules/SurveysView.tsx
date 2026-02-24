import React, { useState } from 'react';
import { MessageSquare, BarChart2, Plus, ArrowRight, Edit, Trash2, GripVertical, ChevronUp, ChevronDown, Type, List, Star, CheckSquare, Share2, Download, Send, X, Calendar, Mail, Phone, TrendingUp, FileText } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs, ProgressBar } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useSurveys } from '../../hooks/useSurveys';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { Input, Textarea, Select, Checkbox } from '../ui/Form';
import { Survey, SurveyQuestion, SurveyResponse } from '../../services/surveysService';
import { formatDate } from '../../utils/dateUtils';
import { SurveyAnalyticsService, SurveyAnalytics, QuestionAnalytics } from '../../services/surveyAnalyticsService';
import { CommunicationService } from '../../services/communicationService';

export const SurveysView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
    const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
    const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);
    const [showQuestionModal, setShowQuestionModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'surveys' | 'results'>('surveys');
    const [analyticsSurveyId, setAnalyticsSurveyId] = useState<string | null>(null);
    const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);
    const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
    const [distributingSurvey, setDistributingSurvey] = useState<Survey | null>(null);
    const [selectedChannels, setSelectedChannels] = useState<('email' | 'in-app' | 'link')[]>(['in-app']);
    const { surveys, loading, error, createSurvey, submitResponse, updateSurvey, deleteSurvey, getSurveyResponses } = useSurveys();
    const { member } = useAuth();
    const { isAdmin, isBoard } = usePermissions();
    const { showToast } = useToast();
    const canManage = isAdmin || isBoard;

    const generateQuestionId = () => `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const handleAddQuestion = () => {
        const newQuestion: SurveyQuestion = {
            id: generateQuestionId(),
            type: 'text',
            question: '',
            required: false,
        };
        setEditingQuestion(newQuestion);
        setShowQuestionModal(true);
    };

    const handleEditQuestion = (question: SurveyQuestion) => {
        setEditingQuestion(question);
        setShowQuestionModal(true);
    };

    const handleSaveQuestion = (question: SurveyQuestion) => {
        if (editingQuestion && questions.find(q => q.id === editingQuestion.id)) {
            setQuestions(questions.map(q => q.id === editingQuestion.id ? question : q));
        } else {
            setQuestions([...questions, question]);
        }
        setShowQuestionModal(false);
        setEditingQuestion(null);
    };

    const handleDeleteQuestion = (questionId: string) => {
        setQuestions(questions.filter(q => q.id !== questionId));
    };

    const handleMoveQuestion = (questionId: string, direction: 'up' | 'down') => {
        const index = questions.findIndex(q => q.id === questionId);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= questions.length) return;

        const newQuestions = [...questions];
        [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
        setQuestions(newQuestions);
    };

    const handleCreateSurvey = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        if (questions.length === 0) {
            showToast('Please add at least one question to the survey', 'error');
            return;
        }

        try {
            await createSurvey({
                title: formData.get('title') as string,
                description: formData.get('description') as string,
                questions,
                targetAudience: (formData.get('targetAudience') as any) || 'All Members',
                status: 'Draft',
                startDate: formData.get('startDate') as string,
                endDate: formData.get('endDate') as string,
                createdBy: member?.id || '',
            });
            setCreateModalOpen(false);
            setQuestions([]);
            e.currentTarget.reset();
        } catch (err) {
            // Error handled in the hook
        }
    };

    const loadAnalytics = async (surveyId: string) => {
        setLoadingAnalytics(true);
        try {
            const analyticsData = await SurveyAnalyticsService.generateAnalytics(surveyId);
            setAnalytics(analyticsData);
        } catch (err) {
            showToast('Failed to load analytics', 'error');
        } finally {
            setLoadingAnalytics(false);
        }
    };

    const handleShareSurvey = async (survey: Survey) => {
        const surveyUrl = survey.shareableLink || `${window.location.origin}/surveys/${survey.id}`;
        try {
            await navigator.clipboard.writeText(surveyUrl);
            showToast('Survey link copied to clipboard', 'success');
        } catch (err) {
            showToast('Failed to copy link', 'error');
        }
    };

    const handleDistributeSurvey = async (survey: Survey) => {
        try {
            const SurveysService = (await import('../../services/surveysService')).SurveysService;
            const result = await SurveysService.distributeSurvey(survey.id, selectedChannels);
            showToast(
                `Survey distributed: ${result.emailsSent} emails sent, ${result.notificationsSent} notifications sent`,
                'success'
            );
            setIsDistributeModalOpen(false);
            setDistributingSurvey(null);
            setSelectedChannels(['in-app']);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to distribute survey';
            showToast(errorMessage, 'error');
        }
    };

    const getQuestionIcon = (type: SurveyQuestion['type']) => {
        switch (type) {
            case 'text': return <Type size={16} />;
            case 'multiple-choice': return <List size={16} />;
            case 'rating': return <Star size={16} />;
            case 'yes-no': return <CheckSquare size={16} />;
            default: return <Type size={16} />;
        }
    };

    const getQuestionLabel = (type: SurveyQuestion['type']) => {
        switch (type) {
            case 'text': return 'Text';
            case 'multiple-choice': return 'Multiple Choice';
            case 'rating': return 'Rating';
            case 'yes-no': return 'Yes/No';
            default: return type;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Feedback & Surveys</h2>
                    <p className="text-slate-500">Pulse checks, satisfaction surveys, and polls.</p>
                </div>
                {canManage && (
                    <Button onClick={() => setCreateModalOpen(true)} disabled={!member}>
                        <Plus size={16} className="mr-2" /> Create Survey
                    </Button>
                )}
            </div>

            <Card noPadding>
                <div className="px-4 md:px-6 pt-4">
                    <Tabs
                        tabs={['Surveys', 'Results']}
                        activeTab={activeTab === 'surveys' ? 'Surveys' : 'Results'}
                        onTabChange={(tab) => {
                            setActiveTab(tab === 'Surveys' ? 'surveys' : 'results');
                            if (tab === 'Results' && analyticsSurveyId) {
                                loadAnalytics(analyticsSurveyId);
                            }
                        }}
                    />
                </div>
                <div className="p-4">
                    {activeTab === 'surveys' ? (
                        <LoadingState loading={loading} error={error} empty={surveys.length === 0} emptyMessage="No surveys available">
                            <div className="grid md:grid-cols-2 gap-6">
                                {surveys.filter(survey => {
                                    const term = (searchQuery || '').toLowerCase();
                                    if (!term) return true;
                                    return (
                                        (survey.title ?? '').toLowerCase().includes(term) ||
                                        (survey.description ?? '').toLowerCase().includes(term)
                                    );
                                }).map(survey => (
                                    <Card key={survey.id} className="flex flex-col h-full hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-4">
                                            <Badge variant={survey.status === 'Active' ? 'success' : survey.status === 'Closed' ? 'neutral' : 'warning'}>{survey.status}</Badge>
                                            <span className="text-xs text-slate-500">Due {formatDate(survey.endDate)}</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 mb-2">{survey.title}</h3>
                                        <p className="text-sm text-slate-600 mb-6 flex-1">{survey.description}</p>

                                        <div className="bg-slate-50 rounded-lg p-3 mb-4 flex items-center justify-between">
                                            <div className="text-xs text-slate-500">
                                                <span className="block font-semibold text-slate-700">{survey.responsesCount || 0}</span>
                                                Responses
                                            </div>
                                            <div className="text-xs text-slate-500 text-right">
                                                <span className="block font-semibold text-slate-700">{survey.targetAudience}</span>
                                                Audience
                                            </div>
                                        </div>

                                        <div className="flex gap-3">
                                            {survey.status === 'Active' ? (
                                                <Button
                                                    className="w-full"
                                                    onClick={() => setSelectedSurvey(survey)}
                                                    disabled={!member}
                                                >
                                                    Take Survey <ArrowRight size={14} className="ml-2" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => {
                                                        setAnalyticsSurveyId(survey.id);
                                                        setActiveTab('results');
                                                        loadAnalytics(survey.id);
                                                    }}
                                                >
                                                    <BarChart2 size={14} className="mr-2" /> View Results
                                                </Button>
                                            )}
                                            {canManage && (
                                                <>
                                                    {survey.status === 'Draft' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={async () => {
                                                                try {
                                                                    await updateSurvey(survey.id, { status: 'Active' });
                                                                } catch (err) {
                                                                    // Error handled in hook
                                                                }
                                                            }}
                                                        >
                                                            <Send size={14} /> Publish
                                                        </Button>
                                                    )}
                                                    {survey.status === 'Active' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setDistributingSurvey(survey);
                                                                setIsDistributeModalOpen(true);
                                                            }}
                                                            title="Distribute survey"
                                                        >
                                                            <Send size={14} className="mr-1" />
                                                            Distribute
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleShareSurvey(survey)}
                                                        title="Share survey link"
                                                    >
                                                        <Share2 size={14} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (window.confirm('Are you sure you want to delete this survey?')) {
                                                                deleteSurvey(survey.id);
                                                            }
                                                        }}
                                                        className="text-red-500"
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </LoadingState>
                    ) : (
                        <SurveyResultsView
                            surveys={surveys}
                            selectedSurveyId={analyticsSurveyId}
                            analytics={analytics}
                            loading={loadingAnalytics}
                            onSelectSurvey={(id) => {
                                setAnalyticsSurveyId(id);
                                loadAnalytics(id);
                            }}
                            onExport={(surveyId) => {
                                SurveyAnalyticsService.exportAnalyticsAsCSV(surveyId)
                                    .then(csv => {
                                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                        const link = document.createElement('a');
                                        link.href = URL.createObjectURL(blob);
                                        link.download = `survey-analytics-${surveyId}-${Date.now()}.csv`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        URL.revokeObjectURL(link.href);
                                        showToast('Analytics exported successfully', 'success');
                                    })
                                    .catch(() => showToast('Failed to export analytics', 'error'));
                            }}
                        />
                    )}
                </div>
            </Card>

            {/* Create Survey Modal */}
            <Modal isOpen={isCreateModalOpen} onClose={() => {
                setCreateModalOpen(false);
                setQuestions([]);
            }} title="Create Survey" size="xl" drawerOnMobile>
                <form onSubmit={handleCreateSurvey} className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-900">Basic Information</h3>
                        <Input name="title" label="Survey Title" placeholder="e.g. Member Satisfaction Survey" required />
                        <Textarea name="description" label="Description" placeholder="What is this survey about?" required rows={3} />
                        <div className="grid grid-cols-2 gap-4">
                            <Input name="startDate" label="Start Date" type="date" required />
                            <Input name="endDate" label="End Date" type="date" required />
                        </div>
                        <Select name="targetAudience" label="Target Audience" options={[
                            { label: 'All Members', value: 'All Members' },
                            { label: 'Board', value: 'Board' },
                            { label: 'Project Leads', value: 'Project Leads' },
                            { label: 'Specific Group', value: 'Specific Group' },
                        ]} defaultValue="All Members" required />
                    </div>

                    <div className="space-y-4 border-t pt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">Questions</h3>
                            <Button type="button" variant="outline" size="sm" onClick={handleAddQuestion}>
                                <Plus size={16} className="mr-2" /> Add Question
                            </Button>
                        </div>

                        {questions.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-slate-300 rounded-lg">
                                <MessageSquare className="mx-auto text-slate-400 mb-2" size={32} />
                                <p className="text-slate-500 text-sm">No questions added yet</p>
                                <p className="text-slate-400 text-xs mt-1">Click "Add Question" to start building your survey</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {questions.map((question, index) => (
                                    <div
                                        key={question.id}
                                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-jci-blue transition-colors"
                                    >
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <GripVertical className="text-slate-400 cursor-move" size={16} />
                                            <span className="text-xs font-mono bg-white px-2 py-1 rounded text-slate-600">
                                                {index + 1}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="p-2 bg-white rounded text-jci-blue">
                                                {getQuestionIcon(question.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm text-slate-900">{question.question || 'Untitled Question'}</p>
                                                <p className="text-xs text-slate-500">{getQuestionLabel(question.type)} {question.required && '• Required'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {index > 0 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleMoveQuestion(question.id, 'up')}
                                                >
                                                    <ChevronUp size={14} />
                                                </Button>
                                            )}
                                            {index < questions.length - 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleMoveQuestion(question.id, 'down')}
                                                >
                                                    <ChevronDown size={14} />
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEditQuestion(question)}
                                            >
                                                <Edit size={14} />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteQuestion(question.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex gap-3 border-t">
                        <Button className="flex-1" type="submit" disabled={questions.length === 0}>
                            Create Survey
                        </Button>
                        <Button variant="ghost" type="button" onClick={() => {
                            setCreateModalOpen(false);
                            setQuestions([]);
                        }}>Cancel</Button>
                    </div>
                </form>
            </Modal>

            {/* Question Editor Modal */}
            {showQuestionModal && editingQuestion && (
                <QuestionEditorModal
                    question={editingQuestion}
                    onSave={handleSaveQuestion}
                    onClose={() => {
                        setShowQuestionModal(false);
                        setEditingQuestion(null);
                    }}
                    drawerOnMobile
                />
            )}

            {/* Survey Response Modal */}
            {selectedSurvey && (
                <SurveyResponseModal
                    survey={selectedSurvey}
                    onClose={() => setSelectedSurvey(null)}
                    onSubmit={async (answers) => {
                        try {
                            await submitResponse(selectedSurvey.id, answers);
                            setSelectedSurvey(null);
                        } catch (err) {
                            // Error handled in hook
                        }
                    }}
                />
            )}

            {/* Survey Distribution Modal */}
            {isDistributeModalOpen && distributingSurvey && (
                <SurveyDistributionModal
                    survey={distributingSurvey}
                    selectedChannels={selectedChannels}
                    onChannelsChange={setSelectedChannels}
                    onClose={() => {
                        setIsDistributeModalOpen(false);
                        setDistributingSurvey(null);
                        setSelectedChannels(['in-app']);
                    }}
                    onDistribute={handleDistributeSurvey}
                    drawerOnMobile
                />
            )}
        </div>
    );
};

// Survey Response Modal Component
const SurveyResponseModal: React.FC<{
    survey: Survey;
    onClose: () => void;
    onSubmit: (answers: Record<string, any>) => Promise<void>;
}> = ({ survey, onClose, onSubmit }) => {
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required questions
        const requiredQuestions = survey.questions.filter(q => q.required);
        const missingRequired = requiredQuestions.filter(q => !answers[q.id] || answers[q.id] === '');

        if (missingRequired.length > 0) {
            showToast('Please answer all required questions', 'error');
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit(answers);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAnswerChange = (questionId: string, value: any) => {
        setAnswers({ ...answers, [questionId]: value });
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={survey.title} size="lg" drawerOnMobile>
            <form onSubmit={handleSubmit} className="space-y-6">
                <p className="text-sm text-slate-600">{survey.description}</p>

                <div className="space-y-6">
                    {survey.questions.map((question, index) => (
                        <div key={question.id} className="space-y-2">
                            <label className="block text-sm font-medium text-slate-900">
                                {index + 1}. {question.question}
                                {question.required && <span className="text-red-500 ml-1">*</span>}
                            </label>

                            {question.type === 'text' && (
                                <Textarea
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    placeholder="Enter your answer..."
                                    required={question.required}
                                    rows={3}
                                />
                            )}

                            {question.type === 'multiple-choice' && question.options && (
                                <div className="space-y-2">
                                    {question.options.map((option, optIndex) => (
                                        <label key={optIndex} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={question.id}
                                                value={option}
                                                checked={answers[question.id] === option}
                                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                                required={question.required}
                                                className="text-jci-blue"
                                            />
                                            <span className="text-sm text-slate-700">{option}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {question.type === 'rating' && (
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map(rating => (
                                        <button
                                            key={rating}
                                            type="button"
                                            onClick={() => handleAnswerChange(question.id, rating)}
                                            className={`p-3 rounded-lg border-2 transition-all ${answers[question.id] === rating
                                                ? 'border-jci-blue bg-blue-50 text-jci-blue'
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <Star size={24} fill={answers[question.id] === rating ? 'currentColor' : 'none'} />
                                            <span className="block text-xs mt-1">{rating}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {question.type === 'yes-no' && (
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex-1">
                                        <input
                                            type="radio"
                                            name={question.id}
                                            value="yes"
                                            checked={answers[question.id] === 'yes' || answers[question.id] === true}
                                            onChange={() => handleAnswerChange(question.id, 'yes')}
                                            required={question.required}
                                            className="text-jci-blue"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Yes</span>
                                    </label>
                                    <label className="flex items-center gap-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex-1">
                                        <input
                                            type="radio"
                                            name={question.id}
                                            value="no"
                                            checked={answers[question.id] === 'no' || answers[question.id] === false}
                                            onChange={() => handleAnswerChange(question.id, 'no')}
                                            required={question.required}
                                            className="text-jci-blue"
                                        />
                                        <span className="text-sm font-medium text-slate-700">No</span>
                                    </label>
                                </div>
                            )}

                            {question.type === 'date' && (
                                <Input
                                    type="date"
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    placeholder={question.placeholder || 'Select date...'}
                                    required={question.required}
                                />
                            )}

                            {question.type === 'number' && (
                                <Input
                                    type="number"
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, parseFloat(e.target.value) || 0)}
                                    placeholder={question.placeholder || 'Enter number...'}
                                    min={question.min}
                                    max={question.max}
                                    step={question.step}
                                    required={question.required}
                                />
                            )}

                            {question.type === 'email' && (
                                <Input
                                    type="email"
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    placeholder={question.placeholder || 'Enter email address...'}
                                    required={question.required}
                                />
                            )}

                            {question.type === 'phone' && (
                                <Input
                                    type="tel"
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    placeholder={question.placeholder || 'Enter phone number...'}
                                    required={question.required}
                                />
                            )}

                            {question.type === 'matrix' && question.matrixRows && question.matrixColumns && (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="border border-slate-300 p-2 text-left text-sm font-medium text-slate-700"></th>
                                                {question.matrixColumns.map((col, colIndex) => (
                                                    <th key={colIndex} className="border border-slate-300 p-2 text-center text-sm font-medium text-slate-700">
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {question.matrixRows.map((row, rowIndex) => (
                                                <tr key={rowIndex}>
                                                    <td className="border border-slate-300 p-2 text-sm font-medium text-slate-700">
                                                        {row}
                                                    </td>
                                                    {question.matrixColumns?.map((col, colIndex) => (
                                                        <td key={colIndex} className="border border-slate-300 p-2 text-center">
                                                            <input
                                                                type="radio"
                                                                name={`${question.id}-${rowIndex}`}
                                                                value={col}
                                                                checked={answers[`${question.id}-${rowIndex}`] === col}
                                                                onChange={(e) => handleAnswerChange(`${question.id}-${rowIndex}`, e.target.value)}
                                                                required={question.required}
                                                                className="text-jci-blue"
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {question.type === 'ranking' && question.options && (
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-500 mb-2">Drag to reorder (top = highest priority)</p>
                                    {question.options.map((option, optIndex) => (
                                        <div key={optIndex} className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50">
                                            <GripVertical className="text-slate-400 cursor-move" size={16} />
                                            <span className="flex-1 text-sm text-slate-700">{option}</span>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={question.options?.length}
                                                value={answers[`${question.id}-${option}`] || (optIndex + 1)}
                                                onChange={(e) => handleAnswerChange(`${question.id}-${option}`, parseInt(e.target.value))}
                                                className="w-16"
                                                required={question.required}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {question.helpText && (
                                <p className="text-xs text-slate-500 italic">{question.helpText}</p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                    <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
                    <Button type="submit" className="flex-1" disabled={submitting}>
                        {submitting ? 'Submitting...' : 'Submit Survey'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

// Survey Results View Component
const SurveyResultsView: React.FC<{
    surveys: Survey[];
    selectedSurveyId: string | null;
    analytics: SurveyAnalytics | null;
    loading: boolean;
    onSelectSurvey: (surveyId: string) => void;
    onExport: (surveyId: string) => void;
}> = ({ surveys, selectedSurveyId, analytics, loading, onSelectSurvey, onExport }) => {
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

interface QuestionEditorModalProps {
    question: SurveyQuestion;
    onSave: (question: SurveyQuestion) => void;
    onClose: () => void;
    drawerOnMobile?: boolean;
}

const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({ question, onSave, onClose, drawerOnMobile }) => {
    const [questionText, setQuestionText] = useState(question.question);
    const [questionType, setQuestionType] = useState<SurveyQuestion['type']>(question.type);
    const [required, setRequired] = useState(question.required);
    const [options, setOptions] = useState<string[]>(question.options || ['Option 1', 'Option 2']);
    const [placeholder, setPlaceholder] = useState(question.placeholder || '');
    const [helpText, setHelpText] = useState(question.helpText || '');
    const [min, setMin] = useState(question.min?.toString() || '');
    const [max, setMax] = useState(question.max?.toString() || '');
    const [step, setStep] = useState(question.step?.toString() || '1');
    const [matrixRows, setMatrixRows] = useState<string[]>(question.matrixRows || ['Row 1', 'Row 2']);
    const [matrixColumns, setMatrixColumns] = useState<string[]>(question.matrixColumns || ['Column 1', 'Column 2']);
    const [conditionalLogic, setConditionalLogic] = useState(question.conditionalLogic);
    const [enableConditional, setEnableConditional] = useState(!!question.conditionalLogic);

    const handleSave = () => {
        if (!questionText.trim()) {
            return;
        }

        const savedQuestion: SurveyQuestion = {
            ...question,
            question: questionText,
            type: questionType,
            required,
            placeholder: placeholder || undefined,
            helpText: helpText || undefined,
            min: min ? parseFloat(min) : undefined,
            max: max ? parseFloat(max) : undefined,
            step: step ? parseFloat(step) : undefined,
            options: (questionType === 'multiple-choice' || questionType === 'ranking') ? options : undefined,
            matrixRows: questionType === 'matrix' ? matrixRows : undefined,
            matrixColumns: questionType === 'matrix' ? matrixColumns : undefined,
            conditionalLogic: enableConditional && conditionalLogic ? conditionalLogic : undefined,
        };

        onSave(savedQuestion);
    };

    const handleAddOption = () => {
        setOptions([...options, `Option ${options.length + 1}`]);
    };

    const handleRemoveOption = (index: number) => {
        if (options.length > 2) {
            setOptions(options.filter((_, i) => i !== index));
        }
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Edit Question" size="lg" drawerOnMobile={drawerOnMobile}>
            <div className="space-y-4">
                <Input
                    label="Question Text"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Enter your question..."
                    required
                />

                <Select
                    label="Question Type"
                    value={questionType}
                    onChange={(e) => {
                        setQuestionType(e.target.value as SurveyQuestion['type']);
                        if (e.target.value !== 'multiple-choice' && e.target.value !== 'ranking') {
                            setOptions(['Option 1', 'Option 2']);
                        }
                    }}
                    options={[
                        { label: 'Text', value: 'text' },
                        { label: 'Multiple Choice', value: 'multiple-choice' },
                        { label: 'Rating (1-5)', value: 'rating' },
                        { label: 'Yes/No', value: 'yes-no' },
                        { label: 'Date', value: 'date' },
                        { label: 'Number', value: 'number' },
                        { label: 'Email', value: 'email' },
                        { label: 'Phone', value: 'phone' },
                        { label: 'Matrix', value: 'matrix' },
                        { label: 'Ranking', value: 'ranking' },
                    ]}
                />

                {(questionType === 'text' || questionType === 'number' || questionType === 'email' || questionType === 'phone') && (
                    <Input
                        label="Placeholder Text"
                        value={placeholder}
                        onChange={(e) => setPlaceholder(e.target.value)}
                        placeholder="e.g. Enter your answer..."
                    />
                )}

                {questionType === 'number' && (
                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label="Min Value"
                            type="number"
                            value={min}
                            onChange={(e) => setMin(e.target.value)}
                            placeholder="Min"
                        />
                        <Input
                            label="Max Value"
                            type="number"
                            value={max}
                            onChange={(e) => setMax(e.target.value)}
                            placeholder="Max"
                        />
                        <Input
                            label="Step"
                            type="number"
                            value={step}
                            onChange={(e) => setStep(e.target.value)}
                            placeholder="1"
                        />
                    </div>
                )}

                {questionType === 'rating' && (
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Min Rating"
                            type="number"
                            value={min || '1'}
                            onChange={(e) => setMin(e.target.value)}
                            placeholder="1"
                        />
                        <Input
                            label="Max Rating"
                            type="number"
                            value={max || '5'}
                            onChange={(e) => setMax(e.target.value)}
                            placeholder="5"
                        />
                    </div>
                )}

                {(questionType === 'multiple-choice' || questionType === 'ranking') && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Options</label>
                        {options.map((option, index) => (
                            <div key={index} className="flex gap-2">
                                <Input
                                    value={option}
                                    onChange={(e) => handleOptionChange(index, e.target.value)}
                                    placeholder={`Option ${index + 1}`}
                                />
                                {options.length > 2 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveOption(index)}
                                        className="text-red-500"
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddOption}
                        >
                            <Plus size={14} className="mr-2" />
                            Add Option
                        </Button>
                    </div>
                )}

                {questionType === 'matrix' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">Matrix Rows</label>
                            {matrixRows.map((row, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        value={row}
                                        onChange={(e) => {
                                            const newRows = [...matrixRows];
                                            newRows[index] = e.target.value;
                                            setMatrixRows(newRows);
                                        }}
                                        placeholder={`Row ${index + 1}`}
                                    />
                                    {matrixRows.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setMatrixRows(matrixRows.filter((_, i) => i !== index))}
                                            className="text-red-500"
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setMatrixRows([...matrixRows, `Row ${matrixRows.length + 1}`])}
                            >
                                <Plus size={14} className="mr-2" />
                                Add Row
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">Matrix Columns</label>
                            {matrixColumns.map((col, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        value={col}
                                        onChange={(e) => {
                                            const newCols = [...matrixColumns];
                                            newCols[index] = e.target.value;
                                            setMatrixColumns(newCols);
                                        }}
                                        placeholder={`Column ${index + 1}`}
                                    />
                                    {matrixColumns.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setMatrixColumns(matrixColumns.filter((_, i) => i !== index))}
                                            className="text-red-500"
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setMatrixColumns([...matrixColumns, `Column ${matrixColumns.length + 1}`])}
                            >
                                <Plus size={14} className="mr-2" />
                                Add Column
                            </Button>
                        </div>
                    </div>
                )}

                <Textarea
                    label="Help Text (Optional)"
                    value={helpText}
                    onChange={(e) => setHelpText(e.target.value)}
                    placeholder="Additional guidance for respondents..."
                    rows={2}
                />

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            checked={required}
                            onChange={(e) => setRequired(e.target.checked)}
                        />
                        <label className="text-sm font-medium text-slate-700">Required question</label>
                    </div>

                    <div className="border-t pt-3">
                        <div className="flex items-center gap-2 mb-3">
                            <Checkbox
                                checked={enableConditional}
                                onChange={(e) => setEnableConditional(e.target.checked)}
                            />
                            <label className="text-sm font-medium text-slate-700">Show this question conditionally</label>
                        </div>
                        {enableConditional && (
                            <div className="pl-6 space-y-3 bg-slate-50 p-3 rounded-lg">
                                <Select
                                    label="Show if previous question"
                                    value={conditionalLogic?.showIf.questionId || ''}
                                    onChange={(e) => {
                                        setConditionalLogic({
                                            showIf: {
                                                questionId: e.target.value,
                                                operator: conditionalLogic?.showIf.operator || 'equals',
                                                value: conditionalLogic?.showIf.value || '',
                                            },
                                        });
                                    }}
                                    options={[]} // Would be populated with previous question IDs
                                />
                                <Select
                                    label="Operator"
                                    value={conditionalLogic?.showIf.operator || 'equals'}
                                    onChange={(e) => {
                                        if (conditionalLogic) {
                                            setConditionalLogic({
                                                ...conditionalLogic,
                                                showIf: {
                                                    ...conditionalLogic.showIf,
                                                    operator: e.target.value as any,
                                                },
                                            });
                                        }
                                    }}
                                    options={[
                                        { label: 'Equals', value: 'equals' },
                                        { label: 'Not Equals', value: 'not_equals' },
                                        { label: 'Contains', value: 'contains' },
                                        { label: 'Is Empty', value: 'is_empty' },
                                        { label: 'Is Not Empty', value: 'is_not_empty' },
                                    ]}
                                />
                                {conditionalLogic?.showIf.operator !== 'is_empty' && conditionalLogic?.showIf.operator !== 'is_not_empty' && (
                                    <Input
                                        label="Value"
                                        value={conditionalLogic?.showIf.value || ''}
                                        onChange={(e) => {
                                            if (conditionalLogic) {
                                                setConditionalLogic({
                                                    ...conditionalLogic,
                                                    showIf: {
                                                        ...conditionalLogic.showIf,
                                                        value: e.target.value,
                                                    },
                                                });
                                            }
                                        }}
                                        placeholder="Value to compare..."
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                    <Button onClick={handleSave} className="flex-1" disabled={!questionText.trim()}>
                        Save Question
                    </Button>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// Survey Distribution Modal Component
interface SurveyDistributionModalProps {
    survey: Survey;
    selectedChannels: ('email' | 'in-app' | 'link')[];
    onChannelsChange: (channels: ('email' | 'in-app' | 'link')[]) => void;
    onClose: () => void;
    onDistribute: (survey: Survey) => Promise<void>;
    drawerOnMobile?: boolean;
}

const SurveyDistributionModal: React.FC<SurveyDistributionModalProps> = ({
    survey,
    selectedChannels,
    onChannelsChange,
    onClose,
    onDistribute,
    drawerOnMobile,
}) => {
    const { showToast } = useToast();
    const [isDistributing, setIsDistributing] = useState(false);

    const handleChannelToggle = (channel: 'email' | 'in-app' | 'link') => {
        if (selectedChannels.includes(channel)) {
            onChannelsChange(selectedChannels.filter(c => c !== channel));
        } else {
            onChannelsChange([...selectedChannels, channel]);
        }
    };

    const handleDistribute = async () => {
        if (selectedChannels.length === 0) {
            showToast('Please select at least one distribution channel', 'error');
            return;
        }

        setIsDistributing(true);
        try {
            await onDistribute(survey);
        } finally {
            setIsDistributing(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`Distribute Survey: ${survey.title}`} size="lg" drawerOnMobile={drawerOnMobile}>
            <div className="space-y-6">
                <div>
                    <p className="text-sm text-slate-600 mb-4">
                        Select the channels through which you want to distribute this survey to your target audience.
                    </p>
                    <div className="text-sm text-slate-500 mb-4">
                        <strong>Target Audience:</strong> {survey.targetAudience}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <Checkbox
                            checked={selectedChannels.includes('in-app')}
                            onChange={() => handleChannelToggle('in-app')}
                        />
                        <div className="flex-1">
                            <div className="font-semibold text-slate-900">In-App Notifications</div>
                            <div className="text-sm text-slate-500">Send notifications to members within the platform</div>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <Checkbox
                            checked={selectedChannels.includes('email')}
                            onChange={() => handleChannelToggle('email')}
                        />
                        <div className="flex-1">
                            <div className="font-semibold text-slate-900">Email</div>
                            <div className="text-sm text-slate-500">Send survey invitation via email to target audience</div>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <Checkbox
                            checked={selectedChannels.includes('link')}
                            onChange={() => handleChannelToggle('link')}
                        />
                        <div className="flex-1">
                            <div className="font-semibold text-slate-900">Shareable Link</div>
                            <div className="text-sm text-slate-500">Generate a shareable link that can be distributed manually</div>
                        </div>
                    </label>
                </div>

                {selectedChannels.includes('link') && survey.shareableLink && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="text-sm font-medium text-blue-900 mb-2">Shareable Link:</div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={survey.shareableLink}
                                className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    navigator.clipboard.writeText(survey.shareableLink || '');
                                    showToast('Link copied to clipboard', 'success');
                                }}
                            >
                                <Share2 size={16} />
                            </Button>
                        </div>
                    </div>
                )}

                <div className="flex gap-3 pt-4 border-t">
                    <Button variant="ghost" onClick={onClose} disabled={isDistributing}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDistribute}
                        disabled={isDistributing || selectedChannels.length === 0}
                        className="flex-1"
                    >
                        {isDistributing ? 'Distributing...' : 'Distribute Survey'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
