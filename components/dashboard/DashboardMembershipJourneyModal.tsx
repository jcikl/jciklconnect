import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, BookOpen, CheckCircle, Clock, Crown, RefreshCw, TrendingUp } from 'lucide-react';
import type { MemberJourney } from '../../services/memberJourneyService';
import type { MemberEngagementProgressSummary } from '../../services/promotionService';

type JourneyActiveTab = 'probation' | 'firstYear' | 'secondYear' | 'leadership' | 'trainer';
type JourneyGroupTab = 'Leadership Experience' | 'Skills Development' | 'JCI Experience';

interface DashboardMembershipJourneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  journeyActiveTab: JourneyActiveTab;
  setJourneyActiveTab: React.Dispatch<React.SetStateAction<JourneyActiveTab>>;
  isFullMember: boolean;
  isProbationMember: boolean;
  showEngagementSteps: boolean;
  promotionProgress: any;
  promoLoading: boolean;
  pathwayJourney: MemberJourney | null;
  engagementFirst: MemberEngagementProgressSummary | null;
  engagementSecond: MemberEngagementProgressSummary | null;
  engagementLoading: boolean;
  expandedJourneySteps: Set<string>;
  setExpandedJourneySteps: React.Dispatch<React.SetStateAction<Set<string>>>;
  journeyGroupTab: JourneyGroupTab;
  setJourneyGroupTab: React.Dispatch<React.SetStateAction<JourneyGroupTab>>;
}

