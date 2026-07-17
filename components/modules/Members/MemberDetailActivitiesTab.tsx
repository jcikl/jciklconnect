import * as React from 'react';
import { GraduationCap, Award } from 'lucide-react';
import { Card, Badge } from '../../ui/Common';
import type { Member } from '../../../types';
import { formatDateToDDMMMYYYY } from '../../../utils/dateUtils';

interface MemberDetailActivitiesTabProps {
  member: Member;
  activitiesLoading: boolean;
  radarContributions: any[];
  groupedRadarContributions: { groups: { [year: string]: any[] }; sortedYears: string[] };
  sponsorshipRecords: any[];
  projectRoles: any[];
  recruitedMembers: any[];
  isPresident: boolean;
}

const MemberDetailActivitiesTabBase: React.FC<MemberDetailActivitiesTabProps> = (props) => {
  const {
    activitiesLoading, radarContributions, groupedRadarContributions,
    sponsorshipRecords, projectRoles, recruitedMembers, isPresident,
  } = props;

  return (
    <div className="grid lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
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
  );
};

export const MemberDetailActivitiesTab = React.memo(MemberDetailActivitiesTabBase);
