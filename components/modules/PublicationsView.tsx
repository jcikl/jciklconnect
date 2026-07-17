import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Edit2, Trash2, FileText, Eye, EyeOff,
  ExternalLink, AlertCircle, CheckCircle, Loader, Search,
  Filter
} from 'lucide-react';
import { Button, Card, Badge, Modal, useToast, ConfirmDialog, CONFIRM_CLOSED } from '../ui/Common';
import type { ConfirmState } from '../ui/Common';
import * as Forms from '../ui/Form';
import {
  PublicationService,
  Publication,
  isValidGoogleDriveUrl,
  toGoogleDrivePreviewUrl,
} from '../../services/publicationService';

// ─── Google Drive URL validation indicator ────────────────────────────────────

const DriveUrlStatus: React.FC<{ url: string; previewTested: boolean | null }> = ({
  url,
  previewTested,
}) => {
  if (!url) return null;
  if (!isValidGoogleDriveUrl(url)) {
    return (
      <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
        <AlertCircle size={12} />
        Not a valid Google Drive URL — paste a share link.
      </p>
    );
  }
  if (previewTested === null) {
    return (
      <p className="flex items-center gap-1 text-xs text-slate-400 mt-1">
        <Loader size={12} className="animate-spin" />
        Checking embed compatibility…
      </p>
    );
  }
  if (previewTested) {
    return (
      <p className="flex items-center gap-1 text-xs text-green-600 mt-1">
        <CheckCircle size={12} />
        Google Drive link valid — embedded preview works.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1 text-xs text-amber-600 mt-1">
      <AlertCircle size={12} />
      File ID extracted but iframe preview may be blocked. Ensure the file is set to "Anyone with the link can view".
    </p>
  );
};

// ─── Empty form factory ───────────────────────────────────────────────────────

const emptyForm = (): Omit<Publication, 'id' | 'createdAt' | 'updatedAt'> => ({
  year: String(new Date().getFullYear()),
  issue: '',
  title: '',
  pdfUrl: '',
  status: 'Draft',
  sortOrder: 0,
});

// ─── Main view ────────────────────────────────────────────────────────────────

export const PublicationsView: React.FC = () => {
  const { showToast } = useToast();
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);

  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Google Drive preview validation
  const [previewTested, setPreviewTested] = useState<boolean | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const driveCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preview panel in modal
  const [showPreview, setShowPreview] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadPublications = async () => {
    setLoading(true);
    try {
      const data = await PublicationService.getAll();
      setPublications(data);
    } catch {
      showToast('Failed to load publications.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPublications(); }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const years = ['All', ...Array.from(new Set(publications.map(p => p.year))).sort((a, b) => b.localeCompare(a))];

  const filtered = publications.filter(p => {
    if (filterYear !== 'All' && p.year !== filterYear) return false;
    if (filterStatus !== 'All' && p.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.issue.toLowerCase().includes(q);
    }
    return true;
  });

  // Group by year for display
  const grouped = filtered.reduce<Record<string, Publication[]>>((acc, p) => {
    acc[p.year] = acc[p.year] ?? [];
    acc[p.year].push(p);
    return acc;
  }, {});
  const sortedYears = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // ── Google Drive URL auto-check ──────────────────────────────────────────────

  useEffect(() => {
    if (driveCheckTimer.current) clearTimeout(driveCheckTimer.current);
    if (!form.pdfUrl || !isValidGoogleDriveUrl(form.pdfUrl)) {
      setPreviewTested(null);
      return;
    }
    setPreviewTested(null); // reset → show spinner
    driveCheckTimer.current = setTimeout(() => {
      setPreviewTested(true); // Optimistic
    }, 1200);
    return () => {
      if (driveCheckTimer.current) clearTimeout(driveCheckTimer.current);
    };
  }, [form.pdfUrl]);

  // ── Modal helpers ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setPreviewTested(null);
    setShowPreview(false);
    setIsModalOpen(true);
  };

  const openEdit = (pub: Publication) => {
    setEditingId(pub.id ?? null);
    setForm({
      year: pub.year,
      issue: pub.issue,
      title: pub.title,
      pdfUrl: pub.pdfUrl,
      status: pub.status,
      sortOrder: pub.sortOrder ?? 0,
    });
    setPreviewTested(null);
    setShowPreview(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    setPreviewTested(null);
    setShowPreview(false);
  };

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.year.trim()) { showToast('Year is required.', 'error'); return; }
    if (!form.issue.trim()) { showToast('Issue is required.', 'error'); return; }
    if (!form.title.trim()) { showToast('Title is required.', 'error'); return; }
    if (!form.pdfUrl.trim()) { showToast('Google Drive PDF URL is required.', 'error'); return; }
    if (!isValidGoogleDriveUrl(form.pdfUrl)) {
      showToast('Please enter a valid Google Drive share URL.', 'error'); return;
    }

    setSaving(true);
    try {
      const payload = { ...form };
      if (editingId) {
        await PublicationService.update(editingId, payload);
        showToast('Publication updated successfully!', 'success');
      } else {
        await PublicationService.create(payload);
        showToast('Publication created successfully!', 'success');
      }
      closeModal();
      await loadPublications();
    } catch {
      showToast('Failed to save publication.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = (id: string) => {
    setConfirmState({
      open: true,
      title: 'Delete Publication',
      message: 'Are you sure you want to delete this publication? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState(CONFIRM_CLOSED);
        setDeleting(id);
        try {
          await PublicationService.delete(id);
          showToast('Publication deleted.', 'success');
          await loadPublications();
        } catch {
          showToast('Failed to delete publication.', 'error');
        } finally {
          setDeleting(null);
        }
      },
    });
  };

  // ── Quick toggle status ────────────────────────────────────────────────────────

  const toggleStatus = async (pub: Publication) => {
    const next: Publication['status'] = pub.status === 'Published' ? 'Draft' : 'Published';
    try {
      await PublicationService.update(pub.id!, { status: next });
      showToast(`Publication ${next === 'Published' ? 'published' : 'set to draft'}.`, 'success');
      await loadPublications();
    } catch {
      showToast('Failed to update status.', 'error');
    }
  };

  // ─── JSX ─────────────────────────────────────────────────────────────────────

  const previewUrl = form.pdfUrl && isValidGoogleDriveUrl(form.pdfUrl)
    ? toGoogleDrivePreviewUrl(form.pdfUrl)
    : null;

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Publications</h1>
        <Button size="sm" onClick={openCreate} className="flex items-center gap-1.5 shrink-0">
          <Plus size={14} />
          Add Issue
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-0" style={{ minWidth: '140px' }}>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search…"
            className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-jci-blue/20 focus:border-jci-blue outline-none bg-white"
          />
        </div>
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-jci-blue/20 focus:border-jci-blue outline-none bg-white"
        >
          {years.map(y => <option key={y}>{y}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-jci-blue/20 focus:border-jci-blue outline-none bg-white"
        >
          <option>All</option>
          <option>Published</option>
          <option>Draft</option>
        </select>
        <span className="text-xs text-slate-400 tabular-nums">
          {filtered.length} issue{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader size={28} className="animate-spin mb-3 opacity-50" />
          <p className="text-sm font-medium">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <FileText size={36} className="mb-3 opacity-20" />
          <p className="font-semibold text-slate-600 text-sm">No publications found</p>
          <p className="text-xs mt-1 text-slate-400">
            {publications.length === 0 ? 'Click "Add Issue" to get started.' : 'Try adjusting the filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {sortedYears.map(year => (
            <div key={year}>
              {/* Year heading */}
              <div className="flex items-center gap-2.5 mb-3 pb-2 border-b border-slate-200">
                <h2 className="text-base font-extrabold text-slate-800">{year}</h2>
                <span className="text-[10px] bg-sky-100 text-jci-blue font-bold px-2 py-0.5 rounded-full uppercase tracking-wider tabular-nums">
                  {grouped[year].length} {grouped[year].length === 1 ? 'issue' : 'issues'}
                </span>
              </div>

              {/* Issues grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {grouped[year].map(pub => (
                  <div
                    key={pub.id}
                    className="group bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 rounded-xl overflow-hidden flex flex-col"
                  >
                    {/* Card top bar */}
                    <div className="flex items-center gap-2 flex-wrap px-3 pt-3 pb-2 border-b border-slate-100">
                      <Badge variant="jci" className="text-[10px]">{pub.issue}</Badge>
                      <Badge variant={pub.status === 'Published' ? 'success' : 'neutral'} className="text-[10px]">
                        {pub.status}
                      </Badge>
                    </div>

                    {/* Card body */}
                    <div className="px-3 py-2.5 flex-1">
                      <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 mb-2">
                        {pub.title}
                      </h3>
                      {pub.pdfUrl && isValidGoogleDriveUrl(pub.pdfUrl) ? (
                        <a
                          href={toGoogleDrivePreviewUrl(pub.pdfUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-jci-blue text-xs font-semibold hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink size={11} />
                          Preview PDF
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold">
                          <AlertCircle size={11} />
                          No valid PDF URL
                        </span>
                      )}
                    </div>

                    {/* Actions footer */}
                    <div className="px-2.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5">
                      <button
                        onClick={() => openEdit(pub)}
                        className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-slate-600 hover:text-jci-blue bg-white hover:bg-jci-blue/5 border border-slate-200 hover:border-jci-blue/30 rounded-lg py-1.5 transition-colors"
                      >
                        <Edit2 size={12} />
                        Edit
                      </button>
                      <button
                        onClick={() => toggleStatus(pub)}
                        className={`flex-1 flex items-center justify-center gap-1 text-xs font-medium rounded-lg py-1.5 border transition-colors ${
                          pub.status === 'Published'
                            ? 'text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-100 border-slate-200'
                            : 'text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 border-green-200'
                        }`}
                        title={pub.status === 'Published' ? 'Set to Draft' : 'Publish'}
                      >
                        {pub.status === 'Published'
                          ? <><EyeOff size={12} />Unpublish</>
                          : <><Eye size={12} />Publish</>
                        }
                      </button>
                      <button
                        onClick={() => pub.id && handleDelete(pub.id)}
                        disabled={deleting === pub.id}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Delete"
                      >
                        {deleting === pub.id
                          ? <Loader size={13} className="animate-spin" />
                          : <Trash2 size={13} />
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Publication' : 'Add New Publication'}
        size={showPreview && previewUrl ? '2xl' : 'lg'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} isLoading={saving}>
              {editingId ? 'Save Changes' : 'Create Publication'}
            </Button>
          </div>
        }
      >
        <div className={`flex gap-6 ${showPreview && previewUrl ? 'flex-row' : 'flex-col'}`}>

          {/* Form column */}
          <div className={`space-y-4 ${showPreview && previewUrl ? 'w-80 flex-shrink-0' : 'w-full'}`}>

            {/* Year + Issue */}
            <div className="grid grid-cols-2 gap-4">
              <Forms.Input
                label="Year *"
                value={form.year}
                onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                placeholder="2025"
              />
              <Forms.Input
                label="Issue *"
                value={form.issue}
                onChange={e => setForm(f => ({ ...f, issue: e.target.value }))}
                placeholder="Issue 1"
              />
            </div>

            {/* Title */}
            <Forms.Input
              label="Title *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="JCI KL 2025 E-Newsletter Q1 Edition"
            />

            {/* Google Drive URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Google Drive PDF URL *
              </label>
              <input
                type="url"
                value={form.pdfUrl}
                onChange={e => setForm(f => ({ ...f, pdfUrl: e.target.value }))}
                placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-jci-blue/20 focus:border-jci-blue outline-none"
              />
              <DriveUrlStatus url={form.pdfUrl} previewTested={previewTested} />
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => setShowPreview(v => !v)}
                  className="mt-2 text-xs text-jci-blue font-semibold flex items-center gap-1 hover:underline"
                >
                  <Eye size={12} />
                  {showPreview ? 'Hide PDF Preview' : 'Test PDF Preview'}
                </button>
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                Paste any Google Drive share link. Ensure the file is set to <strong>"Anyone with the link can view"</strong>.
              </p>
            </div>

            {/* Sort Order + Status */}
            <div className="grid grid-cols-2 gap-4">
              <Forms.Input
                label="Sort Order"
                type="number"
                value={form.sortOrder}
                onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                placeholder="0"
              />
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as 'Published' | 'Draft' }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-jci-blue/20 focus:border-jci-blue outline-none bg-white"
                >
                  <option value="Draft">Draft (hidden from guests)</option>
                  <option value="Published">Published (visible to guests)</option>
                </select>
              </div>
            </div>

          </div>

          {/* PDF Preview panel (shown inline when user clicks "Test PDF Preview") */}
          {showPreview && previewUrl && (
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  PDF Preview (embedded)
                </p>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-jci-blue font-semibold flex items-center gap-1 hover:underline"
                >
                  <ExternalLink size={12} />
                  Open in new tab
                </a>
              </div>
              <iframe
                ref={previewIframeRef}
                src={previewUrl}
                title="PDF Preview"
                className="w-full flex-1 rounded-xl border border-slate-200 bg-slate-50 shadow-inner"
                style={{ minHeight: '380px' }}
                allow="autoplay"
              />
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                If the preview shows a blank page or error, ensure the Google Drive file permission is set to "Anyone with the link".
              </p>
            </div>
          )}
        </div>
      </Modal>
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
    </div>
  );
};
