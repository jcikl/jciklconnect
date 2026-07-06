import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { Member, Project } from '../../types';

interface IntroducerSelectorProps {
  value: string;
  onChange: (value: string) => void;
  members: Member[];
  projects: Project[];
  className?: string;
}

export const IntroducerSelector: React.FC<IntroducerSelectorProps> = ({
  value,
  onChange,
  members,
  projects,
  className = ''
}) => {
  const [type, setType] = useState<string>('direct');
  const [detail, setDetail] = useState<string>('');
  const [memberSearch, setMemberSearch] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [memberOpen, setMemberOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [memberHighlight, setMemberHighlight] = useState(0);
  const [eventHighlight, setEventHighlight] = useState(0);
  const [memberDropdownRect, setMemberDropdownRect] = useState<DOMRect | null>(null);
  const [eventDropdownRect, setEventDropdownRect] = useState<DOMRect | null>(null);

  const memberContainerRef = useRef<HTMLDivElement>(null);
  const eventContainerRef = useRef<HTMLDivElement>(null);
  const memberListRef = useRef<HTMLUListElement>(null);
  const eventListRef = useRef<HTMLUListElement>(null);

  const openMemberDropdown = () => {
    if (memberContainerRef.current) {
      setMemberDropdownRect(memberContainerRef.current.getBoundingClientRect());
    }
    setMemberOpen(true);
    setMemberSearch('');
  };

  const openEventDropdown = () => {
    if (eventContainerRef.current) {
      setEventDropdownRect(eventContainerRef.current.getBoundingClientRect());
    }
    setEventOpen(true);
    setEventSearch('');
  };

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        memberContainerRef.current && !memberContainerRef.current.contains(t) &&
        memberListRef.current && !memberListRef.current.contains(t)
      ) {
        setMemberOpen(false);
      }
      if (
        eventContainerRef.current && !eventContainerRef.current.contains(t) &&
        eventListRef.current && !eventListRef.current.contains(t)
      ) {
        setEventOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Parse the initial value when it changes externally
  useEffect(() => {
    const cleanVal = (value || '').trim();
    if (!cleanVal) {
      setType('direct');
      setDetail('');
      return;
    }

    if (cleanVal.toLowerCase() === 'friend') {
      setType('friend');
      setDetail('');
      return;
    }

    if (cleanVal.toLowerCase() === 'direct join') {
      setType('direct');
      setDetail('');
      return;
    }

    const socialMatch = cleanVal.match(/^Social Media \(([^)]+)\)$/i);
    if (socialMatch) {
      setType('social_media');
      setDetail(socialMatch[1]);
      return;
    }

    const eventMatch = cleanVal.match(/^Event:\s*(.+)$/i);
    if (eventMatch) {
      setType('event');
      setDetail(eventMatch[1]);
      return;
    }

    // Check if it is a member ID or name
    const foundMember = members.find(m => 
      m.id.toLowerCase() === cleanVal.toLowerCase() ||
      (m.name && m.name.trim().toLowerCase() === cleanVal.toLowerCase()) ||
      (m.fullName && m.fullName.trim().toLowerCase() === cleanVal.toLowerCase())
    );

    if (foundMember) {
      setType('member');
      setDetail(foundMember.id);
      return;
    }

    // Default to direct/others
    setType('direct');
    setDetail(cleanVal);
  }, [value, members]);

  // Update parent when type or detail changes
  const handleTypeChange = (newType: string) => {
    setType(newType);
    setMemberSearch('');
    setEventSearch('');
    setMemberOpen(false);
    setEventOpen(false);

    if (newType === 'friend') {
      onChange('Friend');
    } else if (newType === 'direct') {
      onChange(detail || 'Direct Join');
    } else if (newType === 'social_media') {
      onChange(`Social Media (Facebook)`); // default detail
      setDetail('Facebook');
    } else if (newType === 'member') {
      onChange(''); // wait for selection
      setDetail('');
    } else if (newType === 'event') {
      onChange(''); // wait for selection
      setDetail('');
    }
  };

  const handleDetailChange = (newDetail: string) => {
    setDetail(newDetail);
    if (type === 'social_media') {
      onChange(`Social Media (${newDetail})`);
    } else if (type === 'member') {
      onChange(newDetail); // Stores member ID
    } else if (type === 'event') {
      onChange(`Event: ${newDetail}`); // Stores Event Name
    } else if (type === 'direct') {
      onChange(newDetail || 'Direct Join');
    }
  };

  const INTRODUCER_TYPES = [
    { label: 'Friend', value: 'friend' },
    { label: 'Social Media', value: 'social_media' },
    { label: 'JCI KL Member', value: 'member' },
    { label: 'Chapter Event / Project', value: 'event' },
    { label: 'Direct Join / Others', value: 'direct' }
  ];

  const SOCIAL_PLATFORMS = [
    'Facebook', 'Instagram', 'Google', 'YouTube', 'LinkedIn', 'Xiaohongshu (XHS)', 'Tiktok', 'Others'
  ];

  const sortedMembers = [...members].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const filteredMembers = sortedMembers.filter(m => 
    (m.name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
    (m.fullName || '').toLowerCase().includes(memberSearch.toLowerCase())
  );

  const sortedProjects = [...projects].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const filteredProjects = sortedProjects.filter(p => 
    (p.name || '').toLowerCase().includes(eventSearch.toLowerCase())
  );

  const selectedMember = members.find(m => m.id === detail);

  return (
    <div className={`space-y-3 w-full ${className}`}>
      <select
        value={type}
        onChange={(e) => handleTypeChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
      >
        {INTRODUCER_TYPES.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {type === 'social_media' && (
        <select
          value={detail}
          onChange={(e) => handleDetailChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white animate-in slide-in-from-top-1 duration-150"
        >
          {SOCIAL_PLATFORMS.map(platform => (
            <option key={platform} value={platform}>{platform}</option>
          ))}
        </select>
      )}

      {type === 'member' && (
        <div ref={memberContainerRef} className="relative w-full animate-in slide-in-from-top-1 duration-150">
          <div className="relative">
            <input
              type="text"
              placeholder="Search JCI KL member..."
              value={memberOpen ? memberSearch : (selectedMember ? (selectedMember.name || selectedMember.fullName) : '')}
              onChange={(e) => {
                setMemberSearch(e.target.value);
                if (memberContainerRef.current) setMemberDropdownRect(memberContainerRef.current.getBoundingClientRect());
                setMemberOpen(true);
                setMemberHighlight(0);
              }}
              onFocus={openMemberDropdown}
              className="w-full rounded-lg border border-slate-300 pl-3 pr-10 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown size={16} />
            </div>
          </div>
          {memberOpen && memberDropdownRect && createPortal(
            <ul
              ref={memberListRef}
              style={{ position: 'fixed', top: memberDropdownRect.bottom + 4, left: memberDropdownRect.left, width: memberDropdownRect.width, zIndex: 9999 }}
              className="max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1"
            >
              {filteredMembers.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-500">No members found</li>
              ) : (
                filteredMembers.map((m, i) => (
                  <li
                    key={m.id}
                    className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                      i === memberHighlight ? 'bg-jci-blue/10 text-jci-navy' : 'text-slate-700 hover:bg-slate-50'
                    } ${detail === m.id ? 'font-bold' : ''}`}
                    onMouseEnter={() => setMemberHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleDetailChange(m.id);
                      setMemberOpen(false);
                      setMemberSearch('');
                    }}
                  >
                    {m.name || m.fullName}
                  </li>
                ))
              )}
            </ul>,
            document.body
          )}
        </div>
      )}

      {type === 'event' && (
        <div ref={eventContainerRef} className="relative w-full animate-in slide-in-from-top-1 duration-150">
          <div className="relative">
            <input
              type="text"
              placeholder="Search event/project..."
              value={eventOpen ? eventSearch : detail}
              onChange={(e) => {
                setEventSearch(e.target.value);
                if (eventContainerRef.current) setEventDropdownRect(eventContainerRef.current.getBoundingClientRect());
                setEventOpen(true);
                setEventHighlight(0);
              }}
              onFocus={openEventDropdown}
              className="w-full rounded-lg border border-slate-300 pl-3 pr-10 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown size={16} />
            </div>
          </div>
          {eventOpen && eventDropdownRect && createPortal(
            <ul
              ref={eventListRef}
              style={{ position: 'fixed', top: eventDropdownRect.bottom + 4, left: eventDropdownRect.left, width: eventDropdownRect.width, zIndex: 9999 }}
              className="max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1"
            >
              {filteredProjects.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-500">No events found</li>
              ) : (
                filteredProjects.map((p, i) => (
                  <li
                    key={p.id}
                    className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                      i === eventHighlight ? 'bg-jci-blue/10 text-jci-navy' : 'text-slate-700 hover:bg-slate-50'
                    } ${detail === p.name ? 'font-bold' : ''}`}
                    onMouseEnter={() => setEventHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleDetailChange(p.name);
                      setEventOpen(false);
                      setEventSearch('');
                    }}
                  >
                    {p.name}
                  </li>
                ))
              )}
            </ul>,
            document.body
          )}
        </div>
      )}

      {type === 'direct' && (
        <input
          type="text"
          placeholder="Please specify source..."
          value={detail}
          onChange={(e) => handleDetailChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 animate-in slide-in-from-top-1 duration-150"
        />
      )}
    </div>
  );
};
