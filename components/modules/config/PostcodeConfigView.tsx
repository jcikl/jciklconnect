import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Pencil, Search, Upload, X, Check, MapPin } from 'lucide-react';
import { Button, Badge, useToast, Modal, Spinner } from '../../ui/Common';
import { Input, Select } from '../../ui/Form';
import { PostcodeService, PostcodeEntry, PostcodeType } from '../../../services/postcodeService';
import { getSeedEntries } from '../../../utils/myPostcodes';

const TYPE_LABELS: Record<PostcodeType, string> = {
  exact: 'Exact',
  range: 'Range',
  keyword: 'Keyword',
};

const TYPE_COLORS: Record<PostcodeType, 'neutral' | 'info' | 'warning'> = {
  exact: 'neutral',
  range: 'info',
  keyword: 'warning',
};

const STATES = [
  'Kuala Lumpur', 'Selangor', 'Putrajaya', 'Johor', 'Kedah', 'Kelantan',
  'Melaka', 'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis',
  'Sabah', 'Sarawak', 'Terengganu', 'Labuan',
];

const EMPTY_ENTRY: Omit<PostcodeEntry, 'id'> & { id: string } = {
  id: '', postcode: '', area: '', state: 'Kuala Lumpur', type: 'exact',
};

export const PostcodeConfigView: React.FC = () => {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<PostcodeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PostcodeType | 'all'>('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PostcodeEntry | null>(null);
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState<{ done: number; total: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PostcodeEntry | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setEntries(await PostcodeService.getAll());
    } catch {
      showToast('Failed to load postcodes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (stateFilter !== 'all' && e.state !== stateFilter) return false;
      if (!q) return true;
      return (
        e.postcode?.includes(q) ||
        e.area.toLowerCase().includes(q) ||
        e.state.toLowerCase().includes(q) ||
        e.pattern?.toLowerCase().includes(q)
      );
    });
  }, [entries, search, typeFilter, stateFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_ENTRY);
    setShowModal(true);
  };

  const openEdit = (e: PostcodeEntry) => {
    setEditing(e);
    setForm({ ...e });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.area.trim() || !form.state.trim()) return showToast('Area and State are required', 'error');
    if (form.type === 'exact' && !form.postcode?.match(/^\d{5}$/)) return showToast('Exact type requires a valid 5-digit postcode', 'error');
    if (form.type === 'range' && (form.minPrefix == null || form.maxPrefix == null)) return showToast('Range type requires min and max prefix', 'error');
    if (form.type === 'keyword' && !form.pattern?.trim()) return showToast('Keyword type requires a regex pattern', 'error');

    const id = form.type === 'exact'
      ? form.postcode!
      : form.type === 'range'
        ? `range_${form.minPrefix}_${form.maxPrefix}`
        : editing?.id || `kw_${Date.now()}`;

    setSaving(true);
    try {
      await PostcodeService.upsert({ ...form, id });
      showToast(editing ? 'Updated' : 'Added', 'success');
      setShowModal(false);
      await load();
    } catch {
      showToast('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: PostcodeEntry) => {
    try {
      await PostcodeService.deleteEntry(e.id);
      showToast('Deleted', 'success');
      setDeleteTarget(null);
      await load();
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedProgress({ done: 0, total: 0 });
    try {
      const total = await PostcodeService.seed((done, t) => setSeedProgress({ done, total: t }));
      showToast(`Seeded ${total} entries`, 'success');
      await load();
    } catch {
      showToast('Seed failed', 'error');
    } finally {
      setSeeding(false);
      setSeedProgress(null);
    }
  };

  const counts = useMemo(() => ({
    exact: entries.filter(e => e.type === 'exact').length,
    range: entries.filter(e => e.type === 'range').length,
    keyword: entries.filter(e => e.type === 'keyword').length,
  }), [entries]);

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        {(['exact', 'range', 'keyword'] as PostcodeType[]).map(t => (
          <div key={t} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{counts[t]}</p>
            <p className="text-xs text-slate-500 uppercase mt-0.5">{TYPE_LABELS[t]}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search postcode, area, state…"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-jci-blue outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as PostcodeType | 'all')}
          className="text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
        >
          <option value="all">All types</option>
          <option value="exact">Exact</option>
          <option value="range">Range</option>
          <option value="keyword">Keyword</option>
        </select>
        <select
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          className="text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
        >
          <option value="all">All states</option>
          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex gap-2 ml-auto">
          <Button size="sm" variant="secondary" onClick={handleSeed} disabled={seeding}>
            <Upload size={13} className="mr-1" />
            {seeding ? `Seeding ${seedProgress?.done ?? 0}/${seedProgress?.total ?? '…'}` : 'Seed from static'}
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus size={13} className="mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <MapPin size={32} className="mx-auto mb-2 opacity-30" />
          <p className="font-medium">{entries.length === 0 ? 'No postcodes yet' : 'No results'}</p>
          <p className="text-sm mt-1">{entries.length === 0 ? 'Click "Seed from static" to import the built-in Malaysian postcode database.' : 'Try adjusting your filters.'}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Identifier</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Area</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">State</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-2.5">
                      <Badge variant={TYPE_COLORS[e.type]}>{TYPE_LABELS[e.type]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {e.type === 'exact' && e.postcode}
                      {e.type === 'range' && `${e.minPrefix}xx – ${e.maxPrefix}xx`}
                      {e.type === 'keyword' && <span className="italic">{e.pattern}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">{e.area}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{e.state}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-jci-blue transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleteTarget(e)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400">
            Showing {filtered.length} of {entries.length} entries
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Entry' : 'Add Postcode Entry'}
      >
        <div className="space-y-4 p-4">
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
            <Select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as PostcodeType }))}
              options={[
                { value: 'exact', label: 'Exact — 5-digit postcode' },
                { value: 'range', label: 'Range — prefix range' },
                { value: 'keyword', label: 'Keyword — regex pattern' },
              ]}
            />
          </div>

          {form.type === 'exact' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Postcode (5 digits)</label>
              <Input value={form.postcode ?? ''} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} placeholder="e.g. 50000" maxLength={5} />
            </div>
          )}

          {form.type === 'range' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Min prefix</label>
                <Input type="number" value={form.minPrefix ?? ''} onChange={e => setForm(f => ({ ...f, minPrefix: parseInt(e.target.value) || undefined }))} placeholder="e.g. 50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Max prefix</label>
                <Input type="number" value={form.maxPrefix ?? ''} onChange={e => setForm(f => ({ ...f, maxPrefix: parseInt(e.target.value) || undefined }))} placeholder="e.g. 60" />
              </div>
            </div>
          )}

          {form.type === 'keyword' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Regex pattern <span className="font-normal text-slate-400">(case-insensitive, e.g. \bbangsar\b)</span></label>
              <Input value={form.pattern ?? ''} onChange={e => setForm(f => ({ ...f, pattern: e.target.value }))} placeholder="e.g. \bbangsar\b" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Area</label>
            <Input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="e.g. Bangsar" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
            <Select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} options={STATES.map(s => ({ value: s, label: s }))} />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : <><Check size={13} className="mr-1" /> Save</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Entry">
        <div className="p-4 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Delete <span className="font-mono font-bold">{deleteTarget?.id}</span>
            {' '}({deleteTarget?.area}, {deleteTarget?.state})?
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              <Trash2 size={13} className="mr-1" /> Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
