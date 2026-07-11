import React from 'react';
import { PowerOff, Power, Play } from 'lucide-react';
import { Button, Badge, Modal } from '../../ui/Common';
import { Workflow } from '../../../services/automationService';

export interface WorkflowDetailModalProps {
  workflow: Workflow;
  onClose: () => void;
  onToggle: (workflow: Workflow) => void;
  onExecute: (workflowId: string) => void;
}

export const WorkflowDetailModal: React.FC<WorkflowDetailModalProps> = ({
  workflow,
  onClose,
  onToggle,
  onExecute,
}) => {
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={workflow.name}
      size="lg"
      drawerOnMobile
    >
      <div className="space-y-4">
        {workflow.description && (
          <p className="text-slate-600">{workflow.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Status</label>
            <Badge variant={workflow.active ? 'success' : 'neutral'} className="mt-1">
              {workflow.active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Executions</label>
            <p className="text-lg font-semibold mt-1">{workflow.executions}</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Trigger
          </label>
          <div className="bg-slate-50 p-3 rounded-lg">
            <p className="text-sm">
              <span className="font-semibold">Type:</span> {workflow.trigger.type}
            </p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Steps ({workflow.steps.length})
          </label>
          <div className="space-y-2">
            {workflow.steps.map((step, index) => (
              <div key={step.id} className="bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-white px-2 py-1 rounded">
                    {index + 1}
                  </span>
                  <span className="font-semibold text-sm">{step.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              onToggle(workflow);
              onClose();
            }}
          >
            {workflow.active ? (
              <>
                <PowerOff size={16} className="mr-2" />
                Deactivate
              </>
            ) : (
              <>
                <Power size={16} className="mr-2" />
                Activate
              </>
            )}
          </Button>
          <Button
            onClick={() => {
              onExecute(workflow.id!);
              onClose();
            }}
          >
            <Play size={16} className="mr-2" />
            Execute Now
          </Button>
        </div>
      </div>
    </Modal>
  );
};
