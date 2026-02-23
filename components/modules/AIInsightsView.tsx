// AI Insights View - Unified AI predictions, recommendations, and analytics
import React, { useState, useEffect } from 'react';
import { Sparkles, TrendingDown, TrendingUp, Users, Calendar, Target, Heart, AlertTriangle, Lightbulb, BarChart3, RefreshCw, BookOpen } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs, ProgressBar } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useAuth } from '../../hooks/useAuth';
import { useMembers } from '../../hooks/useMembers';
import { useEvents } from '../../hooks/useEvents';
import { useProjects } from '../../hooks/useProjects';
import { ChurnPredictionService, ChurnRiskFactors } from '../../services/churnPredictionService';
import { AIRecommendationService, Recommendation } from '../../services/aiRecommendationService';
import { AIPredictionService, EventDemandPrediction, ProjectSuccessPrediction } from '../../services/aiPredictionService';
import { formatDate } from '../../utils/dateUtils';

interface AIInsightsViewProps {
    onNavigate?: (view: string) => void;
}

export const AIInsightsView: React.FC<AIInsightsViewProps> = ({ onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'churn' | 'recommendations' | 'predictions'>('churn');
    const [churnData, setChurnData] = useState<Array<{ member: any; risk: ChurnRiskFactors }>>([]);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [eventPredictions, setEventPredictions] = useState<EventDemandPrediction[]>([]);
    const [projectPredictions, setProjectPredictions] = useState<ProjectSuccessPrediction[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const { member: currentMember } = useAuth();
    const { members } = useMembers();
    const { events } = useEvents();
    const { projects } = useProjects();
    const { showToast } = useToast();

    useEffect(() => {
        if (activeTab === 'churn') {
            loadChurnPredictions();
        } else if (activeTab === 'recommendations' && currentMember) {
            loadRecommendations();
        } else if (activeTab === 'predictions') {
            loadPredictions();
        }
    }, [activeTab, currentMember]);

    const loadChurnPredictions = async () => {
        setLoading(true);
        try {
            const membersAtRisk = await ChurnPredictionService.getMembersAtRisk('Medium');
            setChurnData(membersAtRisk.map(m => ({ member: m, risk: m.churnRisk })));
        } catch (err) {
            showToast('Failed to load churn predictions', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadRecommendations = async () => {
        if (!currentMember) return;
        setLoading(true);
        try {
            // Use AIPredictionService for personalized recommendations (more comprehensive)
            const personalizedRecs = await AIPredictionService.getPersonalizedRecommendations(currentMember.id, 10);
            // Convert to Recommendation format for compatibility
            const recs: Recommendation[] = personalizedRecs
                .filter(rec => rec.type !== 'business_opportunity') // Filter out unsupported types
                .map(rec => ({
                    type: rec.type === 'hobby_club' ? 'club' : rec.type === 'mentorship' ? 'mentor' :
                        rec.type === 'project' ? 'project' : rec.type === 'event' ? 'event' :
                            rec.type === 'training' ? 'training' : rec.type === 'role' ? 'role' : 'club',
                    id: rec.itemId,
                    title: rec.itemName,
                    description: rec.reasons.join('. '),
                    reason: rec.reasons.join('. '),
                    score: rec.matchScore,
                    metadata: rec.metadata,
                }));
            setRecommendations(recs);
        } catch (err) {
            // Fallback to AIRecommendationService if AIPredictionService fails
            try {
                const recs = await AIRecommendationService.getRecommendations(currentMember.id);
                setRecommendations(recs);
            } catch (fallbackErr) {
                showToast('Failed to load recommendations', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const loadPredictions = async () => {
        setLoading(true);
        try {
            // Load event demand predictions
            const upcomingEvents = events.filter(e => {
                const eventDate = new Date(e.date);
                return eventDate >= new Date() && e.status === 'Upcoming';
            });
            const eventPreds = await Promise.all(
                upcomingEvents.slice(0, 5).map(e =>
                    AIPredictionService.predictEventDemand(e.type, e.date, e.location)
                )
            );
            setEventPredictions(eventPreds);

            // Load project success predictions
            const activeProjects = projects.filter(p => p.status === 'Active');
            const projectPreds = await Promise.all(
                activeProjects.slice(0, 5).map(p =>
                    AIPredictionService.predictProjectSuccess(p.id)
                )
            );
            setProjectPredictions(projectPreds);
        } catch (err) {
            showToast('Failed to load predictions', 'error');
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (riskLevel: string) => {
        switch (riskLevel) {
            case 'High': return 'text-red-600 bg-red-50 border-red-200';
            case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            case 'Low': return 'text-green-600 bg-green-50 border-green-200';
            default: return 'text-slate-600 bg-slate-50 border-slate-200';
        }
    };

    const getRecommendationIcon = (type: Recommendation['type']) => {
        switch (type) {
            case 'project': return <Target size={20} />;
            case 'event': return <Calendar size={20} />;
            case 'training': return <BookOpen size={20} />;
            case 'mentor': return <Users size={20} />;
            case 'club': return <Heart size={20} />;
            case 'role': return <TrendingUp size={20} />;
            default: return <Lightbulb size={20} />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">AI Insights & Predictions</h2>
                    <p className="text-slate-500">Intelligent analytics, predictions, and personalized recommendations.</p>
                </div>
                <Button variant="outline" onClick={() => {
                    if (activeTab === 'churn') loadChurnPredictions();
                    else if (activeTab === 'recommendations') loadRecommendations();
                    else loadPredictions();
                }}>
                    <RefreshCw size={16} className="mr-2" /> Refresh
                </Button>
            </div>

            <Card noPadding>
                <div className="px-4 md:px-6 pt-4">
                    <Tabs
                        tabs={['Churn Prediction', 'Personalized Recommendations', 'Event & Project Predictions']}
                        activeTab={
                            activeTab === 'churn' ? 'Churn Prediction' :
                                activeTab === 'recommendations' ? 'Personalized Recommendations' :
                                    'Event & Project Predictions'
                        }
                        onTabChange={(tab) => {
                            if (tab === 'Churn Prediction') setActiveTab('churn');
                            else if (tab === 'Personalized Recommendations') setActiveTab('recommendations');
                            else setActiveTab('predictions');
                        }}
                    />
                </div>
                <div className="p-4">
                    {activeTab === 'churn' && (
                        <ChurnPredictionView
                            churnData={churnData}
                            loading={loading}
                            onSelectMember={setSelectedMemberId}
                        />
                    )}
                    {activeTab === 'recommendations' && (
                        <RecommendationsView
                            recommendations={recommendations}
                            loading={loading}
                            currentMember={currentMember}
                            onNavigate={onNavigate}
                        />
                    )}
                    {activeTab === 'predictions' && (
                        <PredictionsView
                            eventPredictions={eventPredictions}
                            projectPredictions={projectPredictions}
                            loading={loading}
                            projects={projects}
                            events={events}
                            onNavigate={onNavigate}
                        />
                    )}
                </div>
            </Card>

            {selectedMemberId && (
                <MemberChurnDetailModal
                    memberId={selectedMemberId}
                    onClose={() => setSelectedMemberId(null)}
                    drawerOnMobile
                />
            )}
        </div>
    );
};

// Churn Prediction View Component
const ChurnPredictionView: React.FC<{
    churnData: Array<{ member: any; risk: ChurnRiskFactors }>;
    loading: boolean;
    onSelectMember: (memberId: string) => void;
}> = ({ churnData, loading, onSelectMember }) => {
    const highRisk = churnData.filter(d => d.risk.riskLevel === 'High');
    const mediumRisk = churnData.filter(d => d.risk.riskLevel === 'Medium');
    const lowRisk = churnData.filter(d => d.risk.riskLevel === 'Low');

    return (
        <LoadingState loading={loading} error={null} empty={churnData.length === 0} emptyMessage="No members at risk identified">
            <div className="space-y-6">
                {/* Risk Summary */}
                <StatCardsContainer>
                    <Card>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">{highRisk.length}</div>
                            <div className="text-sm text-slate-500">High Risk</div>
                        </div>
                    </Card>
                    <Card>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-600">{mediumRisk.length}</div>
                            <div className="text-sm text-slate-500">Medium Risk</div>
                        </div>
                    </Card>
                    <Card>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{lowRisk.length}</div>
                            <div className="text-sm text-slate-500">Low Risk</div>
                        </div>
                    </Card>
                </StatCardsContainer>

                {/* Members at Risk */}
                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Members at Risk</h3>
                    <div className="space-y-3">
                        {churnData.map(({ member, risk }) => (
                            <Card
                                key={member.id}
                                className="hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => onSelectMember(member.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-full" />
                                        <div>
                                            <h4 className="font-bold text-slate-900">{member.name}</h4>
                                            <p className="text-sm text-slate-500">{member.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-sm text-slate-500">Risk Score</div>
                                            <div className="text-lg font-bold text-slate-900">{risk.riskScore}</div>
                                        </div>
                                        <Badge variant={risk.riskLevel === 'High' ? 'error' : risk.riskLevel === 'Medium' ? 'warning' : 'success'}>
                                            {risk.riskLevel} Risk
                                        </Badge>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t">
                                    <div className="grid grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-500">Attendance:</span>
                                            <span className="ml-2 font-medium">{risk.attendanceRate}%</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Days Since Last Event:</span>
                                            <span className="ml-2 font-medium">{risk.daysSinceLastEvent}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Dues Status:</span>
                                            <span className="ml-2 font-medium">{risk.duesStatus}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Engagement Score:</span>
                                            <span className="ml-2 font-medium">{risk.engagementScore}</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </LoadingState>
    );
};

// Recommendations View Component
const RecommendationsView: React.FC<{
    recommendations: Recommendation[];
    loading: boolean;
    currentMember: any;
    onNavigate?: (view: string) => void;
}> = ({ recommendations, loading, currentMember, onNavigate }) => {
    if (!currentMember) {
        return (
            <div className="text-center py-10 text-slate-400">
                <Users className="mx-auto mb-4 text-slate-300" size={48} />
                <p>Please log in to view personalized recommendations</p>
            </div>
        );
    }

    const getRecommendationIcon = (type: Recommendation['type']) => {
        switch (type) {
            case 'project': return <Target size={20} />;
            case 'event': return <Calendar size={20} />;
            case 'training': return <BookOpen size={20} />;
            case 'mentor': return <Users size={20} />;
            case 'club': return <Heart size={20} />;
            case 'role': return <TrendingUp size={20} />;
            default: return <Lightbulb size={20} />;
        }
    };

    const groupedRecs = recommendations.reduce((acc, rec) => {
        if (!acc[rec.type]) acc[rec.type] = [];
        acc[rec.type].push(rec);
        return acc;
    }, {} as Record<string, Recommendation[]>);

    return (
        <LoadingState loading={loading} error={null} empty={recommendations.length === 0} emptyMessage="No recommendations available at this time">
            <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                    <div className="flex items-center gap-3 mb-2">
                        <Sparkles className="text-blue-600" size={24} />
                        <h3 className="text-lg font-bold text-slate-900">Personalized for {currentMember.name}</h3>
                    </div>
                    <p className="text-sm text-slate-600">
                        Based on your profile, engagement history, and preferences, here are recommendations tailored for you.
                    </p>
                </div>

                {Object.entries(groupedRecs).map(([type, recs]) => (
                    <div key={type}>
                        <h4 className="text-md font-bold text-slate-900 mb-3 capitalize">{type} Recommendations</h4>
                        <div className="grid md:grid-cols-2 gap-4">
                            {recs.map(rec => (
                                <Card key={rec.id} className="hover:shadow-md transition-shadow">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                            {getRecommendationIcon(rec.type)}
                                        </div>
                                        <div className="flex-1">
                                            <h5 className="font-bold text-slate-900 mb-1">{rec.title}</h5>
                                            <p className="text-sm text-slate-600 mb-2">{rec.description}</p>
                                            <p className="text-xs text-blue-600 mb-3">{rec.reason}</p>
                                            <div className="flex items-center justify-between">
                                                <Badge variant="info">Score: {rec.score}</Badge>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        if (onNavigate) {
                                                            switch (rec.type) {
                                                                case 'project':
                                                                    onNavigate('PROJECTS');
                                                                    break;
                                                                case 'event':
                                                                    onNavigate('EVENTS');
                                                                    break;
                                                                case 'training':
                                                                case 'mentor':
                                                                    onNavigate('KNOWLEDGE');
                                                                    break;
                                                                case 'club':
                                                                    onNavigate('CLUBS');
                                                                    break;
                                                                case 'role':
                                                                    onNavigate('MEMBERS');
                                                                    break;
                                                            }
                                                        }
                                                    }}
                                                >
                                                    View Details
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </LoadingState>
    );
};

// Predictions View Component
const PredictionsView: React.FC<{
    eventPredictions: EventDemandPrediction[];
    projectPredictions: ProjectSuccessPrediction[];
    loading: boolean;
    projects?: any[];
    events?: any[];
    onNavigate?: (view: string) => void;
}> = ({ eventPredictions, projectPredictions, loading, projects = [], events = [], onNavigate }) => {
    return (
        <LoadingState loading={loading} error={null} empty={eventPredictions.length === 0 && projectPredictions.length === 0} emptyMessage="No predictions available">
            <div className="space-y-6">
                {/* Event Demand Predictions */}
                {eventPredictions.length > 0 && (
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Event Demand Predictions</h3>
                        <div className="space-y-4">
                            {eventPredictions.map((pred, index) => {
                                const relatedEvent = events.find(e => e.type === pred.eventType);
                                return (
                                    <Card key={index}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="font-bold text-slate-900">
                                                    {relatedEvent ? relatedEvent.title : pred.eventType}
                                                </h4>
                                                <p className="text-sm text-slate-500">
                                                    Predicted Attendance: <strong>{pred.predictedAttendance}</strong> members
                                                </p>
                                                {pred.optimalDate && (
                                                    <p className="text-xs text-blue-600 mt-1">
                                                        Optimal Date: {formatDate(new Date(pred.optimalDate))}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm text-slate-500">Confidence</div>
                                                <div className="text-lg font-bold text-slate-900">{pred.confidence}%</div>
                                            </div>
                                        </div>
                                        <div className="space-y-2 mb-4">
                                            <div className="flex justify-between text-xs text-slate-600">
                                                <span>Historical Average: {pred.factors.historicalAverage}</span>
                                                <span>Member Interest: {pred.factors.memberInterest}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-slate-600">
                                                <span>Time Factor: {pred.factors.timeOfYear.toFixed(1)}x</span>
                                                <span>Competing Events: {pred.factors.competingEvents}</span>
                                            </div>
                                        </div>
                                        {pred.recommendations.length > 0 && (
                                            <div className="pt-4 border-t">
                                                <div className="text-xs font-medium text-slate-700 mb-2">Recommendations:</div>
                                                <ul className="space-y-1">
                                                    {pred.recommendations.map((rec, idx) => (
                                                        <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                                                            <Lightbulb size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                                                            {rec}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Project Success Predictions */}
                {projectPredictions.length > 0 && (
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Project Success Predictions</h3>
                        <div className="space-y-4">
                            {projectPredictions.map((pred) => {
                                const relatedProject = projects.find(p => p.id === pred.projectId);
                                return (
                                    <Card key={pred.projectId}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="font-bold text-slate-900">
                                                    {relatedProject ? relatedProject.name : `Project ${pred.projectId}`}
                                                </h4>
                                                <p className="text-sm text-slate-500">
                                                    Success Probability: <strong>{pred.successProbability}%</strong>
                                                </p>
                                                {pred.predictedCompletionDate && (
                                                    <p className="text-xs text-blue-600 mt-1">
                                                        Predicted Completion: {formatDate(new Date(pred.predictedCompletionDate))}
                                                    </p>
                                                )}
                                            </div>
                                            <Badge variant={pred.riskLevel === 'Low' ? 'success' : pred.riskLevel === 'Medium' ? 'warning' : 'error'}>
                                                {pred.riskLevel} Risk
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-5 gap-2 mb-4">
                                            {Object.entries(pred.factors).map(([key, value]) => (
                                                <div key={key} className="text-center">
                                                    <div className="text-xs text-slate-500 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                                                    <ProgressBar progress={value} color="bg-jci-blue" />
                                                    <div className="text-xs font-medium text-slate-700 mt-1">{value}%</div>
                                                </div>
                                            ))}
                                        </div>
                                        {pred.risks.length > 0 && (
                                            <div className="pt-4 border-t mb-4">
                                                <div className="text-xs font-medium text-slate-700 mb-2">Identified Risks:</div>
                                                <ul className="space-y-2">
                                                    {pred.risks.map((risk, idx) => (
                                                        <li key={idx} className="text-xs">
                                                            <div className="flex items-start gap-2">
                                                                <AlertTriangle
                                                                    size={14}
                                                                    className={`mt-0.5 flex-shrink-0 ${risk.severity === 'High' ? 'text-red-500' :
                                                                        risk.severity === 'Medium' ? 'text-yellow-500' :
                                                                            'text-blue-500'
                                                                        }`}
                                                                />
                                                                <div>
                                                                    <div className="font-medium text-slate-700">{risk.description}</div>
                                                                    <div className="text-slate-500 mt-1">Mitigation: {risk.mitigation}</div>
                                                                </div>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {pred.recommendations.length > 0 && (
                                            <div className="pt-4 border-t">
                                                <div className="text-xs font-medium text-slate-700 mb-2">Recommendations:</div>
                                                <ul className="space-y-1">
                                                    {pred.recommendations.map((rec, idx) => (
                                                        <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                                                            <Lightbulb size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                                                            {rec}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </LoadingState>
    );
};

const MemberChurnDetailModal: React.FC<{
    memberId: string;
    onClose: () => void;
    drawerOnMobile?: boolean;
}> = ({ memberId, onClose, drawerOnMobile }) => {
    const [risk, setRisk] = useState<ChurnRiskFactors | null>(null);
    const [loading, setLoading] = useState(true);
    const { members } = useMembers();
    const member = members.find(m => m.id === memberId);

    useEffect(() => {
        if (memberId) {
            loadRiskDetails();
        }
    }, [memberId]);

    const loadRiskDetails = async () => {
        setLoading(true);
        try {
            const riskData = await ChurnPredictionService.predictChurnRisk(memberId);
            setRisk(riskData);
        } catch (err) {
            console.error('Failed to load risk details:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!member) return null;

    return (
        <Modal isOpen={true} onClose={onClose} title={`Churn Risk Analysis: ${member.name}`} size="lg" drawerOnMobile={drawerOnMobile}>
            {loading ? (
                <div className="text-center py-10">Loading risk analysis...</div>
            ) : risk ? (
                <div className="space-y-6">
                    {/* Risk Summary */}
                    <div className="bg-gradient-to-r from-red-50 to-yellow-50 rounded-lg p-6 border-2 border-red-200">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="text-sm text-slate-500 mb-1">Risk Level</div>
                                <div className="text-2xl font-bold text-slate-900">{risk.riskLevel} Risk</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-slate-500 mb-1">Risk Score</div>
                                <div className="text-3xl font-bold text-red-600">{risk.riskScore}</div>
                            </div>
                        </div>
                        <ProgressBar progress={risk.riskScore} color="bg-red-500" />
                    </div>

                    {/* Risk Factors */}
                    <div>
                        <h4 className="font-bold text-slate-900 mb-4">Risk Factors</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Card>
                                <div className="text-sm text-slate-500 mb-1">Attendance Rate</div>
                                <div className="text-xl font-bold text-slate-900">{risk.attendanceRate}%</div>
                            </Card>
                            <Card>
                                <div className="text-sm text-slate-500 mb-1">Days Since Last Event</div>
                                <div className="text-xl font-bold text-slate-900">{risk.daysSinceLastEvent}</div>
                            </Card>
                            <Card>
                                <div className="text-sm text-slate-500 mb-1">Dues Status</div>
                                <div className="text-xl font-bold text-slate-900">{risk.duesStatus}</div>
                            </Card>
                            <Card>
                                <div className="text-sm text-slate-500 mb-1">Engagement Score</div>
                                <div className="text-xl font-bold text-slate-900">{risk.engagementScore}</div>
                            </Card>
                        </div>
                    </div>

                    {/* Recommendations */}
                    {risk.recommendations.length > 0 && (
                        <div>
                            <h4 className="font-bold text-slate-900 mb-4">Recommended Actions</h4>
                            <div className="space-y-2">
                                {risk.recommendations.map((rec, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                                        <Lightbulb size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-slate-700">{rec}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-10 text-slate-400">Failed to load risk analysis</div>
            )}
        </Modal>
    );
};