export const DashboardMembershipJourneyModal: React.FC<DashboardMembershipJourneyModalProps> = ({
  isOpen,
  onClose,
  journeyActiveTab,
  setJourneyActiveTab,
  isFullMember,
  isProbationMember,
  showEngagementSteps,
  promotionProgress,
  promoLoading,
  pathwayJourney,
  engagementFirst,
  engagementSecond,
  engagementLoading,
  expandedJourneySteps,
  setExpandedJourneySteps,
  journeyGroupTab,
  setJourneyGroupTab,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-end md:items-center md:justify-center" onClick={onClose}>
      <div className="rounded-t-[32px] md:rounded-2xl w-full md:max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col md:mx-4 animate-slide-up" style={{ background: '#0f172a' }} onClick={(event) => event.stopPropagation()}>
        <div className="px-5 pt-3 pb-4 flex-shrink-0" style={{
          backgroundImage: 'linear-gradient(135deg, rgba(217,119,6,0.88) 0%, rgba(180,83,9,0.84) 50%, rgba(120,53,15,0.82) 100%), url(/background/birthday-background.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}>
          <div className="flex justify-center pb-2 md:hidden">
            <div className="w-10 h-1 rounded-full bg-white/30" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white border border-white/25">
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 className="font-bold text-white">Membership Journey</h3>
                <p className="text-xs text-amber-200/80">Track your progress at each stage</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-start">
            <button
              className="flex flex-col items-center gap-1.5 flex-1 focus:outline-none"
              onClick={() => setJourneyActiveTab('probation')}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isFullMember ? 'bg-emerald-500 text-white'
                : journeyActiveTab === 'probation' ? 'bg-amber-500 text-white'
                  : 'bg-white/10 text-white/40'
                }`}>
                {isFullMember ? <CheckCircle size={14} /> : 'P'}
              </div>
              <span className={`text-[10px] font-semibold whitespace-nowrap ${journeyActiveTab === 'probation' ? 'text-amber-400'
                : isFullMember ? 'text-emerald-400'
                  : 'text-white/40'
                }`}>Probation</span>
              <span className={`text-[10px] ${isFullMember ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isProbationMember
                  ? `${promotionProgress?.overallProgress?.toFixed(0) ?? 0}%`
                  : '100%'}
              </span>
            </button>

            {showEngagementSteps && (<>
              <div className={`flex-1 h-0.5 mt-4 transition-colors ${isFullMember ? 'bg-emerald-500/60' : 'bg-white/15'}`} />

              <button
                className="flex flex-col items-center gap-1.5 flex-1 focus:outline-none"
                onClick={() => setJourneyActiveTab('firstYear')}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${engagementFirst?.isCompleted ? 'bg-emerald-500 text-white'
                  : journeyActiveTab === 'firstYear' ? 'bg-sky-500 text-white'
                    : 'bg-white/10 text-white/40'
                  }`}>
                  {engagementFirst?.isCompleted ? <CheckCircle size={14} /> : '1'}
                </div>
                <span className={`text-[10px] font-semibold whitespace-nowrap ${journeyActiveTab === 'firstYear' ? 'text-sky-400'
                  : engagementFirst?.isCompleted ? 'text-emerald-400'
                    : 'text-white/40'
                  }`}>1st Year</span>
                {engagementFirst && (
                  <span className={`text-[10px] ${engagementFirst.isCompleted ? 'text-emerald-400' : 'text-sky-400'}`}>
                    {engagementFirst.overallProgress.toFixed(0)}%
                  </span>
                )}
              </button>

              <div className={`flex-1 h-0.5 mt-4 transition-colors ${engagementFirst?.isCompleted ? 'bg-emerald-500/60' : 'bg-white/15'}`} />

              <button
                className="flex flex-col items-center gap-1.5 flex-1 focus:outline-none"
                onClick={() => setJourneyActiveTab('secondYear')}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${engagementSecond?.isCompleted ? 'bg-emerald-500 text-white'
                  : journeyActiveTab === 'secondYear' ? 'bg-violet-500 text-white'
                    : 'bg-white/10 text-white/40'
                  }`}>
                  {engagementSecond?.isCompleted ? <CheckCircle size={14} /> : '2'}
                </div>
                <span className={`text-[10px] font-semibold whitespace-nowrap ${journeyActiveTab === 'secondYear' ? 'text-violet-400'
                  : engagementSecond?.isCompleted ? 'text-emerald-400'
                    : 'text-white/40'
                  }`}>2nd Year</span>
                {engagementSecond && (
                  <span className={`text-[10px] ${engagementSecond.isCompleted ? 'text-emerald-400' : 'text-violet-400'}`}>
                    {engagementSecond.overallProgress.toFixed(0)}%
                  </span>
                )}
              </button>
            </>)}

            <div className={`flex-1 h-0.5 mt-4 transition-colors ${showEngagementSteps
              ? (engagementSecond?.isCompleted ? 'bg-emerald-500/60' : 'bg-white/15')
              : (isFullMember ? 'bg-emerald-500/60' : 'bg-white/15')}`} />

            <button
              className="flex flex-col items-center gap-1.5 flex-1 focus:outline-none"
              onClick={() => setJourneyActiveTab('leadership')}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${journeyActiveTab === 'leadership' ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/40'}`}>
                <Crown size={14} />
              </div>
              <span className={`text-[10px] font-semibold ${journeyActiveTab === 'leadership' ? 'text-amber-400' : 'text-white/40'}`}>Leadership</span>
              <span className="text-[10px] text-amber-400">
                {pathwayJourney ? `${pathwayJourney.leadership.currentIndex + 1}/${pathwayJourney.leadership.steps.length}` : '...'}
              </span>
            </button>

            <div className="flex-1 h-0.5 mt-4 bg-white/15" />

            <button
              className="flex flex-col items-center gap-1.5 flex-1 focus:outline-none"
              onClick={() => setJourneyActiveTab('trainer')}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${journeyActiveTab === 'trainer' ? 'bg-sky-500 text-white' : 'bg-white/10 text-white/40'}`}>
                <BookOpen size={14} />
              </div>
              <span className={`text-[10px] font-semibold ${journeyActiveTab === 'trainer' ? 'text-sky-400' : 'text-white/40'}`}>Trainer</span>
              <span className="text-[10px] text-sky-400">
                {pathwayJourney ? `${pathwayJourney.trainer.currentIndex + 1}/${pathwayJourney.trainer.steps.length}` : '...'}
              </span>
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto no-scrollbar flex-1 space-y-3">
          {journeyActiveTab === 'probation' && (
            <>
              {promotionProgress && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-white/50">
                      {promotionProgress.requirements?.filter((requirement: any) => requirement.isCompleted).length || 0}/{promotionProgress.requirements?.length || 4} completed
                    </span>
                    <span className="text-xs font-bold text-white/80">{promotionProgress.overallProgress?.toFixed(0) || 0}%</span>
                  </div>
                  <div className="flex gap-1">
                    {(promotionProgress.requirements || []).map((requirement: any, index: number) => (
                      <div key={index} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${requirement.isCompleted ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-white/10'}`} />
                    ))}
                  </div>
                  {promotionProgress.isEligibleForPromotion && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                      <CheckCircle size={12} /> All requirements met
                    </div>
                  )}
                </div>
              )}

              {promoLoading ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="animate-spin text-amber-400" size={24} />
                </div>
              ) : promotionProgress?.requirements ? (
                <div className="space-y-2">
                  {promotionProgress.requirements.map((requirement: any) => (
                    <div key={requirement.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl" style={{ background: requirement.isCompleted ? 'rgba(52,211,153,0.10)' : 'rgba(255,255,255,0.05)', border: requirement.isCompleted ? '1px solid rgba(52,211,153,0.25)' : '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${requirement.isCompleted ? 'bg-emerald-500' : 'bg-white/10'}`}>
                          {requirement.isCompleted
                            ? <CheckCircle size={11} className="text-white" />
                            : <Clock size={11} className="text-white/30" />}
                        </div>
                        <div className="min-w-0">
                          <span className={`font-semibold text-xs truncate block ${requirement.isCompleted ? 'text-white' : 'text-white/60'}`}>{requirement.general?.name}</span>
                          {requirement.isCompleted && requirement.completionDetails && (() => {
                            const rawVal = Object.values(requirement.completionDetails)[0];
                            const raw = typeof rawVal === 'string' ? rawVal : Array.isArray(rawVal) ? (rawVal as string[]).join(' ') : String(rawVal ?? '');
                            const lines = raw ? raw.split(/\s+(?=\d{4}-\d{2}-\d{2})/) : [];
                            return lines.length > 1
                              ? <div className="space-y-0.5 mt-0.5">{lines.map((line, index) => <p key={index} className="text-[10px] text-emerald-400 font-medium truncate">{line}</p>)}</div>
                              : <p className="text-[10px] text-emerald-400 font-medium truncate">{raw}</p>;
                          })()}
                          {!requirement.isCompleted && requirement.description && (
                            <p className="text-[10px] text-white/30 truncate">{requirement.description}</p>
                          )}
                        </div>
                      </div>
                      {requirement.isCompleted && <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">Done</span>}
                    </div>
                  ))}
                </div>
              ) : isFullMember ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle size={22} />
                  </div>
                  <p className="text-sm font-semibold text-emerald-400">Probation completed</p>
                  <p className="text-xs text-white/40">You have been promoted to Full Member.</p>
                </div>
              ) : (
                <div className="text-center py-8 text-white/30 text-sm">
                  <AlertTriangle size={24} className="mx-auto mb-2" />
                  Unable to load promotion requirements.
                </div>
              )}
            </>
          )}

          {(journeyActiveTab === 'leadership' || journeyActiveTab === 'trainer') && (() => {
            if (!pathwayJourney) return (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="animate-spin text-amber-400" size={24} />
              </div>
            );
            const data = pathwayJourney[journeyActiveTab];
            const accentColor = journeyActiveTab === 'leadership' ? 'text-amber-400' : 'text-sky-400';
            return (
              <>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-white/50">
                      {data.steps.filter(step => step.achieved).length}/{data.steps.length} achieved
                    </span>
                    <span className={`text-xs font-bold ${accentColor}`}>
                      {Math.round(((data.currentIndex + 1) / data.steps.length) * 100)}%
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {data.steps.map((step, index) => (
                      <div key={index} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${step.achieved ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-white/10'}`} />
                    ))}
                  </div>
                </div>

                {data.steps.map((step, index) => {
                  const isCurrent = index === data.currentIndex && step.achieved;
                  const isExpanded = expandedJourneySteps.has(step.title);
                  const allEntries = step.details ?? (step.detail ? [step.detail] : []);
                  const hasMore = allEntries.length > 1;
                  const visibleEntries = allEntries.slice(0, 1);
                  return (
                    <div
                      key={step.title}
                      className={`rounded-xl overflow-hidden ${hasMore ? 'cursor-pointer' : ''}`}
                      style={{ background: step.achieved ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.04)', border: step.achieved ? '1px solid rgba(52,211,153,0.20)' : '1px solid rgba(255,255,255,0.07)' }}
                      onClick={hasMore ? () => setExpandedJourneySteps(previous => { const next = new Set(previous); isExpanded ? next.delete(step.title) : next.add(step.title); return next; }) : undefined}
                    >
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${step.achieved
                          ? isCurrent ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                          : 'bg-white/10 text-white/25'
                          }`}>
                          {step.achieved ? <CheckCircle size={13} /> : index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm leading-tight ${step.achieved ? 'font-bold text-white' : 'font-medium text-white/35'}`}>{step.title}</p>
                            {isCurrent && (
                              <span className="text-[9px] font-black uppercase tracking-wide bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded-full flex-shrink-0">Current</span>
                            )}
                          </div>
                          {visibleEntries.length > 0 && (
                            <p className="text-[11px] text-white/30 truncate mt-0.5">{visibleEntries[0]}</p>
                          )}
                        </div>
                        {hasMore && (
                          <span className="flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-white/10 text-white/40 border-white/15">
                            {isExpanded ? '−' : `+${allEntries.length}`}
                          </span>
                        )}
                      </div>
                      {isExpanded && allEntries.length > 0 && (
                        <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-white/6 mt-0">
                          {allEntries.map((entry, entryIndex) => (
                            <div key={entryIndex} className="flex items-center gap-2 pl-9">
                              <div className="w-1 h-1 rounded-full bg-emerald-400/50 flex-shrink-0" />
                              <p className="text-[11px] text-white/50 truncate">{entry}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}

          {(journeyActiveTab === 'firstYear' || journeyActiveTab === 'secondYear') && (() => {
            const summary = journeyActiveTab === 'firstYear' ? engagementFirst : engagementSecond;
            const accentPct = journeyActiveTab === 'firstYear' ? 'text-sky-400' : 'text-violet-400';
            const accentDot = journeyActiveTab === 'firstYear' ? 'from-sky-400 to-sky-600' : 'from-violet-400 to-violet-600';

            if (engagementLoading) return (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className={`animate-spin ${journeyActiveTab === 'firstYear' ? 'text-sky-400' : 'text-violet-400'}`} size={24} />
              </div>
            );
            if (!summary) return (
              <div className="text-center py-8 text-white/30 text-sm">
                <AlertTriangle size={24} className="mx-auto mb-2" />
                Unable to load engagement progress.
              </div>
            );

            const groupRequirements = summary.requirements.filter(requirement => requirement.group === journeyGroupTab);

            return (
              <>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-white/50">{summary.completedCount}/{summary.totalCount} completed</span>
                    <span className={`text-xs font-bold ${accentPct}`}>{summary.overallProgress.toFixed(0)}%</span>
                  </div>
                  <div className="flex gap-1">
                    {summary.requirements.map((requirement, index) => {
                      const isPending = !!requirement.progress.pendingVerification;
                      return (
                        <div key={index} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${requirement.isCompleted ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : isPending ? 'bg-amber-400' : summary.isCompleted ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : `bg-gradient-to-r ${accentDot} opacity-20`}`} />
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  {(['Leadership Experience', 'Skills Development', 'JCI Experience'] as const).map(group => {
                    const groupReqs = summary.requirements.filter(requirement => requirement.group === group);
                    if (groupReqs.length === 0) return null;
                    const doneCount = groupReqs.filter(requirement => requirement.isCompleted).length;
                    const isActive = journeyGroupTab === group;
                    const label = group === 'Leadership Experience' ? 'Lead' : group === 'Skills Development' ? 'Skills' : 'JCI';
                    return (
                      <button
                        key={group}
                        onClick={() => setJourneyGroupTab(group)}
                        className={`flex-1 py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${isActive ? 'bg-white/15 text-white' : 'text-white/35 hover:text-white/60'}`}
                      >
                        <span>{label}</span>
                        <span className={`text-[9px] font-black ${doneCount === groupReqs.length ? 'text-emerald-400' : isActive ? accentPct : 'text-white/25'}`}>
                          {doneCount}/{groupReqs.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  {groupRequirements.map(requirement => {
                    const isPending = !!requirement.progress.pendingVerification;
                    return (
                      <div key={requirement.key} className="px-3 py-2.5 rounded-xl" style={{ background: requirement.isCompleted ? 'rgba(52,211,153,0.08)' : isPending ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)', border: requirement.isCompleted ? '1px solid rgba(52,211,153,0.20)' : isPending ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${requirement.isCompleted ? 'bg-emerald-500' : isPending ? 'bg-amber-400' : 'bg-white/10'}`}>
                              {requirement.isCompleted
                                ? <CheckCircle size={11} className="text-white" />
                                : <Clock size={11} className={isPending ? 'text-white' : 'text-white/30'} />}
                            </div>
                            <span className={`font-semibold text-xs truncate ${requirement.isCompleted || isPending ? 'text-white' : 'text-white/50'}`}>{requirement.title}</span>
                          </div>
                          <div className="flex-shrink-0">
                            {requirement.isCompleted && !isPending && <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">Done</span>}
                            {isPending && <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">Pending</span>}
                          </div>
                        </div>
                        {(isPending || requirement.isCompleted) && (requirement.progress.detail || requirement.progress.date) ? (
                          <div className="mt-1 pl-7 flex items-center gap-2 text-[11px]">
                            {requirement.progress.detail && <span className={isPending ? 'text-amber-300 font-medium' : 'text-emerald-400 font-medium'}>{requirement.progress.detail}</span>}
                            {requirement.progress.date && <span className="text-white/30">{requirement.progress.date}</span>}
                          </div>
                        ) : !requirement.isCompleted ? (
                          <p className="text-[11px] text-white/25 mt-0.5 pl-7 line-clamp-1">{requirement.description}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>,
    document.body
  );
};
