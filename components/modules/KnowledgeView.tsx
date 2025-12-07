import React from 'react';
import { BookOpen, FileText, Download, Award, PlayCircle } from 'lucide-react';
import { Card, Button, ProgressBar, Badge, Tabs } from '../ui/Common';
import { MOCK_TRAININGS, MOCK_DOCUMENTS } from '../../services/mockData';

export const KnowledgeView: React.FC = () => {
    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Knowledge & Learning</h2>
                    <p className="text-slate-500">Training, certifications, and document archives.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline"><FileText size={16} className="mr-2"/> Manage Docs</Button>
                    <Button><BookOpen size={16} className="mr-2"/> Course Catalog</Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Training Section */}
                <div className="lg:col-span-2 space-y-6">
                    <Card title="My Learning Path">
                        <div className="grid gap-4">
                            {MOCK_TRAININGS.map(module => (
                                <div key={module.id} className="flex flex-col sm:flex-row gap-4 p-4 border border-slate-100 rounded-xl hover:border-jci-blue transition-colors group">
                                    <div className="w-full sm:w-32 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 flex-shrink-0">
                                        <PlayCircle size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <Badge variant={module.type === 'JCI Official' ? 'jci' : 'neutral'}>{module.type}</Badge>
                                                <h4 className="font-bold text-slate-900 mt-1">{module.title}</h4>
                                            </div>
                                            {module.completionStatus === 'Completed' ? (
                                                <Badge variant="success">Completed</Badge>
                                            ) : (
                                                <span className="text-xs text-slate-500">{module.duration}</span>
                                            )}
                                        </div>
                                        
                                        <div className="mt-3">
                                            {module.completionStatus === 'Completed' ? (
                                                <div className="flex items-center text-xs text-green-600 font-medium">
                                                    <Award size={14} className="mr-1" /> Certified - Earned {module.pointsReward} pts
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                     <div className="flex justify-between text-xs text-slate-500">
                                                        <span>Progress</span>
                                                        <span>{module.completionStatus === 'In Progress' ? '45%' : '0%'}</span>
                                                     </div>
                                                     <ProgressBar progress={module.completionStatus === 'In Progress' ? 45 : 0} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end sm:justify-center">
                                        <Button size="sm" variant={module.completionStatus === 'Completed' ? 'outline' : 'primary'}>
                                            {module.completionStatus === 'Completed' ? 'Review' : 'Start'}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Documents Section */}
                <div className="space-y-6">
                    <Card title="Document Repository">
                        <div className="space-y-1">
                            {MOCK_DOCUMENTS.map(doc => (
                                <div key={doc.id} className="p-3 hover:bg-slate-50 rounded-lg flex items-center justify-between group cursor-pointer transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="p-2 bg-blue-50 text-jci-blue rounded">
                                            <FileText size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                                            <p className="text-xs text-slate-500">{doc.category} • {doc.size}</p>
                                        </div>
                                    </div>
                                    <button className="text-slate-300 group-hover:text-jci-blue">
                                        <Download size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" className="w-full mt-4 text-sm">View All Files</Button>
                    </Card>

                    <Card className="bg-slate-900 text-white">
                        <h4 className="font-bold mb-2">JCI Brand Center</h4>
                        <p className="text-sm text-slate-300 mb-4">Access official logos, fonts, and presentation templates.</p>
                        <Button size="sm" className="w-full bg-white text-slate-900 hover:bg-slate-100">Access Assets</Button>
                    </Card>
                </div>
            </div>
        </div>
    );
};
