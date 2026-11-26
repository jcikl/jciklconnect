import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, FileText, Download, Award, PlayCircle, Plus, Edit, Trash2, GraduationCap, CheckCircle, Clock, GitBranch, Eye, Search, Filter, X, Share2, ArrowUpRight, MoreHorizontal, ArrowLeft, Folder, ChevronRight } from 'lucide-react';
import { Card, Button, ProgressBar, Badge, Tabs, Modal, Drawer, Skeleton, useToast, ConfirmDialog, CONFIRM_CLOSED } from '../ui/Common';
import type { ConfirmState } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useKnowledge } from '../../hooks/useKnowledge';
import { useLearningPaths } from '../../hooks/useLearningPaths';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { LearningPathsService, LearningPath, LearningProgress } from '../../services/learningPathsService';
import { DocumentsService, DocumentWithVersions, DocumentVersion } from '../../services/documentsService';
import { formatDate } from '../../utils/dateUtils';
import { formatFileSize } from '../../utils/formatUtils';
import './KnowledgeDocuments.css';

export const KnowledgeView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
    const [activeTab, setActiveTab] = useState<'learning' | 'documents'>('learning');

    const [isPathModalOpen, setIsPathModalOpen] = useState(false);
    const [editingPathId, setEditingPathId] = useState<string | null>(null);
    const [pathForm, setPathForm] = useState({
        name: '',
        description: '',
        category: 'Leadership' as LearningPath['category'],
        estimatedDuration: 1,
        difficulty: 'Foundation' as LearningPath['difficulty'],
        status: 'Active' as LearningPath['status'],
        materials: [''] as string[],
    });
    const [isSubmittingPath, setIsSubmittingPath] = useState(false);
    const [isDocUploadOpen, setIsDocUploadOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<DocumentWithVersions | null>(null);
    const [docForm, setDocForm] = useState({ name: '', purpose: '', fileUrl: '' });
    const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const { trainingModules, documents, loading, error, reloadDocs } = useKnowledge();
    // Note: documents from useKnowledge may not have version info, we'll handle that in the component
    const { paths, loading: pathsLoading, error: pathsError, createPath, updatePath, deletePath } = useLearningPaths();
    const { member } = useAuth();
    const { isBoard, isAdmin } = usePermissions();
    const { showToast } = useToast();

    const filteredPaths = useMemo(() => {
        let filtered = paths || [];
        const term = (searchQuery || searchTerm).toLowerCase();

        if (term.trim()) {
            filtered = filtered.filter(path =>
                path.name.toLowerCase().includes(term) ||
                path.description?.toLowerCase().includes(term) ||
                path.category?.toLowerCase().includes(term)
            );
        }

        return filtered;
    }, [paths, searchTerm, searchQuery]);

    return (
        <>
        <div className="space-y-6">
            <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">Knowledge & Learning</h2>
                <p className="text-sm text-slate-500 mt-0.5">Training resources and document archives.</p>
            </div>

            <div>
                <div className="mb-4">
                    <Tabs
                        tabs={[{id: 'learning', label: 'Learning Paths'}, {id: 'documents', label: 'Documents'}]}
                        activeTab={activeTab}
                        onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
                    />
                </div>
                <div>
                    {activeTab === 'learning' && (
                        <LearningPathsTab
                            paths={filteredPaths}
                            loading={pathsLoading}
                            error={pathsError}
                            canManage={isBoard || isAdmin}
                            onDelete={deletePath}
                            onAdd={isBoard || isAdmin ? () => { setEditingPathId(null); setIsPathModalOpen(true); } : undefined}
                            onEdit={isBoard || isAdmin ? (path) => {
                                setEditingPathId(path.id!);
                                setPathForm({ name: path.name, description: path.description, category: path.category, estimatedDuration: path.estimatedDuration, difficulty: path.difficulty, status: path.status, materials: path.materials?.length ? path.materials : [''] });
                                setIsPathModalOpen(true);
                            } : undefined}
                        />
                    )}
                    {activeTab === 'documents' && (
                        <DocumentsTab
                            documents={documents}
                            searchQuery={searchQuery}
                            loading={loading}
                            error={error}
                            canManage={isBoard || isAdmin}
                            onAdd={isBoard || isAdmin ? () => setIsDocUploadOpen(true) : undefined}
                            onRefresh={reloadDocs}
                        />
                    )}
                </div>
            </div>

            {/* New Learning Path Modal */}
            <Modal
                isOpen={isPathModalOpen}
                onClose={() => { setIsPathModalOpen(false); setEditingPathId(null); setPathForm({ name: '', description: '', category: 'Leadership', estimatedDuration: 1, difficulty: 'Foundation', status: 'Active', materials: [''] }); }}
                title={editingPathId ? 'Edit Learning Path' : 'New Learning Path'}
                size="lg"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
                        <Input value={pathForm.name} onChange={e => setPathForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Leadership Fundamentals" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                        <Textarea value={pathForm.description} onChange={e => setPathForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe what members will learn..." rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                            <Select
                                value={pathForm.category}
                                onChange={e => setPathForm(f => ({ ...f, category: e.target.value as LearningPath['category'] }))}
                                options={[
                                    { label: 'JCI Official', value: 'JCI Official' },
                                    { label: 'Leadership', value: 'Leadership' },
                                    { label: 'Business', value: 'Business' },
                                    { label: 'Personal Development', value: 'Personal Development' },
                                    { label: 'Technical', value: 'Technical' },
                                ]}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty</label>
                            <Select
                                value={pathForm.difficulty}
                                onChange={e => setPathForm(f => ({ ...f, difficulty: e.target.value as LearningPath['difficulty'] }))}
                                options={[
                                    { label: 'Foundation', value: 'Foundation' },
                                    { label: 'Intermediate', value: 'Intermediate' },
                                    { label: 'Advance', value: 'Advance' },
                                ]}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Est. Duration (hours)</label>
                            <Input type="number" min={1} value={pathForm.estimatedDuration} onChange={e => setPathForm(f => ({ ...f, estimatedDuration: Number(e.target.value) }))} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                            <Select
                                value={pathForm.status}
                                onChange={e => setPathForm(f => ({ ...f, status: e.target.value as LearningPath['status'] }))}
                                options={[
                                    { label: 'Active', value: 'Active' },
                                    { label: 'Draft', value: 'Draft' },
                                ]}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Materials (URLs)</label>
                        <div className="space-y-2">
                            {pathForm.materials.map((url, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <Input
                                        type="url"
                                        placeholder={`Material ${idx + 1} URL (e.g. https://docs.google.com/...)`}
                                        value={url}
                                        onChange={e => setPathForm(f => { const m = [...f.materials]; m[idx] = e.target.value; return { ...f, materials: m }; })}
                                        className="flex-1"
                                    />
                                    {pathForm.materials.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setPathForm(f => ({ ...f, materials: f.materials.filter((_, i) => i !== idx) }))}
                                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => setPathForm(f => ({ ...f, materials: [...f.materials, ''] }))}
                                className="flex items-center gap-1 text-sm text-jci-blue hover:text-sky-600 transition-colors"
                            >
                                <Plus size={14} /> Add another URL
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                        <Button variant="outline" onClick={() => setIsPathModalOpen(false)} disabled={isSubmittingPath}>Cancel</Button>
                        <Button
                            disabled={!pathForm.name.trim() || isSubmittingPath}
                            onClick={async () => {
                                if (!pathForm.name.trim()) return;
                                setIsSubmittingPath(true);
                                try {
                                    const materials = pathForm.materials.filter(u => u.trim());
                                    if (editingPathId) {
                                        await updatePath(editingPathId, { ...pathForm, materials });
                                    } else {
                                        await createPath({ ...pathForm, modules: [], prerequisites: [], materials, pointsReward: 0 });
                                    }
                                    setIsPathModalOpen(false);
                                    setEditingPathId(null);
                                    setPathForm({ name: '', description: '', category: 'Leadership', estimatedDuration: 1, difficulty: 'Foundation', status: 'Active', materials: [''] });
                                } catch {
                                    // error toast handled by hook
                                } finally {
                                    setIsSubmittingPath(false);
                                }
                            }}
                        >
                            {isSubmittingPath ? (editingPathId ? 'Saving...' : 'Creating...') : (editingPathId ? 'Save' : 'Create')}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Upload / Edit Document Modal */}
            <Modal
                isOpen={isDocUploadOpen}
                onClose={() => { setIsDocUploadOpen(false); setEditingDoc(null); setDocForm({ name: '', purpose: '', fileUrl: '' }); }}
                title={editingDoc ? 'Edit Document' : 'Add file link'}
                size="md"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Document Name *</label>
                        <Input value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Meeting Minutes – Aug 2026" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                        <Input value={docForm.purpose} onChange={e => setDocForm(f => ({ ...f, purpose: e.target.value }))} placeholder="e.g. New Member Onboarding, Board Reference, Event Planning" />
                        <div className="flex flex-wrap gap-2 mt-2">{[...new Set(documents.map(doc => doc.purpose?.trim()).filter(Boolean))].sort().map(purpose => <button key={purpose} type="button" className="text-xs text-jci-blue hover:underline" onClick={() => setDocForm(f => ({ ...f, purpose: purpose! }))}>{purpose}</button>)}</div>
                        <p className="text-xs text-slate-400 mt-1">Members will use this to find the right document quickly.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">File URL *</label>
                        <Input value={docForm.fileUrl} onChange={e => setDocForm(f => ({ ...f, fileUrl: e.target.value }))} placeholder="https://drive.google.com/..." />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => { setIsDocUploadOpen(false); setEditingDoc(null); setDocForm({ name: '', purpose: '', fileUrl: '' }); }}>Cancel</Button>
                        <Button variant="primary" disabled={!docForm.name.trim() || !docForm.fileUrl.trim() || isSubmittingDoc}
                            onClick={async () => {
                                try {
                                    const url = new URL(docForm.fileUrl.trim());
                                    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
                                } catch { showToast('Enter a valid HTTP or HTTPS file link', 'error'); return; }
                                setIsSubmittingDoc(true);
                                try {
                                    if (editingDoc) {
                                        await DocumentsService.updateDocument(editingDoc.id, { name: docForm.name.trim(), purpose: docForm.purpose.trim() || undefined });
                                        showToast('Document updated successfully', 'success');
                                    } else {
                                        const url = docForm.fileUrl.trim();
                                        const guessedName = url.split('/').pop()?.split('?')[0] || docForm.name.trim();
                                        await DocumentsService.createDocument(
                                            { name: docForm.name.trim(), purpose: docForm.purpose.trim() || undefined, loId: (member as any)?.loId ?? 'default', uploadedBy: member?.id ?? '', uploadedDate: new Date(), tags: [] },
                                            url, guessedName, 0, 'application/octet-stream', member?.id ?? ''
                                        );
                                        showToast('File link added successfully', 'success');
                                    }
                                    setIsDocUploadOpen(false);
                                    setEditingDoc(null);
                                    setDocForm({ name: '', purpose: '', fileUrl: '' });
                                    reloadDocs();
                                } catch {
                                    showToast(editingDoc ? 'Failed to update document' : 'Failed to add file link', 'error');
                                } finally {
                                    setIsSubmittingDoc(false);
                                }
                            }}
                        >
                            {isSubmittingDoc ? 'Saving...' : (editingDoc ? 'Save' : 'Add link')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
        </>
    );
};

interface LearningPathsTabProps {
    paths: LearningPath[];
    loading: boolean;
    error?: string | null;
    canManage: boolean;
    onDelete: (pathId: string) => Promise<void>;
    onAdd?: () => void;
    onEdit?: (path: LearningPath) => void;
}

const LearningPathsTab: React.FC<LearningPathsTabProps> = ({
    paths,
    loading,
    error,
    canManage,
    onDelete,
    onAdd,
    onEdit,
}) => {
    const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
    const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);

    const categoryGradient: Record<string, string> = {
        Leadership: 'from-blue-400 to-blue-600',
        Development: 'from-violet-400 to-violet-600',
        Communication: 'from-emerald-400 to-emerald-600',
        Finance: 'from-amber-400 to-amber-500',
        Ethics: 'from-rose-400 to-rose-600',
    };

    const addCard = onAdd ? (
        <div
            onClick={onAdd}
            className="border-2 border-dashed border-slate-200 rounded-xl p-3 flex items-center gap-3 text-slate-400 hover:border-jci-blue hover:text-jci-blue hover:bg-sky-50 transition-colors cursor-pointer"
        >
            <div className="w-9 h-9 rounded-lg border-2 border-dashed border-current flex items-center justify-center shrink-0">
                <Plus size={16} />
            </div>
            <div>
                <p className="text-sm font-semibold">New Learning Path</p>
                <p className="text-xs">add a self-study resource</p>
            </div>
        </div>
    ) : null;

    return (
        <>
        <LoadingState loading={loading} error={error ?? null} empty={false} emptyMessage="No learning paths available">
            <div className="space-y-2">
                {addCard}
                {paths.map(path => {
                    const gradient = categoryGradient[path.category ?? ''] ?? 'from-slate-400 to-slate-600';
                    return (
                        <div key={path.id} className="bg-white border rounded-2xl overflow-hidden transition-all border-slate-100 hover:border-slate-200 hover:shadow-sm cursor-pointer" onClick={() => setSelectedPath(path)}>
                            {/* Row 1: badges */}
                            <div className="flex items-center gap-1 px-3 pt-3 pb-1.5 flex-wrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">{path.category}</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${path.difficulty === 'Advance' ? 'bg-red-100 text-red-700' : path.difficulty === 'Intermediate' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{path.difficulty}</span>
                                {path.status === 'Draft' && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/20">Draft</span>}
                            </div>
                            {/* Row 2: icon | name */}
                            <div className="flex items-center gap-3 px-3 pb-3 pt-0">
                                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                                    <BookOpen size={16} className="text-white" strokeWidth={2} />
                                </div>
                                <p className="flex-1 min-w-0 font-semibold text-slate-900 text-sm leading-tight line-clamp-1">{path.name}</p>
                            </div>

                        </div>
                    );
                })}
            </div>
        </LoadingState>
        <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />

        {/* Path detail drawer */}
        {selectedPath && (() => {
            const p = selectedPath;
            const gradient = categoryGradient[p.category ?? ''] ?? 'from-slate-400 to-slate-600';
            const hostname = (url: string) => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } };
            return (
                <Drawer isOpen={!!selectedPath} onClose={() => setSelectedPath(null)} title={p.name} position="bottom">
                    <div className="space-y-4">
                        {/* Banner */}
                        <div className={`rounded-xl bg-gradient-to-br ${gradient} px-4 py-3 flex items-center gap-3`}>
                            <BookOpen size={20} className="text-white shrink-0" />
                            <div>
                                <p className="text-white font-semibold text-sm leading-tight">{p.name}</p>
                                <p className="text-white/70 text-xs mt-0.5">{p.category}</p>
                            </div>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${p.difficulty === 'Advance' ? 'bg-red-100 text-red-700' : p.difficulty === 'Intermediate' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{p.difficulty}</span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600">
                                <Clock size={11} />{p.estimatedDuration} hr{p.estimatedDuration !== 1 ? 's' : ''}
                            </span>
                            {p.status === 'Draft' && <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700">Draft</span>}
                        </div>

                        {/* Description */}
                        {p.description && (
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</p>
                                <p className="text-sm text-slate-600 leading-relaxed">{p.description}</p>
                            </div>
                        )}

                        {/* Materials */}
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Materials</p>
                            {p.materials && p.materials.length > 0 ? (
                                <div className="space-y-2">
                                    {p.materials.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-sm text-jci-blue hover:text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-xl px-3 py-2.5 transition-colors"
                                        >
                                            <Eye size={14} className="shrink-0" />
                                            <span className="truncate">{hostname(url)}</span>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No materials available</p>
                            )}
                        </div>

                        {/* Manage actions */}
                        {canManage && (
                            <div className="flex gap-2 pt-1">
                                {onEdit && (
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedPath(null); onEdit(p); }}>
                                        <Edit size={14} className="mr-1.5" />Edit
                                    </Button>
                                )}
                                <Button variant="danger" size="sm" className="flex-1" onClick={() => { setConfirmState({ open: true, title: 'Delete Learning Path', message: 'Are you sure you want to delete this learning path?', variant: 'danger', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); setSelectedPath(null); await onDelete(p.id!); } }); }}>
                                    <Trash2 size={14} className="mr-1.5" />Delete
                                </Button>
                            </div>
                        )}
                    </div>
                </Drawer>
            );
        })()}
        </>
    );
};

