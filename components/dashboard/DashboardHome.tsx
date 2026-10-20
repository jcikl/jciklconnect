// Member Dashboard Home Component
import React from 'react';
import { Skeleton } from '../ui/Common';
import { useAuth } from '../../hooks/useAuth';
import { useEvents } from '../../hooks/useEvents';

import { ContractService, CommitmentContract } from '../../services/contractService';
import { PromotionService, type MemberEngagementProgressSummary } from '../../services/promotionService';
import { MembersService } from '../../services/membersService';
import { MemberJourneyService, MemberJourney } from '../../services/memberJourneyService';
import { AdvertisementService, Advertisement } from '../../services/advertisementService';
import type { Event, Member } from '../../types';
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
import { isEventVisibleToExternal, isKlRelevantEvent } from '../../utils/loHosting.mjs';
import { filterKlMembers } from '../../utils/memberScope';
import { isExternalRole } from '../../utils/externalAccess';
import { useChapterBirthdays } from '../../hooks/useChapterBirthdays';

interface DashboardHomeProps {
  userRole: UserRole;
  onNavigate?: (view: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  members: Member[];
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  userRole,
  onNavigate,
  searchQuery,
  onSearchChange,
  scrollRef,
  members,
}) => {

  const { member } = useAuth();
  // External-chapter users only get birthdays / partners / events / profile widgets. KL-only widgets
  // (journey, commitments, promotion, engagement) must not mount or load anything for them.
  const isExternal = isExternalRole(userRole);
  // Only today-and-later events: the dashboard shows upcoming events, and loading every event
  // (3,000+ docs) made the home page take several seconds.
  const { events, loading: eventsLoading, registerForEvent, markAttendance, cancelRegistration } = useEvents({ scope: 'upcoming' });

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
    if (!member || isExternal) return;
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
    if (!member || isExternal || normalizeMembership(member) === 'guest') return;
    let cancelled = false;
    MemberJourneyService.getJourney(member)
      .then(j => { if (!cancelled) setPathwayJourney(j); })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [member?.id]);

  // Load Promotion Progress for Probation and Full members (Journey modal shows it for both)
  useEffect(() => {
    if (!member || isExternal || normalizeMembership(member) === 'guest') return;
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
    if (!member || isExternal || normalizeMembership(member) === 'guest') return;
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

  // Calculate stats from real data
  const upcomingEvents = React.useMemo(
    () => events.filter(e => e.status !== 'Cancelled' && (isExternal ? isEventVisibleToExternal(e as any) : isKlRelevantEvent(e as any))),
    [events, isExternal]
  );



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
  // Externals cannot read member docs: their own chapter's birthdays come from the chapter-birthdays
  // function (day + month only). Shaped like members for the banner / drawer; the year 2000 is a
  // placeholder (leap year, so 29 Feb parses) and is never displayed.
  const { birthdays: chapterBirthdays } = useChapterBirthdays(isExternal ? currentMonth + 1 : null);
  const chapterBirthdayMembers = React.useMemo(
    () => chapterBirthdays.map(b => ({
      id: b.id,
      general: { name: b.displayName, avatarUrl: b.avatarUrl ?? undefined, dob: `2000-${b.mmdd.slice(0, 2)}-${b.mmdd.slice(2)}` },
    }) as unknown as Member),
    [chapterBirthdays]
  );
  const birthdayMembers = React.useMemo(() => {
    return (isExternal ? chapterBirthdayMembers : filterKlMembers(members))
      // privacy.hideBirthday: the member chose not to appear in birthday lists.
      .filter(m => m.privacy?.hideBirthday !== true)
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
  }, [members, isExternal, chapterBirthdayMembers, currentMonth, currentDay]);

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
        show={showJourneyCard && !isExternal}
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
          upcomingEvents={upcomingEvents}
          member={member}
          onNavigate={onNavigate}
          onSelectEvent={setSelectedEventForDetail}
        />

        {member.role !== UserRole.GUEST && !isExternal && (
          <>
            <DashboardActiveCommitments contracts={contracts} />
          </>
        )}
      </div>

      <DashboardUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />

      {!isExternal && <DashboardMembershipJourneyModal
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
      />}
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

