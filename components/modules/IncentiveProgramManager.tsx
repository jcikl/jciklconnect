import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, useToast, Modal, ProgressBar } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { PointsService } from '../../services/pointsService';
import { IncentiveProgram, IncentiveStandard, IncentiveLogicId } from '../../types';
import { Save, RefreshCw, Star, Settings, Plus, Trash2, Edit, List, Zap, ClipboardList, Square, CheckSquare } from 'lucide-react';
import { IncentiveCalculatorService } from '../../services/incentiveCalculatorService';
import { StandardBatchImportModal } from './Incentive/StandardBatchImportModal';

export const IncentiveProgramManager: React.FC = () => {
    const [program, setProgram] = useState<IncentiveProgram | null>(null);
    const [allPrograms, setAllPrograms] = useState<IncentiveProgram[]>([]);
    const [standards, setStandards] = useState<IncentiveStandard[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isNewYearModalOpen, setNewYearModalOpen] = useState(false);
    const [newYearValue, setNewYearValue] = useState(new Date().getFullYear() + 1);
    const { showToast } = useToast();
    const [activeCategory, setActiveCategory] = useState<string>('efficient');
    const [selectedStandards, setSelectedStandards] = useState<string[]>([]);

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
        isTiered: true
    });

    useEffect(() => {
        loadActiveProgram();
    }, []);

    const loadActiveProgram = async (year?: number) => {
        setLoading(true);
        try {
            const all = await PointsService.getIncentivePrograms();

            // Deduplicate programs by year to ensure each year appears only once in the selector
            const uniquePrograms = all.reduce((acc: IncentiveProgram[], current) => {
                const x = acc.find(item => item.year === current.year);
                if (!x) {
                    return acc.concat([current]);
                } else {
                    // Keep the one that is active if multiple exist
                    if (current.isActive) {
                        const index = acc.findIndex(item => item.year === current.year);
                        acc[index] = current;
                    }
                    return acc;
                }
            }, []);

            setAllPrograms(uniquePrograms);

            let current = year ? uniquePrograms.find(p => p.year === year) : uniquePrograms.find(p => p.isActive);
            if (!current && uniquePrograms.length > 0) current = uniquePrograms[0];

            setProgram(current || null);
            if (current) {
                const stds = await PointsService.getStandards(current.id);
                // Deduplicate standards by ID to avoid key warnings
                const uniqueStds = stds.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                setStandards(uniqueStds);
                if (current.categories && !activeCategory) {
                    setActiveCategory(Object.keys(current.categories)[0]);
                }
            }
        } catch (err) {
            showToast('Failed to load program configuration', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleYearChange = (year: number) => {
        loadActiveProgram(year);
    };

    const handleStartNewYear = async () => {
        // Prevent duplicate year creation
        const existingYear = allPrograms.find(p => p.year === newYearValue);
        if (existingYear) {
            showToast(`Program for ${newYearValue} already exists. Switching to it.`, 'info');
            setNewYearModalOpen(false);
            loadActiveProgram(newYearValue);
            return;
        }

        setLoading(true);
        try {
            // Clone from current if exists, else fresh
            const sourceId = program?.id;
            let newId;
            if (sourceId) {
                newId = await PointsService.cloneProgram(sourceId, newYearValue);
                showToast(`New program for ${newYearValue} cloned from previous cycle!`, 'success');
            } else {
                const defaultProgram = {
                    year: newYearValue,
                    name: `${newYearValue} JCI Incentive Program`,
                    isActive: true,
                    categories: {
                        efficient: { label: 'Efficient Star', minScore: 100, isFundamental: true },
                        network: { label: 'Network Star', minScore: 250 },
                        experience: { label: 'Experience Star', minScore: 250 },
                        outreach: { label: 'Outreach Star', minScore: 250 },
                        impact: { label: 'Impact Star', minScore: 250 }
                    },
                    specialAwards: []
                };
                newId = await PointsService.createIncentiveProgram(defaultProgram);
                showToast(`Initialized fresh program for ${newYearValue}`, 'success');
            }
            setNewYearModalOpen(false);
            loadActiveProgram(newYearValue);
        } catch (err) {
            showToast('Failed to start new year', 'error');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAll = () => {
        const categoryStandards = standards.filter(s => s.category === activeCategory);
        const categoryIds = categoryStandards.map(s => s.id!).filter(Boolean);

        const allInCategorySelected = categoryIds.every(id => selectedStandards.includes(id));

        if (allInCategorySelected) {
            setSelectedStandards(prev => prev.filter(id => !categoryIds.includes(id)));
        } else {
            setSelectedStandards(prev => [...new Set([...prev, ...categoryIds])]);
        }
    };

    const toggleSelectStandard = (id: string) => {
        setSelectedStandards(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedStandards.length === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedStandards.length} selected standards?`)) return;

        try {
            await PointsService.bulkDeleteStandards(selectedStandards);
            showToast(`${selectedStandards.length} standards deleted`, 'success');
            setSelectedStandards([]);
            loadActiveProgram(program?.year);
        } catch (err) {
            showToast('Failed to delete standards', 'error');
        }
    };

    const handleDeleteProgram = async () => {
        if (!program) return;
        const confirmText = `Are you absolutely sure? This will delete the entire ${program.year} program and ALL its associated standards. 
        \nThis action is permanent and cannot be undone.`;

        if (!window.confirm(confirmText)) return;

        setLoading(true);
        try {
            await PointsService.deleteIncentiveProgram(program.id);
            showToast(`${program.year} Program and its standards have been removed.`, 'success');
            // Reload without specific year to find next available/active
            await loadActiveProgram();
        } catch (err) {
            showToast('Failed to delete program', 'error');
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
            await PointsService.updateIncentiveProgram(program.id, program);
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
        let processedValue = value;

        // Handle date formatting for input type="date"
        if (field === 'deadline' && value) {
            // If it's already YYYY-MM-DD, keep it. If not, try to convert.
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                try {
                    const d = new Date(value);
                    if (!isNaN(d.getTime())) {
                        processedValue = d.toISOString().split('T')[0];
                    }
                } catch (e) {
                    // Fallback to original
                }
            }
        }

        currentMilestones[index] = { ...currentMilestones[index], [field]: processedValue };
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

    return (
        <div className="space-y-6">
            {!program ? (
                <div className="p-12 text-center max-w-md mx-auto">
                    <div className="bg-white rounded-3xl p-10 shadow-xl border border-slate-100 flex flex-col items-center">
                        <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                            <Star size={40} className="text-indigo-500 animate-pulse" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">No Program Found</h3>
                        <p className="text-slate-500 mb-8 leading-relaxed">
                            It looks like there's no active incentive program configured for the current cycle.
                        </p>
                        <Button
                            size="lg"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 py-6 rounded-2xl font-bold font-sans"
                            onClick={() => setNewYearModalOpen(true)}
                        >
                            Initialize {newYearValue} Program
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="w-full md:w-auto">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">KPI Configuration</h2>
                            <select
                                value={program.year}
                                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                                className="bg-slate-100 hover:bg-slate-200 border-none rounded-lg px-3 py-1 text-sm font-bold text-indigo-600 focus:ring-0 cursor-pointer transition-colors"
                            >
                                {allPrograms.map(p => (
                                    <option key={p.id} value={p.year}>{p.year}{p.isActive ? ' (Active)' : ''}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleDeleteProgram}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                title={`Delete ${program.year} Program`}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <p className="text-xs md:text-sm text-slate-500">Managing standards for {program.name}</p>
                    </div>
                    <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4">

                        <div className="grid grid-cols-3 md:flex md:flex-wrap gap-2 w-full md:w-auto">
                            <Button variant="outline" size="sm" onClick={() => setNewYearModalOpen(true)} className="flex-1 md:flex-none border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                                <Plus size={14} className="md:mr-2" /> <span className="text-xs">Start New Year</span>
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setBatchImportOpen(true)} className="flex-1 md:flex-none">
                                <ClipboardList size={14} className="md:mr-2" /> <span className="hidden md:inline text-xs">Batch Import</span><span className="md:hidden text-[10px]">Import</span>
                            </Button>
                            <Button size="sm" onClick={handleSave} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700">
                                <Save size={14} className="md:mr-2" /> <span className="hidden md:inline text-xs">Save</span><span className="md:hidden text-[10px]">Save</span>
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Categories Navigation */}
                        <div className="md:w-64 flex-shrink-0">
                            <div className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                                {Object.entries(program.categories).map(([key, cat]) => (
                                    <button
                                        key={key}
                                        onClick={() => setActiveCategory(key)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap md:whitespace-normal text-left ${activeCategory === key
                                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 translate-x-1"
                                            : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                                            }`}
                                    >
                                        <Star size={16} className={cat.isFundamental ? (activeCategory === key ? "text-indigo-200 fill-current" : "text-indigo-500 fill-current") : (activeCategory === key ? "text-yellow-200 fill-current" : "text-yellow-500 fill-current")} />
                                        <span className="flex-1">{cat.label}</span>
                                        {activeCategory === key && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-white hidden md:block" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Active Category Content */}
                        <div className="flex-1 min-w-0">
                            {activeCategory && program.categories[activeCategory] && (
                                <Card title={
                                    <div className="flex items-center justify-between w-full pr-2">
                                        <div className="flex items-center gap-2">
                                            <Star size={18} className={program.categories[activeCategory].isFundamental ? "text-indigo-500 fill-current" : "text-yellow-500 fill-current"} />
                                            <span className="font-bold text-slate-900">{program.categories[activeCategory].label}</span>
                                        </div>
                                        <div>
                                            <Button size="sm" className="bg-slate-900 hover:bg-black text-white rounded-full h-8 px-4" onClick={() => handleOpenStandardModal(undefined, activeCategory)}>
                                                <Plus size={14} className="mr-1" /> <span className="text-xs">Add Standard</span>
                                            </Button>
                                        </div>
                                    </div>
                                }>
                                    <div className="space-y-6">
                                        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                                            <div className="flex items-center gap-2">
                                                <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider">Category Star Threshold</label>
                                                <div className="flex-1">
                                                    <Input
                                                        type="number"
                                                        value={program.categories[activeCategory].minScore}
                                                        onChange={(e) => handleUpdateKPI(activeCategory, parseInt(e.target.value) || 0)}
                                                        placeholder="Required points..."
                                                        className="bg-white border-indigo-200 focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div className="text-xs text-indigo-600 font-medium">
                                                    {program.categories[activeCategory].isFundamental ? "Fundamental Goal" : "Secondary Star"}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-3 px-1">
                                                <div className="flex items-center gap-4">
                                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Included Standards ({standards.filter(s => s.category === activeCategory).length})</h4>
                                                    {standards.filter(s => s.category === activeCategory).length > 0 && (
                                                        <button
                                                            onClick={toggleSelectAll}
                                                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                                                        >
                                                            {standards.filter(s => s.category === activeCategory).every(s => selectedStandards.includes(s.id!))
                                                                ? <><CheckSquare size={14} /> Deselect All</>
                                                                : <><Square size={14} /> Select All</>
                                                            }
                                                        </button>
                                                    )}
                                                </div>
                                                {selectedStandards.length > 0 && (
                                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                                                        <span className="text-xs font-bold text-slate-500">{selectedStandards.length} Selected</span>
                                                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={handleBulkDelete}>
                                                            <Trash2 size={12} className="mr-1" /> Delete
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedStandards([])}>
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid gap-3">
                                                {standards.filter(s => s.category === activeCategory).sort((a, b) => a.title.localeCompare(b.title)).map(std => (
                                                    <div
                                                        key={std.id}
                                                        className={`flex items-center gap-3 bg-white p-4 rounded-xl border transition-all group ${selectedStandards.includes(std.id!)
                                                            ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10'
                                                            : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'
                                                            }`}
                                                    >
                                                        <button
                                                            onClick={() => toggleSelectStandard(std.id!)}
                                                            className={`shrink-0 transition-colors ${selectedStandards.includes(std.id!) ? 'text-indigo-600' : 'text-slate-300 hover:text-indigo-400'}`}
                                                        >
                                                            {selectedStandards.includes(std.id!) ? <CheckSquare size={20} /> : <Square size={20} />}
                                                        </button>

                                                        <div className="flex-1 cursor-pointer" onClick={() => toggleSelectStandard(std.id!)}>
                                                            <p className="text-sm font-bold text-slate-800 mb-0.5">{std.title}</p>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                                                                    {std.milestones?.length ? (std.isTiered ? `${Math.max(...std.milestones.map(m => m.points))} PTS` : `${std.milestones.reduce((acc, m) => acc + m.points, 0)} PTS`) : '0 PTS'}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-medium">
                                                                    {std.verificationType === 'AUTO_SYSTEM' ? 'Automated' : 'Manual Evidence'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <button onClick={(e) => { e.stopPropagation(); handleOpenStandardModal(std); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"><Edit size={16} /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteStandard(std.id!); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={16} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {standards.filter(s => s.category === activeCategory).length === 0 && (
                                                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                        <List size={32} className="mx-auto text-slate-300 mb-2" />
                                                        <p className="text-xs text-slate-400 font-medium">No standards configured for this category.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                </>
            )}

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
                            <div className="text-[10px] text-indigo-600 bg-white/50 p-2 rounded border border-indigo-100 italic">
                                Logic parameters (thresholds, counts) are now configured inside each <strong>Milestone</strong> below.
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
                                                value={ms.deadline ? (ms.deadline.includes('-') && ms.deadline.split('-')[0].length === 4 ? ms.deadline : new Date(ms.deadline).toISOString().split('T')[0]) : ''}
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
                                    <div className="grid grid-cols-3 gap-4">
                                        {standardFormData.autoLogicId ? (
                                            <Input
                                                label={
                                                    standardFormData.autoLogicId.includes('MEMBERSHIP') || standardFormData.autoLogicId.includes('GROWTH')
                                                        ? 'Threshold (%)'
                                                        : standardFormData.autoLogicId.includes('BOD_MEETINGS')
                                                            ? 'Min Count (Meetings)'
                                                            : 'Logic Threshold'
                                                }
                                                type="number"
                                                value={ms.logicThreshold || ''}
                                                onChange={(e) => updateMilestone(idx, 'logicThreshold', parseFloat(e.target.value) || 0)}
                                                placeholder="e.g. 60 or 8"
                                            />
                                        ) : (
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
                                        )}
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

            {program && (
                <StandardBatchImportModal
                    isOpen={isBatchImportOpen}
                    onClose={() => setBatchImportOpen(false)}
                    onImported={() => {
                        showToast('Standards imported successfully', 'success');
                        loadActiveProgram();
                    }}
                    programId={program.id}
                />
            )}

            {/* New Year Initialize Modal */}
            <Modal
                isOpen={isNewYearModalOpen}
                onClose={() => setNewYearModalOpen(false)}
                title="Initialize New Year Program"
                size="sm"
                footer={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setNewYearModalOpen(false)} className="flex-1">Cancel</Button>
                        <Button onClick={handleStartNewYear} className="flex-1 bg-indigo-600">Initialize</Button>
                    </div>
                }
            >
                <div className="space-y-4 py-2">
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                        <p className="text-xs text-amber-700">
                            <strong>Note:</strong> Starting a new year will automatically clone all Categories and Standards from the current active program ({program?.year || 'Initial'}).
                        </p>
                    </div>
                    <Input
                        label="New Program Year"
                        type="number"
                        value={newYearValue}
                        onChange={(e) => setNewYearValue(parseInt(e.target.value))}
                        min={2020}
                        max={2100}
                    />
                    <p className="text-[10px] text-slate-500">
                        Once initialized, the new program will become the <strong>Active</strong> program for the entire system.
                    </p>
                </div>
            </Modal>
        </div>
    );
};
