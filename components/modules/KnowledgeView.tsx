import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, FileText, Download, Award, PlayCircle, Plus, Edit, Trash2, GraduationCap, CheckCircle, Clock, GitBranch, Eye, Search, Filter, X } from 'lucide-react';
import { Card, Button, ProgressBar, Badge, Tabs, Modal, useToast } from '../ui/Common';
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
    const [activeTab, setActiveTab] = useState<'learning' | 'documents' | 'certificates'>('learning');
    const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);
    const [selectedDocument, setSelectedDocument] = useState<DocumentWithVersions | null>(null);
    const [myProgress, setMyProgress] = useState<LearningProgress[]>([]);
    const [myCertificates, setMyCertificates] = useState<Certificate[]>([]);
    const [isPathModalOpen, setIsPathModalOpen] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [categories, setCategories] = useState<string[]>([]);
    const { trainingModules, documents, loading, error } = useKnowledge();
    // Note: documents from useKnowledge may not have version info, we'll handle that in the component
    const { paths, loading: pathsLoading, createPath, updatePath, deletePath } = useLearningPaths();
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

    useEffect(() => {
        if (member) {
            loadMyProgress();
            loadMyCertificates();
        }
    }, [member]);

    const loadMyProgress = async () => {
        if (!member) return;
        try {
            const progress = await LearningPathsService.getMemberProgress(member.id);
            setMyProgress(progress);
        } catch (err) {
            // Error handled silently
        }
    };

    const loadMyCertificates = async () => {
        if (!member) return;
        try {
            const certs = await LearningPathsService.getMemberCertificates(member.id);
            setMyCertificates(certs);
        } catch (err) {
            // Error handled silently
        }
    };

    const handleStartPath = async (pathId: string) => {
        if (!member) return;
        try {
            await LearningPathsService.startLearningPath(member.id, pathId);
            showToast('Learning path started!', 'success');
            await loadMyProgress();
        } catch (err) {
            showToast('Failed to start learning path', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Knowledge & Learning</h2>
                    <p className="text-slate-500">Training, certifications, and document archives.</p>
                </div>
                <div className="flex gap-2">
                    {(isBoard || isAdmin) && (
                        <>
                            <Button variant="outline" onClick={() => setIsPathModalOpen(true)}>
                                <Plus size={16} className="mr-2" /> New Learning Path
                            </Button>
                            <Button variant="outline" onClick={() => setIsDocModalOpen(true)}>
                                <FileText size={16} className="mr-2" /> Upload Document
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <Card noPadding>
                <div className="px-4 md:px-6 pt-4">
                    <Tabs
                        tabs={['Learning Paths', 'Documents', 'My Certificates']}
                        activeTab={activeTab === 'learning' ? 'Learning Paths' : activeTab === 'documents' ? 'Documents' : 'My Certificates'}
                        onTabChange={(tab) => {
                            if (tab === 'Learning Paths') setActiveTab('learning');
                            else if (tab === 'Documents') setActiveTab('documents');
                            else setActiveTab('certificates');
                        }}
                    />
                </div>
                <div className="p-4">
                    {activeTab === 'learning' && (
                        <LearningPathsTab
                            paths={paths}
                            myProgress={myProgress}
                            loading={pathsLoading}
                            onStartPath={handleStartPath}
                            onSelectPath={setSelectedPath}
                            canManage={isBoard || isAdmin}
                            onDelete={deletePath}
                        />
                    )}
                    {activeTab === 'documents' && (
                        <DocumentsTab
                            documents={filteredDocuments}
                            loading={loading}
                            onSelectDocument={setSelectedDocument}
                            canManage={isBoard || isAdmin}
                            searchTerm={searchQuery || searchTerm}
                            onSearchChange={setSearchTerm}
                            selectedCategory={selectedCategory}
                            onCategoryChange={setSelectedCategory}
                            categories={categories}
                        />
                    )}
                    {activeTab === 'certificates' && (
                        <CertificatesTab certificates={myCertificates} />
                    )}
                </div>
            </Card>

            {/* Learning Path Detail Modal */}
            {selectedPath && (
                <LearningPathDetailModal
                    path={selectedPath}
                    progress={myProgress.find(p => p.pathId === selectedPath.id)}
                    onClose={() => setSelectedPath(null)}
                    onStart={handleStartPath}
                    member={member}
                />
            )}

            {/* Document Detail Modal with Versions */}
            {selectedDocument && (
                <DocumentDetailModal
                    document={selectedDocument}
                    onClose={() => setSelectedDocument(null)}
                    canManage={isBoard || isAdmin}
                />
            )}
        </div>
    );
};

interface LearningPathsTabProps {
    paths: LearningPath[];
    myProgress: LearningProgress[];
    loading: boolean;
    onStartPath: (pathId: string) => void;
    onSelectPath: (path: LearningPath) => void;
    canManage: boolean;
    onDelete: (pathId: string) => Promise<void>;
}

const LearningPathsTab: React.FC<LearningPathsTabProps> = ({
    paths,
    myProgress,
    loading,
    onStartPath,
    onSelectPath,
    canManage,
    onDelete,
}) => {
    const getProgress = (pathId: string) => {
        return myProgress.find(p => p.pathId === pathId);
    };

    return (
        <LoadingState loading={loading} error={null} empty={paths.length === 0} emptyMessage="No learning paths available">
            <div className="grid md:grid-cols-2 gap-6">
                {paths.map(path => {
                    const progress = getProgress(path.id!);
                    const isCompleted = progress?.progress === 100;
                    const isInProgress = progress && progress.progress > 0 && progress.progress < 100;

                    return (
                        <Card key={path.id} className="hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                                <Badge variant={path.category === 'JCI Official' ? 'jci' : 'neutral'}>
                                    {path.category}
                                </Badge>
                                <Badge variant={path.difficulty === 'Advanced' ? 'error' : path.difficulty === 'Intermediate' ? 'warning' : 'info'}>
                                    {path.difficulty}
                                </Badge>
                            </div>
                            <h3 className="font-bold text-lg text-slate-900 mb-2">{path.name}</h3>
                            <p className="text-sm text-slate-600 mb-4">{path.description}</p>

                            <div className="space-y-2 mb-4">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>Duration</span>
                                    <span>{path.estimatedDuration} hours</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>Points Reward</span>
                                    <span className="font-semibold text-jci-blue">{path.pointsReward} pts</span>
                                </div>
                                {path.certificateIssued && (
                                    <div className="flex items-center gap-1 text-xs text-green-600">
                                        <Award size={12} />
                                        <span>Certificate Available</span>
                                    </div>
                                )}
                            </div>

                            {progress && (
                                <div className="mb-4">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-slate-500">Progress</span>
                                        <span className="font-semibold text-slate-900">{progress.progress}%</span>
                                    </div>
                                    <ProgressBar progress={progress.progress} />
                                </div>
                            )}

                            <div className="flex gap-2 pt-4 border-t">
                                {!progress ? (
                                    <Button
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => onStartPath(path.id!)}
                                    >
                                        <PlayCircle size={14} className="mr-2" />
                                        Start Path
                                    </Button>
                                ) : isCompleted ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => onSelectPath(path)}
                                    >
                                        <Award size={14} className="mr-2" />
                                        View Certificate
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => onSelectPath(path)}
                                    >
                                        <Clock size={14} className="mr-2" />
                                        Continue
                                    </Button>
                                )}
                                {canManage && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={async () => {
                                            if (window.confirm('Are you sure you want to delete this learning path?')) {
                                                await onDelete(path.id!);
                                            }
                                        }}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </LoadingState>
    );
};

interface DocumentsTabProps {
    documents: any[];
    loading: boolean;
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

            <LoadingState loading={loading} error={null} empty={documents.length === 0} emptyMessage="No documents found">
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
}

const CertificatesTab: React.FC<CertificatesTabProps> = ({ certificates }) => {
    return (
        <LoadingState loading={false} error={null} empty={certificates.length === 0} emptyMessage="No certificates earned yet">
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
            window.open(version.fileUrl, '_blank');
        } else {
            showToast('File URL not available', 'error');
        }
    };

    const handleRestoreVersion = async (versionId: string) => {
        if (!document.id || !member) return;
        if (!window.confirm('Are you sure you want to restore this version? A new version will be created.')) return;

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
    };

    return (
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
    );
};
