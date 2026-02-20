import React, { useState, useMemo, useEffect } from 'react';
import { X, CheckSquare, Layers } from 'lucide-react';
import { Transaction, TransactionSplit } from '../../../types';
import { FinanceService } from '../../../services/financeService';
import * as Forms from '../../ui/Form';
import { Combobox } from '../../ui/Combobox';

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: string }> = ({ isOpen, onClose, title, children, size = 'max-w-2xl' }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`bg-white rounded-lg shadow-xl w-full ${size} max-h-[90vh] overflow-y-auto`}>
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
};

type CategoryType = 'Projects & Activities' | 'Membership' | 'Administrative';

interface CategoryUpdates {
    category?: CategoryType;
    year?: number;
    projectId?: string;
    memberId?: string;
    purpose?: string;
    paymentRequestId?: string;
}

export interface BatchCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    /** IDs of selected main transactions (non-split or un-split) */
    selectedTransactionIds: string[];
    /** IDs of selected split records */
    selectedSplitIds: string[];
    // Context data
    projects: Array<{ id: string; name: string; year?: number }>;
    members: Array<{ id: string; name: string; membershipType?: string }>;
    administrativeProjectIds: string[];
    adminPurposes: string[];
    projectYears: number[];
    groupedProjectOptions?: { label: string; options: string[] }[];
    filteredProjectOptions?: Array<{ id: string; name: string }>;
    projectPurposesByProject?: Record<string, string[]>;
}

