import React, { useState, useEffect, useMemo } from 'react';
import { Gift, Users, Calendar, CheckCircle, Clock, Sparkles, Star, Plus, Upload } from 'lucide-react';
import { Button, Card, Badge, Modal, Drawer, useToast } from '../ui/Common';
import { MembersOnlyOverlay } from '../ui/MembersOnlyOverlay';
import { LoadingState } from '../ui/Loading';
import { useAdvertisements } from '../../hooks/useAdvertisements';
import { useAuth } from '../../hooks/useAuth';
import { useMembers } from '../../hooks/useMembers';
import { Advertisement, BenefitUsage } from '../../services/advertisementService';
import { formatDate, toDate } from '../../utils/dateUtils';
import { PartnershipDetailModal } from '../dashboard/PartnershipDetailModal';
import { hasSpecialOffer, getSpecialOfferSummary, SpecialOffer } from '../../types/member';
import { uploadMemberOfferLogoToCloudinary, uploadMemberOfferBannerToCloudinary } from '../../services/cloudinaryService';

const EMPTY_OFFER: SpecialOffer = { description: '', terms: '', expiryDate: '', status: 'Active' };

type BenefitItem = Advertisement & { _isMemberOffer?: boolean; _memberId?: string; _memberName?: string; _isSelf?: boolean };


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
  const [selectedBenefitForDetail, setSelectedBenefitForDetail] = useState<BenefitItem | null>(null);
  const [selectedBenefitForUsage, setSelectedBenefitForUsage] = useState<BenefitItem | null>(null);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);

  const [recordedImpressions, setRecordedImpressions] = useState<Set<string>>(new Set());
  const { advertisements, loading, error, recordClick, recordImpression, getBenefitUsageHistory } = useAdvertisements();
  const { member } = useAuth();
  const { members, updateMember } = useMembers();
  const { showToast } = useToast();

  // ── Special offer drawer (current user's own offer) ──
  const [offerDrawerOpen, setOfferDrawerOpen] = useState(false);
  const [offerEditingIndex, setOfferEditingIndex] = useState<number | null>(null);
  const [draftOffer, setDraftOffer] = useState<SpecialOffer>({ ...EMPTY_OFFER });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);

  const selfMember = useMemo(() => members.find(m => m.id === member?.id), [members, member?.id]);
  const selfOffers: SpecialOffer[] = useMemo(
    () => (selfMember?.business?.specialOffers ?? []).filter((o: SpecialOffer) => o.description?.trim()),
    [selfMember]
  );

  useEffect(() => {
    if (!offerDrawerOpen) return;
    if (offerEditingIndex !== null) {
      const src = selfOffers[offerEditingIndex];
      if (src) setDraftOffer({ ...src });
    } else {
      setDraftOffer({ ...EMPTY_OFFER });
    }
  }, [offerDrawerOpen, offerEditingIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDraft = (patch: Partial<SpecialOffer>) => setDraftOffer(prev => ({ ...prev, ...patch }));

  const handleOfferLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !member?.id) return;
    setUploadingLogo(true);
    try { updateDraft({ logoUrl: await uploadMemberOfferLogoToCloudinary(file, member.id) }); }
    catch { showToast('Failed to upload logo', 'error'); }
    finally { setUploadingLogo(false); }
  };

  const handleOfferBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !member?.id) return;
    setUploadingBanner(true);
    try { updateDraft({ imageUrl: await uploadMemberOfferBannerToCloudinary(file, member.id) }); }
    catch { showToast('Failed to upload banner', 'error'); }
    finally { setUploadingBanner(false); }
  };

  const saveOfferDrawer = async () => {
    if (!draftOffer.description.trim() || !member?.id) return;
    const next = [...selfOffers];
    if (offerEditingIndex === null) next.push(draftOffer); else next[offerEditingIndex] = draftOffer;
    setSavingOffer(true);
    try {
      await updateMember(member.id, {
        specialOffers: next,
        specialOffer: next[0] ?? undefined,
      } as any);
      showToast('Special offer saved', 'success');
      setOfferDrawerOpen(false);
    } catch {
      showToast('Failed to save offer', 'error');
    } finally {
      setSavingOffer(false);
    }
  };

  const memberOffers = useMemo((): BenefitItem[] => {
    return members
      .filter(m => {
        const offersList = m.business?.specialOffers;
        if (Array.isArray(offersList) && offersList.length > 0) return true;
        return hasSpecialOffer(m.business?.specialOffer || (m as any).specialOffer);
      })
      .flatMap(m => {
        const isSelf = m.id === member?.id;
        const offersList: SpecialOffer[] = m.business?.specialOffers ??
          (m.business?.specialOffer ? [typeof m.business.specialOffer === 'string' ? { description: m.business.specialOffer } : m.business.specialOffer] : []);
        return offersList.map((offerObj, idx) => {
        const offer = offerObj;
        const summary = getSpecialOfferSummary(offerObj);
        return {
          id: `member_offer_${m.id}_${idx}`,
          title: summary,
          description: offerObj.description || '',
          type: 'Banner' as const,
          placement: [],
          imageUrl: offerObj.imageUrl || m.general?.avatarUrl || (m as any).avatarUrl || '',
          logoUrl: offerObj.logoUrl || m.general?.avatarUrl || (m as any).avatarUrl || '',
          status: 'Active' as const,
          impressions: 0,
          clicks: 0,
          priority: 0,
          startDate: m.createdAt || new Date(),
          provider: m.companyName || '',
          termsAndConditions: offerObj.terms,
          createdAt: m.createdAt || new Date(),
          updatedAt: m.updatedAt || new Date(),
          _isMemberOffer: true,
          _memberId: m.id,
          _memberName: isSelf ? 'Your Offer' : (m.general?.name || (m as any).name || ''),
        } as BenefitItem;
        });
      });
  }, [members, member?.id]);

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

  const allActive = useMemo((): BenefitItem[] => {
    let filtered: BenefitItem[] = advertisements.filter(ad => ad.status === 'Active') as BenefitItem[];
    const term = (searchQuery || '').toLowerCase();
    if (term) {
      const matchedAds = filtered.filter(b =>
        (b.title ?? '').toLowerCase().includes(term) ||
        (b.description ?? '').toLowerCase().includes(term) ||
        (b.provider ?? '').toLowerCase().includes(term)
      );
      const matchedOffers = memberOffers.filter(b =>
        (b.title ?? '').toLowerCase().includes(term) ||
        (b._memberName ?? '').toLowerCase().includes(term) ||
        (b.provider ?? '').toLowerCase().includes(term)
      );
      return [...matchedAds, ...matchedOffers].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
    return [...filtered.sort((a, b) => (b.priority || 0) - (a.priority || 0)), ...memberOffers];
  }, [advertisements, memberOffers, searchQuery]);

  const featuredBenefits = useMemo(() =>
    allActive.filter(b => !b._isMemberOffer && (b.priority || 0) >= 5).slice(0, 3),
    [allActive]
  );

  const displayBenefits = useMemo(() => {
    // own offer first, then unclaimed before claimed
    return [...allActive].sort((a, b) => {
      const aIsSelf = a._isMemberOffer && a._memberId === member?.id ? -1 : 0;
      const bIsSelf = b._isMemberOffer && b._memberId === member?.id ? -1 : 0;
      if (aIsSelf !== bIsSelf) return aIsSelf - bIsSelf;
      const aClaimed = claimedBenefitIds.has(a.id!) ? 1 : 0;
      const bClaimed = claimedBenefitIds.has(b.id!) ? 1 : 0;
      return aClaimed - bClaimed;
    });
  }, [allActive, claimedBenefitIds, member?.id]);

  const isGuest = (member?.role || '') === 'GUEST';

  return (
    <div className={`space-y-6 relative${isGuest ? ' pt-px' : ''}`}>
      {/* Guest mask — benefits are visible only to members */}
      {isGuest && (
        <MembersOnlyOverlay
          member={member}
          description="Member benefits are exclusive to JCI Kuala Lumpur members. Join us to unlock discounts and privileges from our partners."
        />
      )}

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

      {/* Grid */}
      <LoadingState loading={loading} error={error} empty={displayBenefits.length === 0 && isGuest} emptyMessage="No benefits match this filter">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Add Special Offer card — visible to non-guests */}
          {!isGuest && (
            <div
              onClick={() => { setOfferEditingIndex(null); setOfferDrawerOpen(true); }}
              className="relative bg-white rounded-xl border-2 border-dashed border-slate-200 overflow-hidden cursor-pointer hover:border-jci-blue hover:shadow-md transition-all flex flex-col group"
            >
              <div className="relative aspect-[4/3] bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-jci-blue/10 transition-colors flex items-center justify-center">
                    <Plus size={20} className="text-slate-400 group-hover:text-jci-blue transition-colors" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col flex-1 p-3">
                <h3 className="font-bold text-sm text-slate-400 group-hover:text-jci-blue transition-colors leading-snug">New Special Offer</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Share an exclusive deal with JCI KL members</p>
              </div>
            </div>
          )}
          {displayBenefits.map(benefit => {
            const b = benefit as BenefitItem;
            const claimed = claimedBenefitIds.has(b.id!);
            const days = getDaysRemaining(b.endDate);
            const isExpiringSoon = days !== null && days <= 30 && days > 0;
            const isNew = isNewBenefit(b.startDate);

            return (
              <div
                key={b.id}
                className="relative bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col"
                onClick={() => openDetail(b)}
              >
                {/* Image */}
                <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                  {(b.imageUrl || b.logoUrl) ? (
                    <img
                      src={b.imageUrl || b.logoUrl}
                      alt={b.title}
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
                    {b._isMemberOffer && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold bg-violet-600 text-white px-1.5 py-0.5 rounded-full shadow">
                        <Users size={8} /> {b._memberId === member?.id ? 'Your Offer' : 'Member Offer'}
                      </span>
                    )}
                    {isExpiringSoon && !b._isMemberOffer && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full shadow">
                        <Clock size={8} /> {days}d left
                      </span>
                    )}
                    {isNew && !claimed && !b._isMemberOffer && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold bg-jci-blue text-white px-1.5 py-0.5 rounded-full shadow">
                        <Sparkles size={8} /> New
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-3">
                  {!b._isMemberOffer && b.provider && (
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">{b.provider}</p>
                  )}
                  <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2 mb-1">
                    {b._isMemberOffer ? (b.provider || b.title) : b.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 line-clamp-2 flex-1">
                    {b._isMemberOffer ? b.title : b.description}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                    {b._isMemberOffer ? (
                      <div className="flex items-center gap-1 text-[10px] text-violet-400">
                        <Users size={10} />
                        <span>Member offer</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Users size={10} />
                        <span>{b.clicks || 0} claims</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Calendar size={10} />
                      <span>{b.endDate ? formatDate(toDate(b.endDate).toISOString()) : 'Ongoing'}</span>
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
          ad={selectedBenefitForDetail as Advertisement}
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

      {/* ── New / Edit Special Offer Drawer ── */}
      <Drawer
        isOpen={offerDrawerOpen}
        onClose={() => setOfferDrawerOpen(false)}
        title={offerEditingIndex === null ? 'Add Special Offer' : 'Edit Offer'}
        position="bottom"
        size="xl"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setOfferDrawerOpen(false)} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="button" onClick={saveOfferDrawer} disabled={!draftOffer.description.trim() || savingOffer} className="flex-1 h-10 rounded-xl bg-jci-blue text-white text-sm font-bold disabled:opacity-40 hover:bg-blue-600 transition-colors">
              {savingOffer ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-sm p-1">
          <div>
            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Offer Description *</label>
            <input
              type="text"
              placeholder="e.g. 10% off first order for JCI KL members"
              value={draftOffer.description}
              onChange={e => updateDraft({ description: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Terms & Conditions</label>
            <textarea
              rows={3}
              placeholder="Terms & conditions (optional)"
              value={draftOffer.terms ?? ''}
              onChange={e => updateDraft({ terms: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-slate-500 font-medium">Company Logo</p>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 aspect-square flex items-center justify-center overflow-hidden">
                {draftOffer.logoUrl ? <img src={draftOffer.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" /> : <Upload size={18} className="text-slate-300" />}
              </div>
              <div className="flex items-center gap-1.5">
                <label className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${uploadingLogo ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-700 border-slate-300 hover:border-jci-blue hover:text-jci-blue'}`}>
                  <Upload size={11} />{uploadingLogo ? 'Uploading…' : 'Upload'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={handleOfferLogoUpload} />
                </label>
                {draftOffer.logoUrl && <button type="button" onClick={() => updateDraft({ logoUrl: '' })} className="text-xs text-slate-400 hover:text-red-500">Remove</button>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-slate-500 font-medium">Ad Banner</p>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 aspect-square flex items-center justify-center overflow-hidden">
                {draftOffer.imageUrl ? <img src={draftOffer.imageUrl} alt="Banner" className="w-full h-full object-cover" /> : <Upload size={18} className="text-slate-300" />}
              </div>
              <div className="flex items-center gap-1.5">
                <label className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${uploadingBanner ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-700 border-slate-300 hover:border-jci-blue hover:text-jci-blue'}`}>
                  <Upload size={11} />{uploadingBanner ? 'Uploading…' : 'Upload'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingBanner} onChange={handleOfferBannerUpload} />
                </label>
                {draftOffer.imageUrl && <button type="button" onClick={() => updateDraft({ imageUrl: '' })} className="text-xs text-slate-400 hover:text-red-500">Remove</button>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <label className="text-xs text-slate-500 whitespace-nowrap">Status</label>
            <div className="flex gap-2">
              {(['Active', 'Paused'] as const).map(s => (
                <button key={s} type="button" onClick={() => updateDraft({ status: s })}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    (draftOffer.status ?? 'Active') === s
                      ? s === 'Active' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-400 text-white border-slate-400'
                      : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'
                  }`}>{s}</button>
              ))}
            </div>
            <label className="text-xs text-slate-500 whitespace-nowrap ml-auto">Expiry</label>
            <input
              type="date"
              value={draftOffer.expiryDate ?? ''}
              onChange={e => updateDraft({ expiryDate: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:outline-none"
            />
          </div>
        </div>
      </Drawer>
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
                    <p className="font-semibold text-slate-900">{m?.general?.name || 'Unknown Member'}</p>
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
