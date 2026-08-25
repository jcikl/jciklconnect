import React from 'react';
import {
  getAvatarGradientClass,
  getMemberDisplayName,
  getMemberDob,
  getMemberInitials,
} from './dashboardHomeUtils';

interface DashboardBirthdayBannerProps {
  birthdayMembers: any[];
  todayBirthdays: any[];
  nextBirthdayMember: any | null;
  now: Date;
  onOpen: () => void;
}

export const DashboardBirthdayBanner: React.FC<DashboardBirthdayBannerProps> = ({
  birthdayMembers,
  todayBirthdays,
  nextBirthdayMember,
  now,
  onOpen,
}) => {
  if (birthdayMembers.length === 0) return null;

  return (
    <div
      onClick={onOpen}
      className="relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
    >
      <div className="absolute inset-0" style={{ backgroundImage: 'url(/background/birthday-background.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(190,18,60,0.82) 0%, rgba(134,25,143,0.78) 50%, rgba(79,70,229,0.75) 100%)' }} />
      <div className="relative z-10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl leading-none select-none drop-shadow-md">🎂</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-200/80 leading-none mb-0.5">This Month</p>
              <h3 className="font-extrabold text-white text-lg leading-tight drop-shadow-sm">Birthdays</h3>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/30">
            {now.toLocaleString('default', { month: 'long' })}
          </span>
        </div>

        {todayBirthdays.length > 0 ? (
          <div className="mb-3 flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse flex-shrink-0" />
            <span className="text-[12px] font-bold text-white truncate">
              🎉 Today: {todayBirthdays.map(member => getMemberDisplayName(member).split(' ')[0]).join(', ')}
            </span>
          </div>
        ) : nextBirthdayMember ? (
          <div className="mb-3 flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2">
            <span className="text-[12px] font-semibold text-white/90 truncate">
              📅 Next: {getMemberDisplayName(nextBirthdayMember).split(' ')[0]} — {new Date(getMemberDob(nextBirthdayMember)!).getDate()} {now.toLocaleString('default', { month: 'short' })}
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center">
              {birthdayMembers.slice(0, 5).map((member, index) => {
                const name = getMemberDisplayName(member);
                const avatarUrl = member.general?.avatarUrl || member.general?.avatarUrl;
                const sharedStyle = { width: '36px', height: '36px', marginLeft: index > 0 ? '-10px' : '0px', zIndex: 10 - index };

                if (avatarUrl) {
                  return (
                    <img
                      key={member.id}
                      src={avatarUrl}
                      alt={name}
                      className="rounded-full object-cover border-2 border-white/60 shadow-md flex-shrink-0 group-hover:-translate-y-0.5 transition-transform"
                      style={sharedStyle}
                    />
                  );
                }

                return (
                  <div
                    key={member.id}
                    className={`rounded-full bg-gradient-to-br ${getAvatarGradientClass(name)} flex items-center justify-center text-[10px] font-bold text-white border-2 border-white/60 shadow-md flex-shrink-0 group-hover:-translate-y-0.5 transition-transform`}
                    style={sharedStyle}
                  >
                    {getMemberInitials(member)}
                  </div>
                );
              })}
              {birthdayMembers.length > 5 && (
                <div className="rounded-full border-2 border-white/60 bg-white/25 flex items-center justify-center text-[10px] font-bold text-white shadow-md flex-shrink-0" style={{ width: '36px', height: '36px', marginLeft: '-10px', zIndex: 5 }}>
                  +{birthdayMembers.length - 5}
                </div>
              )}
            </div>
            <span className="text-[11px] font-semibold text-white/80">{birthdayMembers.length} celebrating</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:bg-white/30 transition-all duration-200">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:translate-x-0.5 transition-transform duration-200"><path d="m9 18 6-6-6-6" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
};
