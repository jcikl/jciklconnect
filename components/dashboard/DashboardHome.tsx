// Member Dashboard Home Component
import React from 'react';
import {
  Calendar, Briefcase, Bell, Award, Sparkles, AlertTriangle, CheckCircle,
  TrendingUp, Users, Clock, Target, Zap, FileText, DollarSign, UserCog
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
  const { member } = useAuth();
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
  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date() && e.status === 'Upcoming');
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

  // Guest dashboard: only Activity Timeline + Upcoming Registered Events
  if (member.role === UserRole.GUEST) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        </div>

        {/* 1. Activity Timeline — 查看过去参与过的活动 */}
        <Card title="Activity Timeline" className="border-l-4 border-l-jci-blue">
          <p className="text-sm text-slate-500 mb-4">Past events you participated in.</p>
          {loadingRegistrations || eventsLoading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Loading...</div>
          ) : pastRegisteredEvents.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No past activities yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pastRegisteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center space-x-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0"
                >
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-600 flex-shrink-0">
                    <span className="text-xs font-bold uppercase">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                    <span className="text-lg font-bold leading-none">{new Date(event.date).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 truncate">{event.title}</h4>
                    <p className="text-xs text-slate-500">{event.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 2. Upcoming Registered Events */}
        <Card title="Upcoming Registered Events" className="border-l-4 border-l-jci-teal">
          <p className="text-sm text-slate-500 mb-4">Events you have registered for.</p>
          {loadingRegistrations || eventsLoading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Loading...</div>
          ) : upcomingRegisteredEvents.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No upcoming registered events.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {upcomingRegisteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center space-x-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors"
                  >
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex flex-col items-center justify-center text-jci-blue flex-shrink-0">
                      <span className="text-xs font-bold uppercase">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                      <span className="text-lg font-bold leading-none">{new Date(event.date).getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 truncate">{event.title}</h4>
                      <p className="text-xs text-slate-500">{event.type} • {event.attendees ?? 0} Attending</p>
                    </div>
                    {event.predictedDemand === 'High' && <Badge variant="jci">Hot</Badge>}
                  </div>
                ))}
              </div>
              {onNavigate && (
                <Button variant="ghost" className="w-full mt-4 text-sm" onClick={() => onNavigate('EVENTS')}>
                  View All Events
                </Button>
              )}
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Behavioral Nudges */}
      {nudges.length > 0 && (
        <div className="space-y-3">
          {nudges.slice(0, 3).map(nudge => (
            <NudgeBanner
              key={nudge.id}
              nudge={nudge}
              onDismiss={dismissNudge}
            />
          ))}
        </div>
      )}

      {/* AI Insight Header */}
      <div className="bg-gradient-to-r from-jci-navy to-jci-blue rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10"></div>
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Sparkles className="text-yellow-400" size={20} />
              <span className="font-semibold text-yellow-100 uppercase text-xs tracking-wider">AI Insight</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Good afternoon, {member.name}!</h2>
            {loadingRecommendations ? (
              <p className="text-blue-100 max-w-xl">Loading personalized recommendations...</p>
            ) : topRecommendation ? (
              <p className="text-blue-100 max-w-xl">
                Based on your profile and activity, we recommend{' '}
                <strong>{topRecommendation.itemName}</strong>.
                {topRecommendation.reasons.length > 0 && (
                  <> {topRecommendation.reasons[0]}</>
                )}
                {topRecommendation.matchScore >= 80 && (
                  <> ({topRecommendation.matchScore}% match)</>
                )}
              </p>
            ) : (
              <p className="text-blue-100 max-w-xl">
                Welcome back! Check out upcoming events and projects to get involved.
              </p>
            )}
          </div>
          <div className="hidden md:block">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
              <p className="text-sm text-blue-100 mb-1">Current Tier</p>
              <div className="flex items-center space-x-2">
                <Award className="text-yellow-400" size={24} />
                <span className="text-2xl font-bold">{member.tier}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role-Based Quick Entries */}
      <Card title="Your Quick Entries" className="border-l-4 border-l-jci-teal">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {(
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4"
              onClick={() => onNavigate?.('PAYMENT_REQUESTS')}
            >
              <FileText size={20} className="text-jci-teal" />
              <span className="text-xs">{hasPermission('canViewFinance') ? 'Payment Requests' : 'My Applications'}</span>
            </Button>
          )}
          {hasPermission('canViewFinance') && (
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4"
              onClick={() => onNavigate?.('FINANCE')}
            >
              <DollarSign size={20} className="text-jci-teal" />
              <span className="text-xs">{isActivityFinance ? 'Activity Finance' : 'Finances'}</span>
            </Button>
          )}
          {(isOrganizationSecretary || isBoard || isAdmin || isDeveloper) && (
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4"
              onClick={() => onNavigate?.('MEMBERS')}
            >
              <UserCog size={20} className="text-jci-teal" />
              <span className="text-xs">Member Profiles</span>
            </Button>
          )}
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => onNavigate?.('EVENTS')}
          >
            <Calendar size={20} className="text-jci-blue" />
            <span className="text-xs">Events</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => onNavigate?.('PROJECTS')}
          >
            <Briefcase size={20} className="text-jci-blue" />
            <span className="text-xs">Projects</span>
          </Button>
        </div>
      </Card>

      {/* Stats Grid */}
      <StatCardsContainer>
        <StatCard
          title="Total Points"
          value={(member.points || 0).toLocaleString()}
          icon={<Award size={20} />}
          subtext={rankPercentile > 0 ? `Top ${rankPercentile}% of members` : 'Ranking...'}
        />
        <StatCard
          title="Upcoming Events"
          value={upcomingEvents.length.toString()}
          icon={<Calendar size={20} />}
          subtext={`${events.filter(e => e.attendees > 0 && e.status === 'Upcoming').length} Registered`}
        />
        <StatCard
          title="My Projects"
          value={myProjects.length.toString()}
          icon={<Briefcase size={20} />}
          subtext={`${myProjects.filter(p => p.status === 'Active').length} Active`}
        />
        <StatCard
          title="Notifications"
          value={unreadNotifications.length.toString()}
          icon={<Bell size={20} />}
          subtext="Unread messages"
        />
      </StatCardsContainer>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
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

          {/* Personalized Recommendations */}
          {recommendations.length > 0 && (
            <Card title="Recommended for You" className="border-l-4 border-l-purple-500">
              <div className="space-y-3">
                {recommendations.slice(0, 5).map((rec, idx) => (
                  <div
                    key={rec.itemId}
                    className="p-4 rounded-lg border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all bg-gradient-to-r from-white to-purple-50/30"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={rec.priority === 'High' ? 'error' : rec.priority === 'Medium' ? 'warning' : 'neutral'} className="text-xs">
                            {rec.type === 'project' ? 'Project' :
                              rec.type === 'event' ? 'Event' :
                                rec.type === 'training' ? 'Training' :
                                  rec.type === 'hobby_club' ? 'Club' : 'Opportunity'}
                          </Badge>
                          <span className="text-xs text-slate-500">{rec.matchScore}% match</span>
                        </div>
                        <h4 className="font-semibold text-slate-900 mb-1">{rec.itemName}</h4>
                        {rec.reasons.length > 0 && (
                          <p className="text-sm text-slate-600 mb-2">{rec.reasons[0]}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (onNavigate && rec.actionUrl) {
                            // Extract view type from actionUrl
                            const urlParts = rec.actionUrl.split('/');
                            const viewType = urlParts[urlParts.length - 1].toUpperCase();
                            onNavigate(viewType);
                          } else if (rec.actionUrl) {
                            window.location.href = rec.actionUrl;
                          }
                        }}
                        className="flex-1"
                      >
                        {rec.type === 'project' ? 'View Project' :
                          rec.type === 'event' ? 'Register' :
                            rec.type === 'training' ? 'Start Learning' :
                              rec.type === 'hobby_club' ? 'Join Club' : 'Learn More'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Quick Actions */}
          <Card title="Quick Actions">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={() => onNavigate?.('EVENTS')}
              >
                <Calendar size={20} className="text-jci-blue" />
                <span className="text-xs">Register Event</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={() => onNavigate?.('PROJECTS')}
              >
                <Briefcase size={20} className="text-jci-blue" />
                <span className="text-xs">New Project</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={() => onNavigate?.('MEMBERS')}
              >
                <Users size={20} className="text-jci-blue" />
                <span className="text-xs">Find Mentor</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={() => onNavigate?.('GAMIFICATION')}
              >
                <Target size={20} className="text-jci-blue" />
                <span className="text-xs">Set Goals</span>
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <PointsDistributionChart pointHistory={pointHistory} />

          {recommendedEvents.length > 0 && (
            <Card title="推荐活动（基于参与历史）">
              <p className="text-xs text-slate-500 mb-2">根据您过往参与类型推荐，减少无关打扰</p>
              {loadingRecommendedEvents ? (
                <div className="text-center py-4 text-slate-400 text-sm">加载中…</div>
              ) : (
                <div className="space-y-2">
                  {recommendedEvents.map((event) => (
                    <div key={event.id} className="flex items-center space-x-3 pb-2 border-b border-slate-50 last:border-0 text-sm">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex flex-col items-center justify-center text-jci-blue flex-shrink-0">
                        <span className="text-xs font-bold">{new Date(event.date).getDate()}</span>
                        <span className="text-xs">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{event.title}</p>
                        <p className="text-xs text-slate-500">{event.type}</p>
                      </div>
                      {onNavigate && (
                        <Button variant="ghost" size="sm" onClick={() => onNavigate('EVENTS')}>查看</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card title="Upcoming Events">
            {eventsLoading ? (
              <div className="text-center py-8 text-slate-400 text-sm">Loading events...</div>
            ) : upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No upcoming events</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {upcomingEvents.slice(0, 3).map(event => (
                    <div key={event.id} className="flex items-center space-x-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors">
                      <div className="w-12 h-12 bg-blue-50 rounded-lg flex flex-col items-center justify-center text-jci-blue flex-shrink-0">
                        <span className="text-xs font-bold uppercase">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                        <span className="text-lg font-bold leading-none">{new Date(event.date).getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">{event.title}</h4>
                        <p className="text-xs text-slate-500">{event.type} • {event.attendees} Attending</p>
                      </div>
                      {event.predictedDemand === 'High' && (
                        <Badge variant="jci">Hot</Badge>
                      )}
                    </div>
                  ))}
                </div>
                {upcomingEvents.length > 3 && (
                  <Button variant="ghost" className="w-full mt-4 text-sm">View All {upcomingEvents.length} Events</Button>
                )}
              </>
            )}
          </Card>

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
        </div>
      </div>
    </div>
  );
};

