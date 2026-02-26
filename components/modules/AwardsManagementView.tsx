// Awards Management View - Unified Management for Recognition (Awards)
import React, { useState, useMemo } from 'react';
import {
    Trophy,
    Award as AwardIcon,
    Plus,
    Search,
    Filter,
    CheckCircle,
    Clock,
    Target,
    Users,
    Star,
    Zap,
    Edit,
    Trash2,
    Settings,
    Layout
} from 'lucide-react';
import { AwardDefinition } from '../../types';
import {
    Card,
    Button,
    Badge,
    Modal,
    useToast,
    Tabs,
    ProgressBar
} from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useGamification, EnrichedAward } from '../../hooks/useGamification';
import { useMembers } from '../../hooks/useMembers';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDate } from '../../utils/dateUtils';
import { AchievementProgressVisualizer } from './AchievementProgressVisualizer';

export const AwardsManagementView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
    const [activeTab, setActiveTab] = useState('All Awards');

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

    const { members } = useMembers();
    const { isAdmin, isBoard } = usePermissions();
    const { showToast } = useToast();

    const canManage = isAdmin || isBoard;

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

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this award definition?')) {
            try {
                await deleteAward(id);
            } catch (err) {
                console.error('Error deleting award:', err);
            }
        }
    };

    // Unified Search and Filter
    const filteredAwards = useMemo(() => {
        const term = (searchQuery || '').toLowerCase();
        let result = awards;

        if (term) {
            result = result.filter(item =>
                item.name.toLowerCase().includes(term) ||
                item.description.toLowerCase().includes(term) ||
                item.category.toLowerCase().includes(term) ||
                item.tier.toLowerCase().includes(term)
            );
        }

        return result;
    }, [awards, searchQuery]);

    const earnedAwardsCount = memberAwards.filter(a => a.isEarned).length;

    return (
        <div className="space-y-6">
            {/* Header Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-jci-blue/10 to-transparent border-jci-blue/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-jci-blue/20 rounded-xl text-jci-blue">
                            <Trophy size={24} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{awards.length}</p>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Awards</p>
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-transparent border-purple-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
                            <AwardIcon size={24} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{awards.filter(a => a.rarity === 'Legendary' || a.rarity === 'Epic').length}</p>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Rare Honors</p>
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-transparent border-green-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-xl text-green-600">
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{earnedAwardsCount}</p>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Earned Awards</p>
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-yellow-50 to-transparent border-yellow-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-100 rounded-xl text-yellow-600">
                            <Zap size={24} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{awards.filter(a => a.active).length}</p>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Active Challenges</p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="flex items-center justify-between gap-4 bg-white px-4 rounded-xl shadow-sm border border-slate-100">
                <Tabs
                    tabs={['All Awards', 'Management']}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    className="border-b-0"
                />

                {canManage && activeTab === 'Management' && (
                    <Button size="sm" variant="primary" onClick={() => handleOpenModal()} className="mb-0">
                        <Plus size={14} className="mr-1" />
                        New Award
                    </Button>
                )}
            </div>

            <LoadingState loading={loading} error={error} empty={filteredAwards.length === 0} emptyMessage="No awards found matching your criteria">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAwards.map((award: AwardDefinition) => {
                        const userAward = memberAwards.find(ma => ma.id === award.id);
                        const isEarned = userAward?.isEarned || false;
                        const progress = userAward?.progress || 0;

                        return (
                            <Card key={award.id} className={`group hover:border-jci-blue/30 transition-all hover:shadow-md h-full flex flex-col ${!isEarned && activeTab !== 'Management' ? 'opacity-60 saturate-50' : 'ring-1 ring-jci-blue/20'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`text-5xl group-hover:scale-110 transition-transform duration-300 filter drop-shadow-sm ${!isEarned && activeTab !== 'Management' ? 'grayscale' : ''}`}>
                                        {award.icon}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge variant="jci" className="text-[10px] uppercase font-bold tracking-tighter">
                                            {award.category}
                                        </Badge>
                                        <Badge variant="neutral" className="text-[10px] lowercase italic bg-slate-50 text-slate-400">
                                            {award.tier}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-jci-blue transition-colors mb-1">
                                        {award.name}
                                        {isEarned && (
                                            <CheckCircle size={14} className="inline-block ml-2 text-green-500" />
                                        )}
                                    </h3>
                                    <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed">{award.description}</p>

                                    {award.milestones && award.milestones.length > 0 && (
                                        <div className="space-y-3 mb-4">
                                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                                <span>Progression</span>
                                                <span className="text-jci-blue">{progress}%</span>
                                            </div>
                                            <div className="flex gap-1.5">
                                                {award.milestones.map((m: any, i: number) => {
                                                    const mCompleted = userAward?.completedMilestones?.includes(m.level);
                                                    return (
                                                        <div key={i} className={`flex-1 h-1.5 rounded-full ${mCompleted ? 'bg-jci-blue' : 'bg-slate-100'}`} />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 mt-4 border-t border-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                        <Star size={12} className="text-yellow-400" />
                                        {award.pointsReward || 0} pts
                                    </div>

                                    {canManage && activeTab === 'Management' && (
                                        <div className="flex gap-1">
                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full hover:bg-slate-100" onClick={() => handleOpenModal(award)}>
                                                <Edit size={12} className="text-slate-400" />
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full hover:bg-red-50 hover:text-red-500" onClick={() => handleDelete(award.id!)}>
                                                <Trash2 size={12} className="text-slate-400" />
                                            </Button>
                                        </div>
                                    )}

                                    {isEarned && userAward?.earnedAt && (
                                        <span className="text-[10px] text-slate-400 italic">
                                            Earned {formatDate(userAward.earnedAt)}
                                        </span>
                                    )}
                                </div>
                            </Card>
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
                                    <Target size={14} />
                                    Earning Criteria
                                </h4>
                                <div className="space-y-3">
                                    <Select
                                        label="Criteria Type"
                                        value={formData.criteria.type}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            criteria: { ...formData.criteria, type: e.target.value as any }
                                        })}
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
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            criteria: { ...formData.criteria, value: parseInt(e.target.value) }
                                        })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <Button variant="ghost" onClick={handleCloseModal} type="button">
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit">
                            {editingAward ? 'Update Award' : 'Create Award'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
