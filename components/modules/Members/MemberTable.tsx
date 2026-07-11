import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button, Card, Badge, ProgressBar } from '../../ui/Common';
import { ColumnFilterHeader } from '../../ui/ColumnFilterHeader';
import type { Member, UserRole, MembershipType } from '../../../types';
import { MembersService } from '../../../services/membersService';

/** 出席对比：当年签到次数 vs 已过月份（入会年份从入会月起算），每年重算 */
export const getAttendanceDisplay = (m: Member) => {
  const year = new Date().getFullYear();
  const months = MembersService.computeAttendanceMonths(m.jciCareer?.joinDate || m.joinDate);
  const checkins = m.attendanceYear === year ? (m.attendanceCheckins || 0) : 0;
  return { checkins, months, text: `${checkins} / ${months}`, ratio: Math.min(100, (checkins / months) * 100) };
};

const ROLE_FILTER_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'GUEST' as UserRole, label: 'Guest' },
  { value: 'PROBATION' as UserRole, label: 'Probation' },
  { value: 'MEMBER' as UserRole, label: 'Member' },
  { value: 'BOARD' as UserRole, label: 'Board' },
  { value: 'ADMIN' as UserRole, label: 'Admin' },
  { value: 'SUPER_ADMIN' as UserRole, label: 'Super Admin' },
  { value: 'INACTIVE' as UserRole, label: 'Inactive' },
];

const MEMBERSHIP_TYPE_FILTER_OPTIONS: { value: MembershipType; label: string }[] = [
  { value: 'Guest', label: 'Guest' },
  { value: 'Probation', label: 'Probation' },
  { value: 'Full', label: 'Full' },
  { value: 'Honorary', label: 'Honorary' },
  { value: 'Senator', label: 'Senator' },
  { value: 'Visiting', label: 'Visiting' },
  { value: 'Associate', label: 'Associate' },
];

const membershipTypeBadgeVariant = (
  type?: MembershipType
): 'success' | 'warning' | 'info' | 'neutral' => {
  if (type === 'Full') return 'success';
  if (type === 'Probation') return 'warning';
  if (type === 'Visiting' || type === 'Senator') return 'info';
  return 'neutral';
};

