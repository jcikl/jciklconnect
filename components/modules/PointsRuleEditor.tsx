// Points Rule Editor - Visual rule configuration interface
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Play, Save, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { Card, Button, Badge, Modal } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { PointsRule, PointsRuleCondition, PointsRuleTestResult } from '../../types';
import { PointsRuleService } from '../../services/pointsRuleService';

interface PointsRuleEditorProps {
  rule?: PointsRule;
  onSave: (rule: PointsRule) => void;
  onCancel: () => void;
}

export const PointsRuleEditor: React.FC<PointsRuleEditorProps> = ({
  rule,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Partial<PointsRule>>({
    name: '',
    description: '',
    trigger: 'event_attendance',
    conditions: [],
    pointValue: 10,
    multiplier: 1,
    weight: 1,
    enabled: true,
    ...rule,
  });

  const [testResult, setTestResult] = useState<PointsRuleTestResult | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testData, setTestData] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const triggerOptions = [
    { value: 'event_attendance', label: 'Event Attendance' },
    { value: 'task_completion', label: 'Task Completion' },
    { value: 'project_completion', label: 'Project Completion' },
    { value: 'training_completion', label: 'Training Completion' },
    { value: 'recruitment', label: 'Recruitment' },
    { value: 'custom', label: 'Custom' },
  ];

  const operatorOptions = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Not Contains' },
    { value: 'in', label: 'In List' },
    { value: 'not_in', label: 'Not In List' },
  ];

  const fieldOptions = [
    { value: 'member.role', label: 'Member Role' },
    { value: 'member.tier', label: 'Member Tier' },
    { value: 'event.type', label: 'Event Type' },
    { value: 'project.status', label: 'Project Status' },
    { value: 'training.type', label: 'Training Type' },
    { value: 'recruitment.status', label: 'Recruitment Status' },
  ];

  useEffect(() => {
    validateRule();
  }, [formData]);

  const validateRule = () => {
    const errors: string[] = [];

    if (!formData.name?.trim()) {
      errors.push('Rule name is required');
    }

    if (!formData.trigger) {
      errors.push('Trigger is required');
    }

    if (!formData.conditions || formData.conditions.length === 0) {
      errors.push('At least one condition is required');
    }

    if (formData.pointValue === undefined || formData.pointValue < 0) {
      errors.push('Point value must be a positive number');
    }

    if (formData.multiplier === undefined || formData.multiplier <= 0) {
      errors.push('Multiplier must be greater than 0');
    }

    if (formData.weight === undefined || formData.weight <= 0) {
      errors.push('Weight must be greater than 0');
    }

    // Validate conditions
    formData.conditions?.forEach((condition, index) => {
      if (!condition.field) {
        errors.push(`Condition ${index + 1}: Field is required`);
      }
      if (!condition.operator) {
        errors.push(`Condition ${index + 1}: Operator is required`);
      }
      if (condition.value === undefined || condition.value === null || condition.value === '') {
        errors.push(`Condition ${index + 1}: Value is required`);
      }
    });

    setValidationErrors(errors);
  };

  const addCondition = () => {
    const newCondition: PointsRuleCondition = {
      id: `cond-${Date.now()}`,
      field: 'member.role',
      operator: 'equals',
      value: '',
    };

    setFormData(prev => ({
      ...prev,
      conditions: [...(prev.conditions || []), newCondition],
    }));
  };

  const updateCondition = (index: number, updates: Partial<PointsRuleCondition>) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions?.map((condition, i) =>
        i === index ? { ...condition, ...updates } : condition
      ) || [],
    }));
  };

  const removeCondition = (index: number) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleTestRule = async () => {
    if (!formData.name || !formData.trigger || !formData.conditions) return;

    try {
      const ruleToTest: PointsRule = {
        id: formData.id || 'test-rule',
        name: formData.name,
        description: formData.description || '',
        trigger: formData.trigger,
        conditions: formData.conditions,
        pointValue: formData.pointValue || 0,
        multiplier: formData.multiplier || 1,
        weight: formData.weight || 1,
        enabled: formData.enabled || true,
      };

      const result = await PointsRuleService.testRule(ruleToTest, testData);
      setTestResult(result);
    } catch (error) {
      console.error('Error testing rule:', error);
    }
  };

  const handleSave = () => {
    if (validationErrors.length > 0) return;

    const ruleToSave: PointsRule = {
      id: formData.id || '',
      name: formData.name!,
      description: formData.description || '',
      trigger: formData.trigger!,
      conditions: formData.conditions!,
      pointValue: formData.pointValue!,
      multiplier: formData.multiplier!,
      weight: formData.weight!,
      enabled: formData.enabled!,
    };

    onSave(ruleToSave);
  };

  const getTestDataForTrigger = (trigger: string) => {
    switch (trigger) {
      case 'event_attendance':
        return {
          member: { role: 'MEMBER', tier: 'Bronze' },
          event: { type: 'Meeting', name: 'Monthly Meeting' },
        };
      case 'project_completion':
        return {
          member: { role: 'MEMBER', tier: 'Silver' },
          project: { status: 'Completed', name: 'Community Service' },
        };
      case 'training_completion':
        return {
          member: { role: 'BOARD', tier: 'Gold' },
          training: { type: 'Leadership', name: 'Leadership Training' },
        };
      default:
        return {};
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">
            {rule ? 'Edit Points Rule' : 'Create Points Rule'}
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setTestData(getTestDataForTrigger(formData.trigger || 'event_attendance'));
                setShowTestModal(true);
              }}
              disabled={validationErrors.length > 0}
            >
              <Play size={16} />
              Test Rule
            </Button>
            <Button onClick={handleSave} disabled={validationErrors.length > 0}>
              <Save size={16} />
              Save Rule
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>

        {validationErrors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-red-600" />
              <span className="font-medium text-red-800">Validation Errors</span>
            </div>
            <ul className="list-disc list-inside text-sm text-red-700">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-slate-900">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Rule Name *
              </label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter rule name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <Input
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter rule description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Trigger *
              </label>
              <Select
                value={formData.trigger || ''}
                onChange={(value) => setFormData(prev => ({ ...prev, trigger: value as any }))}
                options={triggerOptions}
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.enabled || false}
                  onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-700">Enabled</span>
              </label>
            </div>
          </div>

          {/* Point Configuration */}
          <div className="space-y-4">
            <h3 className="font-medium text-slate-900">Point Configuration</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Point Value *
              </label>
              <Input
                type="number"
                value={formData.pointValue || 0}
                onChange={(e) => setFormData(prev => ({ ...prev, pointValue: Number(e.target.value) }))}
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Multiplier *
              </label>
              <Input
                type="number"
                step="0.1"
                value={formData.multiplier || 1}
                onChange={(e) => setFormData(prev => ({ ...prev, multiplier: Number(e.target.value) }))}
                min="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Weight *
              </label>
              <Input
                type="number"
                step="0.1"
                value={formData.weight || 1}
                onChange={(e) => setFormData(prev => ({ ...prev, weight: Number(e.target.value) }))}
                min="0.1"
              />
              <p className="text-xs text-slate-500 mt-1">
                Higher weight = more importance in calculations
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-1">Final Points Preview</p>
              <p className="text-lg font-bold text-slate-900">
                {Math.round((formData.pointValue || 0) * (formData.multiplier || 1) * (formData.weight || 1))} points
              </p>
              <p className="text-xs text-slate-500">
                {formData.pointValue} × {formData.multiplier} × {formData.weight}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Conditions */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-slate-900">Conditions</h3>
          <Button variant="outline" onClick={addCondition}>
            <Plus size={16} />
            Add Condition
          </Button>
        </div>

        {formData.conditions && formData.conditions.length > 0 ? (
          <div className="space-y-3">
            {formData.conditions.map((condition, index) => (
              <div key={condition.id} className="p-4 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">
                    Condition {index + 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeCondition(index)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Field
                    </label>
                    <Select
                      value={condition.field}
                      onChange={(e) => updateCondition(index, { field: e.target.value })}
                      options={fieldOptions}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Operator
                    </label>
                    <Select
                      value={condition.operator}
                      onChange={(value) => updateCondition(index, { operator: value as any })}
                      options={operatorOptions}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Value
                    </label>
                    <Input
                      value={condition.value || ''}
                      onChange={(e) => updateCondition(index, { value: e.target.value })}
                      placeholder="Enter value"
                    />
                  </div>
                </div>

                {index < formData.conditions.length - 1 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <Select
                      value={condition.logicalOperator || 'AND'}
                      onChange={(e) => updateCondition(index, { logicalOperator: e.target.value as 'AND' | 'OR' })}
                      options={[
                        { value: 'AND', label: 'AND' },
                        { value: 'OR', label: 'OR' },
                      ]}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Settings size={48} className="mx-auto mb-2 opacity-50" />
            <p>No conditions added yet</p>
            <p className="text-sm">Click "Add Condition" to start building your rule</p>
          </div>
        )}
      </Card>

      {/* Test Modal */}
      <Modal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        title="Test Points Rule"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Test Data (JSON)
            </label>
            <textarea
              className="w-full h-32 p-3 border border-slate-300 rounded-lg font-mono text-sm"
              value={JSON.stringify(testData, null, 2)}
              onChange={(e) => {
                try {
                  setTestData(JSON.parse(e.target.value));
                } catch {
                  // Invalid JSON, ignore
                }
              }}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleTestRule}>
              <Play size={16} />
              Run Test
            </Button>
            <Button
              variant="outline"
              onClick={() => setTestData(getTestDataForTrigger(formData.trigger || 'event_attendance'))}
            >
              Reset to Default
            </Button>
          </div>

          {testResult && (
            <div className="mt-4 p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                {testResult.passed ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <AlertCircle size={16} className="text-red-600" />
                )}
                <span className={`font-medium ${testResult.passed ? 'text-green-800' : 'text-red-800'}`}>
                  {testResult.passed ? 'Test Passed' : 'Test Failed'}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Points Awarded:</span> {testResult.pointsAwarded}
                </p>
                
                {testResult.conditionResults.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Condition Results:</p>
                    <div className="space-y-1">
                      {testResult.conditionResults.map((result, index) => (
                        <div key={index} className="text-xs flex items-center gap-2">
                          {result.passed ? (
                            <CheckCircle size={12} className="text-green-600" />
                          ) : (
                            <AlertCircle size={12} className="text-red-600" />
                          )}
                          <span>
                            {result.field} {result.operator} {JSON.stringify(result.expectedValue)} 
                            (actual: {JSON.stringify(result.actualValue)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {testResult.errors && testResult.errors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-red-800 mb-1">Errors:</p>
                    <ul className="list-disc list-inside text-xs text-red-700">
                      {testResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};