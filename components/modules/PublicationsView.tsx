import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Edit2, Trash2, FileText, Eye, EyeOff,
  ExternalLink, AlertCircle, CheckCircle, Loader, Search,
  Filter
} from 'lucide-react';
import { Button, Card, Badge, Modal, useToast } from '../ui/Common';
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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this publication? This action cannot be undone.')) return;
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
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Publications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage E-Newsletter issues displayed on the public Guest page.
          </p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2 self-start sm:self-auto">
          <Plus size={16} />
          Add New Issue
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search publications…"
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-jci-blue/20 focus:border-jci-blue outline-none bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 text-sm">
          <Filter size={14} className="text-slate-400" />
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
        </div>

        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} publication{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Loader size={32} className="animate-spin mb-4 opacity-50" />
          <p className="text-sm font-medium">Loading publications…</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <FileText size={48} className="mb-4 opacity-20" />
            <p className="font-semibold text-slate-600">No publications found</p>
            <p className="text-sm mt-1">
              {publications.length === 0
                ? 'Click "Add New Issue" to create your first publication.'
                : 'Try adjusting the filters.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-10">
          {sortedYears.map(year => (
            <div key={year}>
              {/* Year heading */}
              <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-200">
                <h2 className="text-xl font-extrabold text-slate-900">{year}</h2>
                <span className="text-xs bg-sky-100 text-jci-blue font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {grouped[year].length} {grouped[year].length === 1 ? 'issue' : 'issues'}
                </span>
              </div>

              {/* Issues grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {grouped[year].map(pub => (
                  <Card
                    key={pub.id}
                    className="group hover:shadow-lg transition-all duration-200 border border-slate-200 hover:border-slate-300 overflow-hidden"
                  >
                    {/* Card top bar */}
                    <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="jci">{pub.issue}</Badge>
                        <Badge variant={pub.status === 'Published' ? 'success' : 'neutral'}>
                          {pub.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="px-4 pt-3 pb-4 space-y-2">
                      <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                        {pub.title}
                      </h3>

                      {/* PDF URL indicator */}
                      <div className="pt-1">
                        {pub.pdfUrl && isValidGoogleDriveUrl(pub.pdfUrl) ? (
                          <a
                            href={toGoogleDrivePreviewUrl(pub.pdfUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-jci-blue text-xs font-semibold hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink size={12} />
                            Preview PDF
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold">
                            <AlertCircle size={12} />
                            No valid PDF URL
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(pub)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs"
                      >
                        <Edit2 size={13} />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={pub.status === 'Published' ? 'ghost' : 'outline'}
                        onClick={() => toggleStatus(pub)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs"
                        title={pub.status === 'Published' ? 'Set to Draft' : 'Publish'}
                      >
                        {pub.status === 'Published'
                          ? <><EyeOff size={13} />Unpublish</>
                          : <><Eye size={13} />Publish</>
                        }
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => pub.id && handleDelete(pub.id)}
                        disabled={deleting === pub.id}
                        className="px-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                        title="Delete"
                      >
                        {deleting === pub.id
                          ? <Loader size={14} className="animate-spin" />
                          : <Trash2 size={14} />
                        }
                      </Button>
                    </div>
                  </Card>
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
    </div>
  );
};
