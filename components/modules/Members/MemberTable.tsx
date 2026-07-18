import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button, Card, Badge, ProgressBar } from '../../ui/Common';
import { ColumnFilterHeader } from '../../ui/ColumnFilterHeader';
import type { Member, UserRole, MembershipType } from '../../../types';
import { MembersService } from '../../../services/membersService';

// Generate an inline SVG data URI with initials — avoids external requests blocked by CSP
const getInitialsSvg = (name: string, size = 48): string => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#0097D7" rx="${size / 2}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="sans-serif" font-size="${Math.round(size * 0.4)}px">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const getMemberAge = (member: Member): number | null => {
  const dob = member.dateOfBirth || member.general?.dob;
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

/** 出席对比：当年签到次数 vs 已过月份（入会年份从入会月起算），每年重算 */
export const getAttendanceDisplay = (m: Member) => {
  const year = new Date().getFullYear();
  const months = MembersService.computeAttendanceMonths(m.jciCareer?.joinDate || m.joinDate);
  const checkins = m.attendanceYear === year ? (m.attendanceCheckins || 0) : 0;
  return { checkins, months, text: `${checkins} / ${months}`, ratio: Math.min(100, (checkins / months) * 100) };
};

const ROLE_FILTER_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'GUEST' as UserRole, label: 'Guest' },
  { value: 'MEMBER' as UserRole, label: 'Member' },
  { value: 'BOARD' as UserRole, label: 'Board' },
  { value: 'ADMIN' as UserRole, label: 'Admin' },
  { value: 'SUPER_ADMIN' as UserRole, label: 'Super Admin' },
  { value: 'INACTIVE' as UserRole, label: 'Inactive' },
];

const MEMBERSHIP_TYPE_FILTER_OPTIONS: { value: MembershipType; label: string }[] = [
  { value: 'Guest', label: 'Guest' },
  { value: 'Probation', label: 'Probation' },
  { value: 'Official', label: 'Official' },
  { value: 'Honorary', label: 'Honorary' },
  { value: 'Senator', label: 'Senator' },
  { value: 'Visiting', label: 'Visiting' },
  { value: 'Associate', label: 'Associate' },
];

const membershipTypeBadgeVariant = (
  type?: MembershipType
): 'success' | 'warning' | 'info' | 'neutral' => {
  if (type === 'Official') return 'success';
  if (type === 'Probation') return 'warning';
  if (type === 'Visiting' || type === 'Senator') return 'info';
  return 'neutral';
};

// Desktop Row — memoized to avoid re-rendering non-visible rows when siblings change
const DesktopMemberRow = React.memo(function DesktopMemberRow({
  member,
  isSelected,
  onSelect,
  onToggleSelection,
  getDisplayMembershipType,
}: {
  member: Member;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggleSelection: (id: string) => void;
  getDisplayMembershipType: (m: Member) => MembershipType;
}) {
  const att = getAttendanceDisplay(member);
  const displayType = getDisplayMembershipType(member);
  return (
    <div
      className={`flex items-center border-b border-slate-100 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
      style={{ height: 72 }}
    >
      {/* Checkbox */}
      <div className="px-6 flex-none" style={{ width: 56 }}>
        <input
          type="checkbox"
          className="rounded border-slate-300 text-jci-blue focus:ring-jci-blue"
          checked={isSelected}
          onChange={() => onToggleSelection(member.id)}
        />
      </div>
      {/* Member */}
      <div className="px-6 flex-1 min-w-0">
        <div className="flex items-center space-x-3">
          <img src={member.avatar || undefined} alt={member.name} className="w-10 h-10 rounded-full bg-slate-200 shrink-0" onError={(e) => { e.currentTarget.src = getInitialsSvg(member.name, 40); }} />
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">{member.name}</div>
            <div className="text-xs text-slate-500 truncate">{member.email}</div>
          </div>
        </div>
      </div>
      {/* Role */}
      <div className="px-6 flex-none" style={{ width: 120 }}>
        <Badge variant={member.role === 'BOARD' as UserRole ? 'info' : 'neutral'}>{member.role}</Badge>
      </div>
      {/* Age */}
      <div className="px-6 flex-none text-sm text-slate-600" style={{ width: 72 }}>
        {getMemberAge(member) ?? <span className="text-slate-300">—</span>}
      </div>
      {/* Membership Type */}
      <div className="px-6 flex-none" style={{ width: 160 }}>
        <Badge variant={membershipTypeBadgeVariant(displayType)}>{displayType}</Badge>
      </div>
      {/* Tier / Points */}
      <div className="px-6 flex-none" style={{ width: 140 }}>
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${member.tier === 'Platinum' ? 'text-purple-600' : member.tier === 'Gold' ? 'text-amber-600' : 'text-slate-600'}`}>
            {member.tier}
          </span>
          <span className="text-xs text-slate-500">{member.points} pts</span>
        </div>
      </div>
      {/* Engagement */}
      <div className="px-6 flex-none" style={{ width: 192 }}>
        <div className="flex items-center space-x-2">
          <ProgressBar progress={att.ratio} color={att.checkins < att.months ? 'bg-amber-500' : 'bg-green-500'} />
          <span className="text-xs font-medium text-slate-600 whitespace-nowrap">{att.text}</span>
        </div>
      </div>
      {/* Risk Status */}
      <div className="px-6 flex-none" style={{ width: 120 }}>
        {member.churnRisk === 'High' && <Badge variant="error">At Risk</Badge>}
        {member.churnRisk === 'Low' && <Badge variant="success">Stable</Badge>}
        {member.churnRisk === 'Medium' && <Badge variant="warning">Monitor</Badge>}
      </div>
      {/* Action */}
      <div className="px-6 flex-none" style={{ width: 80 }}>
        <Button variant="ghost" size="sm" onClick={() => onSelect(member.id)}>View</Button>
      </div>
    </div>
  );
});

