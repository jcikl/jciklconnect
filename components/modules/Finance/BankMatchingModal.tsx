import React, { useState, useEffect, useMemo } from 'react';
import { Link2, Link2Off, CheckCircle, AlertCircle, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Transaction, BankAccount } from '../../../types';
import { FinanceService } from '../../../services/financeService';
import { Modal, Button, Badge } from '../../ui/Common';
import { formatCurrency } from '../../../utils/formatUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  account: BankAccount;
  currentUserId: string;
  onComplete: () => void;
}

interface MatchSuggestion {
  bankTx: Transaction;
  candidates: Transaction[];
  selectedCandidateId: string | null;
}

const DATE_WINDOW_DAYS = 7;

function daysDiff(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const BankMatchingModal: React.FC<Props> = ({
  isOpen, onClose, account, currentUserId, onComplete,
}) => {
  const [bankImports, setBankImports] = useState<Transaction[]>([]);
  const [manualEntries, setManualEntries] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    FinanceService.getUnmatchedForReconciliation(account.id)
      .then(({ bankImports, manualEntries }) => {
        setBankImports(bankImports);
        setManualEntries(manualEntries);
      })
      .catch(() => setError('Failed to load transactions'))
      .finally(() => setLoading(false));
  }, [isOpen, account.id]);

  const suggestions = useMemo((): MatchSuggestion[] => {
    return bankImports.map(bankTx => {
      const candidates = manualEntries.filter(m =>
        m.type === bankTx.type &&
        Math.abs(m.amount - bankTx.amount) < 0.01 &&
        daysDiff(m.date, bankTx.date) <= DATE_WINDOW_DAYS
      );
      return { bankTx, candidates, selectedCandidateId: candidates[0]?.id ?? null };
    });
  }, [bankImports, manualEntries]);

  const [selections, setSelections] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const initial: Record<string, string | null> = {};
    suggestions.forEach(s => { initial[s.bankTx.id] = s.selectedCandidateId; });
    setSelections(initial);
  }, [suggestions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return suggestions;
    const q = search.toLowerCase();
    return suggestions.filter(s =>
      s.bankTx.description.toLowerCase().includes(q) ||
      s.bankTx.amount.toString().includes(q)
    );
  }, [suggestions, search]);

  const matchedCount = Object.values(selections).filter(Boolean).length;
  const unmatchedCount = suggestions.length - matchedCount;

  const handleMatch = async (bankTxId: string) => {
    const manualTxId = selections[bankTxId];
    if (!manualTxId) return;
    setSaving(bankTxId);
    setError(null);
    try {
      await FinanceService.matchTransactions(bankTxId, manualTxId, currentUserId);
      setBankImports(prev => prev.filter(t => t.id !== bankTxId));
      setManualEntries(prev => prev.filter(t => t.id !== manualTxId));
    } catch {
      setError('Failed to save match');
    } finally {
      setSaving(null);
    }
  };

  const unmatchPair = async (bankTxId: string, manualTxId: string) => {
    setSaving(bankTxId);
    try {
      await FinanceService.unmatchTransactions(bankTxId, manualTxId);
      // Reload
      const { bankImports: b, manualEntries: m } = await FinanceService.getUnmatchedForReconciliation(account.id);
      setBankImports(b);
      setManualEntries(m);
    } catch {
      setError('Failed to unmatch');
    } finally {
      setSaving(null);
    }
  };

  const noSuggestBankTxs = suggestions.filter(s => s.candidates.length === 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Match Transactions — ${account.name}`}
      size="xl"
      drawerOnMobile
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <p className="text-xs text-slate-500">
            {matchedCount} matched · {unmatchedCount} pending
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={onComplete} disabled={suggestions.length > 0 && matchedCount === 0}>
              Done
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Summary banner */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-slate-800">{bankImports.length}</p>
            <p className="text-[11px] text-slate-500 uppercase tracking-wide">Bank imports</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-green-600">{matchedCount}</p>
            <p className="text-[11px] text-slate-500 uppercase tracking-wide">Matched</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-amber-500">{noSuggestBankTxs.length}</p>
            <p className="text-[11px] text-slate-500 uppercase tracking-wide">No suggestion</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by description or amount…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm">Loading transactions…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            {suggestions.length === 0 ? 'All bank imports have been matched.' : 'No results for your search.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(({ bankTx, candidates }) => {
              const selectedId = selections[bankTx.id] ?? null;
              const selectedManual = manualEntries.find(m => m.id === selectedId);
              const isExpanded = expandedId === bankTx.id;
              const hasCandidates = candidates.length > 0;

              return (
                <div
                  key={bankTx.id}
                  className={`rounded-xl border ${hasCandidates ? 'border-slate-200' : 'border-amber-200 bg-amber-50/40'} overflow-hidden`}
                >
                  {/* Bank transaction row */}
                  <div className="flex items-start gap-3 p-3 bg-white">
                    <div className="w-1.5 self-stretch rounded-full shrink-0 bg-blue-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="info" className="text-[10px] shrink-0">Bank import</Badge>
                        <span className="text-[11px] text-slate-400">{formatDate(bankTx.date)}</span>
                      </div>
                      <p className="text-sm text-slate-700 mt-0.5 truncate">{bankTx.description}</p>
                      <p className={`text-sm font-semibold mt-0.5 ${bankTx.type === 'Income' ? 'text-green-600' : 'text-rose-500'}`}>
                        {bankTx.type === 'Income' ? '+' : '-'}{formatCurrency(bankTx.amount, account.currency)}
                      </p>
                    </div>
                  </div>

                  {/* Matching area */}
                  <div className="border-t border-slate-100 px-3 pb-3 pt-2 bg-slate-50/60">
                    {hasCandidates ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">
                          {candidates.length} suggested match{candidates.length > 1 ? 'es' : ''}
                        </p>

                        {/* Candidate selector */}
                        <div className="space-y-1.5">
                          {(isExpanded ? candidates : candidates.slice(0, 2)).map(c => (
                            <label key={c.id} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all ${selectedId === c.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                              <input
                                type="radio"
                                name={`match-${bankTx.id}`}
                                value={c.id}
                                checked={selectedId === c.id}
                                onChange={() => setSelections(prev => ({ ...prev, [bankTx.id]: c.id }))}
                                className="mt-0.5 accent-blue-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-400">{formatDate(c.date)}</span>
                                  <span className="text-[10px] text-slate-400">({daysDiff(c.date, bankTx.date).toFixed(0)}d apart)</span>
                                </div>
                                <p className="text-sm text-slate-700 truncate">{c.description}</p>
                                {c.purpose && <p className="text-[11px] text-slate-400 truncate">{c.purpose}</p>}
                              </div>
                            </label>
                          ))}
                        </div>

                        {candidates.length > 2 && (
                          <button
                            className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700"
                            onClick={() => setExpandedId(isExpanded ? null : bankTx.id)}
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {isExpanded ? 'Show less' : `Show ${candidates.length - 2} more`}
                          </button>
                        )}

                        {/* Manual override: pick from all unmatched manual entries */}
                        <div>
                          <p className="text-[11px] text-slate-400 mb-1">Or select manually:</p>
                          <select
                            value={selectedId ?? ''}
                            onChange={e => setSelections(prev => ({ ...prev, [bankTx.id]: e.target.value || null }))}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                          >
                            <option value="">— no match —</option>
                            {manualEntries
                              .filter(m => m.type === bankTx.type)
                              .map(m => (
                                <option key={m.id} value={m.id}>
                                  {formatDate(m.date)} · {m.description} · {formatCurrency(m.amount, account.currency)}
                                </option>
                              ))}
                          </select>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleMatch(bankTx.id)}
                          disabled={!selectedId || saving === bankTx.id}
                          className="w-full"
                        >
                          <Link2 size={13} className="mr-1.5" />
                          {saving === bankTx.id ? 'Saving…' : 'Confirm match'}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-amber-700">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>No system transaction found with same amount within {DATE_WINDOW_DAYS} days.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Already matched (shown at bottom) */}
        {!loading && matchedCount > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold mb-2">
              <CheckCircle size={11} className="inline mr-1 text-green-500" />
              {matchedCount} matched this session
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};
