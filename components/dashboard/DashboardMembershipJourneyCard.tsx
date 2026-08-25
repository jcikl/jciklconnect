import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

interface DashboardMembershipJourneyCardProps {
  show: boolean;
  isProbationMember: boolean;
  isFullMember: boolean;
  isVeteranMember: boolean;
  joinYear: number | null;
  yearsInMembership: number;
  showEngagementSteps: boolean;
  engagementFirst: any;
  engagementSecond: any;
  pathwayJourney: any;
  membershipStatusLabel: string;
  nextStepHint: string | null;
  journeyIsComplete: boolean;
  journeyProgress: number;
  journeyLabel: string;
  promoLoading: boolean;
  onOpen: () => void;
  onRestricted: () => void;
}

export const DashboardMembershipJourneyCard: React.FC<DashboardMembershipJourneyCardProps> = ({
  show,
  isProbationMember,
  isFullMember,
  isVeteranMember,
  joinYear,
  yearsInMembership,
  showEngagementSteps,
  engagementFirst,
  engagementSecond,
  pathwayJourney,
  membershipStatusLabel,
  nextStepHint,
  journeyIsComplete,
  journeyProgress,
  journeyLabel,
  promoLoading,
  onOpen,
  onRestricted,
}) => {
  if (!show) return null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
      onClick={(isProbationMember || isFullMember) ? onOpen : onRestricted}
    >
      <div className="absolute inset-0" style={{ backgroundImage: 'url(/background/birthday-background.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.88) 0%, rgba(180,83,9,0.84) 50%, rgba(120,53,15,0.82) 100%)' }} />
      <div className="relative z-10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl leading-none select-none drop-shadow-md">🏅</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-200/80 leading-none mb-0.5">Your Progress</p>
              <h3 className="font-extrabold text-white text-lg leading-tight drop-shadow-sm">Membership Journey</h3>
            </div>
          </div>
          {(isProbationMember || isFullMember) && (
            <span className="text-[10px] font-black uppercase tracking-widest text-white bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/30">
              {isProbationMember ? 'Probation' : isVeteranMember ? `Member since ${joinYear}` : yearsInMembership >= 1 ? '2nd Year' : '1st Year'}
            </span>
          )}
        </div>
        {isFullMember ? (
          <>
            <div className="mb-3 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2">
              <div className="flex items-start gap-1.5">
                {[
                  { label: 'Probation', pct: 100 },
                  ...(showEngagementSteps ? [
                    { label: '1st Year', pct: engagementFirst?.overallProgress || 0 },
                    { label: '2nd Year', pct: engagementSecond?.overallProgress || 0 },
                  ] : []),
                  { label: 'Leadership', pct: pathwayJourney ? ((pathwayJourney.leadership.currentIndex + 1) / pathwayJourney.leadership.steps.length) * 100 : 0 },
                  { label: 'Trainer', pct: pathwayJourney ? ((pathwayJourney.trainer.currentIndex + 1) / pathwayJourney.trainer.steps.length) * 100 : 0 },
                ].map(stage => (
                  <div key={stage.label} className="flex-1 min-w-0">
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, stage.pct)}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className={`h-full rounded-full ${stage.pct >= 100 ? 'bg-green-300' : 'bg-amber-200'}`}
                      />
                    </div>
                    <p className="text-[8px] font-black uppercase tracking-wide text-white/60 text-center mt-1 truncate">{stage.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-white/70 truncate">
                {isVeteranMember && pathwayJourney ? (
                  `${membershipStatusLabel} · ${pathwayJourney.leadership.steps[pathwayJourney.leadership.currentIndex]?.title} · Trainer: ${pathwayJourney.trainer.currentIndex >= 0 ? pathwayJourney.trainer.steps[pathwayJourney.trainer.currentIndex]?.title : 'Not started'}`
                ) : nextStepHint && !journeyIsComplete ? (
                  <><ArrowUpRight size={10} className="inline -mt-0.5 mr-0.5" />Next: {nextStepHint}</>
                ) : journeyIsComplete ? (
                  '✓ All requirements completed'
                ) : (
                  membershipStatusLabel || 'Keep going — you\'re making progress!'
                )}
              </p>
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:bg-white/30 transition-all duration-200 flex-shrink-0 ml-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:translate-x-0.5 transition-transform duration-200"><path d="m9 18 6-6-6-6" /></svg>
              </div>
            </div>
          </>
        ) : isProbationMember ? (
          <>
            <div className="mb-3 flex items-center gap-3 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2">
              <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${journeyProgress}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${journeyIsComplete ? 'bg-green-300' : 'bg-amber-200'}`}
                />
              </div>
              <span className="text-[11px] font-bold text-white/90 flex-shrink-0">
                {promoLoading ? '...' : journeyLabel.split(' · ')[0]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-white/70 truncate">
                {nextStepHint && !journeyIsComplete ? (
                  <><ArrowUpRight size={10} className="inline -mt-0.5 mr-0.5" />Next: {nextStepHint}</>
                ) : journeyIsComplete ? (
                  '✓ All requirements completed'
                ) : (
                  'Keep going — you\'re making progress!'
                )}
              </p>
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:bg-white/30 transition-all duration-200 flex-shrink-0 ml-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:translate-x-0.5 transition-transform duration-200"><path d="m9 18 6-6-6-6" /></svg>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-white/80">Join us to unlock more benefits</p>
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m9 18 6-6-6-6" /></svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
