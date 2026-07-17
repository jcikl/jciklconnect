// Member Dashboard Home Component
import React from 'react';
import {
  Calendar, Briefcase, Award, Sparkles, AlertTriangle, CheckCircle,
  TrendingUp, Users, Clock, Target, Zap, FileText, DollarSign, UserCog,
  CheckSquare, Heart, BookOpen, LayoutDashboard, Building2,
  Flame, Trophy, Coins, Timer, ArrowUpRight, Crown, RefreshCw, ChevronRight
} from 'lucide-react';
import { Card, StatCard, StatCardsContainer, Badge, Button, useToast, Modal, Skeleton } from '../ui/Common';
import { MembersOnlyOverlay } from '../ui/MembersOnlyOverlay';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useEvents } from '../../hooks/useEvents';
import { useProjects } from '../../hooks/useProjects';
import { useMembers } from '../../hooks/useMembers';
import { useBehavioralNudging } from '../../hooks/useBehavioralNudging';
import { NudgeBanner } from '../ui/NudgeBanner';
import { AIPredictionService, PersonalizedRecommendation } from '../../services/aiPredictionService';
import { EventRegistrationService } from '../../services/eventRegistrationService';
import { MEMBER_TIERS, BOUNTY_STATUS } from '../../config/constants';
import { ContractService, CommitmentContract } from '../../services/contractService';
import { PromotionService, type MemberEngagementProgressSummary, type EngagementYear } from '../../services/promotionService';
import { MembersService } from '../../services/membersService';
import { MemberJourneyService, MemberJourney } from '../../services/memberJourneyService';
import { AdvertisementService, Advertisement } from '../../services/advertisementService';
import type { Event } from '../../types';
import { EventRow } from '../modules/Events/EventRow';
import { UserRole } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { EventDetailModal } from '../modules/EventsView';
import { PartnershipDetailModal } from './PartnershipDetailModal';
import { useState, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';


/** membershipType 归一化：兼容旧版小写值（'probation member' / 'official member'…）与缺失值（按角色兜底） */
const normalizeMembership = (m: { membershipType?: string; role?: UserRole | string } | null): 'probation' | 'full' | 'guest' => {
  if (!m) return 'guest';
  const mt = (m.membershipType || '').toLowerCase();
  if (mt.includes('probation')) return 'probation';
  if (mt && !mt.includes('guest')) return 'full';
  if (!mt) {
    if (m.role && [UserRole.MEMBER, UserRole.BOARD, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(m.role as UserRole)) return 'full';
  }
  return 'guest';
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
  const { events, loading: eventsLoading, registerForEvent, markAttendance, cancelRegistration } = useEvents();
  const { projects, loading: projectsLoading } = useProjects();
  const { members, loading: membersLoading } = useMembers();
  const { nudges, dismissNudge } = useBehavioralNudging();
  const [recommendations, setRecommendations] = useState<PersonalizedRecommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [topRecommendation, setTopRecommendation] = useState<PersonalizedRecommendation | null>(null);
  const [myRegistrationEventIds, setMyRegistrationEventIds] = useState<string[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [eventTab, setEventTab] = useState<'upcoming' | 'past'>('upcoming');
  const [contracts, setContracts] = useState<CommitmentContract[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [homepageAds, setHomepageAds] = useState<Advertisement[]>([]);
  const [adsLoading, setAdsLoading] = useState(true);
  // Promotion Progress state (for Probation members)
  const [promotionProgress, setPromotionProgress] = useState<any>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  // Membership Journey modal state
  const [showJourneyModal, setShowJourneyModal] = useState(false);
  const [journeyActiveTab, setJourneyActiveTab] = useState<'probation' | 'firstYear' | 'secondYear' | 'leadership' | 'trainer'>('probation');
  // Leadership Journey + Trainer Pathway (shown to all members)
  const [pathwayJourney, setPathwayJourney] = useState<MemberJourney | null>(null);
  const [journeyGroupTab, setJourneyGroupTab] = useState<'Leadership Experience' | 'Skills Development' | 'JCI Experience'>('Leadership Experience');
  const [engagementFirst, setEngagementFirst] = useState<MemberEngagementProgressSummary | null>(null);
  const [engagementSecond, setEngagementSecond] = useState<MemberEngagementProgressSummary | null>(null);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<Event | null>(null);
  const [selectedAdForDetail, setSelectedAdForDetail] = useState<Advertisement | null>(null);
  const [showBirthdayDrawer, setShowBirthdayDrawer] = useState(false);
  const [expandedJourneySteps, setExpandedJourneySteps] = useState<Set<string>>(new Set());


  const handleRestrictedAction = (viewType: string) => {
    // Benefits is reachable by guests — the page itself masks its content
    if (member?.role === UserRole.GUEST && viewType !== 'BENEFITS') {
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
      } finally {
        setAdsLoading(false);
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

  // Load Leadership/Trainer journey (shown to all members in the journey modal)
  useEffect(() => {
    if (!member || normalizeMembership(member) === 'guest') return;
    let cancelled = false;
    MemberJourneyService.getJourney(member)
      .then(j => { if (!cancelled) setPathwayJourney(j); })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [member?.id]);

  // Load Promotion Progress for Probation and Full members (Journey modal shows it for both)
  useEffect(() => {
    if (!member || normalizeMembership(member) === 'guest') return;
    const loadPromotion = async () => {
      setPromoLoading(true);
      try {
        const progress = await PromotionService.getPromotionProgress(member.id);
        setPromotionProgress(progress);
      } catch (err) {
        console.error('Failed to load promotion progress:', err);
      } finally {
        setPromoLoading(false);
      }
    };
    loadPromotion();
  }, [member]);

  // Load Engagement Progress for all members (Probation included)
  useEffect(() => {
    if (!member || normalizeMembership(member) === 'guest') return;
    const loadEngagement = async () => {
      setEngagementLoading(true);
      try {
        const memberData = await MembersService.getMemberById(member.id);
        if (!memberData) return;
        const first = PromotionService.buildEngagementProgress(memberData, 'firstYear');
        const second = PromotionService.buildEngagementProgress(memberData, 'secondYear');
        setEngagementFirst(first);
        setEngagementSecond(second);
      } catch (err) {
        console.error('Failed to load engagement progress', err);
      } finally {
        setEngagementLoading(false);
      }
    };
    loadEngagement();
  }, [member]);

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

  const openJourneyModal = () => {
    if (!member) return;
    const joinDateStr = typeof member.joinDate === 'string' ? member.joinDate : '';
    const joinYear = joinDateStr ? new Date(joinDateStr).getFullYear() : null;
    if (normalizeMembership(member) === 'probation') {
      setJourneyActiveTab('probation');
    } else if (joinYear !== null && joinYear < 2025) {
      // Veterans skip 1st/2nd year tracking — land on Leadership
      setJourneyActiveTab('leadership');
    } else {
      const yearsIn = joinYear ? new Date().getFullYear() - joinYear : 0;
      setJourneyActiveTab(yearsIn >= 1 ? 'secondYear' : 'firstYear');
    }
    setShowJourneyModal(true);
  };

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
        const dayA = new Date(getDob(a)!).getDate();
        const dayB = new Date(getDob(b)!).getDate();
        // Passed birthdays sink to the bottom; upcoming/today stay on top (both ascending)
        const passedA = dayA < currentDay ? 1 : 0;
        const passedB = dayB < currentDay ? 1 : 0;
        if (passedA !== passedB) return passedA - passedB;
        return dayA - dayB;
      });
  }, [members, currentMonth, currentDay]);

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
    return (
      <div className="space-y-4">
        {/* Journey card skeleton */}
        <Skeleton className="h-[72px]" rounded="2xl" />
        {/* Stats grid skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[80px]" rounded="xl" />)}
        </div>
        {/* Events section skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-24" rounded="md" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[200px]" rounded="2xl" />)}
          </div>
        </div>
        {/* Bottom cards skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[160px]" rounded="2xl" />
          <Skeleton className="h-[160px]" rounded="2xl" />
        </div>
      </div>
    );
  }

  // membershipType has legacy lowercase variants and may be missing — normalize with role fallback
  const membershipKind = normalizeMembership(member);
  const isProbationMember = membershipKind === 'probation';
  const isFullMember = membershipKind === 'full';
  // Everyone sees the journey card — guests get the "Join us" upsell version
  const showJourneyCard = true;
  const joinDateStr = typeof member.joinDate === 'string' ? member.joinDate : '';
  const joinYear = joinDateStr ? new Date(joinDateStr).getFullYear() : null;
  const yearsInMembership = joinYear ? new Date().getFullYear() - joinYear : 0;
  // 1st/2nd-year engagement only applies to members who joined in 2025 or later
  const isVeteranMember = isFullMember && joinYear !== null && joinYear < 2025;
  const showEngagementSteps = joinYear === null || joinYear >= 2025;
  // Membership status: Probation Member / Voting Member (Pending dues) / Voting Member
  const currentYearDuesStatus = member.membership?.[String(new Date().getFullYear())]?.status;
  const isDuesPaid = currentYearDuesStatus === 'paid' || currentYearDuesStatus === 'over paid';
  const membershipStatusLabel = isProbationMember
    ? 'Probation Member'
    : isFullMember
      ? (isDuesPaid ? 'Voting Member' : 'Voting Member (Pending dues)')
      : '';
  const activeEngSummary = yearsInMembership >= 1 ? engagementSecond : engagementFirst;
  const journeyProgress = isProbationMember
    ? (promotionProgress?.overallProgress || 0)
    : (activeEngSummary?.overallProgress || 0);
  const journeyLabel = isProbationMember
    ? `${promotionProgress?.requirements?.filter((r: any) => r.isCompleted).length || 0}/4 · Probation`
    : activeEngSummary
      ? `${activeEngSummary.completedCount}/${activeEngSummary.totalCount} · ${yearsInMembership >= 1 ? '2nd Year' : '1st Year'}`
      : '...';
  const journeyIsComplete = isProbationMember
    ? promotionProgress?.isEligibleForPromotion
    : activeEngSummary?.isCompleted;

  const nextStepHint = isProbationMember
    ? (promotionProgress?.requirements?.find((r: any) => !r.isCompleted)?.name ?? null)
    : (activeEngSummary?.requirements?.find(r => !r.isCompleted && !r.progress?.pendingVerification)?.title ?? null);

  return (
    <div className="space-y-4">

      {/* Birthday This Month — top of dashboard */}
      {birthdayMembers.length > 0 && (
        <div
          onClick={() => setShowBirthdayDrawer(true)}
          className="relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
        >
          <div className="absolute inset-0" style={{ backgroundImage: 'url(/background/birthday-background.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(190,18,60,0.82) 0%, rgba(134,25,143,0.78) 50%, rgba(79,70,229,0.75) 100%)' }} />
          <div className="relative z-10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-3xl leading-none select-none drop-shadow-md">🎂</span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-200/80 leading-none mb-0.5">This Month</p>
                  <h3 className="font-extrabold text-white text-lg leading-tight drop-shadow-sm">Birthdays</h3>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/30">
                {now.toLocaleString('default', { month: 'long' })}
              </span>
            </div>
            {todayBirthdays.length > 0 ? (
              <div className="mb-3 flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse flex-shrink-0" />
                <span className="text-[12px] font-bold text-white truncate">🎉 Today: {todayBirthdays.map(m => m.general?.name?.split(' ')[0] || m.name?.split(' ')[0]).join(', ')}</span>
              </div>
            ) : nextBirthdayMember ? (
              <div className="mb-3 flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2">
                <span className="text-[12px] font-semibold text-white/90 truncate">📅 Next: {nextBirthdayMember.general?.name?.split(' ')[0] || nextBirthdayMember.name?.split(' ')[0]} — {new Date(getDob(nextBirthdayMember)!).getDate()} {now.toLocaleString('default', { month: 'short' })}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center">
                  {birthdayMembers.slice(0, 5).map((m, i) => {
                    const name = m.general?.name || m.name || '';
                    const avatarUrl = m.general?.avatarUrl || m.avatar;
                    const sharedStyle = { width: '36px', height: '36px', marginLeft: i > 0 ? '-10px' : '0px', zIndex: 10 - i };
                    if (avatarUrl) return <img key={m.id} src={avatarUrl} alt={name} className="rounded-full object-cover border-2 border-white/60 shadow-md flex-shrink-0 group-hover:-translate-y-0.5 transition-transform" style={sharedStyle} />;
                    const initials = name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
                    let hash = 0; for (let j = 0; j < name.length; j++) hash = name.charCodeAt(j) + ((hash << 5) - hash);
                    const gradients = ['from-pink-400 to-rose-500', 'from-violet-400 to-purple-500', 'from-sky-400 to-blue-500', 'from-teal-400 to-emerald-500', 'from-amber-400 to-orange-500'];
                    return <div key={m.id} className={`rounded-full bg-gradient-to-br ${gradients[Math.abs(hash) % gradients.length]} flex items-center justify-center text-[10px] font-bold text-white border-2 border-white/60 shadow-md flex-shrink-0 group-hover:-translate-y-0.5 transition-transform`} style={sharedStyle}>{initials}</div>;
                  })}
                  {birthdayMembers.length > 5 && <div className="rounded-full border-2 border-white/60 bg-white/25 flex items-center justify-center text-[10px] font-bold text-white shadow-md flex-shrink-0" style={{ width: '36px', height: '36px', marginLeft: '-10px', zIndex: 5 }}>+{birthdayMembers.length - 5}</div>}
                </div>
                <span className="text-[11px] font-semibold text-white/80">{birthdayMembers.length} celebrating</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:bg-white/30 transition-all duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:translate-x-0.5 transition-transform duration-200"><path d="m9 18 6-6-6-6" /></svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Partners Banner (Swiper) */}
      {(adsLoading || homepageAds.length > 0) && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">Partners</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>
      )}
      {adsLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map(i => <Skeleton key={i} className="flex-none w-[58%] sm:w-[30%] lg:w-[23%] h-36 sm:h-40" rounded="2xl" />)}
        </div>
      ) : homepageAds.length > 0 && (
        <div className="w-full relative rounded-2xl overflow-hidden">
          {/* Guest mask — partner benefits are members only */}
          {member?.role === UserRole.GUEST && (
            <MembersOnlyOverlay compact description="Join JCI KL to unlock partner privileges." />
          )}
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
            loop={false}
            rewind={homepageAds.length > 1}
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


      {/* Membership Journey Card */}
      {showJourneyCard && (
        <div
          className="relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
          onClick={(isProbationMember || isFullMember) ? openJourneyModal : () => setShowUpgradeModal(true)}
        >
          <div className="absolute inset-0" style={{ backgroundImage: 'url(/background/birthday-background.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.88) 0%, rgba(180,83,9,0.84) 50%, rgba(120,53,15,0.82) 100%)' }} />
          <div className="relative z-10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-3xl leading-none select-none drop-shadow-md">🏅</span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-200/80 leading-none mb-0.5">Your Progress</p>
                  <h3 className="font-extrabold text-white text-lg leading-tight drop-shadow-sm">Membership Journey</h3>
                </div>
              </div>
              {(isProbationMember || isFullMember) && (
                <span className="text-[10px] font-black uppercase tracking-widest text-white bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/30">
                  {isProbationMember ? 'Probation' : isVeteranMember ? `Member since ${joinYear}` : yearsInMembership >= 1 ? '2nd Year' : '1st Year'}
                </span>
              )}
            </div>
            {isFullMember ? (
              <>
                {/* Per-stage mini progress: Probation / (1st, 2nd) / Leadership / Trainer */}
                <div className="mb-3 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2">
                  <div className="flex items-start gap-1.5">
                    {[
                      { label: 'Probation', pct: 100 },
                      ...(showEngagementSteps ? [
                        { label: '1st Year', pct: engagementFirst?.overallProgress || 0 },
                        { label: '2nd Year', pct: engagementSecond?.overallProgress || 0 },
                      ] : []),
                      { label: 'Leadership', pct: pathwayJourney ? ((pathwayJourney.leadership.currentIndex + 1) / pathwayJourney.leadership.steps.length) * 100 : 0 },
                      { label: 'Trainer', pct: pathwayJourney ? ((pathwayJourney.trainer.currentIndex + 1) / pathwayJourney.trainer.steps.length) * 100 : 0 },
                    ].map(stage => (
                      <div key={stage.label} className="flex-1 min-w-0">
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, stage.pct)}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className={`h-full rounded-full ${stage.pct >= 100 ? 'bg-green-300' : 'bg-amber-200'}`}
                          />
                        </div>
                        <p className="text-[8px] font-black uppercase tracking-wide text-white/60 text-center mt-1 truncate">{stage.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-white/70 truncate">
                    {isVeteranMember && pathwayJourney ? (
                      `${membershipStatusLabel} · ${pathwayJourney.leadership.steps[pathwayJourney.leadership.currentIndex]?.title} · Trainer: ${pathwayJourney.trainer.currentIndex >= 0 ? pathwayJourney.trainer.steps[pathwayJourney.trainer.currentIndex]?.title : 'Not started'}`
                    ) : nextStepHint && !journeyIsComplete ? (
                      <><ArrowUpRight size={10} className="inline -mt-0.5 mr-0.5" />Next: {nextStepHint}</>
                    ) : journeyIsComplete ? (
                      '✓ All requirements completed'
                    ) : (
                      membershipStatusLabel || 'Keep going — you\'re making progress!'
                    )}
                  </p>
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:bg-white/30 transition-all duration-200 flex-shrink-0 ml-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:translate-x-0.5 transition-transform duration-200"><path d="m9 18 6-6-6-6" /></svg>
                  </div>
                </div>
              </>
            ) : isProbationMember ? (
              <>
                <div className="mb-3 flex items-center gap-3 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2">
                  <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${journeyProgress}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className={`h-full rounded-full ${journeyIsComplete ? 'bg-green-300' : 'bg-amber-200'}`}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-white/90 flex-shrink-0">
                    {promoLoading ? '...' : journeyLabel.split(' · ')[0]}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-white/70 truncate">
                    {nextStepHint && !journeyIsComplete ? (
                      <><ArrowUpRight size={10} className="inline -mt-0.5 mr-0.5" />Next: {nextStepHint}</>
                    ) : journeyIsComplete ? (
                      '✓ All requirements completed'
                    ) : (
                      'Keep going — you\'re making progress!'
                    )}
                  </p>
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:bg-white/30 transition-all duration-200 flex-shrink-0 ml-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:translate-x-0.5 transition-transform duration-200"><path d="m9 18 6-6-6-6" /></svg>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold text-white/80">Join us to unlock more benefits</p>
                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m9 18 6-6-6-6" /></svg>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">Events</span>
            <div className="flex-1 h-px bg-slate-100" />
            <button
              onClick={() => onNavigate?.('EVENTS')}
              className="text-[10px] font-black text-jci-blue uppercase tracking-widest hover:opacity-70 transition-opacity shrink-0"
            >
              View All
            </button>
          </div>
          {eventsLoading ? (
            <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="flex-none w-[60.6%] sm:w-auto h-[200px]" rounded="2xl" />)}
            </div>
          ) : (eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date())).length === 0 ? (
            <div className="text-center py-8 text-slate-400 font-medium">
              <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No {eventTab} events</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date()))
                .sort((a, b) => eventTab === 'upcoming' ? new Date(a.date).getTime() - new Date(b.date).getTime() : new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map(event => (
                  <EventRow
                    key={event.id}
                    event={event}
                    member={member}
                    horizontal
                    onRegister={() => setSelectedEventForDetail(event)}
                    onClick={() => setSelectedEventForDetail(event)}
                  />
                ))}
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
                        Ends: {c.deadline ? (typeof (c.deadline as any).seconds === 'number' ? new Date((c.deadline as any).seconds * 1000).toLocaleDateString() : new Date(c.deadline as unknown as Date).toLocaleDateString()) : 'N/A'}
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

      {/* Membership Journey Modal — 3-tab: Probation / 1st Year / 2nd Year */}
      {showJourneyModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end md:items-center md:justify-center" onClick={() => setShowJourneyModal(false)}>
          <div className="rounded-t-[32px] md:rounded-2xl w-full md:max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col md:mx-4 animate-slide-up md:animate-fade-in" style={{ background: '#0f172a' }} onClick={(e) => e.stopPropagation()}>

            {/* Header — matches journey card background (drag handle integrated) */}
            <div className="px-5 pt-3 pb-4 flex-shrink-0" style={{
              backgroundImage: 'linear-gradient(135deg, rgba(217,119,6,0.88) 0%, rgba(180,83,9,0.84) 50%, rgba(120,53,15,0.82) 100%), url(/background/birthday-background.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}>
              <div className="flex justify-center pb-2 md:hidden">
                <div className="w-10 h-1 rounded-full bg-white/30" />
              </div>
              <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white border border-white/25">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-white">Membership Journey</h3>
                  <p className="text-xs text-amber-200/80">Track your progress at each stage</p>
                </div>
              </div>
              <button onClick={() => setShowJourneyModal(false)} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
              </div>
            </div>

            {/* Journey Stepper */}
            <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-start">

                {/* Probation step */}
                <button
                  className="flex flex-col items-center gap-1.5 flex-1 focus:outline-none"
                  onClick={() => setJourneyActiveTab('probation')}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isFullMember ? 'bg-emerald-500 text-white'
                    : journeyActiveTab === 'probation' ? 'bg-amber-500 text-white'
                      : 'bg-white/10 text-white/40'
                    }`}>
                    {isFullMember ? <CheckCircle size={14} /> : 'P'}
                  </div>
                  <span className={`text-[10px] font-semibold whitespace-nowrap ${journeyActiveTab === 'probation' ? 'text-amber-400'
                    : isFullMember ? 'text-emerald-400'
                      : 'text-white/40'
                    }`}>Probation</span>
                  <span className={`text-[10px] ${isFullMember ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isProbationMember
                      ? `${promotionProgress?.overallProgress?.toFixed(0) ?? 0}%`
                      : '100%'}
                  </span>
                </button>

                {showEngagementSteps && (<>
                {/* Connector */}
                <div className={`flex-1 h-0.5 mt-4 transition-colors ${isFullMember ? 'bg-emerald-500/60' : 'bg-white/15'}`} />

                {/* 1st Year step */}
                <button
                  className="flex flex-col items-center gap-1.5 flex-1 focus:outline-none"
                  onClick={() => setJourneyActiveTab('firstYear')}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${engagementFirst?.isCompleted ? 'bg-emerald-500 text-white'
                    : journeyActiveTab === 'firstYear' ? 'bg-sky-500 text-white'
                      : 'bg-white/10 text-white/40'
                    }`}>
                    {engagementFirst?.isCompleted ? <CheckCircle size={14} /> : '1'}
                  </div>
                  <span className={`text-[10px] font-semibold whitespace-nowrap ${journeyActiveTab === 'firstYear' ? 'text-sky-400'
                    : engagementFirst?.isCompleted ? 'text-emerald-400'
                      : 'text-white/40'
                    }`}>1st Year</span>
                  {engagementFirst && (
                    <span className={`text-[10px] ${engagementFirst.isCompleted ? 'text-emerald-400' : 'text-sky-400'}`}>
                      {engagementFirst.overallProgress.toFixed(0)}%
                    </span>
                  )}
                </button>

                {/* Connector */}
                <div className={`flex-1 h-0.5 mt-4 transition-colors ${engagementFirst?.isCompleted ? 'bg-emerald-500/60' : 'bg-white/15'}`} />

                {/* 2nd Year step */}
                <button
                  className="flex flex-col items-center gap-1.5 flex-1 focus:outline-none"
                  onClick={() => setJourneyActiveTab('secondYear')}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${engagementSecond?.isCompleted ? 'bg-emerald-500 text-white'
                    : journeyActiveTab === 'secondYear' ? 'bg-violet-500 text-white'
                      : 'bg-white/10 text-white/40'
                    }`}>
                    {engagementSecond?.isCompleted ? <CheckCircle size={14} /> : '2'}
                  </div>
                  <span className={`text-[10px] font-semibold whitespace-nowrap ${journeyActiveTab === 'secondYear' ? 'text-violet-400'
                    : engagementSecond?.isCompleted ? 'text-emerald-400'
                      : 'text-white/40'
                    }`}>2nd Year</span>
                  {engagementSecond && (
                    <span className={`text-[10px] ${engagementSecond.isCompleted ? 'text-emerald-400' : 'text-violet-400'}`}>
                      {engagementSecond.overallProgress.toFixed(0)}%
                    </span>
                  )}
                </button>
                </>)}

                {/* Connector */}
                <div className={`flex-1 h-0.5 mt-4 transition-colors ${showEngagementSteps
                  ? (engagementSecond?.isCompleted ? 'bg-emerald-500/60' : 'bg-white/15')
                  : (isFullMember ? 'bg-emerald-500/60' : 'bg-white/15')}`} />

                {/* Leadership step */}
                <button
                  className="flex flex-col items-center gap-1.5 flex-1 focus:outline-none"
                  onClick={() => setJourneyActiveTab('leadership')}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${journeyActiveTab === 'leadership' ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/40'}`}>
                    <Crown size={14} />
                  </div>
                  <span className={`text-[10px] font-semibold ${journeyActiveTab === 'leadership' ? 'text-amber-400' : 'text-white/40'}`}>Leadership</span>
                  <span className="text-[10px] text-amber-400">
                    {pathwayJourney ? `${pathwayJourney.leadership.currentIndex + 1}/${pathwayJourney.leadership.steps.length}` : '...'}
                  </span>
                </button>

                {/* Connector */}
                <div className="flex-1 h-0.5 mt-4 bg-white/15" />

                {/* Trainer step */}
                <button
                  className="flex flex-col items-center gap-1.5 flex-1 focus:outline-none"
                  onClick={() => setJourneyActiveTab('trainer')}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${journeyActiveTab === 'trainer' ? 'bg-sky-500 text-white' : 'bg-white/10 text-white/40'}`}>
                    <BookOpen size={14} />
                  </div>
                  <span className={`text-[10px] font-semibold ${journeyActiveTab === 'trainer' ? 'text-sky-400' : 'text-white/40'}`}>Trainer</span>
                  <span className="text-[10px] text-sky-400">
                    {pathwayJourney ? `${pathwayJourney.trainer.currentIndex + 1}/${pathwayJourney.trainer.steps.length}` : '...'}
                  </span>
                </button>

              </div>
            </div>

            {/* Tab Body */}
            <div className="p-4 overflow-y-auto no-scrollbar flex-1 space-y-3">

              {/* ── Probation Tab ── */}
              {journeyActiveTab === 'probation' && (
                <>
                  {promotionProgress && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-white/50">
                          {promotionProgress.requirements?.filter((r: any) => r.isCompleted).length || 0}/{promotionProgress.requirements?.length || 4} completed
                        </span>
                        <span className="text-xs font-bold text-white/80">{promotionProgress.overallProgress?.toFixed(0) || 0}%</span>
                      </div>
                      <div className="flex gap-1">
                        {(promotionProgress.requirements || []).map((req: any, i: number) => (
                          <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${req.isCompleted ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-white/10'}`} />
                        ))}
                      </div>
                      {promotionProgress.isEligibleForPromotion && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                          <CheckCircle size={12} /> All requirements met
                        </div>
                      )}
                    </div>
                  )}

                  {promoLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <RefreshCw className="animate-spin text-amber-400" size={24} />
                    </div>
                  ) : promotionProgress?.requirements ? (
                    <div className="space-y-2">
                      {promotionProgress.requirements.map((req: any) => (
                        <div key={req.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl" style={{ background: req.isCompleted ? 'rgba(52,211,153,0.10)' : 'rgba(255,255,255,0.05)', border: req.isCompleted ? '1px solid rgba(52,211,153,0.25)' : '1px solid rgba(255,255,255,0.08)' }}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${req.isCompleted ? 'bg-emerald-500' : 'bg-white/10'}`}>
                              {req.isCompleted
                                ? <CheckCircle size={11} className="text-white" />
                                : <Clock size={11} className="text-white/30" />}
                            </div>
                            <div className="min-w-0">
                              <span className={`font-semibold text-xs truncate block ${req.isCompleted ? 'text-white' : 'text-white/60'}`}>{req.name}</span>
                              {req.isCompleted && req.completionDetails && (() => {
                                const rawVal = Object.values(req.completionDetails)[0];
                                const raw = typeof rawVal === 'string' ? rawVal : Array.isArray(rawVal) ? (rawVal as string[]).join(' ') : String(rawVal ?? '');
                                const lines = raw ? raw.split(/\s+(?=\d{4}-\d{2}-\d{2})/) : [];
                                return lines.length > 1
                                  ? <div className="space-y-0.5 mt-0.5">{lines.map((l, i) => <p key={i} className="text-[10px] text-emerald-400 font-medium truncate">{l}</p>)}</div>
                                  : <p className="text-[10px] text-emerald-400 font-medium truncate">{raw}</p>;
                              })()}
                              {!req.isCompleted && req.description && (
                                <p className="text-[10px] text-white/30 truncate">{req.description}</p>
                              )}
                            </div>
                          </div>
                          {req.isCompleted && <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">Done</span>}
                        </div>
                      ))}
                    </div>
                  ) : isFullMember ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <CheckCircle size={22} />
                      </div>
                      <p className="text-sm font-semibold text-emerald-400">Probation completed</p>
                      <p className="text-xs text-white/40">You have been promoted to Full Member.</p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-white/30 text-sm">
                      <AlertTriangle size={24} className="mx-auto mb-2" />
                      Unable to load promotion requirements.
                    </div>
                  )}
                </>
              )}

              {/* ── Leadership / Trainer Pathway Tab ── */}
              {(journeyActiveTab === 'leadership' || journeyActiveTab === 'trainer') && (() => {
                if (!pathwayJourney) return (
                  <div className="flex items-center justify-center py-10">
                    <RefreshCw className="animate-spin text-amber-400" size={24} />
                  </div>
                );
                const data = pathwayJourney[journeyActiveTab];
                const accentColor = journeyActiveTab === 'leadership' ? 'text-amber-400' : 'text-sky-400';
                return (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-white/50">
                          {data.steps.filter(s => s.achieved).length}/{data.steps.length} achieved
                        </span>
                        <span className={`text-xs font-bold ${accentColor}`}>
                          {Math.round(((data.currentIndex + 1) / data.steps.length) * 100)}%
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {data.steps.map((s, i) => (
                          <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${s.achieved ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-white/10'}`} />
                        ))}
                      </div>
                    </div>

                    {data.steps.map((step, i) => {
                      const isCurrent = i === data.currentIndex && step.achieved;
                      const isExpanded = expandedJourneySteps.has(step.title);
                      const allEntries = step.details ?? (step.detail ? [step.detail] : []);
                      const hasMore = allEntries.length > 1;
                      const visibleEntries = allEntries.slice(0, 1);
                      return (
                        <div
                          key={step.title}
                          className={`rounded-xl overflow-hidden ${hasMore ? 'cursor-pointer' : ''}`}
                          style={{ background: step.achieved ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.04)', border: step.achieved ? '1px solid rgba(52,211,153,0.20)' : '1px solid rgba(255,255,255,0.07)' }}
                          onClick={hasMore ? () => setExpandedJourneySteps(prev => { const next = new Set(prev); isExpanded ? next.delete(step.title) : next.add(step.title); return next; }) : undefined}
                        >
                          <div className="flex items-center gap-3 px-3 py-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${step.achieved
                              ? isCurrent ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                              : 'bg-white/10 text-white/25'
                              }`}>
                              {step.achieved ? <CheckCircle size={13} /> : i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm leading-tight ${step.achieved ? 'font-bold text-white' : 'font-medium text-white/35'}`}>{step.title}</p>
                                {isCurrent && (
                                  <span className="text-[9px] font-black uppercase tracking-wide bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded-full flex-shrink-0">Current</span>
                                )}
                              </div>
                              {visibleEntries.length > 0 && (
                                <p className="text-[11px] text-white/30 truncate mt-0.5">{visibleEntries[0]}</p>
                              )}
                            </div>
                            {hasMore && (
                              <span className="flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-white/10 text-white/40 border-white/15">
                                {isExpanded ? '−' : `+${allEntries.length}`}
                              </span>
                            )}
                          </div>
                          {isExpanded && allEntries.length > 0 && (
                            <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-white/6 mt-0">
                              {allEntries.map((e, ei) => (
                                <div key={ei} className="flex items-center gap-2 pl-9">
                                  <div className="w-1 h-1 rounded-full bg-emerald-400/50 flex-shrink-0" />
                                  <p className="text-[11px] text-white/50 truncate">{e}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                );
              })()}

              {/* ── 1st / 2nd Year Engagement Tab ── */}
              {(journeyActiveTab === 'firstYear' || journeyActiveTab === 'secondYear') && (() => {
                const summary = journeyActiveTab === 'firstYear' ? engagementFirst : engagementSecond;
                const accentPct = journeyActiveTab === 'firstYear' ? 'text-sky-400' : 'text-violet-400';
                const accentDot = journeyActiveTab === 'firstYear' ? 'from-sky-400 to-sky-600' : 'from-violet-400 to-violet-600';

                if (engagementLoading) return (
                  <div className="flex items-center justify-center py-10">
                    <RefreshCw className={`animate-spin ${journeyActiveTab === 'firstYear' ? 'text-sky-400' : 'text-violet-400'}`} size={24} />
                  </div>
                );
                if (!summary) return (
                  <div className="text-center py-8 text-white/30 text-sm">
                    <AlertTriangle size={24} className="mx-auto mb-2" />
                    Unable to load engagement progress.
                  </div>
                );

                const groupReqs = summary.requirements.filter(r => r.group === journeyGroupTab);

                return (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-white/50">{summary.completedCount}/{summary.totalCount} completed</span>
                        <span className={`text-xs font-bold ${accentPct}`}>{summary.overallProgress.toFixed(0)}%</span>
                      </div>
                      <div className="flex gap-1">
                        {summary.requirements.map((req, i) => {
                          const isPending = !!req.progress.pendingVerification;
                          return (
                            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${req.isCompleted ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : isPending ? 'bg-amber-400' : summary.isCompleted ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : `bg-gradient-to-r ${accentDot} opacity-20`}`} />
                          );
                        })}
                      </div>
                    </div>

                    {/* Group tabs */}
                    <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      {(['Leadership Experience', 'Skills Development', 'JCI Experience'] as const).map(g => {
                        const gReqs = summary.requirements.filter(r => r.group === g);
                        if (gReqs.length === 0) return null;
                        const doneCount = gReqs.filter(r => r.isCompleted).length;
                        const isActive = journeyGroupTab === g;
                        const label = g === 'Leadership Experience' ? 'Lead' : g === 'Skills Development' ? 'Skills' : 'JCI';
                        return (
                          <button
                            key={g}
                            onClick={() => setJourneyGroupTab(g)}
                            className={`flex-1 py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${isActive ? 'bg-white/15 text-white' : 'text-white/35 hover:text-white/60'}`}
                          >
                            <span>{label}</span>
                            <span className={`text-[9px] font-black ${doneCount === gReqs.length ? 'text-emerald-400' : isActive ? accentPct : 'text-white/25'}`}>
                              {doneCount}/{gReqs.length}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      {groupReqs.map(req => {
                        const isPending = !!req.progress.pendingVerification;
                        return (
                          <div key={req.key} className="px-3 py-2.5 rounded-xl" style={{ background: req.isCompleted ? 'rgba(52,211,153,0.08)' : isPending ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)', border: req.isCompleted ? '1px solid rgba(52,211,153,0.20)' : isPending ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.07)' }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${req.isCompleted ? 'bg-emerald-500' : isPending ? 'bg-amber-400' : 'bg-white/10'}`}>
                                  {req.isCompleted
                                    ? <CheckCircle size={11} className="text-white" />
                                    : <Clock size={11} className={isPending ? 'text-white' : 'text-white/30'} />}
                                </div>
                                <span className={`font-semibold text-xs truncate ${req.isCompleted || isPending ? 'text-white' : 'text-white/50'}`}>{req.title}</span>
                              </div>
                              <div className="flex-shrink-0">
                                {req.isCompleted && !isPending && <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">Done</span>}
                                {isPending && <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">Pending</span>}
                              </div>
                            </div>
                            {(isPending || req.isCompleted) && (req.progress.detail || req.progress.date) ? (
                              <div className="mt-1 pl-7 flex items-center gap-2 text-[11px]">
                                {req.progress.detail && <span className={isPending ? 'text-amber-300 font-medium' : 'text-emerald-400 font-medium'}>{req.progress.detail}</span>}
                                {req.progress.date && <span className="text-white/30">{req.progress.date}</span>}
                              </div>
                            ) : !req.isCompleted ? (
                              <p className="text-[11px] text-white/25 mt-0.5 pl-7 line-clamp-1">{req.description}</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {/* Event Detail Modal */}
      {selectedEventForDetail && (
        <EventDetailModal
          event={events.find(e => e.id === selectedEventForDetail.id) || selectedEventForDetail}
          onClose={() => setSelectedEventForDetail(null)}
          onRegister={(formData) => {
            if (member) registerForEvent(selectedEventForDetail.id!, member.id, formData);
          }}
          onCheckIn={() => {
            if (member) markAttendance(selectedEventForDetail.id!, member.id);
          }}
          onCancelRegistration={async (memberId, cancelledBy, cancelledByName, cancelledByRole) => {
            await cancelRegistration(selectedEventForDetail.id!, memberId, cancelledBy, cancelledByName, cancelledByRole);
          }}
          member={member}
          members={members}
        />
      )}

      {/* Partnership Detail Modal */}
      {selectedAdForDetail && (
        <PartnershipDetailModal
          ad={selectedAdForDetail}
          ads={homepageAds}
          onClose={() => setSelectedAdForDetail(null)}
          onNavigate={(ad) => setSelectedAdForDetail(ad)}
        />
      )}

      {/* Birthday Drawer */}
      <Modal
        isOpen={showBirthdayDrawer}
        onClose={() => setShowBirthdayDrawer(false)}
        title={
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">🎂</span>
            <span className="font-bold text-white">Birthdays This Month</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-200/80 bg-white/15 px-2 py-0.5 rounded-full border border-white/20">
              {now.toLocaleString('default', { month: 'long' })}
            </span>
          </div>
        }
        headerStyle={{
          backgroundImage: 'linear-gradient(135deg, rgba(190,18,60,0.82) 0%, rgba(134,25,143,0.78) 50%, rgba(79,70,229,0.75) 100%), url(/background/birthday-background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        size="md"
        drawerOnMobile={true}
        bottomSheet={true}
        dragHandleInHeader
        className="!bg-slate-900"
        scrollInBody={false}
      >
        {(() => {
          const membershipBadge = (type: string) => {
            const t = (type || '').toLowerCase();
            if (t.includes('probation')) return { label: 'Probation', cls: 'bg-amber-400/20 text-amber-300 border-amber-400/30' };
            if (t.includes('associate')) return { label: 'Associate', cls: 'bg-sky-400/20 text-sky-300 border-sky-400/30' };
            if (t.includes('full') || t.includes('voting') || t.includes('member')) return { label: 'Member', cls: 'bg-violet-400/20 text-violet-300 border-violet-400/30' };
            return { label: type || 'Member', cls: 'bg-white/10 text-white/50 border-white/15' };
          };
          return (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar -mx-4 px-4 md:-mx-6 md:px-6 pb-2">
              {birthdayMembers.map(m => {
                const dob = new Date(getDob(m)!);
                const day = dob.getDate();
                const isToday = day === currentDay;
                const name = m.general?.name || m.name || '';
                const avatarUrl = m.general?.avatarUrl || m.avatar;
                const initials = name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
                let hash = 0; for (let j = 0; j < name.length; j++) hash = name.charCodeAt(j) + ((hash << 5) - hash);
                const gradients = ['from-pink-400 to-rose-500', 'from-violet-400 to-purple-500', 'from-sky-400 to-blue-500', 'from-teal-400 to-emerald-500', 'from-amber-400 to-orange-500'];
                const avatarGradient = gradients[Math.abs(hash) % gradients.length];
                const badge = membershipBadge(m.membershipType || '');
                const duesPaid = m.isDuesPaidCurrentYear ?? (m.duesStatus === 'paid');
                const duesLabel = duesPaid ? 'Dues Paid' : 'Dues Pending';
                const duesCls = duesPaid
                  ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30'
                  : 'bg-red-400/15 text-red-300 border-red-400/30';

                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all"
                    style={{
                      background: isToday
                        ? 'linear-gradient(135deg, rgba(190,18,60,0.25) 0%, rgba(134,25,143,0.20) 100%)'
                        : 'rgba(255,255,255,0.06)',
                      border: isToday ? '1px solid rgba(251,113,133,0.35)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={name}
                          className={`w-11 h-11 rounded-full object-cover shadow-md ${isToday ? 'ring-2 ring-rose-400/70 ring-offset-1 ring-offset-slate-900' : 'ring-1 ring-white/20'}`}
                        />
                      ) : (
                        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-sm font-bold text-white shadow-md ${isToday ? 'ring-2 ring-rose-400/70 ring-offset-1 ring-offset-slate-900' : 'ring-1 ring-white/20'}`}>
                          {initials}
                        </div>
                      )}
                      {/* WhatsApp group status */}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center shadow-md"
                        style={m.whatsappGroup || m.whatsappgroup
                          ? { background: '#25d366', border: '1.5px solid rgba(255,255,255,0.25)' }
                          : { background: '#475569', border: '1.5px solid rgba(255,255,255,0.10)' }}
                        title={m.whatsappGroup || m.whatsappgroup ? 'In WhatsApp group' : 'Not in WhatsApp group'}
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className={`w-2.5 h-2.5 ${m.whatsappGroup || m.whatsappgroup ? 'text-slate-900' : 'text-white'}`}>
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.85L.057 23.25a.75.75 0 0 0 .918.919l5.4-1.47A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.88 0-3.638-.502-5.153-1.378l-.37-.213-3.833 1.043 1.044-3.832-.214-.372A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                        </svg>
                      </span>
                      {isToday && (
                        <span className="absolute -top-0.5 -left-0.5 text-xs leading-none">🎉</span>
                      )}
                    </div>

                    {/* Name + badges */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white text-sm leading-snug truncate">{name}</h4>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${duesCls}`}>
                          {duesLabel}
                        </span>
                      </div>
                    </div>

                    {/* Date / today */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                      {isToday ? (
                        <>
                          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full text-white shadow-sm" style={{ background: 'rgba(225,29,72,0.7)', border: '1px solid rgba(251,113,133,0.5)' }}>
                            Today 🎂
                          </span>
                          <button
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white/80 border border-white/20 hover:bg-white/15 transition-colors"
                            style={{ background: 'rgba(255,255,255,0.10)' }}
                            onClick={() => {
                              navigator.clipboard.writeText(`Happy Birthday ${name}! 🎂 Wishing you a wonderful day!`);
                              showToast(`Copied wishes to clipboard!`, 'success');
                            }}
                          >
                            Copy Wishes
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center px-2.5 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}>
                          <span className="text-[9px] font-black uppercase tracking-wider text-white/40 leading-none">{dob.toLocaleString('default', { month: 'short' })}</span>
                          <span className="text-base font-extrabold text-white leading-tight">{day}</span>
                        </div>
                      )}
                </div>
              </div>
            );
          })}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

