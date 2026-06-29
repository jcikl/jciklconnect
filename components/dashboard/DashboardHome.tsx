// Member Dashboard Home Component
import React from 'react';
import {
  Calendar, Briefcase, Bell, Award, Sparkles, AlertTriangle, CheckCircle,
  TrendingUp, Users, Clock, Target, Zap, FileText, DollarSign, UserCog,
  CheckSquare, Heart, BookOpen, LayoutDashboard, Building2, Gift, ChevronDown, Search, LogOut,
  Flame, Trophy, Coins, Timer, ArrowUpRight, Crown, Save, RefreshCw, Edit3, Shield
} from 'lucide-react';
import { Card, StatCard, StatCardsContainer, Badge, Button, useToast } from '../ui/Common';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useEvents } from '../../hooks/useEvents';
import { useProjects } from '../../hooks/useProjects';
import { useCommunication } from '../../hooks/useCommunication';
import { usePoints } from '../../hooks/usePoints';
import { useMembers } from '../../hooks/useMembers';
import { useBehavioralNudging } from '../../hooks/useBehavioralNudging';
import { NudgeBanner } from '../ui/NudgeBanner';
import { MemberGrowthChart, PointsDistributionChart, PointsSourceRadarChart } from './Analytics';
import { AIPredictionService, PersonalizedRecommendation } from '../../services/aiPredictionService';
import { ActivityRecommendationService } from '../../services/activityRecommendationService';
import { EventRegistrationService } from '../../services/eventRegistrationService';
import { MEMBER_TIERS, MEMBER_PRIVILEGES, BOUNTY_STATUS } from '../../config/constants';
import { ContractService, CommitmentContract } from '../../services/contractService';
import { PromotionService } from '../../services/promotionService';
import { MembersService } from '../../services/membersService';
import { AdvertisementService, Advertisement } from '../../services/advertisementService';
import type { Event, MemberPromotionProgress } from '../../types';
import { UserRole } from '../../types';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { EventDetailModal } from '../modules/EventsView';
import { PartnershipDetailModal } from './PartnershipDetailModal';
import { useState, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

/**
 * Competitive UI Helper Component: Elite Leaderboard
 * Purpose: Peer pressure, Public Comparison (Jealousy/Vanity)
 */
const EliteLeaderboard: React.FC<{ members: any[], currentUser: any }> = ({ members, currentUser }) => {
  const top3 = members.slice(0, 3);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(top3[0]?.id || null);
  const currentYear = new Date().getFullYear();
  const [radarYear, setRadarYear] = useState(currentYear);
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-jci-navy border-none shadow-[0_20px_50px_rgba(8,112,184,0.7)] text-white">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter italic leading-none mb-1">Elite Leaderboard</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global Ranking • Top 3 Members</p>
          </div>
          <Badge className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-white border-none animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.5)] font-black italic tracking-tighter">
            Top League
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
          {/* Left Side: Member List */}
          <div className="grid grid-cols-3 md:grid-cols-1 gap-3 md:gap-4 ">
            {top3.map((m, idx) => (
              <div
                key={m.id}
                className={`flex flex-col md:flex-row items-center md:justify-between p-3 md:p-4 rounded-2xl border transition-all group cursor-pointer ${m.id === selectedMemberId ? 'bg-white/20 border-white/40 shadow-lg scale-[1.02]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                onClick={() => setSelectedMemberId(m.id)}
              >
                <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 text-center md:text-left">
                  <div className="relative mb-2 md:mb-0">
                    <span className={`absolute -top-1 -left-1 md:-top-2 md:-left-2 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-black shadow-lg ${idx === 0 ? 'bg-amber-400 text-amber-900' : idx === 1 ? 'bg-slate-300 text-slate-800' : 'bg-orange-400 text-orange-900'}`}>
                      {idx + 1}
                    </span>
                    <img src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}`} className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-white/20 object-cover" alt="" />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-black tracking-tight text-xs md:text-base truncate max-w-[60px] md:max-w-none ${m.id === currentUser?.id ? 'text-amber-400' : 'text-white'}`}>{m.name}</p>
                    <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden md:block">{m.tier || 'MEMBER'}</p>
                  </div>
                </div>
                <div className="text-center md:text-right mt-1 md:mt-0">
                  <p className="text-sm md:text-lg font-black tracking-tighter leading-none">{(m.points || 0).toLocaleString()}</p>
                  <p className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase tracking-widest">Points</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Side: Radar Chart */}
          <div className="relative bg-white/5 rounded-[32px] p-4 border border-white/10 h-full flex flex-col items-center justify-center min-h-[280px]">
            <div className="absolute top-4 left-6">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Points Source</h4>
              <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Skill Analysis</p>
            </div>

            {/* Year Selector */}
            <div className="absolute top-3 right-4 flex items-center gap-1">
              {availableYears.map(y => (
                <button
                  key={y}
                  onClick={() => setRadarYear(y)}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                    y === radarYear
                      ? 'bg-amber-400/90 text-slate-900 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                      : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            <PointsSourceRadarChart memberId={selectedMemberId || undefined} year={radarYear} className="mt-4" />

            <div className="absolute bottom-4 right-6 text-right">
              <p className="text-[10px] font-black text-amber-400 italic uppercase">Competitive Mode</p>
              <p className="text-[8px] text-slate-500 uppercase font-bold">Data Realtime</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

interface DashboardHomeProps {
  userRole: import('../../types').UserRole;
  onOpenNotifications: () => void;
  onOpenSearch?: () => void;
  onNavigate?: (view: string) => void;
  onEditProfile?: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  userRole,
  onOpenNotifications,
  onOpenSearch,
  onNavigate,
  onEditProfile,
  searchQuery,
  onSearchChange,
  scrollRef
}) => {
  const { scrollY } = useScroll({ container: scrollRef });

  // Transform Greeting: Move left and fade out via vertical mask
  const greetingX = useTransform(scrollY, [0, 120], [0, 0]);
  const greetingOpacity = useTransform(scrollY, [0, 120], [1, 0]);

  // Mask wipe effect: as we scroll, the mask moves down
  const maskProgress = useTransform(scrollY, [0, 120], [0, 100]);
  const greetingMask = useTransform(maskProgress, (p) =>
    `linear-gradient(to top, transparent ${p}%, black ${p}%)`
  );

  // Transform Search Bar: Move up to dock with Top Row
  const headerY = useTransform(scrollY, [0, 120], [0, -150]);
  const counterY = useTransform(headerY, (y) => -Number(y));

  const { showToast } = useToast();
  const { member, signOut, isDevMode, simulatedRole, simulateRole } = useAuth();
  const { isBoard, isAdmin, isDeveloper, hasPermission, isOrganizationFinance, isActivityFinance, isOrganizationSecretary } = usePermissions();
  const { events, loading: eventsLoading, registerForEvent, markAttendance } = useEvents();
  const { projects, loading: projectsLoading } = useProjects();
  const { members, loading: membersLoading } = useMembers();
  const { nudges, dismissNudge } = useBehavioralNudging();
  const { notifications } = useCommunication();
  const { leaderboard, pointHistory } = usePoints();
  const [recommendations, setRecommendations] = useState<PersonalizedRecommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [topRecommendation, setTopRecommendation] = useState<PersonalizedRecommendation | null>(null);
  const [recommendedEvents, setRecommendedEvents] = useState<Event[]>([]);
  const [loadingRecommendedEvents, setLoadingRecommendedEvents] = useState(false);
  const [myRegistrationEventIds, setMyRegistrationEventIds] = useState<string[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [eventTab, setEventTab] = useState<'upcoming' | 'past'>('upcoming');
  const [contracts, setContracts] = useState<CommitmentContract[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [homepageAds, setHomepageAds] = useState<Advertisement[]>([]);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close role dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Promotion Progress state (for Probation members)
  const [promotionProgress, setPromotionProgress] = useState<any>(null);
  const [promoEditValues, setPromoEditValues] = useState<Record<string, string>>({});
  const [promoSavingField, setPromoSavingField] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<Event | null>(null);
  const [selectedAdForDetail, setSelectedAdForDetail] = useState<Advertisement | null>(null);

  const PROMO_FIELD_MAP: Record<string, 'bodMeetingAttended' | 'eventOrganizerParticipation' | 'eventParticipation' | 'jciInspireCompleted'> = {
    'bod_meeting_attendance': 'bodMeetingAttended',
    'event_organizing_committee': 'eventOrganizerParticipation',
    'event_participation': 'eventParticipation',
    'jci_inspire_completion': 'jciInspireCompleted'
  };

  const PROMO_PLACEHOLDER: Record<string, string> = {
    'bod_meeting_attendance': 'e.g. 2026-03-15 BOD Meeting #3',
    'event_organizing_committee': 'e.g. Charity Fundraiser 2026 - Logistics',
    'event_participation': 'e.g. Event A, Event B (min 2 events, separated by commas)',
    'jci_inspire_completion': 'e.g. JCIM Inspire 2026 OR NMO 2026'
  };

  const handleRestrictedAction = (viewType: string) => {
    if (member?.role === UserRole.GUEST) {
      setShowUpgradeModal(true);
    } else {
      onNavigate?.(viewType);
    }
  };

  // Load Homepage Advertisements
  useEffect(() => {
    const loadAds = async () => {
      try {
        const ads = await AdvertisementService.getActiveAdvertisements('Homepage');
        setHomepageAds(ads);
      } catch (err) {
        console.error('Failed to load homepage ads', err);
      }
    };
    loadAds();
  }, []);

  // Initial impression for the first ad
  useEffect(() => {
    if (homepageAds.length > 0 && homepageAds[0]?.id) {
      AdvertisementService.recordImpression(homepageAds[0].id!);
    }
  }, [homepageAds.length]);

  // Load active commitments (Phase 3)
  useEffect(() => {
    if (!member) return;
    const fetchContracts = async () => {
      try {
        const data = await ContractService.getMemberContracts(member.id);
        setContracts(data);
      } catch (err) {
        console.error('Failed to fetch contracts:', err);
      }
    };
    fetchContracts();
  }, [member]);

  // Load Promotion Progress for Probation members
  useEffect(() => {
    if (!member || member.membershipType !== 'Probation') return;
    const loadPromotion = async () => {
      setPromoLoading(true);
      try {
        const progress = await PromotionService.getPromotionProgress(member.id);
        setPromotionProgress(progress);
        // Load existing edit values from member record
        const memberData = await MembersService.getMemberById(member.id);
        const pp = (memberData?.promotionProgress || {}) as Partial<MemberPromotionProgress>;
        setPromoEditValues({
          'bod_meeting_attendance': pp.bodMeetingAttended || '',
          'event_organizing_committee': pp.eventOrganizerParticipation || '',
          'event_participation': pp.eventParticipation || '',
          'jci_inspire_completion': pp.jciInspireCompleted || ''
        });
      } catch (err) {
        console.error('Failed to load promotion progress:', err);
      } finally {
        setPromoLoading(false);
      }
    };
    loadPromotion();
  }, [member]);

  const handleSavePromotionField = async (reqType: string) => {
    if (!member) return;
    const field = PROMO_FIELD_MAP[reqType];
    if (!field) return;
    setPromoSavingField(reqType);
    try {
      await PromotionService.savePromotionProgressField(member.id, field, promoEditValues[reqType] || '');
      const progress = await PromotionService.getPromotionProgress(member.id);
      setPromotionProgress(progress);
      showToast('Progress saved! BOD will review your submission.', 'success');
    } catch (err) {
      showToast('Failed to save progress', 'error');
    } finally {
      setPromoSavingField(null);
    }
  };

  // Load member's event registrations (for guest dashboard: Activity Timeline + Upcoming Registered)
  useEffect(() => {
    const load = async () => {
      if (!member) return;
      setLoadingRegistrations(true);
      try {
        const list = await EventRegistrationService.listByMember(member.id);
        setMyRegistrationEventIds(list.map((r) => r.eventId));
      } catch {
        setMyRegistrationEventIds([]);
      } finally {
        setLoadingRegistrations(false);
      }
    };
    load();
  }, [member]);

  // Load personalized recommendations
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!member) return;
      setLoadingRecommendations(true);
      try {
        const recs = await AIPredictionService.getPersonalizedRecommendations(member.id, 5);
        setRecommendations(recs);
        if (recs.length > 0) {
          setTopRecommendation(recs[0]);
        }
      } catch (err) {
        console.error('Failed to load recommendations:', err);
      } finally {
        setLoadingRecommendations(false);
      }
    };
    loadRecommendations();
  }, [member]);

  // Load activity-based recommended events (Story 9.1)
  useEffect(() => {
    const load = async () => {
      if (!member) return;
      setLoadingRecommendedEvents(true);
      try {
        const list = await ActivityRecommendationService.getRecommendedEvents(member.id, 5);
        setRecommendedEvents(list);
      } catch {
        setRecommendedEvents([]);
      } finally {
        setLoadingRecommendedEvents(false);
      }
    };
    load();
  }, [member]);

  // Calculate stats from real data
  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date() && e.status !== 'Cancelled');
  const myProjects = projects.filter(p => p.lead === member?.id);
  const pendingTasks = myProjects.length; // Simplified - would need to fetch tasks
  const unreadNotifications = notifications.filter(n => !n.read);

  // Guest: only events this member has registered for
  const myRegisteredEvents = events.filter((e) => myRegistrationEventIds.includes(e.id));
  const pastRegisteredEvents = myRegisteredEvents
    .filter((e) => new Date(e.date) < new Date())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const upcomingRegisteredEvents = myRegisteredEvents
    .filter((e) => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate rank
  const userRankIndex = member ? leaderboard.findIndex(m => m.id === member.id) : -1;
  const userRank = userRankIndex >= 0 ? userRankIndex + 1 : 0;
  const rankPercentile = (userRank > 0 && leaderboard.length > 0)
    ? Math.round(((leaderboard.length - userRank) / leaderboard.length) * 100)
    : 0;

  if (!member) {
    return <div className="text-center py-10 text-slate-400">Loading member data...</div>;
  }

  const renderHeader = () => (
    <div
      className="sticky top-[-10rem] z-30 bg-gradient-to-br from-jci-navy to-jci-blue rounded-b-[40px] px-5 sm:px-8 text-white shadow-2xl relative -mt-4 -mx-5 sm:-mx-8 pb-4"
    >
      {/* Decorative Background Pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-b-[40px]">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      {/* Top Row: Fixed/Docked Area */}
      <div className="sticky top-[0rem] z-20 pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="relative group">
              <img
                src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=ffffff&color=0097D7`}
                alt="Avatar"
                className="w-12 h-12 rounded-full border-2 border-white/30 shadow-lg object-cover"
              />
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-jci-navy rounded-full"></div>
            </div>
            <div className="cursor-pointer group" onClick={onEditProfile}>
              <div className="flex items-center gap-1.5 text-blue-100 text-lg font-bold opacity-80 group-hover:opacity-100 transition-opacity">
                <span>{member.name}</span>
                <Edit3 size={14} className="text-white/50 group-hover:text-white transition-colors" />
              </div>
              <p className="font-medium text-sm tracking-wide text-blue-200">{member.role}</p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {(isDevMode || member.role === UserRole.ADMIN || simulatedRole !== null) && (
              <div className="relative mr-2" ref={roleDropdownRef}>
                <button
                  onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                  className="flex items-center bg-white/15 hover:bg-white/25 active:bg-white/30 border border-white/20 rounded-xl px-2.5 py-1 transition-all text-white text-[11px] font-bold shadow-sm h-[26px]"
                  title="Simulate Role"
                >
                  <Shield size={12} className="text-purple-300 mr-1.5 shrink-0" />
                  <span className="mr-1">{simulatedRole ? simulatedRole.charAt(0).toUpperCase() + simulatedRole.slice(1) : 'Dev/Admin'}</span>
                  <ChevronDown size={11} className={`text-white/70 transition-transform ${isRoleDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isRoleDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute right-0 mt-1.5 w-36 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl p-1 z-50 origin-top-right text-slate-200"
                    >
                      {[
                        { value: '', label: 'Dev/Admin', desc: 'Default system' },
                        { value: UserRole.ADMIN, label: 'Admin', desc: 'Full administration' },
                        { value: UserRole.MEMBER, label: 'Member', desc: 'Standard member' },
                        { value: UserRole.GUEST, label: 'Guest', desc: 'Limited guest view' }
                      ].map((option) => {
                        const isSelected = (simulatedRole || '') === option.value;
                        return (
                          <button
                            key={option.value}
                            onClick={() => {
                              const val = option.value;
                              simulateRole(val ? val as UserRole : null);
                              showToast(val ? `Simulating ${val} role` : 'Reset to Admin role', 'info');
                              setIsRoleDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-all flex flex-col gap-0.5 ${
                              isSelected
                                ? 'bg-gradient-to-r from-jci-blue to-sky-500 text-white font-extrabold shadow-md shadow-jci-blue/20'
                                : 'hover:bg-white/10 text-slate-300 hover:text-white'
                            }`}
                          >
                            <span className="text-[10px] font-bold leading-none">{option.label}</span>
                            <span className={`text-[8px] leading-tight ${isSelected ? 'text-blue-100/90' : 'text-slate-500 hover:text-slate-400'}`}>
                              {option.desc}
                            </span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button
              onClick={onOpenSearch}
              className="p-0 text-white/70 hover:text-white transition-all group"
              title="Search"
            >
              <Search size={20} className="group-hover:scale-110 transition-transform" />
            </button>

            <button
              onClick={onOpenNotifications}
              className="relative p-0 text-white/70 hover:text-white transition-all group"
              title="Notifications"
            >
              <Bell size={20} className="group-hover:rotate-12 transition-transform" />
              {unreadNotifications.length > 0 && (
                <span className="absolute top-0 right-0 min-w-[16px] h-[16px] bg-red-500 rounded-full text-[9px] flex items-center justify-center font-black">
                  {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                </span>
              )}
            </button>

            <button
              onClick={async () => {
                try {
                  await signOut();
                  showToast('Logged out successfully', 'success');
                } catch (error) {
                  showToast('Failed to logout', 'error');
                }
              }}
              className="p-0 text-white/70 hover:text-red-400 transition-all group"
              title="Sign Out"
            >
              <LogOut size={20} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Animation Area */}
      <div className="relative pt-5">
        <motion.div
          style={{
            y: counterY,
            x: greetingX,
            opacity: greetingOpacity,
            maskImage: greetingMask,
            WebkitMaskImage: greetingMask
          }}
          className="space-y-3 mb-4"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
            What would you <br /> prefer to do today?
          </h2>
          {topRecommendation ? (
            <div
              className="flex items-center space-x-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/10 inline-flex cursor-pointer hover:bg-white/10 transition-all shadow-sm"
              onClick={() => {
                if (topRecommendation.type === 'event') {
                  const event = events.find(e => e.id === topRecommendation.itemId);
                  if (event) {
                    setSelectedEventForDetail(event);
                    return;
                  }
                }
                if (topRecommendation.actionUrl) {
                  const view = topRecommendation.actionUrl.replace('/', '').toUpperCase();
                  onNavigate?.(view);
                }
              }}
            >
              <Sparkles size={16} className="text-yellow-400 animate-pulse" />
              <p className="text-sm font-medium text-blue-50">
                AI Suggests: <span className="underline decoration-yellow-400/50 underline-offset-4">{topRecommendation.itemName}</span>
              </p>
            </div>
          ) : nudges.length > 0 ? (
            <div
              className="flex items-center space-x-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/10 inline-flex cursor-pointer hover:bg-white/10 transition-all shadow-sm"
              onClick={() => {
                if (nudges[0].actionUrl) {
                  const view = nudges[0].actionUrl.replace('/', '').toUpperCase();
                  onNavigate?.(view);
                }
              }}
            >
              <Zap size={16} className="text-amber-400 animate-pulse" />
              <p className="text-sm font-medium text-blue-50">
                {nudges[0].title}
              </p>
            </div>
          ) : (
            <p className="text-blue-100/70 font-medium">Ready to make an impact? Check out the latest.</p>
          )}
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {renderHeader()}

      {/* Homepage Advertisements Banner (Swiper) */}
      {homepageAds.length > 0 && (
        <div className="w-full">
          <Swiper
            modules={[Autoplay, Pagination]}
            spaceBetween={16}
            slidesPerView={1.15}
            breakpoints={{
              640: { slidesPerView: 3.15 },
              1024: { slidesPerView: 4.15 },
            }}
            autoplay={{ delay: 5000, disableOnInteraction: false }}
            pagination={{ clickable: true, dynamicBullets: true }}
            loop={homepageAds.length > 5}
            className="w-full"
            onSlideChange={(swiper) => {
              if (homepageAds.length > 0) {
                const currentAd = homepageAds[swiper.realIndex];
                if (currentAd?.id) {
                  AdvertisementService.recordImpression(currentAd.id);
                }
              }
            }}
          >
            {homepageAds.map((ad, idx) => (
              <SwiperSlide key={ad.id || idx}>
                <div
                  className="h-36 sm:h-40 w-full rounded-2xl overflow-hidden relative shadow-md cursor-pointer group transform transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                  onClick={() => {
                    if (ad.id) AdvertisementService.recordClick(ad.id);
                    setSelectedAdForDetail(ad);
                  }}
                >
                  <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                  {/* Overlay Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                  {/* Ad Tag */}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-xs font-bold px-2 py-1 rounded-md text-slate-800 shadow-sm z-10">
                    Partnership
                  </div>
                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                    <h3 className="text-white font-bold text-sm sm:text-base line-clamp-1">{ad.title}</h3>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}

      {/* Horizontal Shortcuts Grid */}
      <div className="grid grid-cols-6 sm:grid-cols-6 gap-y-6 gap-x-4">
        <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => handleRestrictedAction('PROJECTS')}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors shadow-sm ${member.role === UserRole.GUEST ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-green-50 text-green-600 border-green-100 group-hover:bg-green-100'}`}>
            <Briefcase size={24} />
          </div>
          <span className={`text-[10px] sm:text-xs font-medium text-center ${member.role === UserRole.GUEST ? 'text-slate-400' : 'text-slate-600'}`}>My Projects</span>
        </div>
        <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => handleRestrictedAction('MEMBERS')}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors shadow-sm ${member.role === UserRole.GUEST ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-purple-50 text-purple-600 border-purple-100 group-hover:bg-purple-100'}`}>
            <Users size={24} />
          </div>
          <span className={`text-[10px] sm:text-xs font-medium text-center ${member.role === UserRole.GUEST ? 'text-slate-400' : 'text-slate-600'}`}>Find Mentor</span>
        </div>
        <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => handleRestrictedAction('GAMIFICATION')}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors shadow-sm ${member.role === UserRole.GUEST ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-100'}`}>
            <Target size={24} />
          </div>
          <span className={`text-[10px] sm:text-xs font-medium text-center ${member.role === UserRole.GUEST ? 'text-slate-400' : 'text-slate-600'}`}>Set Goals</span>
        </div>
        <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => onNavigate?.('SURVEYS')}>
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100 group-hover:bg-rose-100 transition-colors shadow-sm">
            <CheckSquare size={24} />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-slate-600 text-center">Survey</span>
        </div>
        <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => onNavigate?.('CLUBS')}>
          <div className="w-12 h-12 rounded-full bg-pink-50 flex items-center justify-center text-pink-600 border border-pink-100 group-hover:bg-pink-100 transition-colors shadow-sm">
            <Heart size={24} />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-slate-600 text-center">Hobby Clubs</span>
        </div>
        <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => onNavigate?.('KNOWLEDGE')}>
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 group-hover:bg-indigo-100 transition-colors shadow-sm">
            <BookOpen size={24} />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-slate-600 text-center">Knowledge</span>
        </div>
      </div>

      {/* Promotion Progress Card (Probation Members Only) — Minimalist */}
      {member.membershipType === 'Probation' && (
        <div
          className="flex items-center gap-4 p-4 rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-white cursor-pointer hover:shadow-md transition-all group"
          onClick={() => setShowPromoModal(true)}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md flex-shrink-0">
            <TrendingUp size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-bold text-sm text-slate-900">Promotion Progress</h3>
              <span className="text-xs font-bold text-amber-700">
                {promoLoading ? '...' : `${promotionProgress?.requirements?.filter((r: any) => r.isCompleted).length || 0}/4 completed`}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${promotionProgress?.overallProgress || 0}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={`h-full rounded-full ${promotionProgress?.isEligibleForPromotion
                  ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                  : 'bg-gradient-to-r from-amber-400 to-orange-500'
                  }`}
              />
            </div>
          </div>
          <Button
            size="sm"
            className="flex-shrink-0 text-xs h-8 px-4 bg-amber-500 hover:bg-amber-600 border-none text-white font-bold"
            onClick={(e) => { e.stopPropagation(); setShowPromoModal(true); }}
          >
            Update
          </Button>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card noPadding>
          <div className="px-6 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Events</h3>
              <button
                onClick={() => onNavigate?.('EVENTS')}
                className="text-xs font-black text-jci-blue uppercase tracking-widest hover:opacity-70 transition-opacity"
              >
                View All
              </button>
            </div>
          </div>
          <div className="px-6 pb-6">
            {eventsLoading ? (
              <div className="text-center py-8 text-slate-400 text-sm">Loading events...</div>
            ) : (eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date())).length === 0 ? (
              <div className="text-center py-8 text-slate-400 font-medium">
                <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No {eventTab} events</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date()))
                  .sort((a, b) => eventTab === 'upcoming' ? new Date(a.date).getTime() - new Date(b.date).getTime() : new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map(event => {
                    const isRecommended = recommendedEvents.some(re => re.id === event.id);
                    const isRegistered = myRegistrationEventIds.includes(event.id!);
                    return (
                      <div key={event.id} className="flex items-center space-x-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors" onClick={() => setSelectedEventForDetail(event)}>
                        <div className={`w-12 h-12 ${eventTab === 'upcoming' ? 'bg-blue-50 text-jci-blue' : 'bg-slate-100 text-slate-500'} rounded-lg flex flex-col items-center justify-center flex-shrink-0 shadow-sm border border-slate-100`}>
                          <span className="text-[10px] font-bold uppercase">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                          <span className="text-lg font-bold leading-none">{new Date(event.date).getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 truncate">{event.title}</h4>
                            {isRecommended && <Badge variant="jci" className="bg-purple-100 text-purple-600 border-none px-1.5 py-0 text-[10px]">Recommended</Badge>}
                          </div>
                          <p className="text-xs text-slate-500">{event.type} • {event.attendees} Attending</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {isRegistered ? (
                            <Badge variant="success" className="px-2 py-0.5 text-[10px]">Registered</Badge>
                          ) : (
                            eventTab === 'upcoming' && (
                              <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={(e) => { e.stopPropagation(); setSelectedEventForDetail(event); }}>
                                Register
                              </Button>
                            )
                          )}
                          {event.predictedDemand === 'High' && eventTab === 'upcoming' && (
                            <Badge variant="jci" className="px-2 py-0.5 text-[10px]">Hot</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {((eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date())).length > 5 && onNavigate) && (
                  <Button variant="ghost" className="w-full mt-2 text-sm text-jci-blue hover:bg-blue-50" onClick={() => onNavigate('EVENTS')}>
                    View All {(eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date())).length} Events
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        {member.role !== UserRole.GUEST && (
          <>
            {/* LEADERBOARD (Wolf Heart) - Spanning 2 columns */}
            <div className="lg:col-span-2">
              <EliteLeaderboard members={leaderboard} currentUser={member} />
            </div>

            {/* OPPORTUNITY DROPS (FOMO) */}
            <Card className="bg-slate-50 border-2 border-dashed border-slate-200 hover:border-jci-blue hover:bg-white transition-all group overflow-hidden">
              <div className="flex items-center justify-between p-1 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                    <Flame size={18} className="animate-bounce" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 uppercase tracking-tight">Active Opportunity Drops</h3>
                </div>
                <Badge variant="jci" className="bg-red-500 text-white animate-pulse">SCARCE</Badge>
              </div>

              {/* NEW: Active Commitments (Phase 3) */}
              {contracts.filter(c => c.status === 'Active').length > 0 && (
                <div className="mb-4 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Your Active Bets</p>
                  {contracts.filter(c => c.status === 'Active').map(c => (
                    <div key={c.id} className="p-4 bg-white border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0px_rgba(15,23,42,0.1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-xs font-black text-slate-900 uppercase italic">Goal: {c.goalTitle}</h4>
                        <div className="flex items-center gap-1 text-red-600 font-black">
                          -{c.stakedPoints} <Target size={12} className="fill-red-600" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                        <Clock size={12} />
                        Ends: {new Date(c.deadline?.seconds * 1000).toLocaleDateString()}
                      </div>
                      <div className="mt-3 text-[10px] p-2 bg-red-50 text-red-700 rounded-lg border border-red-100 font-bold italic">
                        WARNING: Failure to prove completion will results in permanent loss of {c.stakedPoints} PTS.
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm relative group cursor-pointer hover:shadow-lg transition-all active:scale-[0.98]">
                  <div className="absolute top-2 right-2 text-[10px] font-black text-red-500 flex items-center gap-1">
                    <Timer size={12} />
                    ENDING IN 4H
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Exclusive 1V1 Business Mentoring with Regional HQ</h4>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-5 h-5 rounded-full bg-slate-200 border border-white" />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Only 2 Slots Left</span>
                    </div>
                    <div className="flex items-center gap-1 text-jci-blue">
                      <span className="text-sm font-black italic">1,200</span>
                      <Coins size={14} />
                    </div>
                  </div>
                  <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-orange-500 h-full w-[80%]" />
                  </div>
                </div>
                <Button
                  onClick={() => onNavigate?.('BOUNTIES')}
                  className="w-full h-10 font-black uppercase text-xs tracking-widest gap-2 bg-slate-900 hover:bg-black"
                >
                  Enter Marketplace
                  <ArrowUpRight size={14} />
                </Button>
              </div>
            </Card>



            {/* Engagement Points Source removed per user request */}
          </>
        )}
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-50 text-jci-blue rounded-full flex items-center justify-center mx-auto mb-4">
                <Award size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Join Member to Unlock More</h3>
              <p className="text-sm text-slate-500 mb-8">
                Upgrade your account to access Projects, find Mentors, view business directories, and enjoy exclusive member benefits!
              </p>
              <div className="flex flex-col gap-3">
                <Button className="w-full" onClick={() => { setShowUpgradeModal(false); /* Optional route to join */ }}>
                  Join Us Now
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setShowUpgradeModal(false)}>
                  Maybe Later
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Promotion Progress Modal / Bottom Drawer */}
      {showPromoModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end md:items-center md:justify-center" onClick={() => setShowPromoModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg shadow-2xl overflow-hidden max-h-[85vh] md:max-h-[90vh] flex flex-col md:mx-4 animate-slide-up md:animate-fade-in" onClick={(e) => e.stopPropagation()}>
            {/* Drag Handle (mobile only) */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-300"></div>
            </div>
            {/* Header */}
            <div className="px-5 pt-2 pb-4 md:p-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Update Promotion Progress</h3>
                  <p className="text-xs text-slate-500">Fill in and save each requirement</p>
                </div>
              </div>
              <button onClick={() => setShowPromoModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Progress Summary */}
              {promotionProgress && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {promotionProgress.requirements?.filter((r: any) => r.isCompleted).length || 0} of 4 completed
                  </span>
                  <span className="text-sm font-bold text-amber-600">{promotionProgress.overallProgress?.toFixed(0) || 0}%</span>
                </div>
              )}
              {promotionProgress && (
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-4">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${promotionProgress.isEligibleForPromotion
                      ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                      : 'bg-gradient-to-r from-amber-400 to-orange-500'
                      }`}
                    style={{ width: `${promotionProgress.overallProgress || 0}%` }}
                  />
                </div>
              )}

              {/* Requirements */}
              {promoLoading ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="animate-spin text-amber-500" size={24} />
                </div>
              ) : promotionProgress?.requirements ? (
                promotionProgress.requirements.map((req: any) => (
                  <div
                    key={req.id}
                    className={`p-4 rounded-xl border-2 transition-all ${req.isCompleted
                      ? 'border-green-200 bg-green-50/60'
                      : 'border-slate-200 bg-white'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`${req.isCompleted ? 'text-green-500' : 'text-slate-300'}`}>
                          {req.isCompleted ? <CheckCircle size={18} /> : <Clock size={18} />}
                        </div>
                        <span className="font-semibold text-sm text-slate-900">{req.name}</span>
                      </div>
                      {req.isCompleted && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Done</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-3 pl-6">{req.description}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                        placeholder={PROMO_PLACEHOLDER[req.type] || 'Enter details...'}
                        value={promoEditValues[req.type] || ''}
                        onChange={(e) => setPromoEditValues(prev => ({ ...prev, [req.type]: e.target.value }))}
                      />
                      <button
                        className={`rounded-lg border transition-all ${promoEditValues[req.type]?.trim()
                          ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-sm'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                        onClick={() => handleSavePromotionField(req.type)}
                        disabled={promoSavingField === req.type}
                        title="Save"
                      >
                        {promoSavingField === req.type ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Save size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  <AlertTriangle size={24} className="mx-auto mb-2" />
                  Unable to load promotion requirements.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
              <p className="text-[11px] text-slate-500 text-center">
                Your submissions will be reviewed and approved by the <strong>Board of Directors</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Event Detail Modal */}
      {selectedEventForDetail && (
        <EventDetailModal
          event={events.find(e => e.id === selectedEventForDetail.id) || selectedEventForDetail}
          onClose={() => setSelectedEventForDetail(null)}
          onRegister={() => {
            if (member) registerForEvent(selectedEventForDetail.id!, member.id);
          }}
          onCheckIn={() => {
            if (member) markAttendance(selectedEventForDetail.id!, member.id);
          }}
          member={member}
          members={members}
        />
      )}

      {/* Partnership Detail Modal */}
      {selectedAdForDetail && (
        <PartnershipDetailModal
          ad={selectedAdForDetail}
          onClose={() => setSelectedAdForDetail(null)}
        />
      )}
    </div>
  );
};

