import React, { useState, useEffect } from 'react';
import {
  TrendingUp, CheckCircle, Clock, Award, AlertCircle,
  Calendar, FileText, User, Users, RefreshCw, Check, X, Save, Edit3, ChevronDown, ChevronUp, Sparkles, Filter
} from 'lucide-react';
import { Card, Button, Badge, ProgressBar, Modal, useToast } from '../../ui/Common';
import { Input } from '../../ui/Form';
import {
  EngagementRequirementStatus,
  EngagementYear,
  MemberEngagementProgressSummary,
  PromotionService
} from '../../../services/promotionService';
import { MembersService } from '../../../services/membersService';
import { EngagementAutoSuggestService } from '../../../services/engagementAutoSuggestService';
import { MembershipTypeDisplay } from '../../shared/MembershipTypeDisplay';
import {
  PromotionProgress,
  PromotionHistory,
  ManualPromotionRequest,
  Member,
  MemberPromotionProgress
} from '../../../types';

// Map requirement type to promotionProgress field key
const REQUIREMENT_FIELD_MAP: Record<string, 'bodMeetingAttended' | 'eventOrganizerParticipation' | 'eventParticipation' | 'jciInspireCompleted'> = {
  'bod_meeting_attendance': 'bodMeetingAttended',
  'event_organizing_committee': 'eventOrganizerParticipation',
  'event_participation': 'eventParticipation',
  'jci_inspire_completion': 'jciInspireCompleted'
};

const REQUIREMENT_PLACEHOLDER: Record<string, string> = {
  'bod_meeting_attendance': 'e.g. 2026-03-15 BOD Meeting #3',
  'event_organizing_committee': 'e.g. Charity Fundraiser 2026 - Logistics',
  'event_participation': 'e.g. Event A, Event B (Min 2 events)',
  'jci_inspire_completion': 'e.g. JCIM Inspire OR NMO'
};

const COURSE_OPTIONS = ['JCIM Inspire', 'JCI KL New Member Orientation'];

const inputClassName = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const formatDatedDetail = (date?: string, detail?: string): string => {
  const cleanDate = date?.trim();
  const cleanDetail = detail?.trim();
  if (cleanDate && cleanDetail) return `${cleanDate} - ${cleanDetail}`;
  return cleanDetail || cleanDate || '';
};

const parseDatedDetail = (value?: string): { date: string; detail: string } => {
  const text = (value || '').trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})\s*[-–]\s*(.*)$/);
  if (match) {
    return { date: match[1], detail: match[2]?.trim() || '' };
  }
  return { date: '', detail: text };
};

const parseCourseCompletion = (value?: string): { date: string; course: string } => {
  const parsed = parseDatedDetail(value);
  const normalizedDetail = parsed.detail.toLowerCase();
  const course = COURSE_OPTIONS.find(option => normalizedDetail.includes(option.toLowerCase())) ||
    (normalizedDetail.includes('nmo') ? 'JCI KL New Member Orientation' : parsed.detail);

  return { date: parsed.date, course };
};

const splitEventParticipation = (value?: string): [{ date: string; detail: string }, { date: string; detail: string }] => {
  const parts = (value || '')
    .split(/[,\n;]+/)
    .map(part => part.trim())
    .filter(Boolean);

  return [
    parseDatedDetail(parts[0]),
    parseDatedDetail(parts.slice(1).join(', '))
  ];
};

const displayValue = (value?: string | null) => value?.trim() || '-';

type TrackingView = 'promotion' | EngagementYear;

const ENGAGEMENT_VIEW_LABELS: Record<EngagementYear, string> = {
  firstYear: '1st Year Member Engagement',
  secondYear: '2nd Year Member Engagement'
};

const getJoinYear = (joinDate?: string): number | null => {
  if (!joinDate) return null;

  const parsed = new Date(joinDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getFullYear();
  }

  const yearMatch = String(joinDate).match(/\b(19|20)\d{2}\b/);
  return yearMatch ? Number(yearMatch[0]) : null;
};

const getEngagementYearFromJoinDate = (
  joinDate?: string,
  referenceYear: number = new Date().getFullYear()
): EngagementYear | null => {
  const joinYear = getJoinYear(joinDate);
  if (joinYear == null) return null;

  const yearsSinceJoin = referenceYear - joinYear;
  if (yearsSinceJoin === 0) return 'firstYear';
  if (yearsSinceJoin === 1) return 'secondYear';
  return null;
};

const MemberSummaryPanel: React.FC<{ member: Member | null }> = ({ member }) => {
  if (!member) return null;
  const displayName = member.fullName || member.name || '?';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
      <div className="w-10 h-10 rounded-xl bg-jci-blue flex items-center justify-center text-white font-bold text-sm shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900 truncate">{displayName}</div>
        <div className="text-xs text-slate-500 truncate">{member.phone || member.idNumber || ''}</div>
      </div>
      <div className="shrink-0">
        <MembershipTypeDisplay
          member={{
            nationality: member.nationality,
            dateOfBirth: member.dateOfBirth,
            senatorCertified: member.senatorCertified,
            senatorshipId: member.senatorshipId,
            role: member.role,
            membershipType: member.membershipType as any,
          }}
          showDetails={false}
        />
      </div>
    </div>
  );
};

