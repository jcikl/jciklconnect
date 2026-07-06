import React, { useState, useEffect } from 'react';
import {
  TrendingUp, CheckCircle, Clock, Award, AlertCircle,
  Calendar, FileText, User, Users, RefreshCw, Check, X, Save, Edit3, ChevronDown
} from 'lucide-react';
import { Card, Button, Badge, ProgressBar, Modal, useToast } from '../../ui/Common';
import {
  EngagementRequirementStatus,
  EngagementYear,
  MemberEngagementProgressSummary,
  PromotionService
} from '../../../services/promotionService';
import { MembersService } from '../../../services/membersService';
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

  const displayName = member.fullName || member.name;

  return (
    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
      <div className="flex items-center gap-2 mb-3">
        <User size={16} className="text-slate-500" />
        <p className="text-sm font-semibold text-slate-900">{displayValue(displayName)}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Birthday</div>
          <div className="text-slate-900">{displayValue(member.dateOfBirth)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">ID Number</div>
          <div className="text-slate-900">{displayValue(member.idNumber)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Contact</div>
          <div className="text-slate-900">{displayValue(member.phone)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Membership Type</div>
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

  const handlePromoteMember = async (memberId: string, method: 'automatic' | 'manual' = 'automatic') => {
    try {
      const promotion = await PromotionService.promoteToFullMember(
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
    if (!term) return probationMembers;
    return probationMembers.filter((m: any) =>
      (m.name ?? '').toLowerCase().includes(term) ||
      (m.email ?? '').toLowerCase().includes(term) ||
      (m.phone ?? '').toLowerCase().includes(term) ||
      (m.fullName ?? '').toLowerCase().includes(term)
    );
  }, [probationMembers, searchQuery]);

  const filteredEngagementMembers = React.useMemo(() => {
    const term = (searchQuery || '').toLowerCase();
    const yearScopedMembers = engagementMembers.filter((member) => {
      if (activeView === 'promotion') return false;
      return getEngagementYearFromJoinDate(member.joinDate) === activeView;
    });

    if (!term) return yearScopedMembers;
    return yearScopedMembers.filter((member) =>
      (member.name ?? '').toLowerCase().includes(term) ||
      (member.email ?? '').toLowerCase().includes(term) ||
      (member.phone ?? '').toLowerCase().includes(term) ||
      (member.fullName ?? '').toLowerCase().includes(term) ||
      (member.idNumber ?? '').toLowerCase().includes(term)
    );
  }, [engagementMembers, searchQuery, activeView]);

  if (loading && !statistics) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-jci-blue" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'promotion' as TrackingView, label: 'Probation Promotion' },
          { key: 'firstYear' as TrackingView, label: '1st Year Engagement' },
          { key: 'secondYear' as TrackingView, label: '2nd Year Engagement' }
        ].map(view => (
          <Button
            key={view.key}
            size="sm"
            variant={activeView === view.key ? 'primary' : 'outline'}
            onClick={() => setActiveView(view.key)}
          >
            {view.label}
          </Button>
        ))}
      </div>

      {activeView === 'promotion' && (
        <>
          {/* Statistics Overview */}
          {statistics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Mobile: Combined Card (Single Row) */}
              <Card className="md:hidden">
                <div className="grid grid-cols-4 divide-x divide-slate-100 -m-4">
                  <div className="p-1 text-center">
                    <div className="text-[9px] text-slate-500 uppercase tracking-tighter mb-1 whitespace-nowrap">Probation</div>
                    <div className="text-sm font-bold text-slate-900">{statistics.totalProbationMembers}</div>
                  </div>
                  <div className="p-1 text-center">
                    <div className="text-[9px] text-slate-500 uppercase tracking-tighter mb-1 whitespace-nowrap">Eligible</div>
                    <div className="text-sm font-bold text-green-600">{statistics.eligibleForPromotion}</div>
                  </div>
                  <div className="p-1 text-center">
                    <div className="text-[9px] text-slate-500 uppercase tracking-tighter mb-1 whitespace-nowrap">Promoted</div>
                    <div className="text-sm font-bold text-purple-600">{statistics.promotedThisYear}</div>
                  </div>
                  <div className="p-1 text-center">
                    <div className="text-[9px] text-slate-500 uppercase tracking-tighter mb-1 whitespace-nowrap">Avg Time</div>
                    <div className="text-sm font-bold text-amber-600">{statistics.averageTimeToPromotion}d</div>
                  </div>
                </div>
              </Card>

              {/* Desktop: Separate Cards */}
              <Card className="hidden md:block">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-500 mb-1">Probation Members</div>
                    <div className="text-2xl font-bold text-slate-900">{statistics.totalProbationMembers}</div>
                  </div>
                  <Users className="text-blue-600" size={32} />
                </div>
              </Card>

              <Card className="hidden md:block">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-500 mb-1">Eligible for Promotion</div>
                    <div className="text-2xl font-bold text-green-600">{statistics.eligibleForPromotion}</div>
                  </div>
                  <CheckCircle className="text-green-600" size={32} />
                </div>
              </Card>

              <Card className="hidden md:block">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-500 mb-1">Promoted This Year</div>
                    <div className="text-2xl font-bold text-purple-600">{statistics.promotedThisYear}</div>
                  </div>
                  <TrendingUp className="text-purple-600" size={32} />
                </div>
              </Card>

              <Card className="hidden md:block">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-500 mb-1">Avg. Time to Promotion</div>
                    <div className="text-2xl font-bold text-amber-600">{statistics.averageTimeToPromotion} days</div>
                  </div>
                  <Clock className="text-amber-600" size={32} />
                </div>
              </Card>
            </div>
          )}

          {/* Requirement Completion Rates */}
          {statistics && (
            <Card title="Requirement Completion Rates">
              <div className="space-y-4">
                {Object.entries(statistics.requirementCompletionRates).map(([type, rate]: [string, any]) => (
                  <div key={type}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{rate.toFixed(1)}%</span>
                    </div>
                    <ProgressBar progress={rate} color="bg-blue-600" />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Probation Members List */}
          <Card title="Probation Members">
            <div className="space-y-3">
              {filteredProbationMembers.map(member => (
                <div key={member.id} className="border border-slate-100 rounded-xl overflow-hidden hover:border-jci-blue/20 transition-all">
                  <div className="flex items-center justify-between p-3 bg-white">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-jci-blue flex items-center justify-center text-white font-semibold text-sm shrink-0">
                        {member.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div>
                        {member.fullName && (
                          <div className="font-medium text-slate-900">{member.fullName}</div>
                        )}
                        <div className={member.fullName ? "text-sm text-slate-600" : "font-medium text-slate-900"}>{member.name}</div>
                        <div className="text-xs text-slate-500">Joined: {member.joinDate}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewProgress(member.id, member)}>
                        Full View
                      </Button>
                      <button
                        onClick={() => setExpandedId(expandedId === member.id ? null : member.id)}
                        className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-jci-blue transition-colors"
                      >
                        <ChevronDown size={16} className={expandedId === member.id ? 'rotate-180 transition-transform' : 'transition-transform'} />
                      </button>
                    </div>
                  </div>
                  {expandedId === member.id && (
                    <div className="px-4 pb-4 pt-2 bg-slate-50/50 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {[
                        { label: 'BOD Meeting', done: !!member.promotionProgress?.bodMeetingAttended },
                        { label: 'Event Organizer', done: !!member.promotionProgress?.eventOrganizerParticipation },
                        { label: 'Event Participation', done: !!member.promotionProgress?.eventParticipation },
                        { label: 'JCI Inspire', done: !!member.promotionProgress?.jciInspireCompleted },
                      ].map(req => (
                        <div key={req.label} className={`flex items-center gap-2 p-2 rounded-lg ${req.done ? 'bg-green-50 border border-green-100' : 'bg-white border border-slate-100'}`}>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${req.done ? 'bg-green-500' : 'bg-slate-200'}`}>
                            {req.done && <Check size={10} className="text-white" />}
                          </div>
                          <span className={`font-semibold ${req.done ? 'text-green-700' : 'text-slate-500'}`}>{req.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {activeView !== 'promotion' && (
        <Card title={ENGAGEMENT_VIEW_LABELS[activeView]}>
          <div className="space-y-3">
            {filteredEngagementMembers.map(member => {
              const progress = PromotionService.buildEngagementProgress(member, activeView);
              return (
                <div
                  key={member.id}
                  className="p-3 bg-white rounded-xl border border-slate-100 hover:border-jci-blue/20 hover:shadow-sm transition-all"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-jci-blue flex items-center justify-center text-white font-semibold text-sm shrink-0">
                        {(member.fullName || member.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        {member.fullName && (
                          <div className="font-medium text-slate-900">{member.fullName}</div>
                        )}
                        <div className={member.fullName ? "text-sm text-slate-600" : "font-medium text-slate-900"}>{member.name}</div>
                        <div className="text-xs text-slate-500">Joined: {member.joinDate || '-'}</div>
                        <div className="mt-1">
                          {progress.isCompleted ? (
                            <Badge variant="success">Completed</Badge>
                          ) : (
                            <Badge variant="neutral">In Progress</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 md:w-72">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-slate-600">
                            {progress.completedCount}/{progress.totalCount} completed
                          </span>
                          <span className="text-xs font-semibold text-slate-900">
                            {progress.overallProgress.toFixed(0)}%
                          </span>
                        </div>
                        <ProgressBar
                          progress={progress.overallProgress}
                          color={progress.isCompleted ? 'bg-green-600' : 'bg-blue-600'}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewEngagement(member, activeView)}
                      >
                        View Engagement
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredEngagementMembers.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-500">
                No {activeView === 'firstYear' ? '1st year' : '2nd year'} members found for engagement tracking.
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
          <div className="space-y-6">
            <MemberSummaryPanel member={selectedMemberRecord} />
            {/* Overall Progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700">Overall Progress</span>
                <span className="text-sm font-semibold text-slate-900">
                  {promotionProgress.overallProgress.toFixed(0)}%
                </span>
              </div>
              <ProgressBar
                progress={promotionProgress.overallProgress}
                color={promotionProgress.isEligibleForPromotion ? 'bg-green-600' : 'bg-blue-600'}
              />
            </div>

            {/* Requirements with editable text inputs */}
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900">Requirements</h4>
              {promotionProgress.requirements.map(req => (
                <div
                  key={req.id}
                  className={`p-4 rounded-lg border-2 ${req.isCompleted
                    ? 'border-green-200 bg-green-50'
                    : 'border-slate-200 bg-white'
                    }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start space-x-3">
                      <div className={`mt-0.5 ${req.isCompleted ? 'text-green-600' : 'text-slate-400'}`}>
                        {req.isCompleted ? <CheckCircle size={20} /> : <Clock size={20} />}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{req.name}</div>
                        <div className="text-sm text-slate-600 mt-1">{req.description}</div>
                      </div>
                    </div>
                    {req.isCompleted && (
                      <Badge variant="success">Complete</Badge>
                    )}
                  </div>
                  {/* Editable text input */}
                  {req.type === 'event_participation' ? (
                    <div className="mt-3 flex items-start gap-2">
                      <div className="space-y-2 flex-1">
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2">
                          <input
                            type="text"
                            className={inputClassName}
                            placeholder="Event 1"
                            value={editValues.event_participation_1 || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, event_participation_1: e.target.value }))}
                          />
                          <input
                            type="date"
                            className={inputClassName}
                            value={editValues.event_participation_1_date || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, event_participation_1_date: e.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2">
                          <input
                            type="text"
                            className={inputClassName}
                            placeholder="Event 2"
                            value={editValues.event_participation_2 || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, event_participation_2: e.target.value }))}
                          />
                          <input
                            type="date"
                            className={inputClassName}
                            value={editValues.event_participation_2_date || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, event_participation_2_date: e.target.value }))}
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={
                          editValues.event_participation_1?.trim() &&
                            editValues.event_participation_1_date?.trim() &&
                            editValues.event_participation_2?.trim() &&
                            editValues.event_participation_2_date?.trim()
                            ? 'primary'
                            : 'outline'
                        }
                        onClick={() => handleSaveField(req.type)}
                        disabled={savingField === req.type}
                      >
                        {savingField === req.type ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Save size={14} />
                        )}
                      </Button>
                    </div>
                  ) : req.type === 'jci_inspire_completion' ? (
                    <div className="mt-3 flex items-start gap-2">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 flex-1">
                        <select
                          className={inputClassName}
                          value={editValues.jci_inspire_completion_course || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, jci_inspire_completion_course: e.target.value }))}
                        >
                          <option value="">Select course</option>
                          {COURSE_OPTIONS.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          className={inputClassName}
                          value={editValues.jci_inspire_completion_date || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, jci_inspire_completion_date: e.target.value }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant={
                          editValues.jci_inspire_completion_course?.trim() &&
                            editValues.jci_inspire_completion_date?.trim()
                            ? 'primary'
                            : 'outline'
                        }
                        onClick={() => handleSaveField(req.type)}
                        disabled={savingField === req.type}
                      >
                        {savingField === req.type ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Save size={14} />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 flex-1">
                        <input
                          type="text"
                          className={inputClassName}
                          placeholder={REQUIREMENT_PLACEHOLDER[req.type] || 'Enter details...'}
                          value={editValues[`${req.type}_detail`] || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [`${req.type}_detail`]: e.target.value }))}
                        />
                        <input
                          type="date"
                          className={inputClassName}
                          value={editValues[`${req.type}_date`] || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [`${req.type}_date`]: e.target.value }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant={
                          editValues[`${req.type}_detail`]?.trim() && editValues[`${req.type}_date`]?.trim()
                            ? 'primary'
                            : 'outline'
                        }
                        onClick={() => handleSaveField(req.type)}
                        disabled={savingField === req.type}
                      >
                        {savingField === req.type ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Save size={14} />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {promotionProgress.isEligibleForPromotion ? (
                <Button
                  className="flex-1"
                  onClick={() => handlePromoteMember(promotionProgress.memberId, 'automatic')}
                >
                  <Award size={16} className="mr-2" />
                  Promote to Full Member
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowManualPromotionModal(true)}
                >
                  <FileText size={16} className="mr-2" />
                  Request Manual Promotion
                </Button>
              )}
            </div>

            {/* Promotion Info */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="text-blue-600 mt-0.5" size={16} />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">Promotion Details</p>
                  <p>Current Dues: RM350 (Probation)</p>
                  <p>New Dues: RM300 (Full Member)</p>
                  <p className="mt-2 text-xs text-blue-700">
                    Upon promotion, the member's dues will be automatically adjusted.
                  </p>
                </div>
              </div>
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
        {engagementProgress && (
          <div className="space-y-6">
            <MemberSummaryPanel member={selectedMemberRecord} />

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700">Overall Progress</span>
                <span className="text-sm font-semibold text-slate-900">
                  {engagementProgress.completedCount}/{engagementProgress.totalCount} ({engagementProgress.overallProgress.toFixed(0)}%)
                </span>
              </div>
              <ProgressBar
                progress={engagementProgress.overallProgress}
                color={engagementProgress.isCompleted ? 'bg-green-600' : 'bg-blue-600'}
              />
            </div>

            {(['Leadership Experience', 'Skills Development', 'JCI Experience'] as const).map(group => {
              const groupRequirements = engagementProgress.requirements.filter(req => req.group === group);
              if (groupRequirements.length === 0) return null;

              return (
                <div key={group} className="space-y-3">
                  <h4 className="font-semibold text-slate-900">{group}</h4>
                  {groupRequirements.map(requirement => {
                    const values = engagementEditValues[requirement.key] || { detail: '', date: '' };
                    const complete = Boolean(values.detail.trim() && values.date.trim());

                    return (
                      <div
                        key={requirement.key}
                        className={`p-4 rounded-lg border-2 ${requirement.isCompleted
                          ? 'border-green-200 bg-green-50'
                          : 'border-slate-200 bg-white'
                          }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start space-x-3">
                            <div className={`mt-0.5 ${requirement.isCompleted ? 'text-green-600' : 'text-slate-400'}`}>
                              {requirement.isCompleted ? <CheckCircle size={20} /> : <Clock size={20} />}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{requirement.title}</div>
                              <div className="text-sm text-slate-600 mt-1">{requirement.description}</div>
                            </div>
                          </div>
                          {requirement.isCompleted && <Badge variant="success">Complete</Badge>}
                        </div>

                        <div className="flex items-start gap-2">
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 flex-1">
                            {requirement.inputType === 'select' ? (
                              <select
                                className={inputClassName}
                                value={values.detail}
                                onChange={(e) => setEngagementEditValues(prev => ({
                                  ...prev,
                                  [requirement.key]: { ...(prev[requirement.key] || { detail: '', date: '' }), detail: e.target.value }
                                }))}
                              >
                                <option value="">Select option</option>
                                {(requirement.options || []).map(option => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                className={inputClassName}
                                placeholder="Enter details"
                                value={values.detail}
                                onChange={(e) => setEngagementEditValues(prev => ({
                                  ...prev,
                                  [requirement.key]: { ...(prev[requirement.key] || { detail: '', date: '' }), detail: e.target.value }
                                }))}
                              />
                            )}
                            <input
                              type="date"
                              className={inputClassName}
                              value={values.date}
                              onChange={(e) => setEngagementEditValues(prev => ({
                                ...prev,
                                [requirement.key]: { ...(prev[requirement.key] || { detail: '', date: '' }), date: e.target.value }
                              }))}
                            />
                          </div>
                          <Button
                            size="sm"
                            variant={complete ? 'primary' : 'outline'}
                            onClick={() => handleSaveEngagementRequirement(requirement)}
                            disabled={savingEngagementKey === requirement.key}
                          >
                            {savingEngagementKey === requirement.key ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <Save size={14} />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
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
