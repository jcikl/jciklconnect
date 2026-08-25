import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SocialPost } from '../../../types/socialPost';
import { SOCIAL_POST_STATUS_LABELS } from '../../../types/socialPost';
import { PLATFORM_ICONS, STATUS_COLORS } from './socialMediaUi';

const MONTH_ABBR_SM = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DAY_FULL_SM = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const WEEK_DAY_LABELS_SM = ['M','T','W','T','F','S','S'];

function getISOWeekSM(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
}

function isSameDaySM(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildCalendarWeeksSM(year: number, month: number): Date[][] {
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

interface SocialCalendarViewProps {
  posts: SocialPost[];
  onSelect: (post: SocialPost) => void;
}

export const SocialCalendarView: React.FC<SocialCalendarViewProps> = ({ posts, onSelect }) => {
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);

  const calendarWeeks = useMemo(
    () => buildCalendarWeeksSM(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  const navigateMonth = (dir: 'prev' | 'next') => {
    setCurrentDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1)); return d; });
  };

  const getPostsForDate = (date: Date) =>
    posts.filter(post => {
      const dateStr = post.scheduledAt ?? post.createdAt;
      return dateStr && isSameDaySM(new Date(dateStr), date);
    });

  const selectedDatePosts = selectedDate ? getPostsForDate(selectedDate) : [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center px-2 py-3 gap-0.5">
        <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center select-none">
          <span className="text-xl font-black tracking-widest text-slate-900">{MONTH_ABBR_SM[currentDate.getMonth()]}</span>
          <span className="ml-2 text-sm font-medium text-slate-400">{currentDate.getFullYear()}</span>
        </div>
        <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => { setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); }}
          className="ml-1 w-7 h-7 border-2 border-slate-300 rounded-md flex items-center justify-center text-xs font-black text-slate-600 hover:border-jci-blue hover:text-jci-blue transition-colors"
          title="Go to today"
        >
          {today.getDate()}
        </button>
      </div>

      <div className="grid grid-cols-[24px_repeat(7,1fr)] px-2 pb-1 border-b border-slate-100">
        <div />
        {WEEK_DAY_LABELS_SM.map((label, i) => (
          <div key={i} className={`text-center text-[11px] font-bold py-0.5 ${i === 6 ? 'text-red-400' : 'text-slate-400'}`}>{label}</div>
        ))}
      </div>

      <div className="px-2 pt-1 pb-2">
        {calendarWeeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-[24px_repeat(7,1fr)] mb-0.5">
            <div className="flex items-start justify-center pt-2.5">
              <span className="text-[9px] text-slate-300 font-bold select-none leading-none">{getISOWeekSM(week[0])}</span>
            </div>
            {week.map((date, di) => {
              const dayPosts  = getPostsForDate(date);
              const isToday_  = isSameDaySM(date, today);
              const isSelected = !!selectedDate && isSameDaySM(date, selectedDate);
              const inMonth   = date.getMonth() === currentDate.getMonth();
              const isSunday  = di === 6;
              return (
                <div
                  key={di}
                  className="flex flex-col items-center pt-1 pb-0.5 cursor-pointer group"
                  onClick={() => setSelectedDate(date)}
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
                    {dayPosts.slice(0, 2).map(post => (
                      <div
                        key={post.id}
                        onClick={e => { e.stopPropagation(); onSelect(post); }}
                        className={`w-full text-[8px] font-semibold truncate px-1 py-[1px] rounded-sm leading-tight cursor-pointer ${STATUS_COLORS[post.status]} ${!inMonth ? 'opacity-40' : ''}`}
                        title={post.title}
                      >
                        {post.title}
                      </div>
                    ))}
                    {dayPosts.length > 2 && (
                      <span className="text-[8px] text-slate-400 pl-0.5 leading-none">+{dayPosts.length - 2}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {selectedDate && (
        <div className="border-t border-slate-100">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/70">
            <span className="text-base font-black text-slate-900">{selectedDate.getDate()}</span>
            <span className="text-sm font-semibold text-slate-400">{DAY_FULL_SM[selectedDate.getDay()]}</span>
            {isSameDaySM(selectedDate, today) && (
              <span className="ml-auto text-[10px] font-bold bg-jci-blue/10 text-jci-blue px-2 py-0.5 rounded-full">Today</span>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto">
            {selectedDatePosts.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-5">No posts on this day</p>
            ) : (
              selectedDatePosts.map(post => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                  onClick={() => onSelect(post)}
                >
                  <div className={`w-1 h-10 rounded-full shrink-0 ${STATUS_COLORS[post.status].replace('text-', 'bg-').split(' ')[0]}`} />
                  <div className={`w-10 h-10 rounded-xl shrink-0 flex flex-col items-center justify-center text-center ${STATUS_COLORS[post.status]}`}>
                    <span className="text-[8px] font-bold leading-none uppercase">{MONTH_ABBR_SM[selectedDate.getMonth()]}</span>
                    <span className="text-sm font-black leading-tight">{selectedDate.getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{post.title}</p>
                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[post.status]}`}>{SOCIAL_POST_STATUS_LABELS[post.status]}</span>
                      {post.platforms.map(p => <span key={p}>{PLATFORM_ICONS[p]}</span>)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
