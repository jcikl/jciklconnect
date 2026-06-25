import React, { useState, useEffect, useMemo } from 'react';
import { Gift, Users, Calendar, CheckCircle, History, AlertCircle } from 'lucide-react';
import { Button, Card, Badge, Modal, useToast } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useAdvertisements } from '../../hooks/useAdvertisements';
import { useAuth } from '../../hooks/useAuth';
import { useMembers } from '../../hooks/useMembers';
import { Advertisement, BenefitUsage } from '../../services/advertisementService';
import { formatDate, toDate } from '../../utils/dateUtils';
import { PartnershipDetailModal } from '../dashboard/PartnershipDetailModal';

export const MemberBenefitsView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const [claimedBenefitIds, setClaimedBenefitIds] = useState<Set<string>>(new Set());
  const [selectedBenefitForDetail, setSelectedBenefitForDetail] = useState<Advertisement | null>(null);
  const [selectedBenefitForUsage, setSelectedBenefitForUsage] = useState<Advertisement | null>(null);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [recordedImpressions, setRecordedImpressions] = useState<Set<string>>(new Set());
  const { advertisements, loading, error, recordClick, recordImpression, getBenefitUsageHistory } = useAdvertisements();
  const { member } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (member) {
      loadClaimedBenefits();
    }
  }, [member, advertisements]);

  const loadClaimedBenefits = async () => {
    if (!member) return;
    try {
      const history = await getBenefitUsageHistory(undefined, member.id);
      const claimedIds = new Set<string>(history.map(h => h.benefitId));
      setClaimedBenefitIds(claimedIds);
    } catch (err) {
      // Error handled by hook
    }
  };

  const displayBenefits = useMemo(() => {
    // Display all active advertisements
    let filtered = advertisements.filter(ad => ad.status === 'Active');
    const term = (searchQuery || '').toLowerCase();

    if (term) {
      filtered = filtered.filter(b =>
        (b.title ?? '').toLowerCase().includes(term) ||
        (b.description ?? '').toLowerCase().includes(term) ||
        (b.provider ?? '').toLowerCase().includes(term)
      );
    }

    return filtered.sort((a, b) => {
      const aClaimed = claimedBenefitIds.has(a.id!) ? 1 : 0;
      const bClaimed = claimedBenefitIds.has(b.id!) ? 1 : 0;
      return bClaimed - aClaimed;
    });
  }, [advertisements, claimedBenefitIds, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Member Benefits Directory</h2>
          <p className="text-slate-500">Browse and claim exclusive benefits and privileges. Admin setup is in Partnership & Promotions.</p>
        </div>
      </div>

      <LoadingState loading={loading} error={error} empty={displayBenefits.length === 0} emptyMessage="No claimable benefits available">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {displayBenefits.map(benefit => (
            <Card key={benefit.id} className="hover:shadow-md transition-shadow h-full flex flex-col p-0 overflow-hidden">
              <div
                className="flex flex-col flex-1 cursor-pointer"
                onClick={() => {
                  if (benefit.id) recordClick(benefit.id);
                  setSelectedBenefitForDetail(benefit);
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-slate-900 leading-tight">{benefit.title}</h3>
                  <Badge variant={benefit.status === 'Active' ? 'success' : 'neutral'}>
                    {benefit.status}
                  </Badge>
                </div>

                {benefit.provider && (
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">By {benefit.provider}</p>
                )}

                {(benefit.imageUrl || benefit.logoUrl) && (
                  <div className="mb-4 w-full h-40 overflow-hidden rounded-lg bg-slate-100 flex items-center justify-center">
                    <img src={benefit.imageUrl || benefit.logoUrl} alt={benefit.title} className="w-full h-full object-cover" />
                  </div>
                )}

                <p className="text-sm text-slate-600 mb-4 line-clamp-3">{benefit.description}</p>

                <div className="space-y-2 mb-4 mt-auto">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1"><Users size={12} /><span>{benefit.clicks || 0} claims</span></div>
                    {benefit.usageLimit && <span className="font-semibold">Limit: {benefit.usageLimit} per person</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar size={12} />
                    <span>Valid until {benefit.endDate ? formatDate(toDate(benefit.endDate).toISOString()) : 'Ongoing'}</span>
                  </div>
                </div>
              </div>


            </Card>
          ))}
        </div>
      </LoadingState>

      {/* Benefit Detail Drawer Modal */}
      {selectedBenefitForDetail && (
        <PartnershipDetailModal
          ad={selectedBenefitForDetail}
          onClose={() => setSelectedBenefitForDetail(null)}
        />
      )}

      {/* Usage History Modal Component */}
      {selectedBenefitForUsage && (
        <UsageHistoryModal
          isOpen={isUsageModalOpen}
          onClose={() => {
            setIsUsageModalOpen(false);
            setSelectedBenefitForUsage(null);
          }}
          benefit={selectedBenefitForUsage}
          getUsageHistory={getBenefitUsageHistory}
        />
      )}
    </div>
  );
};

// Usage History Modal Component
interface UsageHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  benefit: Advertisement;
  getUsageHistory: (benefitId?: string, memberId?: string) => Promise<BenefitUsage[]>;
}

const UsageHistoryModal: React.FC<UsageHistoryModalProps> = ({ isOpen, onClose, benefit, getUsageHistory }) => {
  const [usageHistory, setUsageHistory] = useState<BenefitUsage[]>([]);
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
    <Modal isOpen={isOpen} onClose={onClose} title={`Usage History - ${benefit.title}`} size="lg" drawerOnMobile>
      <LoadingState loading={loading} error={null} empty={usageHistory.length === 0} emptyMessage="No usage history found">
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {usageHistory.map(usage => {
            const member = members.find(m => m.id === usage.memberId);
            return (
              <Card key={usage.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{member?.name || 'Unknown Member'}</p>
                    <p className="text-sm text-slate-500">{formatDate(toDate(usage.usedAt).toISOString())}</p>
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
