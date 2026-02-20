import React, { useState, useCallback } from 'react';
import { 
  Play, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Eye,
  EyeOff,
  Download,
  Trash2,
  BarChart3
} from 'lucide-react';
import { Rule, RuleExecution } from '../../../types';
import { ruleExecutionService, RuleTestData } from '../../../services/ruleExecutionService';
import * as Forms from '../../ui/Form';

interface RuleTestPanelProps {
  rule: Rule;
  onClose: () => void;
}

const SAMPLE_TEST_DATA: Record<string, RuleTestData> = {
  member_scenario: {
    member: {
      id: 'member_123',
      name: 'John Doe',
      email: 'john.doe@example.com',
      points: 150,
      membershipType: 'Full',
      joinDate: '2023-01-15',
      lastLogin: '2024-12-19',
    },
  },
  event_scenario: {
    event: {
      id: 'event_456',
      title: 'Monthly Meeting',
      type: 'Meeting',
      attendees: 25,
      date: '2024-12-20',
      status: 'Upcoming',
    },
  },
  project_scenario: {
    project: {
      id: 'project_789',
      name: 'Community Outreach',
      status: 'Active',
      budget: 5000,
      spent: 3200,
      completion: 65,
    },
  },
  transaction_scenario: {
    transaction: {
      id: 'trans_101',
      amount: 250,
      type: 'Income',
      date: '2024-12-19',
      description: 'Annual membership dues',
    },
  },
};

