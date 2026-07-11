import React, { useState, useMemo } from 'react';
import { Handshake, Plus, Edit, Trash2, DollarSign, Users, Building2, TrendingUp, Search } from 'lucide-react';
import { Button, Card, StatCard, StatCardsContainer, Badge, Modal, useToast } from '../ui/Common';
import { Input, Textarea } from '../ui/Form';
import { useSponsorships } from '../../hooks/useSponsorships';
import { usePermissions } from '../../hooks/usePermissions';
import { SponsorshipRecord } from '../../types';

// ---------- helpers ----------
const formatCurrency = (amount: number) =>
  `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateStr = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
};

// ---------- empty form ----------
const emptyForm = (): Omit<SponsorshipRecord, 'id'> => ({
  memberId: '',
  memberName: '',
  sponsorName: '',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  description: '',
});

// ---------- Modal ----------
interface SponsorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initial: SponsorshipRecord | null;
  onSave: (data: Omit<SponsorshipRecord, 'id'>, id?: string, prevMemberId?: string) => Promise<void>;
}

const SponsorModal: React.FC<SponsorModalProps> = ({ isOpen, onClose, initial, onSave }) => {
  const [form, setForm] = useState<Omit<SponsorshipRecord, 'id'>>(initial ? { ...initial } : emptyForm());
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  React.useEffect(() => {
    setForm(initial ? { ...initial } : emptyForm());
  }, [initial, isOpen]);

  const set = (field: keyof Omit<SponsorshipRecord, 'id'>, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.memberName.trim()) { showToast('Member name is required', 'error'); return; }
    if (!form.sponsorName.trim()) { showToast('Sponsor name is required', 'error'); return; }
    if (!form.amount || form.amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }
    if (!form.date) { showToast('Date is required', 'error'); return; }
    setSaving(true);
    try {
      await onSave(form, initial?.id, initial?.memberId);
      onClose();
    } catch {
      // toast already shown in hook
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? 'Edit Sponsorship Record' : 'Add Sponsorship Record'}
      size="md"
    >
      <div className="space-y-4">
        <Input
          label="Member Name *"
          value={form.memberName}
          onChange={e => set('memberName', e.target.value)}
          placeholder="e.g. Alex Rivera"
        />
        <Input
          label="Member ID"
          value={form.memberId}
          onChange={e => set('memberId', e.target.value)}
          placeholder="e.g. m123 (optional)"
        />
        <Input
          label="Sponsor / Company Name *"
          value={form.sponsorName}
          onChange={e => set('sponsorName', e.target.value)}
          placeholder="e.g. Tech Corp Sdn Bhd"
        />
        <Input
          label="Amount (RM) *"
          type="number"
          min={0}
          value={String(form.amount)}
          onChange={e => set('amount', parseFloat(e.target.value) || 0)}
          placeholder="0.00"
        />
        <Input
          label="Date *"
          type="date"
          value={form.date}
          onChange={e => set('date', e.target.value)}
        />
        <Textarea
          label="Description"
          value={form.description ?? ''}
          onChange={e => set('description', e.target.value)}
          placeholder="What did the sponsor support?"
          rows={3}
        />
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ---------- Main View ----------
export const SponsorshipView: React.FC<{ searchQuery?: string }> = ({ searchQuery: externalQuery }) => {
  const [activeTab, setActiveTab] = useState<'records' | 'by_sponsor' | 'analytics'>('records');
  const [localQuery, setLocalQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<SponsorshipRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SponsorshipRecord | null>(null);

  const { sponsorships, loading, error, createSponsorship, updateSponsorship, deleteSponsorship } = useSponsorships();
  const { isBoard, isAdmin } = usePermissions();
  const canManage = isBoard || isAdmin;

  const query = (externalQuery ?? localQuery).toLowerCase();

  // ---------- filtered records ----------
  const filtered = useMemo(() =>
    sponsorships.filter(s =>
      s.sponsorName.toLowerCase().includes(query) ||
      s.memberName.toLowerCase().includes(query) ||
      (s.description ?? '').toLowerCase().includes(query)
    ),
    [sponsorships, query]
  );

  // ---------- aggregated by sponsor ----------
  const bySponsor = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number; members: Set<string>; lastDate: string }>();
    for (const s of sponsorships) {
      const existing = map.get(s.sponsorName) ?? { name: s.sponsorName, total: 0, count: 0, members: new Set<string>(), lastDate: '' };
      existing.total += s.amount;
      existing.count += 1;
      existing.members.add(s.memberName);
      if (!existing.lastDate || s.date > existing.lastDate) existing.lastDate = s.date;
      map.set(s.sponsorName, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [sponsorships]);

  // ---------- top contributors ----------
  const byMember = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const s of sponsorships) {
      const existing = map.get(s.memberName) ?? { name: s.memberName, total: 0, count: 0 };
      existing.total += s.amount;
      existing.count += 1;
      map.set(s.memberName, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [sponsorships]);

  const totalAmount = useMemo(() => sponsorships.reduce((sum, s) => sum + s.amount, 0), [sponsorships]);

  // ---------- handlers ----------
  const handleSave = async (data: Omit<SponsorshipRecord, 'id'>, id?: string, prevMemberId?: string) => {
    if (id) {
      await updateSponsorship(id, data, prevMemberId);
    } else {
      await createSponsorship(data);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    await deleteSponsorship(confirmDelete.id, confirmDelete.memberId);
    setConfirmDelete(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading sponsorships…</p>
      </div>
    </div>
  );
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  const tabs = [
    { id: 'records', label: 'All Records' },
    { id: 'by_sponsor', label: 'By Sponsor' },
    { id: 'analytics', label: 'Analytics' },
  ] as const;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Handshake size={24} className="text-violet-500" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Sponsorships</h1>
        </div>
        {canManage && (
          <Button
            variant="primary"
            onClick={() => { setEditing(null); setIsModalOpen(true); }}
          >
            <Plus size={16} className="mr-1.5" /> Add Record
          </Button>
        )}
      </div>

      {/* Stats */}
      <StatCardsContainer>
        <StatCard title="Total Raised" value={formatCurrency(totalAmount)} icon={<DollarSign size={20} />} />
        <StatCard title="Unique Sponsors" value={String(bySponsor.length)} icon={<Building2 size={20} />} />
        <StatCard title="Records" value={String(sponsorships.length)} icon={<TrendingUp size={20} />} />
        <StatCard title="Members Contributing" value={String(byMember.length)} icon={<Users size={20} />} />
      </StatCardsContainer>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              activeTab === t.id
                ? 'border-b-2 border-violet-500 text-violet-600 dark:text-violet-400'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search bar (records tab only) */}
      {activeTab === 'records' && (
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search records…"
            value={localQuery}
            onChange={e => setLocalQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
      )}

      {/* ---- Records Tab ---- */}
      {activeTab === 'records' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-left">
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Sponsor</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Secured By</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Amount</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Date</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Description</th>
                {canManage && <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="px-4 py-10 text-center text-slate-400">
                    {query ? 'No matching records found.' : 'No sponsorship records yet.'}
                  </td>
                </tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center flex-shrink-0">
                        <Building2 size={14} className="text-violet-600 dark:text-violet-300" />
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white">{s.sponsorName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.memberName}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(s.amount)}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDateStr(s.date)}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">{s.description ?? '—'}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditing(s); setIsModalOpen(true); }}
                          className="p-1.5 text-slate-400 hover:text-violet-600 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(s)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- By Sponsor Tab ---- */}
      {activeTab === 'by_sponsor' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bySponsor.length === 0 ? (
            <p className="text-slate-400 col-span-2 text-center py-10">No sponsorship records yet.</p>
          ) : bySponsor.map(sp => (
            <Card key={sp.name} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-violet-600 dark:text-violet-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{sp.name}</p>
                    <p className="text-xs text-slate-500">{sp.count} record{sp.count !== 1 ? 's' : ''} · Last: {formatDateStr(sp.lastDate)}</p>
                  </div>
                </div>
                <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">{formatCurrency(sp.total)}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {Array.from(sp.members).map(m => (
                  <Badge key={m} variant="neutral">{m}</Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ---- Analytics Tab ---- */}
      {activeTab === 'analytics' && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalAmount)}</p>
              <p className="text-sm text-slate-500 mt-1">Total Raised</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-violet-600">{bySponsor.length}</p>
              <p className="text-sm text-slate-500 mt-1">Unique Sponsors</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {sponsorships.length > 0 ? formatCurrency(totalAmount / sponsorships.length) : 'RM 0.00'}
              </p>
              <p className="text-sm text-slate-500 mt-1">Avg per Record</p>
            </Card>
          </div>

          {/* Top contributors table */}
          <Card noPadding title="Top Member Contributors">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  <th className="px-4 py-2 text-left font-semibold text-slate-500">#</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-500">Member</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-500">Records</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-500">Total Secured</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {byMember.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No data</td></tr>
                ) : byMember.map((m, i) => (
                  <tr key={m.name} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-2.5 text-slate-400 font-medium">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{m.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{m.count}</td>
                    <td className="px-4 py-2.5 font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Add/Edit Modal */}
      <SponsorModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditing(null); }}
        initial={editing}
        onSave={handleSave}
      />

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Sponsorship Record"
        size="sm"
      >
        <p className="text-slate-600 dark:text-slate-300 mb-4">
          Delete <strong>{confirmDelete?.sponsorName}</strong> ({formatCurrency(confirmDelete?.amount ?? 0)}) secured by{' '}
          <strong>{confirmDelete?.memberName}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
};
