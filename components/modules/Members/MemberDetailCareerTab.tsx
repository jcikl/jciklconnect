import * as React from 'react';
import {
  Zap, Clock, Briefcase, GraduationCap, UserPlus, UserCheck,
  Award, Shield, UserCog
} from 'lucide-react';

// Generate an inline SVG data URI with initials — avoids external requests blocked by CSP
const getInitialsSvg = (name: string, size = 48): string => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#0097D7" rx="${size / 2}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="sans-serif" font-size="${Math.round(size * 0.4)}px">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};
import { Button, Card, Badge } from '../../ui/Common';
import { Input } from '../../ui/Form';
import type { Member, BoardMember } from '../../../types';
import { UserRole } from '../../../types';
import { MembershipTypeDisplay } from '../../shared/MembershipTypeDisplay';
import { formatDateToDDMMMYYYY } from '../../../utils/dateUtils';
import { PaymentButton } from '../../shared/toyyib/PaymentButton';

interface MemberDetailCareerTabProps {
  member: Member;
  isEditMode: boolean;
  inlineValues: any; // TODO: type InlineCareerValues
  setInlineValues: React.Dispatch<React.SetStateAction<any>>; // TODO: type InlineCareerValues
  boardPositions: BoardMember[];
  commissionDirectorPositions: BoardMember[];
  mentor: Member | undefined;
  mentees: Member[];
  handleFindMentors: () => void;
  loadingMatches: boolean;
  setShowPaymentHistoryModal: React.Dispatch<React.SetStateAction<boolean>>;
  canEditRoleType?: boolean;
}

