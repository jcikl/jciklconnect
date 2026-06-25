// Behavioral Nudging Configuration Component
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Power, PowerOff, AlertCircle, CheckCircle, Lightbulb, Target, TrendingUp, Settings } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { BehavioralNudgingService, NudgeRule } from '../../services/behavioralNudgingService';
import { formatDate } from '../../utils/dateUtils';

export const BehavioralNudgingConfig: React.FC = () => {
  const [rules, setRules] = useState<NudgeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NudgeRule | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      setError(null);
      const allRules = await BehavioralNudgingService.getAllNudgeRules();
      setRules(allRules);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load nudge rules';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const ruleData: Omit<NudgeRule, 'id'> = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      condition: {
        type: formData.get('conditionType') as NudgeRule['condition']['type'],
        value: parseFloat(formData.get('conditionValue') as string),
        operator: formData.get('conditionOperator') as NudgeRule['condition']['operator'],
      },
      nudgeType: formData.get('nudgeType') as NudgeRule['nudgeType'],
      title: formData.get('title') as string,
      message: formData.get('message') as string,
      priority: formData.get('priority') as NudgeRule['priority'],
      isActive: formData.get('isActive') === 'true',
    };

    try {
      if (editingRule) {
        await BehavioralNudgingService.updateNudgeRule(editingRule.id, ruleData);
        showToast('Nudge rule updated successfully', 'success');
      } else {
        await BehavioralNudgingService.createNudgeRule(ruleData);
        showToast('Nudge rule created successfully', 'success');
      }
      setIsModalOpen(false);
      setEditingRule(null);
      await loadRules();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save nudge rule';
      showToast(errorMessage, 'error');
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this nudge rule?')) {
      return;
    }

    try {
      await BehavioralNudgingService.deleteNudgeRule(ruleId);
      showToast('Nudge rule deleted successfully', 'success');
      await loadRules();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete nudge rule';
      showToast(errorMessage, 'error');
    }
  };

  const handleToggle = async (rule: NudgeRule) => {
    try {
      await BehavioralNudgingService.updateNudgeRule(rule.id, { isActive: !rule.isActive });
      showToast(`Nudge rule ${!rule.isActive ? 'activated' : 'deactivated'}`, 'success');
      await loadRules();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle nudge rule';
      showToast(errorMessage, 'error');
    }
  };

  const getNudgeTypeIcon = (type: NudgeRule['nudgeType']) => {
    switch (type) {
      case 'positive_reinforcement': return <CheckCircle className="text-green-600" size={20} />;
      case 'inactivity_warning': return <AlertCircle className="text-yellow-600" size={20} />;
      case 'opportunity_suggestion': return <Lightbulb className="text-blue-600" size={20} />;
      case 'goal_reminder': return <Target className="text-purple-600" size={20} />;
      default: return <TrendingUp className="text-slate-600" size={20} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Behavioral Nudging Rules</h2>
          <p className="text-slate-500">Configure automated behavioral nudges to encourage member engagement.</p>
        </div>
        <Button onClick={() => {
          setEditingRule(null);
          setIsModalOpen(true);
        }}>
          <Plus size={16} className="mr-2"/> Create Rule
        </Button>
      </div>

      <LoadingState loading={loading} error={error} empty={rules.length === 0} emptyMessage="No nudge rules configured">
        <div className="space-y-4">
          {rules.map(rule => (
            <Card key={rule.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-3 rounded-full ${
                    rule.isActive 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    {getNudgeTypeIcon(rule.nudgeType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-900">{rule.name}</h4>
                      <Badge variant={rule.isActive ? 'success' : 'neutral'}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant={rule.priority === 'high' ? 'error' : rule.priority === 'medium' ? 'warning' : 'neutral'} className="text-xs">
                        {rule.priority} Priority
                      </Badge>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-slate-600 mb-2">{rule.description}</p>
                    )}
                    <div className="space-y-1 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Condition:</span>
                        <span className="capitalize">{rule.condition.type.replace('_', ' ')}</span>
                        <span className="capitalize">{rule.condition.operator.replace('_', ' ')}</span>
                        <span className="font-semibold">{rule.condition.value}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Nudge Type:</span>
                        <span className="capitalize">{rule.nudgeType.replace('_', ' ')}</span>
                      </div>
                      <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-200">
                        <div className="font-medium text-slate-700 mb-1">{rule.title}</div>
                        <div className="text-slate-600">{rule.message}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(rule)}
                    title={rule.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {rule.isActive ? (
                      <PowerOff size={16} className="text-red-500" />
                    ) : (
                      <Power size={16} className="text-green-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingRule(rule);
                      setIsModalOpen(true);
                    }}
                  >
                    <Edit2 size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(rule.id)}
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </LoadingState>

      {/* Create/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingRule(null);
        }} 
        title={editingRule ? 'Edit Nudge Rule' : 'Create Nudge Rule'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input 
            name="name" 
            label="Rule Name" 
            placeholder="e.g., Low Attendance Warning"
            defaultValue={editingRule?.name}
            required 
          />
          <Textarea 
            name="description" 
            label="Description" 
            placeholder="Describe what this rule does..."
            defaultValue={editingRule?.description}
            rows={3}
          />
          
          <div className="grid grid-cols-3 gap-4">
            <Select
              name="conditionType"
              label="Condition Type"
              defaultValue={editingRule?.condition.type}
              options={[
                { label: 'Points Threshold', value: 'points_threshold' },
                { label: 'Attendance Rate', value: 'attendance_rate' },
                { label: 'Days Inactive', value: 'days_inactive' },
                { label: 'Goal Progress', value: 'goal_progress' },
                { label: 'Tier Upgrade', value: 'tier_upgrade' },
              ]}
              required
            />
            <Select
              name="conditionOperator"
              label="Operator"
              defaultValue={editingRule?.condition.operator}
              options={[
                { label: 'Greater Than', value: 'greater_than' },
                { label: 'Less Than', value: 'less_than' },
                { label: 'Equals', value: 'equals' },
              ]}
              required
            />
            <Input
              name="conditionValue"
              label="Value"
              type="number"
              defaultValue={editingRule?.condition.value?.toString()}
              placeholder="0"
              required
            />
          </div>

          <Select
            name="nudgeType"
            label="Nudge Type"
            defaultValue={editingRule?.nudgeType}
            options={[
              { label: 'Positive Reinforcement', value: 'positive_reinforcement' },
              { label: 'Inactivity Warning', value: 'inactivity_warning' },
              { label: 'Opportunity Suggestion', value: 'opportunity_suggestion' },
              { label: 'Goal Reminder', value: 'goal_reminder' },
            ]}
            required
          />

          <Input 
            name="title" 
            label="Nudge Title" 
            placeholder="e.g., 🎉 Great job this week!"
            defaultValue={editingRule?.title}
            required 
          />
          <Textarea 
            name="message" 
            label="Nudge Message" 
            placeholder="Message to display to members..."
            defaultValue={editingRule?.message}
            rows={3}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              name="priority"
              label="Priority"
              defaultValue={editingRule?.priority}
              options={[
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
              ]}
              required
            />
            <Select
              name="isActive"
              label="Status"
              defaultValue={editingRule?.isActive ? 'true' : 'false'}
              options={[
                { label: 'Active', value: 'true' },
                { label: 'Inactive', value: 'false' },
              ]}
              required
            />
          </div>

          <div className="pt-4 flex gap-3">
            <Button type="submit" className="flex-1">
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => {
                setIsModalOpen(false);
                setEditingRule(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

