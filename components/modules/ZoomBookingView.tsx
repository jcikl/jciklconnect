import React, { useState, useMemo } from 'react';
import { Video, Plus, X, ExternalLink, Clock, Calendar, Copy, Check, List, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { Button, Modal, Tabs, PageScaffold, useToast } from '../ui/Common';
import { ViewToggle } from '../ui/ViewToggle';
import { Input } from '../ui/Form';
import { useAuth } from '../../hooks/useAuth';
import { useZoomBookings } from '../../hooks/useZoomBookings';
import type { ZoomBooking } from '../../types/zoomBooking';

function minutesToTimeStr(m: number) {
  return `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
}
function formatDuration(m: number) {
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 && min > 0 ? `${h}h ${min}m` : h > 0 ? `${h}h` : `${min}m`;
}
function fmtTime(m: number) {
  return new Date(`2000-01-01T${minutesToTimeStr(m)}:00`).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const THUMB = [
  'absolute w-full h-full appearance-none bg-transparent pointer-events-none',
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none',
  '[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full',
  '[&::-webkit-slider-thumb]:bg-[#1C3F94] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer',
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4',
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#1C3F94]',
  '[&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer',
].join(' ');

const TimeRangeSlider: React.FC<{
  start: number; end: number;
  onStartChange: (v: number) => void; onEndChange: (v: number) => void;
  occupied?: { start: number; end: number; label?: string }[];
}> = ({ start, end, onStartChange, onEndChange, occupied = [] }) => {
  const MAX = 1410, STEP = 30;
  const sp = (start / MAX) * 100, ep = (end / MAX) * 100;
  return (
    <div className="relative h-6 flex items-center">
      <div className="absolute w-full h-2 bg-slate-200 rounded-full" />
      {/* Occupied slots — shown as red segments beneath the active range */}
      {occupied.map((slot, i) => (
        <div key={i} title={slot.label}
          className="absolute h-2 bg-red-400 rounded-full opacity-70"
          style={{ left: `${(slot.start / MAX) * 100}%`, width: `${((slot.end - slot.start) / MAX) * 100}%` }} />
      ))}
      {/* Active selection */}
      <div className="absolute h-2 bg-jci-blue rounded-full"
        style={{ left: `${sp}%`, width: `${ep - sp}%` }} />
      <input type="range" min={0} max={MAX} step={STEP} value={start} className={THUMB}
        onChange={e => onStartChange(Math.min(Number(e.target.value), end - STEP))} />
      <input type="range" min={0} max={MAX} step={STEP} value={end} className={THUMB}
        onChange={e => onEndChange(Math.max(Number(e.target.value), start + STEP))} />
    </div>
  );
};
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
  const { bookings, loading, createBooking, cancelBooking, updateBooking } = useZoomBookings(member?.id ?? '');
  const { showToast } = useToast();

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [listTab, setListTab] = useState<'upcoming' | 'past'>('upcoming');
  const [modalOpen, setModalOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState('');
  const [timeMinutes, setTimeMinutes] = useState(540); // 09:00 default
  const [endMinutes, setEndMinutes] = useState(600);   // 10:00 default
  const [saving, setSaving] = useState(false);
  const [newBooking, setNewBooking] = useState<ZoomBooking | null>(null);
  const [editingBooking, setEditingBooking] = useState<ZoomBooking | null>(null);

  const minDate = new Date().toISOString().split('T')[0];

  const openModal = (prefilledDate?: string) => {
    setTopic('');
    setDate(prefilledDate ?? '');
    setTimeMinutes(540);
    setEndMinutes(600);
    setNewBooking(null);
    setEditingBooking(null);
    setModalOpen(true);
  };

  const openEditModal = (booking: ZoomBooking) => {
    const dt = new Date(booking.startTime);
    const localDate = dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); // YYYY-MM-DD
    const localH = parseInt(dt.toLocaleString('en-MY', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kuala_Lumpur' }));
    const localM = dt.getMinutes();
    setTopic(booking.topic);
    setDate(localDate);
    const startM = Math.round((localH * 60 + localM) / 30) * 30;
    setTimeMinutes(startM);
    setEndMinutes(Math.min(1410, startM + booking.duration));
    setNewBooking(null);
    setEditingBooking(booking);
    setModalOpen(true);
  };

  const handleCreate = async () => {
    if (!topic.trim() || !date) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    const duration = endMinutes - timeMinutes;
    const startTime = new Date(`${date}T${minutesToTimeStr(timeMinutes)}:00+08:00`).toISOString();
    if (new Date(startTime) <= new Date()) {
      showToast('Start time must be in the future', 'error');
      return;
    }
    const newStart = new Date(startTime).getTime();
    const newEnd = newStart + duration * 60000;
    const conflict = bookings.find(b =>
      b.status === 'confirmed' && b.id !== editingBooking?.id &&
      newStart < new Date(b.startTime).getTime() + b.duration * 60000 &&
      newEnd > new Date(b.startTime).getTime()
    );
    if (conflict) {
      showToast(`Time conflicts with "${conflict.topic}" (${formatDateTime(conflict.startTime)})`, 'error');
      return;
    }
    if (!member || !user?.email) {
      showToast('Not authenticated', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingBooking) {
        await updateBooking(
          editingBooking,
          { topic: topic.trim(), startTime, duration },
          { id: member.id, name: member.general?.name ?? member.id, email: user.email }
        );
        showToast('Zoom meeting updated!', 'success');
        setModalOpen(false);
      } else {
        const booking = await createBooking(
          { topic: topic.trim(), startTime, duration },
          { id: member.id, name: member.general?.name ?? member.id, email: user.email }
        );
        setNewBooking(booking);
        showToast('Zoom meeting created!', 'success');
      }
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to save meeting', 'error');
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

  const occupiedSlots = useMemo(() => {
    if (!date) return [];
    return bookings
      .filter(b => b.status === 'confirmed' && b.id !== editingBooking?.id)
      .filter(b => new Date(b.startTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }) === date)
      .map(b => {
        const d = new Date(b.startTime);
        const h = parseInt(d.toLocaleString('en-MY', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kuala_Lumpur' }));
        const startM = h * 60 + d.getMinutes();
        return { start: startM, end: Math.min(1410, startM + b.duration), label: b.topic };
      });
  }, [date, bookings, editingBooking]);

  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const past = bookings.filter(b => b.status === 'cancelled' || !isFuture(b.startTime));

  return (
    <>
      <PageScaffold
        title="Zoom Booking"
        actions={
          <ViewToggle
            options={[
              { id: 'list', icon: <List size={14} />, label: 'List' },
              { id: 'calendar', icon: <Calendar size={14} />, label: 'Calendar' },
            ]}
            value={viewMode}
            onChange={v => setViewMode(v as 'list' | 'calendar')}
          />
        }
        className="max-w-2xl mx-auto"
        contentClassName="space-y-6"
      >
        {/* Calendar view */}
        {viewMode === 'calendar' && (
          <ZoomBookingCalendar
            bookings={bookings}
            onDateClick={(d) => openModal(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }))}
            onBookingClick={(b) => { /* scroll to list or show detail */ }}
          />
        )}

        {/* List view */}
        {viewMode === 'list' && (
          <>
          <Tabs
            tabs={[
              { id: 'upcoming', label: 'Upcoming', badge: confirmed.filter(b => isFuture(b.startTime)).length > 0 ? <span className="bg-white/30 text-xs rounded-full px-1.5 py-0.5 font-bold">{confirmed.filter(b => isFuture(b.startTime)).length}</span> : undefined },
              { id: 'past', label: 'Past & Cancelled', badge: past.length > 0 ? <span className="bg-white/30 text-xs rounded-full px-1.5 py-0.5 font-bold">{past.length}</span> : undefined },
            ]}
            activeTab={listTab}
            onTabChange={t => setListTab(t as 'upcoming' | 'past')}
            fullWidth
          />

          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
          ) : listTab === 'upcoming' ? (
            <div className="space-y-3">
              {/* New Booking Row */}
              <button
                onClick={() => openModal()}
                className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 text-slate-400 hover:border-jci-blue hover:text-jci-blue transition-colors group"
              >
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-current flex items-center justify-center group-hover:bg-jci-blue/5 transition-colors">
                  <Plus size={14} />
                </div>
                <span className="text-sm font-medium">New Booking</span>
              </button>
              {confirmed.filter(b => isFuture(b.startTime)).length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Video size={28} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm">No upcoming bookings</p>
                </div>
              ) : (
                confirmed.filter(b => isFuture(b.startTime)).map(b => (
                  <BookingCard key={b.id} booking={b} onCancel={b.memberId === member?.id ? () => handleCancel(b) : undefined} onEdit={b.memberId === member?.id ? () => openEditModal(b) : undefined} />
                ))
              )}
            </div>
          ) : (
            past.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Clock size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm">No past or cancelled bookings</p>
              </div>
            ) : (
              <div className="space-y-2">
                {past.map(b => (
                  <BookingCard key={b.id} booking={b} past />
                ))}
              </div>
            )
          )}
          </>
        )}
      </PageScaffold>

      {/* Create Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingBooking ? 'Edit Zoom Booking' : 'New Zoom Booking'}
        size="sm"
        footer={
          newBooking ? (
            <Button variant="primary" className="w-full" onClick={() => setModalOpen(false)}>Done</Button>
          ) : (
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={handleCreate} disabled={saving}>
                {saving ? (editingBooking ? 'Updating…' : 'Creating…') : (editingBooking ? 'Update Meeting' : 'Create Meeting')}
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-600">Time *</label>
                <span className="text-sm font-semibold text-jci-blue tabular-nums">
                  {fmtTime(timeMinutes)} – {fmtTime(endMinutes)}
                  <span className="ml-1.5 text-xs font-normal text-slate-400">({formatDuration(endMinutes - timeMinutes)})</span>
                </span>
              </div>
              <TimeRangeSlider
                start={timeMinutes} end={endMinutes}
                onStartChange={setTimeMinutes} onEndChange={setEndMinutes}
                occupied={occupiedSlots}
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11:30 PM</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

const BookingCard: React.FC<{ booking: ZoomBooking; onCancel?: () => void; onEdit?: () => void; past?: boolean }> = ({ booking, onCancel, onEdit, past }) => (
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
      {!past && (
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-colors">
              <Pencil size={13} />
            </button>
          )}
          {onCancel && (
            <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      )}
      {booking.status === 'cancelled' && (
        <span className="text-[10px] font-semibold text-red-400 bg-red-50 px-2 py-0.5 rounded-full shrink-0">Cancelled</span>
      )}
    </div>
    {booking.status === 'confirmed' && (
      <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
        <span className="text-xs text-slate-500 flex-1 truncate">{booking.zoomJoinUrl}</span>
        <CopyButton text={(() => {
          const start = new Date(booking.startTime);
          const end = new Date(start.getTime() + booking.duration * 60000);
          const dateFmt = start.toLocaleDateString('en-MY', { dateStyle: 'long', timeZone: 'Asia/Kuala_Lumpur' });
          const timeFmt = (d: Date) => d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuala_Lumpur' });
          return `${booking.topic}\nDate: ${dateFmt}\nTime: ${timeFmt(start)} - ${timeFmt(end)}\n${booking.zoomJoinUrl}`;
        })()} />
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
                      {new Date(b.startTime).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' })} – {new Date(new Date(b.startTime).getTime() + b.duration * 60000).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' })} · {formatDuration(b.duration)}
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
