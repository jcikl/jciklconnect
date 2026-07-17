import React, { useState } from 'react';
const uuidv4 = () => crypto.randomUUID();
import { Edit, X } from 'lucide-react';
import { Button, useToast } from '../../ui/Common';
import { Input } from '../../ui/Form';
import { MemberSelector } from '../../ui/MemberSelector';
import { useMembers } from '../../../hooks/useMembers';
import { useProjects } from '../../../hooks/useProjects';
import { Project, Task } from '../../../types';

// Project Event Committee Tab Component
interface ProjectCommitteeTabProps {
  project: Project;
  onSave: (updates: Partial<Project>) => Promise<void>;
}

const DEFAULT_EX_OFFICIO_ROLE = 'Ex-Officio';
const DEFAULT_ORGANISING_ROLE = 'Organising Chairperson';

const COMMITTEE_ROLES = [
  DEFAULT_EX_OFFICIO_ROLE,
  DEFAULT_ORGANISING_ROLE,
  'Project Secretary',
  'Project Treasurer',
  'Ticketing Director',
  'Program Director',
  'Marketing Director',
  'Venue Director',
  'Emcee',
];

export const ProjectCommitteeTab: React.FC<ProjectCommitteeTabProps> = ({ project, onSave }) => {
  const { members } = useMembers();
  const { showToast } = useToast();
  const { createTask, getTaskById } = useProjects();
  const [rows, setRows] = useState<{ role: string; memberId: string; tasks: { taskId?: string; title: string; dueDate: string }[] }[]>(() => {
    // 直接使用 project.committee 中的数据，不再自动创建 baseline
    // DEFAULT_EX_OFFICIO_ROLE 和 DEFAULT_ORGANISING_ROLE 只在创建 project 时添加
    const existing = project.committee || [];

    if (existing.length === 0) {
      // 如果没有保存的 committee 数据，返回空数组（用户可以手动添加角色）
      return [];
    }

    // 将已保存的 committee 数据转换为 rows 格式
    return existing.map(c => {
      const mappedTasks = (c.tasks || []).map(t => ({
        taskId: t.taskId, // 保留现有的 taskId
        title: t.title || '',
        dueDate: t.dueDate || '',
      }));

      return {
        role: c.role || '',
        memberId: c.memberId || '',
        // 确保至少有一个 task 行（即使为空），以便 UI 可以显示和编辑
        tasks: mappedTasks.length > 0 ? mappedTasks : [{ title: '', dueDate: '' }],
      };
    });
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const resetRows = () => {
    const existing = project.committee || [];
    if (existing.length === 0) {
      setRows([]);
      return;
    }
    setRows(existing.map(c => {
      const mappedTasks = (c.tasks || []).map(t => ({
        taskId: t.taskId,
        title: t.title || '',
        dueDate: t.dueDate || '',
      }));
      return {
        role: c.role || '',
        memberId: c.memberId || '',
        tasks: mappedTasks.length > 0 ? mappedTasks : [{ title: '', dueDate: '' }],
      };
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const committee = rows
        .map(r => {
          const cleanedTasks = (r.tasks || [])
            .map(t => {
              const title = t.title.trim();
              if (!title && !t.dueDate) {
                return null; // 跳过完全空白的 task
              }

              const task: { taskId?: string; title: string; dueDate?: string } = { title };

              // 如果 task 有 title，确保它有 taskId（如果没有则生成）
              if (title) {
                task.taskId = t.taskId || uuidv4();
              }

              if (t.dueDate) {
                task.dueDate = t.dueDate;
              }

              return task;
            })
            .filter((t): t is { taskId?: string; title: string; dueDate?: string } => t !== null)
            .filter(t => t.title || t.dueDate); // 至少有一个非空字段

          return {
            role: r.role.trim(),
            memberId: r.memberId,
            ...(cleanedTasks.length > 0 ? { tasks: cleanedTasks } : {}),
          };
        })
        .filter(r => r.role.trim().length > 0); // 只要 role 存在就保存（即使其他字段为空）

      // Save committee data to project
      await onSave({ committee });

      // Sync tasks to Firestore
      const projectTitle = project.title || project.name || 'Project';
      const tasksToSync: Array<Promise<void>> = [];

      for (const committeeMember of committee) {
        if (committeeMember.memberId && committeeMember.tasks && committeeMember.tasks.length > 0) {
          const committeeMemberName = members.find(m => m.id === committeeMember.memberId)?.name || '';

          for (const committeeTask of committeeMember.tasks) {
            if (committeeTask.taskId && committeeTask.title && committeeTask.title.trim()) {
              const taskId = committeeTask.taskId;
              const taskTitle = committeeTask.title.trim();

              const syncPromise = (async () => {
                try {
                  const existingTask = await getTaskById(taskId);

                  const taskData: Omit<Task, 'id'> = {
                    projectId: project.id,
                    projectTitle,
                    role: committeeMember.role,
                    committeeMemberId: committeeMember.memberId,
                    committeeName: committeeMemberName,
                    title: taskTitle,
                    status: existingTask?.status || 'Todo',
                    priority: existingTask?.priority || 'Medium',
                    dueDate: committeeTask.dueDate || existingTask?.dueDate || new Date().toISOString().split('T')[0],
                    assignee: committeeMember.memberId,
                    remarks: existingTask?.remarks,
                    statusHistory: existingTask?.statusHistory,
                  };

                  await createTask(taskData, taskId);
                } catch (err) {
                  console.error('[Committee] Failed to sync task:', taskId, err);
                }
              })();

              tasksToSync.push(syncPromise);
            }
          }
        }
      }

      if (tasksToSync.length > 0) {
        await Promise.all(tasksToSync);
        showToast(`Event committee updated and ${tasksToSync.length} task(s) synced`, 'success');
      } else {
        showToast('Event committee updated', 'success');
      }
      setIsEditing(false);
    } catch (err) {
      showToast('Failed to update event committee', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-slate-900">Event Committee</h3>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setIsEditing(false); resetRows(); }} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? 'Saving' : 'Save'}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit size={14} className="mr-1.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* VIEW MODE " card per member */}
      {!isEditing && (
        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400">
              No committee assigned yet.{' '}
              <button type="button" className="text-jci-blue underline" onClick={() => setIsEditing(true)}>Add members</button>
            </div>
          ) : rows.map((row, rowIndex) => {
            const member = members.find(m => m.id === row.memberId);
            const initials = member
              ? (member.name || member.fullName || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
              : '?';
            const visibleTasks = row.tasks.filter(t => t.title.trim());
            return (
              <div key={rowIndex} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                {/* Avatar */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-jci-blue/10 text-jci-blue font-semibold text-sm flex items-center justify-center">
                  {initials}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {member ? (member.fullName || member.name) : <span className="italic text-slate-400">Unassigned</span>}
                    </span>
                    {row.role && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {row.role}
                      </span>
                    )}
                  </div>
                  {visibleTasks.length > 0 && (
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 mt-2 overflow-hidden">
                      {visibleTasks.map((task, tIdx) => (
                        <li key={tIdx} className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-700 bg-slate-50">
                          <span className="truncate flex-1">{task.title}</span>
                          {task.dueDate && (
                            <span className="ml-3 flex-shrink-0 text-slate-400 tabular-nums">{task.dueDate}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT MODE " accordion sections */}
      {isEditing && (
        <div className="space-y-3">
          {rows.map((row, rowIndex) => {
            const isProtectedRole = row.role === DEFAULT_ORGANISING_ROLE || row.role === DEFAULT_EX_OFFICIO_ROLE;
            return (
              <div key={rowIndex} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Role + Member header row */}
                <div className="flex flex-wrap gap-2 items-center p-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex-1 min-w-[120px]">
                    <Input
                      placeholder="Role title"
                      value={row.role}
                      disabled={isProtectedRole}
                      className="text-sm h-8"
                      onChange={(e) => {
                        if (isProtectedRole) return;
                        const value = e.target.value;
                        setRows(prev => { const next = [...prev]; next[rowIndex] = { ...next[rowIndex], role: value }; return next; });
                      }}
                    />
                  </div>
                  <div className="flex-[2] min-w-[160px] flex items-center gap-1">
                    <div className="flex-1">
                      <MemberSelector
                        label=""
                        placeholder="Select member"
                        members={members}
                        value={row.memberId || ''}
                        onChange={(value) => {
                          setRows(prev => { const next = [...prev]; next[rowIndex] = { ...next[rowIndex], memberId: value }; return next; });
                        }}
                        selfOption={false}
                        showLookupFields={false}
                        getOptionLabel={(m) => m.fullName ? `${m.name} (${m.fullName})` : m.name}
                      />
                    </div>
                    {row.memberId && (
                      <button
                        type="button"
                        className="flex-shrink-0 self-stretch flex items-center gap-1 px-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 text-xs font-semibold transition-colors"
                        title="Clear member"
                        onClick={() => setRows(prev => { const next = [...prev]; next[rowIndex] = { ...next[rowIndex], memberId: '' }; return next; })}
                      >
                        <X size={12} />
                        Remove
                      </button>
                    )}
                  </div>
                  {!isProtectedRole && (
                    <button
                      type="button"
                      className="flex-shrink-0 text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
                      title="Remove role"
                      onClick={() => setRows(prev => prev.filter((_, i) => i !== rowIndex))}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Tasks compact table */}
                <div className="divide-y divide-slate-100">
                  {row.tasks.map((task, tIndex) => (
                    <div key={tIndex} className="flex gap-2 items-center px-3 py-2">
                      <Input
                        placeholder="Task title"
                        value={task.title}
                        className="flex-1 text-sm h-8"
                        onChange={(e) => {
                          const value = e.target.value;
                          setRows(prev => {
                            const next = [...prev];
                            const tasks = [...next[rowIndex].tasks];
                            tasks[tIndex] = { ...tasks[tIndex], title: value };
                            next[rowIndex] = { ...next[rowIndex], tasks };
                            return next;
                          });
                        }}
                      />
                      <Input
                        type="date"
                        value={task.dueDate}
                        className="w-36 text-sm h-8"
                        onChange={(e) => {
                          const value = e.target.value;
                          setRows(prev => {
                            const next = [...prev];
                            const tasks = [...next[rowIndex].tasks];
                            tasks[tIndex] = { ...tasks[tIndex], dueDate: value };
                            next[rowIndex] = { ...next[rowIndex], tasks };
                            return next;
                          });
                        }}
                      />
                      {row.tasks.length > 1 && (
                        <button
                          type="button"
                          className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors p-1 rounded"
                          onClick={() => setRows(prev => {
                            const next = [...prev];
                            next[rowIndex] = { ...next[rowIndex], tasks: next[rowIndex].tasks.filter((_, i) => i !== tIndex) };
                            return next;
                          })}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Task inline link */}
                <div className="px-3 pb-2.5">
                  <button
                    type="button"
                    className="text-xs text-jci-blue hover:underline"
                    onClick={() => setRows(prev => {
                      const next = [...prev];
                      next[rowIndex] = { ...next[rowIndex], tasks: [...next[rowIndex].tasks, { title: '', dueDate: '' }] };
                      return next;
                    })}
                  >
                    + Add task
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add Role dashed row */}
          <button
            type="button"
            className="w-full rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-sm text-slate-400 hover:border-jci-blue hover:text-jci-blue transition-colors"
            onClick={() => setRows(prev => [...prev, { role: '', memberId: '', tasks: [{ title: '', dueDate: '' }] }])}
          >
            + Add Role
          </button>
        </div>
      )}
    </form>
  );
};