export const RuleTestPanel: React.FC<RuleTestPanelProps> = ({ rule, onClose }) => {
  const [testData, setTestData] = useState<RuleTestData>(SAMPLE_TEST_DATA.member_scenario);
  const [customTestData, setCustomTestData] = useState<string>('');
  const [useCustomData, setUseCustomData] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<RuleExecution | null>(null);
  const [executionHistory, setExecutionHistory] = useState<RuleExecution[]>([]);
  const [showExecutionDetails, setShowExecutionDetails] = useState(false);

  const loadExecutionHistory = useCallback(() => {
    const history = ruleExecutionService.getExecutionHistory(rule.id, 20);
    setExecutionHistory(history);
  }, [rule.id]);

  React.useEffect(() => {
    loadExecutionHistory();
  }, [loadExecutionHistory]);

  const handleTestDataChange = (scenario: string) => {
    setTestData(SAMPLE_TEST_DATA[scenario] || {});
  };

  const parseCustomTestData = (): RuleTestData => {
    try {
      return JSON.parse(customTestData);
    } catch (error) {
      throw new Error('Invalid JSON format in custom test data');
    }
  };

  const executeRule = async () => {
    setIsExecuting(true);
    try {
      const dataToUse = useCustomData ? parseCustomTestData() : testData;
      
      const context = {
        userId: 'test-user',
        timestamp: new Date().toISOString(),
        testMode: true,
        testData: dataToUse,
      };

      const result = await ruleExecutionService.executeRule(rule, context);
      setExecutionResult(result);
      loadExecutionHistory();
    } catch (error) {
      console.error('Rule execution failed:', error);
      // Create a failed execution result for display
      setExecutionResult({
        id: `test_${Date.now()}`,
        ruleId: rule.id,
        status: 'failed',
        executedAt: new Date().toISOString(),
        triggeredBy: 'test-user',
        triggerData: {},
        conditionsEvaluated: [],
        actionsExecuted: [],
        duration: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const clearResults = () => {
    setExecutionResult(null);
  };

  const exportResults = () => {
    if (!executionResult) return;
    
    const dataStr = JSON.stringify(executionResult, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rule-test-${rule.id}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'partial':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'partial':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const stats = ruleExecutionService.getExecutionStats(rule.id);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rule Testing</h1>
          <p className="text-gray-600 mt-1">Test rule: {rule.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={clearResults}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            disabled={!executionResult}
          >
            <RotateCcw size={16} />
            Clear
          </button>
          <button
            onClick={executeRule}
            disabled={isExecuting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Play size={16} />
            {isExecuting ? 'Testing...' : 'Test Rule'}
          </button>
        </div>
      </div>

      {/* Execution Statistics */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Execution Statistics</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.totalExecutions}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.successfulExecutions}</div>
            <div className="text-sm text-gray-600">Success</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.failedExecutions}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.partialExecutions}</div>
            <div className="text-sm text-gray-600">Partial</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{Math.round(stats.averageDuration)}ms</div>
            <div className="text-sm text-gray-600">Avg Duration</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Data Configuration */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Data</h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Forms.Checkbox
                label="Use Custom JSON Data"
                checked={useCustomData}
                onChange={(e) => setUseCustomData(e.target.checked)}
              />
            </div>

            {!useCustomData ? (
              <div>
                <Forms.Select
                  label="Sample Scenario"
                  value={Object.keys(SAMPLE_TEST_DATA).find(key => 
                    JSON.stringify(SAMPLE_TEST_DATA[key]) === JSON.stringify(testData)
                  ) || ''}
                  onChange={(e) => handleTestDataChange(e.target.value)}
                  options={[
                    { value: '', label: 'Select Scenario' },
                    { value: 'member_scenario', label: 'Member Scenario' },
                    { value: 'event_scenario', label: 'Event Scenario' },
                    { value: 'project_scenario', label: 'Project Scenario' },
                    { value: 'transaction_scenario', label: 'Transaction Scenario' }
                  ]}
                >
                  <option value="">Select Scenario</option>
                  <option value="member_scenario">Member Scenario</option>
                  <option value="event_scenario">Event Scenario</option>
                  <option value="project_scenario">Project Scenario</option>
                  <option value="transaction_scenario">Transaction Scenario</option>
                </Forms.Select>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Test Data
                  </label>
                  <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-40">
                    {JSON.stringify(testData, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div>
                <Forms.Textarea
                  label="Custom Test Data (JSON)"
                  value={customTestData}
                  onChange={(e) => setCustomTestData(e.target.value)}
                  placeholder={JSON.stringify(SAMPLE_TEST_DATA.member_scenario, null, 2)}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Execution Result */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Test Result</h2>
            {executionResult && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExecutionDetails(!showExecutionDetails)}
                  className="p-1 text-gray-600 hover:text-gray-800"
                >
                  {showExecutionDetails ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={exportResults}
                  className="p-1 text-blue-600 hover:text-blue-800"
                >
                  <Download size={16} />
                </button>
              </div>
            )}
          </div>

          {!executionResult ? (
            <div className="text-center py-8 text-gray-500">
              <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Click "Test Rule" to execute the rule with test data</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status Summary */}
              <div className={`p-4 rounded-lg border ${getStatusColor(executionResult.status)}`}>
                <div className="flex items-center gap-3">
                  {getStatusIcon(executionResult.status)}
                  <div>
                    <div className="font-medium">
                      {executionResult.status.charAt(0).toUpperCase() + executionResult.status.slice(1)}
                    </div>
                    <div className="text-sm opacity-75">
                      Executed in {executionResult.duration}ms
                    </div>
                  </div>
                </div>
                {executionResult.error && (
                  <div className="mt-2 text-sm">
                    <strong>Error:</strong> {executionResult.error}
                  </div>
                )}
              </div>

              {/* Conditions Results */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">
                  Conditions ({executionResult.conditionsEvaluated.length})
                </h3>
                <div className="space-y-2">
                  {executionResult.conditionsEvaluated.map((condition, index) => (
                    <div
                      key={condition.conditionId}
                      className={`p-3 rounded border ${
                        condition.result 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {condition.result ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className="text-sm font-medium">
                          Condition {index + 1}
                        </span>
                      </div>
                      {showExecutionDetails && (
                        <div className="mt-2 text-xs text-gray-600">
                          <div>Operator: {condition.operator}</div>
                          <div>Expected: {JSON.stringify(condition.expectedValue)}</div>
                          <div>Actual: {JSON.stringify(condition.actualValue)}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Results */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">
                  Actions ({executionResult.actionsExecuted.length})
                </h3>
                <div className="space-y-2">
                  {executionResult.actionsExecuted.map((action, index) => (
                    <div
                      key={action.actionId}
                      className={`p-3 rounded border ${
                        action.status === 'success' 
                          ? 'bg-green-50 border-green-200'
                          : action.status === 'failed'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(action.status)}
                        <span className="text-sm font-medium">
                          Action {index + 1} ({action.status})
                        </span>
                        <span className="text-xs text-gray-500">
                          {action.duration}ms
                        </span>
                      </div>
                      {action.error && (
                        <div className="mt-1 text-xs text-red-600">
                          {action.error}
                        </div>
                      )}
                      {showExecutionDetails && action.result && (
                        <div className="mt-2 text-xs text-gray-600">
                          <pre>{JSON.stringify(action.result, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Execution History */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Executions</h2>
          <button
            onClick={loadExecutionHistory}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {executionHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No execution history available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Executed At</th>
                  <th className="text-left py-2">Duration</th>
                  <th className="text-left py-2">Conditions</th>
                  <th className="text-left py-2">Actions</th>
                  <th className="text-left py-2">Triggered By</th>
                </tr>
              </thead>
              <tbody>
                {executionHistory.map((execution) => (
                  <tr key={execution.id} className="border-b border-gray-100">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(execution.status)}
                        <span className="capitalize">{execution.status}</span>
                      </div>
                    </td>
                    <td className="py-2">
                      {new Date(execution.executedAt).toLocaleString()}
                    </td>
                    <td className="py-2">{execution.duration}ms</td>
                    <td className="py-2">
                      {execution.conditionsEvaluated.filter(c => c.result).length}/
                      {execution.conditionsEvaluated.length}
                    </td>
                    <td className="py-2">
                      {execution.actionsExecuted.filter(a => a.status === 'success').length}/
                      {execution.actionsExecuted.length}
                    </td>
                    <td className="py-2">{execution.triggeredBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};