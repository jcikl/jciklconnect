import React, { useState, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Play, 
  Settings, 
  Filter,
  Zap,
  ChevronDown,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { Rule, RuleCondition, RuleAction } from '../../../types';
import * as Forms from '../../ui/Form';

interface RuleEngineConfigProps {
  rule: Rule | null;
  onSave: (rule: Rule) => void;
  onTest: (rule: Rule) => void;
  onClose: () => void;
}

const FIELD_OPTIONS = [
  { value: 'member.points', label: 'Member Points' },
  { value: 'member.membershipType', label: 'Membership Type' },
  { value: 'member.joinDate', label: 'Join Date' },
  { value: 'member.lastLogin', label: 'Last Login' },
  { value: 'event.attendees', label: 'Event Attendees' },
  { value: 'event.type', label: 'Event Type' },
  { value: 'project.status', label: 'Project Status' },
  { value: 'project.budget', label: 'Project Budget' },
  { value: 'transaction.amount', label: 'Transaction Amount' },
  { value: 'transaction.type', label: 'Transaction Type' },
];

const OPERATOR_OPTIONS = [
  { value: 'equals', label: 'Equals', types: ['string', 'number', 'boolean'] },
  { value: 'not_equals', label: 'Not Equals', types: ['string', 'number', 'boolean'] },
  { value: 'greater_than', label: 'Greater Than', types: ['number', 'date'] },
  { value: 'less_than', label: 'Less Than', types: ['number', 'date'] },
  { value: 'greater_equal', label: 'Greater Than or Equal', types: ['number', 'date'] },
  { value: 'less_equal', label: 'Less Than or Equal', types: ['number', 'date'] },
  { value: 'contains', label: 'Contains', types: ['string', 'array'] },
  { value: 'not_contains', label: 'Does Not Contain', types: ['string', 'array'] },
  { value: 'starts_with', label: 'Starts With', types: ['string'] },
  { value: 'ends_with', label: 'Ends With', types: ['string'] },
  { value: 'exists', label: 'Exists', types: ['any'] },
  { value: 'not_exists', label: 'Does Not Exist', types: ['any'] },
];

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'update_member', label: 'Update Member' },
  { value: 'create_task', label: 'Create Task' },
  { value: 'award_points', label: 'Award Points' },
  { value: 'send_webhook', label: 'Send Webhook' },
];

