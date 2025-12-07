import React, { useState } from 'react';
import { Sparkles, ArrowLeft, Phone, Mail, Award, Clock, Briefcase, GraduationCap, UserPlus } from 'lucide-react';
import { Button, Card, Badge, ProgressBar, Modal, useToast } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { MOCK_MEMBERS } from '../../services/mockData';
import { UserRole, Member, MemberTier } from '../../types';

export const MembersView: React.FC = () => {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>(MOCK_MEMBERS);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const { showToast } = useToast();

  const selectedMember = members.find(m => m.id === selectedMemberId);

  const handleAddMember = (e: React.FormEvent) => {
      e.preventDefault();
      // In a real app, you would get data from the form event.
      // For this simulation, we'll add a pre-defined new member.
      const newMember: Member = {
          id: `u${Date.now()}`,
          name: 'New Member',
          email: 'new.member@jci.local',
          role: UserRole.MEMBER,
          tier: MemberTier.BRONZE,
          points: 0,
          joinDate: new Date().toISOString().split('T')[0],
          avatar: `https://i.pravatar.cc/150?u=${Date.now()}`,
          skills: [],
          churnRisk: 'Low',
          attendanceRate: 100,
          duesStatus: 'Pending',
          badges: []
      };
      setMembers([newMember, ...members]);
      setAddModalOpen(false);
      showToast('Member added successfully', 'success');
  };

  return (
    <div className="space-y-6">
      {!selectedMember ? (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                <h2 className="text-2xl font-bold text-slate-900">Member Directory</h2>
                <p className="text-slate-500">Manage membership, tiers, and engagement.</p>
                </div>
                <div className="flex space-x-2">
                <Button variant="outline"><Sparkles size={16} className="mr-2"/> AI Analysis</Button>
                <Button onClick={() => setAddModalOpen(true)}><UserPlus size={16} className="mr-2"/> Add Member</Button>
                </div>
            </div>
            <MemberTable members={members} onSelect={setSelectedMemberId} />
        </>
      ) : (
        <MemberDetail member={selectedMember} onBack={() => setSelectedMemberId(null)} />
      )}

      <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title="Register New Member">
          <form onSubmit={handleAddMember} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <Input label="First Name" placeholder="John" required />
                  <Input label="Last Name" placeholder="Doe" required />
              </div>
              <Input label="Email Address" type="email" placeholder="john.doe@example.com" required />
              <Input label="Phone Number" type="tel" />
              <Select label="Role" options={[
                  {label: 'Member', value: UserRole.MEMBER},
                  {label: 'Board', value: UserRole.BOARD}
              ]} />
              <div className="pt-4">
                  <Button className="w-full" type="submit">Register Member</Button>
              </div>
          </form>
      </Modal>
    </div>
  );
};

