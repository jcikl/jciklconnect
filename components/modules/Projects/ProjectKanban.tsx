import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Button, Modal, useToast, Badge } from '../../ui/Common';
import { Input, Select, Textarea } from '../../ui/Form';
import { useProjects } from '../../../hooks/useProjects';
import { useMembers } from '../../../hooks/useMembers';
import { useAuth } from '../../../hooks/useAuth';
import { Task, Project } from '../../../types';

export const ProjectKanban: React.FC<{ projectId: string; projectName: string; project: Project }> = ({ projectId, projectName, project }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [newRemark, setNewRemark] = useState('');
  const [showStatusHistory, setShowStatusHistory] = useState(false);
  const [expandedRemarks, setExpandedRemarks] = useState<Set<string>>(new Set()); // Track which cards have expanded remarks
  const { getProjectTasks, createTask, updateTask, getTaskById } = useProjects();
  const { members } = useMembers();
  const { member } = useAuth();
  const { showToast } = useToast();
  const columns: Array<'Todo' | 'In Progress' | 'Done'> = ['Todo', 'In Progress', 'Done'];

  // Helper function to get sorted remarks (newest first)
  const getSortedRemarks = (remarks?: Record<string, { content: string; timestamp: string }>) => {
    if (!remarks) return [];
    return Object.entries(remarks)
      .map(([id, remark]) => ({ id, ...remark }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  // Helper function to get latest remark
  const getLatestRemark = (task: Task) => {
    const sortedRemarks = getSortedRemarks(task.remarks);
    return sortedRemarks.length > 0 ? sortedRemarks[0] : null;
  };

  // Toggle remarks expansion for a task
  const toggleRemarksExpansion = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setExpandedRemarks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // 使用 ref 来防止重复加载
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef<number>(0);

  const loadTasks = useCallback(async () => {
    // 防止重复加载：如果正在加载或距离上次加载不到 500ms，则跳过
    const now = Date.now();
    if (isLoadingRef.current || (now - lastLoadTimeRef.current < 500)) {
      console.log('[Kanban] Skipping duplicate loadTasks call');
      return;
    }

    isLoadingRef.current = true;
    lastLoadTimeRef.current = now;

    try {
      setLoading(true);
      // Load tasks from Firestore
      const projectTasks = await getProjectTasks(projectId);
      console.log('[Kanban] Loaded tasks:', projectTasks.length);

      // Normalize task status
      const normalizedTasks = projectTasks.map(t => ({
        ...t,
        status: String(t.status || 'Todo') as 'Todo' | 'In Progress' | 'Done',
      }));

      setTasks(normalizedTasks);
    } catch (err) {
      console.error('[Kanban] Error loading tasks:', err);
      showToast(`Failed to load tasks: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [projectId, getProjectTasks, showToast]);

  useEffect(() => {
    loadTasks();
  }, [projectId, loadTasks]);

  const handleTaskStatusChange = async (taskId: string, newStatus: 'Todo' | 'In Progress' | 'Done') => {
    try {
      // updateTask 会自动记录 statusHistory
      await updateTask(taskId, { status: newStatus });
      await loadTasks();
      // 更新 selectedTask 以反映新状态
      if (selectedTask && selectedTask.id === taskId) {
        const updatedTask = await getTaskById(taskId);
        if (updatedTask) {
          setSelectedTask(updatedTask);
        }
      }
      showToast('Task status updated successfully', 'success');
    } catch (err) {
      showToast('Failed to update task status', 'error');
    }
  };

  const handleAddRemark = async (taskId: string) => {
    if (!newRemark.trim()) {
      showToast('Please enter a remark', 'warning');
      return;
    }

    try {
      // 获取现有 task 以合并 remarks
      const existingTask = await getTaskById(taskId);
      const existingRemarks = existingTask?.remarks || {};

      // 添加新 remark
      const remarkId = `remark-${Date.now()}`;
      const updatedRemarks = {
        ...existingRemarks,
        [remarkId]: {
          content: newRemark.trim(),
          timestamp: new Date().toISOString(),
        },
      };

      await updateTask(taskId, { remarks: updatedRemarks });
      setNewRemark('');
      await loadTasks();

      // 更新 selectedTask
      if (selectedTask && selectedTask.id === taskId) {
        const updatedTask = await getTaskById(taskId);
        if (updatedTask) {
          setSelectedTask(updatedTask);
        }
      }

      showToast('Remark added successfully', 'success');
    } catch (err) {
      showToast('Failed to add remark', 'error');
    }
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', task.id);
  };

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(column);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: 'Todo' | 'In Progress' | 'Done') => {
    e.preventDefault();
    setDragOverColumn(null);

    if (draggedTask && draggedTask.status !== targetColumn) {
      await handleTaskStatusChange(draggedTask.id, targetColumn);
    }
    setDraggedTask(null);
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await createTask({
        projectId,
        title: formData.get('title') as string,
        status: 'Todo',
        priority: (formData.get('priority') as 'High' | 'Medium' | 'Low') || 'Medium',
        dueDate: formData.get('dueDate') as string,
        assignee: formData.get('assignee') as string || member?.id || '',
      });
      setIsTaskModalOpen(false);
      e.currentTarget.reset();
      await loadTasks();
    } catch (err) {
      showToast('Failed to create task', 'error');
    }
  };

  const getMemberName = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    return member?.name || memberId;
  };

  const COL_STYLE: Record<string, { border: string; badge: string; dot: string }> = {
    'Todo': { border: 'border-l-4 border-slate-400', badge: 'bg-slate-200 text-slate-600', dot: 'bg-slate-400' },
    'In Progress': { border: 'border-l-4 border-jci-blue', badge: 'bg-jci-blue/10 text-jci-blue', dot: 'bg-jci-blue' },
    'Done': { border: 'border-l-4 border-green-500', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  };

  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set(['Todo', 'Done']));
  const toggleCol = (col: string) => setCollapsedCols(prev => {
    const next = new Set(prev);
    next.has(col) ? next.delete(col) : next.add(col);
    return next;
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <>
      {/* Desktop: horizontal 3-column scroll; Mobile: stacked accordion */}
      <div className="md:flex md:gap-5 md:overflow-x-auto md:pb-6 space-y-3 md:space-y-0">
        {columns.map(col => {
          const columnTasks = tasks.filter(t => String(t.status || 'Todo').trim() === col);
          const style = COL_STYLE[col];
          const isCollapsed = collapsedCols.has(col);

          return (
            <div
              key={col}
              className={`md:w-80 md:flex-shrink-0 md:flex md:flex-col bg-slate-50 rounded-xl transition-all ${style.border} ${dragOverColumn === col ? 'ring-2 ring-jci-blue ring-offset-2' : ''}`}
              onDragOver={(e) => handleDragOver(e, col)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col)}
            >
              {/* Column header */}
              <div
                className="px-4 py-3 flex justify-between items-center cursor-pointer md:cursor-default select-none"
                onClick={() => toggleCol(col)}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                  <span className="font-semibold text-sm text-slate-700">{col}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>
                    {columnTasks.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-slate-400 hover:text-jci-blue p-1 rounded transition-colors hidden md:block"
                    onClick={(e) => { e.stopPropagation(); setSelectedTask(null); setIsTaskModalOpen(true); }}
                    title="Add task"
                  >
                    <Plus size={15} />
                  </button>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform md:hidden ${isCollapsed ? '' : 'rotate-180'}`} />
                </div>
              </div>

              {/* Tasks list */}
              <div className={`${isCollapsed ? 'hidden md:block' : ''} px-3 pb-3 space-y-2 md:overflow-y-auto md:flex-1 md:max-h-[560px]`}>
                {loading ? (
                  <div className="text-center py-6 text-slate-400 text-sm">Loading</div>
                ) : (
                  <>
                    {columnTasks.map(task => {
                      const due = task.dueDate ? new Date(task.dueDate) : null;
                      const isOverdue = due && due < today && col !== 'Done';
                      const latestRemark = getLatestRemark(task);
                      const allRemarks = getSortedRemarks(task.remarks);
                      const isExpanded = expandedRemarks.has(task.id);

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          className={`bg-white p-3 rounded-lg shadow-sm border border-slate-200 cursor-move hover:shadow-md transition-all ${draggedTask?.id === task.id ? 'opacity-40' : ''}`}
                          onClick={() => setSelectedTask(task)}
                        >
                          {/* Title row */}
                          <h4 className="text-sm font-semibold text-slate-800 line-clamp-2 mb-2">{task.title}</h4>

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            {task.role && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">{task.role}</span>
                            )}
                            <span className="text-xs text-slate-500 truncate">{getMemberName(task.assignee)}</span>
                          </div>

                          {/* Footer row: priority + due date */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${task.priority === 'High' ? 'bg-red-50 text-red-600' : task.priority === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                              {task.priority}
                            </span>
                            {due && (
                              <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                                <Calendar size={10} />
                                {due.toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {/* Latest remark */}
                          {allRemarks.length > 0 && (
                            <div className="mt-2 border-t border-slate-100 pt-2">
                              <div className="flex justify-between items-start gap-1">
                                <div className="flex-1 min-w-0">
                                  {!isExpanded && latestRemark && (
                                    <p className="text-xs text-slate-500 line-clamp-2 bg-slate-50 rounded px-2 py-1">{latestRemark.content}</p>
                                  )}
                                  {isExpanded && (
                                    <div className="space-y-1 max-h-28 overflow-y-auto">
                                      {allRemarks.map(r => (
                                        <div key={r.id} className="text-xs text-slate-500 bg-slate-50 rounded px-2 py-1">
                                          <p>{r.content}</p>
                                          <p className="text-[10px] text-slate-400 mt-0.5">{new Date(r.timestamp).toLocaleString()}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {allRemarks.length > 1 && (
                                  <button
                                    onClick={(e) => toggleRemarksExpansion(task.id, e)}
                                    className="flex-shrink-0 text-slate-400 hover:text-jci-blue p-0.5 rounded"
                                  >
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add task button */}
                    <button
                      className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm border border-dashed border-slate-200 rounded-lg hover:bg-white transition-colors"
                      onClick={(e) => { e.stopPropagation(); setSelectedTask(null); setIsTaskModalOpen(true); }}
                    >
                      + Add Task
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Modal */}
      <Modal
        isOpen={isTaskModalOpen || !!selectedTask}
        onClose={() => { setIsTaskModalOpen(false); setSelectedTask(null); setNewRemark(''); setShowStatusHistory(false); }}
        title={selectedTask ? 'Task Details' : 'New Task'}
        drawerOnMobile
      >
        {selectedTask ? (
          <div className="space-y-4">
            {/* Title + meta */}
            <div>
              <h3 className="font-bold text-base text-slate-900 mb-3">{selectedTask.title}</h3>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-500">Status</span>
                  <Badge variant="neutral">{selectedTask.status}</Badge>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-500">Priority</span>
                  <select
                    value={selectedTask.priority}
                    onChange={(e) => {
                      const priority = e.target.value as 'High' | 'Medium' | 'Low';
                      updateTask(selectedTask.id, { priority }).then(() => {
                        loadTasks();
                        setSelectedTask(prev => prev ? { ...prev, priority } : null);
                        showToast('Priority updated', 'success');
                      });
                    }}
                    className="text-xs bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-jci-blue"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-500">Assigned to</span>
                  <span className="font-medium text-slate-800">
                    {selectedTask.role ? `${selectedTask.role} · ` : ''}{getMemberName(selectedTask.assignee)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-500">Due date</span>
                  <span className="font-medium text-slate-800">{new Date(selectedTask.dueDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">Remarks</div>
              <Textarea
                value={newRemark}
                onChange={(e) => setNewRemark(e.target.value)}
                placeholder="Add a remark"
                rows={3}
              />
              <div className="flex justify-end mt-2">
                <Button type="button" size="sm" onClick={() => handleAddRemark(selectedTask.id)} disabled={!newRemark.trim()}>
                  Add Remark
                </Button>
              </div>
              {selectedTask.remarks && Object.keys(selectedTask.remarks).length > 0 && (
                <div className="space-y-2 max-h-52 overflow-y-auto mt-3">
                  {Object.entries(selectedTask.remarks)
                    .sort(([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map(([id, remark]) => (
                      <div key={id} className="text-sm bg-slate-50 rounded-lg border border-slate-100 px-3 py-2.5 flex justify-between items-start gap-3">
                        <div className="text-slate-700 flex-1">{remark.content}</div>
                        <div className="text-xs text-slate-400 whitespace-nowrap">{new Date(remark.timestamp).toLocaleString()}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => { setSelectedTask(null); setNewRemark(''); setShowStatusHistory(false); }}>Close</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateTask} className="space-y-4">
            <Input name="title" label="Task Title" placeholder="e.g. Design event flyer" required />
            <div className="grid grid-cols-2 gap-4">
              <Select
                name="priority"
                label="Priority"
                options={[
                  { label: 'High', value: 'High' },
                  { label: 'Medium', value: 'Medium' },
                  { label: 'Low', value: 'Low' }
                ]}
                defaultValue="Medium"
              />
              <Input name="dueDate" label="Due Date" type="date" required />
            </div>
            <Select
              name="assignee"
              label="Assign To"
              options={[
                { label: 'Unassigned', value: '' },
                ...members.map(m => ({ label: m.name, value: m.id }))
              ]}
            />
            <div className="pt-2 flex gap-3">
              <Button className="flex-1" type="submit">Create Task</Button>
              <Button variant="ghost" type="button" onClick={() => setIsTaskModalOpen(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
};
