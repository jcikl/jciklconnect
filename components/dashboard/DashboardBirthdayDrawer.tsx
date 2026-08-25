import React from 'react';
import { Modal, useToast } from '../ui/Common';
import {
  getAvatarGradientClass,
  getMemberDisplayName,
  getMemberDob,
  getMemberInitials,
} from './dashboardHomeUtils';

interface DashboardBirthdayDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  birthdayMembers: any[];
  now: Date;
  currentDay: number;
}

const getMembershipBadge = (type: string) => {
  const normalizedType = (type || '').toLowerCase();
  if (normalizedType.includes('probation')) return { label: 'Probation', cls: 'bg-amber-400/20 text-amber-300 border-amber-400/30' };
  if (normalizedType.includes('associate')) return { label: 'Associate', cls: 'bg-sky-400/20 text-sky-300 border-sky-400/30' };
  if (normalizedType.includes('full') || normalizedType.includes('voting') || normalizedType.includes('member')) return { label: 'Member', cls: 'bg-violet-400/20 text-violet-300 border-violet-400/30' };
  return { label: type || 'Member', cls: 'bg-white/10 text-white/50 border-white/15' };
};

export const DashboardBirthdayDrawer: React.FC<DashboardBirthdayDrawerProps> = ({
  isOpen,
  onClose,
  birthdayMembers,
  now,
  currentDay,
}) => {
  const { showToast } = useToast();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">🎂</span>
          <span className="font-bold text-white">Birthdays This Month</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-200/80 bg-white/15 px-2 py-0.5 rounded-full border border-white/20">
            {now.toLocaleString('default', { month: 'long' })}
          </span>
        </div>
      }
      headerStyle={{
        backgroundImage: 'linear-gradient(135deg, rgba(190,18,60,0.82) 0%, rgba(134,25,143,0.78) 50%, rgba(79,70,229,0.75) 100%), url(/background/birthday-background.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      size="md"
      drawerOnMobile={true}
      bottomSheet={true}
      dragHandleInHeader
      className="!bg-slate-900"
      scrollInBody={false}
    >
      <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar -mx-4 px-4 md:-mx-6 md:px-6 pb-2">
        {birthdayMembers.map(member => {
          const dob = new Date(getMemberDob(member)!);
          const day = dob.getDate();
          const isToday = day === currentDay;
          const name = getMemberDisplayName(member);
          const avatarUrl = member.general?.avatarUrl || member.general?.avatarUrl;
          const badge = getMembershipBadge(member.jciCareer?.membershipType || '');
          const duesPaid = member.jciCareer?.isDuesPaidCurrentYear ?? (member.duesStatus === 'paid');
          const duesLabel = duesPaid ? 'Dues Paid' : 'Dues Pending';
          const duesCls = duesPaid
            ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30'
            : 'bg-red-400/15 text-red-300 border-red-400/30';
          const isInWhatsAppGroup = member.contact?.whatsappJoined || member.contact?.whatsappJoined;

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all"
              style={{
                background: isToday
                  ? 'linear-gradient(135deg, rgba(190,18,60,0.25) 0%, rgba(134,25,143,0.20) 100%)'
                  : 'rgba(255,255,255,0.06)',
                border: isToday ? '1px solid rgba(251,113,133,0.35)' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="relative flex-shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={name}
                    className={`w-11 h-11 rounded-full object-cover shadow-md ${isToday ? 'ring-2 ring-rose-400/70 ring-offset-1 ring-offset-slate-900' : 'ring-1 ring-white/20'}`}
                  />
                ) : (
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarGradientClass(name)} flex items-center justify-center text-sm font-bold text-white shadow-md ${isToday ? 'ring-2 ring-rose-400/70 ring-offset-1 ring-offset-slate-900' : 'ring-1 ring-white/20'}`}>
                    {getMemberInitials(member)}
                  </div>
                )}
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center shadow-md"
                  style={isInWhatsAppGroup
                    ? { background: '#25d366', border: '1.5px solid rgba(255,255,255,0.25)' }
                    : { background: '#475569', border: '1.5px solid rgba(255,255,255,0.10)' }}
                  title={isInWhatsAppGroup ? 'In WhatsApp group' : 'Not in WhatsApp group'}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className={`w-2.5 h-2.5 ${isInWhatsAppGroup ? 'text-slate-900' : 'text-white'}`}>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.85L.057 23.25a.75.75 0 0 0 .918.919l5.4-1.47A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.88 0-3.638-.502-5.153-1.378l-.37-.213-3.833 1.043 1.044-3.832-.214-.372A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                  </svg>
                </span>
                {isToday && (
                  <span className="absolute -top-0.5 -left-0.5 text-xs leading-none">🎉</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white text-sm leading-snug truncate">{name}</h4>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${duesCls}`}>
                    {duesLabel}
                  </span>
                </div>
              </div>

              <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                {isToday ? (
                  <>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full text-white shadow-sm" style={{ background: 'rgba(225,29,72,0.7)', border: '1px solid rgba(251,113,133,0.5)' }}>
                      Today 🎂
                    </span>
                    <button
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white/80 border border-white/20 hover:bg-white/15 transition-colors"
                      style={{ background: 'rgba(255,255,255,0.10)' }}
                      onClick={() => {
                        navigator.clipboard.writeText(`Happy Birthday ${name}! 🎂 Wishing you a wonderful day!`);
                        showToast('Copied wishes to clipboard!', 'success');
                      }}
                    >
                      Copy Wishes
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center px-2.5 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <span className="text-[9px] font-black uppercase tracking-wider text-white/40 leading-none">{dob.toLocaleString('default', { month: 'short' })}</span>
                    <span className="text-base font-extrabold text-white leading-tight">{day}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};
