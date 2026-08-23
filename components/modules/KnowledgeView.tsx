import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, FileText, Download, Award, PlayCircle, Plus, Edit, Trash2, GraduationCap, CheckCircle, Clock, GitBranch, Eye, Search, Filter, X, Share2 } from 'lucide-react';
import { Card, Button, ProgressBar, Badge, Tabs, Modal, Drawer, useToast, ConfirmDialog, CONFIRM_CLOSED } from '../ui/Common';
import type { ConfirmState } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useKnowledge } from '../../hooks/useKnowledge';
import { useLearningPaths } from '../../hooks/useLearningPaths';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { LearningPathsService, LearningPath, LearningProgress, Certificate } from '../../services/learningPathsService';
import { DocumentsService, DocumentWithVersions, DocumentVersion } from '../../services/documentsService';
import { formatDate } from '../../utils/dateUtils';
import { formatFileSize } from '../../utils/formatUtils';

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

    // Filter documents based on search term
    const filteredDocuments = useMemo(() => {
        let filtered = documents || [];
        const term = (searchQuery || searchTerm).toLowerCase();

        // Filter by search term
        if (term.trim()) {
            filtered = filtered.filter(doc =>
                doc.name.toLowerCase().includes(term) ||
                doc.description?.toLowerCase().includes(term)
            );
        }

        return filtered;
    }, [documents, searchTerm, searchQuery]);

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
                            documents={filteredDocuments}
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
                                        await createPath({ ...pathForm, modules: [], prerequisites: [], materials, pointsReward: 0, certificateIssued: false });
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
                title={editingDoc ? 'Edit Document' : 'Upload Document'}
                size="md"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Document Name *</label>
                        <Input value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Meeting Minutes – Aug 2026" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
                        <Input value={docForm.purpose} onChange={e => setDocForm(f => ({ ...f, purpose: e.target.value }))} placeholder="e.g. New Member Onboarding, Board Reference, Event Planning" />
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
                                setIsSubmittingDoc(true);
                                try {
                                    if (editingDoc) {
                                        await DocumentsService.updateDocument(editingDoc.id, { name: docForm.name.trim(), purpose: docForm.purpose.trim() || undefined });
                                        showToast('Document updated successfully', 'success');
                                    } else {
                                        const url = docForm.fileUrl.trim();
                                        const guessedName = url.split('/').pop()?.split('?')[0] || docForm.name.trim();
                                        await DocumentsService.createDocument(
                                            { name: docForm.name.trim(), purpose: docForm.purpose.trim() || undefined, loId: (member as any)?.loId ?? 'default', uploadedBy: member?.id ?? '', uploadedDate: new Date(), description: '', tags: [], isPublic: true },
                                            url, guessedName, 0, 'application/octet-stream', member?.id ?? ''
                                        );
                                        showToast('Document uploaded successfully', 'success');
                                    }
                                    setIsDocUploadOpen(false);
                                    setEditingDoc(null);
                                    setDocForm({ name: '', purpose: '', fileUrl: '' });
                                } catch {
                                    showToast(editingDoc ? 'Failed to update document' : 'Failed to upload document', 'error');
                                } finally {
                                    setIsSubmittingDoc(false);
                                }
                            }}
                        >
                            {isSubmittingDoc ? (editingDoc ? 'Saving...' : 'Uploading...') : (editingDoc ? 'Save' : 'Upload')}
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
    loading: boolean;
    error?: string | null;
    canManage: boolean;
    onAdd?: () => void;
    onRefresh?: () => Promise<void>;
}

const PURPOSE_GRADIENT: Record<string, string> = {
    'General': 'from-slate-400 to-slate-600',
};
const PURPOSE_GRADIENTS = [
    'from-blue-400 to-blue-600',
    'from-violet-400 to-violet-600',
    'from-emerald-400 to-emerald-600',
    'from-amber-400 to-amber-500',
    'from-rose-400 to-rose-600',
    'from-pink-400 to-pink-600',
    'from-cyan-400 to-cyan-600',
    'from-indigo-400 to-indigo-600',
];

