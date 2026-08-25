// Member Dashboard Home Component
import React from 'react';
import { Skeleton } from '../ui/Common';
import { useAuth } from '../../hooks/useAuth';
import { useEvents } from '../../hooks/useEvents';
import { useProjects } from '../../hooks/useProjects';
import { useMembers } from '../../hooks/useMembers';
import { useBehavioralNudging } from '../../hooks/useBehavioralNudging';
import { NudgeBanner } from '../ui/NudgeBanner';
import { AIPredictionService, PersonalizedRecommendation } from '../../services/aiPredictionService';
import { EventRegistrationService } from '../../services/eventRegistrationService';
import { ContractService, CommitmentContract } from '../../services/contractService';
import { PromotionService, type MemberEngagementProgressSummary } from '../../services/promotionService';
import { MembersService } from '../../services/membersService';
import { MemberJourneyService, MemberJourney } from '../../services/memberJourneyService';
import { AdvertisementService, Advertisement } from '../../services/advertisementService';
import type { Event } from '../../types';
import { UserRole } from '../../types';
import { EventDetailModal } from '../modules/EventsView';
import { PartnershipDetailModal } from './PartnershipDetailModal';
import { useState, useEffect, useRef } from 'react';
import { DashboardActiveCommitments } from './DashboardActiveCommitments';
import { DashboardBirthdayBanner } from './DashboardBirthdayBanner';
import { DashboardBirthdayDrawer } from './DashboardBirthdayDrawer';
import { DashboardEventsPanel } from './DashboardEventsPanel';
import { DashboardMembershipJourneyCard } from './DashboardMembershipJourneyCard';
import { DashboardMembershipJourneyModal } from './DashboardMembershipJourneyModal';
import { DashboardPartnersCarousel } from './DashboardPartnersCarousel';
import { DashboardProfileCompletionSheet } from './DashboardProfileCompletionSheet';
import { DashboardProfileCompletionWidget } from './DashboardProfileCompletionWidget';
import { DashboardUpgradeModal } from './DashboardUpgradeModal';
import { getMemberDob, getProfileCompleteness, normalizeMembership } from './dashboardHomeUtils';

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

  const { member } = useAuth();
  const { events, loading: eventsLoading, registerForEvent, markAttendance, cancelRegistration } = useEvents();
  const { projects, loading: projectsLoading } = useProjects();
  const { members, loading: membersLoading } = useMembers();
  const { nudges, dismissNudge } = useBehavioralNudging();
  const [recommendations, setRecommendations] = useState<PersonalizedRecommendation[]>([]);
  const [topRecommendation, setTopRecommendation] = useState<PersonalizedRecommendation | null>(null);
  const [myRegistrationEventIds, setMyRegistrationEventIds] = useState<string[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const eventTab: 'upcoming' | 'past' = 'upcoming';
  const [contracts, setContracts] = useState<CommitmentContract[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [homepageAds, setHomepageAds] = useState<Advertisement[]>([]);
  const [adsLoading, setAdsLoading] = useState(true);
  // Promotion Progress state (for Probation members)
  const [promotionProgress, setPromotionProgress] = useState<any>(null);
  const [promoLoading, setPromoLoading] = useState(false);
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
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Record<string, string>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileTab, setProfileTab] = useState('basic');


  const profileCompleteness = React.useMemo(() => getProfileCompleteness(member), [member]);

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
    const joinDateStr = typeof member.jciCareer?.joinDate === 'string' ? member.jciCareer?.joinDate : '';
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
      try {
        const recs = await AIPredictionService.getPersonalizedRecommendations(member.id, 5);
        setRecommendations(recs);
        if (recs.length > 0) {
          setTopRecommendation(recs[0]);
        }
      } catch (err) {
        console.error('Failed to load recommendations:', err);
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


  // Birthday calculation — all comparisons use MYT midnight to avoid UTC-offset misfires
  const mytTodayStr = React.useMemo(() => {
    const myt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    const m = String(myt.getMonth() + 1).padStart(2, '0');
    const d = String(myt.getDate()).padStart(2, '0');
    return `${m}-${d}`; // "MM-DD"
  }, []);
  const currentMonth = parseInt(mytTodayStr.slice(0, 2), 10) - 1; // 0-indexed for compat
  const currentDay = parseInt(mytTodayStr.slice(3), 10);
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
  const birthdayMembers = React.useMemo(() => {
    return members
      .filter(m => {
        const dob = getMemberDob(m);
        if (!dob) return false;
        // Compare only MM portion of the stored "YYYY-MM-DD" string
        const dobMonth = parseInt(dob.slice(5, 7), 10) - 1; // 0-indexed
        return dobMonth === currentMonth;
      })
      .sort((a, b) => {
        const dayA = parseInt((getMemberDob(a) || '').slice(8, 10), 10);
        const dayB = parseInt((getMemberDob(b) || '').slice(8, 10), 10);
        // Passed birthdays sink to the bottom; upcoming/today stay on top (both ascending)
        const passedA = dayA < currentDay ? 1 : 0;
        const passedB = dayB < currentDay ? 1 : 0;
        if (passedA !== passedB) return passedA - passedB;
        return dayA - dayB;
      });
  }, [members, currentMonth, currentDay]);

  const todayBirthdays = React.useMemo(() => {
    return birthdayMembers.filter(m => {
      const dob = getMemberDob(m);
      if (!dob) return false;
      // Compare "MM-DD" slices directly — no Date parsing needed
      return dob.slice(5, 10) === mytTodayStr;
    });
  }, [birthdayMembers, mytTodayStr]);

  const nextBirthdayMember = React.useMemo(() => {
    const nextBirthdays = birthdayMembers.filter(m => {
      const dob = getMemberDob(m);
      if (!dob) return false;
      return parseInt(dob.slice(8, 10), 10) > currentDay;
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
  const joinDateStr = typeof member.jciCareer?.joinDate === 'string' ? member.jciCareer?.joinDate : '';
  const joinYear = joinDateStr ? new Date(joinDateStr).getFullYear() : null;
  const yearsInMembership = joinYear ? new Date().getFullYear() - joinYear : 0;
  // 1st/2nd-year engagement only applies to members who joined in 2025 or later
  const isVeteranMember = isFullMember && joinYear !== null && joinYear < 2025;
  const showEngagementSteps = joinYear === null || joinYear >= 2025;
  // Membership status: Probation Member / Voting Member (Pending dues) / Voting Member
  const currentYearDuesStatus = member.jciCareer?.membershipDuesHistory?.[String(new Date().getFullYear())]?.status;
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
    ? (promotionProgress?.requirements?.find((r: any) => !r.isCompleted)?.title ?? promotionProgress?.requirements?.find((r: any) => !r.isCompleted)?.name ?? null)
    : (activeEngSummary?.requirements?.find(r => !r.isCompleted && !r.progress?.pendingVerification)?.title ?? null);

  return (
    <div className="space-y-4">

      <DashboardBirthdayBanner
        birthdayMembers={birthdayMembers}
        todayBirthdays={todayBirthdays}
        nextBirthdayMember={nextBirthdayMember}
        now={now}
        onOpen={() => setShowBirthdayDrawer(true)}
      />

      <DashboardPartnersCarousel
        adsLoading={adsLoading}
        homepageAds={homepageAds}
        member={member}
        onSelectAd={setSelectedAdForDetail}
      />


      <DashboardProfileCompletionWidget
        profileCompleteness={profileCompleteness}
        onOpen={() => { setProfileDraft({}); setShowProfileDrawer(true); }}
      />

      <DashboardMembershipJourneyCard
        show={showJourneyCard}
        isProbationMember={isProbationMember}
        isFullMember={isFullMember}
        isVeteranMember={isVeteranMember}
        joinYear={joinYear}
        yearsInMembership={yearsInMembership}
        showEngagementSteps={showEngagementSteps}
        engagementFirst={engagementFirst}
        engagementSecond={engagementSecond}
        pathwayJourney={pathwayJourney}
        membershipStatusLabel={membershipStatusLabel}
        nextStepHint={nextStepHint}
        journeyIsComplete={journeyIsComplete}
        journeyProgress={journeyProgress}
        journeyLabel={journeyLabel}
        promoLoading={promoLoading}
        onOpen={openJourneyModal}
        onRestricted={() => setShowUpgradeModal(true)}
      />

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        <DashboardEventsPanel
          eventsLoading={eventsLoading}
          eventTab={eventTab}
          upcomingEvents={upcomingEvents}
          events={events}
          member={member}
          onNavigate={onNavigate}
          onSelectEvent={setSelectedEventForDetail}
        />

        {member.role !== UserRole.GUEST && (
          <>
            <DashboardActiveCommitments contracts={contracts} />
          </>
        )}
      </div>

      <DashboardUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />

      <DashboardMembershipJourneyModal
        isOpen={showJourneyModal}
        onClose={() => setShowJourneyModal(false)}
        journeyActiveTab={journeyActiveTab}
        setJourneyActiveTab={setJourneyActiveTab}
        isFullMember={isFullMember}
        isProbationMember={isProbationMember}
        showEngagementSteps={showEngagementSteps}
        promotionProgress={promotionProgress}
        promoLoading={promoLoading}
        pathwayJourney={pathwayJourney}
        engagementFirst={engagementFirst}
        engagementSecond={engagementSecond}
        engagementLoading={engagementLoading}
        expandedJourneySteps={expandedJourneySteps}
        setExpandedJourneySteps={setExpandedJourneySteps}
        journeyGroupTab={journeyGroupTab}
        setJourneyGroupTab={setJourneyGroupTab}
      />
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

      <DashboardBirthdayDrawer
        isOpen={showBirthdayDrawer}
        onClose={() => setShowBirthdayDrawer(false)}
        birthdayMembers={birthdayMembers}
        now={now}
        currentDay={currentDay}
      />

      <DashboardProfileCompletionSheet
        isOpen={showProfileDrawer}
        member={member}
        profileCompleteness={profileCompleteness}
        profileDraft={profileDraft}
        setProfileDraft={setProfileDraft}
        profileSaving={profileSaving}
        setProfileSaving={setProfileSaving}
        profileTab={profileTab}
        setProfileTab={setProfileTab}
        onClose={() => setShowProfileDrawer(false)}
      />
    </div>
  );
};

