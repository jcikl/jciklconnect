import React, { useMemo, useState } from 'react';
import { AlertTriangle, Trash2, ChevronDown, ChevronUp, RefreshCw, CalendarX } from 'lucide-react';
import { Member } from '../../../types';
import { MembersService } from '../../../services/membersService';
import { useToast } from '../../ui/Common';
import { BackfillFromICScript } from './BackfillFromICScript';

// ── Batch delete by import date ───────────────────────────────────────────────

function toDateStr(val: any): string {
  if (!val) return '';
  // Firestore Timestamp
  if (typeof val?.toDate === 'function') return val.toDate().toISOString().slice(0, 10);
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function BatchDeleteByDate({ members, onMembersChanged }: { members: Member[]; onMembersChanged: () => void }) {
  const { showToast } = useToast();
  const [date, setDate] = useState('2026-07-10');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const targets = useMemo(
    () => members.filter(m => toDateStr((m as any).createdAt) === date),
    [members, date]
  );

  const handleDelete = async () => {
    setLoading(true);
    try {
      await Promise.all(targets.map(m => MembersService.deleteMember(m.id)));
      showToast(`已删除 ${targets.length} 条 ${date} 导入的记录`, 'success');
      setConfirmed(false);
      onMembersChanged();
    } catch {
      showToast('部分删除失败，请重试', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-red-200 rounded-xl p-4 bg-red-50 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarX size={16} className="text-red-500" />
        <span className="font-semibold text-red-800 text-sm">批量删除——按导入日期</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={e => { setDate(e.target.value); setConfirmed(false); }}
          className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
        />
        <span className="text-sm text-red-700 font-medium">
          该日期共 <strong>{targets.length}</strong> 条记录
        </span>
      </div>

      {targets.length > 0 && (
        <>
          {!confirmed ? (
            <button
              onClick={() => setConfirmed(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
            >
              <Trash2 size={14} />
              删除 {targets.length} 条记录
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-red-700">确认删除 {targets.length} 条？此操作无法撤销。</span>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
              >
                {loading ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {loading ? `删除中 (${targets.length})...` : '确认删除'}
              </button>
              <button
                onClick={() => setConfirmed(false)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface Props {
  members: Member[];
  onMembersChanged: () => void;
}

interface DuplicateGroup {
  reason: string;
  matchValue: string;
  members: Member[];
}

const normalizePhone = (p: string) => (p || '').replace(/[\s\-().+]/g, '').replace(/^0/, '60');
const normalizeEmail = (e: string) => (e || '').trim().toLowerCase();
const normalizeId = (id: string) => (id || '').replace(/[\s\-]/g, '').toUpperCase();

const isAbnormalId = (id: string) => {
  const v = (id || '').trim();
  if (!v) return false;
  if (v.includes('@')) return true;                        // email stored in IC field
  if (/^[0-9]{1,5}$/.test(v)) return true;                // suspiciously short number
  if (v.length > 30) return true;                         // too long
  return false;
};

function findDuplicateGroups(members: Member[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  const addGroups = (
    keyFn: (m: Member) => string,
    reason: string,
    skipEmpty = true
  ) => {
    const map = new Map<string, Member[]>();
    for (const m of members) {
      const k = keyFn(m);
      if (skipEmpty && !k) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    for (const [k, grp] of map.entries()) {
      if (grp.length < 2) continue;
      const key = `${reason}:${k}`;
      if (seen.has(key)) continue;
      seen.add(key);
      groups.push({ reason, matchValue: k, members: grp });
    }
  };

  addGroups(m => normalizeEmail(m.email || m.contact?.email || ''), 'Email');
  addGroups(m => {
    const p = normalizePhone(m.phone || m.contact?.phone || '');
    return p.length >= 8 ? p : '';
  }, 'Phone');
  addGroups(m => {
    const id = normalizeId(m.idNumber || m.general?.idNumber || '');
    return id.length >= 6 ? id : '';
  }, 'National ID');

  // Sort: groups with abnormal IDs first, then by group size desc
  groups.sort((a, b) => {
    const aHasAbnormal = a.members.some(m => isAbnormalId(m.idNumber || m.general?.idNumber || ''));
    const bHasAbnormal = b.members.some(m => isAbnormalId(m.idNumber || m.general?.idNumber || ''));
    if (aHasAbnormal !== bHasAbnormal) return aHasAbnormal ? -1 : 1;
    return b.members.length - a.members.length;
  });

  return groups;
}

function memberScore(m: Member): number {
  // Higher = more "complete" / likely the good record
  let score = 0;
  const id = m.idNumber || m.general?.idNumber || '';
  if (id && !isAbnormalId(id)) score += 10;
  if (m.fullName) score += 3;
  if (m.name) score += 2;
  if (m.email || m.contact?.email) score += 2;
  if (m.phone || m.contact?.phone) score += 2;
  // Older join date = more established
  const joined = m.joinDate || m.jciCareer?.joinDate || '';
  if (joined) score += 1;
  return score;
}

function MemberCard({ member, isKeep, onDelete, deleting }: {
  member: Member;
  isKeep: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const id = member.idNumber || member.general?.idNumber || '';
  const email = member.email || member.contact?.email || '';
  const phone = member.phone || member.contact?.phone || '';
  const abnormal = isAbnormalId(id);

  return (
    <div className={`relative rounded-xl border-2 p-4 flex-1 min-w-0 transition-all ${
      isKeep
        ? 'border-green-300 bg-green-50'
        : abnormal
          ? 'border-red-300 bg-red-50'
          : 'border-slate-200 bg-white'
    }`}>
      {isKeep && (
        <span className="absolute top-2 right-2 text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">保留</span>
      )}
      {!isKeep && abnormal && (
        <span className="absolute top-2 right-2 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
          <AlertTriangle size={10} /> 异常
        </span>
      )}
      <div className="font-semibold text-slate-800 text-sm truncate pr-16">{member.name || member.fullName || '—'}</div>
      {member.fullName && member.fullName !== member.name && (
        <div className="text-xs text-slate-500 truncate">{member.fullName}</div>
      )}
      <div className="mt-2 space-y-1 text-xs text-slate-600">
        <div className="flex gap-1">
          <span className="text-slate-400 w-16 shrink-0">IC/护照</span>
          <span className={`truncate font-mono ${abnormal ? 'text-red-600 font-semibold' : ''}`}>
            {id || <span className="text-slate-300">—</span>}
          </span>
        </div>
        <div className="flex gap-1">
          <span className="text-slate-400 w-16 shrink-0">Email</span>
          <span className="truncate">{email || <span className="text-slate-300">—</span>}</span>
        </div>
        <div className="flex gap-1">
          <span className="text-slate-400 w-16 shrink-0">Phone</span>
          <span className="truncate">{phone || <span className="text-slate-300">—</span>}</span>
        </div>
        <div className="flex gap-1">
          <span className="text-slate-400 w-16 shrink-0">加入</span>
          <span>{member.joinDate || member.jciCareer?.joinDate || <span className="text-slate-300">—</span>}</span>
        </div>
        <div className="flex gap-1">
          <span className="text-slate-400 w-16 shrink-0">状态</span>
          <span>{member.status || <span className="text-slate-300">—</span>}</span>
        </div>
      </div>
      {!isKeep && (
        <button
          onClick={onDelete}
          disabled={deleting}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          {deleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
          {deleting ? '删除中...' : '删除此记录'}
        </button>
      )}
    </div>
  );
}

function DuplicateGroupRow({ group, onDelete }: {
  group: DuplicateGroup;
  onDelete: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sort: best record first (keep), worst last (delete)
  const sorted = useMemo(() =>
    [...group.members].sort((a, b) => memberScore(b) - memberScore(a)),
    [group.members]
  );

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const reasonColor: Record<string, string> = {
    Email: 'bg-blue-100 text-blue-700',
    Phone: 'bg-purple-100 text-purple-700',
    'National ID': 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <AlertTriangle size={15} className="text-amber-500 shrink-0" />
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${reasonColor[group.reason] ?? 'bg-slate-100 text-slate-600'}`}>
          {group.reason}
        </span>
        <span className="text-sm font-mono text-slate-700 truncate flex-1">{group.matchValue}</span>
        <span className="text-xs text-slate-400 shrink-0">{group.members.length} 条记录</span>
        {expanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="p-4 flex flex-wrap gap-3">
          {sorted.map((m, i) => (
            <MemberCard
              key={m.id}
              member={m}
              isKeep={i === 0}
              onDelete={() => handleDelete(m.id)}
              deleting={deletingId === m.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const DuplicateMembersView: React.FC<Props> = ({ members, onMembersChanged }) => {
  const { showToast } = useToast();
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const activeMembers = useMemo(
    () => members.filter(m => !deletedIds.has(m.id)),
    [members, deletedIds]
  );

  const groups = useMemo(() => findDuplicateGroups(activeMembers), [activeMembers]);

  const handleDelete = async (id: string) => {
    try {
      await MembersService.deleteMember(id);
      setDeletedIds(prev => new Set([...prev, id]));
      showToast('会员记录已删除', 'success');
      onMembersChanged();
    } catch {
      showToast('删除失败，请重试', 'error');
      throw new Error('delete failed');
    }
  };

  const tools = (
    <div className="space-y-3">
      <BatchDeleteByDate members={members} onMembersChanged={onMembersChanged} />
      <BackfillFromICScript members={members} onMembersChanged={onMembersChanged} />
    </div>
  );

  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        {tools}
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
            <AlertTriangle size={24} className="text-green-400" />
          </div>
          <p className="font-semibold text-slate-600">没有发现重复会员</p>
          <p className="text-sm mt-1">根据 Email、电话、身份证号检测</p>
        </div>
      </div>
    );
  }

  const abnormalCount = activeMembers.filter(m => isAbnormalId(m.idNumber || m.general?.idNumber || '')).length;

  return (
    <div className="space-y-4">
      {tools}

      {/* Summary bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <AlertTriangle size={16} className="text-amber-500" />
          <span className="text-sm font-semibold text-amber-800">发现 {groups.length} 组重复</span>
        </div>
        {abnormalCount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-semibold text-red-800">{abnormalCount} 条异常 IC 记录</span>
          </div>
        )}
        <p className="text-xs text-slate-400">绿色 = 建议保留，删除其他记录</p>
      </div>

      {/* Groups */}
      <div className="space-y-3">
        {groups.map((g, i) => (
          <DuplicateGroupRow
            key={`${g.reason}:${g.matchValue}:${i}`}
            group={g}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
};
