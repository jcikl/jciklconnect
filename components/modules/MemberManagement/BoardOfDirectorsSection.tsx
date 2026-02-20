import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Card, Button, useToast } from '../../ui/Common';
import { Select } from '../../ui/Form';
import { BoardManagementService } from '../../../services/boardManagementService';

interface BoardOfDirectorsSectionProps {
  members: Array<{ id: string; name: string }>;
  canManage: boolean;
}

/** Board of Directors: set board members per term (year) */
export const BoardOfDirectorsSection: React.FC<BoardOfDirectorsSectionProps> = ({ members, canManage }) => {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - 3 + i);
  const [selectedTerm, setSelectedTerm] = useState<string>(String(currentYear));
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const positions = BoardManagementService.getDefaultBoardPositions();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    BoardManagementService.getBoardMembersByYear(selectedTerm)
      .then((boardMembers) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        boardMembers.filter(bm => bm.isActive).forEach(bm => {
          map[bm.position] = bm.memberId;
        });
        setAssignments(map);
      })
      .catch(() => {
        if (!cancelled) setAssignments({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedTerm]);

  const handleAssignmentChange = (position: string, memberId: string) => {
    setAssignments(prev => ({ ...prev, [position]: memberId }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const list = positions
        .map(position => ({ position, memberId: assignments[position] || '' }))
        .filter(a => a.memberId);
      await BoardManagementService.setBoardForTerm(selectedTerm, list);
      showToast('Board of Directors saved for term ' + selectedTerm, 'success');
    } catch (err) {
      showToast('Failed to save Board of Directors', 'error');
    } finally {
      setSaving(false);
    }
  };

  const memberOptions = members.map(m => ({ value: m.id, label: m.name }));

  if (loading) {
    return <div className="text-center text-slate-500 py-10">Loading board for {selectedTerm}...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm font-medium text-slate-700">Term (Year)</label>
        <select
          value={selectedTerm}
          onChange={(e) => setSelectedTerm(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-jci-blue focus:border-jci-blue"
        >
          {yearOptions.map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        {canManage && (
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Board'}
          </Button>
        )}
      </div>
      <Card title={`Board of Directors – ${selectedTerm}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {positions.map(position => (
            <div key={position} className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 w-36 shrink-0">{position}</span>
              {canManage ? (
                <Select
                  value={assignments[position] || ''}
                  onChange={(e) => handleAssignmentChange(position, e.target.value)}
                  options={[{ value: '', label: '— Not assigned —' }, ...memberOptions]}
                  className="flex-1"
                />
              ) : (
                <span className="text-slate-900">
                  {assignments[position]
                    ? members.find(m => m.id === assignments[position])?.name ?? '—'
                    : '— Not assigned —'}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
