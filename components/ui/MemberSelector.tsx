// MemberSelector – 选会员即带出（UX Component Strategy P0）
// 搜索型会员选择器，选中后展示主档带出字段
import React, { useState, useRef, useEffect } from 'react';
import { MEMBER_LOOKUP_FIELDS } from '../../types';
import type { Member } from '../../types';

const FIELD_LABELS: Record<string, string> = {
  name: '姓名',
  email: '邮箱',
  phone: '电话',
  fullName: '全名',
  currentBoardYear: '届别',
  loId: 'LO',
};

function matchesSearch(m: Member, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.trim().toLowerCase();
  const searchable = [
    m.name,
    m.email,
    m.phone,
    (m as unknown as Record<string, unknown>).fullName,
  ]
    .filter(Boolean)
    .map(String)
    .join(' ')
    .toLowerCase();
  return searchable.includes(lower);
}

export interface MemberSelectorProps {
  label?: string;
  members: Member[];
  value: string;
  onChange: (memberId: string) => void;
  selfOption?: boolean;
  selfLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  /** 选中后是否展示主档带出区域 */
  showLookupFields?: boolean;
}

export const MemberSelector: React.FC<MemberSelectorProps> = ({
  label = '选择会员',
  members,
  value,
  onChange,
  selfOption = true,
  selfLabel = '本人',
  placeholder = '搜索姓名、电话、邮箱…',
  disabled = false,
  loading = false,
  error,
  showLookupFields = true,
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedMember = value ? members.find((m) => m.id === value) : null;
  const filtered = query.trim()
    ? members.filter((m) => matchesSearch(m, query))
    : members;
  const displayList = selfOption ? [{ id: '', name: selfLabel } as Member & { id: string }].concat(filtered) : filtered;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
    setHighlight(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, displayList.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter' && displayList[highlight]) {
      e.preventDefault();
      handleSelect(displayList[highlight].id);
    }
  };

  const displayValue = selectedMember ? selectedMember.name : selfOption && !value ? selfLabel : '';

  return (
    <div ref={containerRef} className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={open ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={label ?? '选择会员'}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-activedescendant={open && displayList[highlight] ? `member-opt-${displayList[highlight].id || 'self'}` : undefined}
          className={`
            block w-full rounded-lg border-slate-300 shadow-sm py-2 pl-3 pr-3 text-sm
            focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
            transition-colors
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300'}
          `}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">加载中…</div>
        )}
        {open && (
          <ul
            role="listbox"
            className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1"
          >
            {displayList.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">无匹配会员</li>
            ) : (
              displayList.map((m, i) => (
                <li
                  key={m.id || 'self'}
                  id={`member-opt-${m.id || 'self'}`}
                  role="option"
                  aria-selected={value === m.id}
                  className={`px-3 py-2 text-sm cursor-pointer ${i === highlight ? 'bg-jci-blue/10 text-jci-navy' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => handleSelect(m.id)}
                >
                  {m.name}
                  {!m.id && selfOption && <span className="text-slate-400 ml-1">（当前登录）</span>}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {showLookupFields && selectedMember && (
        <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm border-l-4 border-l-jci-teal">
          <p className="font-medium text-slate-700 mb-1">主档带出</p>
          {MEMBER_LOOKUP_FIELDS.map((key) => {
            const v = (selectedMember as unknown as Record<string, unknown>)[key];
            if (v == null || v === '') return null;
            return (
              <p key={key} className="text-slate-600">
                {FIELD_LABELS[key] ?? key}: {String(v)}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
};
