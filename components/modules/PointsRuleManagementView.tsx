// Points Rule Management View - Main interface for managing points rules
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, BarChart3, Power, PowerOff } from 'lucide-react';
import { Card, Button, Badge } from '../ui/Common';
import { LoadingSpinner } from '../ui/Loading';
import { PointsRule, PointsRuleAnalytics } from '../../types';
import { PointsRuleService } from '../../services/pointsRuleService';
import { PointsRuleEditor } from './PointsRuleEditor';

export const PointsRuleManagementView: React.FC = () => {
  const [rules, setRules] = useState<PointsRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<PointsRule | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [analytics, setAnalytics] = useState<Record<string, PointsRuleAnalytics>>({});

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const fetchedRules = await PointsRuleService.getAllPointsRules();
      setRules(fetchedRules);
      
      // Load analytics for each rule
      const analyticsData: Record<string, PointsRuleAnalytics> = {};
      for (const rule of fetchedRules) {
        const ruleAnalytics = await PointsRuleService.getRuleAnalytics(rule.id);
        if (ruleAnalytics) {
          analyticsData[rule.id] = ruleAnalytics;
        }
      }
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (rule: PointsRule) => {
    try {
      await PointsRuleService.savePointsRule(rule);
      await loadRules();
      setShowEditor(false);
      setEditingRule(null);
    } catch (error) {
      console.error('Error saving rule:', error);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      await PointsRuleService.deletePointsRule(ruleId);
      await loadRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const handleToggleEnabled = async (rule: PointsRule) => {
    try {
      await PointsRuleService.savePointsRule({
        ...rule,
        enabled: !rule.enabled,
      });
      await loadRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const getTriggerLabel = (trigger: string) => {
    const labels: Record<string, string> = {
      event_attendance: 'Event Attendance',
      task_completion: 'Task Completion',
      project_completion: 'Project Completion',
      training_completion: 'Training Completion',
      recruitment: 'Recruitment',
      custom: 'Custom',
    };
    return labels[trigger] || trigger;
  };

  if (showEditor) {
    return (
      <PointsRuleEditor
        rule={editingRule || undefined}
        onSave={handleSaveRule}
        onCancel={() => {
          setShowEditor(false);
          setEditingRule(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Points Rule Configuration</h1>
          <p className="text-slate-600 mt-1">
            Configure rules for automatic point awards
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingRule(null);
            setShowEditor(true);
          }}
        >
          <Plus size={16} />
          Create Rule
        </Button>
      </div>

      <div className="grid gap-4">
        {rules.map(rule => {
          const ruleAnalytics = analytics[rule.id];
          
          return (
            <Card key={rule.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">{rule.name}</h3>
                    <Badge variant={rule.enabled ? 'success' : 'neutral'}>
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Badge variant="info">{getTriggerLabel(rule.trigger)}</Badge>
                  </div>
                  
                  {rule.description && (
                    <p className="text-sm text-slate-600 mb-3">{rule.description}</p>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Points:</span>
                      <span className="ml-1 font-medium text-slate-900">{rule.pointValue}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Multiplier:</span>
                      <span className="ml-1 font-medium text-slate-900">{rule.multiplier}x</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Weight:</span>
                      <span className="ml-1 font-medium text-slate-900">{rule.weight}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Final:</span>
                      <span className="ml-1 font-bold text-blue-600">
                        {Math.round(rule.pointValue * rule.multiplier * rule.weight)} pts
                      </span>
                    </div>
                  </div>

                  {ruleAnalytics && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">Executions:</span>
                        <span className="ml-1 font-medium text-slate-900">
                          {ruleAnalytics.executionCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Total Points:</span>
                        <span className="ml-1 font-medium text-slate-900">
                          {ruleAnalytics.totalPointsAwarded}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Avg Points:</span>
                        <span className="ml-1 font-medium text-slate-900">
                          {ruleAnalytics.averagePointsPerExecution.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-3">
                    <p className="text-xs text-slate-500 mb-1">Conditions:</p>
                    <div className="flex flex-wrap gap-2">
                      {rule.conditions.map((condition, index) => (
                        <Badge key={condition.id} variant="neutral" className="text-xs">
                          {condition.field} {condition.operator} {JSON.stringify(condition.value)}
                          {index < rule.conditions.length - 1 && (
                            <span className="ml-1 font-bold">{condition.logicalOperator || 'AND'}</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleEnabled(rule)}
                    title={rule.enabled ? 'Disable' : 'Enable'}
                  >
                    {rule.enabled ? <PowerOff size={16} /> : <Power size={16} />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingRule(rule);
                      setShowEditor(true);
                    }}
                  >
                    <Edit size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}

        {rules.length === 0 && (
          <Card>
            <div className="text-center py-12">
              <BarChart3 size={48} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Rules Yet</h3>
              <p className="text-slate-600 mb-4">
                Create your first points rule to start automating point awards
              </p>
              <Button
                onClick={() => {
                  setEditingRule(null);
                  setShowEditor(true);
                }}
              >
                <Plus size={16} />
                Create First Rule
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};