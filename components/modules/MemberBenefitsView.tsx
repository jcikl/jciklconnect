import React, { useState, useEffect } from 'react';
import { Gift, Plus, Edit, Trash2, Users, TrendingUp, Calendar, Tag, CheckCircle, History, Eye } from 'lucide-react';
import { Button, Card, Badge, Modal, useToast, Tabs } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useMemberBenefits } from '../../hooks/useMemberBenefits';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useMembers } from '../../hooks/useMembers';
import { MemberBenefit } from '../../services/memberBenefitsService';
import { formatDate, toDate } from '../../utils/dateUtils';

export const MemberBenefitsView: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBenefit, setSelectedBenefit] = useState<MemberBenefit | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'usage'>('all');
  const [myBenefits, setMyBenefits] = useState<MemberBenefit[]>([]);
  const [selectedBenefitForUsage, setSelectedBenefitForUsage] = useState<MemberBenefit | null>(null);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const { benefits, loading, error, createBenefit, updateBenefit, deleteBenefit, getEligibleBenefits, recordUsage, getUsageHistory } = useMemberBenefits();
  const { member } = useAuth();
  const { isBoard, isAdmin } = usePermissions();
  const { showToast } = useToast();

  useEffect(() => {
    if (member && activeTab === 'my') {
      loadMyBenefits();
    }
  }, [member, activeTab]);

  const loadMyBenefits = async () => {
    if (!member) return;
    try {
      const eligible = await getEligibleBenefits(
        member.id,
        member.tier,
        member.points,
        member.role,
        member.joinDate
      );
      setMyBenefits(eligible);
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!member) return;

    const formData = new FormData(e.currentTarget);
    const benefitData: Omit<MemberBenefit, 'id' | 'createdAt' | 'updatedAt' | 'currentUsage'> = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      type: formData.get('type') as any,
      category: formData.get('category') as any,
      discountPercentage: formData.get('discountPercentage') ? parseFloat(formData.get('discountPercentage') as string) : undefined,
      discountAmount: formData.get('discountAmount') ? parseFloat(formData.get('discountAmount') as string) : undefined,
      eligibilityCriteria: {
        tier: formData.get('eligibleTiers') ? (formData.get('eligibleTiers') as string).split(',').filter(Boolean) : undefined,
        role: formData.get('eligibleRoles') ? (formData.get('eligibleRoles') as string).split(',').filter(Boolean) : undefined,
        points: formData.get('minPoints') ? parseInt(formData.get('minPoints') as string) : undefined,
      },
      validFrom: formData.get('validFrom') as string,
      validUntil: formData.get('validUntil') as string || undefined,
      usageLimit: formData.get('usageLimit') ? parseInt(formData.get('usageLimit') as string) : undefined,
      status: (formData.get('status') as any) || 'Active',
      provider: formData.get('provider') as string || undefined,
      termsAndConditions: formData.get('terms') as string || undefined,
    };

    try {
      if (selectedBenefit) {
        await updateBenefit(selectedBenefit.id!, benefitData);
      } else {
        await createBenefit(benefitData);
      }
      setIsModalOpen(false);
      setSelectedBenefit(null);
      e.currentTarget.reset();
    } catch (err) {
      // Error handled by hook
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Discount': return '💰';
      case 'Exclusive Access': return '🎫';
      case 'Free Service': return '🎁';
      case 'Priority': return '⭐';
      default: return '🎯';
    }
  };

  const displayBenefits = activeTab === 'my' ? myBenefits : benefits;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Member Benefits</h2>
          <p className="text-slate-500">Manage exclusive benefits and privileges for members.</p>
        </div>
        {(isBoard || isAdmin) && (
          <Button onClick={() => {
            setSelectedBenefit(null);
            setIsModalOpen(true);
          }}>
            <Plus size={16} className="mr-2" />
            Add Benefit
          </Button>
        )}
      </div>

      <Card noPadding>
        <div className="px-4 md:px-6 pt-4">
          <Tabs
            tabs={['All Benefits', 'My Benefits']}
            activeTab={activeTab === 'all' ? 'All Benefits' : 'My Benefits'}
            onTabChange={(tab) => setActiveTab(tab === 'All Benefits' ? 'all' : 'my')}
          />
        </div>
        <div className="p-6">
          <LoadingState loading={loading} error={error} empty={displayBenefits.length === 0} emptyMessage="No benefits available">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayBenefits.map(benefit => (
                <Card key={benefit.id} className="hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-3xl">{getTypeIcon(benefit.type)}</div>
                    <Badge variant={benefit.status === 'Active' ? 'success' : 'neutral'}>
                      {benefit.status}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 mb-2">{benefit.name}</h3>
                  <p className="text-sm text-slate-600 mb-4">{benefit.description}</p>

                  <div className="space-y-2 mb-4">
                    {benefit.discountPercentage && (
                      <div className="flex items-center gap-2 text-sm">
                        <Tag size={14} className="text-green-600" />
                        <span className="font-semibold text-green-600">{benefit.discountPercentage}% Off</span>
                      </div>
                    )}
                    {benefit.discountAmount && (
                      <div className="flex items-center gap-2 text-sm">
                        <Tag size={14} className="text-green-600" />
                        <span className="font-semibold text-green-600">RM {benefit.discountAmount} Off</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Users size={12} />
                      <span>{benefit.currentUsage || 0} uses</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar size={12} />
                      <span>Valid until {benefit.validUntil ? formatDate(toDate(benefit.validUntil).toISOString()) : 'Ongoing'}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    {(isBoard || isAdmin) && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBenefit(benefit);
                            setIsModalOpen(true);
                          }}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this benefit?')) {
                              await deleteBenefit(benefit.id!);
                            }
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                    {activeTab === 'my' && (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={async () => {
                          if (!member) {
                            showToast('Please login to claim benefits', 'error');
                            return;
                          }

                          try {
                            // Check if benefit has usage limit
                            if (benefit.usageLimit) {
                              // In a real implementation, we would check member's usage count
                              // For now, we'll just record the usage
                            }

                            await recordUsage(member.id, benefit.id!, `Claimed ${benefit.name}`);
                            showToast('Benefit claimed! Details will be sent via email.', 'success');

                            // Reload eligible benefits to update usage counts
                            await loadMyBenefits();
                          } catch (err) {
                            // Error handled by hook
                          }
                        }}
                      >
                        <CheckCircle size={14} className="mr-2" />
                        Claim Benefit
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </LoadingState>

          {activeTab === 'usage' && (
            <UsageTrackingTab
              benefits={benefits}
              member={member}
              onViewUsage={(benefit) => {
                setSelectedBenefitForUsage(benefit);
                setIsUsageModalOpen(true);
              }}
              getUsageHistory={getUsageHistory}
            />
          )}
        </div>
      </Card>

      {/* Create/Edit Benefit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBenefit(null);
        }}
        title={selectedBenefit ? 'Edit Benefit' : 'Create New Benefit'}
        size="lg"
        drawerOnMobile
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            name="name"
            label="Benefit Name"
            placeholder="e.g. 20% Off Event Tickets"
            defaultValue={selectedBenefit?.name}
            required
          />

          <Textarea
            name="description"
            label="Description"
            placeholder="Describe the benefit..."
            defaultValue={selectedBenefit?.description}
            rows={3}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              name="type"
              label="Type"
              defaultValue={selectedBenefit?.type}
              options={[
                { label: 'Discount', value: 'Discount' },
                { label: 'Exclusive Access', value: 'Exclusive Access' },
                { label: 'Free Service', value: 'Free Service' },
                { label: 'Priority', value: 'Priority' },
                { label: 'Other', value: 'Other' },
              ]}
              required
            />
            <Select
              name="category"
              label="Category"
              defaultValue={selectedBenefit?.category}
              options={[
                { label: 'Event', value: 'Event' },
                { label: 'Training', value: 'Training' },
                { label: 'Business', value: 'Business' },
                { label: 'Social', value: 'Social' },
                { label: 'General', value: 'General' },
              ]}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="discountPercentage"
              label="Discount Percentage (%)"
              type="number"
              min="0"
              max="100"
              defaultValue={selectedBenefit?.discountPercentage?.toString()}
            />
            <Input
              name="discountAmount"
              label="Discount Amount (RM)"
              type="number"
              min="0"
              defaultValue={selectedBenefit?.discountAmount?.toString()}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Eligibility Criteria</label>
            <Input
              name="eligibleTiers"
              label="Eligible Tiers (comma-separated)"
              placeholder="e.g. Silver,Gold,Platinum"
              defaultValue={selectedBenefit?.eligibilityCriteria?.tier?.join(',')}
            />
            <Input
              name="eligibleRoles"
              label="Eligible Roles (comma-separated)"
              placeholder="e.g. MEMBER,BOARD"
              defaultValue={selectedBenefit?.eligibilityCriteria?.role?.join(',')}
            />
            <Input
              name="minPoints"
              label="Minimum Points"
              type="number"
              min="0"
              defaultValue={selectedBenefit?.eligibilityCriteria?.points?.toString()}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="validFrom"
              label="Valid From"
              type="date"
              defaultValue={selectedBenefit?.validFrom ? toDate(selectedBenefit.validFrom).toISOString().split('T')[0] : undefined}
              required
            />
            <Input
              name="validUntil"
              label="Valid Until (Optional)"
              type="date"
              defaultValue={selectedBenefit?.validUntil ? toDate(selectedBenefit.validUntil).toISOString().split('T')[0] : undefined}
            />
          </div>

          <Input
            name="usageLimit"
            label="Usage Limit per Member (Optional)"
            type="number"
            min="1"
            defaultValue={selectedBenefit?.usageLimit?.toString()}
          />

          <Input
            name="provider"
            label="Provider (Optional)"
            placeholder="Business/partner name"
            defaultValue={selectedBenefit?.provider}
          />

          <Textarea
            name="terms"
            label="Terms & Conditions (Optional)"
            placeholder="Terms and conditions..."
            defaultValue={selectedBenefit?.termsAndConditions}
            rows={3}
          />

          <Select
            name="status"
            label="Status"
            defaultValue={selectedBenefit?.status || 'Active'}
            options={[
              { label: 'Active', value: 'Active' },
              { label: 'Inactive', value: 'Inactive' },
              { label: 'Expired', value: 'Expired' },
            ]}
          />

          <div className="flex gap-3 pt-4">
            <Button className="flex-1" type="submit">
              {selectedBenefit ? 'Update Benefit' : 'Create Benefit'}
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setSelectedBenefit(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Usage History Modal */}
      {selectedBenefitForUsage && (
        <UsageHistoryModal
          isOpen={isUsageModalOpen}
          onClose={() => {
            setIsUsageModalOpen(false);
            setSelectedBenefitForUsage(null);
          }}
          benefit={selectedBenefitForUsage}
          getUsageHistory={getUsageHistory}
        />
      )}
    </div>
  );
};

// Usage Tracking Tab Component
interface UsageTrackingTabProps {
  benefits: MemberBenefit[];
  member: any;
  onViewUsage: (benefit: MemberBenefit) => void;
  getUsageHistory: (benefitId?: string, memberId?: string) => Promise<any[]>;
}

const UsageTrackingTab: React.FC<UsageTrackingTabProps> = ({ benefits, member, onViewUsage, getUsageHistory }) => {
  const [usageStats, setUsageStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadUsageStats();
  }, [benefits]);

  const loadUsageStats = async () => {
    setLoading(true);
    try {
      const stats: Record<string, number> = {};
      for (const benefit of benefits) {
        if (benefit.id) {
          const history = await getUsageHistory(benefit.id, member?.id);
          stats[benefit.id] = history.length;
        }
      }
      setUsageStats(stats);
    } catch (err) {
      showToast('Failed to load usage statistics', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Usage Tracking</h3>
          <p className="text-sm text-slate-500">Track benefit usage across all members</p>
        </div>
      </div>

      <LoadingState loading={loading} error={null} empty={benefits.length === 0} emptyMessage="No benefits available">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map(benefit => (
            <Card key={benefit.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="text-2xl">{benefit.name.charAt(0)}</div>
                <Badge variant={benefit.status === 'Active' ? 'success' : 'neutral'}>
                  {benefit.status}
                </Badge>
              </div>
              <h4 className="font-semibold text-slate-900 mb-2">{benefit.name}</h4>
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total Usage:</span>
                  <span className="font-semibold text-slate-900">{benefit.currentUsage || 0}</span>
                </div>
                {member && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">My Usage:</span>
                    <span className="font-semibold text-slate-900">{usageStats[benefit.id!] || 0}</span>
                  </div>
                )}
                {benefit.usageLimit && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Limit:</span>
                    <span className="font-semibold text-slate-900">{benefit.usageLimit}</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onViewUsage(benefit)}
              >
                <History size={14} className="mr-2" />
                View Usage History
              </Button>
            </Card>
          ))}
        </div>
      </LoadingState>
    </div>
  );
};

// Usage History Modal Component
interface UsageHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  benefit: MemberBenefit;
  getUsageHistory: (benefitId?: string, memberId?: string) => Promise<any[]>;
}

const UsageHistoryModal: React.FC<UsageHistoryModalProps> = ({ isOpen, onClose, benefit, getUsageHistory }) => {
  const [usageHistory, setUsageHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const { members } = useMembers();

  useEffect(() => {
    if (isOpen && benefit.id) {
      loadHistory();
    }
  }, [isOpen, benefit.id]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const history = await getUsageHistory(benefit.id);
      setUsageHistory(history);
    } catch (err) {
      showToast('Failed to load usage history', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Usage History - ${benefit.name}`} size="lg" drawerOnMobile>
      <LoadingState loading={loading} error={null} empty={usageHistory.length === 0} emptyMessage="No usage history found">
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {usageHistory.map(usage => {
            const member = members.find(m => m.id === usage.memberId);
            return (
              <Card key={usage.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{member?.name || 'Unknown Member'}</p>
                    <p className="text-sm text-slate-500">{formatDate(usage.usedAt)}</p>
                    {usage.details && (
                      <p className="text-sm text-slate-600 mt-1">{usage.details}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </LoadingState>
    </Modal>
  );
};

