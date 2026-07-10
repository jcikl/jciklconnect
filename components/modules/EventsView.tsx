import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, MapPin, Users, Filter, Plus, Clock, BrainCircuit, List, FileText, Edit, Trash2, Copy, DollarSign, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Search, Eye, Star, StarOff, Share2, ArrowLeft, Tag, Info, ChevronDown, Leaf } from 'lucide-react';
import { Card, Button, Badge, Tabs, Modal, useToast, ProgressBar } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useEvents } from '../../hooks/useEvents';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { EventCalendarView } from './EventCalendarView';
import { Event } from '../../types';
import type { Member } from '../../types';
import { Input, Select, Textarea, Checkbox } from '../ui/Form';
import { MemberSelector } from '../ui/MemberSelector';
import { useMembers } from '../../hooks/useMembers';
import { DEFAULT_LO_ID, COLLECTIONS } from '../../config/constants';
import { EventBudgetService, EventBudget, BudgetItem } from '../../services/eventBudgetService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { EventFeedbackService, EventFeedback, EventFeedbackSummary } from '../../services/eventFeedbackService';
import { EventRegistrationService } from '../../services/eventRegistrationService';
import { EventsService } from '../../services/eventsService';
import { MembersService } from '../../services/membersService';
import type { EventRegistration } from '../../types';
import { formatCurrency } from '../../utils/formatUtils';
import { formatDate } from '../../utils/dateUtils';

type ViewMode = 'list' | 'calendar';

export const EventsView: React.FC<{ searchQuery?: string; initialSelectedEventId?: string | null; onClearSelection?: () => void }> = ({ searchQuery, initialSelectedEventId, onClearSelection }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const { events, loading, error, registerForEvent, markAttendance, updateEvent, cancelRegistration } = useEvents();
  const { member } = useAuth();
  const { showToast } = useToast();
  const loId = (member as { loId?: string })?.loId ?? DEFAULT_LO_ID;
  const { members: memberOptions } = useMembers(loId);

  useEffect(() => {
    if (initialSelectedEventId && events.length > 0) {
      const eventToSelect = events.find(e => e.id === initialSelectedEventId);
      if (eventToSelect) {
        setSelectedEvent(eventToSelect);
        if (onClearSelection) onClearSelection();
      }
    }
  }, [initialSelectedEventId, events, onClearSelection]);

  const filteredEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const term = (searchQuery || '').toLowerCase();

    return events.filter(e => {
      // Filter by search term first
      if (term && !(e.title ?? '').toLowerCase().includes(term)) {
        return false;
      }

      // Use eventStartDate (from project.eventStartDate) for filtering
      const eventDate = e.date ? new Date(e.date) : null;
      if (!eventDate) return false;

      if (activeTab === 'Upcoming') {
        // Upcoming: eventStartDate >= today
        return eventDate >= today;
      } else {
        // Completed: eventStartDate < today
        return eventDate < today;
      }
    });
  }, [events, activeTab, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Event List</h2>
          <p className="text-slate-500">Plan, track, and analyze LO activities.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'list' ? 'primary' : 'outline'}
            onClick={() => setViewMode('list')}
          >
            <List size={16} className="mr-2" /> List View
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'primary' : 'outline'}
            onClick={() => setViewMode('calendar')}
          >
            <Calendar size={16} className="mr-2" /> Calendar View
          </Button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <EventCalendarView
          events={events}
          onEventClick={setSelectedEvent}
          onEventUpdate={updateEvent}
        />
      ) : (
        <div className="space-y-4">
          {/* Mobile: segmented control in white bordered container */}
          <div className="md:hidden p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <Tabs
              variant="button"
              fullWidth
              tabs={['Upcoming', 'Completed']}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>

          {/* Desktop: card with underline tabs + list */}
          <Card noPadding className="hidden md:block overflow-hidden">
            <div className="px-6 pt-4">
              <Tabs
                tabs={['Upcoming', 'Completed']}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>
            <LoadingState
              loading={loading}
              error={error}
              empty={filteredEvents.length === 0}
              emptyMessage="No events found in this category."
            >
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEvents.map(event => (
                  <EventRow
                    key={event.id}
                    event={event}
                    member={member}
                    onRegister={() => member && registerForEvent(event.id, member.id)}
                    onCheckIn={() => member && markAttendance(event.id, member.id)}
                    onClick={() => setSelectedEvent(event)}
                  />
                ))}
              </div>
            </LoadingState>
          </Card>

          {/* Mobile: list without card wrapper */}
          <div className="md:hidden">
            <LoadingState
              loading={loading}
              error={error}
              empty={filteredEvents.length === 0}
              emptyMessage="No events found in this category."
            >
              <div className="grid grid-cols-1 gap-4">
                {filteredEvents.map(event => (
                  <EventRow
                    key={event.id}
                    event={event}
                    member={member}
                    onRegister={() => member && registerForEvent(event.id, member.id)}
                    onCheckIn={() => member && markAttendance(event.id, member.id)}
                    onClick={() => setSelectedEvent(event)}
                  />
                ))}
              </div>
            </LoadingState>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRegister={(formData) => {
            if (member) {
              registerForEvent(selectedEvent.id, member.id, formData);
              setSelectedEvent(null);
            }
          }}
          onCheckIn={() => {
            if (member) {
              markAttendance(selectedEvent.id, member.id);
              setSelectedEvent(null);
            }
          }}
          onCancelRegistration={async (memberId, cancelledBy, cancelledByName, cancelledByRole) => {
            await cancelRegistration(selectedEvent.id, memberId, cancelledBy, cancelledByName, cancelledByRole);
          }}
          member={member}
          members={memberOptions}
        />
      )}
    </div>
  );
};

const EventRow: React.FC<{
  event: Event;
  member?: Member | null;
  onRegister?: () => void;
  onCheckIn?: () => void;
  onClick?: () => void;
}> = ({ event, member, onRegister, onCheckIn, onClick }) => {
  const date = new Date(event.date);
  const isUpcoming = date >= new Date(new Date().setHours(0, 0, 0, 0));
  const isRegistered = member && event.registeredMembers?.includes(member.id);

  return (
    <div
      className="flex flex-col rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer active:scale-[0.99]"
      onClick={onClick}
    >
      {/* Top: Poster */}
      <div className="relative w-full h-44 bg-gradient-to-br from-blue-50 to-slate-100 flex-shrink-0 overflow-hidden">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
            <Calendar size={40} strokeWidth={1.5} />
            <span className="text-xs font-semibold mt-2 text-slate-400">No Poster</span>
          </div>
        )}
        {/* Overlay badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <Badge variant="neutral" className="text-[10px] px-2 py-0.5 bg-white/90 backdrop-blur-sm shadow-sm border-0 text-slate-700">{event.type}</Badge>
          {event.predictedDemand === 'High' && (
            <Badge variant="jci" className="text-[10px] px-2 py-0.5 bg-jci-blue/90 backdrop-blur-sm shadow-sm border-0 text-white"><BrainCircuit size={9} className="mr-1 inline" />Hot</Badge>
          )}
        </div>
        {/* Date pill */}
        <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm rounded-xl px-2.5 py-1.5 shadow-sm text-center min-w-[44px]">
          <p className="text-[9px] font-black text-jci-blue uppercase tracking-widest leading-none">{date.toLocaleString('default', { month: 'short' })}</p>
          <p className="text-lg font-black text-slate-900 leading-tight">{date.getDate()}</p>
        </div>
      </div>

      {/* Bottom: Info */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{event.title}</h3>
        <div className="flex flex-col gap-1 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-slate-400 flex-shrink-0" />
            <span>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin size={11} className="text-slate-400 flex-shrink-0" />
            <span className="truncate">{event.location || 'TBA'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={11} className="text-slate-400 flex-shrink-0" />
            <span>{event.attendees}{event.maxAttendees ? `/${event.maxAttendees}` : ''} registered</span>
          </div>
        </div>
        {isUpcoming && onRegister && (
          <Button
            size="sm"
            variant={isRegistered ? "success" : "primary"}
            disabled={!!isRegistered}
            className="mt-auto w-full"
            onClick={(e) => { e.stopPropagation(); onRegister(); }}
          >
            {isRegistered ? 'Registered' : 'Register'}
          </Button>
        )}
      </div>
    </div>
  );
}

// Event Detail Modal with Budget Management
export interface RegistrationFormData {
  dietary: 'normal' | 'vegetarian' | 'halal';
  emergencyContactName: string;
  emergencyContactPhone: string;
  tshirtSize: string;
}

export interface EventDetailModalProps {
  event: Event;
  onClose: () => void;
  onRegister: (formData: RegistrationFormData) => void;
  onCheckIn: () => void;
  onCancelRegistration?: (memberId: string, cancelledBy: string, cancelledByName: string, cancelledByRole: 'self' | 'admin' | 'board' | 'committee') => Promise<void>;
  member: any;
  members: Member[];
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  onClose,
  onRegister,
  onCheckIn,
  onCancelRegistration,
  member,
  members,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'participants' | 'stats' | 'feedback'>('details');
  const [eventFeedback, setEventFeedback] = useState<EventFeedbackSummary | null>(null);
  const [participations, setParticipations] = useState<EventRegistration[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [updatingRegId, setUpdatingRegId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [participantSubTab, setParticipantSubTab] = useState<'all' | 'board' | 'director' | 'member' | 'guest'>('all');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [myRegistration, setMyRegistration] = useState<EventRegistration | null | undefined>(undefined);
  const [localRegistered, setLocalRegistered] = useState<boolean | null>(null);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [addMemberId, setAddMemberId] = useState('');
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [addForm, setAddForm] = useState<{ dietary: 'normal' | 'vegetarian' | 'halal'; tshirtSize: string }>({ dietary: 'normal', tshirtSize: '' });
  const [showRegForm, setShowRegForm] = useState(false);
  const [regForm, setRegForm] = useState<RegistrationFormData>({
    dietary: (member?.dietaryPreference as 'normal' | 'vegetarian' | 'halal') ?? 'normal',
    emergencyContactName: '',
    emergencyContactPhone: '',
    tshirtSize: '',
  });
  const { isBoard, isAdmin } = usePermissions();
  const { showToast } = useToast();
  const [commDirIds, setCommDirIds] = useState<Set<string>>(new Set());
  const [boardMemberIds, setBoardMemberIds] = useState<Set<string>>(new Set());
  const [boardPositions, setBoardPositions] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    getDocs(query(collection(db, 'boardMembers'), where('isActive', '==', true)))
      .then(snap => {
        const commIds = new Set<string>();
        const bmIds = new Set<string>();
        const posMap = new Map<string, string>();
        snap.docs.forEach(d => {
          const data = d.data();
          if (parseInt(data.term, 10) === currentYear) {
            if (data.memberId) {
              bmIds.add(data.memberId as string);
              if (data.position) posMap.set(data.memberId as string, data.position as string);
            }
            (data.commissionDirectorIds ?? [] as string[]).forEach((id: string) => commIds.add(id));
          }
        });
        setCommDirIds(commIds);
        setBoardMemberIds(bmIds);
        setBoardPositions(posMap);
      }).catch(() => {});
  }, []);

  const currentYear = new Date().getFullYear();
  const getBoardPos = (m: Member) => boardPositions.get(m.id) ?? m.currentBoardPosition ?? m.jciCareer?.currentBoardPosition ?? '';
  const shortPos = (pos: string): string => {
    const p = pos.toLowerCase();
    if (p.includes('immediate past')) return 'IPP';
    if (p.includes('executive vice')) return 'EVP';
    if (p.includes('local organ') || p.includes('lom')) return 'VPLOM';
    if (p.includes('international')) return 'VPIA';
    if (p.includes('individual')) return 'VPI';
    if (p.includes('business')) return 'VPB';
    if (p.includes('community')) return 'VPC';
    if (p.includes('vice president')) return 'VP';
    if (p.includes('president')) return 'Pres';
    if (p.includes('honorary treasurer') || p.includes('treasurer')) return 'HT';
    if (p.includes('secretary general')) return 'SG';
    if (p.includes('secretary')) return 'SG';
    if (p.includes('legal council') || p.includes('legal counsel') || p.includes('glc')) return 'GLC';
    return pos;
  };
  const isBoardMember = (m: Member) => boardMemberIds.has(m.id);
  const isDirector = (m: Member) => commDirIds.has(m.id);

  const nameInitials = (name: string) => {
    const parts = (name ?? '').trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (parts[0] ?? '?').slice(0, 2).toUpperCase();
  };
  const initialsColor = (id: string) => {
    const palette = ['bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700'];
    return palette[(id ?? '').charCodeAt(0) % palette.length];
  };
  const memberAvatar = (m: Member) => m.general?.avatarUrl ?? m.avatarUrl ?? m.avatar ?? undefined;
  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const isCommitteeMember = useMemo(() => {
    if (!member) return false;
    if (isAdmin || isBoard) return true;
    if (event.organizerId === member.id) return true;
    return event.committee?.some(c => c.memberId === member.id) ?? false;
  }, [event.committee, event.organizerId, member, isAdmin, isBoard]);

  const availableTabs = useMemo(() => {
    const tabs = [{ id: 'Event Details', label: 'Details' }];
    if (isCommitteeMember) {
      tabs.push({ id: 'Participants', label: 'Participants' });
      tabs.push({ id: 'Stats', label: 'Stats' });
    }
    tabs.push({ id: 'Feedback', label: 'Feedback' });
    return tabs;
  }, [isCommitteeMember]);

  useEffect(() => {
    if (activeTab === 'feedback') {
      loadEventFeedback();
    } else if (activeTab === 'participants' || activeTab === 'stats') {
      loadParticipations();
    }
  }, [activeTab, event.id]);