// Mobile Row — memoized
const MobileMemberRow = React.memo(function MobileMemberRow({
  member,
  isSelected,
  onSelect,
  onToggleSelection,
  getDisplayMembershipType,
}: {
  member: Member;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggleSelection: (id: string) => void;
  getDisplayMembershipType?: (m: Member) => MembershipType;
}) {
  const tierColor = member.tier === 'Platinum'
    ? 'bg-purple-500' : member.tier === 'Gold'
      ? 'bg-amber-400' : member.tier === 'Silver'
        ? 'bg-slate-400' : 'bg-jci-blue';
  const isBoard = member.role === 'BOARD' as UserRole;
  const riskHigh = member.churnRisk === 'High';
  const riskMed = member.churnRisk === 'Medium';
  const att = getAttendanceDisplay(member);
  const displayType = getDisplayMembershipType ? getDisplayMembershipType(member) : ((member.membershipType as MembershipType) || 'Probation');
  const age = getMemberAge(member);

  return (
    <div
      className={`flex items-stretch gap-0 hover:bg-slate-50/60 active:bg-slate-100/60 transition-colors cursor-pointer border-b border-slate-100 ${isSelected ? 'bg-blue-50/40' : ''}`}
      style={{ height: 80 }}
      onClick={() => onSelect(member.id)}
    >
      {/* Tier accent bar */}
      <div className={`w-1 shrink-0 ${tierColor} opacity-70`} />

      <div className="flex-1 px-3 py-3 flex items-center gap-3 min-w-0">
        {/* Checkbox */}
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <input
            type="checkbox"
            className="rounded border-slate-300 text-jci-blue focus:ring-jci-blue w-4 h-4"
            checked={isSelected}
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
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${membershipTypeBadgeVariant(displayType) === 'warning' ? 'bg-amber-100 text-amber-700' : membershipTypeBadgeVariant(displayType) === 'info' ? 'bg-blue-100 text-blue-700' : membershipTypeBadgeVariant(displayType) === 'success' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
              {displayType}
            </span>
            {age !== null && (
              <span className="text-[10px] text-slate-400">{age}y</span>
            )}
            <div className="flex items-center gap-1 flex-1">
              <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden max-w-[48px]">
                <div className={`h-full rounded-full ${att.checkins < att.months ? 'bg-amber-400' : 'bg-green-400'}`}
                  style={{ width: `${att.ratio}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">{att.text}</span>
            </div>
          </div>
        </div>

        {/* Right arrow */}
        <ChevronRight size={15} className="text-slate-300 shrink-0" />
      </div>
    </div>
  );
});

// Desktop virtual header minimum width (sum of all column widths + flex member col)
const DESKTOP_MIN_WIDTH = 56 + 120 + 72 + 160 + 140 + 192 + 120 + 80 + 240; // ~1180px
const DESKTOP_ROW_HEIGHT = 72;
const MOBILE_ROW_HEIGHT = 80;

// Member Table Component
const MemberTableBase: React.FC<{
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
  membershipTypeCounts?: Partial<Record<MembershipType, number>>,
  roleCounts?: Partial<Record<UserRole, number>>,
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
  membershipTypeCounts,
  roleCounts,
}) => {
    const desktopScrollRef = React.useRef<HTMLDivElement>(null);
    const mobileScrollRef = React.useRef<HTMLDivElement>(null);

    const desktopVirtualizer = useVirtualizer({
      count: members.length,
      getScrollElement: () => desktopScrollRef.current,
      estimateSize: () => DESKTOP_ROW_HEIGHT,
      overscan: 6,
    });

    const mobileVirtualizer = useVirtualizer({
      count: members.length,
      getScrollElement: () => mobileScrollRef.current,
      estimateSize: () => MOBILE_ROW_HEIGHT,
      overscan: 6,
    });

    return (
      <Card noPadding>
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          {/* Sticky header */}
          <div style={{ minWidth: DESKTOP_MIN_WIDTH }}>
            <div className="flex items-center bg-slate-50/50 border-b border-slate-100 sticky top-0 z-10">
              <div className="px-6 flex-none" style={{ width: 56 }}>
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-jci-blue focus:ring-jci-blue"
                  checked={isAllSelected}
                  onChange={onToggleAll}
                />
              </div>
              <div className="px-6 py-4 flex-1 text-sm font-semibold text-slate-500">Member</div>
              <div className="px-6 py-4 flex-none overflow-visible" style={{ width: 120 }}>
                <ColumnFilterHeader
                  label="Role"
                  options={roleCounts ? ROLE_FILTER_OPTIONS.map(o => ({ ...o, count: roleCounts[o.value] ?? 0 })) : ROLE_FILTER_OPTIONS}
                  selected={roleFilters}
                  onChange={(vals) => onRoleFiltersChange(vals as UserRole[])}
                />
              </div>
              <div className="px-6 py-4 flex-none text-sm font-semibold text-slate-500" style={{ width: 72 }}>Age</div>
              <div className="px-6 py-4 flex-none overflow-visible" style={{ width: 160 }}>
                <ColumnFilterHeader
                  label="Membership Type"
                  options={membershipTypeCounts ? MEMBERSHIP_TYPE_FILTER_OPTIONS.map(o => ({ ...o, count: membershipTypeCounts[o.value as MembershipType] ?? 0 })) : MEMBERSHIP_TYPE_FILTER_OPTIONS}
                  selected={membershipTypeFilters}
                  onChange={(vals) => onMembershipTypeFiltersChange(vals as MembershipType[])}
                />
              </div>
              <div className="px-6 py-4 flex-none text-sm font-semibold text-slate-500" style={{ width: 140 }}>Tier / Points</div>
              <div className="px-6 py-4 flex-none text-sm font-semibold text-slate-500" style={{ width: 192 }}>Engagement</div>
              <div className="px-6 py-4 flex-none text-sm font-semibold text-slate-500" style={{ width: 120 }}>Risk Status</div>
              <div className="px-6 py-4 flex-none text-sm font-semibold text-slate-500" style={{ width: 80 }}>Action</div>
            </div>

            {/* Virtualized body */}
            <div
              ref={desktopScrollRef}
              style={{ height: 'calc(100vh - 260px)', minHeight: 300, overflowY: 'auto' }}
            >
              <div style={{ height: desktopVirtualizer.getTotalSize(), position: 'relative' }}>
                {desktopVirtualizer.getVirtualItems().map(virtualRow => (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: DESKTOP_ROW_HEIGHT,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <DesktopMemberRow
                      member={members[virtualRow.index]}
                      isSelected={selectedIds.has(members[virtualRow.index].id)}
                      onSelect={onSelect}
                      onToggleSelection={onToggleSelection}
                      getDisplayMembershipType={getDisplayMembershipType}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile filters */}
        <div className="md:hidden border-b border-slate-100 px-4 py-3 flex gap-2 overflow-x-auto bg-slate-50/50">
          <ColumnFilterHeader
            label="Role"
            options={roleCounts ? ROLE_FILTER_OPTIONS.map(o => ({ ...o, count: roleCounts[o.value] ?? 0 })) : ROLE_FILTER_OPTIONS}
            selected={roleFilters}
            onChange={(vals) => onRoleFiltersChange(vals as UserRole[])}
          />
          <ColumnFilterHeader
            label="Membership Type"
            options={membershipTypeCounts ? MEMBERSHIP_TYPE_FILTER_OPTIONS.map(o => ({ ...o, count: membershipTypeCounts[o.value as MembershipType] ?? 0 })) : MEMBERSHIP_TYPE_FILTER_OPTIONS}
            selected={membershipTypeFilters}
            onChange={(vals) => onMembershipTypeFiltersChange(vals as MembershipType[])}
          />
        </div>

        {/* Mobile virtualized list */}
        <div
          className="md:hidden"
          ref={mobileScrollRef}
          style={{ height: 'calc(100vh - 220px)', minHeight: 300, overflowY: 'auto' }}
        >
          <div style={{ height: mobileVirtualizer.getTotalSize(), position: 'relative' }}>
            {mobileVirtualizer.getVirtualItems().map(virtualRow => (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: MOBILE_ROW_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <MobileMemberRow
                  member={members[virtualRow.index]}
                  isSelected={selectedIds.has(members[virtualRow.index].id)}
                  onSelect={onSelect}
                  onToggleSelection={onToggleSelection}
                  getDisplayMembershipType={getDisplayMembershipType}
                />
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  };

export const MemberTable = React.memo(MemberTableBase);
