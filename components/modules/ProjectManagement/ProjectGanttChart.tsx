import React, { useState, useEffect, useMemo } from 'react';
import { Gantt, Task as GanttLibTask, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import {
  Calendar,
  Filter,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Play
} from 'lucide-react';
import { Task, Project } from '../../../types';
import { ProjectsService } from '../../../services/projectsService';
import { useMembers } from '../../../hooks/useMembers';
import { useToast } from '../../ui/Common';
import * as Forms from '../../ui/Form';

interface ProjectGanttChartProps {
  project: Project;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => Promise<void>;
  onClose: () => void;
}

// Local interface for Gantt tasks with support for role-based grouping
export interface GanttTask {
  id: string;
  projectId: string;
  name: string;
  role?: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  dependencies: string[];
  assignees: string[];
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  priority: 'High' | 'Medium' | 'Low';
  type: 'task' | 'milestone' | 'project';
  styles?: {
    backgroundColor?: string;
    backgroundSelectedColor?: string;
    progressColor?: string;
    progressSelectedColor?: string;
  };
}

// Ensure date is valid Date object (gantt-task-react requires start/end to have getTime())
const toValidDate = (d: Date | string | undefined, fallback: Date): Date => {
  if (!d) return fallback;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? fallback : date;
};

// Convert our GanttTask to the library's Task format
const convertToGanttLibTask = (task: GanttTask): GanttLibTask => {
  const fallbackStart = new Date();
  const fallbackEnd = new Date(fallbackStart.getTime() + 24 * 60 * 60 * 1000);
  const start = toValidDate(task.startDate, fallbackStart);
  const end = toValidDate(task.endDate, fallbackEnd);
  // Ensure end >= start
  const endDate = end.getTime() >= start.getTime() ? end : new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    start,
    end: endDate,
    name: task.name,
    id: task.id,
    type: task.type === 'milestone' ? 'milestone' : task.type === 'project' ? 'project' : 'task',
    progress: task.progress,
    isDisabled: false,
    styles: task.styles,
    dependencies: task.dependencies || [],
  };
};

// Get task color based on status and priority
const getTaskColor = (status: GanttTask['status'], priority?: string, selected = false): string => {
  const alpha = selected ? '0.8' : '0.6';

  switch (status) {
    case 'completed':
      return `rgba(34, 197, 94, ${alpha})`; // green
    case 'in_progress':
      return `rgba(59, 130, 246, ${alpha})`; // blue
    case 'overdue':
      return `rgba(239, 68, 68, ${alpha})`; // red
    default:
      switch (priority) {
        case 'High':
          return `rgba(245, 158, 11, ${alpha})`; // amber
        case 'Medium':
          return `rgba(107, 114, 128, ${alpha})`; // gray
        case 'Low':
          return `rgba(156, 163, 175, ${alpha})`; // light gray
        default:
          return `rgba(107, 114, 128, ${alpha})`; // gray
      }
  }
};

// Convert regular Task to GanttTask
const convertTaskToGanttTask = (task: Task): GanttTask => {
  const now = new Date();
  const startDate = task.startDate ? new Date(task.startDate) : now;
  const parsedStart = isNaN(startDate.getTime()) ? now : startDate;
  const endFromDue = task.dueDate ? new Date(task.dueDate) : null;
  const parsedEnd = (endFromDue && !isNaN(endFromDue.getTime()))
    ? endFromDue
    : new Date(parsedStart.getTime() + (task.duration || 1) * 24 * 60 * 60 * 1000);
  const endDate = parsedEnd.getTime() >= parsedStart.getTime()
    ? parsedEnd
    : new Date(parsedStart.getTime() + 24 * 60 * 60 * 1000);

  let status: GanttTask['status'] = 'not_started';
  switch (task.status) {
    case 'In Progress':
      status = 'in_progress';
      break;
    case 'Done':
      status = 'completed';
      break;
    default:
      status = 'not_started';
  }

  // Check if overdue
  if (status !== 'completed' && endDate.getTime() < Date.now()) {
    status = 'overdue';
  }

  return {
    id: task.id,
    projectId: task.projectId,
    name: task.title,
    role: task.role,
    startDate: parsedStart,
    endDate,
    progress: task.progress || 0,
    dependencies: task.dependencies || [],
    assignees: task.assignee ? [task.assignee] : [],
    status,
    priority: task.priority,
    type: 'task',
    styles: {
      backgroundColor: getTaskColor(status, task.priority),
      backgroundSelectedColor: getTaskColor(status, task.priority, true),
      progressColor: getProgressColor(status),
      progressSelectedColor: getProgressColor(status, true),
    },
  };
};