  const loadParticipations = async () => {
    setLoadingParticipants(true);
    try {
      const [list, guestSnap] = await Promise.all([
        EventRegistrationService.listByEvent(event.id),
        getDocs(query(collection(db, COLLECTIONS.GUEST_REGISTRATIONS), where('eventId', '==', event.id))),
      ]);
      // Map guestRegistrations docs → EventRegistration shape
      const guestEntries: EventRegistration[] = guestSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: `guest-${d.id}`,
          eventId: event.id,
          memberId: `guest-${d.id}`,
          status: (data.status === 'Cancelled' ? 'cancelled' : 'registered') as any,
          createdAt: data.registeredAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
          memberName: data.name ?? null,
        } as EventRegistration;
      });
      // Supplement with synthetic entries for members registered before EventRegistration docs existed
      const docMemberIds = new Set([...list, ...guestEntries].map((r) => r.memberId));
      const syntheticEntries: EventRegistration[] = (event.registeredMembers ?? [])
        .filter((mid) => !docMemberIds.has(mid))
        .map((mid) => ({
          id: `synthetic-${mid}`,
          eventId: event.id,
          memberId: mid,
          status: 'registered' as const,
          createdAt: event.date ?? new Date().toISOString(),
        }));
      setParticipations([...list, ...guestEntries, ...syntheticEntries]);
    } catch {
      setParticipations([]);
    } finally {
      setLoadingParticipants(false);
    }
  };

  useEffect(() => {
    if (!member) return;
    EventRegistrationService.getByEventAndMember(event.id, member.id)
      .then(setMyRegistration)
      .catch(() => setMyRegistration(null));
    // Pre-fill registration form from member profile
    setRegForm({
      dietary: (member.dietaryPreference as 'normal' | 'vegetarian' | 'halal') ?? 'normal',
      emergencyContactName: member.emergencyContactName ?? member.emergencyContact ?? '',
      emergencyContactPhone: member.emergencyContactPhone ?? '',
      tshirtSize: member.tshirtSize ?? '',
    });
  }, [event.id, member?.id]);

  const handleRegister = () => {
    setShowRegForm(true);
  };

  const handleRegFormSubmit = () => {
    setShowRegForm(false);
    setLocalRegistered(true);
    onRegister(regForm);
  };

  const handleSelfCancel = async () => {
    if (!member || !onCancelRegistration) return;
    setLocalRegistered(false);
    setUpdatingRegId('self');
    try {
      await onCancelRegistration(member.id, member.id, member.name ?? member.id, 'self');
      setMyRegistration((prev) => prev ? { ...prev, status: 'cancelled', cancelledByRole: 'self' } : { id: '', eventId: event.id, memberId: member.id, status: 'cancelled', cancelledByRole: 'self', createdAt: new Date().toISOString() });
      showToast('Registration cancelled', 'success');
    } catch {
      setLocalRegistered(null);
      showToast('Cancellation failed', 'error');
    } finally {
      setUpdatingRegId(null);
    }
  };

  const handleAdminCancel = async (reg: EventRegistration) => {
    if (!member || !onCancelRegistration) return;
    setUpdatingRegId(reg.id);
    const role: 'admin' | 'board' | 'committee' = isAdmin ? 'admin' : isBoard ? 'board' : 'committee';
    try {
      await onCancelRegistration(reg.memberId, member.id, member.name ?? member.id, role);
      setParticipations((prev) =>
        prev.map((r) =>
          r.id === reg.id
            ? { ...r, status: 'cancelled' as const, cancelledByRole: role, cancelledByName: member.name ?? member.id, cancelledAt: new Date().toISOString() }
            : r
        )
      );
      // If the cancelled member is the current user, update the register button immediately
      if (reg.memberId === member.id) {
        setLocalRegistered(false);
        setMyRegistration((prev) => prev ? { ...prev, status: 'cancelled' as const, cancelledByRole: role } : prev);
      }
      showToast('Member registration cancelled', 'success');
    } catch {
      showToast('Cancellation failed', 'error');
    } finally {
      setUpdatingRegId(null);
    }
  };

  const handleAddParticipant = async () => {
    if (!addMemberId) return;
    setAddingParticipant(true);
    try {
      const added = members.find(m => m.id === addMemberId);
      await EventsService.registerForEvent(event.id, addMemberId, {
        memberName: added?.name,
        registeredBy: member?.id,
        registeredByName: member?.name ?? member?.id,
        dietary: addForm.dietary,
        tshirtSize: addForm.tshirtSize || undefined,
      });
      const profileUpdate: Record<string, unknown> = { dietaryPreference: addForm.dietary };
      if (addForm.tshirtSize) profileUpdate.tshirtSize = addForm.tshirtSize;
      MembersService.updateMember(addMemberId, profileUpdate as Parameters<typeof MembersService.updateMember>[1]).catch(() => {});
      await loadParticipations();
      showToast(`${added?.name ?? 'Member'} added`, 'success');
      setAddMemberId('');
      setAddForm({ dietary: 'normal', tshirtSize: '' });
      setShowAddParticipant(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add participant', 'error');
    } finally {
      setAddingParticipant(false);
    }
  };

  const handleMarkPaid = async (reg: EventRegistration) => {
    setUpdatingRegId(reg.id);
    try {
      const now = new Date().toISOString();
      const actorName = member?.name ?? member?.id ?? 'Admin';
      await EventRegistrationService.updateStatus(reg.id, 'paid', { paidAt: now, paidByName: actorName });
      setParticipations((prev) => prev.map((r) => (r.id === reg.id ? { ...r, status: 'paid' as const, paidAt: now, paidByName: actorName } : r)));
      showToast('Marked as paid', 'success');
    } catch {
      showToast('Operation failed', 'error');
    } finally {
      setUpdatingRegId(null);
    }
  };

  const handleUndoPaid = async (reg: EventRegistration) => {
    setUpdatingRegId(reg.id);
    const nextStatus = reg.status === 'checked_in' ? 'checked_in' : 'registered';
    try {
      await EventRegistrationService.updateStatus(reg.id, nextStatus, { paidAt: null, paidByName: null });
      setParticipations((prev) => prev.map((r) => (r.id === reg.id ? { ...r, status: nextStatus as EventRegistration['status'], paidAt: null, paidByName: null } : r)));
      showToast('Payment reverted', 'success');
    } catch {
      showToast('Operation failed', 'error');
    } finally {
      setUpdatingRegId(null);
    }
  };

  const handleMarkCheckedIn = async (reg: EventRegistration) => {
    setUpdatingRegId(reg.id);
    try {
      const now = new Date().toISOString();
      const actorName = member?.name ?? member?.id ?? 'Admin';
      await EventRegistrationService.updateStatus(reg.id, 'checked_in', { checkedInAt: now, checkedInByName: actorName });
      setParticipations((prev) => prev.map((r) => (r.id === reg.id ? { ...r, status: 'checked_in' as const, checkedInAt: now, checkedInByName: actorName } : r)));
      showToast('Marked as checked in', 'success');
    } catch {
      showToast('Operation failed', 'error');
    } finally {
      setUpdatingRegId(null);
    }
  };

  const handleUndoCheckedIn = async (reg: EventRegistration) => {
    setUpdatingRegId(reg.id);
    const prevStatus = reg.paidAt ? 'paid' : 'registered';
    try {
      await EventRegistrationService.updateStatus(reg.id, prevStatus, { checkedInAt: null, checkedInByName: null });
      setParticipations((prev) => prev.map((r) => (r.id === reg.id ? { ...r, status: prevStatus as EventRegistration['status'], checkedInAt: null, checkedInByName: null } : r)));
      showToast('Check-in reverted', 'success');
    } catch {
      showToast('Operation failed', 'error');
    } finally {
      setUpdatingRegId(null);
    }
  };

  const loadEventFeedback = async () => {
    setLoadingFeedback(true);
    try {
      const summary = await EventFeedbackService.getFeedbackSummary(event.id);
      setEventFeedback(summary);
    } catch (err) {
      showToast('Failed to load event feedback', 'error');
    } finally {
      setLoadingFeedback(false);
    }
  };

  const date = new Date(event.date);
  const endDate = event.endDate ? new Date(event.endDate) : null;
  const isMultiDay = endDate && endDate.toDateString() !== date.toDateString();
  const formatDay = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); // "22 Oct 2026"
  const formatWeekday = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' }); // "Thu"
  const eventTime = event.time || (date.getHours() !== 0 || date.getMinutes() !== 0 ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);
  const priceMin = event.priceMin ?? event.price;
  const priceMax = event.priceMax;
  const isRegisteredFromEvent = !!(member && event.registeredMembers?.includes(member.id));
  // localRegistered overrides event data immediately after cancel/re-register, before loadEvents() returns
  const isRegistered = localRegistered !== null ? localRegistered : isRegisteredFromEvent;
  const isSelfCancelled = myRegistration?.status === 'cancelled' && !isRegistered;
  // canSelfCancel: use doc status if available, otherwise fall back to registeredMembers array (pre-Story-8.1 registrations)
  const canSelfCancel = !!isRegistered && myRegistration?.status !== 'checked_in' && !!onCancelRegistration && event.status !== 'Completed';
  const attendancePercent = event.maxAttendees ? Math.round(((event.attendees || 0) / event.maxAttendees) * 100) : 0;

  const registerButton = (
    <div className="flex flex-col gap-2">
      <Button
        className={`w-full rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${canSelfCancel
          ? 'h-14 bg-green-500 text-white hover:bg-red-500 shadow-green-100 flex-col gap-0'
          : isRegistered
            ? 'h-12 bg-green-500 text-white shadow-green-100 cursor-default'
            : 'h-12 bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
          }`}
        disabled={(!!isRegistered && !canSelfCancel) || event.status === 'Completed' || event.status === 'Cancelled'}
        onClick={canSelfCancel ? handleSelfCancel : (!isRegistered ? handleRegister : undefined)}
      >
        {event.status === 'Completed' ? <span>Event Ended</span>
          : event.status === 'Cancelled' ? <span>Cancelled</span>
            : canSelfCancel
              ? <div className="flex flex-col items-center leading-none gap-0.5">
                  <span className="flex items-center gap-1.5"><CheckCircle size={15} className="stroke-[3]" />Registered</span>
                  <span className="text-[10px] font-normal normal-case tracking-normal opacity-80">Tap to cancel</span>
                </div>
              : isRegistered ? <><CheckCircle size={18} className="stroke-[3]" /><span>Registered</span></>
                : <><CheckCircle size={18} className="stroke-[3]" /><span>Register Now</span></>}
      </Button>
    </div>
  );

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={null}
        size="2xl"
        drawerOnMobile
        mobileHeight={isExpanded ? "h-screen" : "h-[85vh] md:h-auto"}
        scrollInBody={true}
        onScroll={(e) => {
          const scrollTop = e.currentTarget.scrollTop;
          if (scrollTop > 10 && !isExpanded) setIsExpanded(true);
          else if (scrollTop <= 0 && isExpanded) setIsExpanded(false);
        }}
        className="premium-event-modal"
        footerClassName="md:hidden flex-none px-5 py-4 bg-white border-t border-slate-100 z-30 pb-safe shadow-[0_-4px_16px_-2px_rgba(0,0,0,0.08)]"
        footer={activeTab === 'details' ? (
          <div className="flex items-center gap-4 w-full">
            <div className="shrink-0 min-w-[80px]">
              {priceMin != null ? (
                <>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block leading-none mb-0.5">From</span>
                  <span className="text-lg font-black text-slate-900 leading-none">
                    RM {priceMin}{priceMax != null && priceMax !== priceMin ? ` – ${priceMax}` : ''}
                  </span>
                </>
              ) : (
                <span className="text-xl font-black text-green-600 leading-none">FREE</span>
              )}
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block leading-none mt-0.5">/ person</span>
            </div>
            <div className="flex-1">{registerButton}</div>
          </div>
        ) : null}
      >
        <div className="-m-4 md:-m-6 relative">
          {/* Hero Image */}
          <div className="relative h-56 md:h-72 w-full overflow-hidden">
            <img
              src={event.imageUrl || "https://images.unsplash.com/photo-1540575861501-7cf05a4b125a?auto=format&fit=crop&q=80"}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all">
                <ArrowLeft size={18} />
              </button>
              <button className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all">
                <Share2 size={18} />
              </button>
            </div>
            {/* Title overlay on hero */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 md:px-6 md:pb-6">
              <Badge variant="jci" className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold mb-1.5">
                {event.type || 'Event'}
              </Badge>
              <h2 className="text-xl md:text-2xl font-black text-white leading-tight drop-shadow-sm">
                {event.title}
              </h2>
            </div>
          </div>

          {/* Content — 2-col on desktop, single col on mobile */}
          <div className="relative bg-white rounded-t-[28px] md:rounded-none -mt-6 md:mt-0 md:grid md:grid-cols-[1fr_300px] md:gap-0">

            {/* Left column: tabs + tab content */}
            <div className="px-5 pt-5 pb-4 md:px-6 md:pt-6 md:pb-8 md:border-r md:border-slate-100">
              {/* Tabs */}
              {availableTabs.length > 1 && (
                <Tabs
                  tabs={availableTabs}
                  activeTab={activeTab === 'details' ? 'Event Details' : activeTab === 'participants' ? 'Participants' : activeTab === 'stats' ? 'Stats' : 'Feedback'}
                  onTabChange={(tab) => {
                    if (tab === 'Event Details') setActiveTab('details');
                    else if (tab === 'Participants') setActiveTab('participants');
                    else if (tab === 'Stats') setActiveTab('stats');
                    else setActiveTab('feedback');
                  }}
                  className="mb-4"
                />
              )}

              {activeTab === 'details' && (
                <div className="space-y-3 animate-fade-in">
                  {/* Info card */}
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden">
                    {/* Date & Time */}
                    <div className="flex items-center gap-3 px-3.5 py-3 bg-white">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <Calendar size={14} className="text-jci-blue" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</p>
                        {isMultiDay ? (
                          <>
                            <p className="text-sm font-semibold text-slate-800">
                              {formatDay(date)} – {formatDay(endDate!)}
                            </p>
                            <p className="text-xs text-slate-500">{formatWeekday(date)} – {formatWeekday(endDate!)}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-slate-800">{formatDay(date)}</p>
                            {eventTime && <p className="text-xs text-slate-500">{formatWeekday(date)} · {eventTime}</p>}
                          </>
                        )}
                      </div>
                    </div>
                    {/* Attendance */}
                    {event.maxAttendees && (
                      <div className="flex items-center gap-3 px-3.5 py-3 bg-white">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                          <Users size={14} className="text-jci-blue" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spots</p>
                          <p className="text-sm font-semibold text-slate-800">{event.attendees || 0} / {event.maxAttendees} registered</p>
                          <div className="mt-1 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div style={{ width: `${Math.min(100, attendancePercent)}%` }} className="h-full bg-jci-blue rounded-full" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* About */}
                  {(event.description || true) && (
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3.5 py-3">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Info size={11} />About
                      </h3>
                      <div className={`text-slate-600 text-sm leading-relaxed whitespace-pre-wrap ${!descExpanded ? 'line-clamp-4' : ''}`}>
                        {event.description || "No description provided for this event. Join us to find out more!"}
                      </div>
                      {event.description && event.description.length > 200 && (
                        <button onClick={() => setDescExpanded(v => !v)} className="mt-1.5 text-xs font-semibold text-jci-blue hover:underline">
                          {descExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'participants' && (
                <div className="animate-fade-in">
                  {/* Sub-tabs */}
                  {(() => {
                    const boardMembers = members.filter(m => isBoardMember(m));
                    const directorMembers = members.filter(m => isDirector(m) && !isBoardMember(m));
                    const boardIds = new Set([...boardMembers, ...directorMembers].map(m => m.id));
                    const activeRegs = participations.filter(r => r.status !== 'cancelled');
                    const boardRegs = activeRegs.filter(r => boardMembers.some(m => m.id === r.memberId));
                    const directorRegs = activeRegs.filter(r => directorMembers.some(m => m.id === r.memberId));
                    const memberRegs = activeRegs.filter(r => { const m = members.find(x => x.id === r.memberId); return m && !boardIds.has(m.id) && (m.role === 'MEMBER' || m.role === 'member'); });
                    const guestRegs = activeRegs.filter(r => { const m = members.find(x => x.id === r.memberId); return !m || m.role === 'GUEST' || m.role === 'guest'; });
                    const subTabs: { key: typeof participantSubTab; label: string; count?: number }[] = [
                      { key: 'all', label: 'All', count: activeRegs.length },
                      { key: 'board', label: 'Board', count: boardRegs.length },
                      { key: 'director', label: 'Comm. Dir.', count: directorRegs.length },
                      { key: 'member', label: 'Member', count: memberRegs.length },
                      { key: 'guest', label: 'Guest', count: guestRegs.length },
                    ];
                    return (
                      <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1 scrollbar-none">
                        {subTabs.map(t => (
                          <button
                            key={t.key}
                            onClick={() => setParticipantSubTab(t.key)}
                            className={`flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${participantSubTab === t.key ? 'bg-jci-blue text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                          >
                            {t.label}
                            {t.count != null && <span className={`text-[10px] font-bold ${participantSubTab === t.key ? 'opacity-80' : 'opacity-60'}`}>({t.count})</span>}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                  {loadingParticipants ? (
                    <div className="flex items-center justify-center py-10">
                      <RefreshCw className="animate-spin text-jci-blue" size={22} />
                    </div>
                  ) : (participantSubTab === 'board' || participantSubTab === 'director') ? (() => {
                    const targetMembers = participantSubTab === 'board'
                      ? members.filter(m => isBoardMember(m))
                      : members.filter(m => isDirector(m) && !isBoardMember(m));
                    if (targetMembers.length === 0) return (
                      <div className="text-center py-10 text-slate-400">
                        <Users size={36} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No {participantSubTab === 'board' ? 'board members' : 'commission directors'} found.</p>
                      </div>
                    );
                    return (
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                        {[...targetMembers].sort((a, b) => {
                          const aReg = participations.find(r => r.memberId === a.id && r.status !== 'cancelled');
                          const bReg = participations.find(r => r.memberId === b.id && r.status !== 'cancelled');
                          const regDiff = (aReg ? 0 : 1) - (bReg ? 0 : 1);
                          if (regDiff !== 0) return regDiff;
                          if (participantSubTab === 'board') {
                            const posRank = (m: Member) => {
                              const p = shortPos(getBoardPos(m));
                              const order: Record<string, number> = { Pres: 1, IPP: 2, EVP: 3, VPI: 4, VPIA: 5, VPB: 6, VPC: 7, VPLOM: 8, HT: 9, SG: 10, GLC: 11 };
                              return order[p] ?? 99;
                            };
                            const posDiff = posRank(a) - posRank(b);
                            if (posDiff !== 0) return posDiff;
                          }
                          return (a.name ?? '').localeCompare(b.name ?? '');
                        }).map(m => {
                          const reg = participations.find(r => r.memberId === m.id && r.status !== 'cancelled');
                          const regStatus = reg?.status;
                          return (
                            <div key={m.id} className="px-3 py-2.5 bg-white">
                              <div className="flex items-start gap-2.5">
                                {memberAvatar(m) ? (
                                  <img src={memberAvatar(m)} alt={m.name ?? ''} className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" />
                                ) : (
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${initialsColor(m.id)}`}>
                                    {nameInitials(m.name ?? '')}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {getBoardPos(m) && (
                                      <span className="shrink-0 inline-flex items-center justify-center text-[8px] font-semibold w-10 h-5 rounded-full bg-jci-blue/10 text-jci-blue">{shortPos(getBoardPos(m))}</span>
                                    )}
                                    <p className="text-sm font-semibold truncate text-slate-900">{m.name}</p>
                                    {(reg?.dietary === 'vegetarian' || (!reg?.dietary && reg?.isVegetarian)) && <Leaf size={11} className="shrink-0 text-emerald-500" />}
                                    {reg?.dietary === 'halal' && <span className="shrink-0 text-[10px]" title="Halal">☪️</span>}
                                    {reg?.tshirtSize && <span className="shrink-0 text-[10px] font-medium text-slate-400">{reg.tshirtSize}</span>}
                                  </div>
                                  <div className="flex items-center justify-between gap-2 mt-1">
                                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                                      {regStatus ? (
                                        <Badge variant={regStatus === 'checked_in' ? 'success' : regStatus === 'paid' ? 'warning' : 'neutral'} className="text-[10px] shrink-0 h-5 !py-0">
                                          {regStatus === 'registered' ? 'Pending Payment' : regStatus === 'paid' ? 'Pending Check-In' : 'Checked In'}
                                        </Badge>
                                      ) : (
                                        <Badge variant="error" className="text-[10px] shrink-0 h-5 !py-0">Not Registered</Badge>
                                      )}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      {reg && (
                                        <Button size="sm" variant={reg.paidAt ? 'outline' : 'secondary'} className="h-5 px-1" title={reg.paidAt ? 'Undo Payment' : 'Mark Paid'} disabled={updatingRegId !== null} onClick={() => reg.paidAt ? handleUndoPaid(reg) : handleMarkPaid(reg)}><DollarSign size={12} /></Button>
                                      )}
                                      {reg && (
                                        <Button size="sm" variant={reg.status === 'checked_in' ? 'outline' : 'secondary'} className="h-5 px-1" title={reg.status === 'checked_in' ? 'Undo Check-In' : 'Check In'} disabled={updatingRegId !== null} onClick={() => reg.status === 'checked_in' ? handleUndoCheckedIn(reg) : handleMarkCheckedIn(reg)}><CheckCircle size={12} /></Button>
                                      )}
                                      {reg && onCancelRegistration && (
                                        <Button size="sm" variant="secondary" className="h-5 px-1 text-red-500 border-red-200 hover:bg-red-50" title="Cancel registration" disabled={updatingRegId !== null} onClick={() => handleAdminCancel(reg)}><Trash2 size={12} /></Button>
                                      )}
                                      {!reg && (
                                        <Button size="sm" variant="outline" className="h-5 px-1" title="Register" onClick={async () => {
                                          try {
                                            await EventsService.registerForEvent(event.id, m.id, { memberName: m.name, registeredBy: member?.id, registeredByName: member?.name ?? member?.id });
                                            const newReg: EventRegistration = { id: `manual-${Date.now()}`, eventId: event.id, memberId: m.id, status: 'registered', createdAt: new Date().toISOString(), loId: null, memberName: m.name, registeredBy: member?.id, registeredByName: member?.name ?? member?.id };
                                            setParticipations(prev => [newReg, ...prev]);
                                            showToast(`${m.name} added`, 'success');
                                          } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error'); }
                                        }}><Plus size={14} /></Button>
                                      )}
                                    </div>
                                  </div>
                                  {reg && (
                                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 flex-wrap">
                                      <span>Reg: {reg.registeredByName ?? 'Self'}</span>
                                      {reg.paidByName && <><span className="opacity-40">|</span><span>Verified: {reg.paidByName}</span></>}
                                      {reg.checkedInByName && <><span className="opacity-40">|</span><span>Check-in by: {reg.checkedInByName}</span></>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })() : (() => {
                    const _boardIds = new Set(members.filter(m => isBoardMember(m) || isDirector(m)).map(m => m.id));
                    const filtered = participations.filter(r => {
                      if (participantSubTab === 'all') return true;
                      const m = members.find(x => x.id === r.memberId);
                      if (participantSubTab === 'member') return m && !_boardIds.has(m.id) && (m.role === 'MEMBER' || m.role === 'member');
                      if (participantSubTab === 'guest') return !m || m.role === 'GUEST' || m.role === 'guest';
                      return true;
                    });
                    const roleOrder = (r: EventRegistration) => {
                      const m = members.find(x => x.id === r.memberId);
                      if (!m) return 4;
                      if (isBoardMember(m) && !isDirector(m)) return 1;
                      if (isDirector(m)) return 2;
                      return 3;
                    };
                    const sorted = [...filtered].sort((a, b) => {
                      const cancelledDiff = (a.status === 'cancelled' ? 1 : 0) - (b.status === 'cancelled' ? 1 : 0);
                      if (cancelledDiff !== 0) return cancelledDiff;
                      const roleDiff = roleOrder(a) - roleOrder(b);
                      if (roleDiff !== 0) return roleDiff;
                      const nameA = members.find(x => x.id === a.memberId)?.name ?? a.memberName ?? '';
                      const nameB = members.find(x => x.id === b.memberId)?.name ?? b.memberName ?? '';
                      return nameA.localeCompare(nameB);
                    });
                    return (
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                      {isCommitteeMember && !showAddParticipant && (
                        <button
                          type="button"
                          onClick={() => setShowAddParticipant(true)}
                          className="w-full flex items-center gap-3 px-3 py-3 text-slate-400 hover:bg-slate-50/50 hover:text-jci-blue transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg border-2 border-dashed border-current flex items-center justify-center shrink-0">
                            <Plus size={14} />
                          </div>
                          <span className="text-sm font-semibold">Add Participant</span>
                        </button>
                      )}
                      {showAddParticipant && (
                        <div className="px-3 py-3 bg-blue-50/40 space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 rounded-lg bg-jci-blue/10 flex items-center justify-center shrink-0">
                              <Plus size={14} className="text-jci-blue" />
                            </div>
                            <span className="text-sm font-semibold text-slate-700">Add Participant</span>
                          </div>
                          <MemberSelector
                            members={members.filter(m =>
                              !participations.some(r => r.memberId === m.id && r.status !== 'cancelled') &&
                              !isBoardMember(m) &&
                              !isDirector(m)
                            )}
                            value={addMemberId}
                            onChange={(id) => {
                              setAddMemberId(id);
                              const m = members.find(x => x.id === id);
                              if (m) setAddForm({
                                dietary: (m.dietaryPreference as 'normal' | 'vegetarian' | 'halal') ?? 'normal',
                                tshirtSize: m.tshirtSize ?? '',
                              });
                            }}
                            placeholder="Search members..."
                          />
                          <div className="flex gap-1.5">
                            {(['normal', 'vegetarian', 'halal'] as const).map(opt => (
                              <button key={opt} type="button"
                                onClick={() => setAddForm(f => ({ ...f, dietary: opt }))}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${addForm.dietary === opt ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-jci-blue/40'}`}>
                                {opt === 'normal' ? 'Normal' : opt === 'vegetarian' ? '🌿 Veg' : '☪️ Halal'}
                              </button>
                            ))}
                          </div>
                          <select
                            value={addForm.tshirtSize}
                            onChange={e => setAddForm(f => ({ ...f, tshirtSize: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue bg-white"
                          >
                            <option value="">T-Shirt Size (optional)</option>
                            {(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL', '7XL'] as const).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1" disabled={!addMemberId || addingParticipant} onClick={handleAddParticipant}>
                              {addingParticipant ? <RefreshCw size={12} className="animate-spin mr-1" /> : null}
                              Confirm
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setShowAddParticipant(false); setAddMemberId(''); setAddForm({ dietary: 'normal', tshirtSize: '' }); }}>Cancel</Button>
                          </div>
                        </div>
                      )}
                      {filtered.length === 0 && !showAddParticipant && (
                        <div className="text-center py-10 text-slate-400">
                          <Users size={36} className="mx-auto mb-2 opacity-20" />
                          <p className="text-sm">No registrations yet.</p>
                        </div>
                      )}
                      {sorted.map((r) => {
                        const mem = members.find((m) => m.id === r.memberId);
                        const roleLabel = (() => {
                          if (!mem) return 'Public';
                          if (isDirector(mem)) return 'Comm. Dir.';
                          if (isBoardMember(mem)) return 'Board';
                          const rv = (mem.role ?? mem.systemRole ?? '').toUpperCase();
                          if (rv === 'ADMIN' || rv === 'SUPER_ADMIN') return 'Admin';
                          if (rv === 'BOARD') return 'Board';
                          if (rv === 'MEMBER') return 'Member';
                          if (rv === 'PROBATION') return 'Probation';
                          return 'Guest';
                        })();
                        const isCancelled = r.status === 'cancelled';
                        const cancelLabel = isCancelled
                          ? r.cancelledByRole === 'self'
                            ? 'Cancelled by self'
                            : `Cancelled by ${r.cancelledByRole ?? 'admin'}: ${r.cancelledByName ?? ''}`
                          : null;
                        const isRowExpanded = expandedRows.has(r.id);
                        const hasDetails = r.dietary != null || r.isVegetarian != null || r.emergencyContactName || r.emergencyContactPhone || r.tshirtSize;
                        return (
                          <div key={r.id} className={`transition-colors ${isCancelled ? 'bg-red-50/40 opacity-70' : 'bg-white'}`}>
                            <div className="px-3 py-2.5">
                              <div className="flex items-start gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => hasDetails && setExpandedRows(prev => {
                                    const next = new Set(prev);
                                    next.has(r.id) ? next.delete(r.id) : next.add(r.id);
                                    return next;
                                  })}
                                  className={`relative w-7 h-7 rounded-full shrink-0 mt-0.5 overflow-hidden ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
                                >
                                  {mem && memberAvatar(mem) ? (
                                    <img src={memberAvatar(mem)} alt={mem.name ?? ''} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className={`w-full h-full flex items-center justify-center text-[10px] font-bold ${initialsColor(mem?.id ?? r.memberId ?? '')}`}>
                                      {nameInitials(mem?.name ?? r.memberName ?? '?')}
                                    </div>
                                  )}
                                  {hasDetails && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                      <ChevronDown size={13} className={`text-white transition-transform ${isRowExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                      roleLabel === 'Board' ? 'bg-jci-blue/10 text-jci-blue' :
                                      roleLabel === 'Admin' ? 'bg-purple-100 text-purple-700' :
                                      roleLabel === 'Member' ? 'bg-slate-100 text-slate-500' :
                                      roleLabel === 'Probation' ? 'bg-yellow-100 text-yellow-700' :
                                      roleLabel === 'Public' ? 'bg-orange-100 text-orange-700' :
                                      'bg-slate-100 text-slate-400'
                                    }`}>{roleLabel}</span>
                                    <p className={`text-sm font-semibold truncate ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{mem?.name ?? r.memberName ?? 'Unknown'}</p>
                                    {(r.dietary === 'vegetarian' || (!r.dietary && r.isVegetarian)) && <Leaf size={11} className="shrink-0 text-emerald-500" />}
                                    {r.dietary === 'halal' && <span className="shrink-0 text-[10px]" title="Halal">☪️</span>}
                                    {r.tshirtSize && <span className="shrink-0 text-[10px] font-medium text-slate-400">{r.tshirtSize}</span>}
                                  </div>
                                  <div className="flex items-center justify-between gap-2 mt-1">
                                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                                      {isCancelled ? (
                                        <Badge variant="error" className="text-[10px] shrink-0 h-5 !py-0">{cancelLabel}</Badge>
                                      ) : (
                                        <Badge variant={r.status === 'checked_in' ? 'success' : r.status === 'paid' ? 'warning' : 'neutral'} className="text-[10px] shrink-0 h-5 !py-0">
                                          {r.status === 'registered' ? 'Pending Payment' : r.status === 'paid' ? 'Pending Check-In' : 'Checked In'}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      {isCancelled && isCommitteeMember && (
                                        <Button size="sm" variant="outline" className="h-5 px-1" title="Re-register" disabled={updatingRegId !== null} onClick={async () => {
                                          try {
                                            await EventsService.registerForEvent(event.id, r.memberId, { memberName: mem?.name ?? r.memberName, registeredBy: member?.id, registeredByName: member?.name ?? member?.id });
                                            setParticipations(prev => prev.map(x => x.id === r.id ? { ...x, status: 'registered' as const, cancelledAt: null, cancelledBy: null, cancelledByName: null, cancelledByRole: null, registeredBy: member?.id, registeredByName: member?.name ?? member?.id } : x));
                                            showToast(`${mem?.name ?? r.memberName ?? 'Member'} re-registered`, 'success');
                                          } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error'); }
                                        }}><RefreshCw size={12} /></Button>
                                      )}
                                      {!isCancelled && (
                                        <Button size="sm" variant={r.paidAt ? 'outline' : 'secondary'} className="h-5 px-1" title={r.paidAt ? 'Undo Payment' : 'Mark Paid'} disabled={updatingRegId !== null} onClick={() => r.paidAt ? handleUndoPaid(r) : handleMarkPaid(r)}><DollarSign size={12} /></Button>
                                      )}
                                      {!isCancelled && (
                                        <Button size="sm" variant={r.status === 'checked_in' ? 'outline' : 'secondary'} className="h-5 px-1" title={r.status === 'checked_in' ? 'Undo Check-In' : 'Check In'} disabled={updatingRegId !== null} onClick={() => r.status === 'checked_in' ? handleUndoCheckedIn(r) : handleMarkCheckedIn(r)}><CheckCircle size={12} /></Button>
                                      )}
                                      {!isCancelled && onCancelRegistration && (
                                        <Button size="sm" variant="secondary" className="h-5 px-1 text-red-500 border-red-200 hover:bg-red-50" title="Cancel registration" disabled={updatingRegId !== null} onClick={() => handleAdminCancel(r)}><Trash2 size={12} /></Button>
                                      )}
                                    </div>
                                  </div>
                                  {!isCancelled && (
                                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 flex-wrap">
                                      <span>Reg: {r.registeredByName ?? 'Self'}</span>
                                      {r.paidByName && <><span className="opacity-40">|</span><span>Verified: {r.paidByName}</span></>}
                                      {r.checkedInByName && <><span className="opacity-40">|</span><span>Check-in by: {r.checkedInByName}</span></>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            {isRowExpanded && hasDetails && (
                              <div className="px-3 pb-2.5 pl-[52px] grid grid-cols-2 gap-x-4 gap-y-1.5">
                                {(r.dietary != null || r.isVegetarian != null) && (
                                  <div className="col-span-2 flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Dietary</span>
                                    {r.dietary === 'vegetarian' || (!r.dietary && r.isVegetarian) ? (
                                      <Badge variant="success" className="text-[10px]">🌿 Vegetarian</Badge>
                                    ) : r.dietary === 'halal' ? (
                                      <Badge variant="success" className="text-[10px]">☪️ Halal</Badge>
                                    ) : (
                                      <Badge variant="neutral" className="text-[10px]">Normal</Badge>
                                    )}
                                  </div>
                                )}
                                {r.tshirtSize && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">T-Shirt Size</p>
                                    <p className="text-xs font-medium text-slate-700">{r.tshirtSize}</p>
                                  </div>
                                )}
                                {(r.emergencyContactName || r.emergencyContactPhone) && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Emergency Contact</p>
                                    {r.emergencyContactName && <p className="text-xs font-medium text-slate-700 truncate">{r.emergencyContactName}</p>}
                                    {r.emergencyContactPhone && <p className="text-xs text-slate-500">{r.emergencyContactPhone}</p>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'stats' && (() => {
                const allRegs = participations;
                const activeRegs = allRegs.filter(r => r.status !== 'cancelled');
                const totalRegistered = allRegs.filter(r => r.status === 'registered').length;
                const totalPaid = allRegs.filter(r => r.status === 'paid').length;
                const totalCheckedIn = allRegs.filter(r => r.status === 'checked_in').length;
                const totalCancelled = allRegs.filter(r => r.status === 'cancelled').length;
                const totalActive = activeRegs.length;

                const dietaryCounts = { normal: 0, vegetarian: 0, halal: 0, unspecified: 0 };
                activeRegs.forEach(r => {
                  const mem = members.find(m => m.id === r.memberId);
                  const dietary = r.dietary ?? (mem?.dietaryPreference as 'normal' | 'vegetarian' | 'halal' | null | undefined) ?? null;
                  if (dietary === 'vegetarian') dietaryCounts.vegetarian++;
                  else if (dietary === 'halal') dietaryCounts.halal++;
                  else if (dietary === 'normal') dietaryCounts.normal++;
                  else dietaryCounts.unspecified++;
                });

                const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
                const sizeCounts = activeRegs.reduce<Record<string, number>>((acc, r) => {
                  const mem = members.find(m => m.id === r.memberId);
                  const size = r.tshirtSize ?? mem?.tshirtSize ?? null;
                  if (size) acc[size] = (acc[size] ?? 0) + 1;
                  return acc;
                }, {});
                const sizes = Object.entries(sizeCounts).sort(([a], [b]) => {
                  const ai = sizeOrder.indexOf(a), bi = sizeOrder.indexOf(b);
                  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                });
                const sizeUnspecified = totalActive - sizes.reduce((s, [, c]) => s + c, 0);

                const pct = (n: number, total: number) => total === 0 ? 0 : Math.round((n / total) * 100);

                return (
                  <div className="animate-fade-in space-y-4">
                    {/* Summary tiles */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Registered', value: totalActive, color: 'text-slate-800' },
                        { label: 'Pending Pay', value: totalRegistered, color: 'text-amber-600' },
                        { label: 'Paid', value: totalPaid, color: 'text-blue-600' },
                        { label: 'Checked In', value: totalCheckedIn, color: 'text-emerald-600' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="rounded-xl border border-slate-100 bg-white p-2.5 text-center">
                          <p className={`text-xl font-black ${color} leading-none`}>{value}</p>
                          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mt-1 leading-tight">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Registration status bar */}
                    {totalActive > 0 && (
                      <div className="rounded-xl border border-slate-100 bg-white p-3.5">
                        <div className="flex items-center justify-between mb-2.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registration Status</p>
                          <button
                            onClick={() => {
                              const text = `Registration Status (${totalActive} active):\nChecked In: ${totalCheckedIn} (${pct(totalCheckedIn, totalActive)}%)\nPaid: ${totalPaid} (${pct(totalPaid, totalActive)}%)\nPending Payment: ${totalRegistered} (${pct(totalRegistered, totalActive)}%)${totalCancelled > 0 ? `\nCancelled: ${totalCancelled}` : ''}`;
                              navigator.clipboard.writeText(text);
                              showToast('Registration status copied', 'success');
                            }}
                            className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
                            title="Copy registration status"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                        <div className="flex h-3 rounded-full overflow-hidden gap-px">
                          {totalCheckedIn > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${pct(totalCheckedIn, totalActive)}%` }} title={`Checked In: ${totalCheckedIn}`} />}
                          {totalPaid > 0 && <div className="bg-jci-blue transition-all" style={{ width: `${pct(totalPaid, totalActive)}%` }} title={`Paid: ${totalPaid}`} />}
                          {totalRegistered > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${pct(totalRegistered, totalActive)}%` }} title={`Pending: ${totalRegistered}`} />}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                          {[
                            { label: 'Checked In', count: totalCheckedIn, cls: 'bg-emerald-500' },
                            { label: 'Paid', count: totalPaid, cls: 'bg-jci-blue' },
                            { label: 'Pending', count: totalRegistered, cls: 'bg-amber-400' },
                            ...(totalCancelled > 0 ? [{ label: 'Cancelled', count: totalCancelled, cls: 'bg-slate-300' }] : []),
                          ].map(({ label, count, cls }) => (
                            <div key={label} className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${cls}`} />
                              <span className="text-[11px] text-slate-500">{label} <span className="font-bold text-slate-700">{count}</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dietary + T-Shirt: 2-col on desktop, stacked on mobile */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Dietary */}
                      <div className="rounded-xl border border-slate-100 overflow-hidden">
                        <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dietary</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">{totalActive} total</span>
                            <button
                              onClick={() => {
                                const text = `Dietary breakdown (${totalActive} total):\nNormal: ${dietaryCounts.normal} (${pct(dietaryCounts.normal, totalActive)}%)\nVegetarian: ${dietaryCounts.vegetarian} (${pct(dietaryCounts.vegetarian, totalActive)}%)\nHalal: ${dietaryCounts.halal} (${pct(dietaryCounts.halal, totalActive)}%)${dietaryCounts.unspecified > 0 ? `\nNot specified: ${dietaryCounts.unspecified}` : ''}`;
                                navigator.clipboard.writeText(text);
                                showToast('Dietary stats copied', 'success');
                              }}
                              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
                              title="Copy dietary stats"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="px-3.5 py-3 bg-white space-y-3">
                          <div className="flex h-4 rounded-full overflow-hidden gap-px">
                            {dietaryCounts.normal > 0 && <div className="bg-slate-400 transition-all" style={{ width: `${pct(dietaryCounts.normal, totalActive)}%` }} />}
                            {dietaryCounts.vegetarian > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${pct(dietaryCounts.vegetarian, totalActive)}%` }} />}
                            {dietaryCounts.halal > 0 && <div className="bg-teal-500 transition-all" style={{ width: `${pct(dietaryCounts.halal, totalActive)}%` }} />}
                            {dietaryCounts.unspecified > 0 && <div className="bg-slate-200 transition-all" style={{ width: `${pct(dietaryCounts.unspecified, totalActive)}%` }} />}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {[
                              { label: 'Normal', count: dietaryCounts.normal, cls: 'bg-slate-400', text: 'text-slate-700' },
                              { label: '🌿 Vegetarian', count: dietaryCounts.vegetarian, cls: 'bg-emerald-500', text: 'text-emerald-700' },
                              { label: '☪️ Halal', count: dietaryCounts.halal, cls: 'bg-teal-500', text: 'text-teal-700' },
                              ...(dietaryCounts.unspecified > 0 ? [{ label: 'N/A', count: dietaryCounts.unspecified, cls: 'bg-slate-200', text: 'text-slate-400' }] : []),
                            ].map(({ label, count, cls, text }) => (
                              <div key={label} className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${cls} shrink-0`} />
                                <span className="text-[11px] text-slate-500">{label} <span className={`font-bold tabular-nums ${text}`}>{count}</span> <span className="text-slate-400">({pct(count, totalActive)}%)</span></span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* T-Shirt Sizes */}
                      <div className="rounded-xl border border-slate-100 overflow-hidden">
                        <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">T-Shirt Sizes</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">{sizes.reduce((s, [, c]) => s + c, 0)} specified</span>
                            <button
                              onClick={() => {
                                const lines = sizes.map(([size, count]) => `${size}: ${count} (${pct(count, totalActive)}%)`);
                                if (sizeUnspecified > 0) lines.push(`Not specified: ${sizeUnspecified}`);
                                const text = `T-Shirt Sizes (${totalActive} total):\n${lines.join('\n')}`;
                                navigator.clipboard.writeText(text);
                                showToast('T-shirt sizes copied', 'success');
                              }}
                              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
                              title="Copy t-shirt size stats"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>
                        {sizes.length === 0 ? (
                          <div className="px-3.5 py-6 text-center text-sm text-slate-400">No size data collected</div>
                        ) : (() => {
                          const sizeColors = ['#38bdf8','#0ea5e9','#0284c7','#0369a1','#075985','#0c4a6e','#082f49'];
                          const specifiedTotal = sizes.reduce((s, [, c]) => s + c, 0);
                          return (
                            <div className="px-3.5 py-3 bg-white space-y-3">
                              <div className="flex h-4 rounded-full overflow-hidden gap-px">
                                {sizes.map(([size, count], i) => (
                                  <div key={size} className="transition-all" style={{ width: `${pct(count, totalActive)}%`, backgroundColor: sizeColors[i % sizeColors.length] }} />
                                ))}
                                {sizeUnspecified > 0 && <div className="bg-slate-200 transition-all" style={{ width: `${pct(sizeUnspecified, totalActive)}%` }} />}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                                {sizes.map(([size, count], i) => (
                                  <div key={size} className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sizeColors[i % sizeColors.length] }} />
                                    <span className="text-[11px] text-slate-500">{size} <span className="font-bold tabular-nums text-slate-700">{count}</span> <span className="text-slate-400">({pct(count, totalActive)}%)</span></span>
                                  </div>
                                ))}
                                {sizeUnspecified > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-slate-200 shrink-0" />
                                    <span className="text-[11px] text-slate-400">N/A <span className="font-bold tabular-nums">{sizeUnspecified}</span></span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {activeTab === 'feedback' && (
                <div className="animate-fade-in">
                  <EventFeedbackTab
                    event={event}
                    feedback={eventFeedback}
                    loading={loadingFeedback}
                    onRefresh={loadEventFeedback}
                    onSubmitFeedback={() => setIsFeedbackModalOpen(true)}
                  />
                </div>
              )}
            </div>

            {/* Right column: info panel (desktop only) */}
            <div className="hidden md:flex flex-col gap-4 px-6 pt-6 pb-8">
              {/* Price + Register */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block leading-none">From</span>
                <div className="flex items-baseline">
                  {priceMin != null ? (
                    <>
                      <span className="text-2xl font-black text-slate-900">
                        RM {priceMin}{priceMax != null && priceMax !== priceMin ? ` – ${priceMax}` : ''}
                      </span>
                    </>
                  ) : (
                    <span className="text-2xl font-black text-green-600">FREE</span>
                  )}
                </div>
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">/ person</span>

                {registerButton}
              </div>

              {/* Event info list */}
              <div className="divide-y divide-slate-100">
                <div className="flex items-start gap-3 py-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Calendar size={15} className="text-jci-blue" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Date & Time</p>
                    {isMultiDay ? (
                      <>
                        <p className="text-sm font-semibold text-slate-800">{formatDay(date)} – {formatDay(endDate!)}</p>
                        <p className="text-xs text-slate-500">{formatWeekday(date)} – {formatWeekday(endDate!)}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-slate-800">{formatDay(date)}</p>
                        {eventTime && <p className="text-xs text-slate-500">{formatWeekday(date)} · {eventTime}</p>}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3 py-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <MapPin size={15} className="text-jci-blue" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Location</p>
                    <p className="text-sm font-semibold text-slate-800">{event.location || 'TBA (To Be Announced)'}</p>
                  </div>
                </div>
                {event.maxAttendees && (
                  <div className="flex items-start gap-3 py-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <Users size={15} className="text-jci-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Attendance</p>
                      <p className="text-sm font-semibold text-slate-800">{event.attendees || 0} / {event.maxAttendees} spots</p>
                      <div className="mt-1.5 w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div style={{ width: `${Math.min(100, attendancePercent)}%` }} className="h-full bg-jci-blue rounded-full" />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{attendancePercent}% filled</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3 py-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Tag size={15} className="text-jci-blue" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Category</p>
                    <p className="text-sm font-semibold text-slate-800">{event.type || 'General Event'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {isFeedbackModalOpen && (
        <EventFeedbackModal
          event={event}
          onClose={() => {
            setIsFeedbackModalOpen(false);
            loadEventFeedback();
          }}
        />
      )}

      {showRegForm && (
        <Modal
          isOpen
          onClose={() => setShowRegForm(false)}
          title="活动报名"
          size="sm"
          footer={
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowRegForm(false)}>取消</Button>
              <Button onClick={handleRegFormSubmit}>确认报名</Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Dietary */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                饮食要求 <span className="normal-case font-normal">Dietary Preference</span>
              </label>
              <div className="flex gap-2">
                {(['normal', 'vegetarian', 'halal'] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setRegForm(f => ({ ...f, dietary: opt }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${regForm.dietary === opt ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-jci-blue/40'}`}
                  >
                    {opt === 'normal' ? 'Normal' : opt === 'vegetarian' ? '🌿 Veg' : '☪️ Halal'}
                  </button>
                ))}
              </div>
            </div>

            {/* Emergency contact name */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                紧急联络人姓名 <span className="normal-case font-normal">Emergency Contact</span>
              </label>
              <input
                type="text"
                value={regForm.emergencyContactName}
                onChange={e => setRegForm(f => ({ ...f, emergencyContactName: e.target.value }))}
                placeholder="Full name"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue"
              />
            </div>

            {/* Emergency contact phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                紧急联络人电话 <span className="normal-case font-normal">Emergency Phone</span>
              </label>
              <input
                type="tel"
                value={regForm.emergencyContactPhone}
                onChange={e => setRegForm(f => ({ ...f, emergencyContactPhone: e.target.value }))}
                placeholder="+60 12-345 6789"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue"
              />
            </div>

            {/* T-shirt size */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                衣服尺码 <span className="normal-case font-normal">T-Shirt Size</span>
              </label>
              <select
                value={regForm.tshirtSize}
                onChange={e => setRegForm(f => ({ ...f, tshirtSize: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue bg-white"
              >
                <option value="">-- 请选择 --</option>
                {(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL', '7XL'] as const).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

// Event Budget Tab Component
export interface EventBudgetTabProps {
  event: Event;
  budget: EventBudget | null;
  loading: boolean;
  onRefresh: () => void;
  onEdit: () => void;
}

export const EventBudgetTab: React.FC<EventBudgetTabProps> = ({
  event,
  budget,
  loading,
  onRefresh,
  onEdit,
}) => {
  const { showToast } = useToast();

  const handleReconcile = async () => {
    try {
      await EventBudgetService.reconcileEventBudget(event.id);
      showToast('Budget reconciled successfully', 'success');
      onRefresh();
    } catch (err) {
      showToast('Failed to reconcile budget', 'error');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Loading budget...</div>;
  }

  if (!budget) {
    return (
      <div className="text-center py-12">
        <DollarSign className="mx-auto text-slate-400 mb-4" size={48} />
        <p className="text-slate-500 mb-4">No budget created for this event</p>
        <Button onClick={onEdit}>Create Budget</Button>
      </div>
    );
  }

  const remainingBudget = budget.allocatedBudget - budget.spent;
  const budgetUtilization = budget.allocatedBudget > 0 ? (budget.spent / budget.allocatedBudget) * 100 : 0;
  const netBalance = budget.income - budget.spent;

  return (
    <div className="space-y-6">
      {/* Budget Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-slate-500 mb-1">Allocated</div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(budget.allocatedBudget, budget.currency)}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500 mb-1">Spent</div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(budget.spent, budget.currency)}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500 mb-1">Income</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(budget.income, budget.currency)}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500 mb-1">Net Balance</div>
          <div className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(netBalance, budget.currency)}
          </div>
        </Card>
      </div>

      {/* Budget Utilization */}
      <Card title="Budget Utilization">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-600">Budget Used</span>
              <span className="font-semibold">{budgetUtilization.toFixed(1)}%</span>
            </div>
            <ProgressBar progress={Math.min(budgetUtilization, 100)} />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Remaining:</span>
              <span className={`ml-2 font-semibold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(remainingBudget, budget.currency)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Status:</span>
              <Badge variant={budget.status === 'Active' ? 'success' : budget.status === 'Approved' ? 'info' : 'neutral'} className="ml-2">
                {budget.status}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Budget Items */}
      <Card title="Budget Items">
        <div className="space-y-3">
          {budget.budgetItems && budget.budgetItems.length > 0 ? (
            budget.budgetItems.map((item) => (
              <div key={item.id} className="p-4 border border-slate-200 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold text-slate-900">{item.description}</div>
                    <Badge variant="neutral" className="mt-1">{item.category}</Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">
                      {formatCurrency(item.actualAmount || item.estimatedAmount, budget.currency)}
                    </div>
                    {item.actualAmount && item.actualAmount !== item.estimatedAmount && (
                      <div className="text-xs text-slate-500">
                        Est: {formatCurrency(item.estimatedAmount, budget.currency)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <Badge variant={
                    item.status === 'Spent' ? 'success' :
                      item.status === 'Approved' ? 'info' :
                        'neutral'
                  }>
                    {item.status}
                  </Badge>
                  {item.notes && (
                    <span className="text-xs text-slate-500">{item.notes}</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-slate-500 py-4">No budget items added yet</p>
          )}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={onEdit} variant="outline">
          <Edit size={16} className="mr-2" />
          Edit Budget
        </Button>
        <Button onClick={handleReconcile} variant="outline">
          <RefreshCw size={16} className="mr-2" />
          Reconcile with Transactions
        </Button>
      </div>
    </div>
  );
};

// Event Budget Edit Modal
interface EventBudgetEditModalProps {
  event: Event;
  budget: EventBudget | null;
  onClose: () => void;
}

const EventBudgetEditModal: React.FC<EventBudgetEditModalProps> = ({
  event,
  budget,
  onClose,
}) => {
  const [allocatedBudget, setAllocatedBudget] = useState(budget?.allocatedBudget || 0);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(budget?.budgetItems || []);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await EventBudgetService.saveEventBudget({
        eventId: event.id,
        eventTitle: event.title,
        allocatedBudget,
        spent: budget?.spent || 0,
        income: budget?.income || 0,
        currency: 'USD',
        budgetItems,
        status: budget?.status || 'Draft',
      });
      showToast('Budget saved successfully', 'success');
      onClose();
    } catch (err) {
      showToast('Failed to save budget', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Edit Budget: ${event.title}`} size="lg" drawerOnMobile>
      <div className="space-y-4">
        <Input
          label="Allocated Budget"
          type="number"
          step="0.01"
          value={allocatedBudget.toString()}
          onChange={(e) => setAllocatedBudget(parseFloat(e.target.value) || 0)}
          required
        />
        <div className="pt-4 flex gap-3">
          <Button onClick={handleSave} className="flex-1" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Budget'}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
};

// Event Feedback Tab Component
export interface EventFeedbackTabProps {
  event: Event;
  feedback: EventFeedbackSummary | null;
  loading: boolean;
  onRefresh: () => void;
  onSubmitFeedback: () => void;
}

export const EventFeedbackTab: React.FC<EventFeedbackTabProps> = ({
  event,
  feedback,
  loading,
  onRefresh,
  onSubmitFeedback,
}) => {
  const { member } = useAuth();
  const { showToast } = useToast();

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Loading feedback...</div>;
  }

  if (!feedback || feedback.totalResponses === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto text-slate-400 mb-4" size={48} />
        <p className="text-slate-500 mb-4">No feedback collected yet</p>
        {member && event.status === 'Completed' && (
          <Button onClick={onSubmitFeedback}>
            Submit Feedback
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Feedback Summary */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-slate-500 mb-1">Total Responses</div>
          <div className="text-2xl font-bold text-slate-900">{feedback.totalResponses}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500 mb-1">Average Rating</div>
          <div className="text-2xl font-bold text-amber-600">{feedback.averageRating.toFixed(1)}/5</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500 mb-1">Satisfaction</div>
          <div className="text-2xl font-bold text-green-600">{feedback.averageSatisfaction.toFixed(1)}/5</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500 mb-1">Recommendation Rate</div>
          <div className="text-2xl font-bold text-blue-600">{feedback.recommendationRate.toFixed(0)}%</div>
        </Card>
      </div>

      {/* Detailed Ratings */}
      {feedback.averageContentQuality && (
        <Card title="Detailed Ratings">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-slate-500 mb-1">Content Quality</div>
              <div className="text-xl font-bold">{feedback.averageContentQuality.toFixed(1)}/5</div>
            </div>
            {feedback.averageOrganization && (
              <div>
                <div className="text-sm text-slate-500 mb-1">Organization</div>
                <div className="text-xl font-bold">{feedback.averageOrganization.toFixed(1)}/5</div>
              </div>
            )}
            {feedback.averageVenue && (
              <div>
                <div className="text-sm text-slate-500 mb-1">Venue</div>
                <div className="text-xl font-bold">{feedback.averageVenue.toFixed(1)}/5</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Common Themes */}
      {feedback.commonThemes && feedback.commonThemes.length > 0 && (
        <Card title="Common Themes">
          <div className="flex flex-wrap gap-2">
            {feedback.commonThemes.map((theme, index) => (
              <Badge key={index} variant="neutral">{theme}</Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Feedback */}
      <Card title="Recent Feedback">
        <div className="space-y-4">
          {feedback.feedbacks.slice(0, 5).map((fb) => (
            <div key={fb.id} className="p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={i < fb.rating ? 'text-amber-400' : 'text-slate-300'}>★</span>
                    ))}
                  </div>
                  <span className="text-sm text-slate-500">{formatDate(fb.submittedAt as Date)}</span>
                </div>
                {fb.wouldRecommend && (
                  <Badge variant="success">Would Recommend</Badge>
                )}
              </div>
              {fb.comments && (
                <p className="text-sm text-slate-700 mb-2">{fb.comments}</p>
              )}
              {fb.suggestions && (
                <p className="text-xs text-slate-500 italic">Suggestion: {fb.suggestions}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {member && event.status === 'Completed' && (
        <div className="pt-4">
          <Button onClick={onSubmitFeedback} className="w-full">
            Submit Your Feedback
          </Button>
        </div>
      )}
    </div>
  );
};

// Event Feedback Modal Component
export interface EventFeedbackModalProps {
  event: Event;
  onClose: () => void;
}

export const EventFeedbackModal: React.FC<EventFeedbackModalProps> = ({ event, onClose }) => {
  const { member } = useAuth();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitFeedback = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!member) {
      showToast('Please login to submit feedback', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      await EventFeedbackService.submitFeedback({
        eventId: event.id,
        memberId: member.id,
        rating: parseInt(formData.get('rating') as string),
        overallSatisfaction: parseInt(formData.get('satisfaction') as string),
        contentQuality: formData.get('contentQuality') ? parseInt(formData.get('contentQuality') as string) : undefined,
        organization: formData.get('organization') ? parseInt(formData.get('organization') as string) : undefined,
        venue: formData.get('venue') ? parseInt(formData.get('venue') as string) : undefined,
        comments: formData.get('comments') as string || undefined,
        wouldRecommend: formData.get('wouldRecommend') === 'true',
        suggestions: formData.get('suggestions') as string || undefined,
      });
      showToast('Feedback submitted successfully', 'success');
      onClose();
    } catch (err) {
      showToast('Failed to submit feedback', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Feedback: ${event.title}`} size="lg" drawerOnMobile>
      <form onSubmit={handleSubmitFeedback} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Overall Rating *</label>
          <Select
            name="rating"
            options={[
              { label: '5 - Excellent', value: '5' },
              { label: '4 - Very Good', value: '4' },
              { label: '3 - Good', value: '3' },
              { label: '2 - Fair', value: '2' },
              { label: '1 - Poor', value: '1' },
            ]}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Overall Satisfaction *</label>
          <Select
            name="satisfaction"
            options={[
              { label: '5 - Very Satisfied', value: '5' },
              { label: '4 - Satisfied', value: '4' },
              { label: '3 - Neutral', value: '3' },
              { label: '2 - Dissatisfied', value: '2' },
              { label: '1 - Very Dissatisfied', value: '1' },
            ]}
            required
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Content Quality</label>
            <Select
              name="contentQuality"
              options={[
                { label: '5 - Excellent', value: '5' },
                { label: '4 - Very Good', value: '4' },
                { label: '3 - Good', value: '3' },
                { label: '2 - Fair', value: '2' },
                { label: '1 - Poor', value: '1' },
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Organization</label>
            <Select
              name="organization"
              options={[
                { label: '5 - Excellent', value: '5' },
                { label: '4 - Very Good', value: '4' },
                { label: '3 - Good', value: '3' },
                { label: '2 - Fair', value: '2' },
                { label: '1 - Poor', value: '1' },
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Venue</label>
            <Select
              name="venue"
              options={[
                { label: '5 - Excellent', value: '5' },
                { label: '4 - Very Good', value: '4' },
                { label: '3 - Good', value: '3' },
                { label: '2 - Fair', value: '2' },
                { label: '1 - Poor', value: '1' },
              ]}
            />
          </div>
        </div>

        <Textarea
          name="comments"
          label="Comments"
          placeholder="Share your thoughts about the event..."
          rows={4}
        />

        <Textarea
          name="suggestions"
          label="Suggestions for Improvement"
          placeholder="Any suggestions for future events?"
          rows={3}
        />

        <div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="wouldRecommend" value="true" className="rounded" />
            <span className="text-sm text-slate-700">Would you recommend this event to others?</span>
          </label>
        </div>

        <div className="pt-4 flex gap-3">
          <Button type="submit" className="flex-1" isLoading={isSubmitting}>
            Submit Feedback
          </Button>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
};
