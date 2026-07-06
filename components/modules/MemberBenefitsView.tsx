import React, { useState, useEffect, useMemo } from 'react';
import { Gift, Users, Calendar, CheckCircle, History, AlertCircle, Clock, Sparkles, Star } from 'lucide-react';
import { Button, Card, Badge, Modal, useToast } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useAdvertisements } from '../../hooks/useAdvertisements';
import { useAuth } from '../../hooks/useAuth';
import { useMembers } from '../../hooks/useMembers';
import { Advertisement, BenefitUsage } from '../../services/advertisementService';
import { formatDate, toDate } from '../../utils/dateUtils';
import { PartnershipDetailModal } from '../dashboard/PartnershipDetailModal';

type FilterTab = 'all' | 'new' | 'expiring' | 'unclaimed' | 'claimed';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'expiring', label: 'Expiring Soon' },
  { key: 'unclaimed', label: 'Not Claimed' },
  { key: 'claimed', label: 'Claimed' },
];

function getDaysRemaining(endDate: Advertisement['endDate']): number | null {
  if (!endDate) return null;
  const end = toDate(endDate);
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function isNewBenefit(startDate: Advertisement['startDate']): boolean {
  const start = toDate(startDate);
  const now = new Date();
  return (now.getTime() - start.getTime()) < 30 * 24 * 60 * 60 * 1000;
}

export const MemberBenefitsView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const [claimedBenefitIds, setClaimedBenefitIds] = useState<Set<string>>(new Set());
  const [selectedBenefitForDetail, setSelectedBenefitForDetail] = useState<Advertisement | null>(null);
  const [selectedBenefitForUsage, setSelectedBenefitForUsage] = useState<Advertisement | null>(null);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [recordedImpressions, setRecordedImpressions] = useState<Set<string>>(new Set());
  const { advertisements, loading, error, recordClick, recordImpression, getBenefitUsageHistory } = useAdvertisements();
  const { member } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (member) loadClaimedBenefits();
  }, [member, advertisements]);

  const loadClaimedBenefits = async () => {
    if (!member) return;
    try {
      const history = await getBenefitUsageHistory(undefined, member.id);
      setClaimedBenefitIds(new Set<string>(history.map(h => h.benefitId)));
    } catch {}
  };

  const openDetail = (benefit: Advertisement) => {
    if (benefit.id) recordClick(benefit.id);
    setSelectedBenefitForDetail(benefit);
  };

  const allActive = useMemo(() => {
    let filtered = advertisements.filter(ad => ad.status === 'Active');
    const term = (searchQuery || '').toLowerCase();
    if (term) {
      filtered = filtered.filter(b =>
        (b.title ?? '').toLowerCase().includes(term) ||
        (b.description ?? '').toLowerCase().includes(term) ||
        (b.provider ?? '').toLowerCase().includes(term)
      );
    }
    return filtered.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }, [advertisements, searchQuery]);

  const featuredBenefits = useMemo(() =>
    allActive.filter(b => (b.priority || 0) >= 5).slice(0, 3),
    [allActive]
  );

  const displayBenefits = useMemo(() => {
    let list = allActive;
    if (activeFilter === 'new') {
      list = list.filter(b => isNewBenefit(b.startDate));
    } else if (activeFilter === 'expiring') {
      list = list.filter(b => {
        const days = getDaysRemaining(b.endDate);
        return days !== null && days <= 30 && days > 0;
      });
    } else if (activeFilter === 'unclaimed') {
      list = list.filter(b => !claimedBenefitIds.has(b.id!));
    } else if (activeFilter === 'claimed') {
      list = list.filter(b => claimedBenefitIds.has(b.id!));
    }
    // unclaimed first
    return list.sort((a, b) => {
      const aClaimed = claimedBenefitIds.has(a.id!) ? 1 : 0;
      const bClaimed = claimedBenefitIds.has(b.id!) ? 1 : 0;
      return aClaimed - bClaimed;
    });
  }, [allActive, activeFilter, claimedBenefitIds]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Member Benefits</h2>
        <p className="text-slate-500 text-sm mt-0.5">Exclusive privileges for JCI KL members.</p>
      </div>

      {/* Featured Strip — desktop only, top-priority benefits */}
      {featuredBenefits.length > 0 && !searchQuery && (
        <div className="hidden md:block">
          <div className="flex items-center gap-2 mb-3">
            <Star size={14} className="text-amber-500 fill-amber-500" />
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Featured</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {featuredBenefits.map(benefit => {
              const claimed = claimedBenefitIds.has(benefit.id!);
              const days = getDaysRemaining(benefit.endDate);
              return (
                <div
                  key={benefit.id}
                  className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-lg transition-shadow"
                  onClick={() => openDetail(benefit)}
                >
                  <div className="aspect-[16/7] bg-slate-200">
                    <img
                      src={benefit.imageUrl || benefit.logoUrl || ''}
                      alt={benefit.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    {benefit.provider && (
                      <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">{benefit.provider}</p>
                    )}
                    <h3 className="text-white font-bold text-base leading-tight">{benefit.title}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      {claimed && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                          <CheckCircle size={10} /> Claimed
                        </span>
                      )}
                      {days !== null && days <= 30 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                          <Clock size={10} /> {days}d left
                        </span>
                      )}
                      {!claimed && isNewBenefit(benefit.startDate) && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-jci-blue text-white px-2 py-0.5 rounded-full">
                          <Sparkles size={10} /> New
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              activeFilter === tab.key
                ? 'bg-jci-blue text-white border-jci-blue'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <LoadingState loading={loading} error={error} empty={displayBenefits.length === 0} emptyMessage="No benefits match this filter">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {displayBenefits.map(benefit => {
            const claimed = claimedBenefitIds.has(benefit.id!);
            const days = getDaysRemaining(benefit.endDate);
            const isExpiringSoon = days !== null && days <= 30 && days > 0;
            const isNew = isNewBenefit(benefit.startDate);

            return (
              <div
                key={benefit.id}
                className="relative bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col"
                onClick={() => openDetail(benefit)}
              >
                {/* Image */}
                <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                  {(benefit.imageUrl || benefit.logoUrl) ? (
                    <img
                      src={benefit.imageUrl || benefit.logoUrl}
                      alt={benefit.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gift size={32} className="text-slate-300" />
                    </div>
                  )}

                  {/* Claimed overlay */}
                  {claimed && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1">
                        <CheckCircle size={28} className="text-emerald-400" />
                        <span className="text-[10px] font-black text-white uppercase tracking-wider">Claimed</span>
                      </div>
                    </div>
                  )}

                  {/* Badges on image */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {isExpiringSoon && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full shadow">
                        <Clock size={8} /> {days}d left
                      </span>
                    )}
                    {isNew && !claimed && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold bg-jci-blue text-white px-1.5 py-0.5 rounded-full shadow">
                        <Sparkles size={8} /> New
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-3">
                  {benefit.provider && (
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">{benefit.provider}</p>
                  )}
                  <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2 mb-1">{benefit.title}</h3>
                  <p className="text-[11px] text-slate-500 line-clamp-2 flex-1">{benefit.description}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Users size={10} />
                      <span>{benefit.clicks || 0} claims</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Calendar size={10} />
                      <span>{benefit.endDate ? formatDate(toDate(benefit.endDate).toISOString()) : 'Ongoing'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </LoadingState>

      {/* Benefit Detail Modal */}
      {selectedBenefitForDetail && (
        <PartnershipDetailModal
          ad={selectedBenefitForDetail}
          onClose={() => setSelectedBenefitForDetail(null)}
        />
      )}

      {/* Usage History Modal */}
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
    if (isOpen && benefit.id) loadHistory();
  }, [isOpen, benefit.id]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const history = await getUsageHistory(benefit.id);
      setUsageHistory(history);
    } catch {
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
            const m = members.find(m => m.id === usage.memberId);
            return (
              <Card key={usage.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{m?.name || 'Unknown Member'}</p>
                    <p className="text-sm text-slate-500">{formatDate(toDate(usage.usedAt).toISOString())}</p>
                    {usage.details && <p className="text-sm text-slate-600 mt-1">{usage.details}</p>}
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
