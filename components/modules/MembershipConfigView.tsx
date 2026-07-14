import React, { useState, useEffect } from 'react';
import { MembershipType, MembershipRuleConfig } from '../../types';
import { MembershipConfigService, DEFAULT_MEMBERSHIP_RULES } from '../../services/membershipConfigService';
import { Save, AlertCircle, RefreshCw } from 'lucide-react';
import { Button, useToast } from '../ui/Common';
import { MembersService } from '../../services/membersService';

const MEMBERSHIP_TYPES: MembershipType[] = ['Guest', 'Probation', 'Official', 'Honorary', 'Senator', 'Visiting', 'Associate'];

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-jci-blue focus:ring-offset-1 ${checked ? 'bg-jci-blue' : 'bg-slate-200'}`}
  >
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
  </button>
);

const fieldCls = "px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-jci-blue bg-white";

export const MembershipConfigView: React.FC = () => {
  const [rules, setRules] = useState<Record<MembershipType, MembershipRuleConfig>>(DEFAULT_MEMBERSHIP_RULES);
  const [calculationMode, setCalculationMode] = useState<'calendar' | 'payment_date'>('calendar');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingTypes, setSyncingTypes] = useState(false);
  const [syncingRecords, setSyncingRecords] = useState(false);
  const { showToast } = useToast();

  useEffect(() => { loadRules(); }, []);

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

  const handleBatchSyncMembershipTypes = async () => {
    if (!window.confirm('根据当前 Config，批量推断并写入 members.membershipType？\n\n不修改 membership 字段。请先保存 Config 再执行。')) return;
    setSyncingTypes(true);
    try {
      const result = await MembersService.batchSyncMembershipTypes({ year: new Date().getFullYear() });
      showToast(`membershipType: updated ${result.updated}, unchanged ${result.alreadyCorrect}`, 'success');
    } catch (e) {
      showToast('Failed to sync membershipType', 'error');
    } finally { setSyncingTypes(false); }
  };

  const handleBatchSyncMembershipRecords = async () => {
    const currentYear = new Date().getFullYear();
    if (!window.confirm(`根据各会员 joined date 与当前 Config，校正从入会年至 ${currentYear} 的所有已有 membership 记录 dues？\n\n仅更新已有记录（不新建）。请先保存 Config。`)) return;
    setSyncingRecords(true);
    try {
      const result = await MembersService.batchSyncMembershipRecords({ year: currentYear, toYear: currentYear, onlyExistingRecords: false });
      showToast(`membership: updated ${result.updated}, already correct ${result.alreadyCorrect}`, 'success');
    } catch (e) {
      showToast('Failed to sync membership records', 'error');
    } finally { setSyncingRecords(false); }
  };

  const updateRule = (type: MembershipType, updates: Partial<MembershipRuleConfig>) =>
    setRules(prev => ({ ...prev, [type]: { ...prev[type], ...updates } }));

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Loading…</div>;

  const isBusy = syncingTypes || syncingRecords || saving;

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex items-center gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handleBatchSyncMembershipTypes} disabled={isBusy} className="flex items-center gap-1.5">
          <RefreshCw size={11} className={syncingTypes ? 'animate-spin' : ''} />
          Sync Type
        </Button>
        <Button variant="outline" size="sm" onClick={handleBatchSyncMembershipRecords} disabled={isBusy} className="flex items-center gap-1.5">
          <RefreshCw size={11} className={syncingRecords ? 'animate-spin' : ''} />
          Sync Records
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isBusy} className="flex items-center gap-1.5">
          <Save size={12} />
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* ── Mobile: compact cards ── */}
      <div className="md:hidden bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
        {MEMBERSHIP_TYPES.map(type => {
          const rule = rules[type];
          return (
            <div key={type} className="px-4 py-3 space-y-2.5">
              {/* Header row: name + senatorship */}
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-800">
                  {type}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Senatorship</span>
                  <Toggle
                    checked={rule.requiresSenatorship}
                    onChange={(v) => updateRule(type, { requiresSenatorship: v })}
                  />
                </div>
              </div>
              {/* Data row: dues + nationality + age */}
              <div className="flex items-center gap-2">
                {/* Dues */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-slate-400 shrink-0">RM</span>
                  <input
                    type="number" min="0"
                    className={`${fieldCls} w-16`}
                    value={rule.duesAmount}
                    onChange={(e) => updateRule(type, { duesAmount: Number(e.target.value) })}
                  />
                </div>
                {/* Nationality */}
                <select
                  className={`${fieldCls} flex-1 min-w-0`}
                  value={rule.nationalityLimit}
                  onChange={(e) => updateRule(type, { nationalityLimit: e.target.value as any })}
                >
                  <option value="None">Any nationality</option>
                  <option value="Malaysian">Malaysian only</option>
                  <option value="Non-Malaysian">Non-Malaysian</option>
                </select>
                {/* Age range */}
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number" placeholder="Min"
                    className={`${fieldCls} w-12 text-center`}
                    value={rule.ageLimit.min ?? ''}
                    onChange={(e) => updateRule(type, { ageLimit: { ...rule.ageLimit, min: e.target.value ? Number(e.target.value) : undefined } })}
                  />
                  <span className="text-slate-300 text-xs">–</span>
                  <input
                    type="number" placeholder="Max"
                    className={`${fieldCls} w-12 text-center`}
                    value={rule.ageLimit.max ?? ''}
                    onChange={(e) => updateRule(type, { ageLimit: { ...rule.ageLimit, max: e.target.value ? Number(e.target.value) : undefined } })}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop: table ── */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dues (RM)</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nationality</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Age Min – Max</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Senatorship</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MEMBERSHIP_TYPES.map(type => {
              const rule = rules[type];
              return (
                <tr key={type} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-700 whitespace-nowrap">
                    {type}
                  </td>
                  <td className="px-4 py-2.5">
                    <input type="number" min="0"
                      className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-jci-blue"
                      value={rule.duesAmount}
                      onChange={(e) => updateRule(type, { duesAmount: Number(e.target.value) })} />
                  </td>
                  <td className="px-4 py-2.5">
                    <select className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-jci-blue"
                      value={rule.nationalityLimit}
                      onChange={(e) => updateRule(type, { nationalityLimit: e.target.value as any })}>
                      <option value="None">None</option>
                      <option value="Malaysian">Malaysian Only</option>
                      <option value="Non-Malaysian">Non-Malaysian Only</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <input type="number" placeholder="Min"
                        className="w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-jci-blue"
                        value={rule.ageLimit.min ?? ''}
                        onChange={(e) => updateRule(type, { ageLimit: { ...rule.ageLimit, min: e.target.value ? Number(e.target.value) : undefined } })} />
                      <span className="text-slate-300 text-xs">–</span>
                      <input type="number" placeholder="Max"
                        className="w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-jci-blue"
                        value={rule.ageLimit.max ?? ''}
                        onChange={(e) => updateRule(type, { ageLimit: { ...rule.ageLimit, max: e.target.value ? Number(e.target.value) : undefined } })} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Toggle
                      checked={rule.requiresSenatorship}
                      onChange={(v) => updateRule(type, { requiresSenatorship: v })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle size={13} className="shrink-0" />
          Changes apply to future updates. Validation order: <strong>Nationality › Senatorship › Age</strong>.
        </div>
      </div>

      {/* Mobile amber notice */}
      <div className="md:hidden bg-amber-50 px-4 py-3 rounded-xl border border-amber-100 text-amber-800 text-xs flex items-start gap-2">
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
        Changes apply to future updates. Validation order: <strong>Nationality › Senatorship › Age</strong>.
      </div>

      {/* Dues Year Calculation Mode */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Dues Year Calculation Mode</h3>
          <p className="text-xs text-slate-500 mt-0.5">How the starting year of a member's dues is calculated.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className={`flex flex-col p-3.5 border rounded-xl cursor-pointer transition-all ${
            calculationMode === 'calendar' ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50'
          }`}>
            <div className="flex items-center gap-2.5 mb-1.5">
              <input type="radio" name="calculationMode" value="calendar"
                checked={calculationMode === 'calendar'} onChange={() => setCalculationMode('calendar')}
                className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500" />
              <span className="font-semibold text-slate-800 text-sm">Calendar Year</span>
            </div>
            <p className="text-xs text-slate-500 pl-6 leading-relaxed">
              Based on join date. Members joining on or after <strong>Oct 1</strong> roll over to next year.
            </p>
          </label>
          <label className={`flex flex-col p-3.5 border rounded-xl cursor-pointer transition-all ${
            calculationMode === 'payment_date' ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50'
          }`}>
            <div className="flex items-center gap-2.5 mb-1.5">
              <input type="radio" name="calculationMode" value="payment_date"
                checked={calculationMode === 'payment_date'} onChange={() => setCalculationMode('payment_date')}
                className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500" />
              <span className="font-semibold text-slate-800 text-sm">Payment Date</span>
            </div>
            <p className="text-xs text-slate-500 pl-6 leading-relaxed">
              Based on the member's <strong>oldest membership payment</strong>. Falls back to join date if none exists.
            </p>
          </label>
        </div>
      </div>


    </div>
  );
};