// Member Table Component
export const MemberTable: React.FC<{
  members: Member[],
  onSelect: (id: string) => void,
  selectedIds: Set<string>,
  onToggleSelection: (id: string) => void,
  onToggleAll: () => void,
  isAllSelected: boolean,
  roleFilters: UserRole[],
  onRoleFiltersChange: (roles: UserRole[]) => void,
  membershipTypeFilters: MembershipType[],
  onMembershipTypeFiltersChange: (types: MembershipType[]) => void,
  getDisplayMembershipType: (member: Member) => MembershipType,
}> = ({
  members,
  onSelect,
  selectedIds,
  onToggleSelection,
  onToggleAll,
  isAllSelected,
  roleFilters,
  onRoleFiltersChange,
  membershipTypeFilters,
  onMembershipTypeFiltersChange,
  getDisplayMembershipType,
}) => {
    return (
      <Card noPadding>
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto overflow-y-visible">
          <table className="w-full text-left">
            <thead className="relative z-10">
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-jci-blue focus:ring-jci-blue"
                    checked={isAllSelected}
                    onChange={onToggleAll}
                  />
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Member</th>
                <th className="px-6 py-4 overflow-visible">
                  <ColumnFilterHeader
                    label="Role"
                    options={ROLE_FILTER_OPTIONS}
                    selected={roleFilters}
                    onChange={(vals) => onRoleFiltersChange(vals as UserRole[])}
                  />
                </th>
                <th className="px-6 py-4 overflow-visible">
                  <ColumnFilterHeader
                    label="Membership Type"
                    options={MEMBERSHIP_TYPE_FILTER_OPTIONS}
                    selected={membershipTypeFilters}
                    onChange={(vals) => onMembershipTypeFiltersChange(vals as MembershipType[])}
                  />
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Tier / Points</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Engagement</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Risk Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr
                  key={member.id}
                  className={`hover:bg-slate-50 transition-colors ${selectedIds.has(member.id) ? 'bg-blue-50/50' : ''}`}
                >
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-jci-blue focus:ring-jci-blue"
                      checked={selectedIds.has(member.id)}
                      onChange={() => onToggleSelection(member.id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img src={member.avatar || undefined} alt={member.name} className="w-10 h-10 rounded-full bg-slate-200" />
                      <div>
                        <div className="font-medium text-slate-900">{member.name}</div>
                        <div className="text-xs text-slate-500">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={member.role === 'BOARD' as UserRole ? 'info' : 'neutral'}>{member.role}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={membershipTypeBadgeVariant(getDisplayMembershipType(member))}>
                      {getDisplayMembershipType(member)}
                    </Badge>
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
                    {(() => {
                      const att = getAttendanceDisplay(member);
                      return (
                        <div className="flex items-center space-x-2">
                          <ProgressBar progress={att.ratio} color={att.checkins < att.months ? 'bg-amber-500' : 'bg-green-500'} />
                          <span className="text-xs font-medium text-slate-600 whitespace-nowrap">{att.text}</span>
                        </div>
                      );
                    })()}
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
                    <Button variant="ghost" size="sm" onClick={() => onSelect(member.id)}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden border-b border-slate-100 px-4 py-3 flex gap-2 overflow-x-auto bg-slate-50/50">
          <ColumnFilterHeader
            label="Role"
            options={ROLE_FILTER_OPTIONS}
            selected={roleFilters}
            onChange={(vals) => onRoleFiltersChange(vals as UserRole[])}
          />
          <ColumnFilterHeader
            label="Membership Type"
            options={MEMBERSHIP_TYPE_FILTER_OPTIONS}
            selected={membershipTypeFilters}
            onChange={(vals) => onMembershipTypeFiltersChange(vals as MembershipType[])}
          />
        </div>
        <div className="md:hidden divide-y divide-slate-100">
          {members.map(member => {
            const displayType = getDisplayMembershipType(member);
            const isBoard = member.role === 'BOARD' as UserRole;
            const tierColor = member.tier === 'Platinum'
              ? 'bg-purple-500' : member.tier === 'Gold'
                ? 'bg-amber-400' : member.tier === 'Silver'
                  ? 'bg-slate-400' : 'bg-jci-blue';
            const riskHigh = member.churnRisk === 'High';
            const riskMed = member.churnRisk === 'Medium';

            return (
              <div
                key={member.id}
                onClick={() => onSelect(member.id)}
                className={`flex items-stretch gap-0 hover:bg-slate-50/60 active:bg-slate-100/60 transition-colors cursor-pointer ${selectedIds.has(member.id) ? 'bg-blue-50/40' : ''}`}
              >
                {/* Tier accent bar */}
                <div className={`w-1 shrink-0 rounded-none ${tierColor} opacity-70`} />

                <div className="flex-1 px-3 py-3 flex items-center gap-3 min-w-0">
                  {/* Checkbox */}
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-jci-blue focus:ring-jci-blue w-4 h-4"
                      checked={selectedIds.has(member.id)}
                      onChange={() => onToggleSelection(member.id)}
                    />
                  </div>

                  {/* Avatar */}
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name}
                      className="w-10 h-10 rounded-2xl object-cover bg-slate-200 shrink-0 border border-slate-100" />
                  ) : (
                    <div className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center text-white font-black text-sm ${tierColor}`}>
                      {member.name.charAt(0)}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm truncate">{member.name}</span>
                      {isBoard && (
                        <span className="bg-jci-blue/10 text-jci-blue text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0">BOD</span>
                      )}
                      {riskHigh && <span className="bg-red-100 text-red-600 text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0">At Risk</span>}
                      {riskMed && <span className="bg-amber-100 text-amber-600 text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0">Monitor</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-400 truncate">{member.email}</span>
                    </div>
                    {/* Mini stats bar */}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-[10px] font-black ${member.tier === 'Platinum' ? 'text-purple-500' : member.tier === 'Gold' ? 'text-amber-500' : 'text-slate-500'}`}>
                        {member.tier}
                      </span>
                      <span className="text-[10px] text-slate-400">{member.points} pts</span>
                      {(() => {
                        const att = getAttendanceDisplay(member);
                        return (
                          <div className="flex items-center gap-1 flex-1">
                            <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden max-w-[48px]">
                              <div className={`h-full rounded-full ${att.checkins < att.months ? 'bg-amber-400' : 'bg-green-400'}`}
                                style={{ width: `${att.ratio}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">{att.text}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Right arrow */}
                  <ChevronRight size={15} className="text-slate-300 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };
