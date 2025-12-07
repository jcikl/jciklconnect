import React, { useState } from 'react';
import { Award, TrendingUp, Star, Crown, Zap, PlusCircle } from 'lucide-react';
import { Card, Button, ProgressBar, Badge, Modal, useToast } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { CURRENT_USER, MOCK_MEMBERS } from '../../services/mockData';

export const GamificationView: React.FC = () => {
  const sortedMembers = [...MOCK_MEMBERS].sort((a, b) => b.points - a.points);
  const [isLogModalOpen, setLogModalOpen] = useState(false);
  const { showToast } = useToast();

  const handleLogActivity = (e: React.FormEvent) => {
      e.preventDefault();
      showToast('Activity submitted for verification (+50 pts pending)', 'success');
      setLogModalOpen(false);
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative rounded-2xl bg-gradient-to-r from-indigo-600 to-jci-blue text-white p-8 overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Crown size={180} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="relative">
                <img src={CURRENT_USER.avatar} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white/30 shadow-xl" />
                <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full border border-white">
                    Lvl 12
                </div>
            </div>
            <div className="text-center md:text-left flex-1">
                <h2 className="text-3xl font-bold mb-1">{CURRENT_USER.name}</h2>
                <p className="text-blue-100 mb-4">{CURRENT_USER.tier} Member • {CURRENT_USER.role}</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg">
                        <span className="block text-2xl font-bold">{CURRENT_USER.points}</span>
                        <span className="text-xs text-blue-100 uppercase tracking-wider">Total Points</span>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg">
                        <span className="block text-2xl font-bold">#{sortedMembers.findIndex(m => m.id === CURRENT_USER.id) + 1}</span>
                        <span className="text-xs text-blue-100 uppercase tracking-wider">Rank</span>
                    </div>
                </div>
            </div>
            <div className="md:self-center">
                <Button variant="secondary" onClick={() => setLogModalOpen(true)}><PlusCircle size={16} className="mr-2"/> Log Activity</Button>
            </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Badges & Achievements */}
        <div className="lg:col-span-2 space-y-6">
            <Card title="My Badges">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {CURRENT_USER.badges.map(badge => (
                        <div key={badge.id} className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 border border-slate-100 hover:shadow-md transition-all group">
                            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300 filter drop-shadow-sm">{badge.icon}</div>
                            <h4 className="font-bold text-slate-900 text-sm">{badge.name}</h4>
                            <p className="text-xs text-slate-500 mt-1">{badge.description}</p>
                        </div>
                    ))}
                    {/* Locked Badge Placeholder */}
                    <div className="flex flex-col items-center text-center p-4 rounded-xl border border-dashed border-slate-200 opacity-60 grayscale">
                        <div className="text-4xl mb-3">🌍</div>
                        <h4 className="font-bold text-slate-900 text-sm">Global Citizen</h4>
                        <p className="text-xs text-slate-500 mt-1">Attend 1 Intl Event</p>
                    </div>
                </div>
            </Card>

            <Card title="Current Goals">
                <div className="space-y-5">
                    <div>
                        <div className="flex justify-between mb-1">
                            <span className="font-medium text-slate-800 text-sm">Recruitment Drive</span>
                            <span className="text-xs text-slate-500">2 / 3 Members</span>
                        </div>
                        <ProgressBar progress={66} color="bg-green-500" />
                        <p className="text-xs text-slate-400 mt-1">Reward: 500 Points + "Growth Hacker" Badge</p>
                    </div>
                    <div>
                        <div className="flex justify-between mb-1">
                            <span className="font-medium text-slate-800 text-sm">Training Attendance</span>
                            <span className="text-xs text-slate-500">40 / 50 Hours</span>
                        </div>
                        <ProgressBar progress={80} color="bg-indigo-500" />
                    </div>
                </div>
            </Card>
        </div>

        {/* Leaderboard */}
        <Card title="Leaderboard" className="h-fit">
            <div className="space-y-4">
                {sortedMembers.map((member, index) => (
                    <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className={`w-6 text-center font-bold ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-amber-600' : 'text-slate-400'}`}>
                                {index + 1}
                            </div>
                            <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full bg-slate-200" />
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
            <Button variant="outline" className="w-full mt-4 text-sm">View Full Ranking</Button>
        </Card>
      </div>

      <Modal isOpen={isLogModalOpen} onClose={() => setLogModalOpen(false)} title="Log External Activity">
          <form onSubmit={handleLogActivity} className="space-y-4">
              <p className="text-sm text-slate-500">Did you participate in an activity not tracked by the system? Log it here for points.</p>
              <Select label="Activity Type" options={[
                  {label: 'External Training', value: 'training'},
                  {label: 'Community Service (Non-JCI)', value: 'service'},
                  {label: 'Mentorship Session', value: 'mentorship'}
              ]} />
              <Input label="Description" placeholder="What did you do?" />
              <Input label="Date" type="date" />
              <Input label="Hours Spent" type="number" />
              <div className="pt-4">
                  <Button className="w-full" type="submit">Submit for Verification</Button>
              </div>
          </form>
      </Modal>
    </div>
  );
};