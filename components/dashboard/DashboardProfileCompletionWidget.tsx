import React from 'react';
import { motion } from 'framer-motion';
import type { ProfileCompleteness } from './dashboardHomeUtils';

interface DashboardProfileCompletionWidgetProps {
  profileCompleteness: ProfileCompleteness | null;
  onOpen: () => void;
}

export const DashboardProfileCompletionWidget: React.FC<DashboardProfileCompletionWidgetProps> = ({
  profileCompleteness,
  onOpen,
}) => {
  if (!profileCompleteness) return null;

  const { done, total, pct, missing, tabStats } = profileCompleteness;

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-md cursor-pointer group"
      style={{ backgroundImage: 'linear-gradient(135deg, rgba(0,111,183,0.90) 0%, rgba(0,75,135,0.88) 55%, rgba(0,40,90,0.86) 100%), url(/background/birthday-background.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      onClick={onOpen}
    >
      <div className="relative z-10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl leading-none select-none drop-shadow-md">📋</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/60 leading-none mb-0.5">Your Profile</p>
              <h3 className="font-extrabold text-white text-lg leading-tight drop-shadow-sm">{pct}% Complete</h3>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/30">
            {done} of {total}
          </span>
        </div>

        <div className="mb-1 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2">
          <div className="flex items-start gap-1.5">
            {tabStats.map(tab => (
              <div key={tab.label} className="flex-1 min-w-0">
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${tab.pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${tab.pct >= 100 ? 'bg-green-300' : 'bg-white'}`}
                  />
                </div>
                <p className="text-[8px] font-black uppercase tracking-wide text-white/60 text-center mt-1 truncate">{tab.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-white/60">
            {missing.length > 0 ? `${missing[0].label}${missing.length > 1 ? ` +${missing.length - 1} more` : ''} pending` : ''}
          </p>
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:bg-white/30 transition-all duration-200 flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:translate-x-0.5 transition-transform duration-200"><path d="m9 18 6-6-6-6" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
};