const MemberTable: React.FC<{members: Member[], onSelect: (id: string) => void}> = ({members, onSelect}) => (
    <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Member</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Role</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Tier / Points</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Engagement</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Risk Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map(member => (
                <tr key={member.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onSelect(member.id)}>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full bg-slate-200" />
                      <div>
                        <div className="font-medium text-slate-900">{member.name}</div>
                        <div className="text-xs text-slate-500">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={member.role === UserRole.BOARD ? 'info' : 'neutral'}>{member.role}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`text-sm font-medium ${member.tier === 'Platinum' ? 'text-purple-600' : member.tier === 'Gold' ? 'text-amber-600' : 'text-slate-600'}`}>
                        {member.tier}
                      </span>
                      <span className="text-xs text-slate-500">{member.points} pts</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 w-48">
                    <div className="flex items-center space-x-2">
                       <ProgressBar progress={member.attendanceRate} color={member.attendanceRate < 50 ? 'bg-red-500' : 'bg-green-500'} />
                       <span className="text-xs font-medium text-slate-600">{member.attendanceRate}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     {member.churnRisk === 'High' && (
                       <Badge variant="error">At Risk</Badge>
                     )}
                     {member.churnRisk === 'Low' && (
                       <Badge variant="success">Stable</Badge>
                     )}
                     {member.churnRisk === 'Medium' && (
                       <Badge variant="warning">Monitor</Badge>
                     )}
                  </td>
                  <td className="px-6 py-4">
                    <Button variant="ghost" size="sm">View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </Card>
);

const MemberDetail: React.FC<{member: Member, onBack: () => void}> = ({member, onBack}) => {
    // Lookup Names
    const mentor = MOCK_MEMBERS.find(m => m.id === member.mentorId);
    const mentees = MOCK_MEMBERS.filter(m => member.menteeIds?.includes(m.id));

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <Button variant="ghost" onClick={onBack} className="text-slate-500"><ArrowLeft size={16} className="mr-2"/> Back to Directory</Button>
            
            {/* Header Card */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="h-32 bg-gradient-to-r from-jci-blue to-jci-navy"></div>
                <div className="px-8 pb-8">
                    <div className="relative flex justify-between items-end -mt-12 mb-6">
                        <img src={member.avatar} className="w-24 h-24 rounded-full border-4 border-white bg-slate-100 shadow-md" alt="" />
                        <div className="flex gap-2 mb-2">
                             <Button variant="outline"><Mail size={16} className="mr-2"/> Message</Button>
                             <Button>Edit Profile</Button>
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{member.name}</h1>
                        <p className="text-slate-500 flex items-center gap-4 mt-1">
                            <span>{member.email}</span>
                            <span>•</span>
                            <span>{member.role}</span>
                            <span>•</span>
                            <span className="text-jci-blue font-medium">{member.tier} Member</span>
                        </p>
                    </div>
                    {member.bio && <p className="mt-4 text-slate-600 max-w-3xl">{member.bio}</p>}
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Left Column: Stats & Mentorship */}
                <div className="space-y-6">
                     <Card title="Quick Stats">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-slate-50 rounded-lg text-center">
                                <span className="block text-2xl font-bold text-slate-900">{member.points}</span>
                                <span className="text-xs text-slate-500 uppercase">Points</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg text-center">
                                <span className="block text-2xl font-bold text-slate-900">{member.attendanceRate}%</span>
                                <span className="text-xs text-slate-500 uppercase">Attendance</span>
                            </div>
                        </div>
                     </Card>

                     <Card title="Mentorship & Growth">
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Current Mentor</h4>
                                {mentor ? (
                                    <div className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer">
                                        <img src={mentor.avatar} className="w-10 h-10 rounded-full" alt="" />
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{mentor.name}</p>
                                            <p className="text-xs text-slate-500">{mentor.role}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center">
                                        <p className="text-sm text-slate-500 mb-2">No mentor assigned</p>
                                        <Button size="sm" variant="outline">Assign Mentor</Button>
                                    </div>
                                )}
                            </div>

                            {mentees.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Mentees</h4>
                                    <div className="space-y-2">
                                        {mentees.map(m => (
                                             <div key={m.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                                                <img src={m.avatar} className="w-8 h-8 rounded-full" alt="" />
                                                <span className="text-sm font-medium">{m.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                     </Card>

                     <Card title="Skills Matrix">
                        <div className="flex flex-wrap gap-2">
                            {member.skills.map(skill => (
                                <Badge key={skill} variant="neutral">{skill}</Badge>
                            ))}
                            <button className="px-2 py-1 text-xs border border-dashed border-slate-300 rounded hover:border-jci-blue hover:text-jci-blue transition-colors">
                                + Add
                            </button>
                        </div>
                     </Card>
                </div>

                {/* Right Column: JCI Career & History */}
                <div className="lg:col-span-2 space-y-6">
                    <Card title="JCI Career Path">
                        <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                             {/* Join Milestone */}
                             <div className="relative">
                                <div className="absolute -left-8 bg-green-100 text-green-600 p-1 rounded-full border-4 border-white">
                                    <UserPlus size={14} />
                                </div>
                                <span className="text-xs text-slate-400 font-mono mb-1 block">{member.joinDate}</span>
                                <h4 className="text-sm font-bold text-slate-900">Joined JCI Local Chapter</h4>
                             </div>
                             
                             {member.careerHistory?.map((milestone, idx) => (
                                 <div key={idx} className="relative">
                                    <div className="absolute -left-8 bg-blue-100 text-jci-blue p-1 rounded-full border-4 border-white">
                                        <Briefcase size={14} />
                                    </div>
                                    <span className="text-xs text-slate-400 font-mono mb-1 block">{milestone.year}</span>
                                    <h4 className="text-sm font-bold text-slate-900">{milestone.role}</h4>
                                    <p className="text-sm text-slate-600">{milestone.description}</p>
                                 </div>
                             ))}
                             
                             {/* Future Goals Mockup */}
                             <div className="relative opacity-50">
                                <div className="absolute -left-8 bg-slate-100 text-slate-400 p-1 rounded-full border-4 border-white">
                                    <GraduationCap size={14} />
                                </div>
                                <span className="text-xs text-slate-400 font-mono mb-1 block">2025 (Goal)</span>
                                <h4 className="text-sm font-bold text-slate-900">Regional Officer</h4>
                             </div>
                        </div>
                    </Card>

                    <Card title="Recent Badges">
                         <div className="flex gap-4">
                            {member.badges.map(b => (
                                <div key={b.id} className="text-center">
                                    <div className="text-3xl mb-1">{b.icon}</div>
                                    <div className="text-xs font-medium text-slate-900">{b.name}</div>
                                </div>
                            ))}
                         </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}