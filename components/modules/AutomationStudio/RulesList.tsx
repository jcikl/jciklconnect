import React from 'react';
import { Zap, Plus, ArrowRight, PowerOff, Power, Edit } from 'lucide-react';
import { Card, Button, Badge } from '../../ui/Common';
import { AutomationRule } from '../../../types';

export interface RulesListProps {
  rules: AutomationRule[];
  onSelect: (rule: AutomationRule) => void;
  onToggle: (rule: AutomationRule) => void;
  onCreate: () => void;
}

export const RulesList: React.FC<RulesListProps> = ({ rules, onSelect, onToggle, onCreate }) => {
  if (rules.length === 0) {
    return (
      <div className="text-center py-20">
        <Zap className="mx-auto text-slate-400 mb-4" size={48} />
        <p className="text-slate-500 mb-4">No automation rules created yet</p>
        <Button onClick={onCreate}>
          <Plus size={16} className="mr-2" /> Create First Rule
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rules.map(rule => (
        <Card key={rule.id} className="hover:shadow-md transition-shadow">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className={`p-3 rounded-full ${rule.active
                ? 'bg-green-100 text-green-600'
                : 'bg-slate-100 text-slate-400'
                }`}>
                <Zap size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-bold text-slate-900">{rule.name}</h4>
                  <Badge variant={rule.active ? 'success' : 'neutral'}>
                    {rule.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs">
                    IF {rule.trigger}
                  </span>
                  <ArrowRight size={14} className="text-slate-400" />
                  <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                    THEN {rule.action}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <span className="block text-xl font-bold text-slate-900">
                  {rule.executions}
                </span>
                <span className="text-xs text-slate-500">Executions</span>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggle(rule)}
                title={rule.active ? 'Deactivate' : 'Activate'}
              >
                {rule.active ? (
                  <PowerOff size={16} className="text-red-500" />
                ) : (
                  <Power size={16} className="text-green-500" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelect(rule)}
              >
                <Edit size={16} />
              </Button>
            </div>
          </div>
        </Card>
      ))}
      <button
        onClick={onCreate}
        className="w-full py-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-jci-blue hover:text-jci-blue transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={18} /> Add Logic Rule
      </button>
    </div>
  );
};
