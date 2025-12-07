import React from 'react';
import { MessageSquare, BarChart2, Plus, ArrowRight } from 'lucide-react';
import { Card, Button, Badge } from '../ui/Common';
import { MOCK_SURVEYS } from '../../services/mockData';

export const SurveysView: React.FC = () => {
    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Feedback & Surveys</h2>
                    <p className="text-slate-500">Pulse checks, satisfaction surveys, and polls.</p>
                </div>
                <Button><Plus size={16} className="mr-2"/> Create Survey</Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {MOCK_SURVEYS.map(survey => (
                    <Card key={survey.id} className="flex flex-col h-full hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <Badge variant={survey.status === 'Active' ? 'success' : 'neutral'}>{survey.status}</Badge>
                            <span className="text-xs text-slate-500">Due {new Date(survey.deadline).toLocaleDateString()}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">{survey.title}</h3>
                        <p className="text-sm text-slate-600 mb-6 flex-1">{survey.description}</p>
                        
                        <div className="bg-slate-50 rounded-lg p-3 mb-4 flex items-center justify-between">
                             <div className="text-xs text-slate-500">
                                 <span className="block font-semibold text-slate-700">{survey.responses}</span>
                                 Responses
                             </div>
                             <div className="text-xs text-slate-500 text-right">
                                 <span className="block font-semibold text-slate-700">{survey.targetAudience}</span>
                                 Audience
                             </div>
                        </div>

                        <div className="flex gap-3">
                            {survey.status === 'Active' ? (
                                <Button className="w-full">Take Survey <ArrowRight size={14} className="ml-2"/></Button>
                            ) : (
                                <Button variant="outline" className="w-full"><BarChart2 size={14} className="mr-2"/> View Results</Button>
                            )}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};