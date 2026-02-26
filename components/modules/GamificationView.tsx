import React, { useState, useMemo } from 'react';
import { Award, TrendingUp, Star, Crown, Zap, PlusCircle, Settings, Eye, EyeOff, Users as UsersIcon } from 'lucide-react';
import { Card, Button, ProgressBar, Badge, Modal, useToast, Tabs } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { usePoints } from '../../hooks/usePoints';
import { useAuth } from '../../hooks/useAuth';
import { POINT_CATEGORIES } from '../../config/constants';
import { usePermissions } from '../../hooks/usePermissions';
import { useGamification } from '../../hooks/useGamification';
import { PointsService } from '../../services/pointsService';
import { formatDate } from '../../utils/dateUtils';
import { LOStarDashboard } from './LOStarDashboard';
import { SubmitEvidenceView } from './SubmitEvidenceView';
import { ApprovalWorkspaceView } from './ApprovalWorkspaceView';
import { IncentiveProgramManager } from './IncentiveProgramManager';
import { BehavioralNudgingConfig } from './BehavioralNudgingConfig';
import { BadgeProgressTracker } from './BadgeProgressTracker';
import { AwardsView } from './AwardsView';

export const GamificationView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLogModalOpen, setLogModalOpen] = useState(false);
  const [leaderboardVisibility, setLeaderboardVisibility] = useState<'public' | 'members_only' | 'private'>('public');
  const [isVisibilityModalOpen, setVisibilityModalOpen] = useState(false);
  const { member } = useAuth();
  const { hasPermission, isAdmin, isBoard } = usePermissions();
  const { leaderboard, loading, error, loadLeaderboard } = usePoints();
  const {
    awards,
    memberAwards,
    loading: gamificationLoading
  } = useGamification(member?.id);
  const { showToast } = useToast();

  const filteredLeaderboard = useMemo(() => {
    const term = (searchQuery || '').toLowerCase();
    if (!term) return leaderboard;
    return leaderboard.filter(m =>
      (m.name ?? '').toLowerCase().includes(term) ||
      (m.email ?? '').toLowerCase().includes(term) ||
      (m.tier ?? '').toLowerCase().includes(term)
    );
  }, [leaderboard, searchQuery]);

  const sortedMembers = [...filteredLeaderboard];
  const currentUserRank = member ? leaderboard.findIndex(m => m.id === member.id) + 1 : 0;

  // Load member's visibility preference
  React.useEffect(() => {
    if (member?.leaderboardVisibility) {
      setLeaderboardVisibility(member.leaderboardVisibility);
    }
  }, [member]);

  const handleUpdateVisibility = async (visibility: 'public' | 'members_only' | 'private') => {
    if (!member) return;

    try {
      await PointsService.updateLeaderboardVisibility(member.id, visibility);
      setLeaderboardVisibility(visibility);
      setVisibilityModalOpen(false);
      showToast('Leaderboard visibility updated', 'success');
      await loadLeaderboard(50);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update visibility';
      showToast(errorMessage, 'error');
    }
  };

  const handleLogActivity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!member) {
      showToast('Please login to log activities', 'error');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as string;
    const description = formData.get('description') as string;
    const amount = formData.get('amount') ? parseInt(formData.get('amount') as string) : 50;

    try {
      await PointsService.awardPoints(
        member.id,
        category as string,
        amount,
        description,
        undefined,
        undefined
      );

      await loadLeaderboard();
      showToast('Activity submitted (+50 pts pending)', 'success');
      setLogModalOpen(false);
      e.currentTarget.reset();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to log activity';
      showToast(errorMessage, 'error');
    }
  }

  const canManagePoints = isAdmin || isBoard || (hasPermission && hasPermission('canManageSettings'));
  const canApprove = (hasPermission && hasPermission('canApproveClaims')) || isAdmin || isBoard;

  const availableTabs = [
    { id: 'overview', label: 'My Profile' },
    { id: 'lo_star', label: 'LO Star Rating' },
    { id: 'submit_evidence', label: 'Submit Evidence' },
    { id: 'awards', label: 'Awards' },
  ];

  if (canManagePoints) {
    availableTabs.push({ id: 'rules', label: 'Program Config' });
    availableTabs.push({ id: 'nudging', label: 'Behavioral Nudging' });
  }

  if (canApprove) {
    availableTabs.push({ id: 'approvals', label: 'Approvals' });
  }

  const tabLabels = availableTabs.map(t => t.label);
  const getTabLabel = (id: string) => availableTabs.find(t => t.id === id)?.label || 'My Profile';
  const getTabId = (label: string) => availableTabs.find(t => t.label === label)?.id || 'overview';

  return (
    <div className="space-y-6">
      {availableTabs.length > 1 && (
        <Tabs
          tabs={tabLabels}
          activeTab={getTabLabel(activeTab)}
          onTabChange={(tab) => setActiveTab(getTabId(tab))}
        />
      )}

      {activeTab === 'rules' ? (
        <IncentiveProgramManager />
      ) : activeTab === 'approvals' ? (
        <ApprovalWorkspaceView />
      ) : activeTab === 'lo_star' ? (
        <LOStarDashboard />
      ) : activeTab === 'submit_evidence' ? (
        <SubmitEvidenceView />
      ) : activeTab === 'awards' ? (
        <AwardsView searchQuery={searchQuery} />
      ) : activeTab === 'nudging' ? (
        <BehavioralNudgingConfig />
      ) : (
        <LoadingState loading={gamificationLoading} empty={false}>
          {/* Hero Section */}
          <div className="relative rounded-2xl bg-gradient-to-r from-indigo-600 to-jci-blue text-white p-8 overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Crown size={180} />
            </div>
            {member && (
              <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
                <div className="relative">
                  <img src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=0097D7&color=fff`} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white/30 shadow-xl" />
                  <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full border border-white">
                    {member.tier}
                  </div>
                </div>
                <div className="text-center md:text-left flex-1">
                  <h2 className="text-3xl font-bold mb-1">{member.name}</h2>
                  <p className="text-blue-100 mb-4">{member.tier} Member • {member.role}</p>
                  <div className="flex flex-wrap justify-center md:justify-start gap-3">
                    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg">
                      <span className="block text-2xl font-bold">{member.points}</span>
                      <span className="text-xs text-blue-100 uppercase tracking-wider">Total Points</span>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg">
                      <span className="block text-2xl font-bold">#{currentUserRank || 'N/A'}</span>
                      <span className="text-xs text-blue-100 uppercase tracking-wider">Rank</span>
                    </div>
                  </div>
                </div>
                <div className="md:self-center">
                  <Button variant="secondary" onClick={() => setLogModalOpen(true)}><PlusCircle size={16} className="mr-2" /> Log Activity</Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card title="My Awards">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {memberAwards.filter(a => a.isEarned).map(award => (
                      <div key={award.id} className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 border border-slate-100 hover:shadow-md transition-all group">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300 filter drop-shadow-sm">{award.icon}</div>
                        <h4 className="font-bold text-slate-900 text-sm">{award.name}</h4>
                        <Badge variant="jci" className="text-[10px] mt-1">{award.category}</Badge>
                      </div>
                    ))}

                    {memberAwards.filter(a => a.isEarned).length === 0 && (
                      <div className="col-span-full py-8 text-center text-slate-400">
                        <Award className="mx-auto mb-2 opacity-20" size={48} />
                        <p>No awards earned yet. Start your journey!</p>
                      </div>
                    )}
                  </div>

                  {memberAwards.filter(a => a.isEarned).length > 0 && (
                    <div className="border-t border-slate-100 pt-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recent Recognition</h4>
                      <div className="space-y-2">
                        {memberAwards.filter(a => a.isEarned).sort((a, b) => {
                          const timeA = new Date(a.earnedAt?.toDate?.() || a.earnedAt || 0).getTime();
                          const timeB = new Date(b.earnedAt?.toDate?.() || b.earnedAt || 0).getTime();
                          return timeB - timeA;
                        }).slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-slate-50">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{item.icon}</span>
                              <div>
                                <span className="font-medium text-slate-700">{item.name}</span>
                                <span className="text-[10px] text-slate-400 ml-2 uppercase">{item.category}</span>
                              </div>
                            </div>
                            <span className="text-xs text-slate-400">{formatDate(item.earnedAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                <Card title="Progress to Awards">
                  {member && (
                    <BadgeProgressTracker
                      member={member}
                      availableBadges={awards}
                      earnedBadgeIds={memberAwards.filter(a => a.isEarned).map(a => a.id!)}
                    />
                  )}
                </Card>

                <Card title="Top Achievements In Progress">
                  <div className="space-y-4">
                    {memberAwards.filter(a => !a.isEarned && (a.progress || 0) > 0).slice(0, 3).map(award => {
                      const percent = award.progress || 0;
                      return (
                        <div key={award.id}>
                          <div className="flex justify-between mb-1">
                            <span className="font-medium text-slate-800 text-sm">{award.name}</span>
                            <span className="text-xs text-slate-500">{percent}%</span>
                          </div>
                          <ProgressBar progress={percent} color="bg-jci-blue" />
                        </div>
                      );
                    })}
                    {memberAwards.filter(a => !a.isEarned && (a.progress || 0) > 0).length === 0 && (
                      <div className="text-center py-4 text-slate-400 text-sm">
                        Keep moving to see progress!
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>

            <Card
              title={
                <div className="flex items-center justify-between w-full">
                  <span>Leaderboard</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral" className="text-xs">
                      {leaderboardVisibility === 'public' ? 'Public' :
                        leaderboardVisibility === 'members_only' ? 'Members Only' : 'Private'}
                    </Badge>
                    <button
                      onClick={() => setVisibilityModalOpen(true)}
                      className="text-slate-400 hover:text-jci-blue transition-colors"
                      title="Configure visibility"
                    >
                      <Settings size={16} />
                    </button>
                  </div>
                </div>
              }
              className="h-fit"
            >
              <LoadingState loading={loading} error={error} empty={sortedMembers.length === 0} emptyMessage="No leaderboard data">
                <div className="space-y-4">
                  {(searchQuery ? sortedMembers : sortedMembers.slice(0, 10)).map((member, index) => (
                    <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 text-center font-bold ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {index + 1}
                        </div>
                        <img src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=0097D7&color=fff`} alt={member.name} className="w-8 h-8 rounded-full bg-slate-200" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                          <p className="text-xs text-slate-500">{member.tier}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-jci-blue">{member.points}</span>
                        <span className="text-xs text-slate-400 block">pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </LoadingState>
              <Button variant="outline" className="w-full mt-4 text-sm">View Full Ranking</Button>
            </Card>

            <Modal
              isOpen={isVisibilityModalOpen}
              onClose={() => setVisibilityModalOpen(false)}
              title="Leaderboard Visibility Settings"
              drawerOnMobile
            >
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Choose who can see your ranking on the leaderboard.
                </p>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={leaderboardVisibility === 'public'}
                      onChange={(e) => handleUpdateVisibility(e.target.value as any)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Eye size={18} className="text-green-600" />
                        <span className="font-semibold text-slate-900">Public</span>
                      </div>
                      <p className="text-sm text-slate-600">Everyone can see your ranking</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="visibility"
                      value="members_only"
                      checked={leaderboardVisibility === 'members_only'}
                      onChange={(e) => handleUpdateVisibility(e.target.value as any)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <UsersIcon size={18} className="text-blue-600" />
                        <span className="font-semibold text-slate-900">Members Only</span>
                      </div>
                      <p className="text-sm text-slate-600">Only logged-in members can see your ranking</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={leaderboardVisibility === 'private'}
                      onChange={(e) => handleUpdateVisibility(e.target.value as any)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <EyeOff size={18} className="text-slate-600" />
                        <span className="font-semibold text-slate-900">Private</span>
                      </div>
                      <p className="text-sm text-slate-600">Only you can see your ranking</p>
                    </div>
                  </label>
                </div>
                <div className="pt-4">
                  <Button variant="ghost" onClick={() => setVisibilityModalOpen(false)} className="w-full">
                    Close
                  </Button>
                </div>
              </div>
            </Modal>
          </div>

          <Modal isOpen={isLogModalOpen} onClose={() => setLogModalOpen(false)} title="Log External Activity" drawerOnMobile>
            <form onSubmit={handleLogActivity} className="space-y-4">
              <p className="text-sm text-slate-500">Did you participate in an activity not tracked by the system? Log it here for points.</p>
              <Select name="category" label="Activity Type" options={[
                { label: 'External Training', value: POINT_CATEGORIES.TRAINING },
                { label: 'Community Service (Non-JCI)', value: POINT_CATEGORIES.EVENT_ATTENDANCE },
                { label: 'Mentorship Session', value: POINT_CATEGORIES.ROLE_FULFILLMENT }
              ]} required />
              <Input name="description" label="Description" placeholder="What did you do?" required />
              <Input name="date" label="Date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
              <Input name="amount" label="Points" type="number" defaultValue="50" min="1" required />
              <div className="pt-4">
                <Button className="w-full" type="submit">Submit for Verification</Button>
              </div>
            </form>
          </Modal>
        </LoadingState>
      )}
    </div>
  );
};