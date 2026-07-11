// AI Insights View - Unified AI predictions, recommendations, and analytics
import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Calendar, Target, AlertTriangle, Lightbulb, RefreshCw, BookOpen } from 'lucide-react';
import { Card, Button, Badge, useToast, ProgressBar } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useEvents } from '../../hooks/useEvents';
import { useProjects } from '../../hooks/useProjects';
import { AIPredictionService, EventDemandPrediction, ProjectSuccessPrediction } from '../../services/aiPredictionService';
import { formatDate } from '../../utils/dateUtils';

interface AIInsightsViewProps {
    onNavigate?: (view: string) => void;
    searchQuery?: string;
}

export const AIInsightsView: React.FC<AIInsightsViewProps> = ({ onNavigate, searchQuery }) => {
    const [eventPredictions, setEventPredictions] = useState<EventDemandPrediction[]>([]);
    const [projectPredictions, setProjectPredictions] = useState<ProjectSuccessPrediction[]>([]);
    const [loading, setLoading] = useState(false);
    const { events } = useEvents();
    const { projects } = useProjects();
    const { showToast } = useToast();

    useEffect(() => {
        loadPredictions();
    }, []);

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

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">AI Insights & Predictions</h2>
                    <p className="text-slate-500">Intelligent analytics and event & project predictions.</p>
                </div>
                <Button variant="outline" onClick={loadPredictions}>
                    <RefreshCw size={16} className="mr-2" /> Refresh
                </Button>
            </div>

            <PredictionsView
                eventPredictions={eventPredictions}
                projectPredictions={projectPredictions}
                loading={loading}
                projects={projects}
                events={events}
                onNavigate={onNavigate}
                searchQuery={searchQuery}
            />
        </div>
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
    searchQuery?: string;
}> = ({ eventPredictions, projectPredictions, loading, projects = [], events = [], onNavigate, searchQuery }) => {
    const term = (searchQuery || '').toLowerCase();

    // Filter project predictions by name
    const filteredProjectPredictions = term
        ? projectPredictions.filter(pred => {
            const relatedProject = projects.find(p => p.id === pred.projectId);
            return (relatedProject?.name ?? '').toLowerCase().includes(term);
        })
        : projectPredictions;

    // Filter event predictions by title
    const filteredEventPredictions = term
        ? eventPredictions.filter(pred => {
            const relatedEvent = events.find(e => e.type === pred.eventType);
            return (relatedEvent?.title ?? pred.eventType).toLowerCase().includes(term);
        })
        : eventPredictions;

    return (
        <LoadingState loading={loading} error={null} empty={filteredEventPredictions.length === 0 && filteredProjectPredictions.length === 0} emptyMessage="No predictions available">
            <div className="space-y-6">
                {/* Event Demand Predictions */}
                {filteredEventPredictions.length > 0 && (
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Event Demand Predictions</h3>
                        <div className="space-y-4">
                            {filteredEventPredictions.map((pred, index) => {
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
                {filteredProjectPredictions.length > 0 && (
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Project Success Predictions</h3>
                        <div className="space-y-4">
                            {filteredProjectPredictions.map((pred) => {
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



