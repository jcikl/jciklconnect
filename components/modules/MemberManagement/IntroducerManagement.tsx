import React, { useState, useMemo } from 'react';
import { Users, Search, Edit2, CheckCircle, BarChart3, Info, UserCheck, AlertTriangle } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast } from '../../ui/Common';
import { Input, Select } from '../../ui/Form';
import { IntroducerSelector } from '../../ui/IntroducerSelector';
import { Member, Project } from '../../../types';
import { MembersService } from '../../../services/membersService';
import { useAuth } from '../../../hooks/useAuth';

interface Props {
  members: Member[];
  allProjects: Project[];
  onUpdateMember: (memberId: string, updates: Partial<Member>) => Promise<void>;
  onBatchUpdateMembers?: (memberIds: string[], updates: Partial<Member>) => Promise<void>;
}

export const IntroducerManagement: React.FC<Props> = ({
  members,
  allProjects,
  onUpdateMember,
  onBatchUpdateMembers,
}) => {
  const { showToast } = useToast();
  const { member: currentUser } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'assignment'>('overview');
  const [memberSearch, setMemberSearch] = useState('');
  const [introducerSearch, setIntroducerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'has_introducer' | 'no_introducer'>('all');
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [newIntroducerVal, setNewIntroducerVal] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Batch selection states
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [isBatchEditing, setIsBatchEditing] = useState(false);
  const [batchIntroducerVal, setBatchIntroducerVal] = useState('');

  // Toggle selection helpers
  const toggleSelectMember = (id: string) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (filteredList: Member[]) => {
    const allFilteredSelected = filteredList.length > 0 && filteredList.every(m => selectedMemberIds.has(m.id));
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredList.forEach(m => next.delete(m.id));
      } else {
        filteredList.forEach(m => next.add(m.id));
      }
      return next;
    });
  };

  const handleBatchSaveIntroducer = async () => {
    if (selectedMemberIds.size === 0) return;
    setIsSaving(true);
    try {
      const idsArray = Array.from(selectedMemberIds);
      if (onBatchUpdateMembers) {
        await onBatchUpdateMembers(idsArray, { introducer: batchIntroducerVal });
      } else {
        await Promise.all(idsArray.map(id => onUpdateMember(id, { introducer: batchIntroducerVal })));
      }
      showToast(`Successfully updated introducer for ${selectedMemberIds.size} members`, 'success');
      setSelectedMemberIds(new Set());
      setIsBatchEditing(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to batch update introducers', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to resolve how to display an introducer's name
  const resolveIntroducerDisplay = (introVal?: string) => {
    if (!introVal || introVal.trim() === '') return 'Direct Join / None';
    const foundMember = members.find(m => m.id === introVal);
    if (foundMember) {
      const shortName = foundMember.name || '';
      const fullName = foundMember.fullName || '';
      if (shortName && fullName && shortName !== fullName) {
        return `${shortName} (${fullName})`;
      }
      return shortName || fullName || 'Unnamed Member';
    }
    return introVal;
  };

  // Helper to identify the type of introducer from the string value
  const getIntroducerType = (introVal?: string) => {
    if (!introVal || introVal.trim() === '') return 'None';
    const cleanVal = introVal.trim();
    if (cleanVal.toLowerCase() === 'friend') return 'Friend';
    if (cleanVal.toLowerCase() === 'direct join') return 'Direct Join';
    if (cleanVal.toLowerCase().startsWith('social media')) return 'Social Media';
    if (cleanVal.toLowerCase().startsWith('event:')) return 'Event/Project';

    // Check if it is a member ID
    const foundMember = members.some(m => m.id === cleanVal);
    if (foundMember) return 'JCI KL Member';

    return 'Other Source';
  };

  // Calculate high-level statistics
  const stats = useMemo(() => {
    const totalCount = members.length;
    const withIntroducer = members.filter(m => m.introducer && m.introducer.trim() !== '' && m.introducer.toLowerCase() !== 'direct join');
    const withIntroducerCount = withIntroducer.length;
    const noIntroducerCount = totalCount - withIntroducerCount;
    const percentage = totalCount > 0 ? Math.round((withIntroducerCount / totalCount) * 100) : 0;

    // Source breakdown
    const breakdown: Record<string, number> = {
      'JCI KL Member': 0,
      'Social Media': 0,
      'Event/Project': 0,
      'Friend': 0,
      'Direct Join': 0,
      'Other Source': 0
    };

    // Keep track of counts for members acting as introducers
    const memberRecruitmentCounts: Record<string, number> = {};

    members.forEach(m => {
      if (!m.introducer || m.introducer.trim() === '') {
        breakdown['Direct Join']++;
        return;
      }

      const type = getIntroducerType(m.introducer);
      if (breakdown[type] !== undefined) {
        breakdown[type]++;
      } else {
        breakdown['Other Source']++;
      }

      if (type === 'JCI KL Member') {
        const introducerId = m.introducer.trim();
        memberRecruitmentCounts[introducerId] = (memberRecruitmentCounts[introducerId] || 0) + 1;
      }
    });

    // Sort recruiters
    const topRecruiters = Object.entries(memberRecruitmentCounts)
      .map(([id, count]) => {
        const memberObj = members.find(m => m.id === id);
        let name = 'Unknown Member';
        if (memberObj) {
          const shortName = memberObj.name || '';
          const fullName = memberObj.fullName || '';
          if (shortName && fullName && shortName !== fullName) {
            name = `${shortName} (${fullName})`;
          } else {
            name = shortName || fullName || 'Unknown Member';
          }
        }
        return {
          id,
          name,
          avatar: memberObj?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(id)}&background=0097D7&color=fff`,
          count
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalCount,
      withIntroducerCount,
      noIntroducerCount,
      percentage,
      breakdown,
      topRecruiters
    };
  }, [members]);

  // Aggregate members introduced by each unique introducer
  const introducersList = useMemo(() => {
    const agg: Record<string, { value: string; name: string; type: string; invitees: Member[] }> = {};

    members.forEach(m => {
      const val = (m.introducer || 'Direct Join').trim();
      const type = getIntroducerType(m.introducer);
      const name = resolveIntroducerDisplay(m.introducer);

      if (!agg[val]) {
        agg[val] = {
          value: val,
          name,
          type,
          invitees: []
        };
      }
      agg[val].invitees.push(m);
    });

    // Convert to array and filter by search query
    return Object.values(agg)
      .filter(item => {
        if (!introducerSearch.trim()) return true;
        return item.name.toLowerCase().includes(introducerSearch.toLowerCase()) ||
               item.type.toLowerCase().includes(introducerSearch.toLowerCase());
      })
      .sort((a, b) => b.invitees.length - a.invitees.length);
  }, [members, introducerSearch]);

  // Filter members list for manual updates
  const filteredMembersForAssignment = useMemo(() => {
    return members.filter(m => {
      // Resolve the introducer name to allow searching by it
      const introducerName = resolveIntroducerDisplay(m.introducer);

      // 1. Search Query filter
      const matchesSearch = memberSearch.trim() === '' ||
        (m.name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
        (m.fullName || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
        (m.email || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
        introducerName.toLowerCase().includes(memberSearch.toLowerCase()) ||
        (m.introducer || '').toLowerCase().includes(memberSearch.toLowerCase());

      if (!matchesSearch) return false;

      // 2. Status filter
      const hasIntro = m.introducer && m.introducer.trim() !== '' && m.introducer.toLowerCase() !== 'direct join';
      if (statusFilter === 'has_introducer') return hasIntro;
      if (statusFilter === 'no_introducer') return !hasIntro;

      return true;
    });
  }, [members, memberSearch, statusFilter]);

  // Save the updated introducer for a member
  const handleSaveIntroducer = async () => {
    if (!editingMember) return;
    setIsSaving(true);
    try {
      await onUpdateMember(editingMember.id, { introducer: newIntroducerVal });
      showToast(`Successfully updated introducer for ${editingMember.name}`, 'success');
      setEditingMember(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update introducer', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-jci-blue to-sky-500 text-white border-none shadow-lg">
          <div className="p-2">
            <span className="text-white/80 text-xs font-bold uppercase tracking-wider block mb-1">Introducer Penetration</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black">{stats.withIntroducerCount}</span>
              <span className="text-sm font-medium text-white/80">/ {stats.totalCount} members</span>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1 font-bold">
                <span>Coverage</span>
                <span>{stats.percentage}%</span>
              </div>
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                <div className="bg-white h-full rounded-full transition-all" style={{ width: `${stats.percentage}%` }}></div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Top Recruiters (JCI KL)" className="flex flex-col justify-between">
          <div className="space-y-2 mt-1">
            {stats.topRecruiters.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-2 text-center">No member referrals registered yet.</p>
            ) : (
              stats.topRecruiters.map((recruiter, idx) => (
                <div key={recruiter.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400 w-4">#{idx + 1}</span>
                    <img src={recruiter.avatar} alt="" className="w-6 h-6 rounded-full" />
                    <span className="font-semibold text-slate-800 truncate max-w-[150px]">{recruiter.name}</span>
                  </div>
                  <Badge variant="success" className="font-black text-xs">{recruiter.count} members</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title="Referral Source Breakdown">
          <div className="grid grid-cols-2 gap-2 mt-1">
            {Object.entries(stats.breakdown).map(([source, count]) => (
              <div key={source} className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase truncate">{source}</span>
                <span className="text-lg font-black text-slate-800">{count} <span className="text-[10px] font-normal text-slate-400">members</span></span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 2. Sub Tabs Toggle */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`pb-3 font-bold text-sm transition-all border-b-2 px-2 -mb-[2px] flex items-center gap-2 ${
            activeSubTab === 'overview'
              ? 'border-jci-blue text-jci-blue'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 size={16} />
          Introducer Summary
        </button>
        <button
          onClick={() => setActiveSubTab('assignment')}
          className={`pb-3 font-bold text-sm transition-all border-b-2 px-2 -mb-[2px] flex items-center gap-2 ${
            activeSubTab === 'assignment'
              ? 'border-jci-blue text-jci-blue'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={16} />
          Member Introducer Alignment
        </button>
      </div>

      {/* 3. Sub Tabs Content */}
      {activeSubTab === 'overview' && (
        <Card noPadding>
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800">Introducer Aggregation</h3>
              <p className="text-xs text-slate-500">List of all unique referral entities and the members they introduced.</p>
            </div>
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search introducer..."
                value={introducerSearch}
                onChange={e => setIntroducerSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-jci-blue/20 focus:border-jci-blue"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider font-bold">
                  <th className="px-6 py-3">Introducer / Channel</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3 text-center">Introduced Count</th>
                  <th className="px-6 py-3 hidden md:table-cell">Introduced Members</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {introducersList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400">
                      No introducers found matching query.
                    </td>
                  </tr>
                ) : (
                  introducersList.map(intro => (
                    <tr key={intro.value} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800">{intro.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            intro.type === 'JCI KL Member' ? 'success' :
                            intro.type === 'Event/Project' ? 'info' :
                            intro.type === 'Social Media' ? 'warning' : 'neutral'
                          }
                          className="font-medium"
                        >
                          {intro.type}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold px-2.5 py-1 bg-slate-100 rounded-full text-xs text-slate-700">
                          {intro.invitees.length}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1.5 max-w-xl">
                          {intro.invitees.slice(0, 3).map(inv => {
                            const displayName = inv.fullName && inv.fullName !== inv.name
                              ? `${inv.name} (${inv.fullName})`
                              : inv.name;
                            return (
                              <div
                                key={inv.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200 text-xs font-semibold"
                              >
                                <img
                                  src={inv.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(inv.name)}&background=0097D7&color=fff`}
                                  className="w-4 h-4 rounded-full"
                                  alt=""
                                />
                                <span>{displayName}</span>
                              </div>
                            );
                          })}
                          {intro.invitees.length > 3 && (
                            <div
                              className="inline-flex items-center px-2.5 py-0.5 bg-slate-50 text-slate-500 rounded-md border border-slate-200 text-xs font-bold cursor-help"
                              title={intro.invitees.slice(3).map(inv => inv.fullName ? `${inv.name} (${inv.fullName})` : inv.name).join(', ')}
                            >
                              +{intro.invitees.length - 3} more
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeSubTab === 'assignment' && (
        <Card noPadding>
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800">Assign Member Introducers</h3>
              <p className="text-xs text-slate-500">Quickly update member introducers to ensure data formatting is unified.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Select
                  value={statusFilter}
                  onChange={e => {
                    setStatusFilter(e.target.value as any);
                    setSelectedMemberIds(new Set());
                  }}
                  options={[
                    { label: 'All Members', value: 'all' },
                    { label: 'Has Introducer', value: 'has_introducer' },
                    { label: 'Needs Introducer / Direct', value: 'no_introducer' }
                  ]}
                  className="text-sm bg-white"
                />
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={memberSearch}
                  onChange={e => {
                    setMemberSearch(e.target.value);
                    setSelectedMemberIds(new Set());
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-jci-blue/20 focus:border-jci-blue"
                />
              </div>
            </div>
          </div>

          {selectedMemberIds.size > 0 && (
            <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between animate-in slide-in-from-top duration-200">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-indigo-900">
                  Selected {selectedMemberIds.size} {selectedMemberIds.size === 1 ? 'member' : 'members'}
                </span>
                <button
                  onClick={() => setSelectedMemberIds(new Set())}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline"
                >
                  Clear Selection
                </button>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setBatchIntroducerVal('');
                  setIsBatchEditing(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                Batch Edit Introducer
              </Button>
            </div>
          )}

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredMembersForAssignment.map(member => {
              const introDisplay = resolveIntroducerDisplay(member.introducer);
              const introType = getIntroducerType(member.introducer);
              return (
                <div key={member.id} className="py-3 px-1 flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {selectedMemberIds.size > 0 && (
                      <input type="checkbox" checked={selectedMemberIds.has(member.id)} onChange={() => toggleSelectMember(member.id)}
                        className="w-4 h-4 rounded border-slate-300 text-jci-blue focus:ring-jci-blue shrink-0" />
                    )}
                    <img src={member.avatar || undefined} className="w-9 h-9 rounded-full bg-slate-200 shrink-0" alt="" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{member.name}</p>
                      <p className="text-xs text-slate-500 truncate">{introDisplay}</p>
                    </div>
                  </div>
                  <button onClick={() => { setEditingMember(member); setNewIntroducerVal(member.introducer || ''); }}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-jci-blue/10 hover:text-jci-blue text-slate-500 transition-colors shrink-0">
                    <Edit2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider font-bold">
                  <th className="pl-6 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredMembersForAssignment.length > 0 && filteredMembersForAssignment.every(m => selectedMemberIds.has(m.id))}
                      onChange={() => toggleSelectAll(filteredMembersForAssignment)}
                      className="rounded border-slate-300 text-jci-blue focus:ring-jci-blue h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-3">Member</th>
                  <th className="px-6 py-3">Contact</th>
                  <th className="px-6 py-3">Current Introducer</th>
                  <th className="px-6 py-3">Introducer Type</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredMembersForAssignment.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No members match search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredMembersForAssignment.map(m => {
                    const hasIntroducer = m.introducer && m.introducer.trim() !== '' && m.introducer.toLowerCase() !== 'direct join';
                    const introducerName = resolveIntroducerDisplay(m.introducer);
                    const type = getIntroducerType(m.introducer);

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="pl-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedMemberIds.has(m.id)}
                            onChange={() => toggleSelectMember(m.id)}
                            className="rounded border-slate-300 text-jci-blue focus:ring-jci-blue h-4 w-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <img src={m.avatar || undefined} alt={m.name} className="w-8 h-8 rounded-full bg-slate-200" />
                            <div>
                              <div className="font-semibold text-slate-900">{m.name}</div>
                              {m.fullName && m.fullName !== m.name && (
                                <div className="text-[10px] text-slate-400">{m.fullName}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-600">{m.email}</div>
                          <div className="text-xs text-slate-400">{m.phone}</div>
                        </td>
                        <td className="px-6 py-4">
                          {hasIntroducer ? (
                            <span className="font-bold text-slate-800">{introducerName}</span>
                          ) : (
                            <span className="text-slate-400 italic">Direct Join / None</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              type === 'JCI KL Member' ? 'success' :
                              type === 'Event/Project' ? 'info' :
                              type === 'Social Media' ? 'warning' : 'neutral'
                            }
                            className="font-medium"
                          >
                            {type}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingMember(m);
                              setNewIntroducerVal(m.introducer || '');
                            }}
                            className="inline-flex items-center gap-1.5"
                          >
                            <Edit2 size={13} />
                            <span>Edit Introducer</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 4. Update Introducer Modal */}
      {editingMember && (
        <Modal
          isOpen={!!editingMember}
          onClose={() => setEditingMember(null)}
          title={`Update Introducer for ${editingMember.name}`}
          size="md"
          footer={
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setEditingMember(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleSaveIntroducer} isLoading={isSaving} disabled={isSaving}>
                Save Changes
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 border border-slate-100 rounded-lg flex items-start gap-3">
              <Info className="text-jci-blue shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Why structure introducers?</p>
                <p>Ensuring introducer formats match (member ID references, event/social prefixes) allows the system to aggregate referrals correctly and calculate dynamic recruiter rewards and radar statistics.</p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Current Value</label>
              <p className="text-sm font-semibold text-slate-800">
                {editingMember.introducer ? `${editingMember.introducer} (${resolveIntroducerDisplay(editingMember.introducer)})` : 'None / Direct Join'}
              </p>
            </div>

            <div className="space-y-2 border-t pt-4">
              <label className="block text-sm font-bold text-slate-700">Select Introducer Source</label>
              <IntroducerSelector
                value={newIntroducerVal}
                onChange={setNewIntroducerVal}
                members={members}
                projects={allProjects}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* 5. Batch Update Introducer Modal */}
      {isBatchEditing && (
        <Modal
          isOpen={isBatchEditing}
          onClose={() => setIsBatchEditing(false)}
          title={`Batch Update Introducer for ${selectedMemberIds.size} Members`}
          size="md"
          footer={
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setIsBatchEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleBatchSaveIntroducer} isLoading={isSaving} disabled={isSaving}>
                Apply to All ({selectedMemberIds.size})
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 border border-slate-100 rounded-lg flex items-start gap-3">
              <Info className="text-jci-blue shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Batch Operation</p>
                <p>This action will set the chosen introducer source for all {selectedMemberIds.size} selected members at once.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Select Introducer Source</label>
              <IntroducerSelector
                value={batchIntroducerVal}
                onChange={setBatchIntroducerVal}
                members={members}
                projects={allProjects}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