const RuleEngineConfig: React.FC<RuleEngineConfigProps> = ({ 
  rule: initialRule, 
  onSave, 
  onTest, 
  onClose 
}) => {
  const [rule, setRule] = useState<Rule>(initialRule || {
    id: '',
    name: '',
    description: '',
    priority: 1,
    enabled: true,
    logicalOperator: 'AND',
    conditions: [],
    actions: [],
    createdBy: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionCount: 0
  });

  const [expandedSections, setExpandedSections] = useState({
    conditions: true,
    actions: true
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Condition management
  const addCondition = useCallback(() => {
    const newCondition: RuleCondition = {
      id: `condition_${Date.now()}`,
      field: '',
      operator: 'equals',
      value: '',
      dataType: 'string',
      logicalOperator: rule.conditions.length > 0 ? 'AND' : undefined
    };
    
    setRule(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition]
    }));
  }, [rule.conditions.length]);

  const updateCondition = useCallback((conditionId: string, updates: Partial<RuleCondition>) => {
    setRule(prev => ({
      ...prev,
      conditions: prev.conditions.map(condition =>
        condition.id === conditionId ? { ...condition, ...updates } : condition
      )
    }));
  }, []);

  const removeCondition = useCallback((conditionId: string) => {
    setRule(prev => ({
      ...prev,
      conditions: prev.conditions.filter(condition => condition.id !== conditionId)
    }));
  }, []);

  // Action management
  const addAction = useCallback(() => {
    const newAction: RuleAction = {
      id: `action_${Date.now()}`,
      type: 'send_notification',
      config: {},
      enabled: true,
      order: rule.actions.length
    };
    
    setRule(prev => ({
      ...prev,
      actions: [...prev.actions, newAction]
    }));
  }, [rule.actions.length]);

  const updateAction = useCallback((actionId: string, updates: Partial<RuleAction>) => {
    setRule(prev => ({
      ...prev,
      actions: prev.actions.map(action =>
        action.id === actionId ? { ...action, ...updates } : action
      )
    }));
  }, []);

  const removeAction = useCallback((actionId: string) => {
    setRule(prev => ({
      ...prev,
      actions: prev.actions.filter(action => action.id !== actionId)
    }));
  }, []);

  // Validation
  const validateRule = useCallback(() => {
    const errors: string[] = [];
    
    if (!rule.name.trim()) {
      errors.push('Rule name is required');
    }
    
    if (rule.conditions.length === 0) {
      errors.push('At least one condition is required');
    }
    
    if (rule.actions.length === 0) {
      errors.push('At least one action is required');
    }
    
    rule.conditions.forEach((condition, index) => {
      if (!condition.field) {
        errors.push(`Condition ${index + 1}: Field is required`);
      }
      if (!condition.operator) {
        errors.push(`Condition ${index + 1}: Operator is required`);
      }
      if (!condition.value && condition.operator !== 'exists' && condition.operator !== 'not_exists') {
        errors.push(`Condition ${index + 1}: Value is required`);
      }
    });
    
    rule.actions.forEach((action, index) => {
      if (!action.type) {
        errors.push(`Action ${index + 1}: Type is required`);
      }
    });
    
    setValidationErrors(errors);
    return errors.length === 0;
  }, [rule]);

  const handleSave = useCallback(() => {
    if (validateRule()) {
      onSave({
        ...rule,
        updatedAt: new Date().toISOString()
      });
    }
  }, [rule, validateRule, onSave]);

  const handleTest = useCallback(() => {
    if (validateRule()) {
      onTest(rule);
    }
  }, [rule, validateRule, onTest]);

  const toggleSection = useCallback((section: 'conditions' | 'actions') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  const getAvailableOperators = (field: string) => {
    // Simple field type detection based on field name
    if (field.includes('date') || field.includes('Date')) {
      return OPERATOR_OPTIONS.filter(op => op.types.includes('date') || op.types.includes('any'));
    }
    if (field.includes('amount') || field.includes('budget') || field.includes('points')) {
      return OPERATOR_OPTIONS.filter(op => op.types.includes('number') || op.types.includes('any'));
    }
    return OPERATOR_OPTIONS.filter(op => op.types.includes('string') || op.types.includes('any'));
  };

  const renderConditionEditor = (condition: RuleCondition, index: number) => {
    const availableOperators = getAvailableOperators(condition.field);

    return (
      <div key={condition.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900">Condition {index + 1}</h4>
          <button
            onClick={() => removeCondition(condition.id)}
            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
          >
            <Trash2 size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Field */}
          <div>
            <Forms.Select
              label="Field"
              value={condition.field}
              onChange={(e) => updateCondition(condition.id, { field: e.target.value })}
              required
              options={FIELD_OPTIONS}
            >
              <option value="">Select Field</option>
              {FIELD_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Forms.Select>
          </div>

          {/* Operator */}
          <div>
            <Forms.Select
              label="Operator"
              value={condition.operator}
              onChange={(e) => updateCondition(condition.id, { 
                operator: e.target.value as RuleCondition['operator']
              })}
              required
              options={availableOperators}
            >
              <option value="">Select Operator</option>
              {availableOperators.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Forms.Select>
          </div>

          {/* Value */}
          {condition.operator !== 'exists' && condition.operator !== 'not_exists' && (
            <div>
              <Forms.Input
                label="Value"
                value={condition.value}
                onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                placeholder="Enter value"
                required
              />
            </div>
          )}
        </div>

        {/* Logical Operator */}
        {index > 0 && (
          <div className="mt-4">
            <Forms.Select
              label="Logical Operator"
              value={condition.logicalOperator || 'AND'}
              onChange={(e) => updateCondition(condition.id, { logicalOperator: e.target.value as 'AND' | 'OR' })}
              options={[
                { value: 'AND', label: 'AND' },
                { value: 'OR', label: 'OR' }
              ]}
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </Forms.Select>
          </div>
        )}
      </div>
    );
  };

  const renderActionEditor = (action: RuleAction, index: number) => {
    return (
      <div key={action.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              {index + 1}
            </span>
            <h4 className="font-medium text-gray-900">Action</h4>
          </div>
          <div className="flex items-center gap-2">
            <Forms.Checkbox
              label="Enabled"
              checked={action.enabled !== false}
              onChange={(e) => updateAction(action.id, { enabled: e.target.checked })}
            />
            <button
              onClick={() => removeAction(action.id)}
              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Forms.Select
              label="Action Type"
              value={action.type}
              onChange={(e) => updateAction(action.id, { 
                type: e.target.value as RuleAction['type']
              })}
              required
              options={ACTION_TYPES}
            >
              <option value="">Select Action Type</option>
              {ACTION_TYPES.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Forms.Select>
          </div>

          {/* Action-specific configuration */}
          {action.type === 'send_email' && (
            <div className="space-y-3">
              <Forms.Input
                label="To Email"
                value={action.config.to || ''}
                onChange={(e) => updateAction(action.id, { 
                  config: { ...action.config, to: e.target.value }
                })}
                placeholder="recipient@example.com"
              />
              <Forms.Input
                label="Subject"
                value={action.config.subject || ''}
                onChange={(e) => updateAction(action.id, { 
                  config: { ...action.config, subject: e.target.value }
                })}
                placeholder="Email subject"
              />
              <Forms.Textarea
                label="Message"
                value={action.config.message || ''}
                onChange={(e) => updateAction(action.id, { 
                  config: { ...action.config, message: e.target.value }
                })}
                placeholder="Email message"
                rows={3}
              />
            </div>
          )}

          {action.type === 'send_notification' && (
            <div className="space-y-3">
              <Forms.Input
                label="Title"
                value={action.config.title || ''}
                onChange={(e) => updateAction(action.id, { 
                  config: { ...action.config, title: e.target.value }
                })}
                placeholder="Notification title"
              />
              <Forms.Textarea
                label="Message"
                value={action.config.message || ''}
                onChange={(e) => updateAction(action.id, { 
                  config: { ...action.config, message: e.target.value }
                })}
                placeholder="Notification message"
                rows={2}
              />
            </div>
          )}

          {action.type === 'award_points' && (
            <div>
              <Forms.Input
                type="number"
                label="Points"
                value={action.config.points || ''}
                onChange={(e) => updateAction(action.id, { 
                  config: { ...action.config, points: parseInt(e.target.value) }
                })}
                placeholder="Number of points"
              />
            </div>
          )}

          {action.type === 'update_member' && (
            <div className="space-y-3">
              <Forms.Select
                label="Field to Update"
                value={action.config.field || ''}
                onChange={(e) => updateAction(action.id, { 
                  config: { ...action.config, field: e.target.value }
                })}
                options={[
                  { value: 'membershipType', label: 'Membership Type' },
                  { value: 'status', label: 'Status' }
                ]}
              >
                <option value="">Select Field</option>
                <option value="membershipType">Membership Type</option>
                <option value="status">Status</option>
              </Forms.Select>
              <Forms.Input
                label="New Value"
                value={action.config.value || ''}
                onChange={(e) => updateAction(action.id, { 
                  config: { ...action.config, value: e.target.value }
                })}
                placeholder="New value"
              />
            </div>
          )}

          {action.type === 'send_webhook' && (
            <div className="space-y-3">
              <Forms.Input
                label="Webhook URL"
                value={action.config.url || ''}
                onChange={(e) => updateAction(action.id, { 
                  config: { ...action.config, url: e.target.value }
                })}
                placeholder="https://example.com/webhook"
              />
              <Forms.Select
                label="HTTP Method"
                value={action.config.method || 'POST'}
                onChange={(e) => updateAction(action.id, { 
                  config: { ...action.config, method: e.target.value }
                })}
                options={[
                  { value: 'POST', label: 'POST' },
                  { value: 'PUT', label: 'PUT' }
                ]}
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
              </Forms.Select>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {initialRule ? 'Edit Rule' : 'Create Rule'}
              </h2>
              <p className="text-sm text-gray-500">Configure automation rule conditions and actions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Trash2 size={20} />
          </button>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900">Please fix the following errors:</h3>
                <div className="mt-2">
                  <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Forms.Input
                label="Rule Name"
                value={rule.name}
                onChange={(e) => setRule(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter rule name"
                required
              />
              <Forms.Input
                type="number"
                label="Priority"
                value={rule.priority}
                onChange={(e) => setRule(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                placeholder="Rule priority (1-100)"
                min={1}
              />
            </div>
            <div>
              <Forms.Textarea
                label="Description"
                value={rule.description}
                onChange={(e) => setRule(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this rule does"
                rows={3}
              />
            </div>
            <div>
              <Forms.Checkbox
                label="Enable this rule"
                checked={rule.enabled}
                onChange={(e) => setRule(prev => ({ ...prev, enabled: e.target.checked }))}
              />
            </div>
          </div>

          {/* Conditions Section */}
          <div className="space-y-4">
            <button
              onClick={() => toggleSection('conditions')}
              className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-gray-700"
            >
              {expandedSections.conditions ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
              <h2 className="text-lg font-semibold text-gray-900">
                Conditions ({rule.conditions.length})
              </h2>
            </button>

            {expandedSections.conditions && (
              <div className="space-y-4">
                {rule.conditions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Filter className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No conditions defined</p>
                    <p className="text-sm">Add conditions to specify when this rule should trigger</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rule.conditions.map((condition, index) => 
                      renderConditionEditor(condition, index)
                    )}
                  </div>
                )}
                
                <button
                  onClick={addCondition}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 hover:border-blue-300"
                >
                  <Plus size={16} />
                  Add Condition
                </button>
              </div>
            )}
          </div>

          {/* Actions Section */}
          <div className="space-y-4">
            <button
              onClick={() => toggleSection('actions')}
              className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-gray-700"
            >
              {expandedSections.actions ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
              <h2 className="text-lg font-semibold text-gray-900">
                Actions ({rule.actions.length})
              </h2>
            </button>

            {expandedSections.actions && (
              <div className="space-y-4">
                {rule.actions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Zap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No actions defined</p>
                    <p className="text-sm">Add actions to specify what should happen when conditions are met</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rule.actions.map((action, index) => 
                      renderActionEditor(action, index)
                    )}
                  </div>
                )}
                
                <button
                  onClick={addAction}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 hover:border-blue-300"
                >
                  <Plus size={16} />
                  Add Action
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              className="flex items-center gap-2 px-4 py-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg border border-green-200 hover:border-green-300"
            >
              <Play size={16} />
              Test Rule
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
            >
              <Save size={16} />
              Save Rule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RuleEngineConfig;