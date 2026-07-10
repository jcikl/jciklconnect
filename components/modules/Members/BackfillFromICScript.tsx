import React, { useMemo, useState } from 'react';
import { RefreshCw, Wand2, CheckCircle, ArrowRight } from 'lucide-react';
import { Member } from '../../../types';
import { MembersService } from '../../../services/membersService';
import { useToast } from '../../ui/Common';
import {
  isMalaysianIC,
  getDateOfBirthFromIC,
  getGenderFromIC,
  getBirthPlaceFromIC,
} from '../../../utils/malaysianIdUtils';

interface Props {
  members: Member[];
  onMembersChanged: () => void;
}

interface FieldDiff {
  key: string;
  label: string;
  current: string;
  inferred: string;
  changed: boolean;
}

interface MemberRow {
  id: string;
  name: string;
  ic: string;
  fields: FieldDiff[];
  hasChanges: boolean;
}

function getMemberIC(m: Member): string {
  return (m.idNumber || (m.general as any)?.idNumber || '').replace(/[\s\-]/g, '');
}

function getMemberDOB(m: Member): string {
  return (m.dateOfBirth || m.dob || (m.general as any)?.dob || '').trim();
}

function getMemberGender(m: Member): string {
  return (m.gender || (m.general as any)?.gender || '').trim();
}

function getMemberBirthPlace(m: Member): string {
  return (m.general?.birthPlace ?? m.birthPlace ?? '').trim();
}

export const BackfillFromICScript: React.FC<Props> = ({ members, onMembersChanged }) => {
  const { showToast } = useToast();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);

  // Build rows for ALL Malaysian IC members, showing all 3 fields regardless of current value
  const rows = useMemo<MemberRow[]>(() => {
    return members
      .map(m => {
        const ic = getMemberIC(m);
        if (!isMalaysianIC(ic)) return null;

        const curDOB = getMemberDOB(m);
        const curGender = getMemberGender(m);
        const curBP = getMemberBirthPlace(m);

        const inferredDOB = getDateOfBirthFromIC(ic);
        const inferredGender = getGenderFromIC(ic);
        const inferredBP = getBirthPlaceFromIC(ic);

        const fields: FieldDiff[] = [
          {
            key: 'dateOfBirth',
            label: '出生日期',
            current: curDOB,
            inferred: inferredDOB,
            changed: !!inferredDOB && inferredDOB !== curDOB,
          },
          {
            key: 'gender',
            label: '性别',
            current: curGender,
            inferred: inferredGender,
            changed: !!inferredGender && inferredGender !== curGender,
          },
          {
            key: 'general.birthPlace',
            label: '出生地',
            current: curBP,
            inferred: inferredBP,
            changed: !!inferredBP && inferredBP !== curBP,
          },
        ];

        return {
          id: m.id,
          name: m.name || m.fullName || m.id,
          ic,
          fields,
          hasChanges: fields.some(f => f.changed),
        };
      })
      .filter((r): r is MemberRow => r !== null);
  }, [members]);

  const rowsWithChanges = rows.filter(r => r.hasChanges);
  const totalChanges = rowsWithChanges.reduce((s, r) => s + r.fields.filter(f => f.changed).length, 0);

  const handleRun = async () => {
    setRunning(true);
    let count = 0;
    try {
      for (const row of rowsWithChanges) {
        const patch: Record<string, string> = {};
        for (const f of row.fields) {
          if (f.changed) patch[f.key] = f.inferred;
        }
        await MembersService.updateMember(row.id, patch);
        count++;
      }
      setAppliedCount(count);
      setDone(true);
      showToast(`已补回 ${count} 条会员资料（${totalChanges} 项）`, 'success');
      onMembersChanged();
    } catch {
      showToast('部分更新失败，请重试', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="border border-blue-200 rounded-xl bg-blue-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Wand2 size={16} className="text-blue-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-blue-900 text-sm">IC 自动推断补回</span>
          <p className="text-xs text-blue-600 mt-0.5">
            扫描所有马来西亚 IC，推断<strong>出生日期、性别、出生地</strong>并与现有数据对比。
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-xs text-blue-700 font-semibold bg-blue-100 px-2 py-0.5 rounded-full">
            {rows.length} 人有 IC
          </span>
          {rowsWithChanges.length > 0 && (
            <span className="text-xs text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded-full">
              {rowsWithChanges.length} 人需更新
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {rows.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <span>没有找到有效的马来西亚 IC</span>
          </div>
        ) : (
          <>
            {/* Comparison table — always visible */}
            <div className="rounded-lg border border-blue-200 bg-white overflow-hidden text-xs">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_1fr_1fr_1fr] gap-0 bg-slate-50 border-b border-slate-200 px-3 py-1.5 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">
                <span>会员</span>
                <span>IC</span>
                <span>出生日期</span>
                <span>性别</span>
                <span>出生地</span>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                {rows.map(row => (
                  <div
                    key={row.id}
                    className={`grid grid-cols-[1fr_80px_1fr_1fr_1fr] gap-0 px-3 py-2 items-start ${
                      row.hasChanges ? '' : 'opacity-50'
                    }`}
                  >
                    {/* Name */}
                    <div className="font-medium text-slate-800 truncate pr-2">{row.name}</div>

                    {/* IC */}
                    <div className="font-mono text-slate-400 text-[10px] truncate">{row.ic}</div>

                    {/* DOB / Gender / BirthPlace */}
                    {row.fields.map(f => (
                      <div key={f.key} className="pr-2">
                        {f.changed ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-slate-400 line-through">
                              {f.current || <span className="italic not-italic no-underline text-slate-300">(空)</span>}
                            </div>
                            <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                              <ArrowRight size={10} className="shrink-0" />
                              {f.inferred}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            {f.current || (f.inferred ? (
                              <span className="text-slate-300 italic">{f.inferred}</span>
                            ) : '—')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] text-slate-500 px-1">
              <span className="flex items-center gap-1">
                <span className="line-through">旧值</span>
                <ArrowRight size={9} />
                <span className="text-emerald-700 font-semibold">新值</span>
                = 将更新
              </span>
              <span className="opacity-50">灰色行 = 无变化</span>
            </div>

            {/* Action */}
            {done ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle size={14} />
                <span>已成功更新 {appliedCount} 位会员资料</span>
              </div>
            ) : rowsWithChanges.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle size={14} />
                <span>所有可推断字段均已与 IC 一致，无需更新</span>
              </div>
            ) : (
              <button
                onClick={handleRun}
                disabled={running}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {running ? (
                  <><RefreshCw size={13} className="animate-spin" />更新中 ({rowsWithChanges.length} 人)...</>
                ) : (
                  <><Wand2 size={13} />执行更新（{rowsWithChanges.length} 人 · {totalChanges} 项变更）</>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
