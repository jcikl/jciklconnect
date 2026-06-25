import React, { useState, useCallback } from 'react';
import { 
  Play, 
  Square, 
  Zap, 
  XCircle, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Workflow, WorkflowExecution, WorkflowNodeExecution } from '../../../types';
import * as Forms from '../../ui/Form';

interface WorkflowTestPanelProps {
  workflow: Workflow;
  onClose: () => void;
}

// Mock test data for demonstration
const MOCK_TEST_DATA = {
  member: {
    id: 'member_123',
    name: 'John Doe',
    email: 'john@example.com',
    membershipType: 'Full Member',
    points: 150,
    joinDate: '2023-01-15'
  },
  event: {
    id: 'event_456',
    name: 'Monthly Meeting',
    type: 'Meeting',
    date: '2024-01-15',
    status: 'Upcoming',
    attendees: 25
  },
  project: {
    id: 'project_789',
    name: 'Website Redesign',
    status: 'Active',
    budget: 5000,
    progress: 65
  },
  transaction: {
    id: 'trans_101',
    amount: 50,
    type: 'Income',
    date: '2024-01-10',
    description: 'Membership dues'
  }
};

const WorkflowTestPanel: React.FC<WorkflowTestPanelProps> = ({ workflow, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [testDataJson, setTestDataJson] = useState(JSON.stringify(MOCK_TEST_DATA, null, 2));
  const [currentExecution, setCurrentExecution] = useState<WorkflowExecution | null>(null);
  const [executionHistory, setExecutionHistory] = useState<WorkflowExecution[]>([]);
  const [selectedHistoryExecution, setSelectedHistoryExecution] = useState<WorkflowExecution | null>(null);

  const handleRunTest = useCallback(async () => {
    setIsRunning(true);
    
    try {
      // Parse test data
      const testData = JSON.parse(testDataJson);
      
      // Create mock execution
      const execution: WorkflowExecution = {
        id: `exec_${Date.now()}`,
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: 'running',
        startedAt: new Date().toISOString(),
        triggeredBy: 'manual',
        triggerData: testData,
        executedSteps: [],
        nodeExecutions: []
      };
      
      setCurrentExecution(execution);
      
      // Simulate workflow execution
      const nodeExecutions: WorkflowNodeExecution[] = [];
      
      for (let i = 0; i < workflow.nodes.length; i++) {
        const node = workflow.nodes[i];
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        const nodeExecution: WorkflowNodeExecution = {
          id: `node_exec_${Date.now()}_${i}`,
          nodeId: node.id,
          nodeType: node.type,
          status: Math.random() > 0.1 ? 'success' : 'failed', // 90% success rate
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          input: testData,
          output: {
            processed: true,
            result: `Processed by ${node.type} node`,
            timestamp: new Date().toISOString()
          },
          duration: Math.floor(Math.random() * 3000) + 500,
          error: Math.random() > 0.9 ? 'Sample error message' : undefined
        };
        
        nodeExecutions.push(nodeExecution);
        
        // Update current execution
        setCurrentExecution(prev => prev ? {
          ...prev,
          nodeExecutions: [...prev.nodeExecutions, nodeExecution],
          executedSteps: [...prev.executedSteps, { 
            stepId: node.id, 
            stepType: node.type, 
            stepOrder: i,
            status: 'completed' 
          }]
        } : null);
        
        // Break if node failed
        if (nodeExecution.status === 'failed') {
          break;
        }
      }
      
      // Complete execution
      const finalExecution: WorkflowExecution = {
        ...execution,
        status: nodeExecutions.some(ne => ne.status === 'failed') ? 'failed' : 'success',
        completedAt: new Date().toISOString(),
        nodeExecutions,
        executedSteps: nodeExecutions.map((ne, idx) => ({ 
          stepId: ne.nodeId, 
          stepType: ne.nodeType, 
          stepOrder: idx,
          status: ne.status === 'success' ? 'completed' : ne.status,
          startedAt: ne.startedAt,
          completedAt: ne.completedAt,
          duration: ne.duration
        })),
        duration: nodeExecutions.reduce((sum, ne) => sum + (ne.duration || 0), 0)
      };
      
      setCurrentExecution(finalExecution);
      setExecutionHistory(prev => [finalExecution, ...prev]);
      
    } catch (error) {
      console.error('Test execution failed:', error);
      
      const failedExecution: WorkflowExecution = {
        id: `exec_${Date.now()}`,
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        triggeredBy: 'manual',
        triggerData: {},
        executedSteps: [],
        nodeExecutions: [],
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stepId: 'test_setup',
          stepType: 'validation'
        }
      };
      
      setCurrentExecution(failedExecution);
      setExecutionHistory(prev => [failedExecution, ...prev]);
    } finally {
      setIsRunning(false);
    }
  }, [workflow, testDataJson]);

  const handleStopTest = useCallback(() => {
    setIsRunning(false);
    if (currentExecution && currentExecution.status === 'running') {
      const stoppedExecution: WorkflowExecution = {
        ...currentExecution,
        status: 'cancelled',
        completedAt: new Date().toISOString()
      };
      setCurrentExecution(stoppedExecution);
      setExecutionHistory(prev => [stoppedExecution, ...prev.slice(1)]);
    }
  }, [currentExecution]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle size={16} />;
      case 'failed': return <AlertTriangle size={16} />;
      case 'running': return <RefreshCw size={16} className="animate-spin" />;
      case 'cancelled': return <XCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Test Workflow</h2>
              <p className="text-sm text-gray-500">{workflow.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Test Configuration */}
          <div className="w-1/2 border-r border-gray-200 flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Data</h3>
              <div className="space-y-4">
                <Forms.Textarea
                  label="Test Data (JSON)"
                  value={testDataJson}
                  onChange={(e) => setTestDataJson(e.target.value)}
                  placeholder="Enter test data in JSON format"
                  rows={10}
                />
                <p className="text-sm text-gray-500">
                  Provide test data that will be available to workflow nodes during execution.
                </p>
              </div>
            </div>

            <div className="p-6 flex-1">
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={handleRunTest}
                  disabled={isRunning}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                    isRunning 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Run Test
                    </>
                  )}
                </button>

                {isRunning && (
                  <button
                    onClick={handleStopTest}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200"
                  >
                    <Square size={16} />
                    Stop
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Execution Results */}
          <div className="w-1/2 flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution Results</h3>
              
              {executionHistory.length > 0 && (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  <p className="text-sm font-medium text-gray-700">Recent Executions:</p>
                  {executionHistory.map((execution) => (
                    <button
                      key={execution.id}
                      onClick={() => setSelectedHistoryExecution(execution)}
                      className={`w-full text-left p-3 rounded-lg border ${
                        selectedHistoryExecution?.id === execution.id 
                          ? 'border-blue-300 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                            {getStatusIcon(execution.status)}
                            {execution.status}
                          </span>
                          <span className="text-sm text-gray-600">
                            {new Date(execution.startedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {execution.duration ? `${execution.duration}ms` : '-'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {(currentExecution || selectedHistoryExecution) ? (
                <div className="space-y-4">
                  {(() => {
                    const execution = selectedHistoryExecution || currentExecution;
                    if (!execution) return null;

                    return (
                      <>
                        {/* Execution Summary */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-900">Execution Summary</h4>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                              {getStatusIcon(execution.status)}
                              {execution.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Started:</span>
                              <div className="font-medium">{new Date(execution.startedAt).toLocaleString()}</div>
                            </div>
                            {execution.completedAt && (
                              <div>
                                <span className="text-gray-500">Completed:</span>
                                <div className="font-medium">{new Date(execution.completedAt).toLocaleString()}</div>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Duration:</span>
                              <div className="font-medium">{execution.duration ? `${execution.duration}ms` : 'In progress...'}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">Steps:</span>
                              <div className="font-medium">{execution.executedSteps.length} / {workflow.nodes.length}</div>
                            </div>
                          </div>
                        </div>

                        {/* Node Executions */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-gray-900">Node Executions</h4>
                          {execution.nodeExecutions.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No node executions yet</p>
                          ) : (
                            <div className="space-y-2">
                              {execution.nodeExecutions.map((nodeExec) => (
                                <div key={nodeExec.id} className="border border-gray-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-900">
                                        {workflow.nodes.find(n => n.id === nodeExec.nodeId)?.data?.label || nodeExec.nodeType}
                                      </span>
                                      <ArrowRight size={14} className="text-gray-400" />
                                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(nodeExec.status)}`}>
                                        {getStatusIcon(nodeExec.status)}
                                        {nodeExec.status}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {nodeExec.duration}ms
                                    </span>
                                  </div>
                                  
                                  {nodeExec.error && (
                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                      <strong>Error:</strong> {nodeExec.error}
                                    </div>
                                  )}
                                  
                                  {nodeExec.output && (
                                    <div className="mt-2 text-xs text-gray-600">
                                      <strong>Output:</strong> {JSON.stringify(nodeExec.output, null, 2)}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Error Details */}
                        {execution.error && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <h4 className="font-medium text-red-900 mb-2">Execution Error</h4>
                            <p className="text-sm text-red-700">{execution.error.message}</p>
                            {execution.error.stepId && (
                              <p className="text-xs text-red-600 mt-1">
                                Step: {execution.error.stepId} ({execution.error.stepType})
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Zap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No test execution yet</p>
                  <p className="text-sm">Run a test to see execution results</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowTestPanel;