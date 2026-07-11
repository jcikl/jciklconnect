import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, AlertTriangle, Gift, Sparkles, X } from 'lucide-react';
import { Notification } from '../../types';

export const NotificationDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => Promise<void>;
}> = ({ isOpen, onClose, notifications, onMarkAsRead }) => {
  const [visible, setVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      if (!markedRef.current) {
        markedRef.current = true;
        notifications
          .filter(n => !n.read && !n.id.startsWith('birthday-'))
          .forEach(n => onMarkAsRead(n.id).catch(() => {}));
      }
    } else {
      markedRef.current = false;
      const t = setTimeout(() => setVisible(false), 320);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => { dragStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e: React.TouchEvent) => {
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0 && scrollTop === 0) setDragY(delta);
  };
  const handleTouchEnd = () => { if (dragY > 90) onClose(); setDragY(0); };

  const isBirthday = (note: Notification) =>
    note.title.toLowerCase().includes('birthday') || note.id.startsWith('birthday-');

  const noteIcon = (note: Notification) => {
    if (note.type === 'ai') return { icon: <Sparkles size={15} />, bg: 'bg-violet-100', fg: 'text-violet-600', accent: 'bg-violet-400' };
    if (note.type === 'warning') return { icon: <AlertTriangle size={15} />, bg: 'bg-amber-100', fg: 'text-amber-600', accent: 'bg-amber-400' };
    if (isBirthday(note)) return { icon: <Gift size={15} />, bg: 'bg-pink-100', fg: 'text-pink-500', accent: 'bg-pink-400' };
    return { icon: <Bell size={15} />, bg: 'bg-sky-100', fg: 'text-jci-blue', accent: 'bg-jci-blue' };
  };

  const fmtTime = (ts: string) => {
    if (!ts || ts === 'Today') return 'Today';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (!visible && !isOpen) return null;

  const sheetStyle: React.CSSProperties = {
    transform: `translateY(${dragY > 0 ? dragY : isOpen ? 0 : '100%'}px)`,
    transition: dragY > 0 ? 'none' : isOpen ? 'transform 0.35s cubic-bezier(0.32,0.72,0,1)' : 'transform 0.28s cubic-bezier(0.4,0,1,1)',
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[54] bg-black/40 backdrop-blur-[2px]"
        style={{ opacity: isOpen ? 1 : 0, transition: 'opacity 0.3s ease', pointerEvents: isOpen ? 'auto' : 'none' }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[55] flex flex-col rounded-t-[28px] bg-white shadow-2xl md:left-auto md:right-0 md:top-0 md:bottom-0 md:w-96 md:rounded-none md:rounded-l-2xl"
        style={sheetStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="md:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-9 h-1 rounded-full bg-slate-300/80" />
        </div>
        <div className="shrink-0 px-5 pt-2 pb-4 md:pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-black text-slate-900">Notifications</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 active:scale-95 transition-all">
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <div className="h-px bg-slate-100 shrink-0 mx-5" />
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(88vh - 100px)' }}>
          {(() => {
            if (notifications.length === 0) {
              return (
                <div className="flex flex-col items-center py-16 gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Bell size={26} className="text-slate-300" />
                  </div>
                  <p className="text-[14px] font-bold text-slate-400">All caught up!</p>
                  <p className="text-[12px] text-slate-300 text-center max-w-[200px] leading-relaxed">No notifications right now.</p>
                </div>
              );
            }

            const groupKey = (ts: string) => {
              if (!ts || ts === 'Today') return 'Today';
              const d = new Date(ts);
              if (isNaN(d.getTime())) return 'Today';
              const now = new Date();
              const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
              if (diffDays === 0) return 'Today';
              if (diffDays === 1) return 'Yesterday';
              return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
            };

            const groups: { label: string; items: Notification[] }[] = [];
            notifications.forEach(note => {
              const label = groupKey(note.timestamp);
              const existing = groups.find(g => g.label === label);
              if (existing) existing.items.push(note);
              else groups.push({ label, items: [note] });
            });

            const typeLabel = (note: Notification) => {
              if (note.type === 'ai') return 'AI Insights';
              if (note.type === 'warning') return 'Alerts';
              if (isBirthday(note)) return 'Birthdays';
              return 'General';
            };
            const typeOrder = ['Alerts', 'AI Insights', 'General', 'Birthdays'];

            return groups.map(group => {
              const typeGroups: { label: string; items: Notification[] }[] = [];
              group.items.forEach(note => {
                const tl = typeLabel(note);
                const existing = typeGroups.find(g => g.label === tl);
                if (existing) existing.items.push(note);
                else typeGroups.push({ label: tl, items: [note] });
              });
              typeGroups.sort((a, b) => typeOrder.indexOf(a.label) - typeOrder.indexOf(b.label));

              return (
                <div key={group.label} className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">{group.label}</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  <div className="space-y-4">
                    {typeGroups.map(tg => (
                      <div key={tg.label}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-2 px-1">{tg.label}</p>
                        <div className="space-y-2">
                          {tg.items.map(note => {
                            const { icon, bg, fg, accent } = noteIcon(note);
                            return (
                              <div key={note.id} className="relative rounded-2xl overflow-hidden bg-white shadow-sm shadow-slate-200/60 border border-slate-100">
                                <div className={`absolute top-0 left-0 right-0 h-[2px] ${accent} opacity-50`} />
                                <div className="px-4 pt-3.5 pb-3.5">
                                  <div className="flex items-start gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg} ${fg}`}>{icon}</div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[12px] leading-relaxed text-slate-600">{note.message.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim()}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
          <div className="h-20 md:h-4" />
        </div>
      </div>
    </>,
    document.body
  );
};
