// Point Rules Configuration Component
import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, Save, X, Zap, Code, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs } from '../ui/Common';
import { Input, Select, Checkbox } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { PointsService, PointRule } from '../../services/pointsService';
import { POINT_CATEGORIES } from '../../config/constants';

export const PointRulesConfig: React.FC = () => {
  const [rules, setRules] = useState<PointRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PointRule | null>(null);
  const [conditionsMode, setConditionsMode] = useState<'visual' | 'json'>('visual');
  const [conditions, setConditions] = useState<Record<string, any>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const { showToast } = useToast();

  // Load all point rules from the service
  const loadRules = async () => {
    try {
      setLoading(true);
      setError(null);
      const allRules = await PointsService.getPointRules();
      setRules(allRules);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load point rules';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  // Save (create or update) a rule
  const handleSaveRule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const ruleData: Omit<PointRule, 'id'> = {
        category: formData.get('category') as string,
        name: formData.get('name') as string,
        basePoints: parseInt(formData.get('basePoints') as string),
        multiplier: formData.get('multiplier') ? parseFloat(formData.get('multiplier') as string) : undefined,
        active: formData.get('active') === 'on',
        conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
        priority: formData.get('priority') ? parseInt(formData.get('priority') as string) : 1,
      };

      if (editingRule?.id) {
        await PointsService.savePointRule({ ...ruleData, id: editingRule.id });
        showToast('Rule updated successfully', 'success');
      } else {
        await PointsService.savePointRule(ruleData);
        showToast('Rule created successfully', 'success');
      }

      setIsModalOpen(false);
      setEditingRule(null);
      setConditions({});
      await loadRules();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save rule';
      showToast(errorMessage, 'error');
    }
  };

  const handleEdit = (rule: PointRule) => {
    setEditingRule(rule);
    setConditions(rule.conditions || {});
    setSelectedCategory(rule.category);
    setIsModalOpen(true);
  };

  const handleDelete = async (rule: PointRule) => {
    if (!rule.id) return;

    if (!confirm(`Are you sure you want to delete the rule "${rule.name}"?`)) return;

    try {
      await PointsService.savePointRule({ ...rule, active: false });
      showToast('Rule deactivated successfully', 'success');
      await loadRules();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete rule';
      showToast(errorMessage, 'error');
    }
  };

  const categoryLabels: Record<string, string> = {
    [POINT_CATEGORIES.EVENT_ATTENDANCE]: 'Event Attendance',
    [POINT_CATEGORIES.PROJECT_TASK]: 'Project Task Completion',
    [POINT_CATEGORIES.ROLE_FULFILLMENT]: 'Role Fulfillment',
    [POINT_CATEGORIES.RECRUITMENT]: 'Member Recruitment',
    [POINT_CATEGORIES.TRAINING]: 'Training Completion',
    [POINT_CATEGORIES.JCI_EVENT]: 'JCI Event',
    [POINT_CATEGORIES.FUNDRAISING]: 'Fundraising',
    [POINT_CATEGORIES.MEDIA_CONTRIBUTION]: 'Media Contribution',
    [POINT_CATEGORIES.HOBBY_CLUB]: 'Hobby Club',
    [POINT_CATEGORIES.BUSINESS_DIRECTORY]: 'Business Directory',
    [POINT_CATEGORIES.SPONSORSHIP_REFERRAL]: 'Sponsorship Referral',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Point Rules Configuration</h2>
          <p className="text-slate-500">Configure how points are awarded for different activities.</p>
        </div>
        <Button onClick={() => {
          setEditingRule(null);
          setConditions({});
          setSelectedCategory('');
          setIsModalOpen(true);
        }}>
          <Plus size={16} className="mr-2" /> Create Rule
        </Button>
      </div>

      <LoadingState loading={loading} error={error} empty={rules.length === 0} emptyMessage="No point rules configured">
        <div className="grid md:grid-cols-2 gap-6">
          {rules.map(rule => (
            <Card key={rule.id || rule.category} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${rule.active ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{rule.name}</h3>
                    <p className="text-sm text-slate-500">{categoryLabels[rule.category] || rule.category}</p>
                  </div>
                </div>
                <Badge variant={rule.active ? 'success' : 'neutral'}>{rule.active ? 'Active' : 'Inactive'}</Badge>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700">Base Points</span>
                  <span className="text-lg font-bold text-jci-blue">{rule.basePoints}</span>
                </div>
                {rule.multiplier && (
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-700">Multiplier</span>
                    <span className="text-lg font-bold text-slate-900">×{rule.multiplier}</span>
                  </div>
                )}
                {rule.conditions && Object.keys(rule.conditions).length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs font-medium text-blue-900 mb-1">Conditions:</p>
                    <pre className="text-xs text-blue-700 font-mono">{JSON.stringify(rule.conditions, null, 2)}</pre>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(rule)}>
                  <Edit2 size={14} className="mr-2" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(rule)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </LoadingState>

      {/* Create/Edit Rule Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingRule(null); setConditions({}); }}
        title={editingRule ? 'Edit Point Rule' : 'Create Point Rule'}
        drawerOnMobile
      >
        <form onSubmit={handleSaveRule} className="space-y-4">
          <Select
            name="category"
            label="Category"
            options={Object.entries(categoryLabels).map(([value, label]) => ({ label, value }))}
            defaultValue={editingRule?.category}
            required
            disabled={!!editingRule}
            onChange={(e) => setSelectedCategory(e.target.value)}
          />
          <Input
            name="name"
            label="Rule Name"
            placeholder="e.g. Training Event Attendance"
            defaultValue={editingRule?.name}
            required
          />
          <Input
            name="basePoints"
            label="Base Points"
            type="number"
            min="0"
            defaultValue={editingRule?.basePoints}
            required
          />
          <Input
            name="multiplier"
            label="Multiplier (optional)"
            type="number"
            step="0.1"
            min="0"
            placeholder="e.g. 1.5 for 50% bonus"
            defaultValue={editingRule?.multiplier}
          />
          <Input
            name="priority"
            label="Priority (optional)"
            type="number"
            min="1"
            step="1"
            placeholder="Higher priority rules are evaluated first"
            defaultValue={editingRule?.priority || 1}
          />

          {/* Conditions Editor */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-700">Conditions (optional)</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConditionsMode(conditionsMode === 'visual' ? 'json' : 'visual')}
                >
                  <Code size={14} className="mr-1" />
                  {conditionsMode === 'visual' ? 'JSON' : 'Visual'}
                </Button>
              </div>
            </div>

            {conditionsMode === 'visual' ? (
              <VisualConditionsEditor
                conditions={conditions}
                onChange={setConditions}
                category={editingRule?.category || selectedCategory}
              />
            ) : (
              <div className="space-y-2">
                <textarea
                  className="w-full p-3 border border-slate-300 rounded-lg font-mono text-sm"
                  rows={6}
                  value={JSON.stringify(conditions, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setConditions(parsed);
                    } catch { }
                  }}
                  placeholder='{"eventType": "Training", "minDuration": 2}'
                />
                <p className="text-xs text-slate-500">
                  Enter valid JSON. Example: {"{\"eventType\": \"Training\", \"minDuration\": 2}"}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              name="active"
              defaultChecked={editingRule?.active ?? true}
            />
            <label className="text-sm font-medium text-slate-700">Active</label>
          </div>
          <div className="pt-4 flex gap-3">
            <Button className="flex-1" type="submit">
              <Save size={16} className="mr-2" /> Save Rule
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingRule(null);
                setConditions({});
                setSelectedCategory('');
              }}
            >
              <X size={16} className="mr-2" /> Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// Visual Conditions Editor Component
interface VisualConditionsEditorProps {
  conditions: Record<string, any>;
  onChange: (conditions: Record<string, any>) => void;
  category?: string;
}

const VisualConditionsEditor: React.FC<VisualConditionsEditorProps> = ({ conditions, onChange, category }) => {
  const [conditionKey, setConditionKey] = useState<string>('');
  const [conditionValue, setConditionValue] = useState<string>('');

  const getConditionOptions = () => {
    switch (category) {
      case POINT_CATEGORIES.EVENT_ATTENDANCE:
        return [
          { key: 'eventType', label: 'Event Type', type: 'select', options: ['Meeting', 'Training', 'Social', 'Project', 'International'] },
          { key: 'minDuration', label: 'Minimum Duration (hours)', type: 'number' },
          { key: 'role', label: 'Role', type: 'select', options: ['Attendee', 'Organizer', 'Speaker', 'Volunteer'] },
        ];
      case POINT_CATEGORIES.PROJECT_TASK:
        return [
          { key: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
          { key: 'projectType', label: 'Project Type', type: 'text' },
        ];
      case POINT_CATEGORIES.ROLE_FULFILLMENT:
        return [
          { key: 'roleType', label: 'Role Type', type: 'select', options: ['Board', 'Committee', 'Project Lead'] },
          { key: 'minTenure', label: 'Minimum Tenure (months)', type: 'number' },
        ];
      default:
        return [
          { key: 'custom', label: 'Custom Condition', type: 'text' },
        ];
    }
  };

  const handleAddCondition = () => {
    if (!conditionKey || !conditionValue) return;
    const newConditions = { ...conditions };
    const option = getConditionOptions().find(opt => opt.key === conditionKey);
    if (option?.type === 'number') {
      newConditions[conditionKey] = parseFloat(conditionValue) || 0;
    } else {
      newConditions[conditionKey] = conditionValue;
    }
    onChange(newConditions);
    setConditionKey('');
    setConditionValue('');
  };

  const handleRemoveCondition = (key: string) => {
    const newConditions = { ...conditions };
    delete newConditions[key];
    onChange(newConditions);
  };

  const options = getConditionOptions();

  return (
    <div className="space-y-3">
      {Object.keys(conditions).length > 0 && (
        <div className="space-y-2">
          {Object.entries(conditions).map(([key, value]) => {
            const option = options.find(opt => opt.key === key);
            return (
              <div key={key} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">{option?.label || key}:</span>
                  <Badge variant="neutral">{String(value)}</Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveCondition(key)}
                >
                  <X size={14} />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <select
            value={conditionKey}
            onChange={(e) => {
              setConditionKey(e.target.value);
              setConditionValue('');
            }}
            className="block w-full rounded-lg border-slate-300 shadow-sm py-2 px-3 focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 sm:text-sm transition-colors"
          >
            <option value="">Select condition...</option>
            {options.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
        {conditionKey && (
          <>
            {options.find(opt => opt.key === conditionKey)?.type === 'select' ? (
              <div className="flex-1">
                <select
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  className="block w-full rounded-lg border-slate-300 shadow-sm py-2 px-3 focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 sm:text-sm transition-colors"
                >
                  <option value="">Select value...</option>
                  {(options.find(opt => opt.key === conditionKey)?.options || []).map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ) : (
              <Input
                type={options.find(opt => opt.key === conditionKey)?.type || 'text'}
                value={conditionValue}
                onChange={(e) => setConditionValue(e.target.value)}
                placeholder="Enter value"
                className="flex-1"
              />
            )}
            <Button type="button" onClick={handleAddCondition} disabled={!conditionValue}>
              <Plus size={14} />
            </Button>
          </>
        )}
      </div>

      {Object.keys(conditions).length === 0 && (
        <p className="text-xs text-slate-500 text-center py-2">
          No conditions set. Add conditions to make this rule more specific.
        </p>
      )}
    </div>
  );
};

