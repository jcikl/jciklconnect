import React, { useState, useMemo, lazy, Suspense } from 'react';
import { ArrowLeft, Calendar, CheckCircle, MapPin, Users } from 'lucide-react';
import { Button, Badge, Modal, useToast } from '@/components/ui/Common';
import * as Forms from '@/components/ui/Form';
import { useEvents } from '@/hooks/useEvents';
import { GuestHeader } from '@/components/layout/GuestHeader';
import { GuestFooter } from '@/components/layout/GuestFooter';
import { Event } from '@/types';

const EventCalendarView = lazy(() =>
  import('@/components/modules/EventCalendarView').then(m => ({ default: m.EventCalendarView }))
);

export const GuestEventsPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => void;
}) => {
  const { events, loading } = useEvents({ publicMode: true });
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [guestRegistrationData, setGuestRegistrationData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    notes: '',
  });
  const { showToast } = useToast();
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events.filter(e => {
      const eventDate = e.date ? new Date(e.date) : null;
      if (!eventDate) return false;
      return eventDate >= today;
    });
  }, [events]);

  const publicEvents = upcomingEvents;
  const allPublishedEvents = events;

  return (
    <div className="min-h-screen bg-slate-50">
      <GuestHeader currentPage="events" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        <section className="relative py-14 md:py-20 bg-gradient-to-br from-jci-navy via-[#1a3d7c] to-jci-blue overflow-hidden" aria-label="Page header">
          <div className="absolute top-0 right-0 w-96 h-96 bg-jci-blue/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest mb-3">JCI Kuala Lumpur Events</p>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4">Upcoming Events</h1>
            <p className="text-blue-200 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Join us for exciting events, trainings, and networking opportunities.
            </p>
          </div>
        </section>

        {/* Public Activity Calendar View */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Activity Calendar</h2>
                <p className="text-slate-600">View all upcoming events and activities</p>
              </div>
              <Button variant="outline" onClick={onLogin}>
                Login to Register
              </Button>
            </div>
            <div className="mt-8">
              <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-jci-blue" /></div>}>
                <EventCalendarView
                  events={allPublishedEvents}
                  readonly={true}
                  upcomingOnly={true}
                  onEventClick={(event) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const eventDate = new Date(event.date);
                    if (eventDate >= today) {
                      setSelectedEvent(event);
                      setIsRegistrationModalOpen(true);
                    } else {
                      showToast('This event has already passed', 'info');
                    }
                  }}
                />
              </Suspense>
            </div>
          </div>
        </section>

        {/* Guest Event Registration Modal */}
      </main>

      {selectedEvent && isRegistrationModalOpen && (() => {
        const evDate = new Date(selectedEvent.date);
        const evEndDate = selectedEvent.endDate ? new Date(selectedEvent.endDate) : null;
        const evIsMultiDay = evEndDate && evEndDate.toDateString() !== evDate.toDateString();
        const evFormatDay = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const evFormatWeekday = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' });
        const evTime = selectedEvent.time || (evDate.getHours() !== 0 || evDate.getMinutes() !== 0 ? evDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);
        const evPriceMin = selectedEvent.priceMin ?? selectedEvent.price;
        const evPriceMax = selectedEvent.priceMax;
        const closeModal = () => {
          setIsRegistrationModalOpen(false);
          setSelectedEvent(null);
          setDescExpanded(false);
          setGuestRegistrationData({ name: '', email: '', phone: '', organization: '', notes: '' });
        };
        return (
          <Modal
            isOpen={isRegistrationModalOpen}
            onClose={closeModal}
            title={null}
            size="2xl"
            bottomSheet={true}
            drawerOnMobile
            mobileHeight="h-[92vh]"
            scrollInBody={true}
            className="premium-registration-modal"
            footerClassName="flex-none px-5 py-4 bg-white border-t border-slate-100 z-30 pb-safe shadow-[0_-4px_16px_-2px_rgba(0,0,0,0.08)]"
            footer={(
              <div className="flex items-center gap-4 w-full">
                <div className="shrink-0 min-w-[80px]">
                  {evPriceMin != null ? (
                    <>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block leading-none mb-0.5">From</span>
                      <span className="text-lg font-black text-slate-900 leading-none">
                        RM {evPriceMin}{evPriceMax != null && evPriceMax !== evPriceMin ? ` – ${evPriceMax}` : ''}
                      </span>
                    </>
                  ) : (
                    <span className="text-xl font-black text-green-600 leading-none">FREE</span>
                  )}
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block leading-none mt-0.5">/ person</span>
                </div>
                <div className="flex-1">
                  <Button
                    form="guest-registration-form"
                    type="submit"
                    className="w-full h-12 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 font-black uppercase tracking-widest text-sm shadow-lg shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={18} className="stroke-[3]" />
                    <span>Confirm Registration</span>
                  </Button>
                </div>
              </div>
            )}
          >
            <div className="-m-4 md:-m-6 relative">
              {/* Hero Image */}
              <div className="relative h-56 md:h-72 w-full overflow-hidden">
                <img
                  src={selectedEvent.imageUrl || "https://images.unsplash.com/photo-1540575861501-7cf05a4b125a?auto=format&fit=crop&q=80"}
                  alt={selectedEvent.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                  <button
                    onClick={closeModal}
                    className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all"
                  >
                    <ArrowLeft size={18} />
                  </button>
                </div>
                {/* Title overlay */}
                <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 md:px-6 md:pb-6">
                  <Badge variant="jci" className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold mb-1.5">
                    {selectedEvent.type || 'Event'}
                  </Badge>
                  <h2 className="text-xl md:text-2xl font-black text-white leading-tight drop-shadow-sm">
                    {selectedEvent.title}
                  </h2>
                </div>
              </div>

              {/* Content body */}
              <div className="relative bg-white rounded-t-[28px] -mt-6 px-5 pt-5 pb-10 md:px-6 md:pt-6">
                {/* Info card */}
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden mb-6">
                  {/* Date */}
                  <div className="flex items-center gap-3 px-3.5 py-3 bg-white">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <Calendar size={14} className="text-jci-blue" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</p>
                      {evIsMultiDay ? (
                        <>
                          <p className="text-sm font-semibold text-slate-800">{evFormatDay(evDate)} – {evFormatDay(evEndDate!)}</p>
                          <p className="text-xs text-slate-500">{evFormatWeekday(evDate)} – {evFormatWeekday(evEndDate!)}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-slate-800">{evFormatDay(evDate)}</p>
                          {evTime && <p className="text-xs text-slate-500">{evFormatWeekday(evDate)} · {evTime}</p>}
                        </>
                      )}
                    </div>
                  </div>
                  {/* Location */}
                  {selectedEvent.location && (
                    <div className="flex items-center gap-3 px-3.5 py-3 bg-white">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <MapPin size={14} className="text-jci-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</p>
                        <p className="text-sm font-semibold text-slate-800 truncate">{selectedEvent.location}</p>
                      </div>
                    </div>
                  )}
                  {/* Spots */}
                  {selectedEvent.maxAttendees && (
                    <div className="flex items-center gap-3 px-3.5 py-3 bg-white">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <Users size={14} className="text-jci-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spots</p>
                        <p className="text-sm font-semibold text-slate-800">{selectedEvent.attendees || 0} / {selectedEvent.maxAttendees} registered</p>
                        <div className="mt-1 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div style={{ width: `${Math.min(100, Math.round(((selectedEvent.attendees || 0) / selectedEvent.maxAttendees) * 100))}%` }} className="h-full bg-jci-blue rounded-full" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                {selectedEvent.description && (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3 mb-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">About</p>
                    <div className={`text-sm text-slate-700 leading-relaxed space-y-2 ${descExpanded ? '' : 'line-clamp-3'}`}>
                      {selectedEvent.description.split(/\n+/).map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                    <button onClick={() => setDescExpanded(v => !v)} className="text-[11px] font-bold text-jci-blue mt-1.5">
                      {descExpanded ? 'Show less' : 'Show more'}
                    </button>
                  </div>
                )}

                {/* Registration Form */}
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-jci-blue rounded-full" />
                  Your Particulars
                </h3>
                <form
                  id="guest-registration-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const { EventsService } = await import('@/services/eventsService');
                      await EventsService.registerGuestForEvent(selectedEvent.id, guestRegistrationData);
                      showToast('Registration submitted successfully! We will contact you soon.', 'success');
                      closeModal();
                    } catch (err) {
                      const errorMessage = err instanceof Error ? err.message : 'Failed to register for event';
                      showToast(errorMessage, 'error');
                    }
                  }}
                  className="space-y-4"
                >
                  {/* Full Name */}
                  <div className="flex flex-row items-center gap-3 sm:gap-6 group">
                    <label className="w-28 sm:w-32 flex-shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-jci-blue transition-colors leading-tight">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="flex-1">
                      <Forms.Input
                        placeholder="e.g. John Doe"
                        value={guestRegistrationData.name}
                        onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, name: e.target.value })}
                        required
                        className="!mb-0"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex flex-row items-center gap-3 sm:gap-6 group">
                    <label className="w-28 sm:w-32 flex-shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-jci-blue transition-colors leading-tight">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="flex-1">
                      <Forms.Input
                        type="email"
                        placeholder="john@example.com"
                        value={guestRegistrationData.email}
                        onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, email: e.target.value })}
                        required
                        className="!mb-0"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="flex flex-row items-center gap-3 sm:gap-6 group">
                    <label className="w-28 sm:w-32 flex-shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-jci-blue transition-colors leading-tight">
                      Contact Number <span className="text-red-500">*</span>
                    </label>
                    <div className="flex-1">
                      <Forms.Input
                        type="tel"
                        placeholder="+60 12-345 6789"
                        value={guestRegistrationData.phone}
                        onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, phone: e.target.value })}
                        required
                        className="!mb-0"
                      />
                    </div>
                  </div>

                  {/* Organization */}
                  <div className="flex flex-row items-center gap-3 sm:gap-6 group">
                    <label className="w-28 sm:w-32 flex-shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-jci-blue transition-colors leading-tight">
                      Organization
                    </label>
                    <div className="flex-1">
                      <Forms.Input
                        placeholder="Company or University"
                        value={guestRegistrationData.organization}
                        onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, organization: e.target.value })}
                        className="!mb-0"
                      />
                    </div>
                  </div>

                  {/* Additional Notes */}
                  <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-6 group">
                    <label className="sm:w-32 flex-shrink-0 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-jci-blue transition-colors leading-tight">
                      Remarks
                    </label>
                    <div className="flex-1 w-full">
                      <Forms.Textarea
                        placeholder="Any special requirements or dietary needs?"
                        value={guestRegistrationData.notes}
                        onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, notes: e.target.value })}
                        rows={2}
                        className="!mb-0"
                      />
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </Modal>
        );
      })()}

      <GuestFooter />
    </div>
  );
};
