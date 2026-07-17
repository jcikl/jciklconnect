// Awards Management View
import React, { useState, useMemo } from 'react';
import {
    Trophy,
    Award as AwardIcon,
    Plus,
    CheckCircle,
    Target,
    Star,
    Zap,
    Edit,
    Trash2,
} from 'lucide-react';
import { AwardDefinition } from '../../types';
import {
    Button,
    Badge,
    Modal,
    useToast,
    ConfirmDialog,
    CONFIRM_CLOSED,
} from '../ui/Common';
import type { ConfirmState } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useGamification } from '../../hooks/useGamification';
import { formatDate } from '../../utils/dateUtils';

export const AwardsManagementView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
    const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
    const {
        awards,
        memberAwards,
        loading,
        error,
        createAward,
        updateAward,
        deleteAward
    } = useGamification();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAward, setEditingAward] = useState<AwardDefinition | null>(null);
    const [formData, setFormData] = useState<Omit<AwardDefinition, 'id'>>({
        name: '',
        description: '',
        icon: '🏆',
        category: 'Special',
        tier: 'Bronze',
        rarity: 'Common',
        pointsReward: 100,
        criteria: { type: 'custom', value: 1 },
        milestones: [],
        active: true
    });

    const { showToast } = useToast();

    const handleOpenModal = (award?: AwardDefinition) => {
        if (award) {
            setEditingAward(award);
            setFormData({
                name: award.name,
                description: award.description,
                icon: award.icon,
                category: award.category,
                tier: award.tier,
                rarity: award.rarity,
                pointsReward: award.pointsReward,
                criteria: award.criteria,
                milestones: award.milestones || [],
                active: award.active
            });
        } else {
            setEditingAward(null);
            setFormData({
                name: '',
                description: '',
                icon: '🏆',
                category: 'Special',
                tier: 'Bronze',
                rarity: 'Common',
                pointsReward: 100,
                criteria: { type: 'custom', value: 1 },
                milestones: [],
                active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingAward(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingAward?.id) {
                await updateAward(editingAward.id, formData);
            } else {
                await createAward(formData);
            }
            handleCloseModal();
        } catch (err) {
            console.error('Error saving award:', err);
        }
    };

    const handleDelete = (id: string) => {
        setConfirmState({
            open: true,
            title: 'Delete Award',
            message: 'Are you sure you want to delete this award definition?',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmState(CONFIRM_CLOSED);
                try {
                    await deleteAward(id);
                } catch (err) {
                    console.error('Error deleting award:', err);
                }
            },
        });
    };

    const filteredAwards = useMemo(() => {
        const term = (searchQuery || '').toLowerCase();
        if (!term) return awards;
        return awards.filter(item =>
            item.name.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term) ||
            item.category.toLowerCase().includes(term) ||
            item.tier.toLowerCase().includes(term)
        );
    }, [awards, searchQuery]);

    const earnedAwardsCount = memberAwards.filter(a => a.isEarned).length;

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="flex items-center gap-2.5 bg-gradient-to-br from-jci-blue/10 to-white border border-jci-blue/20 rounded-xl px-3 py-2.5">
                    <div className="p-1.5 bg-jci-blue/20 rounded-lg text-jci-blue shrink-0"><Trophy size={16} /></div>
                    <div className="min-w-0">
                        <p className="text-lg font-bold text-slate-900 tabular-nums leading-none">{awards.length}</p>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Total</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-xl px-3 py-2.5">
                    <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600 shrink-0"><AwardIcon size={16} /></div>
                    <div className="min-w-0">
                        <p className="text-lg font-bold text-slate-900 tabular-nums leading-none">{awards.filter(a => a.rarity === 'Legendary' || a.rarity === 'Epic').length}</p>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Rare</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-xl px-3 py-2.5">
                    <div className="p-1.5 bg-green-100 rounded-lg text-green-600 shrink-0"><CheckCircle size={16} /></div>
                    <div className="min-w-0">
                        <p className="text-lg font-bold text-slate-900 tabular-nums leading-none">{earnedAwardsCount}</p>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Earned</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 bg-gradient-to-br from-yellow-50 to-white border border-yellow-100 rounded-xl px-3 py-2.5">
                    <div className="p-1.5 bg-yellow-100 rounded-lg text-yellow-600 shrink-0"><Zap size={16} /></div>
                    <div className="min-w-0">
                        <p className="text-lg font-bold text-slate-900 tabular-nums leading-none">{awards.filter(a => a.active).length}</p>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Active</p>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">Award Definitions</h3>
                    <span className="text-xs bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full tabular-nums">{filteredAwards.length}</span>
                </div>
                <Button size="sm" variant="primary" onClick={() => handleOpenModal()}>
                    <Plus size={14} className="mr-1" /> New Award
                </Button>
            </div>

            {/* Awards Grid */}
            <LoadingState loading={loading} error={error} empty={filteredAwards.length === 0} emptyMessage="No awards found">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {filteredAwards.map((award: AwardDefinition) => {
                        const tierColors: Record<string, string> = {
                            Bronze: 'border-l-amber-600',
                            Silver: 'border-l-slate-400',
                            Gold: 'border-l-yellow-400',
                            Platinum: 'border-l-cyan-400',
                            Legendary: 'border-l-purple-500',
                        };
                        const tierBorder = tierColors[award.tier] ?? 'border-l-slate-200';

                        return (
                            <div key={award.id} className={`group bg-white border border-slate-200 border-l-4 ${tierBorder} rounded-xl p-4 hover:shadow-md transition-all flex flex-col gap-3`}>
                                {/* Top row: icon + badges */}
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-3xl group-hover:scale-110 transition-transform duration-200 leading-none">{award.icon}</span>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <Badge variant="jci" className="text-[10px] uppercase tracking-tight">{award.category}</Badge>
                                        <span className="text-[10px] text-slate-400 italic">{award.tier} · {award.rarity}</span>
                                    </div>
                                </div>

                                {/* Name + description */}
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-900 group-hover:text-jci-blue transition-colors leading-snug mb-1">{award.name}</p>
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{award.description}</p>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                                        <Star size={11} className="text-yellow-400" />
                                        <span className="tabular-nums">{award.pointsReward || 0} pts</span>
                                        {!award.active && <span className="ml-1 text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Inactive</span>}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenModal(award)}
                                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-jci-blue px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                                        >
                                            <Edit size={11} /> Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(award.id!)}
                                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 size={11} /> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </LoadingState>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingAward ? 'Edit Award' : 'New Award'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <Input
                                label="Award Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Master Ambassador"
                                required
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Icon (Emoji)"
                                    value={formData.icon}
                                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                    placeholder="e.g. 🏆"
                                    required
                                />
                                <Select
                                    label="Category"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                                    options={[
                                        { label: 'Event', value: 'Event' },
                                        { label: 'Project', value: 'Project' },
                                        { label: 'Leadership', value: 'Leadership' },
                                        { label: 'Training', value: 'Training' },
                                        { label: 'Recruitment', value: 'Recruitment' },
                                        { label: 'Social', value: 'Social' },
                                        { label: 'Milestone', value: 'Milestone' },
                                        { label: 'Special', value: 'Special' },
                                    ]}
                                />
                            </div>
                            <Textarea
                                label="Description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Explain how to earn this award..."
                                rows={3}
                                required
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Select
                                    label="Tier"
                                    value={formData.tier}
                                    onChange={(e) => setFormData({ ...formData, tier: e.target.value as any })}
                                    options={[
                                        { label: 'Bronze', value: 'Bronze' },
                                        { label: 'Silver', value: 'Silver' },
                                        { label: 'Gold', value: 'Gold' },
                                        { label: 'Platinum', value: 'Platinum' },
                                        { label: 'Legendary', value: 'Legendary' },
                                    ]}
                                />
                                <Select
                                    label="Rarity"
                                    value={formData.rarity}
                                    onChange={(e) => setFormData({ ...formData, rarity: e.target.value as any })}
                                    options={[
                                        { label: 'Common', value: 'Common' },
                                        { label: 'Rare', value: 'Rare' },
                                        { label: 'Epic', value: 'Epic' },
                                        { label: 'Legendary', value: 'Legendary' },
                                    ]}
                                />
                            </div>
                            <Input
                                label="Points Reward"
                                type="number"
                                value={formData.pointsReward}
                                onChange={(e) => setFormData({ ...formData, pointsReward: parseInt(e.target.value) })}
                                required
                            />
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                    <Target size={14} /> Earning Criteria
                                </h4>
                                <div className="space-y-3">
                                    <Select
                                        label="Criteria Type"
                                        value={formData.criteria.type}
                                        onChange={(e) => setFormData({ ...formData, criteria: { ...formData.criteria, type: e.target.value as any } })}
                                        options={[
                                            { label: 'Event Count', value: 'event_count' },
                                            { label: 'Project Count', value: 'project_count' },
                                            { label: 'Points Threshold', value: 'points_threshold' },
                                            { label: 'Custom Requirement', value: 'custom' },
                                        ]}
                                    />
                                    <Input
                                        label="Target Value"
                                        type="number"
                                        value={formData.criteria.value}
                                        onChange={(e) => setFormData({ ...formData, criteria: { ...formData.criteria, value: parseInt(e.target.value) } })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <Button variant="ghost" onClick={handleCloseModal} type="button">Cancel</Button>
                        <Button variant="primary" type="submit">
                            {editingAward ? 'Update Award' : 'Create Award'}
                        </Button>
                    </div>
                </form>
            </Modal>
            <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
        </div>
    );
};
