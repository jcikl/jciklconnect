import React from 'react';
import { GitBranch, Plus, Clock, Play, PowerOff, Power, Edit, Trash2 } from 'lucide-react';
import { Card, Button, Badge } from '../../ui/Common';
import { Workflow } from '../../../services/automationService';
import { formatDate } from '../../../utils/dateUtils';

export interface WorkflowsListProps {
  workflows: Workflow[];
  onSelect: (workflow: Workflow) => void;
  onToggle: (workflow: Workflow) => void;
  onDelete: (workflowId: string) => void;
  onExecute: (workflowId: string) => void;
  onCreate: () => void;
}

export const WorkflowsList: React.FC<WorkflowsListProps> = ({
  workflows,
  onSelect,
  onToggle,
  onDelete,
  onExecute,
  onCreate,
}) => {
  if (workflows.length === 0) {
    return (
      <div className="text-center py-20">
        <GitBranch className="mx-auto text-slate-400 mb-4" size={48} />
        <p className="text-slate-500 mb-4">No workflows created yet</p>
        <Button onClick={onCreate}>
          <Plus size={16} className="mr-2" /> Create First Workflow
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {workflows.map(workflow => (
        <Card key={workflow.id} className="hover:shadow-md transition-shadow">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className={`p-3 rounded-full ${workflow.active
                ? 'bg-green-100 text-green-600'
                : 'bg-slate-100 text-slate-400'
                }`}>
                <GitBranch size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-slate-900">{workflow.name}</h4>
                  <Badge variant={workflow.active ? 'success' : 'neutral'}>
                    {workflow.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {workflow.description && (
                  <p className="text-sm text-slate-600 mb-2">{workflow.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Play size={12} />
                    {workflow.executions} execution{workflow.executions !== 1 ? 's' : ''}
                  </span>
                  {workflow.lastExecuted && (
                    <span>
                      Last: {formatDate(workflow.lastExecuted as Date)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggle(workflow)}
                title={workflow.active ? 'Deactivate' : 'Activate'}
              >
                {workflow.active ? (
                  <PowerOff size={16} className="text-red-500" />
                ) : (
                  <Power size={16} className="text-green-500" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onExecute(workflow.id!)}
                title="Execute Now"
              >
                <Play size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelect(workflow)}
              >
                <Edit size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(workflow.id!)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