const MemberDetailCareerTabBase: React.FC<MemberDetailCareerTabProps> = (props) => {
  const {
    member, isEditMode, inlineValues, setInlineValues,
    boardPositions, commissionDirectorPositions,
    mentor, mentees, handleFindMentors, loadingMatches,
    setShowPaymentHistoryModal, canEditRoleType,
  } = props;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left column */}
      <div className="space-y-6">
        <Card title="Mentorship & Growth">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Current Mentor</h4>
              {mentor ? (
                <div className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <img src={mentor.avatar || undefined} className="w-10 h-10 rounded-full" alt="" onError={(e) => { e.currentTarget.src = getInitialsSvg(mentor.name, 40); }} />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{mentor.name}</p>
                    <p className="text-xs text-slate-500">{mentor.role}</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center">
                  <p className="text-sm text-slate-500 mb-2">No mentor assigned</p>
                  <Button size="sm" variant="outline" onClick={handleFindMentors} isLoading={loadingMatches}>
                    <Zap size={14} className="mr-2" /> Find Mentor
                  </Button>
                </div>
              )}
            </div>

            {mentees.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Mentees</h4>
                <div className="space-y-2">
                  {mentees.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                      <img src={m.avatar || undefined} className="w-8 h-8 rounded-full" alt="" onError={(e) => { e.currentTarget.src = getInitialsSvg(m.name, 32); }} />
                      <span className="text-sm font-medium">{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="Membership & Dues">
          {isEditMode && inlineValues ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Senatorship Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 12345"
                    value={inlineValues.senatorshipId}
                    onChange={e => setInlineValues({ ...inlineValues, senatorshipId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                  />
                </div>
                <div className="flex items-center gap-4 py-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inlineValues.senatorCertified}
                      onChange={e => setInlineValues({ ...inlineValues, senatorCertified: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-jci-blue focus:ring-jci-blue/20"
                    />
                    <span className="text-sm font-medium text-slate-700">Senator Certified</span>
                  </label>
                </div>
                <div className="flex items-center gap-4 py-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inlineValues.senatorshipBoardValidated}
                      onChange={e => setInlineValues({ ...inlineValues, senatorshipBoardValidated: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-jci-blue focus:ring-jci-blue/20"
                    />
                    <span className="text-sm font-medium text-slate-700">Board Validated</span>
                  </label>
                </div>
                {inlineValues.senatorshipBoardValidated && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-200">
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Validated By</label>
                      <input
                        type="text"
                        value={inlineValues.senatorshipValidatedBy}
                        onChange={e => setInlineValues({ ...inlineValues, senatorshipValidatedBy: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Validated At</label>
                      <Input
                        type="date"
                        value={inlineValues.senatorshipValidatedAt}
                        onChange={e => setInlineValues({ ...inlineValues, senatorshipValidatedAt: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              {canEditRoleType && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                  <div>
                    <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Role</label>
                    <select
                      value={inlineValues.role}
                      onChange={e => setInlineValues({ ...inlineValues, role: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                    >
                      {[UserRole.GUEST, UserRole.MEMBER, UserRole.BOARD, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INACTIVE].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Membership Type</label>
                    <select
                      value={inlineValues.membershipType}
                      onChange={e => setInlineValues({ ...inlineValues, membershipType: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                    >
                      {['Guest', 'Probation', 'Official', 'Honorary', 'Senator', 'Visiting', 'Associate'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold">Type</span>
                  <MembershipTypeDisplay
                    member={{
                      nationality: member.nationality,
                      dateOfBirth: member.dateOfBirth,
                      senatorCertified: member.senatorCertified,
                      senatorshipId: member.senatorshipId,
                      role: member.role,
                      membershipType: member.membershipType,
                    }}
                  />
                </div>
                {member.senatorCertified && (
                  <Badge variant="success" className="animate-pulse">Senator Certified</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Current Status ({new Date().getFullYear()}):</span>
                  <Badge
                    variant={
                      (member.membership?.[String(new Date().getFullYear())]?.status === 'paid' ||
                        member.membership?.[String(new Date().getFullYear())]?.status === 'over paid') ? 'success' :
                        member.membership?.[String(new Date().getFullYear())]?.status === 'pending' ? 'warning' : 'error'
                    }
                    className="capitalize"
                  >
                    {member.membership?.[String(new Date().getFullYear())]?.status || 'pending'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Last Payment Amount:</span>
                  <span className="font-bold">RM {member.membership?.[String(new Date().getFullYear())]?.amount || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Last Payment Date:</span>
                  <span className="font-medium text-slate-900">{formatDateToDDMMMYYYY(member.membership?.[String(new Date().getFullYear())]?.paymentDate)}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPaymentHistoryModal(true)}
                  className="mt-2 w-full font-bold text-slate-700 hover:text-jci-blue border-slate-200 hover:border-jci-blue flex items-center justify-center gap-1.5"
                >
                  <Clock size={12} /> View Payment History
                </Button>

                {/* Pay dues button — shown when dues are not paid for the current year */}
                {(() => {
                  const currentYear = new Date().getFullYear();
                  const rec = member.membership?.[String(currentYear)];
                  const isPaid = rec?.status === 'paid' || rec?.status === 'over paid';
                  const noPaymentNeeded = member.membershipType === 'Honorary' || member.membershipType === 'Senator';
                  if (noPaymentNeeded) return null;
                  return (
                    <div className="mt-2 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500 mb-2">{currentYear} Dues Payment</p>
                      <PaymentButton
                        type="membership"
                        member={member}
                        year={currentYear}
                        label={isPaid ? undefined : 'Pay Dues'}
                        size="sm"
                        existingPaymentUrl={rec?.toyyibPaymentUrl}
                        existingBillStatus={isPaid ? '1' : rec?.toyyibPaymentStatus}
                        className="w-full justify-center"
                      />
                    </div>
                  );
                })()}
              </div>

              {/* Senator Details Section */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Senatorship Details</h4>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Certified Senator:</span>
                    <Badge variant={member.senatorCertified ? 'success' : 'neutral'}>
                      {member.senatorCertified ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Senator Number:</span>
                    <span className="font-semibold text-slate-900">{member.senatorshipId || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Board Validated:</span>
                    <Badge variant={member.senatorshipBoardValidated ? 'success' : 'neutral'}>
                      {member.senatorshipBoardValidated ? 'Validated' : 'Pending'}
                    </Badge>
                  </div>
                  {member.senatorshipBoardValidated && (member.jciCareer?.senatorshipValidatedBy ?? member.senatorshipValidatedBy) && (
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Validated By:</span>
                      <span className="font-medium">{member.jciCareer?.senatorshipValidatedBy ?? member.senatorshipValidatedBy}</span>
                    </div>
                  )}
                  {member.senatorshipBoardValidated && (member.jciCareer?.senatorshipValidatedAt ?? member.senatorshipValidatedAt) && (
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Validated At:</span>
                      <span className="font-medium">{formatDateToDDMMMYYYY((member.jciCareer?.senatorshipValidatedAt ?? member.senatorshipValidatedAt)!)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Right column (2 cols) */}
      <div className="lg:col-span-2 space-y-6">
        <Card title="Recent Badges">
          <div className="flex gap-4">
            {Array.isArray(member.badges) && member.badges.map(b => (
              <div key={b.id} className="text-center">
                <div className="text-3xl mb-1">{b.icon}</div>
                <div className="text-xs font-medium text-slate-900">{b.name}</div>
              </div>
            ))}
            {(!member.badges || member.badges.length === 0) && (
              <p className="text-sm text-slate-400 italic">No badges earned yet</p>
            )}
          </div>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <Card title="JCI Career Path">
            <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {/* Join milestone */}
              <div className="relative">
                <div className="absolute -left-8 bg-green-100 text-green-600 p-1 rounded-full border-4 border-white">
                  <UserPlus size={14} />
                </div>
                <span className="text-xs text-slate-400 font-mono mb-1 block">{member.joinDate}</span>
                <h4 className="text-sm font-bold text-slate-900">Joined JCI Local Chapter</h4>
              </div>

              {/* Merged & sorted: careerHistory + board positions + commission director roles from Firestore */}
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Date-based status helper
                const getBodStatus = (bp: BoardMember): 'former' | 'current' | 'elected' => {
                  const start = bp.startDate ? new Date(bp.startDate) : null;
                  const end = bp.endDate ? new Date(bp.endDate) : null;
                  if (end && today > end) return 'former';
                  if (start && today < start) return 'elected';
                  return 'current';
                };

                type TimelineItem = {
                  sortKey: string; type: 'career' | 'board' | 'commission';
                  year: string; title: string; subtitle?: string;
                  bodStatus?: 'former' | 'current' | 'elected';
                };
                const items: TimelineItem[] = [];

                // Career history from member profile
                if (Array.isArray(member.careerHistory)) {
                  member.careerHistory.forEach(m => {
                    items.push({ sortKey: String(m.year), type: 'career', year: String(m.year), title: m.role, subtitle: m.description });
                  });
                }

                // Board positions from Firestore boardMembers collection
                boardPositions.forEach(bp => {
                  items.push({
                    sortKey: bp.term,
                    type: 'board',
                    year: bp.term,
                    title: bp.position,
                    subtitle: `Board of Directors — ${bp.term}`,
                    bodStatus: getBodStatus(bp),
                  });
                });

                // Commission Director records from Board of Directors assignments
                commissionDirectorPositions.forEach(bp => {
                  items.push({
                    sortKey: bp.term,
                    type: 'commission',
                    year: bp.term,
                    title: 'Commission Director',
                    subtitle: `Under ${bp.position} - ${bp.term}`,
                    bodStatus: getBodStatus(bp),
                  });
                });

                // Sort chronologically
                items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

                return items.map((item, idx) => {
                  if (item.type === 'board') {
                    const statusConfig = {
                      current: { dot: 'bg-amber-100 text-amber-600', badge: 'bg-amber-100 text-amber-700', label: 'Current', icon: 'text-amber-500' },
                      elected: { dot: 'bg-blue-100 text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'Elected', icon: 'text-blue-500' },
                      former: { dot: 'bg-slate-100 text-slate-500', badge: 'bg-slate-100 text-slate-600', label: 'Former', icon: 'text-slate-400' },
                    };
                    const cfg = statusConfig[item.bodStatus!] ?? statusConfig.former;
                    return (
                      <div key={`board-${idx}`} className="relative">
                        <div className={`absolute -left-8 p-1 rounded-full border-4 border-white ${cfg.dot}`}>
                          <Award size={14} />
                        </div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-slate-400 font-mono">{item.year}</span>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Shield size={10} className={cfg.icon} />
                          <p className={`text-xs font-medium ${cfg.icon}`}>Board of Directors</p>
                        </div>
                      </div>
                    );
                  }
                  if (item.type === 'commission') {
                    const statusConfig = {
                      current: { dot: 'bg-sky-100 text-sky-600', badge: 'bg-sky-100 text-sky-700', label: 'Current', icon: 'text-sky-500' },
                      elected: { dot: 'bg-blue-100 text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'Elected', icon: 'text-blue-500' },
                      former: { dot: 'bg-slate-100 text-slate-500', badge: 'bg-slate-100 text-slate-600', label: 'Former', icon: 'text-slate-400' },
                    };
                    const cfg = statusConfig[item.bodStatus!] ?? statusConfig.former;
                    return (
                      <div key={`commission-${idx}`} className="relative">
                        <div className={`absolute -left-8 p-1 rounded-full border-4 border-white ${cfg.dot}`}>
                          <UserCog size={14} />
                        </div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-slate-400 font-mono">{item.year}</span>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                        <div className="flex items-center gap-1 mt-0.5">
                          <UserCog size={10} className={cfg.icon} />
                          <p className={`text-xs font-medium ${cfg.icon}`}>{item.subtitle}</p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={`career-${idx}`} className="relative">
                      <div className="absolute -left-8 bg-blue-100 text-jci-blue p-1 rounded-full border-4 border-white">
                        <Briefcase size={14} />
                      </div>
                      <span className="text-xs text-slate-400 font-mono mb-1 block">{item.year}</span>
                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                      {item.subtitle && <p className="text-sm text-slate-600">{item.subtitle}</p>}
                    </div>
                  );
                });
              })()}

              {/* Empty state */}
              {(!member.careerHistory || member.careerHistory.length === 0) && boardPositions.length === 0 && commissionDirectorPositions.length === 0 && (
                <p className="text-sm text-slate-400 italic">No career milestones or board positions recorded yet.</p>
              )}
            </div>
          </Card>

          <Card title="JCI Trainer Pathway">
            <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {[
                {
                  label: 'Level 1',
                  title: 'JCI Trainer',
                  description: 'Pre-requisites: Graduate from JCI Discover',
                  status: (member.skills?.includes('JCI Discover') || member.points >= 150) ? 'Completed' : 'Upcoming',
                  tone: (member.skills?.includes('JCI Discover') || member.points >= 150) ? 'green' : 'slate',
                  icon: GraduationCap,
                },
                {
                  label: 'Level 2',
                  title: 'JCIM Intermediate Trainer',
                  description: 'Pre-requisites: Graduate from JCI Presenter/ JCI Facilitator, JCIM Inspire, JCIM Empower',
                  status: (member.skills?.includes('JCI Presenter') || member.skills?.includes('JCI Facilitator') || member.points >= 400) ? 'Completed' : (member.points >= 150 ? 'In Progress' : 'Upcoming'),
                  tone: (member.skills?.includes('JCI Presenter') || member.skills?.includes('JCI Facilitator') || member.points >= 400) ? 'green' : (member.points >= 150 ? 'blue' : 'slate'),
                  icon: UserCheck,
                },
                {
                  label: 'Level 3',
                  title: 'JCIM Certified Trainer',
                  description: 'Pre-requisites: Accumulate 10 training hours, graduate from JCIM TTT 1',
                  status: (member.skills?.includes('JCIM TTT 1') || member.points >= 800) ? 'Completed' : (member.points >= 400 ? 'In Progress' : 'Upcoming'),
                  tone: (member.skills?.includes('JCIM TTT 1') || member.points >= 800) ? 'green' : (member.points >= 400 ? 'blue' : 'slate'),
                  icon: Award,
                },
                {
                  label: 'Level 4',
                  title: 'JCIM Principal Trainer',
                  description: 'Pre-requisites: Accumulate 25 training hours, Head trainer of JCIM Empower or JCIM Inspire, graduate from JCIM TTT 2',
                  status: (member.skills?.includes('JCIM TTT 2') || member.points >= 1500) ? 'Completed' : (member.points >= 800 ? 'In Progress' : 'Upcoming'),
                  tone: (member.skills?.includes('JCIM TTT 2') || member.points >= 1500) ? 'green' : (member.points >= 800 ? 'blue' : 'slate'),
                  icon: Shield,
                },
                {
                  label: 'Level 5',
                  title: 'JCIM Master Trainer',
                  description: 'Pre-requisites: Accumulate 30 training hours, assistant trainer to area academy',
                  status: (member.skills?.includes('JCIM Master Trainer') || member.points >= 2500) ? 'Completed' : (member.points >= 1500 ? 'In Progress' : 'Upcoming'),
                  tone: (member.skills?.includes('JCIM Master Trainer') || member.points >= 2500) ? 'green' : (member.points >= 1500 ? 'blue' : 'slate'),
                  icon: Zap,
                },
              ].map((step) => {
                const Icon = step.icon;
                const toneClass = {
                  green: { dot: 'bg-green-100 text-green-600', badge: 'bg-green-100 text-green-700 font-bold border border-green-200' },
                  blue: { dot: 'bg-blue-100 text-blue-600', badge: 'bg-blue-100 text-blue-700 font-bold border border-blue-200' },
                  amber: { dot: 'bg-amber-100 text-amber-600', badge: 'bg-amber-100 text-amber-700 font-bold border border-amber-200' },
                  slate: { dot: 'bg-slate-100 text-slate-500', badge: 'bg-slate-100 text-slate-600 font-bold border border-slate-200' },
                }[step.tone];

                return (
                  <div key={step.title} className="relative">
                    <div className={`absolute -left-8 p-1 rounded-full border-4 border-white ${toneClass.dot}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-slate-400 font-mono">{step.label}</span>
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full ${toneClass.badge}`}>{step.status}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{step.title}</h4>
                    <p className="text-xs text-slate-600 leading-normal">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export const MemberDetailCareerTab = React.memo(MemberDetailCareerTabBase);