const getProgressColor = (status: GanttTask['status'], selected = false): string => {
  const alpha = selected ? '0.9' : '0.7';

  switch (status) {
    case 'completed':
      return `rgba(21, 128, 61, ${alpha})`; // dark green
    case 'in_progress':
      return `rgba(37, 99, 235, ${alpha})`; // dark blue
    case 'overdue':
      return `rgba(220, 38, 38, ${alpha})`; // dark red
    default:
      return `rgba(75, 85, 99, ${alpha})`; // dark gray
  }
};

export const ProjectGanttChart: React.FC<ProjectGanttChartProps> = ({
  project,
  onUpdateProject,
  onClose,
}) => {
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);
  const [isChecked, setIsChecked] = useState(true);
  const [selectedTask, setSelectedTask] = useState<string>('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const { members } = useMembers();
  const { showToast } = useToast();

  useEffect(() => {
    loadProjectTasks();
  }, [project.id]);

  const loadProjectTasks = async () => {
    setLoading(true);
    try {
      const projectTasks = await ProjectsService.getProjectTasks(project.id);
      const ganttTasks = projectTasks.map(convertTaskToGanttTask);
      setTasks(ganttTasks);
    } catch (error) {
      console.error('Error loading project tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks based on current filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (assigneeFilter !== 'all' && !task.assignees.includes(assigneeFilter)) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, assigneeFilter, priorityFilter]);

  // Helper for formatting date to dd mmm yyyy
  const formatDateToCustom = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Convert to library format and group by Role
  const ganttTasks = useMemo(() => {
    const validTasks = filteredTasks.filter(t => t.startDate != null && t.endDate != null);

    // Group by role
    const groups: Record<string, GanttTask[]> = {};
    validTasks.forEach(t => {
      const role = t.role || 'Unassigned';
      if (!groups[role]) groups[role] = [];
      groups[role].push(t);
    });

    const finalTasks: GanttLibTask[] = [];

    // Process groups to insert role header (as a 'project' bar)
    Object.keys(groups).sort().forEach(role => {
      const roleTasks = groups[role];
      const earliestStart = new Date(Math.min(...roleTasks.map(t => t.startDate.getTime())));
      const latestEnd = new Date(Math.max(...roleTasks.map(t => t.endDate.getTime())));

      // Find the name of the person assigned to this role
      // We take the first non-empty assignee from the tasks in this role
      const firstAssignee = roleTasks.find(t => t.assignees.length > 0)?.assignees[0];
      const memberName = firstAssignee ? (members.find(m => m.id === firstAssignee)?.name || '') : '';
      const headerName = memberName ? `${role} (${memberName})` : role;

      // Add a header for the group (type 'project')
      finalTasks.push({
        id: `gp-${role}`,
        name: headerName,
        start: earliestStart,
        end: latestEnd,
        type: 'project',
        progress: Math.round(roleTasks.reduce((acc, t) => acc + t.progress, 0) / roleTasks.length),
        hideChildren: false,
        displayOrder: finalTasks.length + 1,
        styles: {
          backgroundColor: '#94a3b8',
          backgroundSelectedColor: '#64748b',
          progressColor: '#475569',
          progressSelectedColor: '#334155',
        }
      });

      // Add tasks belonging to this role
      roleTasks.forEach(t => {
        finalTasks.push({
          ...convertToGanttLibTask(t),
          project: `gp-${role}`, // Optional, used by some libraries for nesting
          displayOrder: finalTasks.length + 1
        });
      });
    });

    return finalTasks;
  }, [filteredTasks, members]);

  // Get unique assignees for filter
  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    tasks.forEach(task => {
      task.assignees.forEach(assignee => assignees.add(assignee));
    });
    return Array.from(assignees);
  }, [tasks]);

  // Handle task date change
  const handleTaskChange = async (task: GanttLibTask) => {
    if (task.start == null || task.end == null) return;

    // Normalize to day-units (start of the day for both)
    const normalizedStart = new Date(task.start);
    normalizedStart.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(task.end);
    normalizedEnd.setHours(0, 0, 0, 0);

    // Optimistic update
    const updatedTasks = tasks.map(t => {
      if (t.id === task.id) {
        return {
          ...t,
          startDate: normalizedStart,
          endDate: normalizedEnd,
          progress: task.progress,
        };
      }
      return t;
    });
    setTasks(updatedTasks);

    // Persist to Firestore
    try {
      const formatDateForSync = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startStr = formatDateForSync(normalizedStart);
      const endStr = formatDateForSync(normalizedEnd);

      // 1. Update the task document
      await ProjectsService.updateTask(task.id, {
        startDate: startStr,
        dueDate: endStr,
      });

      // 2. Sync with project committee tasks
      if (project.committee) {
        let committeeChanged = false;
        const updatedCommittee = project.committee.map(member => {
          if (member.tasks) {
            const taskIndex = member.tasks.findIndex(ct => ct.taskId === task.id);
            if (taskIndex !== -1) {
              const updatedTasks = [...member.tasks];
              updatedTasks[taskIndex] = {
                ...updatedTasks[taskIndex],
                dueDate: endStr,
              };
              committeeChanged = true;
              return { ...member, tasks: updatedTasks };
            }
          }
          return member;
        });

        if (committeeChanged) {
          if (onUpdateProject) {
            await onUpdateProject(project.id, { committee: updatedCommittee });
          } else {
            await ProjectsService.updateProject(project.id, {
              committee: updatedCommittee
            });
          }
        }
      }

      // Auto-refresh data after successful update
      await loadProjectTasks();
      showToast('Task updated and synced', 'success');
    } catch (err) {
      console.error('Failed to update task dates:', err);
      // Revert on error
      loadProjectTasks();
    }
  };

  // Handle task progress change
  const handleProgressChange = (task: GanttLibTask) => {
    const updatedTasks = tasks.map(t => {
      if (t.id === task.id) {
        return {
          ...t,
          progress: task.progress,
        };
      }
      return t;
    });
    setTasks(updatedTasks);
  };

  // Handle task selection
  const handleSelect = (task: GanttLibTask, isSelected: boolean) => {
    setSelectedTask(isSelected ? task.id : '');
  };

  // Handle task double click for editing
  const handleDoubleClick = (task: GanttLibTask) => {
    // Task editing functionality can be implemented here
    console.log('Task double clicked:', task);
  };

  // Check for dependency conflicts
  const checkDependencyConflicts = (tasks: GanttTask[]): Array<{ taskId: string, conflict: string }> => {
    const conflicts: Array<{ taskId: string, conflict: string }> = [];

    tasks.forEach(task => {
      task.dependencies.forEach(depId => {
        const dependency = tasks.find(t => t.id === depId);
        if (dependency && dependency.endDate > task.startDate) {
          conflicts.push({
            taskId: task.id,
            conflict: `Task "${task.name}" starts before dependency "${dependency.name}" ends`,
          });
        }
      });
    });

    return conflicts;
  };

  // Calculate critical path
  const calculateCriticalPath = (tasks: GanttTask[]): string[] => {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const criticalTasks: string[] = [];

    // Find tasks with no successors (end tasks)
    const endTasks = tasks.filter(task =>
      !tasks.some(t => t.dependencies.includes(task.id))
    );

    // Trace back from end tasks
    const tracePath = (taskId: string, visited = new Set<string>()) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);
      criticalTasks.push(taskId);

      const task = taskMap.get(taskId);
      if (task) {
        task.dependencies.forEach(depId => tracePath(depId, visited));
      }
    };

    endTasks.forEach(task => tracePath(task.id));

    return criticalTasks;
  };

  const conflicts = useMemo(() => checkDependencyConflicts(filteredTasks), [filteredTasks]);
  const criticalPath = useMemo(() => calculateCriticalPath(filteredTasks), [filteredTasks]);

  if (loading) {
    return (
      <div className="max-w-full mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-600" />
            <Forms.Select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              options={[
                { label: 'Day', value: ViewMode.Day },
                { label: 'Week', value: ViewMode.Week },
                { label: 'Month', value: ViewMode.Month },
                { label: 'Year', value: ViewMode.Year },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-600" />
            <Forms.Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: 'All Status', value: 'all' },
                { label: 'Not Started', value: 'not_started' },
                { label: 'In Progress', value: 'in_progress' },
                { label: 'Completed', value: 'completed' },
                { label: 'Overdue', value: 'overdue' },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <Users size={16} className="text-gray-600" />
            <Forms.Select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              options={[
                { label: 'All Assignees', value: 'all' },
                ...uniqueAssignees.map(assignee => ({
                  label: assignee,
                  value: assignee,
                }))
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-gray-600" />
            <Forms.Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              options={[
                { label: 'All Priorities', value: 'all' },
                { label: 'High', value: 'High' },
                { label: 'Medium', value: 'Medium' },
                { label: 'Low', value: 'Low' },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <Forms.Checkbox
              label="Show Dependencies"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
            />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {conflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-medium text-red-800">Dependency Conflicts Detected</h3>
          </div>
          <div className="space-y-1">
            {conflicts.map((conflict, index) => (
              <p key={index} className="text-sm text-red-700">
                {conflict.conflict}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-xl font-bold text-gray-900">
                {filteredTasks.filter(t => t.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-xl font-bold text-gray-900">
                {filteredTasks.filter(t => t.status === 'in_progress').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-xl font-bold text-gray-900">
                {filteredTasks.filter(t => t.status === 'overdue').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm text-gray-600">Critical Path</p>
              <p className="text-xl font-bold text-gray-900">
                {criticalPath.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="h-[600px] overflow-auto">
          {ganttTasks.length > 0 ? (
            <Gantt
              tasks={ganttTasks}
              viewMode={viewMode}
              onDateChange={handleTaskChange}
              onProgressChange={handleProgressChange}
              onSelect={handleSelect}
              onDoubleClick={handleDoubleClick}
              listCellWidth={isChecked ? "155px" : ""}
              columnWidth={viewMode === ViewMode.Month ? 300 : viewMode === ViewMode.Week ? 250 : 65}
              ganttHeight={550}
              barBackgroundColor="#3B82F6"
              barBackgroundSelectedColor="#1D4ED8"
              barProgressColor="#1E40AF"
              barProgressSelectedColor="#1E3A8A"
              projectBackgroundColor="#94a3b8"
              projectBackgroundSelectedColor="#64748b"
              projectProgressColor="#475569"
              projectProgressSelectedColor="#334155"
              milestoneBackgroundColor="#F59E0B"
              milestoneBackgroundSelectedColor="#D97706"
              rtl={false}
              TaskListHeader={({ headerHeight, fontFamily, fontSize }) => (
                <div
                  className="flex border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  style={{ height: headerHeight, fontFamily, fontSize }}
                >
                  <div className="w-48 px-3 flex items-center border-r border-gray-200">Name</div>
                  <div className="w-32 px-3 flex items-center border-r border-gray-200">From</div>
                  <div className="w-32 px-3 flex items-center">To</div>
                </div>
              )}
              TaskListTable={({ rowHeight, tasks, fontFamily, fontSize, selectedTaskId, onExpanderClick }) => (
                <div style={{ fontFamily, fontSize }}>
                  {tasks.map((t) => {
                    const isSelected = t.id === selectedTaskId;
                    const isGroup = t.type === 'project';
                    return (
                      <div
                        key={t.id}
                        className={`flex border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                        style={{ height: rowHeight }}
                      >
                        <div
                          className={`w-48 px-3 flex items-center border-r border-gray-100 truncate ${isGroup ? 'font-bold bg-gray-50' : 'pl-6'}`}
                          title={t.name}
                        >
                          {t.name}
                        </div>
                        <div className={`w-32 px-3 flex items-center border-r border-gray-100 text-slate-500 ${isGroup ? 'bg-gray-50' : ''}`}>
                          {formatDateToCustom(t.start)}
                        </div>
                        <div className={`w-32 px-3 flex items-center text-slate-500 ${isGroup ? 'bg-gray-50' : ''}`}>
                          {formatDateToCustom(t.end)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-500">No tasks found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {statusFilter !== 'all' || assigneeFilter !== 'all' || priorityFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Add tasks to see them in the Gantt chart'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getTaskColor('not_started', 'Medium') }}></div>
            <span className="text-sm">Not Started</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getTaskColor('in_progress') }}></div>
            <span className="text-sm">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getTaskColor('completed') }}></div>
            <span className="text-sm">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getTaskColor('overdue') }}></div>
            <span className="text-sm">Overdue</span>
          </div>
        </div>
      </div>
    </div>
  );
};
