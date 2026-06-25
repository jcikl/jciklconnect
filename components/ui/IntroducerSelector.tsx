import React, { useState, useEffect } from 'react';
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
        <div className="space-y-2 p-2 bg-slate-50 border border-slate-200 rounded-lg animate-in slide-in-from-top-1 duration-150">
          <input
            type="text"
            placeholder="Search JCI KL member..."
            value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1 text-xs focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
          />
          <select
            value={detail}
            onChange={(e) => handleDetailChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
          >
            <option value="">Select Member...</option>
            {filteredMembers.map(m => (
              <option key={m.id} value={m.id}>{m.name || m.fullName}</option>
            ))}
          </select>
        </div>
      )}

      {type === 'event' && (
        <div className="space-y-2 p-2 bg-slate-50 border border-slate-200 rounded-lg animate-in slide-in-from-top-1 duration-150">
          <input
            type="text"
            placeholder="Search event/project..."
            value={eventSearch}
            onChange={e => setEventSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1 text-xs focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
          />
          <select
            value={detail}
            onChange={(e) => handleDetailChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
          >
            <option value="">Select Project/Event...</option>
            {filteredProjects.map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
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
