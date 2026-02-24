// Achievement Management View - Manage achievements and awards
import React, { useState } from 'react';
import { Trophy, Plus, Edit, Trash2, Award, Star, Target, Users, CheckCircle } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs } from '../ui/Common';
import { Input, Select, Textarea, Checkbox } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useAchievements } from '../../hooks/useAchievements';
import { useMembers } from '../../hooks/useMembers';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { Achievement, AchievementCriteria, AchievementMilestone } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { AchievementProgressVisualizer, AchievementDashboard } from './AchievementProgressVisualizer';

export const AchievementManagementView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isAwardModalOpen, setAwardModalOpen] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [milestones, setMilestones] = useState<AchievementMilestone[]>([]);

  const {
    achievements,
    memberAchievements,
    memberProgress,
    loading,
    error,
    createAchievement,
    updateAchievement,
    awardAchievement,
    loadMemberAchievements,
    loadMemberProgress,
    calculateProgress
  } = useAchievements();
  const { members, loading: membersLoading } = useMembers();
  const { member: currentMember } = useAuth();
  const { isAdmin, isBoard } = usePermissions();
  const { showToast } = useToast();

  const filteredAchievements = React.useMemo(() => {
    const term = (searchQuery || '').toLowerCase();
    if (!term) return achievements;
    return achievements.filter(a =>
      (a.name ?? '').toLowerCase().includes(term) ||
      (a.description ?? '').toLowerCase().includes(term) ||
      (a.category ?? '').toLowerCase().includes(term) ||
      (a.tier ?? '').toLowerCase().includes(term)
    );
  }, [achievements, searchQuery]);

  const filteredMemberAchievements = React.useMemo(() => {
    const term = (searchQuery || '').toLowerCase();
    if (!term) return memberAchievements;
    return memberAchievements.filter(award => {
      const achievement = achievements.find(a => a.id === award.achievementId);
      if (!achievement) return false;
      return (
        (achievement.name ?? '').toLowerCase().includes(term) ||
        (achievement.description ?? '').toLowerCase().includes(term)
      );
    });
  }, [memberAchievements, achievements, searchQuery]);

  const canManage = isAdmin || isBoard;

  React.useEffect(() => {
    if (activeTab === 'my' && currentMember) {
      loadMemberAchievements(currentMember.id);
      loadMemberProgress(currentMember.id);
    }
  }, [activeTab, currentMember]);

  const addMilestone = () => {
    setMilestones([...milestones, { level: 'Bronze', threshold: 1, pointValue: 0 }]);
  };

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, field: keyof AchievementMilestone, value: any) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const handleCreateAchievement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await createAchievement({
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        icon: formData.get('icon') as string,
        tier: formData.get('tier') as Achievement['tier'],
        category: formData.get('category') as Achievement['category'],
        pointsReward: formData.get('pointsReward') ? parseInt(formData.get('pointsReward') as string) : 0,
        criteria: {
          type: formData.get('criteriaType') as AchievementCriteria['type'],
          value: parseInt(formData.get('criteriaValue') as string),
          description: formData.get('criteriaDescription') as string,
          timeframe: formData.get('criteriaTimeframe') as AchievementCriteria['timeframe'] || undefined,
        },
        milestones: milestones.length > 0 ? milestones : undefined,
        active: true,
      });
      setCreateModalOpen(false);
      setMilestones([]);
      e.currentTarget.reset();
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleUpdateAchievement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAchievement?.id) return;

    const formData = new FormData(e.currentTarget);

    try {
      await updateAchievement(selectedAchievement.id, {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        icon: formData.get('icon') as string,
        tier: formData.get('tier') as Achievement['tier'],
        category: formData.get('category') as Achievement['category'],
        pointsReward: formData.get('pointsReward') ? parseInt(formData.get('pointsReward') as string) : 0,
        criteria: {
          type: formData.get('criteriaType') as AchievementCriteria['type'],
          value: parseInt(formData.get('criteriaValue') as string),
          description: formData.get('criteriaDescription') as string,
          timeframe: formData.get('criteriaTimeframe') as AchievementCriteria['timeframe'] || undefined,
        },
        milestones: milestones.length > 0 ? milestones : undefined,
      });
      setEditModalOpen(false);
      setSelectedAchievement(null);
      setMilestones([]);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleAwardAchievement = async () => {
    if (!selectedAchievement?.id || !selectedMemberId) {
      showToast('Please select an achievement and member', 'error');
      return;
    }

    try {
      await awardAchievement(selectedMemberId, selectedAchievement.id);
      setAwardModalOpen(false);
      setSelectedAchievement(null);
      setSelectedMemberId('');
    } catch (err) {
      // Error handled in hook
    }
  };

  const getTierIcon = (tier: Achievement['tier']) => {
    switch (tier) {
      case 'Bronze': return '🥉';
      case 'Silver': return '🥈';
      case 'Gold': return '🥇';
      case 'Platinum': return '💎';
      default: return '⭐';
    }
  };

  const getTierColor = (tier: Achievement['tier']) => {
    switch (tier) {
      case 'Bronze': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Silver': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Gold': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Platinum': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Achievement Management</h2>
          <p className="text-slate-500">Manage achievements and track member accomplishments</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus size={16} className="mr-2" />
            Create Achievement
          </Button>
        )}
      </div>

      <Tabs
        tabs={['All Achievements', 'My Achievements', 'Progress Dashboard']}
        activeTab={activeTab === 'all' ? 'All Achievements' : activeTab === 'my' ? 'My Achievements' : 'Progress Dashboard'}
        onTabChange={(tab) => setActiveTab(tab === 'All Achievements' ? 'all' : tab === 'My Achievements' ? 'my' : 'dashboard')}
      />

      {activeTab === 'all' ? (
        <LoadingState loading={loading} error={error} empty={filteredAchievements.length === 0} emptyMessage="No achievements defined yet">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAchievements.map(achievement => (
              <Card key={achievement.id} className={`hover:shadow-lg transition-shadow border-2 ${getTierColor(achievement.tier)}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="text-5xl">{achievement.icon}</div>
                  <div className="flex gap-2">
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedAchievement(achievement);
                            setMilestones(achievement.milestones || []);
                            setEditModalOpen(true);
                          }}
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedAchievement(achievement);
                            setAwardModalOpen(true);
                          }}
                        >
                          <Award size={16} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-1">{achievement.name}</h3>
                <p className="text-sm text-slate-600 mb-3">{achievement.description}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="neutral" className={getTierColor(achievement.tier)}>
                    {getTierIcon(achievement.tier)} {achievement.tier}
                  </Badge>
                  <Badge variant="info">{achievement.category}</Badge>
                  {achievement.pointsReward > 0 && (
                    <Badge variant="success">+{achievement.pointsReward} pts</Badge>
                  )}
                </div>
                {achievement.milestones && achievement.milestones.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-slate-700 mb-1">Milestones:</p>
                    <div className="flex flex-wrap gap-1">
                      {achievement.milestones.map((milestone, index) => (
                        <Badge key={index} variant="neutral">
                          {milestone.level}: {milestone.threshold}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-xs text-slate-500">
                  <p><strong>Criteria:</strong> {achievement.criteria.description || `${achievement.criteria.type.replace(/_/g, ' ')}: ${achievement.criteria.value}`}</p>
                </div>
              </Card>
            ))}
          </div>
        </LoadingState>
      ) : activeTab === 'my' ? (
        <LoadingState loading={loading} error={error} empty={filteredMemberAchievements.length === 0} emptyMessage="You haven't earned any achievements yet">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMemberAchievements.map((award) => {
              const achievement = achievements.find(a => a.id === award.achievementId);
              if (!achievement) return null;

              return (
                <Card key={award.id} className={`hover:shadow-lg transition-shadow border-2 ${getTierColor(achievement.tier)}`}>
                  <div className="text-5xl mb-4">{achievement.icon}</div>
                  <h3 className="font-bold text-lg text-slate-900 mb-1">{achievement.name}</h3>
                  <p className="text-sm text-slate-600 mb-3">{achievement.description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="neutral" className={getTierColor(achievement.tier)}>
                      {getTierIcon(achievement.tier)} {achievement.tier}
                    </Badge>
                    {achievement.pointsReward > 0 && (
                      <Badge variant="success">+{achievement.pointsReward} pts</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Earned: {formatDate(new Date(award.earnedAt))}
                  </p>
                </Card>
              );
            })}
          </div>
        </LoadingState>
      ) : (
        // Progress Dashboard
        currentMember && (
          <AchievementDashboard
            memberId={currentMember.id}
            achievements={achievements}
            memberProgress={memberProgress}
            currentMemberData={{
              points: currentMember.points,
              eventCount: 0, // This would come from actual event attendance data
              projectCount: 0, // This would come from actual project participation data
              recruitmentCount: 0, // This would come from actual recruitment data
            }}
          />
        )
      )}

      {/* Create Achievement Modal */}
      {canManage && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Create Achievement"
          size="lg"
          drawerOnMobile
        >
          <form onSubmit={handleCreateAchievement} className="space-y-4">
            <Input name="name" label="Achievement Name" placeholder="e.g., First Steps" required />
            <Textarea name="description" label="Description" placeholder="Describe what this achievement represents" required />
            <Input name="icon" label="Icon (Emoji)" placeholder="🏆" defaultValue="⭐" required />
            <Select
              name="category"
              label="Category"
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
              required
            />
            <Select
              name="tier"
              label="Tier"
              options={[
                { label: 'Bronze', value: 'Bronze' },
                { label: 'Silver', value: 'Silver' },
                { label: 'Gold', value: 'Gold' },
                { label: 'Platinum', value: 'Platinum' },
              ]}
              required
            />
            <Input name="pointsReward" label="Points Reward" type="number" min="0" defaultValue="0" />
            <Select
              name="criteriaType"
              label="Criteria Type"
              options={[
                { label: 'Points Threshold', value: 'points_threshold' },
                { label: 'Event Count', value: 'event_count' },
                { label: 'Project Count', value: 'project_count' },
                { label: 'Consecutive Attendance', value: 'consecutive_attendance' },
                { label: 'Role Held', value: 'role_held' },
                { label: 'Training Completed', value: 'training_completed' },
                { label: 'Recruitment Count', value: 'recruitment_count' },
                { label: 'Custom', value: 'custom' },
              ]}
              required
            />
            <Input name="criteriaValue" label="Criteria Value" type="number" min="1" required />
            <Input name="criteriaDescription" label="Criteria Description" placeholder="e.g., Attend 10 events" required />
            <Select
              name="criteriaTimeframe"
              label="Timeframe (Optional)"
              options={[
                { label: 'Lifetime', value: 'lifetime' },
                { label: 'Yearly', value: 'yearly' },
                { label: 'Quarterly', value: 'quarterly' },
                { label: 'Monthly', value: 'monthly' },
              ]}
            />

            {/* Milestones Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">Milestones (Optional)</label>
                <Button type="button" size="sm" variant="ghost" onClick={addMilestone}>
                  <Plus size={16} className="mr-1" />
                  Add Milestone
                </Button>
              </div>
              {milestones.map((milestone, index) => (
                <div key={index} className="p-3 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Milestone {index + 1}</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeMilestone(index)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      label="Level"
                      value={milestone.level}
                      onChange={(e) => updateMilestone(index, 'level', e.target.value)}
                      options={[
                        { label: 'Bronze', value: 'Bronze' },
                        { label: 'Silver', value: 'Silver' },
                        { label: 'Gold', value: 'Gold' },
                        { label: 'Platinum', value: 'Platinum' },
                      ]}
                    />
                    <Input
                      label="Threshold"
                      type="number"
                      value={milestone.threshold}
                      onChange={(e) => updateMilestone(index, 'threshold', parseInt(e.target.value))}
                      min="1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Point Value"
                      type="number"
                      value={milestone.pointValue}
                      onChange={(e) => updateMilestone(index, 'pointValue', parseInt(e.target.value))}
                      min="0"
                    />
                    <Input
                      label="Reward (Optional)"
                      value={milestone.reward || ''}
                      onChange={(e) => updateMilestone(index, 'reward', e.target.value || undefined)}
                      placeholder="e.g., Special Badge"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Create Achievement
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Achievement Modal */}
      {canManage && selectedAchievement && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setSelectedAchievement(null);
          }}
          title="Edit Achievement"
          size="lg"
          drawerOnMobile
        >
          <form onSubmit={handleUpdateAchievement} className="space-y-4">
            <Input name="name" label="Achievement Name" defaultValue={selectedAchievement.name} required />
            <Textarea name="description" label="Description" defaultValue={selectedAchievement.description} required />
            <Input name="icon" label="Icon (Emoji)" defaultValue={selectedAchievement.icon} required />
            <Select
              name="category"
              label="Category"
              value={selectedAchievement.category}
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
              required
            />
            <Select
              name="tier"
              label="Tier"
              value={selectedAchievement.tier}
              options={[
                { label: 'Bronze', value: 'Bronze' },
                { label: 'Silver', value: 'Silver' },
                { label: 'Gold', value: 'Gold' },
                { label: 'Platinum', value: 'Platinum' },
              ]}
              required
            />
            <Input name="pointsReward" label="Points Reward" type="number" defaultValue={selectedAchievement.pointsReward?.toString()} />
            <Select
              name="criteriaType"
              label="Criteria Type"
              value={selectedAchievement.criteria.type}
              options={[
                { label: 'Points Threshold', value: 'points_threshold' },
                { label: 'Event Count', value: 'event_count' },
                { label: 'Project Count', value: 'project_count' },
                { label: 'Consecutive Attendance', value: 'consecutive_attendance' },
                { label: 'Role Held', value: 'role_held' },
                { label: 'Training Completed', value: 'training_completed' },
                { label: 'Recruitment Count', value: 'recruitment_count' },
                { label: 'Custom', value: 'custom' },
              ]}
              required
            />
            <Input name="criteriaValue" label="Criteria Value" type="number" defaultValue={selectedAchievement.criteria.value.toString()} required />
            <Input name="criteriaDescription" label="Criteria Description" defaultValue={selectedAchievement.criteria.description || ''} />
            <Select
              name="criteriaTimeframe"
              label="Timeframe"
              value={selectedAchievement.criteria.timeframe || 'lifetime'}
              options={[
                { label: 'Lifetime', value: 'lifetime' },
                { label: 'Yearly', value: 'yearly' },
                { label: 'Quarterly', value: 'quarterly' },
                { label: 'Monthly', value: 'monthly' },
              ]}
            />

            {/* Milestones Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">Milestones (Optional)</label>
                <Button type="button" size="sm" variant="ghost" onClick={addMilestone}>
                  <Plus size={16} className="mr-1" />
                  Add Milestone
                </Button>
              </div>
              {milestones.map((milestone, index) => (
                <div key={index} className="p-3 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Milestone {index + 1}</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeMilestone(index)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      label="Level"
                      value={milestone.level}
                      onChange={(e) => updateMilestone(index, 'level', e.target.value)}
                      options={[
                        { label: 'Bronze', value: 'Bronze' },
                        { label: 'Silver', value: 'Silver' },
                        { label: 'Gold', value: 'Gold' },
                        { label: 'Platinum', value: 'Platinum' },
                      ]}
                    />
                    <Input
                      label="Threshold"
                      type="number"
                      value={milestone.threshold}
                      onChange={(e) => updateMilestone(index, 'threshold', parseInt(e.target.value))}
                      min="1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Point Value"
                      type="number"
                      value={milestone.pointValue}
                      onChange={(e) => updateMilestone(index, 'pointValue', parseInt(e.target.value))}
                      min="0"
                    />
                    <Input
                      label="Reward (Optional)"
                      value={milestone.reward || ''}
                      onChange={(e) => updateMilestone(index, 'reward', e.target.value || undefined)}
                      placeholder="e.g., Special Badge"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="ghost" onClick={() => {
                setEditModalOpen(false);
                setSelectedAchievement(null);
              }}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Update Achievement
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Award Achievement Modal */}
      {canManage && selectedAchievement && (
        <Modal
          isOpen={isAwardModalOpen}
          onClose={() => {
            setAwardModalOpen(false);
            setSelectedAchievement(null);
            setSelectedMemberId('');
          }}
          title={`Award Achievement: ${selectedAchievement.name}`}
          drawerOnMobile
        >
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-6xl mb-4">{selectedAchievement.icon}</div>
              <p className="text-sm text-slate-600">{selectedAchievement.description}</p>
            </div>
            <Select
              label="Select Member"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              options={members.map(m => ({ label: m.name, value: m.id }))}
              required
            />
            <div className="flex gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setAwardModalOpen(false);
                  setSelectedAchievement(null);
                  setSelectedMemberId('');
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAwardAchievement} className="flex-1" disabled={!selectedMemberId}>
                Award Achievement
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

