import React, { useState, useEffect } from 'react';
import { MembershipType, MembershipRuleConfig } from '../../types';
import { MembershipConfigService, DEFAULT_MEMBERSHIP_RULES } from '../../services/membershipConfigService';
import { Save, AlertCircle } from 'lucide-react';
import { Button, useToast } from '../ui/Common';

const MEMBERSHIP_TYPES: MembershipType[] = ['Guest', 'Probation', 'Full', 'Honorary', 'Senator', 'Visiting', 'Associate'];

export const MembershipConfigView: React.FC = () => {
  const [rules, setRules] = useState<Record<MembershipType, MembershipRuleConfig>>(DEFAULT_MEMBERSHIP_RULES);
  const [calculationMode, setCalculationMode] = useState<'calendar' | 'payment_date'>('calendar');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const config = await MembershipConfigService.getConfig();
      setRules({ ...DEFAULT_MEMBERSHIP_RULES, ...config.rules });
      setCalculationMode(config.calculationMode);
    } catch (e) {
      showToast('Failed to load membership settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await MembershipConfigService.updateConfig(rules, calculationMode);
      showToast('Membership settings updated successfully', 'success');
    } catch (e) {
      showToast('Failed to update membership settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (type: MembershipType, updates: Partial<MembershipRuleConfig>) => {
    setRules(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        ...updates
      }
    }));
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading rules...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Membership Config</h2>
          <p className="text-sm text-slate-500">Configure dues and requirements for each membership type.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                <th className="p-4">Type</th>
                <th className="p-4">Dues (RM)</th>
                <th className="p-4">Nationality Limit</th>
                <th className="p-4">Age Limit</th>
                <th className="p-4">Requires Senatorship</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700">
              {MEMBERSHIP_TYPES.map(type => {
                const rule = rules[type];
                return (
                  <tr key={type} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="p-4 font-medium">{type} {type === 'Full' ? '(Official)' : ''}</td>
                    <td className="p-4">
                      <input
                        type="number"
                        min="0"
                        className="w-24 p-2 border rounded"
                        value={rule.duesAmount}
                        onChange={(e) => updateRule(type, { duesAmount: Number(e.target.value) })}
                      />
                    </td>
                    <td className="p-4">
                      <select
                        className="p-2 border rounded"
                        value={rule.nationalityLimit}
                        onChange={(e) => updateRule(type, { nationalityLimit: e.target.value as any })}
                      >
                        <option value="None">None</option>
                        <option value="Malaysian">Malaysian Only</option>
                        <option value="Non-Malaysian">Non-Malaysian Only</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="Min"
                          className="w-16 p-2 border rounded"
                          value={rule.ageLimit.min ?? ''}
                          onChange={(e) => updateRule(type, {
                            ageLimit: { ...rule.ageLimit, min: e.target.value ? Number(e.target.value) : undefined }
                          })}
                        />
                        <span className="text-slate-400">-</span>
                        <input
                          type="number"
                          placeholder="Max"
                          className="w-16 p-2 border rounded"
                          value={rule.ageLimit.max ?? ''}
                          onChange={(e) => updateRule(type, {
                            ageLimit: { ...rule.ageLimit, max: e.target.value ? Number(e.target.value) : undefined }
                          })}
                        />
                      </div>
                    </td>
                    <td className="p-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-jci-blue"
                          checked={rule.requiresSenatorship}
                          onChange={(e) => updateRule(type, { requiresSenatorship: e.target.checked })}
                        />
                        <span>Required</span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-amber-50 p-4 border-t border-amber-100 text-amber-800 text-sm flex items-start gap-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>
            Changes saved here will apply to future member updates. The validation order when assigning a membership type is: <strong>Nationality &gt; Senatorship ID &gt; Age</strong>.
          </p>
        </div>
      </div>

      {/* 会费起算与计算策略 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Dues Year Calculation Mode (会费年度起算策略)</h3>
          <p className="text-sm text-slate-500">
            Define how the starting year of a member's dues is calculated for status and exceptions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Calendar Year Option */}
          <label className={`flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${
            calculationMode === 'calendar'
              ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500'
              : 'border-slate-200 hover:bg-slate-50'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <input
                type="radio"
                name="calculationMode"
                value="calendar"
                checked={calculationMode === 'calendar'}
                onChange={() => setCalculationMode('calendar')}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-900 text-sm">Calendar Year Mode (按日历年度计算)</span>
            </div>
            <p className="text-xs text-slate-500 pl-7 leading-relaxed">
              Based on the member's join date. <strong>Exception:</strong> Members who join on or after 
              <strong> October 1st</strong> are rolled over and considered as next year's members for dues.
            </p>
          </label>

          {/* Payment Date Option */}
          <label className={`flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${
            calculationMode === 'payment_date'
              ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500'
              : 'border-slate-200 hover:bg-slate-50'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <input
                type="radio"
                name="calculationMode"
                value="payment_date"
                checked={calculationMode === 'payment_date'}
                onChange={() => setCalculationMode('payment_date')}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-900 text-sm">Payment Date Mode (按首笔支付日期计算)</span>
            </div>
            <p className="text-xs text-slate-500 pl-7 leading-relaxed">
              Calculates the starting year from the date of the member's <strong>oldest Membership payment 
              transaction</strong> in the system. Falls back to join date year if no transactions exist.
            </p>
          </label>
        </div>
      </div>
    </div>
  );
};
