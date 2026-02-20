// Badge Management View - Manage badge definitions and awards
import React, { useState } from 'react';
import { Award, Plus, Edit, Trash2, Star, Crown, Zap, Target, Users } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useBadges } from '../../hooks/useBadges';
import { useMembers } from '../../hooks/useMembers';
import { usePermissions } from '../../hooks/usePermissions';
import { BadgeDefinition } from '../../services/badgeService';
import { formatDate } from '../../utils/dateUtils';

export const BadgeManagementView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('badges');
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isAwardModalOpen, setAwardModalOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<BadgeDefinition | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [awardReason, setAwardReason] = useState('');

  const { badges, memberBadges, loading, error, createBadge, updateBadge, deleteBadge, awardBadge } = useBadges();
  const { members, loading: membersLoading } = useMembers();
  const { isAdmin, isBoard } = usePermissions();
  const { showToast } = useToast();

  const canManage = isAdmin || isBoard;

  const handleCreateBadge = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      let conditions = {};
      try {
        const conditionsStr = formData.get('criteriaConditions') as string;
        if (conditionsStr && conditionsStr.trim()) {
          conditions = JSON.parse(conditionsStr);
        }
      } catch (err) {
        showToast('Invalid JSON in criteria conditions', 'error');
        return;
      }

      await createBadge({
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        icon: formData.get('icon') as string,
        category: formData.get('category') as BadgeDefinition['category'],
        tier: formData.get('tier') as BadgeDefinition['tier'],
        pointsRequired: formData.get('pointsRequired') ? parseInt(formData.get('pointsRequired') as string) : undefined,
        criteria: {
          type: formData.get('criteriaType') as BadgeDefinition['criteria']['type'],
          threshold: parseInt(formData.get('criteriaThreshold') as string),
          conditions,
        },
        rarity: formData.get('rarity') as BadgeDefinition['rarity'],
        pointValue: parseInt(formData.get('pointValue') as string),
        isActive: true,
      });
      setCreateModalOpen(false);
      e.currentTarget.reset();
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleUpdateBadge = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBadge?.id) return;

    const formData = new FormData(e.currentTarget);

    try {
      let conditions = {};
      try {
        const conditionsStr = formData.get('criteriaConditions') as string;
        if (conditionsStr && conditionsStr.trim()) {
          conditions = JSON.parse(conditionsStr);
        }
      } catch (err) {
        showToast('Invalid JSON in criteria conditions', 'error');
        return;
      }

      await updateBadge(selectedBadge.id, {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        icon: formData.get('icon') as string,
        category: formData.get('category') as BadgeDefinition['category'],
        tier: formData.get('tier') as BadgeDefinition['tier'],
        pointsRequired: formData.get('pointsRequired') ? parseInt(formData.get('pointsRequired') as string) : undefined,
        criteria: {
          type: formData.get('criteriaType') as BadgeDefinition['criteria']['type'],
          threshold: parseInt(formData.get('criteriaThreshold') as string),
          conditions,
        },
        rarity: formData.get('rarity') as BadgeDefinition['rarity'],
        pointValue: parseInt(formData.get('pointValue') as string),
      });
      setEditModalOpen(false);
      setSelectedBadge(null);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleAwardBadge = async () => {
    if (!selectedBadge?.id || !selectedMemberId) {
      showToast('Please select a badge and member', 'error');
      return;
    }

    try {
      await awardBadge(selectedBadge.id, selectedMemberId, awardReason);
      setAwardModalOpen(false);
      setSelectedBadge(null);
      setSelectedMemberId('');
      setAwardReason('');
    } catch (err) {
      // Error handled in hook
    }
  };

  const getTierIcon = (tier: BadgeDefinition['tier']) => {
    switch (tier) {
      case 'bronze': return '🥉';
      case 'silver': return '🥈';
      case 'gold': return '🥇';
      case 'platinum': return '💎';
      case 'legendary': return '👑';
      default: return '⭐';
    }
  };

  const getRarityColor = (rarity: BadgeDefinition['rarity']) => {
    switch (rarity) {
      case 'common': return 'bg-slate-100 text-slate-700';
      case 'rare': return 'bg-blue-100 text-blue-700';
      case 'epic': return 'bg-purple-100 text-purple-700';
      case 'legendary': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Badge Management</h2>
          <p className="text-slate-500">Manage achievement badges and awards</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus size={16} className="mr-2" />
            Create Badge
          </Button>
        )}
      </div>

      <div className="px-4 md:px-0">
        <Tabs
          tabs={['All Badges', 'My Badges']}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {activeTab === 'All Badges' ? (
        <LoadingState loading={loading} error={error} empty={badges.length === 0} emptyMessage="No badges defined yet">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {badges.map(badge => (
              <Card key={badge.id} className="hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-5xl">{badge.icon}</div>
                  <div className="flex gap-2">
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedBadge(badge);
                            setEditModalOpen(true);
                          }}
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedBadge(badge);
                            setAwardModalOpen(true);
                          }}
                        >
                          <Award size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this badge?')) {
                              await deleteBadge(badge.id!);
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-1">{badge.name}</h3>
                <p className="text-sm text-slate-600 mb-3">{badge.description}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="neutral" className={getRarityColor(badge.rarity)}>
                    {badge.rarity}
                  </Badge>
                  <Badge variant="neutral">
                    {getTierIcon(badge.tier)} {badge.tier}
                  </Badge>
                  <Badge variant="info">{badge.category}</Badge>
                </div>
                <div className="text-xs text-slate-500">
                  <p><strong>Criteria:</strong> {badge.criteria.type} ≥ {badge.criteria.threshold}</p>
                  {badge.pointsRequired && (
                    <p><strong>Points Required:</strong> {badge.pointsRequired}</p>
                  )}
                  <p><strong>Point Value:</strong> {badge.pointValue} pts</p>
                </div>
              </Card>
            ))}
          </div>
        </LoadingState>
      ) : (
        <LoadingState loading={loading} error={error} empty={memberBadges.length === 0} emptyMessage="You haven't earned any badges yet">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberBadges.map((badge) => (
              <Card key={badge.id} className="hover:shadow-lg transition-shadow">
                <div className="text-5xl mb-4">{badge.icon}</div>
                <h3 className="font-bold text-lg text-slate-900 mb-1">{badge.name}</h3>
                <p className="text-sm text-slate-600 mb-3">{badge.description}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="neutral" className={getRarityColor(badge.rarity)}>
                    {badge.rarity}
                  </Badge>
                  <Badge variant="neutral">
                    {getTierIcon(badge.tier)} {badge.tier}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Earned: {formatDate(badge.awardedAt)}
                </p>
              </Card>
            ))}
          </div>
        </LoadingState>
      )}

      {/* Create Badge Modal */}
      {canManage && (
        <Modal
          onClose={() => setCreateModalOpen(false)}
          title="Create Badge"
          size="lg"
          drawerOnMobile
        >
          <form onSubmit={handleCreateBadge} className="space-y-4">
            <Input name="name" label="Badge Name" placeholder="e.g., First Steps" required />
            <Textarea name="description" label="Description" placeholder="Describe what this badge represents" required />
            <Input name="icon" label="Icon (Emoji)" placeholder="🎯" defaultValue="⭐" required />
            <Select
              name="category"
              label="Category"
              options={[
                { label: 'Achievement', value: 'achievement' },
                { label: 'Milestone', value: 'milestone' },
                { label: 'Special', value: 'special' },
                { label: 'Event', value: 'event' },
                { label: 'Leadership', value: 'leadership' },
              ]}
              required
            />
            <Select
              name="tier"
              label="Tier"
              options={[
                { label: 'Bronze', value: 'bronze' },
                { label: 'Silver', value: 'silver' },
                { label: 'Gold', value: 'gold' },
                { label: 'Platinum', value: 'platinum' },
                { label: 'Legendary', value: 'legendary' },
              ]}
              required
            />
            <Select
              name="rarity"
              label="Rarity"
              options={[
                { label: 'Common', value: 'common' },
                { label: 'Rare', value: 'rare' },
                { label: 'Epic', value: 'epic' },
                { label: 'Legendary', value: 'legendary' },
              ]}
              required
            />
            <Input name="pointsRequired" label="Points Required (Optional)" type="number" min="0" />
            <Select
              name="criteriaType"
              label="Criteria Type"
              options={[
                { label: 'Points Threshold', value: 'points_threshold' },
                { label: 'Event Attendance', value: 'event_attendance' },
                { label: 'Project Completion', value: 'project_completion' },
                { label: 'Custom', value: 'custom' },
              ]}
              required
            />
            <Input name="criteriaThreshold" label="Criteria Threshold" type="number" min="1" required />
            <Textarea name="criteriaConditions" label="Criteria Conditions (JSON)" placeholder='{"eventType": "Social"}' />
            <Input name="pointValue" label="Point Value" type="number" min="0" defaultValue="50" required />
            <div className="flex gap-3 pt-4">
              <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Create Badge
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Badge Modal */}
      {canManage && selectedBadge && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedBadge(null);
          }}
          title="Edit Badge"
          size="lg"
          drawerOnMobile
        >
          <form onSubmit={handleUpdateBadge} className="space-y-4">
            <Input name="name" label="Badge Name" defaultValue={selectedBadge.name} required />
            <Textarea name="description" label="Description" defaultValue={selectedBadge.description} required />
            <Input name="icon" label="Icon (Emoji)" defaultValue={selectedBadge.icon} required />
            <Select
              name="category"
              label="Category"
              value={selectedBadge.category}
              options={[
                { label: 'Achievement', value: 'achievement' },
                { label: 'Milestone', value: 'milestone' },
                { label: 'Special', value: 'special' },
                { label: 'Event', value: 'event' },
                { label: 'Leadership', value: 'leadership' },
              ]}
              required
            />
            <Select
              name="tier"
              label="Tier"
              value={selectedBadge.tier}
              options={[
                { label: 'Bronze', value: 'bronze' },
                { label: 'Silver', value: 'silver' },
                { label: 'Gold', value: 'gold' },
                { label: 'Platinum', value: 'platinum' },
                { label: 'Legendary', value: 'legendary' },
              ]}
              required
            />
            <Select
              name="rarity"
              label="Rarity"
              value={selectedBadge.rarity}
              options={[
                { label: 'Common', value: 'common' },
                { label: 'Rare', value: 'rare' },
                { label: 'Epic', value: 'epic' },
                { label: 'Legendary', value: 'legendary' },
              ]}
              required
            />
            <Input name="pointsRequired" label="Points Required" type="number" defaultValue={selectedBadge.pointsRequired?.toString()} />
            <Select
              name="criteriaType"
              label="Criteria Type"
              value={selectedBadge.criteria.type}
              options={[
                { label: 'Points Threshold', value: 'points_threshold' },
                { label: 'Event Attendance', value: 'event_attendance' },
                { label: 'Project Completion', value: 'project_completion' },
                { label: 'Custom', value: 'custom' },
              ]}
              required
            />
            <Input name="criteriaThreshold" label="Criteria Threshold" type="number" defaultValue={selectedBadge.criteria.threshold.toString()} required />
            <Textarea name="criteriaConditions" label="Criteria Conditions (JSON)" defaultValue={JSON.stringify(selectedBadge.criteria.conditions || {}, null, 2)} />
            <Input name="pointValue" label="Point Value" type="number" defaultValue={selectedBadge.pointValue?.toString() || '50'} required />
            <div className="flex gap-3 pt-4">
              <Button variant="ghost" onClick={() => {
                setEditModalOpen(false);
                setSelectedBadge(null);
              }}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Update Badge
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Award Badge Modal */}
      {canManage && selectedBadge && (
        <Modal
          isOpen={isAwardModalOpen}
          onClose={() => {
            setAwardModalOpen(false);
            setSelectedBadge(null);
            setSelectedMemberId('');
            setAwardReason('');
          }}
          title={`Award Badge: ${selectedBadge.name}`}
          drawerOnMobile
        >
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-6xl mb-4">{selectedBadge.icon}</div>
              <p className="text-sm text-slate-600">{selectedBadge.description}</p>
            </div>
            <Select
              label="Select Member"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              options={members.map(m => ({ label: m.name, value: m.id }))}
              required
            />
            <Textarea
              label="Reason (Optional)"
              value={awardReason}
              onChange={(e) => setAwardReason(e.target.value)}
              placeholder="Why is this badge being awarded?"
            />
            <div className="flex gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setAwardModalOpen(false);
                  setSelectedBadge(null);
                  setSelectedMemberId('');
                  setAwardReason('');
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAwardBadge} className="flex-1" disabled={!selectedMemberId}>
                Award Badge
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

