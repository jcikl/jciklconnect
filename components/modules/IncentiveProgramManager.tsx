import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, useToast, Modal, ProgressBar } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { PointsService } from '../../services/pointsService';
import { IncentiveProgram, IncentiveStandard, IncentiveLogicId } from '../../types';
import { Save, RefreshCw, Star, Settings, Plus, Trash2, Edit, List, Zap, ClipboardList } from 'lucide-react';
import { IncentiveCalculatorService } from '../../services/incentiveCalculatorService';
import { StandardBatchImportModal } from './Incentive/StandardBatchImportModal';

export const IncentiveProgramManager: React.FC = () => {
    const [program, setProgram] = useState<IncentiveProgram | null>(null);
    const [standards, setStandards] = useState<IncentiveStandard[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCalculating, setIsCalculating] = useState(false);
    const { showToast } = useToast();

    // Modal State
    const [isStandardModalOpen, setStandardModalOpen] = useState(false);
    const [isBatchImportOpen, setBatchImportOpen] = useState(false);
    const [editingStandard, setEditingStandard] = useState<IncentiveStandard | null>(null);
    const [standardFormData, setStandardFormData] = useState<Partial<IncentiveStandard>>({
        title: '',
        remarks: '',
        category: 'efficient',
        targetType: 'MEMBER',
        order: 1,
        verificationType: 'HYBRID',
        evidenceRequirements: [],
        milestones: [],
        isTiered: false
    });

    useEffect(() => {
        loadActiveProgram();
    }, []);

    const loadActiveProgram = async () => {
        setLoading(true);
        try {
            const active = await PointsService.getActiveProgram();
            setProgram(active);
            if (active) {
                const stds = await PointsService.getStandards(active.id);
                setStandards(stds);
            }
        } catch (err) {
            showToast('Failed to load program configuration', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateKPI = (categoryKey: string, minScore: number) => {
        if (!program) return;
        setProgram({
            ...program,
            categories: {
                ...program.categories,
                [categoryKey]: {
                    ...program.categories[categoryKey],
                    minScore
                }
            }
        });
    };

    const handleSave = async () => {
        if (!program) return;
        try {
            // Update the program object in Firestore (KPIs)
            await PointsService.createIncentiveProgram(program);
            showToast(`KPI thresholds for ${program.year} updated successfully!`, 'success');
        } catch (err) {
            showToast('Failed to update KPI thresholds', 'error');
        }
    };

    const handleOpenStandardModal = (std?: IncentiveStandard, category?: string) => {
        if (std) {
            setEditingStandard(std);
            setStandardFormData(std);
        } else {
            setEditingStandard(null);
            setStandardFormData({
                programId: program?.id,
                title: '',
                remarks: '',
                category: category || 'efficient',
                targetType: 'MEMBER',
                order: (standards.filter(s => s.category === category).length + 1),
                verificationType: 'HYBRID',
                evidenceRequirements: [],
                milestones: [],
                isTiered: false
            });
        }
        setStandardModalOpen(true);
    };

    const addMilestone = () => {
        const currentMilestones = standardFormData.milestones || [];
        setStandardFormData({
            ...standardFormData,
            milestones: [...currentMilestones, {
                id: `ms_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                label: '',
                points: 0,
                deadline: '',
                activityType: '',
                minParticipants: 0
            }]
        });
    };

    const removeMilestone = (index: number) => {
        const currentMilestones = [...(standardFormData.milestones || [])];
        currentMilestones.splice(index, 1);
        setStandardFormData({
            ...standardFormData,
            milestones: currentMilestones
        });
    };

    const updateMilestone = (index: number, field: string, value: any) => {
        const currentMilestones = [...(standardFormData.milestones || [])];
        currentMilestones[index] = { ...currentMilestones[index], [field]: value };
        setStandardFormData({
            ...standardFormData,
            milestones: currentMilestones
        });
    };

    const handleSaveStandard = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await PointsService.saveStandard({
                ...standardFormData,
                programId: program?.id
            } as any);
            showToast('Standard saved successfully!', 'success');
            setStandardModalOpen(false);
            loadActiveProgram();
        } catch (err) {
            showToast('Failed to save standard', 'error');
        }
    };

    const handleDeleteStandard = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this standard?')) return;
        try {
            await PointsService.deleteStandard(id);
            showToast('Standard deleted', 'success');
            loadActiveProgram();
        } catch (err) {
            showToast('Failed to delete standard', 'error');
        }
    };

    const handleRecalculateAll = async () => {
        if (!program) return;
        setIsCalculating(true);
        try {
            // In recruitment MVP, we use DEFAULT_LO_ID
            const loId = (window as any).currentUserMember?.loId || 'default-lo';
            await IncentiveCalculatorService.calculateAll(loId, program.id);
            showToast('Automated scores recalculated successfully!', 'success');
            loadActiveProgram();
        } catch (err) {
            showToast('Error during automated calculation', 'error');
        } finally {
            setIsCalculating(false);
        }
    };

    const handleInitialize = async () => {
        setLoading(true);
        try {
            const defaultProgram = {
                year: new Date().getFullYear(),
                name: `${new Date().getFullYear()} JCI Incentive Program`,
                isActive: true,
                categories: {
                    efficient: { label: 'Efficient Star', minScore: 100, isFundamental: true },
                    network: { label: 'Network Star', minScore: 250 },
                    experience: { label: 'Experience Star', minScore: 250 },
                    outreach: { label: 'Outreach Star', minScore: 250 },
                    impact: { label: 'Impact Star', minScore: 250 }
                },
                specialAwards: [
                    { name: 'Best of the Best', criteria: ['5 Stars', 'Growth > 10%'] }
                ]
            };

            await PointsService.createIncentiveProgram(defaultProgram);
            showToast('Incentive program initialized successfully!', 'success');
            loadActiveProgram();
        } catch (err) {
            showToast('Failed to initialize program', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading Configuration...</div>;

    if (!program) return (
        <div className="p-12 text-center max-w-md mx-auto">
            <div className="bg-slate-50 rounded-2xl p-8 border-2 border-dashed border-slate-200">
                <Settings size={48} className="mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">No Active Program Found</h3>
                <p className="text-slate-500 mb-6 text-sm">
                    No active incentive program was found for the current cycle. Admin needs to initialize a program to start tracking KPIs.
                </p>
                <Button onClick={handleInitialize} className="w-full">
                    Initialize {new Date().getFullYear()} Program
                </Button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">{program.year} LO Star KPI Configuration</h2>
                    <p className="text-slate-500">Set the minimum point thresholds required to unlock each star level.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setBatchImportOpen(true)}>
                        <ClipboardList size={16} className="mr-2" /> Batch Import
                    </Button>
                    <Button variant="outline" onClick={handleRecalculateAll} isLoading={isCalculating}>
                        <Zap size={16} className="mr-2 text-yellow-500" /> Recalculate Scores
                    </Button>
                    <Button variant="outline" onClick={loadActiveProgram}>
                        <RefreshCw size={16} className="mr-2" /> Reload
                    </Button>
                    <Button onClick={handleSave}>
                        <Save size={16} className="mr-2" /> Save Changes
                    </Button>
                </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(program.categories).map(([key, cat]) => (
                    <Card key={key} title={
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                                <Star size={18} className={cat.isFundamental ? "text-indigo-500 fill-current" : "text-yellow-500 fill-current"} />
                                <span>{cat.label}</span>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => handleOpenStandardModal(undefined, key)}>
                                <Plus size={14} />
                            </Button>
                        </div>
                    }>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Star Threshold (KPI Points)</label>
                                <Input
                                    type="number"
                                    value={cat.minScore}
                                    onChange={(e) => handleUpdateKPI(key, parseInt(e.target.value) || 0)}
                                    placeholder="e.g. 250"
                                />
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Standards Configuration</label>
                                <div className="space-y-2 mb-4">
                                    {standards.filter(s => s.category === key).map(std => (
                                        <div key={std.id} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 group">
                                            <div className="truncate flex-1 pr-2">
                                                <p className="text-xs font-semibold text-slate-700 truncate">{std.title}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">
                                                    {std.milestones?.length ? `${std.milestones.reduce((acc, m) => acc + m.points, 0)} pts total` : '0 pts'}
                                                </p>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenStandardModal(std)} className="p-1 hover:text-jci-blue"><Edit size={12} /></button>
                                                <button onClick={() => handleDeleteStandard(std.id!)} className="p-1 hover:text-red-500"><Trash2 size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {standards.filter(s => s.category === key).length === 0 && (
                                        <p className="text-xs text-slate-400 italic text-center py-2">No standards added yet.</p>
                                    )}
                                </div>


                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                <span className="text-xs text-slate-500">Requirement Type:</span>
                                <Badge variant={cat.isFundamental ? "jci" : "neutral"}>
                                    {cat.isFundamental ? "Fundamental" : "Standard Star"}
                                </Badge>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <Card title="Program Details">
                <div className="grid md:grid-cols-2 gap-4">
                    <Input label="Program Name" value={program.name} readOnly />
                    <Input label="Year" value={program.year} readOnly />
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                    <RefreshCw size={14} />
                    <span>Last automated sync: {new Date().toLocaleDateString()}</span>
                </div>
            </Card>

            {/* Standard Configuration Modal */}
            <Modal
                isOpen={isStandardModalOpen}
                onClose={() => setStandardModalOpen(false)}
                title={editingStandard ? 'Edit Standard' : 'Add New Standard'}
                size="lg"
            >
                <form onSubmit={handleSaveStandard} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Standard Title"
                            value={standardFormData.title}
                            onChange={(e) => setStandardFormData({ ...standardFormData, title: e.target.value })}
                            placeholder="e.g. Quarterly Board Meeting"
                            required
                        />
                        <Select
                            label="Target Type"
                            value={standardFormData.targetType}
                            onChange={(e) => setStandardFormData({ ...standardFormData, targetType: e.target.value as any })}
                            options={[
                                { label: 'Local Organization (LO)', value: 'LO' },
                                { label: 'Member', value: 'MEMBER' }
                            ]}
                        />
                    </div>

                    <div className="grid grid-cols-1">
                        <Textarea
                            label="Remarks / Guidelines"
                            value={standardFormData.remarks}
                            onChange={(e) => setStandardFormData({ ...standardFormData, remarks: e.target.value })}
                            placeholder="Detailed explanation, tips, or guidelines for this standard..."
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Point Cap (Max Points/Year)"
                            type="number"
                            value={standardFormData.pointCap || 0}
                            onChange={(e) => setStandardFormData({ ...standardFormData, pointCap: parseInt(e.target.value) || undefined })}
                        />
                        <Input
                            label="Display Order"
                            type="number"
                            value={standardFormData.order}
                            onChange={(e) => setStandardFormData({ ...standardFormData, order: parseInt(e.target.value) })}
                        />
                    </div>

                    <Select
                        label="Verification Method"
                        value={standardFormData.verificationType}
                        onChange={(e) => setStandardFormData({ ...standardFormData, verificationType: e.target.value as any })}
                        options={[
                            { label: 'Manual Upload (Evidence Required)', value: 'MANUAL_UPLOAD' },
                            { label: 'Auto System (Triggered by events)', value: 'AUTO_SYSTEM' },
                            { label: 'Hybrid', value: 'HYBRID' }
                        ]}
                    />

                    {(standardFormData.verificationType === 'AUTO_SYSTEM' || standardFormData.verificationType === 'HYBRID') && (
                        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 space-y-3">
                            <h4 className="text-xs font-bold text-indigo-700 uppercase flex items-center gap-2">
                                <Zap size={14} /> Automation Settings
                            </h4>
                            <Select
                                label="Logic Mapping"
                                value={standardFormData.autoLogicId || ''}
                                onChange={(e) => setStandardFormData({ ...standardFormData, autoLogicId: e.target.value as IncentiveLogicId })}
                                options={[
                                    { label: '-- Select Logic --', value: '' },
                                    { label: 'Membership Conversion (%)', value: IncentiveLogicId.EFFICIENT_MEMBERSHIP_CONVERSION },
                                    { label: 'Dues Payment Deadline', value: IncentiveLogicId.EFFICIENT_DUES_PAYMENT },
                                    { label: 'BOD Meeting Frequency', value: IncentiveLogicId.EFFICIENT_BOD_MEETINGS },
                                    { label: 'Membership Growth (Yearly)', value: IncentiveLogicId.EFFICIENT_MEMBERSHIP_GROWTH },
                                    { label: 'Event Attendance (Network)', value: IncentiveLogicId.NETWORK_EVENT_ATTENDANCE }
                                ]}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Target Value (e.g. 60%)"
                                    type="number"
                                    value={standardFormData.logicParams?.targetPercent || ''}
                                    onChange={(e) => setStandardFormData({
                                        ...standardFormData,
                                        logicParams: { ...standardFormData.logicParams, targetPercent: parseInt(e.target.value) }
                                    })}
                                />
                                <Input
                                    label="Min Count (e.g. 8 meetings)"
                                    type="number"
                                    value={standardFormData.logicParams?.minMeetings || ''}
                                    onChange={(e) => setStandardFormData({
                                        ...standardFormData,
                                        logicParams: { ...standardFormData.logicParams, minMeetings: parseInt(e.target.value) }
                                    })}
                                />
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-900">Milestones & Tiers</h4>
                                <p className="text-[10px] text-slate-500">For standards with multiple KPIs or tiered scores.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={standardFormData.isTiered}
                                        onChange={(e) => setStandardFormData({ ...standardFormData, isTiered: e.target.checked })}
                                    />
                                    <span className="text-xs font-medium text-slate-600">Tiered Scoring</span>
                                </label>
                                <Button type="button" size="sm" variant="outline" onClick={addMilestone}>
                                    <Plus size={14} className="mr-1" /> Add Milestone
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {standardFormData.milestones?.map((ms, idx) => (
                                <div key={ms.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-[2]">
                                            <Input
                                                label="Milestone Title"
                                                value={ms.label}
                                                onChange={(e) => updateMilestone(idx, 'label', e.target.value)}
                                                placeholder="e.g. 60% Conversion"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <Input
                                                label="Points"
                                                type="number"
                                                value={ms.points}
                                                onChange={(e) => updateMilestone(idx, 'points', parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <Input
                                                label="Deadline"
                                                type="date"
                                                value={ms.deadline || ''}
                                                onChange={(e) => updateMilestone(idx, 'deadline', e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700 h-9"
                                            onClick={() => removeMilestone(idx)}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Select
                                            label="Activity Type (Auto-sync)"
                                            value={ms.activityType || ''}
                                            onChange={(e) => updateMilestone(idx, 'activityType', e.target.value)}
                                            options={[
                                                { label: '-- Manual Only --', value: '' },
                                                { label: 'Community Project', value: 'Community' },
                                                { label: 'Training Workshop', value: 'Training' },
                                                { label: 'Business Meeting', value: 'Meeting' },
                                                { label: 'Social Event', value: 'Social' },
                                                { label: 'International Sync', value: 'International' }
                                            ]}
                                        />
                                        <Input
                                            label="Min Participants"
                                            type="number"
                                            value={ms.minParticipants || 0}
                                            onChange={(e) => updateMilestone(idx, 'minParticipants', parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            ))}
                            {(!standardFormData.milestones || standardFormData.milestones.length === 0) && (
                                <p className="text-xs text-slate-400 italic text-center py-2">No milestones defined.</p>
                            )}
                            {standardFormData.isTiered && (
                                <div className="p-2 bg-yellow-50 border border-yellow-100 rounded text-[10px] text-yellow-700 flex gap-2">
                                    <Settings size={12} className="shrink-0" />
                                    <span>In <strong>Tiered Mode</strong>, only the single highest achieved milestone will be awarded (e.g. 5 pts OR 10 pts, not both).</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <Button variant="ghost" onClick={() => setStandardModalOpen(false)} type="button">Cancel</Button>
                        <Button variant="primary" type="submit">
                            {editingStandard ? 'Update Standard' : 'Save Standard'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {
                program && (
                    <StandardBatchImportModal
                        isOpen={isBatchImportOpen}
                        onClose={() => setBatchImportOpen(false)}
                        onImported={() => {
                            showToast('Standards imported successfully', 'success');
                            loadActiveProgram();
                        }}
                        programId={program.id}
                    />
                )
            }
        </div >
    );
};
