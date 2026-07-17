import React, { useState } from 'react';
import { Edit, X } from 'lucide-react';
import { Button, Badge } from '../../ui/Common';
import { Input } from '../../ui/Form';
import { MemberSelector } from '../../ui/MemberSelector';
import { useMembers } from '../../../hooks/useMembers';
import { Project } from '../../../types';

interface ProjectTrainerTabProps {
  project: Project;
  onSave: (updates: Partial<Project>) => Promise<void>;
}

export const ProjectTrainerTab: React.FC<ProjectTrainerTabProps> = ({ project, onSave }) => {
  const { members } = useMembers();
  const [rows, setRows] = useState<{ name: string; memberId: string; role: string; durationHours: string }[]>(() => {
    return (project.trainers || []).map(t => ({
      name: t.name || '',
      memberId: t.memberId || '',
      role: t.role || '',
      durationHours: t.durationHours?.toString() || '',
    }));
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const resetRows = () => {
    setRows((project.trainers || []).map(t => ({
      name: t.name || '',
      memberId: t.memberId || '',
      role: t.role || '',
      durationHours: t.durationHours?.toString() || '',
    })));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const trainers = rows
        .map(r => ({
          name: r.name.trim(),
          memberId: r.memberId,
          role: r.role.trim(),
          durationHours: r.durationHours ? parseFloat(r.durationHours) : undefined,
        }))
        .filter(r => r.name);
      await onSave({ trainers });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-slate-900">Trainers & Facilitators</h3>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setIsEditing(false); resetRows(); }} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isSaving}>
                Save
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit size={14} className="mr-1.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* VIEW MODE */}
      {!isEditing && (
        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400">
              No trainers assigned yet.{' '}
            </div>
          ) : rows.map((row, rowIndex) => {
            const initials = row.name
              ? row.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
              : '?';
            return (
              <div key={rowIndex} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-100 text-violet-600 font-semibold text-sm flex items-center justify-center">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">{row.name}</span>
                    {row.role && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{row.role}</span>
                    )}
                    {row.memberId && (
                      <Badge variant="success">JCI Member</Badge>
                    )}
                  </div>
                  {row.durationHours && (
                    <div className="text-xs text-slate-400 mt-0.5 tabular-nums">{row.durationHours} hrs</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT MODE */}
      {isEditing && (
        <div className="space-y-3">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              {/* Top row: member selector + name */}
              <div className="flex flex-wrap gap-2 items-end p-3 bg-slate-50 border-b border-slate-100">
                <div className="flex-[2] min-w-[160px]">
                  <MemberSelector
                    label="Link to Member"
                    placeholder="Search member"
                    members={members}
                    value={row.memberId || ''}
                    onChange={(value) => {
                      setRows(prev => {
                        const next = [...prev];
                        next[rowIndex].memberId = value;
                        if (value) {
                          const member = members.find(m => m.id === value);
                          if (member) next[rowIndex].name = member.name || '';
                        }
                        return next;
                      });
                    }}
                    selfOption={false}
                    showLookupFields={false}
                    getOptionLabel={(m) => m.fullName ? `${m.name} (${m.fullName})` : m.name}
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Input
                    label="Trainer Name *"
                    required
                    value={row.name}
                    className="text-sm h-8"
                    placeholder="e.g. John Doe"
                    onChange={(e) => {
                      setRows(prev => { const next = [...prev]; next[rowIndex].name = e.target.value; return next; });
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="flex-shrink-0 mb-1 text-slate-300 hover:text-red-400 transition-colors p-1 rounded"
                  title="Remove trainer"
                  onClick={() => setRows(prev => prev.filter((_, i) => i !== rowIndex))}
                >
                  <X size={15} />
                </button>
              </div>
              {/* Bottom row: role + duration */}
              <div className="flex flex-wrap gap-2 items-end p-3">
                <div className="flex-1 min-w-[120px]">
                  <Input
                    label="Role"
                    value={row.role}
                    className="text-sm h-8"
                    placeholder="e.g. Head Trainer"
                    onChange={(e) => {
                      setRows(prev => { const next = [...prev]; next[rowIndex].role = e.target.value; return next; });
                    }}
                  />
                </div>
                <div className="w-32">
                  <Input
                    label="Duration (hrs)"
                    type="number"
                    step="0.5"
                    min="0"
                    value={row.durationHours}
                    className="text-sm h-8"
                    placeholder="e.g. 2.5"
                    onChange={(e) => {
                      setRows(prev => { const next = [...prev]; next[rowIndex].durationHours = e.target.value; return next; });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add Trainer dashed row */}
          <button
            type="button"
            className="w-full rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-sm text-slate-400 hover:border-jci-blue hover:text-jci-blue transition-colors"
            onClick={() => setRows(prev => [...prev, { name: '', role: '', memberId: '', durationHours: '' }])}
          >
            + Add Trainer
          </button>
        </div>
      )}
    </form>
  );
};
