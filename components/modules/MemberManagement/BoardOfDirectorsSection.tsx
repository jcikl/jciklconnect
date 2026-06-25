import React, { useState, useEffect, useMemo } from 'react';
import { Save, Calendar, Users, UserPlus, Plus, Trash2, ChevronRight, Award, Shield, RefreshCw } from 'lucide-react';
import { Card, Button, useToast, Badge, Modal } from '../../ui/Common';
import { Select, Input } from '../../ui/Form';
import { MemberSelector } from '../../ui/MemberSelector';
import { BoardManagementService } from '../../../services/boardManagementService';
import { BoardMember, Member } from '../../../types';

const POSITION_ORDER: Record<string, number> = {
  'President': 1,
  'Immediate Past President': 2,
  'Executive Vice President': 3,
  'General Legal Council': 4,
  'Secretary': 5,
  'Honorary Treasurer': 6,
  'Vice President (Individual)': 7,
  'Vice President (Business)': 8,
  'Vice President (Community)': 9,
  'Vice President (International Affairs)': 10,
  'Vice President (LOM)': 11,
};

interface BoardOfDirectorsSectionProps {
  members: Member[];
  canManage: boolean;
}

interface TermSummary {
  year: string;
  presidentName: string;
  totalMembers: number;
}

export const BoardOfDirectorsSection: React.FC<BoardOfDirectorsSectionProps> = ({ members, canManage }) => {
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<TermSummary[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // States for the management modal
  const [assignments, setAssignments] = useState<Record<string, { memberId: string; commissionDirectorIds: string[] }>>({});
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const positions = BoardManagementService.getDefaultBoardPositions();

  const loadTerms = async () => {
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const years = Array.from({ length: currentYear - 1954 + 1 }, (_, i) => String(1954 + i));

      const summaries: TermSummary[] = await Promise.all(years.map(async (year) => {
        const board = await BoardManagementService.getBoardMembersByYear(year);
        const president = board.find(m => m.position === 'President' && m.isActive);
        const presidentName = president ? members.find(m => m.id === president.memberId)?.name || 'Unknown' : 'Not Set';
        return {
          year,
          presidentName,
          totalMembers: board.filter(m => m.isActive).length
        };
      }));

      setTerms(summaries.sort((a, b) => b.year.localeCompare(a.year)));

      // Ensure member docs reflect current-year board (grants Access Permissions / isBoard)
      await BoardManagementService.syncCurrentYearBoardAssignees().catch((err) => {
        console.warn('Current-year board member sync skipped:', err);
      });
    } catch (err) {
      console.error('Failed to load board terms:', err);
      showToast('Failed to load board summaries', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, [members]);

  const handleOpenManage = async (year: string, forceEdit = false) => {
    setSelectedTerm(year);
    setIsEditing(forceEdit);
    setLoading(true);
    try {
      const boardMembers = await BoardManagementService.getBoardMembersByYear(year);
      const map: Record<string, { memberId: string; commissionDirectorIds: string[] }> = {};

      positions.forEach(pos => {
        const found = boardMembers.find(bm => bm.position === pos && bm.isActive);
        map[pos] = {
          memberId: found?.memberId || '',
          commissionDirectorIds: found?.commissionDirectorIds || []
        };
      });

      setAssignments(map);
      setShowManageModal(true);
    } catch (err) {
      showToast('Failed to load board details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentChange = (position: string, memberId: string) => {
    setAssignments(prev => ({
      ...prev,
      [position]: { ...prev[position], memberId }
    }));
  };

  const handleAddCommissionDirector = (position: string, memberId: string) => {
    if (!memberId) return;
    setAssignments(prev => {
      const current = prev[position].commissionDirectorIds;
      if (current.includes(memberId)) return prev;
      return {
        ...prev,
        [position]: {
          ...prev[position],
          commissionDirectorIds: [...current, memberId]
        }
      };
    });
  };

  const handleRemoveCommissionDirector = (position: string, memberId: string) => {
    setAssignments(prev => ({
      ...prev,
      [position]: {
        ...prev[position],
        commissionDirectorIds: prev[position].commissionDirectorIds.filter(id => id !== memberId)
      }
    }));
  };

  const handleSave = async () => {
    if (!selectedTerm) return;
    setSaving(true);
    try {
      const list = Object.entries(assignments)
        .filter(([_, data]) => data.memberId)
        .map(([position, data]) => ({
          position,
          memberId: data.memberId,
          commissionDirectorIds: data.commissionDirectorIds
        }));

      await BoardManagementService.setBoardForTerm(selectedTerm, list);
      showToast(`Board for ${selectedTerm} updated successfully`, 'success');
      setShowManageModal(false);
      loadTerms();
    } catch (err) {
      showToast('Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const nameA = (a.fullName || a.name || '').toLowerCase();
      const nameB = (b.fullName || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [members]);

  const getMemberLabel = (m: Member) => {
    if (!m) return '';
    const namePart = m.name;
    const fullNamePart = m.fullName || '';
    const idPart = m.idNumber ? `(${m.idNumber})` : '';

    if (fullNamePart || idPart) {
      return `${fullNamePart} ${idPart} - ${namePart}`.trim();
    }
    return namePart;
  };

  const allAssignedIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(assignments).forEach(data => {
      if (data.memberId) ids.add(data.memberId);
      data.commissionDirectorIds.forEach(id => ids.add(id));
    });
    return ids;
  }, [assignments]);

  const assignedPositions = useMemo(() => {
    return Object.entries(assignments)
      .filter(([_, data]) => data.memberId)
      .sort((a, b) => {
        const orderA = POSITION_ORDER[a[0]] || 99;
        const orderB = POSITION_ORDER[b[0]] || 99;
        return orderA - orderB;
      });
  }, [assignments]);

  if (loading && terms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <RefreshCw className="w-10 h-10 text-slate-300 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Synchronizing Board Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {canManage && (
          <Button
            variant="outline"
            className="w-full md:w-auto flex items-center justify-center gap-2"
            onClick={() => handleOpenManage(String(new Date().getFullYear() + 1), true)}
          >
            <Plus size={16} /> Setup Next Year
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {terms.map((term) => (
          <div
            key={term.year}
            onClick={() => handleOpenManage(term.year, false)}
            className="group relative bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-xl hover:border-jci-blue transition-all cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Award size={80} className="text-jci-blue" />
            </div>

            <div className="flex items-center gap-4 mb-4 relative z-10">
              <div className="flex-shrink-0">
                <h3 className="text-2xl font-black text-slate-900 leading-none">{term.year}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Term</p>
              </div>

              <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">President</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{term.presidentName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Board</p>
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-sm font-black text-jci-blue">{term.totalMembers}</span>
                    <Users size={10} className="text-jci-blue/60" />
                  </div>
                </div>
              </div>

              <ChevronRight className="text-slate-300 group-hover:text-jci-blue transition-colors shrink-0" size={18} />
            </div>

            <div className="space-y-4 relative z-10">
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        title={isEditing ? `Configure Board of Directors - ${selectedTerm}` : `Board of Directors Directory - ${selectedTerm}`}
        size="xl"
        drawerOnMobile
        footer={
          <div className="flex gap-3 w-full">
            {isEditing ? (
              <>
                <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>
                  Back to Directory
                </Button>
                {canManage && (
                  <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
                    <Save size={18} /> {saving ? 'Saving...' : 'Update Board'}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" className="flex-1" onClick={() => setShowManageModal(false)}>
                  Close
                </Button>
                {canManage && (
                  <Button className="flex-1 gap-2 bg-jci-blue hover:bg-jci-blue/90" onClick={() => setIsEditing(true)}>
                    Manage Assignees
                  </Button>
                )}
              </>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {isEditing ? (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                <Shield className="text-blue-500 shrink-0 mt-1" size={20} />
                <p className="text-sm text-blue-700 font-medium">
                  Only members assigned to the board for the current active year will receive <strong>Board Permissions</strong>. Commission Directors do not receive Board Permissions.
                </p>
              </div>

              {positions.map(position => (
                <div key={position} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-slate-100">
                        <Award size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{position}</h4>
                        <p className="text-xs text-slate-500">Assignment for {selectedTerm}</p>
                      </div>
                    </div>

                    <div className="w-full sm:w-80">
                      <MemberSelector
                        label=""
                        members={sortedMembers.filter(m => !allAssignedIds.has(m.id) || m.id === (assignments[position]?.memberId || ''))}
                        getOptionLabel={getMemberLabel}
                        value={assignments[position]?.memberId || ''}
                        onChange={(id) => handleAssignmentChange(position, id)}
                        selfOption={false}
                        showLookupFields={false}
                        placeholder="Search member..."
                        disabled={!canManage}
                      />
                    </div>
                  </div>

                  {assignments[position]?.memberId && (
                    <div className="pt-4 border-t border-slate-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Commission Directors</h5>
                        {canManage && (
                          <div className="w-80">
                            <MemberSelector
                              label=""
                              members={sortedMembers.filter(m => !allAssignedIds.has(m.id))}
                              getOptionLabel={getMemberLabel}
                              value=""
                              onChange={(id) => handleAddCommissionDirector(position, id)}
                              selfOption={false}
                              showLookupFields={false}
                              placeholder="+ Add Director"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {assignments[position].commissionDirectorIds.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No commission directors assigned</p>
                        ) : (
                          assignments[position].commissionDirectorIds.map(id => {
                            const m = members.find(mem => mem.id === id);
                            return (
                              <div key={id} className="flex items-center gap-2 bg-slate-50 pl-4 pr-1 py-1 rounded-full border border-slate-200">
                                <span className="text-xs font-medium text-slate-700">{m?.name || 'Unknown'}</span>
                                {canManage && (
                                  <button
                                    onClick={() => handleRemoveCommissionDirector(position, id)}
                                    className="hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full transition-colors"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {assignedPositions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="w-12 h-12 text-slate-300 mb-2" />
                  <p className="text-slate-500 font-medium">No board members assigned for this term.</p>
                  {canManage && (
                    <Button size="sm" className="mt-4" onClick={() => setIsEditing(true)}>
                      Start Setup
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {assignedPositions.map(([position, data]) => {
                    const bm = members.find(m => m.id === data.memberId);
                    if (!bm) return null;
                    const isPresident = position === 'President';
                    const directors = data.commissionDirectorIds
                      .map(id => members.find(m => m.id === id))
                      .filter(Boolean) as Member[];

                    return (
                      <div 
                        key={position} 
                        className={`rounded-2xl border p-4 transition-all relative overflow-hidden flex flex-col justify-between ${
                          isPresident 
                            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-md col-span-1 sm:col-span-2' 
                            : 'bg-white border-slate-100 shadow-sm'
                        }`}
                      >
                        {isPresident && (
                          <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                            President
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <img 
                            src={bm.avatar || undefined} 
                            alt={bm.name} 
                            className={`rounded-xl object-cover bg-slate-100 border shrink-0 ${
                              isPresident ? 'w-16 h-16 border-blue-300' : 'w-12 h-12 border-slate-200'
                            }`} 
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{position}</p>
                            <h4 className={`font-black text-slate-900 truncate ${isPresident ? 'text-lg' : 'text-sm'}`}>
                              {bm.fullName || bm.name}
                            </h4>
                            <p className="text-xs text-slate-500 truncate">{bm.companyName || bm.profession || 'JCI Member'}</p>
                          </div>
                        </div>

                        {directors.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-100/80">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-2">Commission Directors</p>
                            <div className="flex flex-wrap gap-2">
                              {directors.map(dir => (
                                <div key={dir.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 rounded-full pl-1.5 pr-3 py-0.5 max-w-[200px] truncate">
                                  <img src={dir.avatar || undefined} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />
                                  <span className="text-[10px] font-semibold text-slate-600 truncate">{dir.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

