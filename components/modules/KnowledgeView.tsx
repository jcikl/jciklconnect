import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, FileText, Download, Award, PlayCircle, Plus, Edit, Trash2, GraduationCap, CheckCircle, Clock, GitBranch, Eye, Search, Filter, X } from 'lucide-react';
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
    const [selectedDocument, setSelectedDocument] = useState<DocumentWithVersions | null>(null);
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
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [categories, setCategories] = useState<string[]>([]);
    const { trainingModules, documents, loading, error } = useKnowledge();
    // Note: documents from useKnowledge may not have version info, we'll handle that in the component
    const { paths, loading: pathsLoading, error: pathsError, createPath, updatePath, deletePath } = useLearningPaths();
    const { member } = useAuth();
    const { isBoard, isAdmin } = usePermissions();
    const { showToast } = useToast();

    // Extract categories from documents
    useEffect(() => {
        if (documents && documents.length > 0) {
            const uniqueCategories = [...new Set(documents.map(doc => doc.category).filter(Boolean))];
            setCategories(uniqueCategories);
        }
    }, [documents]);

    // Filter documents based on search term and category
    const filteredDocuments = useMemo(() => {
        let filtered = documents || [];
        const term = (searchQuery || searchTerm).toLowerCase();

        // Filter by search term
        if (term.trim()) {
            filtered = filtered.filter(doc =>
                doc.name.toLowerCase().includes(term) ||
                doc.description?.toLowerCase().includes(term) ||
                doc.category.toLowerCase().includes(term)
            );
        }

        // Filter by category
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(doc => doc.category === selectedCategory);
        }

        return filtered;
    }, [documents, searchTerm, selectedCategory, searchQuery]);

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
                            onSelectDocument={setSelectedDocument}
                            canManage={isBoard || isAdmin}
                            searchTerm={searchQuery || searchTerm}
                            onSearchChange={setSearchTerm}
                            selectedCategory={selectedCategory}
                            onCategoryChange={setSelectedCategory}
                            categories={categories}
                        />
                    )}
                </div>
            </div>

            {/* Document Detail Modal with Versions */}
            {selectedDocument && (
                <DocumentDetailModal
                    document={selectedDocument}
                    onClose={() => setSelectedDocument(null)}
                    canManage={isBoard || isAdmin}
                />
            )}

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
        </div>
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
                            {/* Top row: icon | name | badges */}
                            <div className="flex items-center gap-3 p-3">
                                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                                    <BookOpen size={16} className="text-white" strokeWidth={2} />
                                </div>
                                <p className="flex-1 min-w-0 font-semibold text-slate-900 text-sm leading-tight line-clamp-1">{path.name}</p>
                                <div className="flex items-center gap-1 shrink-0">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">{path.category}</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${path.difficulty === 'Advance' ? 'bg-red-100 text-red-700' : path.difficulty === 'Intermediate' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{path.difficulty}</span>
                                    {path.status === 'Draft' && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/20">Draft</span>}
                                </div>
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
                                <Button variant="danger" size="sm" className="flex-1" onClick={() => { setSelectedPath(null); setConfirmState({ open: true, title: 'Delete Learning Path', message: 'Are you sure you want to delete this learning path?', variant: 'danger', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); await onDelete(p.id!); } }); }}>
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
    onSelectDocument: (doc: DocumentWithVersions) => void;
    canManage: boolean;
    searchTerm?: string;
    onSearchChange?: (term: string) => void;
    selectedCategory?: string;
    onCategoryChange?: (category: string) => void;
    categories?: string[];
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({
    documents,
    loading,
    error,
    onSelectDocument,
    canManage,
    searchTerm = '',
    onSearchChange,
    selectedCategory = 'all',
    onCategoryChange,
    categories = [],
}) => {
    return (
        <div className="space-y-4">
            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <Input
                        type="text"
                        placeholder="Search documents..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        className="pl-10"
                    />
                </div>
                {categories.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Filter className="text-slate-400" size={18} />
                        <Select
                            value={selectedCategory}
                            onChange={(e) => onCategoryChange?.(e.target.value)}
                            options={[
                                { label: 'All Categories', value: 'all' },
                                ...categories.map(cat => ({ label: cat, value: cat })),
                            ]}
                            className="min-w-[180px]"
                        />
                    </div>
                )}
                {(searchTerm || selectedCategory !== 'all') && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            onSearchChange?.('');
                            onCategoryChange?.('all');
                        }}
                    >
                        <X size={16} className="mr-1" />
                        Clear
                    </Button>
                )}
            </div>

            <LoadingState loading={loading} error={error ?? null} empty={documents.length === 0} emptyMessage="No documents found">
                <div className="space-y-2">
                    {documents.map(doc => (
                        <div
                            key={doc.id}
                            className="p-4 hover:bg-slate-50 rounded-lg flex items-center justify-between group cursor-pointer transition-colors border border-slate-100"
                            onClick={() => onSelectDocument(doc)}
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="p-2 bg-blue-50 text-jci-blue rounded flex-shrink-0">
                                    <FileText size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                                    <p className="text-xs text-slate-500">
                                        {doc.category} • {doc.size || 'N/A'} • {formatDate(doc.uploadedDate)}
                                        {doc.versionCount && doc.versionCount > 1 && (
                                            <span className="ml-2 flex items-center gap-1">
                                                <GitBranch size={10} />
                                                {doc.versionCount} versions
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Button variant="ghost" size="sm">
                                    <Eye size={14} />
                                </Button>
                                <Button variant="ghost" size="sm">
                                    <Download size={14} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </LoadingState>
        </div>
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

interface DocumentDetailModalProps {
    document: DocumentWithVersions;
    onClose: () => void;
    canManage: boolean;
}

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ document, onClose, canManage }) => {
    const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [documentWithVersions, setDocumentWithVersions] = useState<DocumentWithVersions>(document);
    const [isRestoring, setIsRestoring] = useState<string | null>(null);
    const { showToast } = useToast();
    const { member } = useAuth();

    useEffect(() => {
        loadDocumentVersions();
    }, [document.id]);

    const loadDocumentVersions = async () => {
        if (!document.id) return;
        try {
            setLoadingVersions(true);
            const fullDocument = await DocumentsService.getDocumentById(document.id);
            if (fullDocument) {
                setDocumentWithVersions(fullDocument);
            }
        } catch (err) {
            showToast('Failed to load document versions', 'error');
        } finally {
            setLoadingVersions(false);
        }
    };

    const handleDownloadVersion = (version: DocumentVersion) => {
        if (version.fileUrl) {
            window.open(version.fileUrl, '_blank', 'noopener,noreferrer');
        } else {
            showToast('File URL not available', 'error');
        }
    };

    const handleRestoreVersion = (versionId: string) => {
        if (!document.id || !member) return;
        setConfirmState({
            open: true,
            title: 'Restore Version',
            message: 'Are you sure you want to restore this version? A new version will be created.',
            variant: 'warning',
            onConfirm: async () => {
                setConfirmState(CONFIRM_CLOSED);
        try {
            setIsRestoring(versionId);
            await DocumentsService.restoreVersion(
                document.id,
                versionId,
                member.id,
                `Restored from version ${documentWithVersions.versions?.find(v => v.id === versionId)?.version || 'previous'}`
            );
            showToast('Version restored successfully', 'success');
            await loadDocumentVersions();
        } catch (err) {
            showToast('Failed to restore version', 'error');
        } finally {
            setIsRestoring(null);
        }
            },
        });
    };

    return (
        <>
        <Modal isOpen={true} onClose={onClose} title={documentWithVersions.name} size="lg" drawerOnMobile>
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-slate-500 mb-1">Category</p>
                        <p className="font-semibold text-slate-900">{documentWithVersions.category}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 mb-1">Type</p>
                        <p className="font-semibold text-slate-900">{documentWithVersions.type}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 mb-1">Size</p>
                        <p className="font-semibold text-slate-900">{documentWithVersions.size || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 mb-1">Uploaded</p>
                        <p className="font-semibold text-slate-900">{formatDate(documentWithVersions.uploadedDate)}</p>
                    </div>
                </div>

                {documentWithVersions.versions && documentWithVersions.versions.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                <GitBranch size={18} />
                                Version History ({documentWithVersions.versions.length})
                            </h4>
                            {loadingVersions && (
                                <Badge variant="neutral">Loading...</Badge>
                            )}
                        </div>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {documentWithVersions.versions.map((version) => (
                                <div
                                    key={version.id}
                                    className={`p-4 rounded-lg border transition-all ${version.isCurrent
                                        ? 'border-jci-blue bg-blue-50 shadow-sm'
                                        : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-900">Version {version.version}</span>
                                            {version.isCurrent && (
                                                <Badge variant="success">Current</Badge>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-500">
                                            {formatDate(version.uploadedAt as Date)}
                                        </span>
                                    </div>
                                    <div className="space-y-1 mb-3">
                                        <p className="text-xs text-slate-600">
                                            <span className="font-medium">File:</span> {version.fileName} ({formatFileSize(version.fileSize)})
                                        </p>
                                        <p className="text-xs text-slate-600">
                                            <span className="font-medium">Uploaded by:</span> {version.uploadedBy}
                                        </p>
                                        {version.changeLog && (
                                            <p className="text-xs text-slate-500 mt-1 italic">
                                                "{version.changeLog}"
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDownloadVersion(version)}
                                        >
                                            <Download size={12} className="mr-1" />
                                            Download
                                        </Button>
                                        {canManage && !version.isCurrent && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => version.id && handleRestoreVersion(version.id)}
                                                isLoading={isRestoring === version.id}
                                            >
                                                <GitBranch size={12} className="mr-1" />
                                                Restore
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(!documentWithVersions.versions || documentWithVersions.versions.length === 0) && (
                    <div className="text-center py-8 text-slate-400">
                        <GitBranch size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No version history available</p>
                    </div>
                )}

                <div className="flex gap-3 pt-4 border-t">
                    {documentWithVersions.currentVersion && (
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => documentWithVersions.currentVersion && handleDownloadVersion(documentWithVersions.currentVersion)}
                        >
                            <Download size={16} className="mr-2" />
                            Download Current Version
                        </Button>
                    )}
                    <Button variant="ghost" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
        <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
        </>
    );
};