export const PromotionTracking: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const [probationMembers, setProbationMembers] = useState<
    Awaited<ReturnType<typeof PromotionService.getProbationMembersForDisplay>>
  >([]);
  const [engagementMembers, setEngagementMembers] = useState<Member[]>([]);
  const [activeView, setActiveView] = useState<TrackingView>('promotion');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberProfile, setSelectedMemberProfile] = useState<
    Awaited<ReturnType<typeof PromotionService.getProbationMembersForDisplay>>[number] | null
  >(null);
  const [selectedMemberRecord, setSelectedMemberRecord] = useState<Member | null>(null);
  const [promotionProgress, setPromotionProgress] = useState<PromotionProgress | null>(null);
  const [engagementProgress, setEngagementProgress] = useState<MemberEngagementProgressSummary | null>(null);
  const [selectedEngagementYear, setSelectedEngagementYear] = useState<EngagementYear>('firstYear');
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showManualPromotionModal, setShowManualPromotionModal] = useState(false);
  const [manualPromotionReason, setManualPromotionReason] = useState('');
  // Editable text inputs for each requirement
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [engagementEditValues, setEngagementEditValues] = useState<Record<string, { detail: string; date: string }>>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savingEngagementKey, setSavingEngagementKey] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [promoAutoSuggesting, setPromoAutoSuggesting] = useState(false);
  const [autoSuggesting, setAutoSuggesting] = useState(false);
  const [approvingKey, setApprovingKey] = useState<string | null>(null);
  const [rejectingKey, setRejectingKey] = useState<string | null>(null);
  const [engagementGroupTab, setEngagementGroupTab] = useState<'Leadership Experience' | 'Skills Development' | 'JCI Experience'>('Leadership Experience');
  const [bulkAutoSuggesting, setBulkAutoSuggesting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [inlineApprovingKey, setInlineApprovingKey] = useState<string | null>(null);
  const [inlineRejectingKey, setInlineRejectingKey] = useState<string | null>(null);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [promotingConfirmId, setPromotingConfirmId] = useState<string | null>(null);
  const [quickPromotingId, setQuickPromotingId] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ statistics: stats, members }, allMembers] = await Promise.all([
        PromotionService.getPromotionTrackingOverview(),
        MembersService.getAllMembers()
      ]);
      setStatistics(stats);
      setProbationMembers(members);
      setEngagementMembers(allMembers);
    } catch (err) {
      showToast('Failed to load promotion data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewProgress = async (
    memberId: string,
    profile?: (typeof probationMembers)[number]
  ) => {
    setLoading(true);
    try {
      const member = await MembersService.getMemberById(memberId);
      const progress = member ? await PromotionService.getPromotionProgressForMember(member) : null;
      setPromotionProgress(progress);
      setSelectedMemberId(memberId);
      setSelectedMemberProfile(profile ?? probationMembers.find((m) => m.id === memberId) ?? null);
      setSelectedMemberRecord(member);

      const pp = member?.promotionProgress || ({} as MemberPromotionProgress);
      const bodMeeting = parseDatedDetail(pp.bodMeetingAttended);
      const organizingCommittee = parseDatedDetail(pp.eventOrganizerParticipation);
      const [eventParticipation1, eventParticipation2] = splitEventParticipation(pp.eventParticipation);
      const courseCompletion = parseCourseCompletion(pp.jciInspireCompleted);
      setEditValues({
        'bod_meeting_attendance': pp.bodMeetingAttended || '',
        'bod_meeting_attendance_detail': bodMeeting.detail,
        'bod_meeting_attendance_date': bodMeeting.date,
        'event_organizing_committee': pp.eventOrganizerParticipation || '',
        'event_organizing_committee_detail': organizingCommittee.detail,
        'event_organizing_committee_date': organizingCommittee.date,
        'event_participation': pp.eventParticipation || '',
        'event_participation_1': eventParticipation1.detail,
        'event_participation_1_date': eventParticipation1.date,
        'event_participation_2': eventParticipation2.detail,
        'event_participation_2_date': eventParticipation2.date,
        'jci_inspire_completion': pp.jciInspireCompleted || '',
        'jci_inspire_completion_course': courseCompletion.course,
        'jci_inspire_completion_date': courseCompletion.date
      });
    } catch (err) {
      showToast('Failed to load promotion progress', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveField = async (reqType: string) => {
    if (!selectedMemberId) return;
    const field = REQUIREMENT_FIELD_MAP[reqType];
    if (!field) return;

    setSavingField(reqType);
    try {
      let value = editValues[reqType] || '';

      if (reqType === 'bod_meeting_attendance' || reqType === 'event_organizing_committee') {
        value = formatDatedDetail(editValues[`${reqType}_date`], editValues[`${reqType}_detail`]);
      }

      if (reqType === 'event_participation') {
        value = [
          formatDatedDetail(editValues.event_participation_1_date, editValues.event_participation_1),
          formatDatedDetail(editValues.event_participation_2_date, editValues.event_participation_2)
        ]
          .filter(Boolean)
          .join(', ');
      }

      if (reqType === 'jci_inspire_completion') {
        value = formatDatedDetail(editValues.jci_inspire_completion_date, editValues.jci_inspire_completion_course);
      }

      await PromotionService.savePromotionProgressField(selectedMemberId, field, value);
      // Refresh progress
      const progress = await PromotionService.getPromotionProgress(selectedMemberId);
      setPromotionProgress(progress);
      showToast('Progress saved', 'success');
    } catch (err) {
      showToast('Failed to save progress', 'error');
    } finally {
      setSavingField(null);
    }
  };

  const handleViewEngagement = async (member: Member, year: EngagementYear) => {
    setSelectedEngagementYear(year);
    setSelectedMemberId(member.id);
    setSelectedMemberRecord(member);
    setEngagementGroupTab('Leadership Experience');

    const progress = PromotionService.buildEngagementProgress(member, year);
    setEngagementProgress(progress);
    setEngagementEditValues(
      progress.requirements.reduce((values, requirement) => {
        values[requirement.key] = {
          detail: requirement.progress.detail || '',
          date: requirement.progress.date || ''
        };
        return values;
      }, {} as Record<string, { detail: string; date: string }>)
    );
  };

  const handleSaveEngagementRequirement = async (requirement: EngagementRequirementStatus) => {
    if (!selectedMemberId || !selectedMemberRecord || !engagementProgress) return;

    const values = engagementEditValues[requirement.key] || { detail: '', date: '' };
    setSavingEngagementKey(requirement.key);

    try {
      await PromotionService.saveEngagementRequirement(
        selectedMemberId,
        selectedEngagementYear,
        requirement.key,
        {
          detail: values.detail,
          date: values.date,
          completed: Boolean(values.detail.trim() && values.date.trim())
        }
      );

      const refreshed = await MembersService.getMemberById(selectedMemberId);
      if (refreshed) {
        setSelectedMemberRecord(refreshed);
        setEngagementMembers(prev => prev.map(member => member.id === refreshed.id ? refreshed : member));
        const progress = PromotionService.buildEngagementProgress(refreshed, selectedEngagementYear);
        setEngagementProgress(progress);
        setEngagementEditValues(
          progress.requirements.reduce((nextValues, req) => {
            nextValues[req.key] = {
              detail: req.progress.detail || '',
              date: req.progress.date || ''
            };
            return nextValues;
          }, {} as Record<string, { detail: string; date: string }>)
        );
      }
      showToast('Engagement progress saved', 'success');
    } catch (err) {
      showToast('Failed to save engagement progress', 'error');
    } finally {
      setSavingEngagementKey(null);
    }
  };

  const handlePromoAutoSuggest = async () => {
    if (!selectedMemberId) return;
    setPromoAutoSuggesting(true);
    try {
      const suggested = await EngagementAutoSuggestService.runProbationAutoSuggest(selectedMemberId);
      let filled = 0;
      setEditValues(prev => {
        const next = { ...prev };
        if (suggested.event_organizing_committee) {
          next.event_organizing_committee_detail = suggested.event_organizing_committee.detail;
          next.event_organizing_committee_date = suggested.event_organizing_committee.date;
          filled++;
        }
        if (suggested.jci_inspire_completion) {
          next.jci_inspire_completion_course = suggested.jci_inspire_completion.course;
          next.jci_inspire_completion_date = suggested.jci_inspire_completion.date;
          filled++;
        }
        if (suggested.event_participation_1) {
          next.event_participation_1 = suggested.event_participation_1.detail;
          next.event_participation_1_date = suggested.event_participation_1.date;
          filled++;
        }
        if (suggested.event_participation_2) {
          next.event_participation_2 = suggested.event_participation_2.detail;
          next.event_participation_2_date = suggested.event_participation_2.date;
          filled++;
        }
        return next;
      });
      showToast(`Auto-suggest: ${filled} field${filled !== 1 ? 's' : ''} pre-filled — review and save`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Auto-suggest failed', 'error');
    } finally {
      setPromoAutoSuggesting(false);
    }
  };

  const handleAutoSuggest = async () => {
    if (!selectedMemberId || !selectedMemberRecord) return;
    setAutoSuggesting(true);
    try {
      const results = await EngagementAutoSuggestService.runAutoSuggest(
        selectedMemberId,
        selectedEngagementYear,
        'bod' // placeholder — replace with actual user ID from auth context
      );
      const suggested = results.filter(r => !r.skipped).length;
      const skipped = results.filter(r => r.skipped).length;
      showToast(`Auto-suggest complete: ${suggested} pending, ${skipped} skipped`, 'success');
      // Refresh engagement progress
      const refreshed = await MembersService.getMemberById(selectedMemberId);
      if (refreshed) {
        setSelectedMemberRecord(refreshed);
        setEngagementMembers(prev => prev.map(m => m.id === refreshed.id ? refreshed : m));
        const progress = PromotionService.buildEngagementProgress(refreshed, selectedEngagementYear);
        setEngagementProgress(progress);
        setEngagementEditValues(
          progress.requirements.reduce((acc, req) => {
            acc[req.key] = { detail: req.progress.detail || '', date: req.progress.date || '' };
            return acc;
          }, {} as Record<string, { detail: string; date: string }>)
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Auto-suggest failed', 'error');
    } finally {
      setAutoSuggesting(false);
    }
  };

  const handleApprove = async (requirementKey: string) => {
    if (!selectedMemberId) return;
    setApprovingKey(requirementKey);
    try {
      await EngagementAutoSuggestService.approveSuggestion(
        selectedMemberId,
        selectedEngagementYear,
        requirementKey,
        'bod'
      );
      showToast('Suggestion approved', 'success');
      const refreshed = await MembersService.getMemberById(selectedMemberId);
      if (refreshed) {
        setSelectedMemberRecord(refreshed);
        setEngagementMembers(prev => prev.map(m => m.id === refreshed.id ? refreshed : m));
        const progress = PromotionService.buildEngagementProgress(refreshed, selectedEngagementYear);
        setEngagementProgress(progress);
        setEngagementEditValues(
          progress.requirements.reduce((acc, req) => {
            acc[req.key] = { detail: req.progress.detail || '', date: req.progress.date || '' };
            return acc;
          }, {} as Record<string, { detail: string; date: string }>)
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Approve failed', 'error');
    } finally {
      setApprovingKey(null);
    }
  };

  const handleReject = async (requirementKey: string) => {
    if (!selectedMemberId) return;
    setRejectingKey(requirementKey);
    try {
      await EngagementAutoSuggestService.rejectSuggestion(
        selectedMemberId,
        selectedEngagementYear,
        requirementKey,
        'bod'
      );
      showToast('Suggestion rejected', 'success');
      const refreshed = await MembersService.getMemberById(selectedMemberId);
      if (refreshed) {
        setSelectedMemberRecord(refreshed);
        setEngagementMembers(prev => prev.map(m => m.id === refreshed.id ? refreshed : m));
        const progress = PromotionService.buildEngagementProgress(refreshed, selectedEngagementYear);
        setEngagementProgress(progress);
        setEngagementEditValues(
          progress.requirements.reduce((acc, req) => {
            acc[req.key] = { detail: req.progress.detail || '', date: req.progress.date || '' };
            return acc;
          }, {} as Record<string, { detail: string; date: string }>)
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Reject failed', 'error');
    } finally {
      setRejectingKey(null);
    }
  };

  const handleInlineApprove = async (memberId: string, year: EngagementYear, requirementKey: string) => {
    const k = `${memberId}_${requirementKey}`;
    setInlineApprovingKey(k);
    try {
      await EngagementAutoSuggestService.approveSuggestion(memberId, year, requirementKey, 'bod');
      showToast('Suggestion approved', 'success');
      const refreshed = await MembersService.getMemberById(memberId);
      if (refreshed) {
        setEngagementMembers(prev => prev.map(m => m.id === refreshed.id ? refreshed : m));
        if (selectedMemberId === memberId) {
          setSelectedMemberRecord(refreshed);
          const progress = PromotionService.buildEngagementProgress(refreshed, year);
          setEngagementProgress(progress);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Approve failed', 'error');
    } finally {
      setInlineApprovingKey(null);
    }
  };

  const handleInlineReject = async (memberId: string, year: EngagementYear, requirementKey: string) => {
    const k = `${memberId}_${requirementKey}`;
    setInlineRejectingKey(k);
    try {
      await EngagementAutoSuggestService.rejectSuggestion(memberId, year, requirementKey, 'bod');
      showToast('Suggestion rejected', 'success');
      const refreshed = await MembersService.getMemberById(memberId);
      if (refreshed) {
        setEngagementMembers(prev => prev.map(m => m.id === refreshed.id ? refreshed : m));
        if (selectedMemberId === memberId) {
          setSelectedMemberRecord(refreshed);
          const progress = PromotionService.buildEngagementProgress(refreshed, year);
          setEngagementProgress(progress);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Reject failed', 'error');
    } finally {
      setInlineRejectingKey(null);
    }
  };

  const handleBulkPromoAutoSuggest = async () => {
    const members = filteredProbationMembers;
    if (!members.length) return;
    setBulkAutoSuggesting(true);
    setBulkProgress({ current: 0, total: members.length });
    let filled = 0;
    for (let i = 0; i < members.length; i++) {
      setBulkProgress({ current: i + 1, total: members.length });
      try {
        const suggested = await EngagementAutoSuggestService.runProbationAutoSuggest(members[i].id);
        if (suggested.event_organizing_committee) {
          const v = formatDatedDetail(suggested.event_organizing_committee.date, suggested.event_organizing_committee.detail);
          if (v) { await PromotionService.savePromotionProgressField(members[i].id, 'eventOrganizerParticipation', v); filled++; }
        }
        if (suggested.jci_inspire_completion) {
          const v = formatDatedDetail(suggested.jci_inspire_completion.date, suggested.jci_inspire_completion.course);
          if (v) { await PromotionService.savePromotionProgressField(members[i].id, 'jciInspireCompleted', v); filled++; }
        }
        if (suggested.event_participation_1 || suggested.event_participation_2) {
          const p1 = suggested.event_participation_1 ? formatDatedDetail(suggested.event_participation_1.date, suggested.event_participation_1.detail) : '';
          const p2 = suggested.event_participation_2 ? formatDatedDetail(suggested.event_participation_2.date, suggested.event_participation_2.detail) : '';
          const v = [p1, p2].filter(Boolean).join(', ');
          if (v) { await PromotionService.savePromotionProgressField(members[i].id, 'eventParticipation', v); filled++; }
        }
      } catch { /* skip member on error */ }
    }
    showToast(`Bulk auto-suggest: ${filled} field(s) filled across ${members.length} members`, 'success');
    setBulkAutoSuggesting(false);
    setBulkProgress(null);
    await loadData();
  };

  const handleBulkEngagementAutoSuggest = async (year: EngagementYear) => {
    const members = filteredEngagementMembers;
    if (!members.length) return;
    setBulkAutoSuggesting(true);
    setBulkProgress({ current: 0, total: members.length });
    let suggested = 0;
    for (let i = 0; i < members.length; i++) {
      setBulkProgress({ current: i + 1, total: members.length });
      try {
        const results = await EngagementAutoSuggestService.runAutoSuggest(members[i].id, year, 'bod');
        suggested += results.filter(r => !r.skipped).length;
      } catch { /* skip member on error */ }
    }
    showToast(`Bulk auto-suggest: ${suggested} pending item(s) created across ${members.length} members`, 'success');
    setBulkAutoSuggesting(false);
    setBulkProgress(null);
    await loadData();
  };

  const handlePromoteMember = async (memberId: string, method: 'automatic' | 'manual' = 'automatic') => {
    try {
      const promotion = await PromotionService.promoteToOfficialMember(
        memberId,
        'current_user_id', // Would come from auth context
        method,
        method === 'manual' ? manualPromotionReason : undefined
      );

      if (promotion) {
        showToast('Member promoted successfully!', 'success');
        setShowManualPromotionModal(false);
        setManualPromotionReason('');
        loadData();
        setPromotionProgress(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to promote member', 'error');
    }
  };

  const handleManualPromotionRequest = async () => {
    if (!selectedMemberId || !manualPromotionReason.trim()) {
      showToast('Please provide a reason for manual promotion', 'warning');
      return;
    }

    try {
      await PromotionService.createManualPromotionRequest(
        selectedMemberId,
        'current_user_id', // Would come from auth context
        manualPromotionReason,
        true // Override requirements
      );

      showToast('Manual promotion request submitted', 'success');
      setShowManualPromotionModal(false);
      setManualPromotionReason('');
      setPromotionProgress(null);
      setSelectedMemberId(null);
      setSelectedMemberProfile(null);
      setSelectedMemberRecord(null);
      setEditValues({});
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit promotion request', 'error');
    }
  };

  const filteredProbationMembers = React.useMemo(() => {
    const term = (searchQuery || '').toLowerCase();
    const filtered = term
      ? probationMembers.filter((m: any) =>
          (m.name ?? '').toLowerCase().includes(term) ||
          (m.email ?? '').toLowerCase().includes(term) ||
          (m.phone ?? '').toLowerCase().includes(term) ||
          (m.fullName ?? '').toLowerCase().includes(term)
        )
      : [...probationMembers];
    const getName = (m: any) => ((m.fullName || m.name) ?? '').toLowerCase();
    const isEligible = (m: any) => {
      const pp = m.promotionProgress ?? m.jciCareer?.promotionProgress;
      return !!(pp?.bodMeetingAttended && pp?.eventOrganizerParticipation && pp?.eventParticipation && pp?.jciInspireCompleted);
    };
    return filtered.sort((a, b) => {
      const aE = isEligible(a) ? 0 : 1;
      const bE = isEligible(b) ? 0 : 1;
      if (aE !== bE) return aE - bE;
      return getName(a).localeCompare(getName(b));
    });
  }, [probationMembers, searchQuery]);

  const filteredEngagementMembers = React.useMemo(() => {
    const term = (searchQuery || '').toLowerCase();
    const yearScopedMembers = engagementMembers.filter((member) => {
      if (activeView === 'promotion') return false;
      return getEngagementYearFromJoinDate(member.joinDate) === activeView;
    });
    const filtered = term
      ? yearScopedMembers.filter((member) =>
          (member.name ?? '').toLowerCase().includes(term) ||
          (member.email ?? '').toLowerCase().includes(term) ||
          (member.phone ?? '').toLowerCase().includes(term) ||
          (member.fullName ?? '').toLowerCase().includes(term) ||
          (member.idNumber ?? '').toLowerCase().includes(term)
        )
      : [...yearScopedMembers];
    const getName = (m: Member) => ((m.fullName || m.name) ?? '').toLowerCase();
    const hasPending = (m: Member) =>
      PromotionService.buildEngagementProgress(m, activeView as EngagementYear)
        .requirements.some(r => r.progress.pendingVerification);
    return filtered.sort((a, b) => {
      const aP = hasPending(a) ? 0 : 1;
      const bP = hasPending(b) ? 0 : 1;
      if (aP !== bP) return aP - bP;
      return getName(a).localeCompare(getName(b));
    });
  }, [engagementMembers, searchQuery, activeView]);

  const pendingCounts = React.useMemo(() => {
    const count = (year: EngagementYear) =>
      engagementMembers
        .filter(m => getEngagementYearFromJoinDate(m.joinDate) === year)
        .filter(m => PromotionService.buildEngagementProgress(m, year).requirements.some(r => r.progress.pendingVerification))
        .length;
    return { firstYear: count('firstYear'), secondYear: count('secondYear') };
  }, [engagementMembers]);

  const displayedEngagementMembers = React.useMemo(() => {
    if (!pendingOnly) return filteredEngagementMembers;
    return filteredEngagementMembers.filter(m => {
      const p = PromotionService.buildEngagementProgress(m, activeView as EngagementYear);
      return p.requirements.some(r => r.progress.pendingVerification);
    });
  }, [filteredEngagementMembers, pendingOnly, activeView]);

  const handleQuickPromote = async (memberId: string) => {
    setPromotingConfirmId(null);
    setQuickPromotingId(memberId);
    try {
      await handlePromoteMember(memberId, 'automatic');
    } finally {
      setQuickPromotingId(null);
    }
  };

  if (loading && !statistics) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-jci-blue" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pill tab switcher */}
      <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
        {([
          { key: 'promotion' as TrackingView, label: 'Probation', short: 'Probation', badge: 0 },
          { key: 'firstYear' as TrackingView, label: '1st Year', short: '1st Yr', badge: pendingCounts.firstYear },
          { key: 'secondYear' as TrackingView, label: '2nd Year', short: '2nd Yr', badge: pendingCounts.secondYear },
        ] as const).map(view => (
          <button
            key={view.key}
            onClick={() => { setActiveView(view.key); setPendingOnly(false); }}
            className={`flex-1 relative py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeView === view.key
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="hidden sm:inline">{view.label}</span>
            <span className="sm:hidden">{view.short}</span>
            {view.badge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-white text-[9px] font-black flex items-center justify-center leading-none">
                {view.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeView === 'promotion' && (
        <>
          {/* Stats + completion rates — collapsible */}
          {statistics && (
            <Card>
              {/* Always-visible: 4 stat chips + expand toggle */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Probation', value: statistics.totalProbationMembers, color: 'text-slate-900' },
                  { label: 'Eligible', value: statistics.eligibleForPromotion, color: 'text-green-600' },
                  { label: 'Promoted', value: statistics.promotedThisYear, color: 'text-purple-600' },
                  { label: 'Avg Days', value: statistics.averageTimeToPromotion, color: 'text-amber-600' },
                ].map(s => (
                  <div key={s.label} className="text-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStatsExpanded(v => !v)}
                className="mt-3 w-full flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
              >
                {statsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {statsExpanded ? 'Hide completion rates' : 'Show completion rates'}
              </button>
              {/* Collapsible completion rates */}
              {statsExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completion Rates</p>
                  {Object.entries(statistics.requirementCompletionRates).map(([type, rate]: [string, any]) => (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-600 w-36 shrink-0 truncate">
                        {type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-jci-blue transition-all duration-500"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 w-9 text-right shrink-0">{rate.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Probation Members List */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-slate-900">Probation Members{filteredProbationMembers.length ? ` · ${filteredProbationMembers.length}` : ''}</span>
              <button
                onClick={handleBulkPromoAutoSuggest}
                disabled={bulkAutoSuggesting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 transition-colors shadow-sm"
              >
                {bulkAutoSuggesting ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} className="text-amber-500" />}
                {bulkAutoSuggesting && bulkProgress ? `${bulkProgress.current}/${bulkProgress.total}…` : 'Auto-Suggest All'}
              </button>
            </div>
            <div className="space-y-2">
              {filteredProbationMembers.map(member => {
                const reqs = [
                  { label: 'BOD', done: !!member.promotionProgress?.bodMeetingAttended },
                  { label: 'Organizer', done: !!member.promotionProgress?.eventOrganizerParticipation },
                  { label: 'Participation', done: !!member.promotionProgress?.eventParticipation },
                  { label: 'Inspire', done: !!member.promotionProgress?.jciInspireCompleted },
                ];
                const doneCount = reqs.filter(r => r.done).length;
                const isEligible = doneCount === 4;
                return (
                  <div
                    key={member.id}
                    className={`rounded-xl border overflow-hidden transition-all ${
                      isEligible ? 'border-green-200 bg-green-50/40' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 ${isEligible ? 'bg-green-500' : 'bg-jci-blue'}`}>
                        {(member.fullName || member.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      {/* Name + join date */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-900 truncate">{member.fullName || member.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {member.membershipType && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{member.membershipType}</span>
                          )}
                          <span className="text-[11px] text-slate-400">Joined {member.joinDate}</span>
                        </div>
                      </div>
                      {/* Eligible badge/promote or req dots */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isEligible ? (
                          promotingConfirmId === member.id ? (
                            <>
                              <span className="text-[10px] font-semibold text-slate-600">Promote?</span>
                              <button
                                onClick={() => handleQuickPromote(member.id)}
                                disabled={quickPromotingId === member.id}
                                className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                {quickPromotingId === member.id ? <RefreshCw size={9} className="animate-spin" /> : <Check size={9} />}
                                Yes
                              </button>
                              <button
                                onClick={() => setPromotingConfirmId(null)}
                                className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                              >
                                <X size={9} /> No
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setPromotingConfirmId(member.id)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 hover:bg-green-200 px-2 py-0.5 rounded-full transition-colors"
                            >
                              <CheckCircle size={10} /> Eligible · Promote →
                            </button>
                          )
                        ) : (
                          <div className="flex gap-1">
                            {reqs.map(req => (
                              <div
                                key={req.label}
                                title={req.label}
                                className={`w-2 h-2 rounded-full ${req.done ? 'bg-green-500' : 'bg-slate-200'}`}
                              />
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => handleViewProgress(member.id, member)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-jci-blue transition-colors"
                          title="Open full view"
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    </div>
                    {/* Inline req pills */}
                    <div className="flex gap-1.5 px-3 pb-3">
                      {reqs.map(req => (
                        <div
                          key={req.label}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            req.done
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          {req.done ? <Check size={9} /> : <Clock size={9} />}
                          {req.label}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredProbationMembers.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400">No probation members found.</div>
              )}
            </div>
          </Card>
        </>
      )}

      {activeView !== 'promotion' && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-slate-900">
              {ENGAGEMENT_VIEW_LABELS[activeView]}
              {displayedEngagementMembers.length ? ` · ${displayedEngagementMembers.length}` : ''}
            </span>
            <div className="flex items-center gap-1.5">
              {/* Pending Only toggle */}
              {(pendingCounts[activeView as EngagementYear] ?? 0) > 0 && (
                <button
                  onClick={() => setPendingOnly(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-xl border transition-colors shadow-sm ${
                    pendingOnly
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <Filter size={11} />
                  <span className="hidden sm:inline">Pending only</span>
                  <span className="sm:hidden">{pendingCounts[activeView as EngagementYear]}</span>
                </button>
              )}
              <button
                onClick={() => handleBulkEngagementAutoSuggest(activeView as EngagementYear)}
                disabled={bulkAutoSuggesting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 transition-colors shadow-sm"
              >
                {bulkAutoSuggesting ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} className="text-amber-500" />}
                {bulkAutoSuggesting && bulkProgress ? `${bulkProgress.current}/${bulkProgress.total}…` : 'Auto-Suggest All'}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {displayedEngagementMembers.map(member => {
              const progress = PromotionService.buildEngagementProgress(member, activeView);
              const groups: Array<{ label: string; key: 'Leadership Experience' | 'Skills Development' | 'JCI Experience'; color: string }> = [
                { label: 'Lead', key: 'Leadership Experience', color: 'text-purple-600' },
                { label: 'Skills', key: 'Skills Development', color: 'text-blue-600' },
                { label: 'JCI', key: 'JCI Experience', color: 'text-indigo-600' },
              ];
              const accentDot = activeView === 'firstYear' ? 'bg-blue-500' : 'bg-indigo-500';
              const pendingReqs = progress.requirements.filter(r => r.progress.pendingVerification);
              return (
                <div
                  key={member.id}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    progress.isCompleted ? 'border-green-200 bg-green-50/40'
                    : pendingReqs.length > 0 ? 'border-amber-200 bg-white'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 p-3">
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 ${progress.isCompleted ? 'bg-green-500' : 'bg-jci-blue'}`}>
                      {(member.fullName || member.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    {/* Name + join date + dots */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-900 truncate">{member.fullName || member.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {member.membershipType && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{member.membershipType}</span>
                        )}
                        <span className="text-[11px] text-slate-400">Joined {member.joinDate}</span>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {progress.requirements.map((req, i) => (
                          <div
                            key={i}
                            title={req.title}
                            className={`w-2 h-2 rounded-full ${
                              req.isCompleted ? 'bg-green-500' : req.progress.pendingVerification ? 'bg-amber-400' : `${accentDot} opacity-20`
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Group breakdown + edit button */}
                    <div className="flex items-center gap-2 shrink-0">
                      {progress.isCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">
                          <CheckCircle size={10} /> Done
                        </span>
                      ) : (
                        <>
                          {/* Mobile: compact done/total */}
                          <span className="sm:hidden text-[11px] font-bold text-slate-500">
                            <span className={progress.completedCount > 0 ? 'text-green-600' : 'text-slate-400'}>{progress.completedCount}</span>
                            <span className="text-slate-300">/{progress.totalCount}</span>
                          </span>
                          {/* Desktop: 3-group breakdown */}
                          <div className="hidden sm:flex gap-2">
                            {groups.map(g => {
                              const gReqs = progress.requirements.filter(r => r.group === g.key);
                              if (!gReqs.length) return null;
                              const done = gReqs.filter(r => r.isCompleted).length;
                              const allDone = done === gReqs.length;
                              return (
                                <div key={g.label} className="flex flex-col items-center">
                                  <span className={`text-[9px] font-black ${allDone ? 'text-green-600' : 'text-slate-400'}`}>{g.label}</span>
                                  <span className={`text-[10px] font-bold ${allDone ? 'text-green-700' : g.color}`}>{done}/{gReqs.length}</span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                      <button
                        onClick={() => handleViewEngagement(member, activeView)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-jci-blue transition-colors"
                        title="Open engagement view"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Inline pending approval panel */}
                  {pendingReqs.length > 0 && (
                    <div className="border-t border-amber-100 bg-amber-50/50 px-3 py-2 space-y-1.5">
                      {pendingReqs.map(req => {
                        const k = `${member.id}_${req.key}`;
                        const approving = inlineApprovingKey === k;
                        const rejecting = inlineRejectingKey === k;
                        const busy = approving || rejecting;
                        return (
                          <div key={req.key} className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-semibold text-amber-800">{req.title}</span>
                              {req.progress.detail && (
                                <span className="ml-1.5 text-[10px] text-amber-700 truncate max-w-[120px] inline-block align-bottom">{req.progress.detail}</span>
                              )}
                              {req.progress.date && (
                                <span className="ml-1 text-[10px] text-amber-500">{req.progress.date}</span>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => handleInlineApprove(member.id, activeView, req.key)}
                                disabled={busy}
                                className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                {approving ? <RefreshCw size={9} className="animate-spin" /> : <Check size={9} />}
                                Approve
                              </button>
                              <button
                                onClick={() => handleInlineReject(member.id, activeView, req.key)}
                                disabled={busy}
                                className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                              >
                                {rejecting ? <RefreshCw size={9} className="animate-spin" /> : <X size={9} />}
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {displayedEngagementMembers.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-400">
                {pendingOnly
                  ? 'No pending items to review.'
                  : `No ${activeView === 'firstYear' ? '1st year' : '2nd year'} members found.`}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Promotion Progress Modal */}
      <Modal
        isOpen={!!promotionProgress}
        onClose={() => {
          setPromotionProgress(null);
          setSelectedMemberId(null);
          setSelectedMemberProfile(null);
          setSelectedMemberRecord(null);
          setEditValues({});
        }}
        title="Promotion Progress"
      >
        {promotionProgress && (
          <div className="space-y-4">
            <MemberSummaryPanel member={selectedMemberRecord} />

            {/* Segmented progress */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-slate-500">
                  {promotionProgress.requirements.filter(r => r.isCompleted).length}/{promotionProgress.requirements.length} completed
                </span>
                <span className="text-xs font-bold text-slate-700">{promotionProgress.overallProgress.toFixed(0)}%</span>
              </div>
              <div className="flex gap-1">
                {promotionProgress.requirements.map(req => (
                  <div
                    key={req.id}
                    className={`h-2 flex-1 rounded-full transition-colors ${req.isCompleted ? 'bg-green-500' : 'bg-slate-200'}`}
                    title={req.name}
                  />
                ))}
              </div>
              {promotionProgress.isEligibleForPromotion && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                  <CheckCircle size={12} /> All requirements met — eligible for promotion
                </div>
              )}
            </div>

            {/* Auto-Suggest row */}
            <div className="flex justify-end">
              <button
                onClick={handlePromoAutoSuggest}
                disabled={promoAutoSuggesting}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 transition-colors shadow-sm"
              >
                {promoAutoSuggesting ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} className="text-amber-500" />}
                <span>{promoAutoSuggesting ? 'Scanning…' : 'Auto-Suggest from Activity'}</span>
              </button>
            </div>

            {/* Requirements */}
            <div className="space-y-3">
              {promotionProgress.requirements.map(req => (
                <div
                  key={req.id}
                  className={`rounded-xl border overflow-hidden ${req.isCompleted ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className={`h-1 w-full ${req.isCompleted ? 'bg-green-500' : 'bg-slate-200'}`} />
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <div className={req.isCompleted ? 'text-green-500' : 'text-slate-300'}>
                          {req.isCompleted ? <CheckCircle size={15} /> : <Clock size={15} />}
                        </div>
                        <span className="font-semibold text-sm text-slate-900">{req.name}</span>
                      </div>
                      {req.isCompleted && <Badge variant="success">Done</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 mb-3 pl-5">{req.description}</p>
                  {/* Inputs — stacked mobile, side-by-side sm+ */}
                  {req.type === 'event_participation' ? (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input type="text" className={`${inputClassName} flex-1`} placeholder="Event 1"
                          value={editValues.event_participation_1 || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, event_participation_1: e.target.value }))} />
                        <Input type="date" className="sm:w-36"
                          value={editValues.event_participation_1_date || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, event_participation_1_date: e.target.value }))} />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input type="text" className={`${inputClassName} flex-1`} placeholder="Event 2"
                          value={editValues.event_participation_2 || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, event_participation_2: e.target.value }))} />
                        <Input type="date" className="sm:w-36"
                          value={editValues.event_participation_2_date || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, event_participation_2_date: e.target.value }))} />
                      </div>
                      <Button size="sm" variant={
                        editValues.event_participation_1?.trim() && editValues.event_participation_1_date?.trim() &&
                        editValues.event_participation_2?.trim() && editValues.event_participation_2_date?.trim()
                          ? 'primary' : 'outline'}
                        onClick={() => handleSaveField(req.type)} disabled={savingField === req.type}>
                        {savingField === req.type ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                      </Button>
                    </div>
                  ) : req.type === 'jci_inspire_completion' ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select className={`${inputClassName} flex-1`}
                        value={editValues.jci_inspire_completion_course || ''}
                        onChange={(e) => setEditValues(prev => ({ ...prev, jci_inspire_completion_course: e.target.value }))}>
                        <option value="">Select course</option>
                        {COURSE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <Input type="date" className="flex-1 sm:w-36 sm:flex-none"
                          value={editValues.jci_inspire_completion_date || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, jci_inspire_completion_date: e.target.value }))} />
                        <Button size="sm" variant={
                          editValues.jci_inspire_completion_course?.trim() && editValues.jci_inspire_completion_date?.trim()
                            ? 'primary' : 'outline'}
                          onClick={() => handleSaveField(req.type)} disabled={savingField === req.type} className="shrink-0">
                          {savingField === req.type ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input type="text" className={`${inputClassName} flex-1`}
                        placeholder={REQUIREMENT_PLACEHOLDER[req.type] || 'Enter details…'}
                        value={editValues[`${req.type}_detail`] || ''}
                        onChange={(e) => setEditValues(prev => ({ ...prev, [`${req.type}_detail`]: e.target.value }))} />
                      <div className="flex gap-2">
                        <Input type="date" className="flex-1 sm:w-36 sm:flex-none"
                          value={editValues[`${req.type}_date`] || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [`${req.type}_date`]: e.target.value }))} />
                        <Button size="sm" variant={
                          editValues[`${req.type}_detail`]?.trim() && editValues[`${req.type}_date`]?.trim()
                            ? 'primary' : 'outline'}
                          onClick={() => handleSaveField(req.type)} disabled={savingField === req.type} className="shrink-0">
                          {savingField === req.type ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        </Button>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {promotionProgress.isEligibleForPromotion ? (
                <Button className="flex-1" onClick={() => handlePromoteMember(promotionProgress.memberId, 'automatic')}>
                  <Award size={16} className="mr-2" />
                  Promote to Full Member
                </Button>
              ) : (
                <Button variant="outline" className="flex-1" onClick={() => setShowManualPromotionModal(true)}>
                  <FileText size={16} className="mr-2" />
                  Request Manual Promotion
                </Button>
              )}
            </div>

            {/* Dues info */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800">
              <AlertCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
              <span>Upon promotion: dues change from <strong>RM350</strong> (Probation) → <strong>RM300</strong> (Full Member).</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Engagement Progress Modal */}
      <Modal
        isOpen={!!engagementProgress}
        onClose={() => {
          setEngagementProgress(null);
          setSelectedMemberId(null);
          setSelectedMemberRecord(null);
          setEngagementEditValues({});
        }}
        title={ENGAGEMENT_VIEW_LABELS[selectedEngagementYear]}
      >
        {engagementProgress && (() => {
          const GROUPS = ['Leadership Experience', 'Skills Development', 'JCI Experience'] as const;
          const pendingTotal = engagementProgress.requirements.filter(r => r.progress.pendingVerification).length;
          return (
            <div className="space-y-4">
              {/* Compact member header + Auto-Suggest */}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <MemberSummaryPanel member={selectedMemberRecord} />
                </div>
              </div>

              {/* Segmented progress + Auto-Suggest in same row */}
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-500">
                      {engagementProgress.completedCount}/{engagementProgress.totalCount} completed
                      {pendingTotal > 0 && <span className="ml-2 text-amber-500">· {pendingTotal} pending</span>}
                    </span>
                    <span className="text-xs font-bold text-slate-700">{engagementProgress.overallProgress.toFixed(0)}%</span>
                  </div>
                  <div className="flex gap-1">
                    {engagementProgress.requirements.map(req => {
                      const isPend = !!req.progress.pendingVerification;
                      const seg = req.isCompleted ? 'bg-green-500' : isPend ? 'bg-amber-400' : 'bg-slate-200';
                      return <div key={req.key} className={`h-2 flex-1 rounded-full transition-colors ${seg}`} title={req.title} />;
                    })}
                  </div>
                </div>
                <button
                  onClick={handleAutoSuggest}
                  disabled={autoSuggesting}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {autoSuggesting ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} className="text-amber-500" />}
                  <span className="hidden sm:inline">{autoSuggesting ? 'Scanning…' : 'Auto-Suggest'}</span>
                </button>
              </div>

              {/* Group tabs */}
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                {GROUPS.map(g => {
                  const reqs = engagementProgress.requirements.filter(r => r.group === g);
                  const done = reqs.filter(r => r.isCompleted).length;
                  const pend = reqs.filter(r => r.progress.pendingVerification).length;
                  const isActive = engagementGroupTab === g;
                  return (
                    <button
                      key={g}
                      onClick={() => setEngagementGroupTab(g)}
                      className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-medium transition-all ${
                        isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span className="hidden sm:inline">{g.split(' ')[0]}</span>
                      <span className="sm:hidden">{g === 'Leadership Experience' ? 'Lead' : g === 'Skills Development' ? 'Skills' : 'JCI'}</span>
                      <span className={`ml-1 text-[10px] ${done === reqs.length ? 'text-green-500' : pend > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                        {done}/{reqs.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Requirement cards for active group */}
              <div className="space-y-3">
                {engagementProgress.requirements.filter(r => r.group === engagementGroupTab).map(requirement => {
                  const values = engagementEditValues[requirement.key] || { detail: '', date: '' };
                  const complete = Boolean(values.detail.trim() && values.date.trim());
                  const isPending = !!requirement.progress.pendingVerification;

                  const cardBorder = requirement.isCompleted
                    ? 'border-green-200 bg-green-50'
                    : isPending
                      ? 'border-amber-200 bg-amber-50/60'
                      : 'border-slate-200 bg-white';
                  const accentBar = requirement.isCompleted
                    ? 'bg-green-500'
                    : isPending ? 'bg-amber-400' : 'bg-slate-200';

                  return (
                    <div key={requirement.key} className={`rounded-xl border overflow-hidden ${cardBorder}`}>
                      {/* Thin accent bar at top */}
                      <div className={`h-1 w-full ${accentBar}`} />

                      <div className="p-3.5">
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <div className={requirement.isCompleted ? 'text-green-500' : isPending ? 'text-amber-400' : 'text-slate-300'}>
                              {requirement.isCompleted ? <CheckCircle size={15} /> : <Clock size={15} />}
                            </div>
                            <span className="font-semibold text-sm text-slate-900">{requirement.title}</span>
                          </div>
                          {requirement.isCompleted && <Badge variant="success">Done</Badge>}
                          {isPending && <Badge variant="warning">Pending BOD</Badge>}
                        </div>

                        <p className="text-xs text-slate-500 mb-3 pl-5">{requirement.description}</p>

                        {/* Pending suggestion preview */}
                        {isPending && requirement.progress.detail && (
                          <div className="mb-3 ml-5 flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-100 border border-amber-200">
                            <div className="text-xs text-amber-800 min-w-0">
                              <span className="font-medium">{requirement.progress.detail}</span>
                              {requirement.progress.date && <span className="ml-1.5 text-amber-600">{requirement.progress.date}</span>}
                              <span className="ml-1.5 text-amber-500 text-[10px]">
                                via {requirement.progress.autoSuggestedFrom === 'committee' ? 'Committee' : 'Activity Log'}
                              </span>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() => handleApprove(requirement.key)}
                                disabled={approvingKey === requirement.key || rejectingKey === requirement.key}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                {approvingKey === requirement.key ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(requirement.key)}
                                disabled={approvingKey === requirement.key || rejectingKey === requirement.key}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                              >
                                {rejectingKey === requirement.key ? <RefreshCw size={11} className="animate-spin" /> : <X size={11} />}
                                Reject
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Input row — stacked on mobile, side-by-side on sm+ */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            className={`${inputClassName} flex-1`}
                            placeholder="Event / activity name"
                            value={values.detail}
                            onChange={(e) => setEngagementEditValues(prev => ({
                              ...prev,
                              [requirement.key]: { ...(prev[requirement.key] || { detail: '', date: '' }), detail: e.target.value }
                            }))}
                          />
                          <div className="flex gap-2">
                            <Input
                              type="date"
                              className="flex-1 sm:w-36 sm:flex-none"
                              value={values.date}
                              onChange={(e) => setEngagementEditValues(prev => ({
                                ...prev,
                                [requirement.key]: { ...(prev[requirement.key] || { detail: '', date: '' }), date: e.target.value }
                              }))}
                            />
                            <Button
                              size="sm"
                              variant={complete ? 'primary' : 'outline'}
                              onClick={() => handleSaveEngagementRequirement(requirement)}
                              disabled={savingEngagementKey === requirement.key}
                              className="shrink-0"
                            >
                              {savingEngagementKey === requirement.key
                                ? <RefreshCw size={14} className="animate-spin" />
                                : <Save size={14} />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Manual Promotion Request Modal */}
      <Modal
        isOpen={showManualPromotionModal}
        onClose={() => {
          setShowManualPromotionModal(false);
          setManualPromotionReason('');
        }}
        title="Manual Promotion Request"
      >
        <div className="space-y-4">
          <MemberSummaryPanel member={selectedMemberRecord} />
          <div className="p-4 bg-amber-50 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="text-amber-600 mt-0.5" size={16} />
              <div className="text-sm text-amber-900">
                <p className="font-medium mb-1">Manual Override</p>
                <p>
                  This member has not completed all requirements. Please provide a reason
                  for manual promotion approval.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Reason for Manual Promotion
            </label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              value={manualPromotionReason}
              onChange={(e) => setManualPromotionReason(e.target.value)}
              placeholder="Explain why this member should be promoted despite not meeting all requirements..."
            />
          </div>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowManualPromotionModal(false);
                setManualPromotionReason('');
              }}
            >
              <X size={16} className="mr-2" />
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleManualPromotionRequest}
              disabled={!manualPromotionReason.trim()}
            >
              <Check size={16} className="mr-2" />
              Submit Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
