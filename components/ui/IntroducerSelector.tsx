import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { Member, Project } from '../../types';

interface IntroducerSelectorProps {
  value: string;
  onChange: (value: string) => void;
  members: Member[];
  projects: Project[];
  className?: string;
}

const SOCIAL_PLATFORMS = [
  'Facebook', 'Instagram', 'Google', 'YouTube', 'LinkedIn', 'Xiaohongshu (XHS)', 'Tiktok', 'Others'
];

const TYPES = [
  { value: 'friend',       label: 'Friend',                 hasDetail: false },
  { value: 'social_media', label: 'Social Media',           hasDetail: true  },
  { value: 'member',       label: 'JCI KL Member',          hasDetail: true  },
  { value: 'event',        label: 'Chapter Event / Project', hasDetail: true  },
  { value: 'direct',       label: 'Direct Join / Others',   hasDetail: true  },
];

function parseValue(val: string, members: Member[]) {
  const v = (val || '').trim();
  if (!v || v.toLowerCase() === 'direct join') return { type: 'direct', detail: '' };
  if (v.toLowerCase() === 'friend') return { type: 'friend', detail: '' };
  const social = v.match(/^Social Media \(([^)]+)\)$/i);
  if (social) return { type: 'social_media', detail: social[1] };
  const event = v.match(/^Event:\s*(.+)$/i);
  if (event) return { type: 'event', detail: event[1] };
  const found = members.find(m =>
    m.id.toLowerCase() === v.toLowerCase() ||
    (m.name || '').trim().toLowerCase() === v.toLowerCase() ||
    (m.fullName || '').trim().toLowerCase() === v.toLowerCase()
  );
  if (found) return { type: 'member', detail: found.id };
  return { type: 'direct', detail: v };
}

function buildValue(type: string, detail: string): string {
  if (type === 'friend') return 'Friend';
  if (type === 'direct') return detail || 'Direct Join';
  if (type === 'social_media') return `Social Media (${detail || 'Facebook'})`;
  if (type === 'member') return detail;
  if (type === 'event') return detail ? `Event: ${detail}` : '';
  return '';
}

function displayLabel(type: string, detail: string, members: Member[]): string {
  if (type === 'friend') return 'Friend';
  if (type === 'direct') return detail || 'Direct Join / Others';
  if (type === 'social_media') return `Social Media · ${detail || 'Facebook'}`;
  if (type === 'member') {
    const m = members.find(x => x.id === detail);
    return m ? `Member · ${m.name || m.fullName}` : 'JCI KL Member';
  }
  if (type === 'event') return detail ? `Event · ${detail}` : 'Chapter Event / Project';
  return '';
}

export const IntroducerSelector: React.FC<IntroducerSelectorProps> = ({
  value,
  onChange,
  members,
  projects,
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('direct');
  const [detail, setDetail] = useState('');
  const [search, setSearch] = useState('');
  const [rect, setRect] = useState<DOMRect | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string | null>(null);

  // Parse incoming value
  useEffect(() => {
    if (lastEmittedRef.current === value) { lastEmittedRef.current = null; return; }
    const parsed = parseValue(value, members);
    setType(parsed.type);
    setDetail(parsed.detail);
  }, [value, members]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        panelRef.current && !panelRef.current.contains(t)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const emit = (t: string, d: string) => {
    const v = buildValue(t, d);
    lastEmittedRef.current = v;
    onChange(v);
  };

  const openPanel = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setSearch('');
    setOpen(true);
  };

  const selectType = (newType: string) => {
    if (newType === type) return;
    setType(newType);
    setDetail('');
    setSearch('');
    if (newType === 'friend') {
      emit('friend', '');
      setOpen(false);
    } else if (newType === 'direct') {
      emit('direct', '');
    } else if (newType === 'social_media') {
      setDetail('Facebook');
      emit('social_media', 'Facebook');
    }
    // member/event: keep panel open for second level
  };

  const selectDetail = (d: string) => {
    setDetail(d);
    emit(type, d);
    setOpen(false);
    setSearch('');
  };

  const sortedMembers = [...members].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const filteredMembers = sortedMembers.filter(m =>
    (m.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.fullName || '').toLowerCase().includes(search.toLowerCase())
  );
  const sortedProjects = [...projects].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const filteredProjects = sortedProjects.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const label = displayLabel(type, detail, members);
  const hasSecondLevel = ['social_media', 'member', 'event', 'direct'].includes(type);

  const panel = open && rect ? createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: hasSecondLevel ? Math.max(rect.width, 480) : Math.max(rect.width, 220),
        zIndex: 9999,
      }}
      className="rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden flex"
    >
      {/* Left: type list */}
      <div className="w-48 shrink-0 border-r border-slate-100 py-1">
        {TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); selectType(t.value); }}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left
              ${type === t.value
                ? 'bg-jci-blue/10 text-jci-navy font-medium'
                : 'text-slate-700 hover:bg-slate-50'
              }`}
          >
            <span>{t.label}</span>
            {t.hasDetail && <ChevronRight size={14} className="text-slate-400 shrink-0" />}
          </button>
        ))}
      </div>

      {/* Right: second-level */}
      {hasSecondLevel && (
        <div className="flex-1 flex flex-col min-w-0 py-1">
          {/* Social Media */}
          {type === 'social_media' && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Platform</div>
              {SOCIAL_PLATFORMS.map(p => (
                <button
                  key={p}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectDetail(p); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors
                    ${detail === p ? 'bg-jci-blue/10 text-jci-navy font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Member search */}
          {type === 'member' && (
            <div className="flex flex-col h-full">
              <div className="px-3 pt-2 pb-1">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search member..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                />
              </div>
              <div className="overflow-auto max-h-52 py-1">
                {filteredMembers.length === 0
                  ? <div className="px-3 py-2 text-sm text-slate-400">No members found</div>
                  : filteredMembers.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectDetail(m.id); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors
                        ${detail === m.id ? 'bg-jci-blue/10 text-jci-navy font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      {m.name || m.fullName}
                    </button>
                  ))
                }
              </div>
            </div>
          )}

          {/* Event/Project search */}
          {type === 'event' && (
            <div className="flex flex-col h-full">
              <div className="px-3 pt-2 pb-1">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search event / project..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                />
              </div>
              <div className="overflow-auto max-h-52 py-1">
                {filteredProjects.length === 0
                  ? <div className="px-3 py-2 text-sm text-slate-400">No events found</div>
                  : filteredProjects.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectDetail(p.name); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors
                        ${detail === p.name ? 'bg-jci-blue/10 text-jci-navy font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      {p.name}
                    </button>
                  ))
                }
              </div>
            </div>
          )}

          {/* Direct / Others */}
          {type === 'direct' && (
            <div className="px-3 pt-2">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-2">Specify source (optional)</div>
              <input
                autoFocus
                type="text"
                placeholder="e.g. Referral, Walk-in..."
                value={detail}
                onChange={e => {
                  setDetail(e.target.value);
                  emit('direct', e.target.value);
                }}
                onMouseDown={e => e.stopPropagation()}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setOpen(false); } }}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
              />
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setOpen(false); }}
                className="mt-2 w-full py-1.5 rounded-lg bg-jci-blue text-white text-sm font-medium hover:bg-jci-navy transition-colors"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className={`w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPanel}
        className="w-full flex items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-left focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 transition-colors hover:border-slate-400"
      >
        <span className={label ? 'text-slate-900' : 'text-slate-400'}>
          {label || 'Select introducer...'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setType('direct');
                setDetail('');
                lastEmittedRef.current = '';
                onChange('');
              }}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {panel}
    </div>
  );
};