export function BatchCategoryModal({
    isOpen,
    onClose,
    onSuccess,
    selectedTransactionIds,
    selectedSplitIds,
    projects,
    members,
    administrativeProjectIds,
    adminPurposes,
    projectYears,
    groupedProjectOptions,
    filteredProjectOptions,
    // groupedProjectOptions, // No longer used
    // filteredProjectOptions, // No longer used
    projectPurposesByProject,
}: BatchCategoryModalProps) {
    const totalSelected = selectedTransactionIds.length + selectedSplitIds.length;
    const currentYear = new Date().getFullYear();

    // Form state – each field can be toggled on/off to include in batch update
    const [enableCategory, setEnableCategory] = useState(true);
    const [category, setCategory] = useState<CategoryType>('Projects & Activities');
    const [enableYear, setEnableYear] = useState(false);
    const [year, setYear] = useState<number>(currentYear);
    const [enableProjectId, setEnableProjectId] = useState(false);
    const [projectId, setProjectId] = useState('');
    const [enableMemberId, setEnableMemberId] = useState(false);
    const [memberId, setMemberId] = useState('');
    const [enablePurpose, setEnablePurpose] = useState(false);
    const [purpose, setPurpose] = useState('');
    const [enablePaymentRequestId, setEnablePaymentRequestId] = useState(false);
    const [paymentRequestId, setPaymentRequestId] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setEnableCategory(true);
            setCategory('Projects & Activities');
            setEnableYear(false);
            setYear(currentYear);
            setEnableProjectId(false);
            setProjectId('');
            setEnableMemberId(false);
            setMemberId('');
            setEnablePurpose(false);
            setPurpose('');
            setEnablePaymentRequestId(false);
            setPaymentRequestId('');
            setError(null);
        }
    }, [isOpen, currentYear]);

    // Handle category change: clear incompatible fields like the original logic
    const handleCategoryChange = (val: CategoryType) => {
        setCategory(val);
        if (val === 'Membership') {
            setProjectId('');
            setEnableProjectId(false);
            // Purpose will be auto-generated
        } else if (val === 'Administrative') {
            setMemberId('');
            setEnableMemberId(false);
            setPurpose('');
        } else if (val === 'Projects & Activities') {
            setMemberId('');
            setEnableMemberId(false);
            setPurpose('');
        }
    };

    // Filtered project options based on year
    const filteredProjects = useMemo(() => {
        if (!year || isNaN(year)) return projects;
        return projects.filter(p => !p.year || p.year === year);
    }, [projects, year]);

    const groupedProjects = useMemo(() => {
        const grouped: Record<number, string[]> = {};
        const sourceProjects = (category === 'Projects & Activities' && year) ? filteredProjects : projects;

        sourceProjects.forEach(p => {
            const y = p.year || 0;
            if (!grouped[y]) grouped[y] = [];
            grouped[y].push(p.name);
        });
        const sortedYears = Object.keys(grouped)
            .map(y => parseInt(y, 10))
            .sort((a, b) => b - a);

        return sortedYears.map(y => ({
            label: y === 0 ? 'No Year' : String(y),
            options: grouped[y].sort()
        }));
    }, [projects, filteredProjects, year, category]);

    // Auto-generate purpose for Membership category using the same logic as the system
    useEffect(() => {
        if (category === 'Membership' && memberId) {
            const member = members.find(m => m.id === memberId);
            const membershipType = member?.membershipType || 'Full';
            const y = year || currentYear;
            setPurpose(`${y} ${membershipType} membership`);
            setEnablePurpose(true);
        } else if (category !== 'Membership' && enablePurpose) {
            // Clear purpose if category changes from Membership and purpose was auto-enabled
            setPurpose('');
            setEnablePurpose(false);
        }
    }, [category, memberId, year, members, currentYear, enablePurpose]);

    // Clear projectId if it becomes incompatible with the current year filter
    useEffect(() => {
        if (category === 'Projects & Activities' && projectId) {
            const projectExistsInFiltered = filteredProjects.some(p => p.id === projectId);
            if (!projectExistsInFiltered) {
                setProjectId('');
            }
        }
    }, [category, projectId, filteredProjects]);

    // Any field enabled?
    const hasAnyUpdate = enableCategory || enableYear || enableProjectId || enableMemberId || enablePurpose || enablePaymentRequestId;

    const handleSubmit = async () => {
        if (!hasAnyUpdate) {
            setError('Please enable at least one field to update');
            return;
        }
        if (totalSelected === 0) {
            setError('No records selected');
            return;
        }

        setLoading(true);
        setError(null);

        const updates: CategoryUpdates = {};
        if (enableCategory) updates.category = category;
        if (enableYear) updates.year = year;
        if (enableProjectId) updates.projectId = projectId;
        if (enableMemberId) updates.memberId = memberId;
        if (enablePurpose) updates.purpose = purpose;
        if (enablePaymentRequestId) updates.paymentRequestId = paymentRequestId;

        try {
            const errors: string[] = [];

            // Update main transactions
            if (selectedTransactionIds.length > 0) {
                const result = await FinanceService.batchUpdateTransactionCategory(selectedTransactionIds, updates);
                errors.push(...result.errors);
            }

            // Update split records
            if (selectedSplitIds.length > 0) {
                const result = await FinanceService.batchUpdateSplitCategory(selectedSplitIds, updates);
                errors.push(...result.errors);
            }

            if (errors.length > 0) {
                setError(`Completed with ${errors.length} error(s):\n${errors.join('\n')}`);
            } else {
                onSuccess();
                onClose();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to batch update');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Batch Set Transaction Category" size="max-w-2xl">
            <div className="space-y-4">
                {/* Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
                    <Layers size={20} className="text-blue-600 shrink-0" />
                    <div className="text-sm">
                        <span className="font-semibold text-blue-900">
                            {totalSelected} record{totalSelected !== 1 ? 's' : ''} selected
                        </span>
                        <span className="text-blue-600 ml-2">
                            ({selectedTransactionIds.length} main transaction{selectedTransactionIds.length !== 1 ? 's' : ''},
                            {' '}{selectedSplitIds.length} split{selectedSplitIds.length !== 1 ? 's' : ''})
                        </span>
                    </div>
                </div>

                <p className="text-xs text-slate-500">
                    Toggle the checkbox to include each field in the batch update. Only enabled fields will be modified.
                </p>

                {/* Category */}
                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                    <input
                        type="checkbox"
                        checked={enableCategory}
                        onChange={(e) => setEnableCategory(e.target.checked)}
                        className="mt-1 accent-blue-600"
                    />
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                        <Forms.Select
                            value={category}
                            onChange={(e) => handleCategoryChange(e.target.value as CategoryType)}
                            disabled={!enableCategory}
                            options={[
                                { label: 'Projects & Activities', value: 'Projects & Activities' },
                                { label: 'Membership', value: 'Membership' },
                                { label: 'Administrative', value: 'Administrative' },
                            ]}
                        />
                    </div>
                </div>

                {/* Year */}
                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                    <input
                        type="checkbox"
                        checked={enableYear}
                        onChange={(e) => setEnableYear(e.target.checked)}
                        className="mt-1 accent-blue-600"
                    />
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                        <Forms.Input
                            type="number"
                            value={String(year)}
                            onChange={(e) => setYear(parseInt(e.target.value, 10) || currentYear)}
                            disabled={!enableYear}
                            placeholder="e.g. 2024"
                        />
                        {category === 'Projects & Activities' && (
                            <p className="text-[10px] text-slate-400 mt-1 italic">
                                * Filters the project list below
                            </p>
                        )}
                    </div>
                </div>

                {/* Project / Admin Account / Member */}
                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                    <input
                        type="checkbox"
                        checked={category === 'Membership' ? enableMemberId : enableProjectId}
                        onChange={(e) => {
                            if (category === 'Membership') {
                                setEnableMemberId(e.target.checked);
                            } else {
                                setEnableProjectId(e.target.checked);
                            }
                        }}
                        className="mt-1 accent-blue-600"
                    />
                    <div className="flex-1">
                        {category === 'Membership' ? (
                            <>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Member</label>
                                <Combobox
                                    options={members.map(m => m.name)}
                                    value={members.find(m => m.id === memberId)?.name || ''}
                                    onChange={(value) => {
                                        const m = members.find(x => x.name === value);
                                        setMemberId(m?.id || value);
                                    }}
                                    disabled={!enableMemberId}
                                    placeholder="Select member..."
                                />
                            </>
                        ) : category === 'Projects & Activities' ? (
                            <>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                                <Combobox
                                    groupedOptions={groupedProjects}
                                    value={projects.find(p => p.id === projectId)?.name || ''}
                                    onChange={(value) => {
                                        const project = projects.find(p => p.name === value);
                                        setProjectId(project?.id || '');
                                    }}
                                    disabled={!enableProjectId}
                                    placeholder="Select project..."
                                />
                            </>
                        ) : (
                            <>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Admin Account</label>
                                <Combobox
                                    options={['', ...administrativeProjectIds]}
                                    value={projectId}
                                    onChange={(value) => setProjectId(value)}
                                    disabled={!enableProjectId}
                                    placeholder="Select admin account..."
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* Purpose */}
                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                    <input
                        type="checkbox"
                        checked={enablePurpose}
                        onChange={(e) => setEnablePurpose(e.target.checked)}
                        className="mt-1 accent-blue-600"
                    />
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
                        {category === 'Administrative' ? (
                            <Combobox
                                options={adminPurposes}
                                value={purpose}
                                onChange={(value) => setPurpose(value)}
                                placeholder="Select or type purpose..."
                            />
                        ) : category === 'Membership' ? (
                            <Forms.Input
                                value={purpose}
                                readOnly
                                disabled
                                className="bg-slate-50"
                            />
                        ) : (
                            <Combobox
                                options={projectPurposesByProject?.[projectId] || []}
                                value={purpose}
                                onChange={(value) => setPurpose(value)}
                                placeholder="Select or type purpose..."
                            />
                        )}
                    </div>
                </div>

                {/* Payment Request ID */}
                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                    <input
                        type="checkbox"
                        checked={enablePaymentRequestId}
                        onChange={(e) => setEnablePaymentRequestId(e.target.checked)}
                        className="mt-1 accent-blue-600"
                    />
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Payment Request ID</label>
                        <Forms.Input
                            value={paymentRequestId}
                            onChange={(e) => setPaymentRequestId(e.target.value)}
                            disabled={!enablePaymentRequestId}
                            placeholder="e.g. PR-default-lo-20250216-001"
                        />
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm whitespace-pre-wrap">
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !hasAnyUpdate || totalSelected === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        <CheckSquare size={16} />
                        {loading ? 'Applying...' : `Apply to ${totalSelected} Record${totalSelected !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default BatchCategoryModal;
