import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ChevronRight, Gift, Lock, Unlock } from 'lucide-react';
import { Button, Modal, useToast } from '@/components/ui/Common';
import { useAuth } from '@/hooks/useAuth';
import { PartnershipsService } from '@/services/partnershipsService';
import { AdvertisementService } from '@/services/advertisementService';
import { GuestHeader } from '@/components/layout/GuestHeader';
import { GuestFooter } from '@/components/layout/GuestFooter';
import { Partnership } from '@/types';

export const GuestPartnershipPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => void;
}) => {
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<Partnership | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const { user, member } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPartnerships = async () => {
      try {
        const data = await PartnershipsService.getAllPartnerships();
        const activePartnerships = data.filter(p => p.status === 'active');
        setPartnerships(activePartnerships);

        // Record impressions for all active partnerships loaded
        activePartnerships.forEach(p => {
          if (p.id && !p.id.startsWith('mock')) {
            AdvertisementService.recordImpression(p.id).catch(console.error);
          }
        });
      } catch (err) {
        console.error('Failed to load partnerships:', err);
        showToast('Failed to load partnerships', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchPartnerships();
  }, []);

  const handleCardClick = (partner: Partnership) => {
    setSelectedPartner(partner);
    setIsDetailModalOpen(true);
    if (partner.id && !partner.id.startsWith('mock')) {
      AdvertisementService.recordClick(partner.id).catch(console.error);
    }
  };

  // Benefit Shielding Logic
  const checkRedeemPermission = (partner: Partnership) => {
    if (!user || !member) {
      return { allowed: false, reason: 'login' };
    }

    const userRole = member.role || 'guest';
    const isRoleEligible = !partner.eligibleRoles || partner.eligibleRoles.length === 0 || partner.eligibleRoles.includes(userRole);
    if (!isRoleEligible) {
      return { allowed: false, reason: 'role' };
    }

    const isDuesPaid = member.jciCareer?.isDuesPaidCurrentYear ?? false;
    if (!isDuesPaid) {
      return { allowed: false, reason: 'dues' };
    }

    return { allowed: true };
  };

  const redeemStatus = selectedPartner ? checkRedeemPermission(selectedPartner) : { allowed: false, reason: 'login' };

  return (
    <div className="min-h-screen bg-slate-50">
      <GuestHeader currentPage="partnerships" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        {/* Hero */}
        <section className="relative py-14 md:py-20 bg-gradient-to-br from-jci-navy via-[#1a3d7c] to-jci-blue overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-jci-blue/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest mb-3">Member Benefits</p>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4">Member Perks</h1>
            <p className="text-blue-200 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Exclusive discounts and rewards from our merchant partners — curated for JCI Kuala Lumpur members.
            </p>
            {!loading && partnerships.length > 0 && (
              <div className="flex items-center justify-center gap-6 md:gap-10 mt-8">
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-black text-white">{partnerships.length}</p>
                  <p className="text-blue-300 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Active Partner{partnerships.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Partners Grid */}
        <section className="py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jci-blue mx-auto mb-4" />
                <p className="text-slate-500 text-sm">Loading partnerships...</p>
              </div>
            ) : partnerships.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm max-w-xl mx-auto p-10">
                <Gift size={44} className="text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-black text-slate-800 mb-2">No Active Partnerships</h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
                  There are currently no active merchant partnerships. Check back soon!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
                {partnerships.map(partner => {
                  return (
                    <div
                      key={partner.id}
                      className="group flex flex-col bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer overflow-hidden border border-slate-100/80"
                      onClick={() => handleCardClick(partner)}
                    >
                      {/* Logo area */}
                      <div className="relative w-full h-36 overflow-hidden bg-slate-100 flex items-center justify-center">
                        {partner.logo ? (
                          <>
                            <img src={partner.logo} aria-hidden="true"
                              className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-50 pointer-events-none select-none" />
                            <div className="absolute inset-0 bg-white/10" />
                            <img src={partner.logo} alt={partner.name}
                              className="relative z-10 max-h-[4.5rem] max-w-[75%] object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </>
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-br from-jci-blue/15 via-slate-100 to-jci-navy/10" />
                            <span className="relative z-10 w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center text-xl font-black text-jci-blue">
                              {partner.name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </>
                        )}
                        {/* Members-only badge */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/30 backdrop-blur-md rounded-full px-2 py-1">
                          <Lock size={9} className="text-white/80" />
                          <span className="text-[9px] font-black text-white/80 uppercase tracking-wide">Members</span>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="flex flex-col flex-1 p-3.5 gap-1.5">
                        <h3 className="font-black text-slate-900 text-sm leading-tight line-clamp-1">{partner.name}</h3>
                        {partner.memberBenefits && (
                          <div className="flex">
                            <span className="inline-flex items-center gap-1 bg-jci-blue/10 text-jci-blue text-[11px] font-bold rounded-lg px-2 py-1 leading-snug line-clamp-2">
                              <Gift size={11} className="shrink-0" />
                              <span className="line-clamp-2">{partner.memberBenefits}</span>
                            </span>
                          </div>
                        )}
                        <div className="mt-auto pt-2.5 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">View Details</span>
                          <ChevronRight size={13} className="text-slate-300 group-hover:text-jci-blue group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Merchant CTA */}
        <section className="py-16 bg-gradient-to-br from-jci-navy to-jci-blue overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Briefcase size={28} className="text-white/80" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-black text-white mb-2">Are you a merchant?</h2>
              <p className="text-blue-200 text-sm leading-relaxed max-w-lg">
                Partner with JCI Kuala Lumpur to offer exclusive discounts to our professional network of 200+ members across Kuala Lumpur.
              </p>
            </div>
            <Button size="lg" variant="outline" onClick={onRegister}
              className="shrink-0 bg-white !text-jci-navy border-white hover:bg-sky-50 hover:!text-jci-navy font-black shadow-lg">
              Partner With Us
            </Button>
          </div>
        </section>
      </main>

      <GuestFooter />

      {/* Benefit Shielding Modal */}
      {selectedPartner && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => { setIsDetailModalOpen(false); setSelectedPartner(null); }}
          title={selectedPartner.name}
          size="md"
          drawerOnMobile
        >
          <div className="space-y-5">
            {/* Banner + Logo */}
            <div className="relative w-full h-44 overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100">
              {selectedPartner.banner ? (
                <img src={selectedPartner.banner} alt={selectedPartner.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { const img = e.target as HTMLImageElement; img.onerror = null; img.style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Gift size={48} className="text-slate-300" />
                </div>
              )}
              {selectedPartner.logo && (
                <div className="absolute bottom-3 left-3 w-12 h-12 rounded-xl bg-white shadow-md border border-slate-100 overflow-hidden flex items-center justify-center p-1.5">
                  <img src={selectedPartner.logo} alt="logo"
                    className="w-full h-full object-contain"
                    onError={(e) => { const img = e.target as HTMLImageElement; img.onerror = null; img.parentElement!.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>

            {/* Benefit headline */}
            <div className="bg-jci-blue/5 border border-jci-blue/10 rounded-xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-jci-blue mb-1">Member Benefit</p>
              <p className="text-base font-black text-slate-900 leading-snug">{selectedPartner.memberBenefits}</p>
            </div>

            {/* Redeem */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">How to Redeem</p>
              {redeemStatus.allowed ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 text-sm font-bold">
                    <Unlock size={15} className="shrink-0" />
                    Eligibility verified — benefit unlocked
                  </div>
                  <p className="text-sm font-black text-slate-900 bg-white px-4 py-3 rounded-lg border border-emerald-100 shadow-sm">{selectedPartner.redeemMethod}</p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center mx-auto">
                    <Lock size={18} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="font-black text-slate-800 text-sm">
                      {redeemStatus.reason === 'login' && 'Login to view how to redeem'}
                      {redeemStatus.reason === 'role' && 'Not available for your member tier'}
                      {redeemStatus.reason === 'dues' && 'Settle annual dues to unlock'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Benefit details are protected under JCI Kuala Lumpur Member Benefit Shielding.
                    </p>
                  </div>
                  {redeemStatus.reason === 'login' && (
                    <div className="flex gap-3 justify-center pt-1">
                      <Button size="sm" onClick={() => { setIsDetailModalOpen(false); onLogin(); }}>Login</Button>
                      <Button size="sm" variant="outline" onClick={() => { setIsDetailModalOpen(false); onRegister(); }}>Register</Button>
                    </div>
                  )}
                  {redeemStatus.reason === 'dues' && (
                    <Button size="sm" onClick={() => { setIsDetailModalOpen(false); navigate('/roadmap'); }}>
                      Go to Dues Billing
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
