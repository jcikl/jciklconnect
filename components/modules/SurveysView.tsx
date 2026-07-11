import React, { useState } from 'react';
import { MessageSquare, BarChart2, Plus, ArrowRight, Edit, Trash2, Type, List, Star, CheckSquare, Share2, Send, FileText } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useSurveys } from '../../hooks/useSurveys';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { Input, Textarea, Select } from '../ui/Form';
import { Survey, SurveyQuestion, SurveyResponse } from '../../services/surveysService';
import { formatDate } from '../../utils/dateUtils';
import { SurveyAnalyticsService, SurveyAnalytics, QuestionAnalytics } from '../../services/surveyAnalyticsService';
import { CommunicationService } from '../../services/communicationService';
import { SurveyResponseModal } from './Surveys/SurveyResponseModal';
import { SurveyResultsView } from './Surveys/SurveyResultsView';
import { QuestionEditorModal } from './Surveys/QuestionEditorModal';
import { SurveyDistributionModal } from './Surveys/SurveyDistributionModal';

export const SurveysView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [createModalTab, setCreateModalTab] = useState<'settings' | 'questions'>('settings');
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

    const filteredSurveys = React.useMemo(() => {
        const term = (searchQuery || '').toLowerCase();
        if (!term) return surveys;
        return surveys.filter(survey =>
            (survey.title ?? '').toLowerCase().includes(term) ||
            (survey.description ?? '').toLowerCase().includes(term) ||
            (survey.status ?? '').toLowerCase().includes(term) ||
            (survey.targetAudience ?? '').toLowerCase().includes(term)
        );
    }, [surveys, searchQuery]);

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
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Feedback & Surveys</h2>
                <p className="text-slate-500 text-sm">Pulse checks, satisfaction surveys, and polls.</p>
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
                        <LoadingState loading={loading} error={error} empty={false}>
                            {/* â”€â”€ Desktop table â”€â”€ */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/60">
                                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 w-[35%]">Survey</th>
                                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Audience</th>
                                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Responses</th>
                                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Due</th>
                                            <th className="px-4 py-3 w-48"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {canManage && (
                                            <tr className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => { setCreateModalTab('settings'); setCreateModalOpen(true); }}>
                                                <td className="px-4 py-3" colSpan={4}>
                                                    <div className="flex items-center gap-3 text-slate-400 group-hover:text-jci-blue transition-colors">
                                                        <div className="w-9 h-9 rounded-lg border-2 border-dashed border-current flex items-center justify-center shrink-0">
                                                            <Plus size={16} />
                                                        </div>
                                                        <span className="text-sm font-semibold">New Survey</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3"></td>
                                            </tr>
                                        )}
                                        {filteredSurveys.map(survey => (
                                            <tr key={survey.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant={survey.status === 'Active' ? 'success' : survey.status === 'Closed' ? 'neutral' : 'warning'}>{survey.status}</Badge>
                                                    </div>
                                                    <p className="font-semibold text-slate-900 mt-1 group-hover:text-jci-blue transition-colors">{survey.title}</p>
                                                    {survey.description && <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{survey.description}</p>}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{survey.targetAudience || 'â€”'}</td>
                                                <td className="px-4 py-3">
                                                    <span className="font-semibold text-slate-900">{survey.responsesCount || 0}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500">{formatDate(survey.endDate)}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {survey.status === 'Active' && (
                                                            <button className="inline-flex items-center gap-1 text-xs font-semibold text-jci-blue border border-jci-blue/30 hover:border-jci-blue/60 px-2.5 py-1.5 rounded-lg transition-colors"
                                                                onClick={() => setSelectedSurvey(survey)} disabled={!member}>
                                                                Take <ArrowRight size={12} />
                                                            </button>
                                                        )}
                                                        {survey.status !== 'Active' && (
                                                            <button className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 border border-slate-200 hover:border-slate-300 px-2.5 py-1.5 rounded-lg transition-colors"
                                                                onClick={() => { setAnalyticsSurveyId(survey.id); setActiveTab('results'); loadAnalytics(survey.id); }}>
                                                                <BarChart2 size={12} /> Results
                                                            </button>
                                                        )}
                                                        {canManage && survey.status === 'Draft' && (
                                                            <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-jci-blue transition-colors" title="Publish"
                                                                onClick={async () => { try { await updateSurvey(survey.id, { status: 'Active' }); } catch {} }}>
                                                                <Send size={14} />
                                                            </button>
                                                        )}
                                                        {canManage && survey.status === 'Active' && (
                                                            <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-jci-blue transition-colors" title="Distribute"
                                                                onClick={() => { setDistributingSurvey(survey); setIsDistributeModalOpen(true); }}>
                                                                <Send size={14} />
                                                            </button>
                                                        )}
                                                        {canManage && (
                                                            <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-jci-blue transition-colors" title="Share"
                                                                onClick={() => handleShareSurvey(survey)}>
                                                                <Share2 size={14} />
                                                            </button>
                                                        )}
                                                        {canManage && (
                                                            <button className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Delete"
                                                                onClick={() => { if (window.confirm('Delete this survey?')) deleteSurvey(survey.id); }}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* â”€â”€ Mobile list rows â”€â”€ */}
                            <div className="md:hidden divide-y divide-slate-100">
                                {canManage && (
                                    <div onClick={() => { setCreateModalTab('settings'); setCreateModalOpen(true); }}
                                        className="flex items-center gap-3 px-1 py-3 text-slate-400 hover:text-jci-blue transition-colors cursor-pointer group">
                                        <div className="w-9 h-9 rounded-lg border-2 border-dashed border-current flex items-center justify-center shrink-0">
                                            <Plus size={16} />
                                        </div>
                                        <span className="text-sm font-semibold">New Survey</span>
                                    </div>
                                )}
                                {filteredSurveys.map(survey => (
                                    <div key={survey.id} className="py-3 px-1 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant={survey.status === 'Active' ? 'success' : survey.status === 'Closed' ? 'neutral' : 'warning'}>{survey.status}</Badge>
                                                    <span className="text-[11px] text-slate-400">{survey.responsesCount || 0} responses</span>
                                                    <span className="text-[11px] text-slate-400">Due {formatDate(survey.endDate)}</span>
                                                </div>
                                                <p className="font-semibold text-slate-900 text-sm mt-1">{survey.title}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {survey.status === 'Active' && (
                                                <button className="inline-flex items-center gap-1 text-xs font-semibold text-jci-blue border border-jci-blue/30 px-2.5 py-1.5 rounded-lg"
                                                    onClick={() => setSelectedSurvey(survey)} disabled={!member}>
                                                    Take Survey <ArrowRight size={12} />
                                                </button>
                                            )}
                                            {survey.status !== 'Active' && (
                                                <button className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg"
                                                    onClick={() => { setAnalyticsSurveyId(survey.id); setActiveTab('results'); loadAnalytics(survey.id); }}>
                                                    <BarChart2 size={12} /> View Results
                                                </button>
                                            )}
                                            {canManage && survey.status === 'Draft' && (
                                                <button className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg"
                                                    onClick={async () => { try { await updateSurvey(survey.id, { status: 'Active' }); } catch {} }}>
                                                    <Send size={12} /> Publish
                                                </button>
                                            )}
                                            {canManage && survey.status === 'Active' && (
                                                <button className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg"
                                                    onClick={() => { setDistributingSurvey(survey); setIsDistributeModalOpen(true); }}>
                                                    <Send size={12} /> Distribute
                                                </button>
                                            )}
                                            {canManage && (
                                                <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                                                    onClick={() => handleShareSurvey(survey)}>
                                                    <Share2 size={14} />
                                                </button>
                                            )}
                                            {canManage && (
                                                <button className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                                    onClick={() => { if (window.confirm('Delete this survey?')) deleteSurvey(survey.id); }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
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
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => { setCreateModalOpen(false); setQuestions([]); }}
                title="Create Survey"
                size="lg"
                drawerOnMobile
                footer={
                    <div className="flex gap-3">
                        <Button className="flex-1" type="submit" form="create-survey-form" disabled={questions.length === 0}>
                            Create Survey
                            {questions.length > 0 && (
                                <span className="ml-2 text-[11px] bg-white/20 px-1.5 py-0.5 rounded-full">{questions.length}Q</span>
                            )}
                        </Button>
                        <Button variant="ghost" type="button" onClick={() => { setCreateModalOpen(false); setQuestions([]); }}>Cancel</Button>
                    </div>
                }
            >
                {/* Tabs */}
                <div className="flex border-b border-slate-100 mb-5 -mt-1">
                    <button type="button" onClick={() => setCreateModalTab('settings')}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${createModalTab === 'settings' ? 'border-jci-blue text-jci-blue' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <FileText size={14} /> Settings
                    </button>
                    <button type="button" onClick={() => setCreateModalTab('questions')}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${createModalTab === 'questions' ? 'border-jci-blue text-jci-blue' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <MessageSquare size={14} /> Questions
                        {questions.length > 0 && (
                            <span className="ml-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">{questions.length}</span>
                        )}
                    </button>
                </div>

                <form id="create-survey-form" onSubmit={handleCreateSurvey}>
                    {createModalTab === 'settings' ? (
                        <div className="space-y-4">
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
                            <button type="button" onClick={() => setCreateModalTab('questions')}
                                className="w-full mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-jci-blue border border-jci-blue/30 hover:border-jci-blue/60 hover:bg-sky-50 rounded-xl py-2.5 transition-colors">
                                Next: Add Questions <ArrowRight size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {questions.map((question, index) => (
                                <div key={question.id}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group">
                                    <span className="text-xs font-mono text-slate-400 w-5 shrink-0">{index + 1}</span>
                                    <div className="text-jci-blue shrink-0">{getQuestionIcon(question.type)}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 truncate">{question.question || 'Untitled Question'}</p>
                                        <p className="text-xs text-slate-400">{getQuestionLabel(question.type)}{question.required && ' Â· Required'}</p>
                                    </div>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button type="button" onClick={() => handleEditQuestion(question)}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-jci-blue transition-colors">
                                            <Edit size={13} />
                                        </button>
                                        <button type="button" onClick={() => handleDeleteQuestion(question.id)}
                                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {/* Add Question row */}
                            <button type="button" onClick={handleAddQuestion}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-jci-blue hover:bg-sky-50 transition-colors group mt-1">
                                <div className="w-6 h-6 rounded border-2 border-dashed border-current flex items-center justify-center shrink-0">
                                    <Plus size={12} />
                                </div>
                                <span className="text-sm font-semibold">Add Question</span>
                            </button>
                        </div>
                    )}
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
