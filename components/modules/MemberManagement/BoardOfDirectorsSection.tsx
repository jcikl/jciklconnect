import React, { useState, useEffect, useMemo } from 'react';
import { Save, Calendar, Users, UserPlus, Plus, Trash2, ChevronRight, Award, Shield, RefreshCw } from 'lucide-react';
import { Card, Button, useToast, Badge, Modal } from '../../ui/Common';
import { Select, Input } from '../../ui/Form';
import { BoardManagementService } from '../../../services/boardManagementService';
import { BoardMember, Member } from '../../../types';

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

  const handleOpenManage = async (year: string) => {
    setSelectedTerm(year);
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

  const memberOptions = useMemo(() =>
    members.map(m => ({ value: m.id, label: m.name })),
    [members]
  );

  if (loading && terms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <RefreshCw className="w-10 h-10 text-slate-300 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Synchronizing Board Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Historical Board of Directors</h2>
          <p className="text-slate-500 mt-1">Management of "One Year to Lead" leadership terms</p>
        </div>
        {canManage && (
          <Button variant="outline" className="flex items-center gap-2" onClick={() => handleOpenManage(String(new Date().getFullYear() + 1))}>
            <Plus size={16} /> Setup Next Year
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {terms.map((term) => (
          <div
            key={term.year}
            onClick={() => handleOpenManage(term.year)}
            className="group relative bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:border-jci-blue transition-all cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Award size={100} className="text-jci-blue" />
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-jci-blue/10 rounded-xl flex items-center justify-center text-jci-blue">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{term.year}</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Leadership Term</p>
                </div>
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-jci-blue transition-colors" />
            </div>

            <div className="space-y-4 relative z-10">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">President</p>
                <p className="text-sm font-bold text-slate-800">{term.presidentName}</p>
              </div>

              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-slate-400" />
                  <span className="text-xs font-medium text-slate-600">Board Members</span>
                </div>
                <Badge variant="neutral">{term.totalMembers}</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        title={`Configure Board of Directors - ${selectedTerm}`}
        size="xl"
        drawerOnMobile
      >
        <div className="space-y-6 pb-20 sm:pb-0">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
            <Shield className="text-blue-500 shrink-0 mt-1" size={20} />
            <p className="text-sm text-blue-700">
              Only members assigned to the board for the current active year will receive <strong>Board Permissions</strong>.
            </p>
          </div>

          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-6 scrollbar-thin">
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

                  <div className="w-full sm:w-64">
                    <Select
                      value={assignments[position]?.memberId || ''}
                      onChange={(e) => handleAssignmentChange(position, e.target.value)}
                      options={[{ value: '', label: 'Select Member...' }, ...memberOptions]}
                      disabled={!canManage}
                    />
                  </div>
                </div>

                {assignments[position]?.memberId && (
                  <div className="pt-4 border-t border-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Commission Directors</h5>
                      {canManage && (
                        <div className="w-48">
                          <Select
                            placeholder="Add CD..."
                            value=""
                            onChange={(e) => handleAddCommissionDirector(position, e.target.value)}
                            options={[{ value: '', label: '+ Add Director' }, ...memberOptions]}
                            size="sm"
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
                            <div key={id} className="flex items-center gap-2 bg-slate-50 pl-2 pr-1 py-1 rounded-full border border-slate-200">
                              <span className="text-xs font-medium text-slate-700">{m?.name || 'Unknown'}</span>
                              {canManage && (
                                <button
                                  onClick={() => handleRemoveCommissionDirector(position, id)}
                                  className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full transition-colors"
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

          <div className="flex gap-3 pt-6 border-t mt-6">
            <Button variant="outline" className="flex-1" onClick={() => setShowManageModal(false)}>Cancel</Button>
            {canManage && (
              <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
                <Save size={18} /> {saving ? 'Saving...' : 'Update Board'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