const DocumentsTab: React.FC<DocumentsTabProps> = ({ documents, loading, error, canManage, onAdd, onRefresh }) => {
    const { member } = useAuth();
    const { showToast } = useToast();
    const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null);
    // inline add within drawer
    const [inlineAdd, setInlineAdd] = useState({ name: '', fileUrl: '' });
    const [isAddingDoc, setIsAddingDoc] = useState(false);
    // inline row edit
    const [editingDocId, setEditingDocId] = useState<string | null>(null);
    const [editStep, setEditStep] = useState<1 | 2>(1);
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

    const getGradient = (purpose: string, idx: number) =>
        PURPOSE_GRADIENT[purpose] ?? PURPOSE_GRADIENTS[idx % PURPOSE_GRADIENTS.length];

    const drawerDocs = selectedPurpose ? (grouped.find(([p]) => p === selectedPurpose)?.[1] ?? []) : [];

    const openEdit = (doc: any) => {
        setEditingDocId(doc.id);
        setEditStep(1);
        setEditForm({ name: doc.name ?? '', purpose: doc.purpose ?? '', fileUrl: doc.currentVersion?.fileUrl ?? '' });
    };

    const handleSaveEdit = async (doc: any) => {
        setIsSubmittingEdit(true);
        try {
            await DocumentsService.updateDocument(doc.id, {
                name: editForm.name.trim(),
                purpose: editForm.purpose.trim() || undefined,
            });
            const newUrl = editForm.fileUrl.trim();
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
        if (!inlineAdd.name.trim() || !inlineAdd.fileUrl.trim()) return;
        setIsAddingDoc(true);
        try {
            const url = inlineAdd.fileUrl.trim();
            const guessedName = url.split('/').pop()?.split('?')[0] || inlineAdd.name.trim();
            await DocumentsService.createDocument(
                { name: inlineAdd.name.trim(), purpose: selectedPurpose ?? undefined, loId: (member as any)?.loId ?? 'default', uploadedBy: member?.id ?? '', uploadedDate: new Date(), description: '', tags: [], isPublic: true },
                url, guessedName, 0, 'application/octet-stream', member?.id ?? ''
            );
            showToast('Document added', 'success');
            setInlineAdd({ name: '', fileUrl: '' });
            onRefresh?.();
        } catch {
            showToast('Failed to add document', 'error');
        } finally {
            setIsAddingDoc(false);
        }
    };

    const handleDownloadAll = () => {
        drawerDocs.forEach((doc: any) => {
            const url = doc.currentVersion?.fileUrl;
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
            showToast('Purpose renamed', 'success');
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
            title: 'Delete Purpose Group',
            message: `Delete all ${drawerDocs.length} document(s) in "${selectedPurpose}"? This cannot be undone.`,
            variant: 'danger',
            onConfirm: async () => {
                setConfirmState(CONFIRM_CLOSED);
                try {
                    await Promise.all(drawerDocs.map((doc: any) => DocumentsService.deleteDocument(doc.id)));
                    showToast('Purpose group deleted', 'success');
                    setSelectedPurpose(null);
                    onRefresh?.();
                } catch {
                    showToast('Failed to delete group', 'error');
                }
            },
        });
    };

    return (
        <>
        <LoadingState loading={loading} error={error ?? null} empty={false} emptyMessage="No documents found">
            {/* Purpose cards grid — 1 col mobile, 2 col sm+, 3 col lg+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {onAdd && (
                    <div onClick={onAdd} className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex items-center gap-3 text-slate-400 hover:border-jci-blue hover:text-jci-blue hover:bg-sky-50 transition-colors cursor-pointer min-h-[72px]">
                        <div className="w-10 h-10 rounded-lg border-2 border-dashed border-current flex items-center justify-center shrink-0"><Plus size={16} /></div>
                        <div>
                            <p className="text-sm font-semibold">Upload Document</p>
                            <p className="text-xs opacity-70">share a file with the team</p>
                        </div>
                    </div>
                )}
                {documents.length === 0 && !loading && (
                    <p className="col-span-full text-sm text-slate-400 text-center py-10">No documents available</p>
                )}
                {grouped.map(([purpose, docs], idx) => {
                    const gradient = getGradient(purpose, idx);
                    return (
                        <div key={purpose}
                            className="bg-white border border-slate-100 rounded-2xl overflow-hidden hover:border-slate-200 hover:shadow-sm transition-all cursor-pointer active:scale-[0.98]"
                            onClick={() => { setSelectedPurpose(purpose); setIsEditingPurpose(false); setInlineAdd({ name: '', fileUrl: '' }); }}>
                            {/* Single row: icon + purpose name + doc count */}
                            <div className="flex items-center gap-3 px-3 py-3">
                                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                                    <FileText size={16} className="text-white" strokeWidth={2} />
                                </div>
                                <p className="flex-1 min-w-0 font-semibold text-slate-900 text-sm leading-tight line-clamp-1">{purpose}</p>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 shrink-0">{docs.length} doc{docs.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Document list drawer */}
            <Drawer isOpen={!!selectedPurpose} onClose={() => { setSelectedPurpose(null); setIsEditingPurpose(false); }} title={selectedPurpose ?? ''} position="bottom">
                <div className="space-y-3">

                    {/* Doc list */}
                    <div className="space-y-1.5">
                        {drawerDocs.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-6">No documents in this group</p>
                        )}
                        {drawerDocs.map((doc: any) => (
                            editingDocId === doc.id ? (
                                <div key={doc.id} className="border border-jci-blue/40 bg-sky-50 rounded-xl px-3 py-2.5">
                                    {editStep === 1 ? (
                                        <div className="flex gap-2 items-center">
                                            <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Document Name *" />
                                            <Button size="sm" variant="primary" className="shrink-0 px-3" disabled={!editForm.name.trim()} onClick={() => setEditStep(2)}><span className="text-base leading-none">›</span></Button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 items-center">
                                            <Button size="sm" variant="outline" className="shrink-0 px-3" onClick={() => setEditStep(1)}><span className="text-base leading-none">‹</span></Button>
                                            <Input value={editForm.fileUrl} onChange={e => setEditForm(f => ({ ...f, fileUrl: e.target.value }))} placeholder="File URL *" autoFocus />
                                            <Button size="sm" variant="primary" className="shrink-0" disabled={!editForm.name.trim() || isSubmittingEdit} onClick={() => handleSaveEdit(doc)}>
                                                {isSubmittingEdit ? '…' : 'Save'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div key={doc.id}
                                    className="flex items-center gap-3 px-3 py-2.5 bg-white border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-sm transition-all cursor-pointer"
                                    onClick={() => { if (doc.currentVersion?.fileUrl) window.open(doc.currentVersion.fileUrl, '_blank', 'noopener,noreferrer'); }}>
                                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
                                        <FileText size={15} className="text-white" strokeWidth={2} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-900 text-sm line-clamp-1">{doc.name}</p>
                                        {doc.uploadedDate && <p className="text-xs text-slate-400">{formatDate(doc.uploadedDate)}</p>}
                                    </div>
                                    {canManage && (
                                        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                                            <button className="p-1.5 rounded-lg text-slate-400 hover:text-jci-blue hover:bg-sky-50 transition-colors"
                                                onClick={() => openEdit(doc)} aria-label="Edit">
                                                <Edit size={14} />
                                            </button>
                                            <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                onClick={() => handleDeleteDoc(doc)} aria-label="Delete">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        ))}
                    </div>

                    {/* Rename purpose */}
                    {canManage && isEditingPurpose && (
                        <div className="flex gap-2 items-center border border-jci-blue/30 bg-sky-50 rounded-xl px-3 py-2.5">
                            <Input value={newPurposeName} onChange={e => setNewPurposeName(e.target.value)} placeholder="New purpose name" />
                            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setIsEditingPurpose(false)}>✕</Button>
                            <Button size="sm" variant="primary" className="shrink-0" disabled={!newPurposeName.trim() || isSavingPurpose} onClick={handleSavePurpose}>
                                {isSavingPurpose ? '…' : 'Save'}
                            </Button>
                        </div>
                    )}

                    {/* Add document */}
                    {canManage && (
                        <div className="border border-dashed border-slate-200 rounded-xl p-3 space-y-2">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Add Document</p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Input value={inlineAdd.name} onChange={e => setInlineAdd(f => ({ ...f, name: e.target.value }))} placeholder="Document Name *" />
                                <Input value={inlineAdd.fileUrl} onChange={e => setInlineAdd(f => ({ ...f, fileUrl: e.target.value }))} placeholder="File URL *" />
                                <Button size="sm" variant="primary" disabled={!inlineAdd.name.trim() || !inlineAdd.fileUrl.trim() || isAddingDoc} onClick={handleAddToDrawer} className="sm:shrink-0">
                                    {isAddingDoc ? 'Adding…' : 'Add'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Footer actions */}
                    <div className="flex gap-2 pt-1 border-t border-slate-100">
                        <Button size="sm" variant="outline" className="flex-1" onClick={handleDownloadAll} disabled={drawerDocs.length === 0}>
                            <Download size={14} className="mr-1.5" />All
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" disabled={drawerDocs.length === 0} onClick={() => {
                            const lines = [selectedPurpose ?? ''];
                            drawerDocs.forEach((doc: any) => {
                                lines.push(doc.name ?? '');
                                const url = doc.currentVersion?.fileUrl;
                                if (url) lines.push(url);
                            });
                            navigator.clipboard.writeText(lines.join('\n')).then(() => showToast('Copied', 'success')).catch(() => showToast('Failed to copy', 'error'));
                        }}>
                            <Share2 size={14} className="mr-1.5" />Share
                        </Button>
                        {canManage && (
                            <>
                                <Button size="sm" variant="outline" onClick={() => { setIsEditingPurpose(v => !v); setNewPurposeName(selectedPurpose ?? ''); }}>
                                    <Edit size={14} className="mr-1.5" />Rename
                                </Button>
                                <Button size="sm" variant="danger" onClick={handleDeletePurpose}>
                                    <Trash2 size={14} />
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </Drawer>
        </LoadingState>

        <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
        </>
    );
};

interface CertificatesTabProps {
    certificates: Certificate[];
    loading?: boolean;
    error?: string | null;
}

const CertificatesTab: React.FC<CertificatesTabProps> = ({ certificates, loading = false, error = null }) => {
    return (
        <LoadingState loading={loading} error={error} empty={certificates.length === 0} emptyMessage="No certificates earned yet">
            <div className="grid md:grid-cols-2 gap-6">
                {certificates.map(cert => (
                    <Card key={cert.id} className="hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg">
                                <Award className="text-white" size={24} />
                            </div>
                            <Badge variant="success">Verified</Badge>
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 mb-2">{cert.pathName}</h3>
                        <div className="space-y-2 text-sm text-slate-600 mb-4">
                            <div>
                                <span className="font-medium">Certificate #:</span> {cert.certificateNumber}
                            </div>
                            <div>
                                <span className="font-medium">Issued:</span> {formatDate(cert.issuedAt as Date)}
                            </div>
                            <div>
                                <span className="font-medium">Verification Code:</span> {cert.verificationCode}
                            </div>
                        </div>
                        <div className="flex gap-2 pt-4 border-t">
                            <Button variant="outline" size="sm" className="flex-1">
                                <Download size={14} className="mr-2" />
                                Download
                            </Button>
                            <Button variant="outline" size="sm">
                                Verify
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </LoadingState>
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
                    ) : progress.progress === 100 ? (
                        <Button className="flex-1" variant="outline">
                            <Award size={16} className="mr-2" />
                            View Certificate
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