interface DocumentsTabProps {
    documents: any[];
    searchQuery?: string;
    loading: boolean;
    error?: string | null;
    canManage: boolean;
    onAdd?: () => void;
    onRefresh?: () => Promise<void>;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ documents, searchQuery, loading, error, canManage, onAdd, onRefresh }) => {
    const { member } = useAuth();
    const { showToast } = useToast();
    const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
    const documentLink = (doc: any): string | null => {
        try {
            const url = new URL(doc.currentVersion?.fileUrl || '');
            return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
        } catch { return null; }
    };
    const visibleDocuments = documents.filter(doc => {
        const name = (doc.name || '').toLowerCase();
        return [category ? query : '', searchQuery || ''].every(term => name.includes(term.trim().toLowerCase()))
            && (!category || (doc.purpose?.trim() || 'General') === category);
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const selectedDocument = category ? visibleDocuments.find(doc => doc.id === selectedDocumentId) : undefined;
    // inline add within drawer
    const [inlineAdd, setInlineAdd] = useState({ name: '', fileUrl: '' });
    const [isAddingDoc, setIsAddingDoc] = useState(false);
    const [showCategoryAdd, setShowCategoryAdd] = useState(false);
    const [mobileDrawer, setMobileDrawer] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
    useEffect(() => {
        const media = window.matchMedia('(max-width: 767px)');
        const update = () => setMobileDrawer(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);
    // A file editor is separate from the category manager.
    const [editingDocId, setEditingDocId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', purpose: '', fileUrl: '' });
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
    // edit purpose name (rename)
    const [isEditingPurpose, setIsEditingPurpose] = useState(false);
    const [newPurposeName, setNewPurposeName] = useState('');
    const [isSavingPurpose, setIsSavingPurpose] = useState(false);
    // confirm dialog
    const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);

    const grouped = useMemo(() => {
        const map = new Map<string, typeof documents>();
        documents.forEach(doc => {
            const key = doc.purpose?.trim() || 'General';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(doc);
        });
        return Array.from(map.entries()).sort(([a], [b]) => {
            if (a === 'General') return 1;
            if (b === 'General') return -1;
            return a.localeCompare(b);
        });
    }, [documents]);

    const drawerDocs = selectedPurpose ? (grouped.find(([p]) => p === selectedPurpose)?.[1] ?? []) : [];

    const openEdit = (doc: any) => {
        if (!canManage) return;
        setSelectedPurpose(null);
        setSelectedDocumentId(null);
        setEditingDocId(doc.id);
        setEditForm({ name: doc.name ?? '', purpose: doc.purpose ?? '', fileUrl: doc.currentVersion?.fileUrl ?? '' });
    };

    const handleSaveEdit = async (doc: any) => {
        if (!canManage || !editForm.name.trim() || isSubmittingEdit) return;
        const newUrl = editForm.fileUrl.trim();
        if (doc.currentVersion?.id && !documentLink({ currentVersion: { fileUrl: newUrl } })) {
            showToast('Enter a valid HTTP or HTTPS file link', 'error');
            return;
        }
        setIsSubmittingEdit(true);
        try {
            await DocumentsService.updateDocument(doc.id, {
                name: editForm.name.trim(),
                purpose: editForm.purpose.trim() || undefined,
            });
            if (doc.currentVersion?.id && newUrl && newUrl !== doc.currentVersion.fileUrl) {
                await DocumentsService.updateVersionUrl(doc.currentVersion.id, doc.id, newUrl);
            }
            showToast('Document updated', 'success');
            setEditingDocId(null);
            onRefresh?.();
        } catch {
            showToast('Failed to update document', 'error');
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    const handleDeleteDoc = (doc: any) => {
        setConfirmState({
            open: true,
            title: 'Delete Document',
            message: `Delete "${doc.name}"? This cannot be undone.`,
            variant: 'danger',
            onConfirm: async () => {
                setConfirmState(CONFIRM_CLOSED);
                try {
                    await DocumentsService.deleteDocument(doc.id);
                    showToast('Document deleted', 'success');
                    onRefresh?.();
                } catch {
                    showToast('Failed to delete document', 'error');
                }
            },
        });
    };

    const handleAddToDrawer = async () => {
        if (!canManage || !inlineAdd.name.trim() || !inlineAdd.fileUrl.trim() || isAddingDoc) return;
        if (!documentLink({ currentVersion: { fileUrl: inlineAdd.fileUrl.trim() } })) {
            showToast('Enter a valid HTTP or HTTPS file link', 'error');
            return;
        }
        setIsAddingDoc(true);
        try {
            const url = inlineAdd.fileUrl.trim();
            const guessedName = url.split('/').pop()?.split('?')[0] || inlineAdd.name.trim();
            await DocumentsService.createDocument(
                { name: inlineAdd.name.trim(), purpose: selectedPurpose ?? undefined, loId: (member as any)?.loId ?? 'default', uploadedBy: member?.id ?? '', uploadedDate: new Date(), tags: [] },
                url, guessedName, 0, 'application/octet-stream', member?.id ?? ''
            );
            showToast('Document added', 'success');
            setInlineAdd({ name: '', fileUrl: '' });
            setShowCategoryAdd(false);
            onRefresh?.();
        } catch {
            showToast('Failed to add document', 'error');
        } finally {
            setIsAddingDoc(false);
        }
    };

    const handleDownloadAll = () => {
        drawerDocs.forEach((doc: any) => {
            const url = documentLink(doc);
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
        });
    };

    const handleSavePurpose = async () => {
        if (!newPurposeName.trim() || !selectedPurpose) return;
        setIsSavingPurpose(true);
        try {
            await Promise.all(
                drawerDocs.map((doc: any) =>
                    DocumentsService.updateDocument(doc.id, { purpose: newPurposeName.trim() } as any)
                )
            );
            showToast('Category renamed', 'success');
            setCategory(value => value === selectedPurpose ? newPurposeName.trim() : value);
            setSelectedPurpose(newPurposeName.trim());
            setIsEditingPurpose(false);
            onRefresh?.();
        } catch {
            showToast('Failed to rename purpose', 'error');
        } finally {
            setIsSavingPurpose(false);
        }
    };

    const handleDeletePurpose = () => {
        setConfirmState({
            open: true,
            title: 'Delete category and files?',
            message: `Permanently delete all ${drawerDocs.length} file record(s) and their versions in "${selectedPurpose}"? Linked Firebase Storage files may also be removed. This cannot be undone.`,
            variant: 'danger',
            onConfirm: async () => {
                setConfirmState(CONFIRM_CLOSED);
                try {
                    await Promise.all(drawerDocs.map((doc: any) => DocumentsService.deleteDocument(doc.id)));
                    showToast('Purpose group deleted', 'success');
                    setSelectedPurpose(null);
                    setCategory(value => value === selectedPurpose ? '' : value);
                    onRefresh?.();
                } catch {
                    showToast('Failed to delete group', 'error');
                }
            },
        });
    };

    const documentDetails = selectedDocument ? (
        <div className="document-pos-detail-content">
            <div className="document-pos-file-symbol"><FileText size={36} strokeWidth={1.4} aria-hidden="true" /></div>
            <p className="document-pos-caption">Selected file</p>
            <h4 className="document-pos-detail-name">{selectedDocument.name}</h4>
            <dl className="document-pos-metadata"><div><dt>Category</dt><dd>{selectedDocument.purpose?.trim() || 'General'}</dd></div><div><dt>File link</dt><dd>{documentLink(selectedDocument) ? 'Available' : 'Not available'}</dd></div></dl>
            {documentLink(selectedDocument) ? <a href={documentLink(selectedDocument)!} target="_blank" rel="noopener noreferrer" className="document-pos-open">Open file<ArrowUpRight size={17} /></a> : <p className="text-sm text-slate-500">No valid file link is available.</p>}
            <p className="text-xs text-slate-500 leading-relaxed">Access follows the original file’s sharing settings.</p>
            {canManage && <div className="document-pos-detail-actions"><Button variant="outline" onClick={() => openEdit(selectedDocument)}><Edit size={15} className="mr-2" />Edit file</Button><button type="button" className="text-sm text-red-600 py-2 text-left" onClick={() => handleDeleteDoc(selectedDocument)}>Delete file…</button></div>}
        </div>
    ) : <div className="document-pos-selection-empty"><FileText size={30} strokeWidth={1.3} aria-hidden="true" /><h4>Select a file</h4><p>Choose a tile to see its details and available actions.</p></div>;

    if (loading) return <section aria-label="Loading documents" role="status" aria-live="polite" className="document-pos"><span className="sr-only">Loading documents</span><div aria-hidden="true" className="p-5 space-y-5"><Skeleton className="h-6 w-36" /><Skeleton className="h-10 w-full" /><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-36 w-full" />)}</div></div></section>;
    return (
        <>
        <LoadingState loading={false} error={error ?? null} onRetry={onRefresh} empty={false} emptyMessage="No documents found">
            <section aria-label="Document library" className="document-pos">
                {!category ? (
                    <div className="document-pos-catalogue">
                        <div className="document-pos-catalogue-heading">
                            <h4>Categories</h4>
                        </div>
                        <div className="document-pos-grid" aria-label="Document categories">
                            {canManage && onAdd && (
                                <Button className="document-pos-create-tile" onClick={onAdd}>
                                    <Plus size={28} strokeWidth={1.6} aria-hidden="true" />
                                    Add file link
                                </Button>
                            )}
                            {grouped.map(([purpose, docs]) => {
                                const matches = docs.filter(doc => doc.name.toLowerCase().includes((searchQuery || '').trim().toLowerCase()));
                                if (!matches.length) return null;
                                return (
                                    <button key={purpose} type="button" className="document-pos-category-tile" onClick={() => setCategory(purpose)}>
                                        <span className="document-pos-tile-top"><Folder size={28} strokeWidth={1.4} aria-hidden="true" /><ChevronRight size={16} aria-hidden="true" /></span>
                                        <span className="document-pos-tile-name">{purpose}</span>
                                        <span className="document-pos-tile-category">{matches.length} {matches.length === 1 ? 'file' : 'files'}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {!visibleDocuments.length && (
                            <div className="document-pos-empty">
                                <h4>{documents.length ? 'No matching files' : 'No files yet'}</h4>
                            </div>
                        )}
                    </div>
                ) : (
                <div className="document-pos-layout">
                    <div className="document-pos-catalogue">
                        <div className="document-pos-category-actions">
                            <button type="button" className="document-pos-back" onClick={() => {
                                setSelectedDocumentId(null);
                                setQuery('');
                                setCategory('');
                            }}>
                                <ArrowLeft size={16} aria-hidden="true" />Back to categories
                            </button>
                            <button type="button" className="document-pos-manage" onClick={() => {
                                setSelectedPurpose(category);
                                setIsEditingPurpose(false);
                            }}>
                                {canManage ? 'Manage category' : 'View category files'}
                                <ArrowUpRight size={14} aria-hidden="true" />
                            </button>
                        </div>
                        <div className="document-pos-catalogue-heading">
                            <h4>{category}</h4>
                            <p role="status">{visibleDocuments.length} {visibleDocuments.length === 1 ? 'file' : 'files'}</p>
                        </div>
                        <Input label="Search this category" placeholder="Search file names…" value={query} onChange={e => setQuery(e.target.value)} />
                        <div className="document-pos-file-list" role="list" aria-label="Files in category">
                            {visibleDocuments.map(doc => {
                                const link = documentLink(doc);
                                const selected = selectedDocument?.id === doc.id;
                                return <article key={doc.id} role="listitem" className={`document-pos-tile${selected ? ' is-selected' : ''}`}>
                                    <button type="button" aria-label={`Select ${doc.name}`} aria-pressed={selected} className="document-pos-tile-select" onClick={() => setSelectedDocumentId(doc.id)}>
                                        <FileText size={22} strokeWidth={1.6} aria-hidden="true" />
                                        <span className="document-pos-tile-name">{doc.name}</span>
                                        {selected && <CheckCircle size={17} aria-hidden="true" />}
                                    </button>
                                    <div className="document-pos-tile-footer">
                                        {link ? <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`Open ${doc.name}`}>Open<ArrowUpRight size={14} /></a> : <span>No link</span>}
                                        {canManage && <details className="relative"><summary aria-label={`Actions for ${doc.name}`} className="list-none cursor-pointer p-2 rounded hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><MoreHorizontal size={18} /></summary><div className="absolute right-0 top-full z-10 w-40 bg-white border border-slate-200 rounded-lg shadow-lg p-1"><button type="button" className="flex items-center gap-2 w-full p-2 text-sm hover:bg-slate-50" onClick={() => openEdit(doc)}><Edit size={14} />Edit</button><button type="button" className="flex items-center gap-2 w-full p-2 text-sm text-red-600 hover:bg-red-50" onClick={() => handleDeleteDoc(doc)}><Trash2 size={14} />Delete</button></div></details>}
                                    </div>
                                </article>;
                            })}
                        </div>
                        {!visibleDocuments.length && <div className="document-pos-empty"><FileText size={28} aria-hidden="true" /><h4>{documents.length ? 'No matching files' : 'No files yet'}</h4><p>{documents.length ? 'Try a different name or category.' : 'Shared file links will appear here.'}</p>{query && <button type="button" onClick={() => setQuery('')}>Clear search</button>}</div>}
                    </div>
                    {!mobileDrawer && <aside className="document-pos-inspector" aria-label="Selected file details">{documentDetails}</aside>}
                </div>
                )}
            </section>
            <Drawer isOpen={!!selectedDocument && mobileDrawer && !editingDocId && !selectedPurpose} onClose={() => setSelectedDocumentId(null)} title="File details" position="bottom" size="xl">
                {documentDetails}
            </Drawer>

            <Drawer
                isOpen={!!editingDocId && canManage}
                onClose={() => { if (!isSubmittingEdit) setEditingDocId(null); }}
                title="Edit file"
                position={mobileDrawer ? 'bottom' : 'right'}
                size={mobileDrawer ? 'xl' : 'lg'}
                footer={<div className="flex justify-end gap-3">
                    <Button variant="outline" disabled={isSubmittingEdit} onClick={() => setEditingDocId(null)}>Cancel</Button>
                    <Button disabled={!editForm.name.trim() || isSubmittingEdit} onClick={() => {
                        const doc = documents.find(item => item.id === editingDocId);
                        if (doc) void handleSaveEdit(doc);
                    }}>{isSubmittingEdit ? 'Saving…' : 'Save changes'}</Button>
                </div>}
            >
                <div className="space-y-6">
                    <p className="text-sm text-slate-500">Update the file details and its existing link.</p>
                    <Input label="File name" required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                    <div>
                        <Input label="Category" value={editForm.purpose} onChange={e => setEditForm(f => ({ ...f, purpose: e.target.value }))} placeholder="General" />
                        <div className="flex flex-wrap gap-2 mt-2">{grouped.map(([purpose]) => <button key={purpose} type="button" className="text-xs text-jci-blue hover:underline" onClick={() => setEditForm(f => ({ ...f, purpose }))}>{purpose}</button>)}</div>
                    </div>
                    <Input label="File link" type="url" value={editForm.fileUrl} disabled={!documents.find(doc => doc.id === editingDocId)?.currentVersion?.id} onChange={e => setEditForm(f => ({ ...f, fileUrl: e.target.value }))} placeholder="https://…" />
                    {!documents.find(doc => doc.id === editingDocId)?.currentVersion?.id && <p className="text-sm text-slate-500">This record has no stored file version. You can update its name and category; use Add file link in the library to add a linked file.</p>}
                    {documentLink({ currentVersion: { fileUrl: editForm.fileUrl } }) && <a href={documentLink({ currentVersion: { fileUrl: editForm.fileUrl } })!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-jci-blue">Open current link<ArrowUpRight size={15} /></a>}
                </div>
            </Drawer>

            <Drawer
                isOpen={!!selectedPurpose && !editingDocId}
                onClose={() => { setSelectedPurpose(null); setIsEditingPurpose(false); setShowCategoryAdd(false); setInlineAdd({ name: '', fileUrl: '' }); }}
                title={canManage ? 'Manage category' : 'Category files'}
                position={mobileDrawer ? 'bottom' : 'right'}
                size={mobileDrawer ? 'xl' : 'lg'}
            >
                <div className="space-y-6">
                    <div className="border-b border-slate-200 pb-5">
                        <div className="flex items-start justify-between gap-3">
                            <div><h4 className="text-xl font-semibold text-slate-900 break-words">{selectedPurpose}</h4><p className="text-sm text-slate-500 mt-1">{drawerDocs.length} {drawerDocs.length === 1 ? 'file' : 'files'}</p></div>
                            {canManage && <button type="button" className="text-sm text-jci-blue shrink-0 py-1" onClick={() => { setIsEditingPurpose(v => !v); setNewPurposeName(selectedPurpose ?? ''); }}>Edit name</button>}
                        </div>
                        {canManage && isEditingPurpose && <div className="space-y-3 mt-4">
                            <Input label="Category name" value={newPurposeName} onChange={e => setNewPurposeName(e.target.value)} />
                            <div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={isSavingPurpose} onClick={() => setIsEditingPurpose(false)}>Cancel</Button><Button size="sm" disabled={!newPurposeName.trim() || isSavingPurpose} onClick={handleSavePurpose}>{isSavingPurpose ? 'Saving…' : 'Save name'}</Button></div>
                        </div>}
                    </div>
                    <div className="divide-y divide-slate-100">
                        {!drawerDocs.length && <p className="text-sm text-slate-500 py-4">No files in this category.</p>}
                        {drawerDocs.map((doc: any) => <div key={doc.id} className="flex items-center justify-between gap-3 py-3">
                            <span className="flex items-center gap-3 min-w-0"><FileText size={18} className="text-jci-blue shrink-0" /><span className="text-sm font-medium text-slate-900 break-words">{doc.name}</span></span>
                            <div className="flex items-center gap-2 shrink-0">
                                {documentLink(doc) ? <a href={documentLink(doc)!} target="_blank" rel="noopener noreferrer" className="text-sm text-jci-blue inline-flex items-center gap-1 py-2">Open<ArrowUpRight size={14} /></a> : <span className="text-xs text-slate-400">No link</span>}
                                {canManage && <details className="relative"><summary aria-label={`Category actions for ${doc.name}`} className="list-none cursor-pointer p-2 rounded hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><MoreHorizontal size={18} /></summary><div className="absolute right-0 top-full z-10 w-36 p-1 bg-white rounded-lg border border-slate-200 shadow-lg"><button type="button" className="block text-left w-full p-2 text-sm hover:bg-slate-50" onClick={() => openEdit(doc)}>Edit file</button><button type="button" className="block text-left w-full p-2 text-sm text-red-600 hover:bg-red-50" onClick={() => handleDeleteDoc(doc)}>Delete file</button></div></details>}
                            </div>
                        </div>)}
                    </div>
                    {canManage && <div className="border-t border-slate-200 pt-4">
                        <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-jci-blue py-2" aria-expanded={showCategoryAdd} onClick={() => setShowCategoryAdd(value => !value)}><Plus size={16} />Add file link</button>
                        {showCategoryAdd && <div className="space-y-3 mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <Input label="New file name" required value={inlineAdd.name} onChange={e => setInlineAdd(f => ({ ...f, name: e.target.value }))} />
                            <Input label="New file link" type="url" required placeholder="https://…" value={inlineAdd.fileUrl} onChange={e => setInlineAdd(f => ({ ...f, fileUrl: e.target.value }))} />
                            <div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={isAddingDoc} onClick={() => setShowCategoryAdd(false)}>Cancel</Button><Button size="sm" disabled={!inlineAdd.name.trim() || !inlineAdd.fileUrl.trim() || isAddingDoc} onClick={handleAddToDrawer}>{isAddingDoc ? 'Adding…' : 'Add link'}</Button></div>
                        </div>}
                    </div>}
                    <div className="space-y-3 border-t border-slate-200 pt-5">
                        <Button variant="outline" className="w-full justify-center" onClick={handleDownloadAll} disabled={!drawerDocs.some(doc => documentLink(doc))}><ArrowUpRight size={15} className="mr-2" />Open all files</Button>
                        <p className="text-xs text-slate-500">Opens available links in separate tabs. Your browser may block multiple tabs.</p>
                        <Button variant="outline" className="w-full justify-center" disabled={!drawerDocs.some(doc => documentLink(doc))} onClick={() => {
                            const lines = [selectedPurpose ?? ''];
                            drawerDocs.forEach((doc: any) => { const link = documentLink(doc); if (link) lines.push(doc.name ?? '', link); });
                            navigator.clipboard.writeText(lines.join('\n')).then(() => showToast('File links copied', 'success')).catch(() => showToast('Failed to copy links', 'error'));
                        }}><Share2 size={15} className="mr-2" />Copy category file links</Button>
                        <p className="text-xs text-slate-500">Copies links only. Original file sharing permissions stay the same.</p>
                    </div>
                    {canManage && <details className="border-t border-red-100 pt-5"><summary className="text-sm font-semibold text-red-700 cursor-pointer">Danger zone</summary><div className="mt-4 space-y-3"><p className="text-sm text-slate-600">Delete all {drawerDocs.length} file records and their versions in this category. Linked Firebase Storage files may also be removed.</p><Button variant="danger" disabled={!drawerDocs.length} onClick={handleDeletePurpose}>Delete category and {drawerDocs.length} files…</Button></div></details>}
                </div>
            </Drawer>
        </LoadingState>

        <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
        </>
    );
};


interface LearningPathDetailModalProps {
    path: LearningPath;
    progress: LearningProgress | undefined;
    onClose: () => void;
    onStart: (pathId: string) => void;
    member: any;
}

const LearningPathDetailModal: React.FC<LearningPathDetailModalProps> = ({
    path,
    progress,
    onClose,
    onStart,
    member,
}) => {
    const { showToast } = useToast();
    return (
        <Modal isOpen={true} onClose={onClose} title={path.name} size="lg" drawerOnMobile>
            <div className="space-y-6">
                <div>
                    <p className="text-slate-600">{path.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-sm text-slate-500">Category</span>
                        <p className="font-semibold text-slate-900 capitalize">{path.category}</p>
                    </div>
                    <div>
                        <span className="text-sm text-slate-500">Difficulty</span>
                        <p className="font-semibold text-slate-900 capitalize">{path.difficulty}</p>
                    </div>
                    <div>
                        <span className="text-sm text-slate-500">Duration</span>
                        <p className="font-semibold text-slate-900">{path.estimatedDuration} hours</p>
                    </div>
                    <div>
                        <span className="text-sm text-slate-500">Points Reward</span>
                        <p className="font-semibold text-jci-blue">{path.pointsReward} pts</p>
                    </div>
                </div>

                {progress && (
                    <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-slate-500">Your Progress</span>
                            <span className="font-semibold text-slate-900">{progress.progress}%</span>
                        </div>
                        <ProgressBar progress={progress.progress} />
                        <p className="text-xs text-slate-500 mt-2">
                            Completed {progress.completedModules.length} of {path.modules.length} modules
                        </p>
                    </div>
                )}

                {/* Module List */}
                {path.modules && path.modules.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-3">Modules</h4>
                        <div className="space-y-2">
                            {path.modules.map((moduleId, index) => {
                                const isCompleted = progress?.completedModules.includes(moduleId);
                                const isCurrent = progress && progress.currentModuleIndex === index;
                                return (
                                    <div
                                        key={moduleId}
                                        className={`flex items-center gap-3 p-3 rounded-lg border ${isCompleted
                                            ? 'bg-green-50 border-green-200'
                                            : isCurrent
                                                ? 'bg-blue-50 border-blue-200'
                                                : 'bg-slate-50 border-slate-200'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${isCompleted
                                            ? 'bg-green-500 text-white'
                                            : isCurrent
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-slate-300 text-slate-600'
                                            }`}>
                                            {isCompleted ? <CheckCircle size={16} /> : index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-900">
                                                Module {index + 1}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {isCompleted ? 'Completed' : isCurrent ? 'Current Module' : 'Not Started'}
                                            </p>
                                        </div>
                                        {isCurrent && !isCompleted && progress && (
                                            <Button
                                                size="sm"
                                                onClick={async () => {
                                                    try {
                                                        const progressId = progress.id || '';
                                                        await LearningPathsService.updateProgress(
                                                            progressId,
                                                            moduleId,
                                                            path
                                                        );
                                                        onClose();
                                                        window.location.reload(); // Refresh to show updated progress
                                                    } catch (err) {
                                                        console.error('Failed to complete module:', err);
                                                        showToast('Failed to mark module complete', 'error');
                                                    }
                                                }}
                                            >
                                                Mark Complete
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex gap-3 pt-4 border-t">
                    {!progress ? (
                        <Button className="flex-1" onClick={() => {
                            onStart(path.id!);
                            onClose();
                        }}>
                            <PlayCircle size={16} className="mr-2" />
                            Start Learning Path
                        </Button>
                    ) : (
                        <Button className="flex-1">
                            <Clock size={16} className="mr-2" />
                            Continue Learning
                        </Button>
                    )}
                    <Button variant="ghost" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

