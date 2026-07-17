import React from 'react';
import { Search, Calendar, Briefcase, Building2 } from 'lucide-react';

// Generate an inline SVG data URI with initials — avoids external ui-avatars.com requests blocked by CSP
const getInitialsSvg = (name: string, size = 36): string => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#0097D7" rx="${size / 2}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="sans-serif" font-size="${Math.round(size * 0.4)}px">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};
import { useMembers } from '../../hooks/useMembers';
import { useEvents } from '../../hooks/useEvents';
import { useProjects } from '../../hooks/useProjects';
import { useBusinessDirectory } from '../../hooks/useBusinessDirectory';
import { ViewType } from '../../types';

export const SearchDropdown: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onNavigate: (view: ViewType, selectedId?: string) => void;
}> = ({ isOpen, onClose, searchQuery, onNavigate }) => {
  const { members } = useMembers();
  const { events } = useEvents();
  const { projects } = useProjects();
  const { businesses } = useBusinessDirectory();

  const q = searchQuery.toLowerCase().trim();
  const filteredMembers = q ? members.filter(m =>
    (m.name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q)
  ).slice(0, 4) : [];
  const filteredEvents = q ? events.filter(e =>
    (e.title || '').toLowerCase().includes(q)
  ).slice(0, 3) : [];
  const filteredProjects = q ? projects.filter(p =>
    (p.name || '').toLowerCase().includes(q)
  ).slice(0, 3) : [];
  const filteredBusinesses = q ? businesses.filter(b =>
    (b.companyName || '').toLowerCase().includes(q) || (b.industry || '').toLowerCase().includes(q)
  ).slice(0, 3) : [];

  const total = filteredMembers.length + filteredEvents.length + filteredProjects.length + filteredBusinesses.length;
  const hasQuery = q.length > 0;

  if (!isOpen) return null;

  const SectionLabel = ({ color, label }: { color: string; label: string }) => (
    <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    </div>
  );

  const ResultRow = ({ icon, title, meta, onClick }: { icon: React.ReactNode; title: string; meta: string; onClick: () => void }) => (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-jci-blue/5 active:bg-jci-blue/10 transition-colors group text-left">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-slate-800 truncate group-hover:text-jci-blue transition-colors leading-tight">{title}</p>
        <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">{meta}</p>
      </div>
    </button>
  );

  return (
    <div className="fixed inset-x-3 top-14 z-[49] mx-auto max-w-md" style={{ animation: 'searchDropIn 0.22s cubic-bezier(0.16,1,0.3,1) both' }}>
      <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 border border-slate-100 overflow-hidden">
        {hasQuery && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <span className="text-[11px] text-slate-400">
              {total > 0
                ? <><span className="font-bold text-slate-700">{total}</span> result{total !== 1 ? 's' : ''} for <span className="font-semibold text-jci-blue">"{searchQuery}"</span></>
                : <>No results for <span className="font-semibold text-slate-600">"{searchQuery}"</span></>
              }
            </span>
            <span className="text-[10px] text-slate-300 hidden sm:block">Esc to close</span>
          </div>
        )}
        <div className="max-h-[60vh] overflow-y-auto">
          {!hasQuery && (
            <div className="flex flex-col items-center py-8 gap-2 text-slate-400">
              <Search size={22} className="opacity-20" />
              <p className="text-[13px]">Search members, events, projects…</p>
            </div>
          )}
          {hasQuery && total === 0 && (
            <div className="flex flex-col items-center py-8 gap-2 text-slate-400">
              <Search size={22} className="opacity-20" />
              <p className="text-[13px]">Nothing found</p>
            </div>
          )}
          {filteredMembers.length > 0 && (
            <div>
              <SectionLabel color="bg-purple-400" label="Members" />
              {filteredMembers.map(m => (
                <ResultRow key={m.id}
                  onClick={() => { onNavigate('MEMBERS', m.id); onClose(); }}
                  icon={<img src={m.avatar || getInitialsSvg(m.name || '')} className="w-9 h-9 rounded-xl object-cover" alt="" />}
                  title={m.name}
                  meta={m.email}
                />
              ))}
            </div>
          )}
          {filteredEvents.length > 0 && (
            <div className={filteredMembers.length > 0 ? 'border-t border-slate-50' : ''}>
              <SectionLabel color="bg-jci-blue" label="Events" />
              {filteredEvents.map(e => (
                <ResultRow key={e.id}
                  onClick={() => { onNavigate('EVENTS', e.id); onClose(); }}
                  icon={e.imageUrl ? <img src={e.imageUrl} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" /> : <div className="w-9 h-9 rounded-xl bg-blue-50 text-jci-blue flex items-center justify-center"><Calendar size={16} /></div>}
                  title={e.title}
                  meta={new Date(e.date).toLocaleDateString()}
                />
              ))}
            </div>
          )}
          {filteredProjects.length > 0 && (
            <div className={(filteredMembers.length > 0 || filteredEvents.length > 0) ? 'border-t border-slate-50' : ''}>
              <SectionLabel color="bg-green-400" label="Projects" />
              {filteredProjects.map(p => (
                <ResultRow key={p.id}
                  onClick={() => { onNavigate('PROJECTS', p.id); onClose(); }}
                  icon={p.logoUrl ? <img src={p.logoUrl} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" /> : <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center"><Briefcase size={16} /></div>}
                  title={p.name || p.title || ''}
                  meta={p.status}
                />
              ))}
            </div>
          )}
          {filteredBusinesses.length > 0 && (
            <div className={total > filteredBusinesses.length ? 'border-t border-slate-50' : ''}>
              <SectionLabel color="bg-indigo-400" label="Directory" />
              {filteredBusinesses.map(b => (
                <ResultRow key={b.id}
                  onClick={() => { onNavigate('DIRECTORY', b.id); onClose(); }}
                  icon={<div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center"><Building2 size={16} /></div>}
                  title={b.companyName || ''}
                  meta={b.industry || ''}
                />
              ))}
            </div>
          )}
          {hasQuery && total > 0 && <div className="h-2" />}
        </div>
      </div>
    </div>
  );
};
