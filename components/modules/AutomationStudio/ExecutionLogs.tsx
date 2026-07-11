import React, { useState, useEffect } from 'react';
import {
  Play, Clock, RefreshCw, FileText, Eye,
  Calendar, Filter, Webhook as WebhookIcon,
} from 'lucide-react';
import { Card, Button, Badge, Modal } from '../../ui/Common';
import { Select } from '../../ui/Form';
import { Workflow, AutomationService } from '../../../services/automationService';
import { WorkflowExecution } from '../../../types';
import { formatDate } from '../../../utils/dateUtils';

// ── ExecutionDetailModal ────────────────────────────────────────────────────

interface ExecutionDetailModalProps {
  execution: WorkflowExecution;
  onClose: () => void;
}

const ExecutionDetailModal: React.FC<ExecutionDetailModalProps> = ({ execution, onClose }) => {
  return (
    <Modal isOpen={true} onClose={onClose} title={`Execution Details: ${execution.workflowName}`} size="lg" drawerOnMobile>
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">Status</label>
            <div className="mt-1">
              <Badge variant={execution.status === 'success' ? 'success' : execution.status === 'failed' ? 'error' : 'neutral'}>
                {execution.status}
              </Badge>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">Triggered By</label>
            <div className="mt-1 text-sm text-slate-900 capitalize">{execution.triggeredBy}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">Started At</label>
            <div className="mt-1 text-sm text-slate-900">{formatDate(new Date(execution.startedAt))}</div>
          </div>
          {execution.completedAt && (
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Completed At</label>
              <div className="mt-1 text-sm text-slate-900">{formatDate(new Date(execution.completedAt))}</div>
            </div>
          )}
          {execution.duration && (
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Duration</label>
              <div className="mt-1 text-sm text-slate-900">
                {execution.duration < 1000 ? `${execution.duration}ms` : `${(execution.duration / 1000).toFixed(2)}s`}
              </div>
            </div>
          )}
        </div>

        {/* Error Details */}
        {execution.error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-semibold text-red-900 mb-2">Execution Error</h4>
            <p className="text-sm text-red-700 mb-2">{execution.error.message}</p>
            {execution.error.stepId && (
              <p className="text-xs text-red-600">
                Failed at: {execution.error.stepType} (Step ID: {execution.error.stepId})
              </p>
            )}
          </div>
        )}

        {/* Executed Steps */}
        <div>
          <h4 className="font-semibold text-slate-900 mb-3">Executed Steps</h4>
          <div className="space-y-2">
            {execution.executedSteps.map((step) => (
              <div key={step.stepId} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">#{step.stepOrder}</span>
                    <span className="font-medium text-slate-900">{step.stepType}</span>
                    <Badge variant={step.status === 'success' ? 'success' : step.status === 'failed' ? 'error' : 'neutral'} className="text-xs">
                      {step.status}
                    </Badge>
                  </div>
                  {step.duration && (
                    <span className="text-xs text-slate-500">
                      {step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(2)}s`}
                    </span>
                  )}
                </div>
                {step.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {step.error}
                  </div>
                )}
                {step.output && Object.keys(step.output).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-500 cursor-pointer">View Output</summary>
                    <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto">
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Context */}
        {execution.context && Object.keys(execution.context).length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-900 mb-3">Execution Context</h4>
            <details>
              <summary className="text-sm text-slate-500 cursor-pointer">View Context</summary>
              <pre className="mt-2 p-3 bg-slate-50 rounded text-xs overflow-auto">
                {JSON.stringify(execution.context, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ── ExecutionLogs ───────────────────────────────────────────────────────────

export interface ExecutionLogsProps {
  workflows: Workflow[];
}

export const ExecutionLogs: React.FC<ExecutionLogsProps> = ({ workflows }) => {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);

  useEffect(() => {
    loadExecutions();
  }, [selectedWorkflowId]);

  const loadExecutions = async () => {
    setLoading(true);
    try {
      const logs = await AutomationService.getExecutionLogs(selectedWorkflowId || undefined, 100);
      setExecutions(logs);
    } catch (err) {
      console.error('Failed to load executions:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTriggerIcon = (triggeredBy: WorkflowExecution['triggeredBy']) => {
    switch (triggeredBy) {
      case 'manual': return <Play size={14} />;
      case 'event': return <Calendar size={14} />;
      case 'schedule': return <Clock size={14} />;
      case 'webhook': return <WebhookIcon size={14} />;
      case 'condition': return <Filter size={14} />;
      default: return <Play size={14} />;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <RefreshCw className="mx-auto text-slate-400 mb-4 animate-spin" size={48} />
        <p className="text-slate-500">Loading execution logs...</p>
      </div>
    );
  }

  const workflowOptions = [
    { label: 'All Workflows', value: 'all' },
    ...workflows.map(w => ({ label: w.name, value: w.id! })),
  ];

  if (executions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Select
            value={selectedWorkflowId || 'all'}
            onChange={(e) => setSelectedWorkflowId(e.target.value === 'all' ? null : e.target.value)}
            options={workflowOptions}
          />
          <Button variant="outline" onClick={loadExecutions}>
            <RefreshCw size={16} className="mr-2" /> Refresh
          </Button>
        </div>
        <div className="text-center py-20">
          <FileText className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-500">No execution logs yet</p>
          <p className="text-sm text-slate-400 mt-2">
            Workflow execution logs will appear here after workflows are executed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select
          value={selectedWorkflowId || 'all'}
          onChange={(e) => setSelectedWorkflowId(e.target.value === 'all' ? null : e.target.value)}
          options={workflowOptions}
        />
        <Button variant="outline" onClick={loadExecutions}>
          <RefreshCw size={16} className="mr-2" /> Refresh
        </Button>
      </div>

      {/* Execution List */}
      <div className="space-y-3">
        {executions.map(exec => (
          <Card
            key={exec.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedExecution(exec)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-slate-900">{exec.workflowName}</h4>
                  <Badge variant={exec.status === 'success' ? 'success' : exec.status === 'failed' ? 'error' : 'neutral'} className="text-xs">
                    {exec.status}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    {getTriggerIcon(exec.triggeredBy)}
                    <span className="capitalize">{exec.triggeredBy}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatDate(new Date(exec.startedAt))}
                  </span>
                  {exec.completedAt && exec.duration && (
                    <span>
                      Duration: {exec.duration < 1000 ? `${exec.duration}ms` : `${(exec.duration / 1000).toFixed(2)}s`}
                    </span>
                  )}
                  <span>
                    {exec.executedSteps.length} step{exec.executedSteps.length !== 1 ? 's' : ''}
                  </span>
                  {exec.executedSteps.filter(s => s.status === 'failed').length > 0 && (
                    <span className="text-red-600">
                      {exec.executedSteps.filter(s => s.status === 'failed').length} failed
                    </span>
                  )}
                </div>
                {exec.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    <strong>Error:</strong> {exec.error.message}
                    {exec.error.stepId && (
                      <span className="block mt-1">Failed at step: {exec.error.stepType} ({exec.error.stepId})</span>
                    )}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm">
                <Eye size={16} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Execution Detail Modal */}
      {selectedExecution && (
        <ExecutionDetailModal
          execution={selectedExecution}
          onClose={() => setSelectedExecution(null)}
        />
      )}
    </div>
  );
};
