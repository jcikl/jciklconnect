import * as React from 'react';
import { GraduationCap, Award, Target, Sparkles, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, Badge, Button } from '../../ui/Common';
import type { Member } from '../../../types';
import { formatDateToDDMMMYYYY } from '../../../utils/dateUtils';
import { PointsSourceRadarChart } from '../../dashboard/Analytics';

interface MemberDetailActivitiesTabProps {
  member: Member;
  activitiesLoading: boolean;
  radarContributions: any[];
  groupedRadarContributions: { groups: { [year: string]: any[] }; sortedYears: string[] };
  sponsorshipRecords: any[];
  projectRoles: any[];
  recruitedMembers: any[];
  isPresident: boolean;
  canEditMembers: boolean;
  isSelfView: boolean;
  setShowAssessmentModal: (v: boolean) => void;
  pillarDiagnosis: { individual: number; business: number; community: number; international: number; dominant: string };
  radarYear: number;
  setRadarYear: (y: number) => void;
  availableYears: number[];
}

const MemberDetailActivitiesTabBase: React.FC<MemberDetailActivitiesTabProps> = (props) => {
  const {
    member, activitiesLoading, radarContributions, groupedRadarContributions,
    sponsorshipRecords, projectRoles, recruitedMembers, isPresident,
    canEditMembers, isSelfView, setShowAssessmentModal, pillarDiagnosis,
    radarYear, setRadarYear, availableYears,
  } = props;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {canEditMembers && <div className="grid grid-cols-2 gap-3 md:gap-6">
        <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-none shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Target size={120} />
          </div>
          <div className="relative z-10 p-2">
            <div className="flex justify-between items-center mb-4 gap-2">
              <h3 className="text-sm font-black text-blue-300 uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={16} /> JCI Pillar Diagnosis
              </h3>
              {(canEditMembers || isSelfView) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAssessmentModal(true)}
                  className="text-[10px] bg-white/10 hover:bg-white/20 text-white border border-white/20 px-2.5 py-1 h-auto flex items-center gap-1 font-bold rounded-lg transition-all"
                >
                  <Settings size={12} />
                  Update Assessment
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Individual', val: pillarDiagnosis.individual, color: 'bg-blue-400' },
                { label: 'Business', val: pillarDiagnosis.business, color: 'bg-emerald-400' },
                { label: 'Community', val: pillarDiagnosis.community, color: 'bg-purple-400' },
                { label: 'International', val: pillarDiagnosis.international, color: 'bg-orange-400' }
              ].map((p, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                    <span>{p.label}</span>
                    <span>{p.val}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.val}%` }}
                      className={`h-full ${p.color} shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-3 bg-white/5 rounded-xl border border-white/10">
              <p className="text-[10px] text-blue-200 font-bold uppercase mb-1">Dominant Persona</p>
              <p className="text-lg font-black italic text-white flex items-center gap-2">
                {pillarDiagnosis.dominant}
                <Badge className="bg-jci-blue text-blue text-[8px]">AI Profile</Badge>
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border-2 border-slate-900 border-b-8 border-r-8 hover:translate-x-1 hover:translate-y-1 transition-all flex flex-col justify-between">
          <div className="p-2 h-full flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Target size={16} className="text-jci-blue animate-pulse" /> Elite Leaderboard Radar
              </h3>
              <div className="relative">
                <select
                  value={radarYear}
                  onChange={(e) => setRadarYear(Number(e.target.value))}
                  className="appearance-none bg-slate-100 text-jci-blue text-[10px] font-black uppercase tracking-wider rounded-full pl-2.5 pr-6 py-1 border border-slate-200 cursor-pointer hover:bg-slate-200/70 transition-all focus:outline-none focus:ring-1 focus:ring-jci-blue/50"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%230097D7' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
                >
                  {availableYears.map(y => (
                    <option key={y} value={y} className="bg-white text-slate-900">{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1 min-h-[220px] w-full relative">
              <PointsSourceRadarChart memberId={member.id} year={radarYear} lightTheme={true} />
            </div>
          </div>
        </Card>
      </div>}

      <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Radar Contributions / Events Log */}
        <Card title="Radar Contribution History" description="Historical points imported from JCI Radar system">
          {activitiesLoading ? (
            <div className="py-8 text-center text-slate-400">Loading contribution logs...</div>
          ) : radarContributions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-500">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-slate-600 font-bold">Date</th>
                    <th className="px-4 py-2 text-slate-600 font-bold">Category / Description</th>
                    {isPresident && <th className="px-4 py-2 text-right text-slate-600 font-bold w-[100px]">Points</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedRadarContributions.sortedYears.map((year) => (
                    <React.Fragment key={year}>
                      {/* Year Segment Header */}
                      <tr className="bg-slate-100/60 border-y border-slate-200">
                        <td colSpan={isPresident ? 3 : 2} className="px-4 py-2 text-xs font-black text-slate-700 tracking-wider bg-slate-50/80 select-none">
                          {year}
                        </td>
                      </tr>
                      {groupedRadarContributions.groups[year].map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                            {formatDateToDDMMMYYYY(log.date)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 block">{log.description}</span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">{log.type}</span>
                          </td>
                          {isPresident && (
                            <td className="px-4 py-3 text-right font-black text-green-600 w-[100px]">
                              +{log.points} pts
                            </td>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 italic text-sm">No radar contribution history recorded.</div>
          )}
        </Card>

        {/* Sponsorship Records */}
        <Card title="Sponsorship Records" description="Sponsorships obtained and converted to Radar points">
          {activitiesLoading ? (
            <div className="py-8 text-center text-slate-400">Loading sponsorships...</div>
          ) : sponsorshipRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-500">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-slate-600 font-bold">Date</th>
                    <th className="px-4 py-2 text-slate-600 font-bold">Project Name</th>
                    <th className="px-4 py-2 text-slate-600 font-bold">Sponsorship Amount</th>
                    {isPresident && <th className="px-4 py-2 text-right text-slate-600 font-bold">Points</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sponsorshipRecords.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                        {formatDateToDDMMMYYYY(s.date)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {s.projectName}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-700">
                        RM {s.amount.toLocaleString()}
                      </td>
                      {isPresident && (
                        <td className="px-4 py-3 text-right font-black text-green-600">
                          +{s.points} pts
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 italic text-sm">No sponsorship records found.</div>
          )}
        </Card>

        {/* Project Roles Timeline */}
        <Card title="Project Committee & Trainer Roles" description="Positions held in chapter projects and events">
          {activitiesLoading ? (
            <div className="py-8 text-center text-slate-400">Loading project roles...</div>
          ) : projectRoles.length > 0 ? (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {projectRoles.map((role) => (
                <div key={role.id} className="relative">
                  <div className={`absolute -left-[30px] p-1 rounded-full border-4 border-white ${role.type === 'Trainer' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-jci-blue'}`}>
                    {role.type === 'Trainer' ? <GraduationCap size={12} /> : <Award size={12} />}
                  </div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-slate-400 font-mono">{formatDateToDDMMMYYYY(role.date)}</span>
                    <Badge variant={role.type === 'Trainer' ? 'warning' : 'info'} className="text-[9px] uppercase font-bold py-0.5 px-1.5">
                      {role.type}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{role.projectName}</h4>
                  <p className="text-xs text-slate-500">
                    {role.type === 'Trainer' ? `Trainer session duration: ${role.hours} hours` : `Role: ${role.role}`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 italic text-sm">No project or trainer roles recorded.</div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        {/* Recruited Members (Introductions) */}
        <Card title="Introduced Members" description="LO Members recruited by this member">
          {activitiesLoading ? (
            <div className="py-4 text-center text-slate-400 text-sm">Loading recruited members...</div>
          ) : recruitedMembers.length > 0 ? (
            <div className="space-y-3">
              {recruitedMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                  <img src={m.avatar || undefined} className="w-10 h-10 rounded-full object-cover bg-slate-200 border border-slate-100 shrink-0" alt="" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{m.name}</p>
                    <p className="text-[10px] text-slate-400">Joined: {formatDateToDDMMMYYYY(m.joinDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-slate-400 italic text-sm">No introductions recorded.</div>
          )}
        </Card>

        {/* Config Overview Card — points info is President-only */}
        {isPresident && (
          <Card title="Points Standard Reference" className="bg-slate-50/50">
            <div className="text-xs space-y-3 text-slate-600">
              <p className="font-semibold text-slate-800 border-b pb-1.5 mb-2">How points are credited:</p>
              <div className="flex justify-between items-center">
                <span>Organising Chairman Role</span>
                <span className="font-bold text-slate-900">5 pts</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Committee Member Role</span>
                <span className="font-bold text-slate-900">3 pts</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Ex-Officio Role</span>
                <span className="font-bold text-slate-900">2 pts</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Certified Training</span>
                <span className="font-bold text-slate-900">1 pt / hr</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Member Recruitment</span>
                <span className="font-bold text-slate-900">10 pts / pax</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Sponsorship Obtained</span>
                <span className="font-bold text-slate-900">2 pts / RM100</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
    </div>
  );
};

export const MemberDetailActivitiesTab = React.memo(MemberDetailActivitiesTabBase);
