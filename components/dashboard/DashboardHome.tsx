// Member Dashboard Home Component
import React from 'react';
import {
  Calendar, Briefcase, Award, Sparkles, AlertTriangle, CheckCircle,
  TrendingUp, Users, Clock, Target, Zap, FileText, DollarSign, UserCog,
  CheckSquare, Heart, BookOpen, LayoutDashboard, Building2, Gift,
  Flame, Trophy, Coins, Timer, ArrowUpRight, Crown, Save, RefreshCw
} from 'lucide-react';
import { Card, StatCard, StatCardsContainer, Badge, Button, useToast, Modal } from '../ui/Common';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useEvents } from '../../hooks/useEvents';
import { useProjects } from '../../hooks/useProjects';
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
import { motion, AnimatePresence } from 'framer-motion';
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
interface EliteLeaderboardProps {
  members: any[];
  currentUser: any;
  year: number;
  onYearChange: (year: number) => void;
}

const EliteLeaderboard: React.FC<EliteLeaderboardProps> = ({ members, currentUser, year, onYearChange }) => {
  const top3 = members.slice(0, 3);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(top3[0]?.id || null);
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    if (top3[0]?.id) {
      setSelectedMemberId(top3[0].id);
    }
  }, [members]);

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
            <div className="absolute top-3 right-4">
              <select
                value={year}
                onChange={(e) => onYearChange(Number(e.target.value))}
                className="appearance-none bg-white/10 text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-full pl-2.5 pr-6 py-1 border border-white/15 cursor-pointer hover:bg-white/15 transition-all focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23f59e0b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
              >
                {availableYears.map(y => (
                  <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>
                ))}
              </select>
            </div>

            <PointsSourceRadarChart memberId={selectedMemberId || undefined} year={year} className="mt-4" />

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
  onNavigate?: (view: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  userRole,
  onNavigate,
  searchQuery,
  onSearchChange,
  scrollRef
}) => {

  const { showToast } = useToast();
  const { member, isDevMode, simulatedRole, simulateRole } = useAuth();
  const { isBoard, isAdmin, isDeveloper, hasPermission, isOrganizationFinance, isActivityFinance, isOrganizationSecretary } = usePermissions();
  const { events, loading: eventsLoading, registerForEvent, markAttendance } = useEvents();
  const { projects, loading: projectsLoading } = useProjects();
  const { members, loading: membersLoading } = useMembers();
  const { nudges, dismissNudge } = useBehavioralNudging();
  const { leaderboard, pointHistory, loadLeaderboard } = usePoints();
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
  // Promotion Progress state (for Probation members)
  const [promotionProgress, setPromotionProgress] = useState<any>(null);
  const [promoEditValues, setPromoEditValues] = useState<Record<string, string>>({});
  const [promoSavingField, setPromoSavingField] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<Event | null>(null);
  const [selectedAdForDetail, setSelectedAdForDetail] = useState<Advertisement | null>(null);
  const [showBirthdayDrawer, setShowBirthdayDrawer] = useState(false);
  const currentYear = new Date().getFullYear();
  const [radarYear, setRadarYear] = useState(currentYear);

  // Load leaderboard when selected year changes
  useEffect(() => {
    const isEligibleMember = member && member.role !== 'GUEST' && member.role !== 'INACTIVE';
    if (isEligibleMember) {
      loadLeaderboard(10, radarYear);
    }
  }, [radarYear, member]);

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

  // Birthday calculation
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  const getDob = (m: any): string | undefined =>
    m.general?.dob || m.dob || m.dateOfBirth;

  const birthdayMembers = React.useMemo(() => {
    return members
      .filter(m => {
        const dob = getDob(m);
        if (!dob) return false;
        const d = new Date(dob);
        return d.getMonth() === currentMonth;
      })
      .sort((a, b) => {
        const da = new Date(getDob(a)!);
        const db = new Date(getDob(b)!);
        return da.getDate() - db.getDate();
      });
  }, [members, currentMonth]);

  const todayBirthdays = React.useMemo(() => {
    return birthdayMembers.filter(m => {
      const dob = getDob(m);
      if (!dob) return false;
      const d = new Date(dob);
      return d.getDate() === currentDay;
    });
  }, [birthdayMembers, currentDay]);

  const nextBirthdayMember = React.useMemo(() => {
    const nextBirthdays = birthdayMembers.filter(m => {
      const dob = getDob(m);
      if (!dob) return false;
      const d = new Date(dob);
      return d.getDate() > currentDay;
    });
    return nextBirthdays.length > 0 ? nextBirthdays[0] : null;
  }, [birthdayMembers, currentDay]);

  if (!member) {
    return <div className="text-center py-10 text-slate-400">Loading member data...</div>;
  }

  return (
    <div className="space-y-4">

      {/* Homepage Advertisements Banner (Swiper) */}
      {homepageAds.length > 0 && (
        <div className="w-full">
          <Swiper
            modules={[Autoplay, Pagination]}
            spaceBetween={16}
            slidesPerView={1.65}
            breakpoints={{
              640: { slidesPerView: 3.15 },
              1024: { slidesPerView: 4.15 },
            }}
            autoplay={{ delay: 3000, disableOnInteraction: false }}
            pagination={{ clickable: true, dynamicBullets: true }}
            loop={homepageAds.length > 1}
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

      {/* Birthday This Month */}
      {birthdayMembers.length > 0 && (
        <Card
          onClick={() => setShowBirthdayDrawer(true)}
          className="relative overflow-hidden bg-gradient-to-r from-rose-50/60 via-fuchsia-50/40 to-indigo-50/20 dark:from-rose-950/10 dark:via-fuchsia-950/5 dark:to-transparent border border-rose-100/80 hover:border-rose-200 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl group cursor-pointer"
        >
          {/* Decorative Background Glows */}
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-pink-400/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-10 -top-10 w-32 h-32 bg-purple-400/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3 min-w-0">
              {/* Birthday Icon / Visual */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-nowrap">
                  <h3 className="font-extrabold text-slate-800 text-sm tracking-tight flex-shrink-0">
                    Birthdays This Month
                  </h3>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded-full border border-pink-100 flex-shrink-0">
                    {now.toLocaleString('default', { month: 'long' })}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                  {birthdayMembers.length} members celebrate birthdays
                </p>

                {todayBirthdays.length > 0 ? (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                      <span className="w-1 h-1 rounded-full bg-orange-500" />
                      Today: {todayBirthdays.map(m => m.general?.name?.split(' ')[0] || m.name?.split(' ')[0]).join(', ')} 🎉
                    </span>
                  </div>
                ) : nextBirthdayMember ? (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 bg-purple-50/50 border border-purple-100/50 px-2 py-0.5 rounded-full">
                      📅 Next: {nextBirthdayMember.general?.name?.split(' ')[0] || nextBirthdayMember.name?.split(' ')[0]} ({new Date(getDob(nextBirthdayMember)!).getDate()} {now.toLocaleString('default', { month: 'short' })})
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                      ✨ Click to view calendar
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Avatar Stack + Chevron */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Overlapping Avatars */}
              <div className="flex items-center">
                {birthdayMembers.slice(0, 4).map((m, i) => {
                  const name = m.general?.name || m.name || '';
                  const avatarUrl = m.general?.avatarUrl || m.avatar;

                  if (avatarUrl) {
                    return (
                      <img
                        key={m.id}
                        src={avatarUrl}
                        alt={name}
                        className="rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-pink-100/30 flex-shrink-0 transition-transform group-hover:-translate-y-0.5"
                        style={{
                          width: '34px',
                          height: '34px',
                          marginLeft: i > 0 ? '-10px' : '0px',
                          zIndex: 10 - i
                        }}
                      />
                    );
                  } else {
                    const initials = name
                      .split(' ')
                      .map((n: string) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    let hash = 0;
                    for (let j = 0; j < name.length; j++) {
                      hash = name.charCodeAt(j) + ((hash << 5) - hash);
                    }
                    const gradients = [
                      'from-pink-500 to-rose-500',
                      'from-purple-500 to-indigo-500',
                      'from-blue-500 to-sky-500',
                      'from-teal-500 to-emerald-500',
                      'from-amber-500 to-orange-500',
                    ];
                    const gradient = gradients[Math.abs(hash) % gradients.length];

                    return (
                      <div
                        key={m.id}
                        className={`rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-[10px] font-bold text-white border-2 border-white shadow-sm ring-1 ring-pink-100/30 flex-shrink-0 transition-transform group-hover:-translate-y-0.5`}
                        style={{
                          width: '34px',
                          height: '34px',
                          marginLeft: i > 0 ? '-10px' : '0px',
                          zIndex: 10 - i
                        }}
                      >
                        {initials}
                      </div>
                    );
                  }
                })}

                {birthdayMembers.length > 4 && (
                  <div
                    className="rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm ring-1 ring-pink-100/30 flex-shrink-0"
                    style={{
                      width: '34px',
                      height: '34px',
                      marginLeft: '-10px',
                      zIndex: 5
                    }}
                  >
                    +{birthdayMembers.length - 4}
                  </div>
                )}
              </div>

              {/* Chevron */}
              <div className="text-slate-400 group-hover:text-pink-500 transition-colors pl-0.5 transform group-hover:translate-x-0.5 transition-transform duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900">Events</h3>
            <button
              onClick={() => onNavigate?.('EVENTS')}
              className="text-xs font-black text-jci-blue uppercase tracking-widest hover:opacity-70 transition-opacity"
            >
              View All
            </button>
          </div>
          {eventsLoading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Loading events...</div>
          ) : (eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date())).length === 0 ? (
            <div className="text-center py-8 text-slate-400 font-medium">
              <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No {eventTab} events</p>
            </div>
          ) : (
            <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 snap-x snap-mandatory">
              {(eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date()))
                .sort((a, b) => eventTab === 'upcoming' ? new Date(a.date).getTime() - new Date(b.date).getTime() : new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 8)
                .map(event => {
                  const isRecommended = recommendedEvents.some(re => re.id === event.id);
                  const isRegistered = myRegistrationEventIds.includes(event.id!);
                  const date = new Date(event.date);
                  const isUpcoming = eventTab === 'upcoming';
                  return (
                    <div
                      key={event.id}
                      className="flex flex-col flex-none w-[60.6%] sm:w-auto rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer active:scale-[0.99] snap-start"
                      onClick={() => setSelectedEventForDetail(event)}
                    >
                      {/* Poster */}
                      <div className="relative w-full h-32 bg-gradient-to-br from-blue-50 to-slate-100 overflow-hidden flex-shrink-0">
                        {event.imageUrl ? (
                          <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                            <Calendar size={32} strokeWidth={1.5} />
                            <span className="text-[10px] font-semibold mt-1 text-slate-400">No Poster</span>
                          </div>
                        )}
                        <div className="absolute top-2 left-2 flex items-center gap-1">
                          <Badge variant="neutral" className="text-[9px] px-1.5 py-0.5 bg-white/90 backdrop-blur-sm shadow-sm border-0 text-slate-700">{event.type}</Badge>
                          {event.predictedDemand === 'High' && isUpcoming && (
                            <Badge variant="jci" className="text-[9px] px-1.5 py-0.5 bg-jci-blue/90 backdrop-blur-sm shadow-sm border-0 text-white">Hot</Badge>
                          )}
                        </div>
                        <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-sm rounded-xl px-2 py-1 shadow-sm text-center min-w-[36px]">
                          <p className="text-[8px] font-black text-jci-blue uppercase tracking-widest leading-none">{date.toLocaleString('default', { month: 'short' })}</p>
                          <p className="text-sm font-black text-slate-900 leading-tight">{date.getDate()}</p>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="flex flex-col p-3 gap-1.5">
                        <div className="flex items-start gap-1">
                          <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug flex-1">{event.title}</h4>
                          {isRecommended && <Badge variant="jci" className="bg-purple-100 text-purple-600 border-none px-1.5 py-0 text-[9px] flex-shrink-0">AI</Badge>}
                        </div>
                        <p className="text-[10px] text-slate-500">{event.attendees} Attending</p>
                        {isUpcoming && (
                          isRegistered ? (
                            <Badge variant="success" className="mt-auto text-center text-[10px] py-1">Registered</Badge>
                          ) : (
                            <Button size="sm" variant="primary" className="mt-auto w-full text-xs" onClick={(e) => { e.stopPropagation(); setSelectedEventForDetail(event); }}>
                              Register
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
          {((eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date())).length > 8 && onNavigate) && (
            <Button variant="ghost" className="w-full mt-3 text-sm text-jci-blue hover:bg-blue-50" onClick={() => onNavigate('EVENTS')}>
              View All {(eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date())).length} Events
            </Button>
          )}
        </div>

        {member.role !== UserRole.GUEST && (
          <>
            {/* LEADERBOARD (Wolf Heart) - Spanning 2 or 3 columns depending on active commitments */}
            <div className={contracts.filter(c => c.status === 'Active').length > 0 ? "lg:col-span-2" : "lg:col-span-3"}>
              <EliteLeaderboard members={leaderboard} currentUser={member} year={radarYear} onYearChange={setRadarYear} />
            </div>

            {/* ACTIVE COMMITMENTS / BETS */}
            {contracts.filter(c => c.status === 'Active').length > 0 && (
              <Card className="bg-slate-50 border-2 border-slate-200 hover:bg-white transition-all group overflow-hidden">
                <div className="flex items-center justify-between p-1 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                      <Flame size={18} className="animate-bounce" />
                    </div>
                    <h3 className="font-extrabold text-slate-900 uppercase tracking-tight">Active Commitments</h3>
                  </div>
                </div>

                <div className="space-y-3">
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
                        Ends: {c.deadline?.seconds ? new Date(c.deadline.seconds * 1000).toLocaleDateString() : 'N/A'}
                      </div>
                      <div className="mt-3 text-[10px] p-2 bg-red-50 text-red-700 rounded-lg border border-red-100 font-bold italic">
                        WARNING: Failure to prove completion will results in permanent loss of {c.stakedPoints} PTS.
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}



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

      {/* Birthday Drawer */}
      <Modal
        isOpen={showBirthdayDrawer}
        onClose={() => setShowBirthdayDrawer(false)}
        title={
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">Birthdays This Month</span>
            <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {now.toLocaleString('default', { month: 'long' })}
            </span>
          </div>
        }
        size="md"
        drawerOnMobile={true}
        bottomSheet={true}
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {birthdayMembers.map(m => {
            const dob = new Date(getDob(m)!);
            const day = dob.getDate();
            const isToday = day === currentDay;

            return (
              <div
                key={m.id}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${isToday
                  ? 'bg-gradient-to-r from-orange-50 to-amber-50/50 border-orange-200 shadow-sm animate-pulse'
                  : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={m.general?.avatarUrl || m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.general?.name || m.name || '')}&background=e0f2fe&color=0097D7`}
                      alt={m.general?.name || m.name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-sm"
                    />
                    {isToday && (
                      <span className="absolute -top-1.5 -right-1.5 text-base">🎉</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{m.general?.name || m.name}</h4>
                    <p className="text-[11px] text-slate-500 font-medium">{m.membershipType || 'Member'} • FY {m.duesYear || 'N/A'}</p>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-1">
                  <span className={`text-xs font-bold px-2 py-1 rounded-xl border ${isToday
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-150'
                    }`}>
                    {isToday ? 'Today! 🎂' : `${dob.toLocaleString('default', { month: 'short' })} ${day}`}
                  </span>
                  {isToday && (
                    <Button
                      size="sm"
                      variant="primary"
                      className="text-[10px] h-6 py-0 px-2.5 bg-orange-500 hover:bg-orange-650 text-white font-bold border-none"
                      onClick={() => {
                        navigator.clipboard.writeText(`Happy Birthday ${m.general?.name || m.name}! 🎂 Wishing you a wonderful day!`);
                        showToast(`Copied wishes to clipboard!`, 'success');
                      }}
                    >
                      Copy Wishes
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
};

