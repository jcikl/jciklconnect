import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, MapPin, Users, Filter, Plus, Clock, BrainCircuit, List, FileText, Edit, Trash2, Copy, DollarSign, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Search, Eye, Star, StarOff, Share2, ArrowLeft, Tag, Info } from 'lucide-react';
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
import { DEFAULT_LO_ID } from '../../config/constants';
import { EventBudgetService, EventBudget, BudgetItem } from '../../services/eventBudgetService';
import { EventFeedbackService, EventFeedback, EventFeedbackSummary } from '../../services/eventFeedbackService';
import { EventRegistrationService } from '../../services/eventRegistrationService';
import type { EventRegistration } from '../../types';
import { formatCurrency } from '../../utils/formatUtils';
import { formatDate } from '../../utils/dateUtils';

type ViewMode = 'list' | 'calendar';

export const EventsView: React.FC<{ searchQuery?: string; initialSelectedEventId?: string | null; onClearSelection?: () => void }> = ({ searchQuery, initialSelectedEventId, onClearSelection }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const { events, loading, error, registerForEvent, markAttendance, updateEvent } = useEvents();
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
        <Card noPadding className="overflow-hidden">
          <div className="px-4 md:px-6 pt-4">
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
            <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRegister={() => {
            if (member) {
              registerForEvent(selectedEvent.id, member.id);
              setSelectedEvent(null);
            }
          }}
          onCheckIn={() => {
            if (member) {
              markAttendance(selectedEvent.id, member.id);
              setSelectedEvent(null);
            }
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
export interface EventDetailModalProps {
  event: Event;
  onClose: () => void;
  onRegister: () => void;
  onCheckIn: () => void;
  member: any;
  members: Member[];
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  onClose,
  onRegister,
  onCheckIn,
  member,
  members,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'participants' | 'feedback'>('details');
  const [eventFeedback, setEventFeedback] = useState<EventFeedbackSummary | null>(null);
  const [participations, setParticipations] = useState<EventRegistration[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [updatingRegId, setUpdatingRegId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const { isBoard, isAdmin } = usePermissions();
  const { showToast } = useToast();

  const isCommitteeMember = useMemo(() => {
    if (!member) return false;
    if (isAdmin || isBoard) return true;
    if (event.organizerId === member.id) return true;
    return event.committee?.some(c => c.memberId === member.id) ?? false;
  }, [event.committee, event.organizerId, member, isAdmin, isBoard]);

  const availableTabs = useMemo(() => {
    const tabs = ['Event Details'];
    if (isCommitteeMember) {
      tabs.push('参与名单');
    }
    tabs.push('Feedback');
    return tabs;
  }, [isCommitteeMember]);

  useEffect(() => {
    if (activeTab === 'feedback') {
      loadEventFeedback();
    } else if (activeTab === 'participants') {
      loadParticipations();
    }
  }, [activeTab, event.id]);

  const loadParticipations = async () => {
    setLoadingParticipants(true);
    try {
      const list = await EventRegistrationService.listByEvent(event.id);
      setParticipations(list);
    } catch {
      setParticipations([]);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const handleMarkPaid = async (reg: EventRegistration) => {
    setUpdatingRegId(reg.id);
    try {
      await EventRegistrationService.updateStatus(reg.id, 'paid', { paidAt: new Date().toISOString() });
      setParticipations((prev) => prev.map((r) => (r.id === reg.id ? { ...r, status: 'paid' as const, paidAt: new Date().toISOString() } : r)));
      showToast('已标记为已缴费', 'success');
    } catch {
      showToast('操作失败', 'error');
    } finally {
      setUpdatingRegId(null);
    }
  };

  const handleMarkCheckedIn = async (reg: EventRegistration) => {
    setUpdatingRegId(reg.id);
    try {
      await EventRegistrationService.updateStatus(reg.id, 'checked_in', { checkedInAt: new Date().toISOString() });
      setParticipations((prev) => prev.map((r) => (r.id === reg.id ? { ...r, status: 'checked_in' as const, checkedInAt: new Date().toISOString() } : r)));
      showToast('已标记为已签到', 'success');
    } catch {
      showToast('操作失败', 'error');
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
  const isRegistered = member && event.registeredMembers?.includes(member.id);
  const attendancePercent = event.maxAttendees ? Math.round(((event.attendees || 0) / event.maxAttendees) * 100) : 0;

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={null}
        size="lg"
        drawerOnMobile
        mobileHeight={isExpanded ? "h-screen" : "h-[80vh] md:h-auto"}
        scrollInBody={true}
        onScroll={(e) => {
          const scrollTop = e.currentTarget.scrollTop;
          if (scrollTop > 10 && !isExpanded) {
            setIsExpanded(true);
          } else if (scrollTop <= 0 && isExpanded) {
            setIsExpanded(false);
          }
        }}
        className="premium-event-modal"
        footerClassName="flex-none p-6 bg-white border-t border-slate-50 rounded-t-[40px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.15)] z-30 pb-safe"
        footer={activeTab === 'details' ? (
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex flex-col">
              <span className="text-2xl font-black text-slate-900 leading-none">
                {event.price ? `RM ${event.price}` : 'FREE'}
              </span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">per person</span>
            </div>
            <Button
              className={`flex-1 max-w-[220px] h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${isRegistered
                ? 'bg-green-500 text-white hover:bg-green-600 shadow-green-100'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
                }`}
              disabled={isRegistered || event.status === 'Completed' || event.status === 'Cancelled'}
              onClick={onRegister}
            >
              {event.status === 'Completed' ? (
                <span>Event Ended</span>
              ) : event.status === 'Cancelled' ? (
                <span>Cancelled</span>
              ) : isRegistered ? (
                <>
                  <CheckCircle size={20} className="stroke-[3]" />
                  <span>Registered</span>
                </>
              ) : (
                <>
                  <CheckCircle size={20} className="stroke-[3]" />
                  <span>Register Now</span>
                </>
              )}
            </Button>
          </div>
        ) : null}
      >
        <div className="-m-4 md:-m-6 relative">
          {/* Hero Image Section */}
          <div
            className="relative h-64 md:h-80 w-full overflow-hidden cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <img
              src={event.imageUrl || "https://images.unsplash.com/photo-1540575861501-7cf05a4b125a?auto=format&fit=crop&q=80"}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>

            {/* Top Bar Controls */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all"
              >
                <ArrowLeft size={20} />
              </button>
              <button
                className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>

          {/* Content Body - Overlapping Card Style */}
          <div className="relative bg-white rounded-t-[32px] -mt-10 px-6 pt-8 pb-10 min-h-[400px]">
            {/* Header Info */}
            <div>
              <Badge variant="jci" className="bg-blue-50 text-jci-blue border-none px-3 py-1 text-[11px] font-bold">
                {event.type || 'Event'}
              </Badge>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                {event.title}
              </h2>
            </div>

            {/* Tabs for Committee/Feedback */}
            {availableTabs.length > 1 && (
              <div>
                <Tabs
                  tabs={availableTabs}
                  activeTab={
                    activeTab === 'details' ? 'Event Details' :
                      activeTab === 'participants' ? '参与名单' : 'Feedback'
                  }
                  onTabChange={(tab) => {
                    if (tab === 'Event Details') setActiveTab('details');
                    else if (tab === '参与名单') setActiveTab('participants');
                    else setActiveTab('feedback');
                  }}
                  className="border-none"
                />
              </div>
            )}

            {activeTab === 'details' && (
              <div className="space-y-3 animate-fade-in">
                {/* Details Card */}
                <div className="bg-white border border-slate-100 rounded-[24px] shadow-sm overflow-hidden">
                  <div className="divide-y divide-slate-50">
                    {/* Date & Time */}
                    <div className="flex items-center gap-4 px-4 py-2">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-jci-blue">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</p>
                        <p className="text-sm font-bold text-slate-800">
                          {date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-4 px-4 py-2">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-jci-blue">
                        <MapPin size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</p>
                        <p className="text-sm font-bold text-slate-800 truncate">{event.location || 'TBA (To Be Announced)'}</p>
                      </div>
                    </div>

                    {/* Price (Details card version) */}
                    <div className="flex items-center gap-4 px-4 py-2">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-jci-blue">
                        <Tag size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Price</p>
                        <p className="text-sm font-bold text-slate-800">
                          {event.price ? `RM ${event.price}` : 'FREE'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* About Section */}
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Info size={18} className="text-jci-blue" />
                    About
                  </h3>
                  <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                    {event.description || "No description provided for this event. Join us to find out more!"}
                  </div>
                </div>

                {/* Attendance Section */}
                <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Attendance</h3>
                    <span className="text-sm font-black text-jci-blue">
                      {event.attendees || 0}/{event.maxAttendees || '∞'}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-slate-200 p-0.5 mb-2">
                    <div
                      style={{ width: `${Math.min(100, attendancePercent)}%` }}
                      className="h-full bg-jci-blue rounded-full shadow-[0_0_10px_rgba(0,151,215,0.2)]"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {attendancePercent}% of spots filled • by JCI Kuala Lumpur
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'participants' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-4">
                  <p className="text-xs text-blue-700 font-medium flex items-center gap-2">
                    <Users size={14} />
                    Committee Access: Track registrations and payments.
                  </p>
                </div>
                {loadingParticipants ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="animate-spin text-jci-blue" size={24} />
                  </div>
                ) : participations.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Users size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No registrations yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {participations.map((r) => {
                      const mem = members.find((m) => m.id === r.memberId);
                      return (
                        <div key={r.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                              <Users size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{mem?.name ?? 'Unknown Member'}</p>
                              <Badge variant={r.status === 'checked_in' ? 'success' : r.status === 'paid' ? 'warning' : 'neutral'} className="text-[10px] mt-1">
                                {r.status === 'registered' ? 'Registered' : r.status === 'paid' ? 'Paid' : 'Checked In'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {r.status === 'registered' && (
                              <Button size="sm" variant="outline" className="text-[10px] h-8" disabled={updatingRegId !== null} onClick={() => handleMarkPaid(r)}>Mark Paid</Button>
                            )}
                            {(r.status === 'registered' || r.status === 'paid') && (
                              <Button size="sm" variant="outline" className="text-[10px] h-8" disabled={updatingRegId !== null} onClick={() => handleMarkCheckedIn(r)}>Check In</Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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
        </div>

        {/* Floating Action Footer (Integrated into Modal Footer) */}
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
