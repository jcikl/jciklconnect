import React, { useState, useEffect, useMemo } from 'react';
import { Users, Briefcase, Sparkles, Award, Clock, ChevronDown } from 'lucide-react';
import { Button, Card } from '@/components/ui/Common';
import { BoardManagementService } from '@/services/boardManagementService';
import { GuestHeader } from '@/components/layout/GuestHeader';
import { GuestFooter } from '@/components/layout/GuestFooter';

export const GuestAboutPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => void;
}) => {
  const timelineEvents = [
    { year: '1953', title: 'JCI Kuala Lumpur was Initiated', description: 'Initiated by JC Frank Wakerman in 1953 followed up by President JC Wong Peng Tuck.' },
    { year: '1954', title: 'JCI Kuala Lumpur was Formed', description: 'JCI Kuala Lumpur ("JCI KL") is the first Malaysia Junior Chamber Chapter that was formed in 1954.' },
    { year: '1980s', title: 'JCI Asia Pacific Conference', description: 'JCI Kuala Lumpur hosted JCI Asia Pacific Conference under our Past President, JCI Sen. Loh Yit Lock as Conference Director.' },
    { year: '1980s', title: '1st JCI MALAYSIA National Convention', description: 'Past President, Robert Ng as Conference Director.' },
    { year: '1984', title: '2nd JCI Asia Pacific Conference', description: 'During our 30th Anniversary, JCI Kuala Lumpur was the Hosting Chapter for JCI Asia Pacific Conference held in Genting Highlands Resort under our Past President JCI Sen. Larry Koh as Conference Director.' },
    { year: '1990s', title: 'JCI National Convention', description: 'We hosted the National Convention.' },
    { year: '2000s', title: 'Area Peninsular Malaysia Convention', description: 'We hosted the Area Peninsular Malaysia Convention.' },
    { year: '2010s', title: 'JCI National Convention', description: 'We hosted the National Convention.' },
    { year: '2019', title: 'JCI Malaysia National Convention Best of the Best', description: 'Under leadership of President Thomas Chin and BODs, JCI Kuala Lumpur awarded the award in JCI Malaysia National Convention at Kuching.' },
    { year: '2020s', title: 'JCI Malaysia Area Central South Convention', description: '' },
    { year: '2023', title: 'JCI Malaysia National Convention Best of the Best', description: 'Under leadership of President Chris Teng and BODs, JCI Kuala Lumpur awarded the award in JCI Malaysia National Convention at Sabah.' },
    { year: '2024', title: 'Program NextGen awarded as Best of the Best Project in JCI World Congress', description: '' },
  ];

  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));
  const [boardMembers, setBoardMembers] = useState<any[]>([]);
  const [loadingBoard, setLoadingBoard] = useState<boolean>(true);
  const [currentTermGroupPhoto, setCurrentTermGroupPhoto] = useState<string | null>(null);

  useEffect(() => {
    BoardManagementService.getBoardTermSettings(String(new Date().getFullYear()))
      .then(s => { if (s?.groupPhotoUrl) setCurrentTermGroupPhoto(s.groupPhotoUrl); })
      .catch(() => { });
  }, []);

  // Available years: from JCI KL's founding year to the current calendar year.
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years = [];
    for (let y = currentYear; y >= 1954; y--) {
      years.push(String(y));
    }
    return years;
  }, [currentYear]);

  const getMockBoardData = (year: string) => {
    const data: Record<string, Array<{ position: string; name: string; avatar?: string; company?: string }>> = {
      '2026': [
        { position: 'President', name: 'Eric Wong', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', company: 'TechNova Solutions' },
        { position: 'Immediate Past President', name: 'Chris Teng', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', company: 'Teng Holdings' },
        { position: 'Secretary', name: 'Lim Mei Kee', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', company: 'Lumina PR' },
        { position: 'Honorary Treasurer', name: 'Tan Ka Yi', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80', company: 'Nexus Advisory' },
        { position: 'General Legal Counsel', name: 'Nicholas Chew', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', company: 'Chew & Partners' },
        { position: 'Executive Vice President', name: 'Chong Wei Sheng', avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&auto=format&fit=crop&q=80', company: 'Apex Ventures' },
        { position: 'Vice President (Individual)', name: 'Jessie Liew', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', company: 'Bright Horizons' },
        { position: 'Vice President (Community)', name: 'Marcus Wong', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80', company: 'GreenEarth Co.' },
        { position: 'Vice President (Business)', name: 'Alvin Tan', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', company: 'ScaleUp Consulting' },
        { position: 'Vice President (International Affairs)', name: 'Derrick Lim', avatar: 'https://images.unsplash.com/photo-1489980508314-941910ded1f4?w=150&auto=format&fit=crop&q=80', company: 'Global Bridge Inc.' },
        { position: 'Vice President (LOM)', name: 'Cheah Kok Wai', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', company: 'Synergy Labs' },
      ],
      '2025': [
        { position: 'President', name: 'Chris Teng', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', company: 'Teng Holdings' },
        { position: 'Immediate Past President', name: 'Thomas Chin', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', company: 'Chin & Associates' },
        { position: 'Secretary', name: 'Jane Doe', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', company: 'JCI Kuala Lumpur' },
        { position: 'Honorary Treasurer', name: 'John Smith', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', company: 'Capital Partners' },
        { position: 'General Legal Counsel', name: 'Alice Johnson', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', company: 'Apex Legal' },
        { position: 'Executive Vice President', name: 'Bob Brown', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', company: 'Brown Enterprises' },
        { position: 'Vice President (Individual)', name: 'Sarah Connor', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', company: 'Cyberdyne Systems' },
        { position: 'Vice President (Community)', name: 'Michael Scott', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', company: 'Dunder Mifflin' },
        { position: 'Vice President (Business)', name: 'David Brent', avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&auto=format&fit=crop&q=80', company: 'Wernham Hogg' },
        { position: 'Vice President (International Affairs)', name: 'Emma Watson', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80', company: 'HeForShe' },
        { position: 'Vice President (LOM)', name: 'Ryan Gosling', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80', company: 'Kenergy Ltd' },
      ],
      '2024': [
        { position: 'President', name: 'Alex Rivera', avatar: 'https://i.pravatar.cc/150?u=alex', company: 'Rivera Growth Co.' },
        { position: 'Immediate Past President', name: 'Jessica Day', avatar: 'https://i.pravatar.cc/150?u=jessica', company: 'Day Strategies' },
        { position: 'Secretary', name: 'Sarah Chen', avatar: 'https://i.pravatar.cc/150?u=sarah', company: 'Chen Events' },
        { position: 'Honorary Treasurer', name: 'Michael Ross', avatar: 'https://i.pravatar.cc/150?u=michael', company: 'Pearson Specter' },
        { position: 'General Legal Counsel', name: 'Harvey Specter', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', company: 'Specter Litt' },
        { position: 'Executive Vice President', name: 'Louis Litt', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', company: 'Litt & Partners' },
        { position: 'Vice President (Individual)', name: 'Donna Paulsen', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', company: 'Donna Corp' },
        { position: 'Vice President (Community)', name: 'Rachel Zane', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80', company: 'Zane Legal' },
        { position: 'Vice President (Business)', name: 'Mike Ross', avatar: 'https://i.pravatar.cc/150?u=michael', company: 'Ross Advisory' },
        { position: 'Vice President (International Affairs)', name: 'Katrina Bennett', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', company: 'Bennett Global' },
        { position: 'Vice President (LOM)', name: 'Samantha Wheeler', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', company: 'Wheeler Media' },
      ],
      '2023': [
        { position: 'President', name: 'Chris Teng', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', company: 'Teng Holdings' },
        { position: 'Immediate Past President', name: 'Thomas Chin', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', company: 'Chin & Associates' },
        { position: 'Secretary', name: 'Jane Doe', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', company: 'JCI Kuala Lumpur' },
        { position: 'Honorary Treasurer', name: 'John Smith', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', company: 'Capital Partners' },
        { position: 'General Legal Counsel', name: 'Alice Johnson', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', company: 'Apex Legal' },
        { position: 'Executive Vice President', name: 'Bob Brown', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', company: 'Brown Enterprises' },
        { position: 'Vice President (Individual)', name: 'Sarah Connor', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', company: 'Cyberdyne Systems' },
        { position: 'Vice President (Community)', name: 'Michael Scott', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', company: 'Dunder Mifflin' },
        { position: 'Vice President (Business)', name: 'David Brent', avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&auto=format&fit=crop&q=80', company: 'Wernham Hogg' },
        { position: 'Vice President (International Affairs)', name: 'Emma Watson', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80', company: 'HeForShe' },
        { position: 'Vice President (LOM)', name: 'Ryan Gosling', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80', company: 'Kenergy Ltd' },
      ]
    };
    return data[year] || data['2026'];
  };

  useEffect(() => {
    let active = true;
    const fetchBoard = async () => {
      setLoadingBoard(true);
      try {
        const termMembers = await BoardManagementService.getBoardMembersByYear(selectedYear);

        if (!active) return;

        const activeBoard = termMembers.filter(m => m.isActive);
        if (activeBoard.length > 0) {
          const mapped = activeBoard.map((bm) => ({
            position: bm.position,
            name: bm.memberName || 'JCI Member',
            avatar: bm.boardAvatarUrl || bm.avatarUrl,
            company: bm.companyName || 'JCI Kuala Lumpur',
            commissionDirectors: (bm.commissionDirectorIds || []).map(id => ({
              id,
              name: bm.commissionDirectorNames?.[id] || 'JCI Member',
              avatar: bm.commissionDirectorAvatars?.[id] || '',
            })),
          }));
          setBoardMembers(mapped);
        } else {
          setBoardMembers(getMockBoardData(selectedYear));
        }
      } catch (err) {
        console.error('Error fetching board members:', err);
        if (active) {
          setBoardMembers(getMockBoardData(selectedYear));
        }
      } finally {
        if (active) {
          setLoadingBoard(false);
        }
      }
    };

    fetchBoard();
    return () => {
      active = false;
    };
  }, [selectedYear]);

  // Tree lookup helpers
  const president = boardMembers.find(bm => (bm.position || '').toLowerCase() === 'president');
  const ipp = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('past president') || pos.includes('ipp');
  });
  const secretary = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('secretary') && !pos.includes('vice');
  });
  const treasurer = boardMembers.find(bm => (bm.position || '').toLowerCase().includes('treasurer'));
  const glc = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('legal counsel') || pos.includes('legal council') || pos.includes('glc');
  });
  const evp = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('executive vice') || pos.includes('evp');
  });
  const vpIndividual = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('vice president') && (pos.includes('individual') || pos.includes('ind'));
  });
  const vpCommunity = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('vice president') && (pos.includes('community') || pos.includes('com'));
  });
  const vpBusiness = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('vice president') && (pos.includes('business') || pos.includes('bus'));
  });
  const vpInternational = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('vice president') && (pos.includes('international') || pos.includes('int'));
  });
  const vpLom = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('vice president') && (pos.includes('lom') || pos.includes('local organisation') || pos.includes('local organization'));
  });

  const BoardNode = ({ member, defaultRole, variant = 'default' }: {
    member?: any;
    defaultRole: string;
    variant?: 'default' | 'president' | 'ipp' | 'vp';
  }) => {
    const name = member?.name || 'Vacant';
    const role = member?.position || defaultRole;
    const avatar = member?.avatar;
    const company = member?.company || 'JCI Kuala Lumpur';
    const commissionDirectors: Array<{ id: string; name: string; avatar: string }> = member?.commissionDirectors || [];

    const AvatarCircle = ({ src, label, size }: { src?: string; label: string; size: string }) =>
      src ? (
        <img src={src} alt={label} className={`${size} rounded-full object-cover border border-white/40 shadow-sm`} />
      ) : (
        <div className={`${size} rounded-full bg-white/20 flex items-center justify-center`}>
          <span className="font-bold text-white/60 text-xs">{label.charAt(0)}</span>
        </div>
      );

    if (variant === 'president') {
      return (
        <div className="relative bg-gradient-to-br from-jci-navy to-jci-blue text-white rounded-3xl p-6 md:p-8 flex items-center gap-5 md:gap-7 shadow-xl shadow-jci-blue/25 overflow-hidden w-full max-w-2xl mx-auto group hover:shadow-2xl hover:shadow-jci-blue/30 transition-all">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/[0.04] rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-white/[0.04] rounded-full translate-y-1/2 pointer-events-none" />
          <div className="shrink-0 relative z-10">
            {avatar ? (
              <img src={avatar} alt={name} className="w-20 h-20 md:w-28 md:h-28 rounded-2xl object-cover border-2 border-white/25 shadow-xl" />
            ) : (
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center">
                <span className="text-4xl font-black text-white/40">{name.charAt(0)}</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 relative z-10">
            <span className="inline-block text-[9px] font-black uppercase tracking-widest bg-white/15 border border-white/20 px-3 py-1 rounded-full mb-2.5">President {selectedYear}</span>
            <h3 className="text-xl md:text-2xl font-black leading-tight mb-1">{name}</h3>
            <p className="text-sky-200/80 text-sm truncate">{company}</p>
            {commissionDirectors.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {commissionDirectors.map(dir => (
                  <div key={dir.id} className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full pl-0.5 pr-2.5 py-0.5">
                    <AvatarCircle src={dir.avatar} label={dir.name} size="w-5 h-5" />
                    <span className="text-[10px] text-white/75 font-medium max-w-[80px] truncate">{dir.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (variant === 'ipp') {
      return (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-4 flex items-center gap-4 w-full max-w-xl mx-auto hover:border-slate-300 hover:shadow-md transition-all group">
          <div className="shrink-0">
            {avatar ? (
              <img src={avatar} alt={name} className="w-14 h-14 rounded-xl object-cover border border-slate-200 group-hover:border-jci-blue/30 transition-colors" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                <span className="text-lg font-bold text-slate-300">{name.charAt(0)}</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-block text-[8px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full mb-1">Immediate Past President</span>
            <h4 className="font-bold text-slate-800 text-sm leading-tight truncate">{name}</h4>
            <p className="text-[11px] text-slate-400 truncate">{company}</p>
          </div>
        </div>
      );
    }

    if (variant === 'vp') {
      const shortRole = role.replace('Vice President', 'VP');
      return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-jci-blue/25 transition-all p-4 flex items-start gap-3.5 h-full group">
          <div className="shrink-0 mt-0.5">
            {avatar ? (
              <img src={avatar} alt={name} className="w-12 h-12 rounded-xl object-cover border border-slate-100 group-hover:border-jci-blue/30 transition-colors" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-100 flex items-center justify-center">
                <span className="text-base font-bold text-slate-300">{name.charAt(0)}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-jci-blue mb-0.5 truncate">{shortRole}</p>
            <h4 className="font-bold text-slate-900 text-sm truncate">{name}</h4>
            <p className="text-[11px] text-slate-400 truncate mb-0">{company}</p>
            {commissionDirectors.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Commission Directors</p>
                <div className="flex flex-wrap gap-1.5">
                  {commissionDirectors.map(dir => (
                    <div key={dir.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-full pl-0.5 pr-2 py-0.5">
                      {dir.avatar ? (
                        <img src={dir.avatar} alt={dir.name} className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">{dir.name.charAt(0)}</div>
                      )}
                      <span className="text-[10px] font-medium text-slate-600 max-w-[90px] truncate">{dir.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // default — Secretary, Treasurer, GLC, EVP
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md hover:border-jci-blue/25 transition-all flex flex-col items-center text-center w-full h-full group">
        <div className="mb-3">
          {avatar ? (
            <img src={avatar} alt={name} className="w-14 h-14 rounded-xl object-cover border-2 border-slate-100 shadow-sm group-hover:border-jci-blue/20 transition-colors" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-slate-100 border-2 border-slate-100 flex items-center justify-center">
              <span className="text-xl font-bold text-slate-300">{name.charAt(0)}</span>
            </div>
          )}
        </div>
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-jci-blue mb-0.5 w-full truncate px-1">{role}</p>
        <h4 className="font-bold text-slate-900 text-sm mb-0.5 line-clamp-1">{name}</h4>
        <p className="text-[11px] text-slate-400 line-clamp-1">{company}</p>
        {commissionDirectors.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 w-full">
            <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Commission Directors</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {commissionDirectors.map(dir => (
                <div key={dir.id} className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-full pl-0.5 pr-1.5 py-0.5">
                  {dir.avatar ? (
                    <img src={dir.avatar} alt={dir.name} className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">{dir.name.charAt(0)}</div>
                  )}
                  <span className="text-[9px] font-medium text-slate-600 max-w-[60px] truncate">{dir.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <GuestHeader currentPage="about" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        <section className="relative py-14 md:py-20 bg-gradient-to-br from-jci-navy via-[#1a3d7c] to-jci-blue overflow-hidden" aria-label="Page header">
          <div className="absolute top-0 right-0 w-96 h-96 bg-jci-blue/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest mb-3">Est. 1954 · Kuala Lumpur</p>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4">About JCI Kuala Lumpur</h1>
            <p className="text-blue-200 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              The first Malaysia Junior Chamber Chapter, empowering young active citizens to create positive change since 1954.
            </p>
          </div>
        </section>

        {/* JCI Kuala Lumpur Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-6">JCI Kuala Lumpur</h2>
                <div className="h-1 w-20 bg-jci-blue mb-6"></div>
                <p className="text-lg text-slate-600 leading-relaxed mb-4">
                  JCI Kuala Lumpur ("JCI KL") is the first Malaysia Junior Chamber Chapter formed in 1954,
                  initiated by JC Frank Wakerman in 1953 followed up by President JC Wong Peng Tuck.
                </p>
                <p className="text-lg text-slate-600 leading-relaxed mb-6">
                  We inspire young people to recognize their responsibility to create a better world and
                  empower them to drive change.
                </p>
                <div className="h-1 w-20 bg-jci-blue mb-6"></div>
                <Button variant="outline" onClick={() => window.location.href = '/contact'}>
                  Contact Us
                </Button>
              </div>
              <div className="rounded-2xl h-96 overflow-hidden">
                {currentTermGroupPhoto ? (
                  <img
                    src={currentTermGroupPhoto}
                    alt="JCI Kuala Lumpur Board of Directors"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="bg-gradient-to-br from-jci-navy to-jci-blue w-full h-full p-8 flex items-center justify-center">
                    <img
                      src="/JCI Kuala Lumpur-transparent.png"
                      alt="JCI Kuala Lumpur"
                      className="max-w-full max-h-full object-contain opacity-90"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* JCI Creed, Mission, Vision */}
        <section className="py-16 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-8">
              {/* JCI Creed - Full Width on Top */}
              <Card className="bg-white">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-6">JCI Creed</h3>
                  <ul className="space-y-4 text-slate-600">
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">•</span>
                      <span>That faith in God gives meaning and purpose to human life;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">•</span>
                      <span>That the brotherhood of man transcends the sovereignty of nations;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">•</span>
                      <span>That economic justice can best be won by free men through free enterprise;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">•</span>
                      <span>That government should be of laws rather than of men;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">•</span>
                      <span>That earth's great treasure lies in human personality;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">•</span>
                      <span>And that service to humanity is the best work of life.</span>
                    </li>
                  </ul>
                </div>
              </Card>

              {/* JCI Mission and Vision - Side by Side Below */}
              <div className="grid md:grid-cols-2 gap-8">
                <Card className="bg-white">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-6">JCI Mission</h3>
                    <p className="text-lg text-slate-600 leading-relaxed">
                      To provide development opportunities that empower young people to create positive change.
                    </p>
                  </div>
                </Card>

                <Card className="bg-white">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-6">JCI Vision</h3>
                    <p className="text-lg text-slate-600 leading-relaxed">
                      To be the leading global network of young active citizens.
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Board of Directors */}
        <section className="py-16 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-12">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Board of Directors</h2>
                <p className="text-slate-500 text-sm mt-1">Meet the leaders driving positive impact in Kuala Lumpur</p>
              </div>
              <label className="flex flex-col gap-1.5 self-start md:self-auto">
                <span className="text-[10px] font-black uppercase tracking-wider text-jci-blue">Board Year</span>
                <div className="relative rounded-2xl bg-gradient-to-r from-jci-blue to-jci-lightblue p-[1px] shadow-sm shadow-jci-blue/10">
                  <select
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(event.target.value)}
                    className="appearance-none min-w-[156px] rounded-2xl border-0 bg-white px-4 py-2.5 pr-10 text-sm font-black text-slate-900 outline-none transition-all cursor-pointer hover:bg-sky-50 focus:ring-2 focus:ring-jci-blue/20"
                    aria-label="Select board year"
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-jci-blue">
                    <ChevronDown size={16} strokeWidth={3} />
                  </div>
                </div>
              </label>
            </div>

            {loadingBoard ? (
              <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-jci-blue mb-4"></div>
                <p className="text-slate-500 text-sm font-semibold">Loading Board Directory...</p>
              </div>
            ) : (
              <div className="space-y-10">
                {/* Level 1: President + IPP */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-10">
                  <div className="w-full sm:flex-1 max-w-md">
                    <BoardNode member={president} defaultRole="President" variant="president" />
                  </div>
                  <div className="hidden sm:flex flex-col items-center gap-1 shrink-0">
                    <div className="w-12 h-px border-t-2 border-dashed border-slate-300" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-full">Support</span>
                  </div>
                  <div className="w-full sm:w-auto">
                    <BoardNode member={ipp} defaultRole="Immediate Past President" variant="ipp" />
                  </div>
                </div>

                {/* Connector */}
                <div className="hidden lg:block w-px h-8 bg-gradient-to-b from-jci-blue/30 to-transparent mx-auto" />

                {/* Level 2: Secretary, Treasurer, GLC, EVP */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
                  <BoardNode member={secretary} defaultRole="Secretary" />
                  <BoardNode member={treasurer} defaultRole="Honorary Treasurer" />
                  <BoardNode member={glc} defaultRole="General Legal Counsel" />
                  <div className="relative">
                    <div className="absolute -inset-px bg-gradient-to-br from-jci-blue/20 to-sky-400/20 rounded-2xl blur-sm" />
                    <div className="relative h-full">
                      <BoardNode member={evp} defaultRole="Executive Vice President" />
                    </div>
                  </div>
                </div>

                {/* Connector */}
                <div className="hidden lg:block w-px h-8 bg-gradient-to-b from-transparent via-slate-300/60 to-transparent mx-auto" />

                {/* Level 3: VPs */}
                <div className="rounded-3xl bg-slate-50/60 border border-slate-200/60 p-6 sm:p-8 mx-auto">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1 h-px bg-slate-200/80" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-jci-blue px-3 py-1 bg-sky-50 border border-sky-100/80 rounded-full shrink-0">Vice Presidents</span>
                    <div className="flex-1 h-px bg-slate-200/80" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                    <BoardNode member={vpIndividual} defaultRole="Vice President (Individual)" variant="vp" />
                    <BoardNode member={vpCommunity} defaultRole="Vice President (Community)" variant="vp" />
                    <BoardNode member={vpBusiness} defaultRole="Vice President (Business)" variant="vp" />
                    <BoardNode member={vpInternational} defaultRole="Vice President (International Affairs)" variant="vp" />
                    <BoardNode member={vpLom} defaultRole="Vice President (LOM)" variant="vp" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Our Story Over The Years */}
        <section className="py-16 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">
              Our Story <span className="text-jci-blue">Over The Years</span>
            </h2>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-jci-blue/20 transform md:-translate-x-1/2"></div>

              <div className="space-y-8">
                {timelineEvents.map((event, index) => (
                  <div key={index} className="relative flex items-start md:items-center">
                    {/* Timeline dot */}
                    <div className="absolute left-6 md:left-1/2 w-4 h-4 bg-jci-blue rounded-full border-4 border-white shadow-md transform md:-translate-x-1/2 z-10"></div>

                    {/* Content */}
                    <div className={`ml-16 md:ml-0 md:w-1/2 ${index % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:ml-auto md:pl-12'}`}>
                      <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 mb-2">
                          <Clock size={18} className="text-jci-blue" />
                          <span className="text-sm font-semibold text-jci-blue">{event.year}</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">{event.title}</h3>
                        {event.description && (
                          <p className="text-slate-600">{event.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* What We Do */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">What We Do</h2>
            <div className="grid md:grid-cols-4 gap-6">
              <Card>
                <div className="p-4">
                  <div className="w-12 h-12 bg-jci-blue/10 text-jci-blue rounded-lg flex items-center justify-center mb-4">
                    <Users size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Leadership Development</h3>
                  <p className="text-slate-600">
                    We provide training and opportunities for members to develop leadership skills through
                    hands-on experience in project management and community service.
                  </p>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="w-12 h-12 bg-jci-blue/10 text-jci-blue rounded-lg flex items-center justify-center mb-4">
                    <Briefcase size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Community Projects</h3>
                  <p className="text-slate-600">
                    Our members lead and participate in various community service projects that address
                    local needs and create lasting positive impact.
                  </p>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="w-12 h-12 bg-jci-blue/10 text-jci-blue rounded-lg flex items-center justify-center mb-4">
                    <Sparkles size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Networking</h3>
                  <p className="text-slate-600">
                    Connect with like-minded young professionals and entrepreneurs from diverse backgrounds
                    and industries, both locally and internationally.
                  </p>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="w-12 h-12 bg-jci-blue/10 text-jci-blue rounded-lg flex items-center justify-center mb-4">
                    <Award size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Personal Growth</h3>
                  <p className="text-slate-600">
                    Through our gamification system and mentorship programs, members are recognized and
                    rewarded for their contributions and growth.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-r from-jci-blue to-jci-lightblue">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Ready to Join Us?</h2>
            <p className="text-xl text-blue-100 mb-8">
              Become part of a global network of young leaders making a difference.
            </p>
            <div className="flex justify-center gap-4">
              <Button
                size="lg"
                onClick={onRegister}
                className="bg-transparent text-white border-2 border-white hover:bg-white hover:text-jci-blue"
              >
                Become a Member
              </Button>
            </div>
          </div>
        </section>

      </main>
      <GuestFooter />
    </div>
  );
};
