// Member Dashboard Home Component
import React from 'react';
import {
  Calendar, Briefcase, Bell, Award, Sparkles, AlertTriangle, CheckCircle,
  TrendingUp, Users, Clock, Target, Zap, FileText, DollarSign, UserCog,
  CheckSquare, Heart, BookOpen, LayoutDashboard, Building2, Gift, ChevronDown, Search, LogOut
} from 'lucide-react';
import { Card, StatCard, StatCardsContainer, Badge, Button, useToast } from '../ui/Common';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useEvents } from '../../hooks/useEvents';
import { useProjects } from '../../hooks/useProjects';
import { useCommunication } from '../../hooks/useCommunication';
import { usePoints } from '../../hooks/usePoints';
import { useMembers } from '../../hooks/useMembers';
import { useBehavioralNudging } from '../../hooks/useBehavioralNudging';
import { NudgeBanner } from '../ui/NudgeBanner';
import { MemberGrowthChart, PointsDistributionChart } from './Analytics';
import { AIPredictionService, PersonalizedRecommendation } from '../../services/aiPredictionService';
import { ActivityRecommendationService } from '../../services/activityRecommendationService';
import { EventRegistrationService } from '../../services/eventRegistrationService';
import type { Event } from '../../types';
import { UserRole } from '../../types';
import { useState, useEffect } from 'react';

