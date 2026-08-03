import React, { useState, useMemo } from 'react';
import { Video, Plus, X, ExternalLink, Clock, Calendar, Copy, Check, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Modal, useToast } from '../ui/Common';
import { Input } from '../ui/Form';
import { useAuth } from '../../hooks/useAuth';
import { useZoomBookings } from '../../hooks/useZoomBookings';
import type { ZoomBooking } from '../../types/zoomBooking';

const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const WEEK_DAY_LABELS = ['M','T','W','T','F','S','S'];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-MY', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur',
  });
}

function isFuture(iso: string) {
  return new Date(iso) > new Date();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function buildCalendarWeeks(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const endOffset   = (7 - ((lastDay.getDay() + 6) % 7) - 1 + 7) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const end   = new Date(year, month, lastDay.getDate() + endOffset);
  const weeks: Date[][] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(week);
  }
  return weeks;
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  );
};

export const ZoomBookingView: React.FC = () => {
  const { member, user } = useAuth();
  const { bookings, loading, createBooking, cancelBooking } = useZoomBookings(member?.id ?? '');
  const { showToast } = useToast();

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);
  const [newBooking, setNewBooking] = useState<ZoomBooking | null>(null);

  const minDate = new Date().toISOString().split('T')[0];

  const openModal = (prefilledDate?: string) => {
    setTopic('');
    setDate(prefilledDate ?? '');
    setTime('');
    setDuration(60);
    setNewBooking(null);
    setModalOpen(true);
  };

  const handleCreate = async () => {
    if (!topic.trim() || !date || !time) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    const startTime = new Date(`${date}T${time}:00+08:00`).toISOString();
    if (new Date(startTime) <= new Date()) {
      showToast('Start time must be in the future', 'error');
      return;
    }
    if (!member || !user?.email) {
      showToast('Not authenticated', 'error');
      return;
    }
    setSaving(true);
    try {
      const booking = await createBooking(
        { topic: topic.trim(), startTime, duration },
        { id: member.id, name: member.general?.name ?? member.id, email: user.email }
      );
      setNewBooking(booking);
      showToast('Zoom meeting created!', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to create meeting', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (booking: ZoomBooking) => {
    if (!confirm(`Cancel "${booking.topic}"?`)) return;
    try {
      await cancelBooking(booking);
      showToast('Booking cancelled', 'success');
    } catch {
      showToast('Failed to cancel booking', 'error');
    }
  };

  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const past = bookings.filter(b => b.status === 'cancelled' || !isFuture(b.startTime));

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Video size={20} className="text-jci-blue" /> Zoom Booking
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Schedule a Zoom meeting — you'll be set as alternative host.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => openModal()} className="flex items-center gap-1.5">
            <Plus size={14} /> New Booking
          </Button>
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === 'list' ? 'bg-jci-blue text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <List size={13} /> List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors border-l border-slate-200 ${viewMode === 'calendar' ? 'bg-jci-blue text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Calendar size={13} /> Calendar
            </button>
          </div>
        </div>
      </div>

      {/* Calendar view */}
      {viewMode === 'calendar' && (
        <ZoomBookingCalendar
          bookings={bookings}
          onDateClick={(d) => openModal(d.toISOString().split('T')[0])}
          onBookingClick={(b) => { /* scroll to list or show detail */ }}
        />
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <>
          {/* Upcoming */}
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
          ) : confirmed.filter(b => isFuture(b.startTime)).length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
              <Video size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No upcoming bookings</p>
              <button onClick={() => openModal()} className="mt-3 text-xs text-jci-blue hover:underline">Create your first booking →</button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Upcoming</p>
              {confirmed.filter(b => isFuture(b.startTime)).map(b => (
                <BookingCard key={b.id} booking={b} onCancel={() => handleCancel(b)} />
              ))}
            </div>
          )}

          {/* Past / cancelled */}
          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Past &amp; Cancelled</p>
              {past.map(b => (
                <BookingCard key={b.id} booking={b} past />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="New Zoom Booking"
        size="sm"
        footer={
          newBooking ? (
            <Button variant="primary" className="w-full" onClick={() => setModalOpen(false)}>Done</Button>
          ) : (
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating…' : 'Create Meeting'}
              </Button>
            </div>
          )
        }
      >
        {newBooking ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <Check size={28} className="mx-auto text-green-500 mb-1" />
              <p className="text-sm font-semibold text-green-800">Meeting Created!</p>
              <p className="text-xs text-green-600 mt-0.5">{formatDateTime(newBooking.startTime)} · {newBooking.duration} min</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-500 flex-1 truncate">{newBooking.zoomJoinUrl}</span>
                <CopyButton text={newBooking.zoomJoinUrl} />
                <a href={newBooking.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-slate-200 text-slate-400">
                  <ExternalLink size={13} />
                </a>
              </div>
              {newBooking.zoomPassword && (
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-500">Password:</span>
                  <span className="text-xs font-mono font-semibold text-slate-700 flex-1">{newBooking.zoomPassword}</span>
                  <CopyButton text={newBooking.zoomPassword} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Meeting Topic *"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Mentor Session with John"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Date *</label>
                <input
                  type="date"
                  min={minDate}
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Time *</label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Duration</label>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors ${duration === d ? 'border-jci-blue bg-jci-blue/5 text-jci-blue' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    {d < 60 ? `${d}m` : `${d / 60}h`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const BookingCard: React.FC<{ booking: ZoomBooking; onCancel?: () => void; past?: boolean }> = ({ booking, onCancel, past }) => (
  <div className={`rounded-xl border p-4 space-y-3 ${past ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200'}`}>
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-slate-900">{booking.topic}</p>
        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          <Calendar size={11} /> {formatDateTime(booking.startTime)}
          <span className="mx-1">·</span>
          <Clock size={11} /> {booking.duration} min
        </p>
      </div>
      {!past && onCancel && (
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors shrink-0">
          <X size={14} />
        </button>
      )}
      {booking.status === 'cancelled' && (
        <span className="text-[10px] font-semibold text-red-400 bg-red-50 px-2 py-0.5 rounded-full shrink-0">Cancelled</span>
      )}
    </div>
    {booking.status === 'confirmed' && (
      <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
        <span className="text-xs text-slate-500 flex-1 truncate">{booking.zoomJoinUrl}</span>
        <CopyButton text={booking.zoomJoinUrl} />
        <a href={booking.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-slate-200 text-slate-400">
          <ExternalLink size={13} />
        </a>
      </div>
    )}
  </div>
);

const ZoomBookingCalendar: React.FC<{
  bookings: ZoomBooking[];
  onDateClick: (date: Date) => void;
  onBookingClick: (booking: ZoomBooking) => void;
}> = ({ bookings, onDateClick, onBookingClick }) => {
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);

  const calendarWeeks = useMemo(
    () => buildCalendarWeeks(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  const navigateMonth = (dir: 'prev' | 'next') =>
    setCurrentDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1)); return d; });

  const getBookingsForDate = (date: Date) =>
    bookings.filter(b => isSameDay(new Date(b.startTime), date));

  const selectedDateBookings = selectedDate ? getBookingsForDate(selectedDate) : [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-2 py-3 gap-0.5">
        <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center select-none">
          <span className="text-xl font-black tracking-widest text-slate-900">{MONTH_ABBR[currentDate.getMonth()]}</span>
          <span className="ml-2 text-sm font-medium text-slate-400">{currentDate.getFullYear()}</span>
        </div>
        <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => { setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); }}
          className="ml-1 w-7 h-7 border-2 border-slate-300 rounded-md flex items-center justify-center text-xs font-black text-slate-600 hover:border-jci-blue hover:text-jci-blue transition-colors"
          title="Go to today"
        >{today.getDate()}</button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 px-2 pb-1 border-b border-slate-100">
        {WEEK_DAY_LABELS.map((label, i) => (
          <div key={i} className={`text-center text-[11px] font-bold py-0.5 ${i === 6 ? 'text-red-400' : 'text-slate-400'}`}>
            {label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="px-2 pt-1 pb-2">
        {calendarWeeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 mb-0.5">
            {week.map((date, di) => {
              const dayBookings = getBookingsForDate(date);
              const isToday_ = isSameDay(date, today);
              const isSelected = !!selectedDate && isSameDay(date, selectedDate);
              const inMonth = date.getMonth() === currentDate.getMonth();
              const isSunday = di === 6;

              return (
                <div
                  key={di}
                  className="flex flex-col items-center pt-1 pb-0.5 cursor-pointer group"
                  onClick={() => { setSelectedDate(date); }}
                >
                  <div className={[
                    'w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-bold transition-colors leading-none mb-0.5',
                    isToday_ ? 'bg-jci-blue text-white'
                      : isSelected ? 'bg-slate-200 text-slate-900'
                      : isSunday ? (inMonth ? 'text-red-400 group-hover:bg-red-50' : 'text-red-200')
                      : inMonth ? 'text-slate-800 group-hover:bg-slate-100' : 'text-slate-300',
                  ].join(' ')}>
                    {date.getDate()}
                  </div>
                  <div className="w-full px-0.5 space-y-0.5">
                    {dayBookings.slice(0, 2).map(b => (
                      <div
                        key={b.id}
                        onClick={(e) => { e.stopPropagation(); onBookingClick(b); }}
                        className={[
                          'w-full text-[8px] font-semibold truncate px-1 py-[1px] rounded-sm leading-tight cursor-pointer',
                          b.status === 'cancelled' ? 'bg-slate-300 text-slate-600 opacity-50' : 'bg-jci-blue text-white',
                          !inMonth ? 'opacity-40' : '',
                        ].join(' ')}
                        title={b.topic}
                      >{b.topic}</div>
                    ))}
                    {dayBookings.length > 2 && (
                      <span className="text-[8px] text-slate-400 pl-0.5 leading-none">+{dayBookings.length - 2}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected date panel */}
      {selectedDate && (
        <div className="border-t border-slate-100">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/70">
            <span className="text-base font-black text-slate-900">{selectedDate.getDate()}</span>
            <span className="text-sm font-semibold text-slate-400">
              {selectedDate.toLocaleDateString('en', { weekday: 'long' })}
            </span>
            {isSameDay(selectedDate, today) && (
              <span className="ml-auto text-[10px] font-bold bg-jci-blue/10 text-jci-blue px-2 py-0.5 rounded-full">Today</span>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {selectedDateBookings.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-5">No bookings on this day</p>
            ) : (
              selectedDateBookings.map(b => (
                <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0">
                  <div className={`w-1 h-10 rounded-full shrink-0 ${b.status === 'cancelled' ? 'bg-slate-300' : 'bg-jci-blue'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{b.topic}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(b.startTime).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' })} · {b.duration} min
                      {b.status === 'cancelled' && <span className="ml-2 text-red-400">Cancelled</span>}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          {selectedDate >= new Date(new Date().toDateString()) && (
            <div className="px-4 py-3">
              <button
                className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 flex items-center justify-center gap-1.5 transition-colors"
                onClick={() => onDateClick(selectedDate)}
              >
                Book on {selectedDate.toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                <span className="text-base leading-none font-black ml-0.5">+</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