interface DashboardHomeProps {
  userRole: import('../../types').UserRole;
  onOpenNotifications: () => void;
  onNavigate?: (view: string) => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  userRole,
  onOpenNotifications,
  onNavigate
}) => {
  const { showToast } = useToast();
  const { member, signOut } = useAuth();
  const { isBoard, isAdmin, isDeveloper, hasPermission, isOrganizationFinance, isActivityFinance, isOrganizationSecretary } = usePermissions();
  const { events, loading: eventsLoading } = useEvents();
  const { projects, loading: projectsLoading } = useProjects();
  const { members, loading: membersLoading } = useMembers();
  const { nudges, dismissNudge } = useBehavioralNudging();
  const { notifications } = useCommunication();
  const { leaderboard, pointHistory } = usePoints();
  const [recommendations, setRecommendations] = useState<PersonalizedRecommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [topRecommendation, setTopRecommendation] = useState<PersonalizedRecommendation | null>(null);
  const [recommendedEvents, setRecommendedEvents] = useState<Event[]>([]);
  const [loadingRecommendedEvents, setLoadingRecommendedEvents] = useState(false);
  const [myRegistrationEventIds, setMyRegistrationEventIds] = useState<string[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [eventTab, setEventTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleRestrictedAction = (viewType: string) => {
    if (member?.role === UserRole.GUEST) {
      setShowUpgradeModal(true);
    } else {
      onNavigate?.(viewType);
    }
  };

  // Load member's event registrations (for guest dashboard: Activity Timeline + Upcoming Registered)
  useEffect(() => {
    const load = async () => {
      if (!member) return;
      setLoadingRegistrations(true);
      try {
        const list = await EventRegistrationService.listByMember(member.id);
        setMyRegistrationEventIds(list.map((r) => r.eventId));
      } catch {
        setMyRegistrationEventIds([]);
      } finally {
        setLoadingRegistrations(false);
      }
    };
    load();
  }, [member]);

  // Load personalized recommendations
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!member) return;
      setLoadingRecommendations(true);
      try {
        const recs = await AIPredictionService.getPersonalizedRecommendations(member.id, 5);
        setRecommendations(recs);
        if (recs.length > 0) {
          setTopRecommendation(recs[0]);
        }
      } catch (err) {
        console.error('Failed to load recommendations:', err);
      } finally {
        setLoadingRecommendations(false);
      }
    };
    loadRecommendations();
  }, [member]);

  // Load activity-based recommended events (Story 9.1)
  useEffect(() => {
    const load = async () => {
      if (!member) return;
      setLoadingRecommendedEvents(true);
      try {
        const list = await ActivityRecommendationService.getRecommendedEvents(member.id, 5);
        setRecommendedEvents(list);
      } catch {
        setRecommendedEvents([]);
      } finally {
        setLoadingRecommendedEvents(false);
      }
    };
    load();
  }, [member]);

  // Calculate stats from real data
  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date() && e.status !== 'Cancelled');
  const myProjects = projects.filter(p => p.lead === member?.id);
  const pendingTasks = myProjects.length; // Simplified - would need to fetch tasks
  const unreadNotifications = notifications.filter(n => !n.read);

  // Guest: only events this member has registered for
  const myRegisteredEvents = events.filter((e) => myRegistrationEventIds.includes(e.id));
  const pastRegisteredEvents = myRegisteredEvents
    .filter((e) => new Date(e.date) < new Date())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const upcomingRegisteredEvents = myRegisteredEvents
    .filter((e) => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate rank
  const userRankIndex = member ? leaderboard.findIndex(m => m.id === member.id) : -1;
  const userRank = userRankIndex >= 0 ? userRankIndex + 1 : 0;
  const rankPercentile = (userRank > 0 && leaderboard.length > 0)
    ? Math.round(((leaderboard.length - userRank) / leaderboard.length) * 100)
    : 0;

  if (!member) {
    return <div className="text-center py-10 text-slate-400">Loading member data...</div>;
  }

  const renderHeader = () => (
    <div className="bg-gradient-to-br from-jci-navy to-jci-blue rounded-b-[40px] pt-8 pb-4 sm:pb-6 lg:pb-8 px-4 sm:px-6 lg:px-8 text-white shadow-2xl relative overflow-hidden -mt-4 -mx-4 sm:-mt-6 sm:-mx-6 lg:-mt-8 lg:-mx-8">
      {/* Decorative Background Pattern */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>

      <div className="relative z-10 space-y-8">
        {/* Top Row: Avatar & Status | Notifications */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=ffffff&color=0097D7`}
                alt="Avatar"
                className="w-12 h-12 rounded-full border-2 border-white/30 shadow-lg object-cover"
              />
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-jci-navy rounded-full"></div>
            </div>
            <div className="cursor-pointer group">
              <div className="flex items-center space-x-1 text-blue-100 text-lg font-bold opacity-80 group-hover:opacity-100 transition-opacity">
                <span>{member.name}</span>
              </div>
              <p className="font-medium text-sm tracking-wide">{member.role}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenNotifications}
              className="relative p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20 hover:bg-white/20 transition-all shadow-xl group"
            >
              <Bell size={20} className="group-hover:rotate-12 transition-transform" />
              {unreadNotifications.length > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-jci-navy text-[10px] flex items-center justify-center font-black">
                  {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                </span>
              )}
            </button>

            <button
              onClick={async () => {
                try {
                  await signOut();
                  showToast('Logged out successfully', 'success');
                } catch (error) {
                  showToast('Failed to logout', 'error');
                }
              }}
              className="p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20 hover:bg-red-500/20 hover:border-red-500/50 transition-all shadow-xl group"
              title="Sign Out"
            >
              <LogOut size={20} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* Greeting & AI Recommendation */}
        <div className="space-y-3">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
            What would you <br /> prefer to do today?
          </h2>
          {topRecommendation ? (
            <div
              className="flex items-center space-x-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/10 inline-flex cursor-pointer hover:bg-white/10 transition-all"
              onClick={() => {
                if (topRecommendation.actionUrl) {
                  const view = topRecommendation.actionUrl.replace('/', '').toUpperCase();
                  onNavigate?.(view);
                }
              }}
            >
              <Sparkles size={16} className="text-yellow-400 animate-pulse" />
              <p className="text-sm font-medium text-blue-50">
                AI Suggests: <span className="underline decoration-yellow-400/50 underline-offset-4">{topRecommendation.itemName}</span>
              </p>
            </div>
          ) : nudges.length > 0 ? (
            <div
              className="flex items-center space-x-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/10 inline-flex cursor-pointer hover:bg-white/10 transition-all"
              onClick={() => {
                if (nudges[0].actionUrl) {
                  const view = nudges[0].actionUrl.replace('/', '').toUpperCase();
                  onNavigate?.(view);
                }
              }}
            >
              <Zap size={16} className="text-amber-400 animate-pulse" />
              <p className="text-sm font-medium text-blue-50">
                {nudges[0].title}
              </p>
            </div>
          ) : (
            <p className="text-blue-100/70 font-medium">Ready to make an impact? Check out the latest.</p>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search size={20} className="text-slate-400 group-focus-within:text-jci-blue transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search events, members, or projects..."
            className="w-full bg-white text-slate-800 rounded-3xl py-4 pl-14 pr-14 shadow-2xl focus:ring-4 focus:ring-white/20 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium text-base"
          />
          <div className="absolute inset-y-0 right-5 flex items-center">
            <div className="w-px h-6 bg-slate-200 mr-5" />
            <button className="text-slate-400 hover:text-jci-blue transition-colors p-1">
              <Zap size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {renderHeader()}

      {/* Horizontal Circular Shortcuts (6x1) */}
      <div className="flex items-center py-4 space-x-6 overflow-x-auto no-scrollbar scroll-smooth">
        <div className="flex flex-col items-center gap-2 group cursor-pointer flex-shrink-0" onClick={() => handleRestrictedAction('PROJECTS')}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors shadow-sm ${member.role === UserRole.GUEST ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-green-50 text-green-600 border-green-100 group-hover:bg-green-100'}`}>
            <Briefcase size={24} />
          </div>
          <span className={`text-[10px] sm:text-xs font-medium text-center ${member.role === UserRole.GUEST ? 'text-slate-400' : 'text-slate-600'}`}>My Projects</span>
        </div>
        <div className="flex flex-col items-center gap-2 group cursor-pointer flex-shrink-0" onClick={() => handleRestrictedAction('MEMBERS')}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors shadow-sm ${member.role === UserRole.GUEST ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-purple-50 text-purple-600 border-purple-100 group-hover:bg-purple-100'}`}>
            <Users size={24} />
          </div>
          <span className={`text-[10px] sm:text-xs font-medium text-center ${member.role === UserRole.GUEST ? 'text-slate-400' : 'text-slate-600'}`}>Find Mentor</span>
        </div>
        <div className="flex flex-col items-center gap-2 group cursor-pointer flex-shrink-0" onClick={() => handleRestrictedAction('GAMIFICATION')}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors shadow-sm ${member.role === UserRole.GUEST ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-100'}`}>
            <Target size={24} />
          </div>
          <span className={`text-[10px] sm:text-xs font-medium text-center ${member.role === UserRole.GUEST ? 'text-slate-400' : 'text-slate-600'}`}>Set Goals</span>
        </div>
        <div className="flex flex-col items-center gap-2 group cursor-pointer flex-shrink-0" onClick={() => onNavigate?.('SURVEYS')}>
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100 group-hover:bg-rose-100 transition-colors shadow-sm">
            <CheckSquare size={24} />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-slate-600 text-center">Survey</span>
        </div>
        <div className="flex flex-col items-center gap-2 group cursor-pointer flex-shrink-0" onClick={() => onNavigate?.('CLUBS')}>
          <div className="w-12 h-12 rounded-full bg-pink-50 flex items-center justify-center text-pink-600 border border-pink-100 group-hover:bg-pink-100 transition-colors shadow-sm">
            <Heart size={24} />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-slate-600 text-center">Hobby Clubs</span>
        </div>
        <div className="flex flex-col items-center gap-2 group cursor-pointer flex-shrink-0" onClick={() => onNavigate?.('KNOWLEDGE')}>
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 group-hover:bg-indigo-100 transition-colors shadow-sm">
            <BookOpen size={24} />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-slate-600 text-center">Knowledge</span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card noPadding>
          <div className="px-6 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Events</h3>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  onClick={() => setEventTab('upcoming')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${eventTab === 'upcoming' ? 'bg-white text-jci-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Upcoming
                </button>
                <button
                  onClick={() => setEventTab('past')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${eventTab === 'past' ? 'bg-white text-jci-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Past
                </button>
              </div>
            </div>
          </div>
          <div className="p-6">
            {eventsLoading ? (
              <div className="text-center py-8 text-slate-400 text-sm">Loading events...</div>
            ) : (eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date())).length === 0 ? (
              <div className="text-center py-8 text-slate-400 font-medium">
                <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No {eventTab} events</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date()))
                  .sort((a, b) => eventTab === 'upcoming' ? new Date(a.date).getTime() - new Date(b.date).getTime() : new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map(event => {
                    const isRecommended = recommendedEvents.some(re => re.id === event.id);
                    return (
                      <div key={event.id} className="flex items-center space-x-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors">
                        <div className={`w-12 h-12 ${eventTab === 'upcoming' ? 'bg-blue-50 text-jci-blue' : 'bg-slate-100 text-slate-500'} rounded-lg flex flex-col items-center justify-center flex-shrink-0 shadow-sm border border-slate-100`}>
                          <span className="text-[10px] font-bold uppercase">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                          <span className="text-lg font-bold leading-none">{new Date(event.date).getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 truncate">{event.title}</h4>
                            {isRecommended && <Badge variant="jci" className="bg-purple-100 text-purple-600 border-none px-1.5 py-0 text-[10px]">Recommended</Badge>}
                          </div>
                          <p className="text-xs text-slate-500">{event.type} • {event.attendees} Attending</p>
                        </div>
                        {event.predictedDemand === 'High' && eventTab === 'upcoming' && (
                          <Badge variant="jci">Hot</Badge>
                        )}
                      </div>
                    );
                  })}
                {((eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date())).length > 5 && onNavigate) && (
                  <Button variant="ghost" className="w-full mt-2 text-sm text-jci-blue hover:bg-blue-50" onClick={() => onNavigate('EVENTS')}>
                    View All {(eventTab === 'upcoming' ? upcomingEvents : events.filter(e => new Date(e.date) < new Date())).length} Events
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        {member.role !== UserRole.GUEST && (
          <>
            {/* Achievement Progress */}
            <Card title="Achievement Progress">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="text-amber-500" size={20} />
                    <span className="text-sm font-medium">First Event</span>
                  </div>
                  <Badge variant="success">Completed</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="text-blue-500" size={20} />
                    <span className="text-sm font-medium">100 Points</span>
                  </div>
                  <span className="text-xs text-slate-500">75/100</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div className="bg-jci-blue h-2 rounded-full" style={{ width: '75%' }}></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="text-green-500" size={20} />
                    <span className="text-sm font-medium">Recruit Member</span>
                  </div>
                  <span className="text-xs text-slate-500">0/1</span>
                </div>
              </div>
            </Card>

            <div className="lg:col-span-2 space-y-6">
              {(isBoard || isAdmin || isDeveloper) && (
                <MemberGrowthChart members={members} />
              )}

              <Card title="Priority Actions (Automated)" className="border-l-4 border-l-amber-500">
                {unreadNotifications.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                    <p className="text-sm">All caught up! No pending actions.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {unreadNotifications.slice(0, 5).map(note => (
                      <div key={note.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                        <div className="flex items-start space-x-3 flex-1">
                          {note.type === 'info' ? <Sparkles size={18} className="text-purple-500 mt-1" /> : <AlertTriangle size={18} className="text-amber-500 mt-1" />}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-slate-900">{note.title}</h4>
                            <p className="text-sm text-slate-600">{note.message}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="text-xs h-8 flex-shrink-0" onClick={() => onOpenNotifications()}>View</Button>
                      </div>
                    ))}
                    {unreadNotifications.length > 5 && (
                      <Button variant="ghost" className="w-full text-sm" onClick={onOpenNotifications}>
                        View All {unreadNotifications.length} Notifications
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <div className="relative" style={{ minHeight: 320, minWidth: 0 }}>
                <div className="absolute top-4 right-6 z-10 flex flex-col items-end">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Points</span>
                  <span className="text-2xl font-bold text-jci-blue leading-none">{(member.points || 0).toLocaleString()}</span>
                  {rankPercentile > 0 && <span className="text-[10px] text-slate-400 mt-1">Top {rankPercentile}%</span>}
                </div>
                <PointsDistributionChart pointHistory={pointHistory} />
              </div>
            </div>
          </>
        )}
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-50 text-jci-blue rounded-full flex items-center justify-center mx-auto mb-4">
                <Award size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Join Member to Unlock More</h3>
              <p className="text-sm text-slate-500 mb-8">
                Upgrade your account to access Projects, find Mentors, view business directories, and enjoy exclusive member benefits!
              </p>
              <div className="flex flex-col gap-3">
                <Button className="w-full" onClick={() => { setShowUpgradeModal(false); /* Optional route to join */ }}>
                  Join Us Now
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setShowUpgradeModal(false)}>
                  Maybe Later
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

