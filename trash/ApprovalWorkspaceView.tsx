import React, { useEffect, useState } from 'react';
import { Card, Button, Badge } from '../ui/Common';
import { PointsService } from '../../services/pointsService';
import { IncentiveSubmission } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../ui/Common';
import { Check, X } from 'lucide-react';

export const ApprovalWorkspaceView: React.FC = () => {
    const [pending, setPending] = useState<IncentiveSubmission[]>([]);
    const { member } = useAuth();
    const { showToast } = useToast();

    const loadPending = async () => {
        try {
            const data = await PointsService.getPendingSubmissions();
            setPending(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        loadPending();
    }, []);

    const handleApprove = async (id: string) => {
        if (!member) return;
        try {
            await PointsService.approveClaim(id, 20, member.id); // Simple default 20 points
            showToast('Claim approved', 'success');
            loadPending();
        } catch (err) {
            showToast('Error approving claim', 'error');
        }
    };

    const handleReject = async (id: string) => {
        if (!member) return;
        try {
            await PointsService.rejectClaim(id, 'Incomplete evidence', member.id);
            showToast('Claim rejected', 'success');
            loadPending();
        } catch (err) {
            showToast('Error rejecting claim', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <Card title="Approval Workspace">
                {pending.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <Check className="mx-auto h-12 w-12 text-green-300 mb-4" />
                        <p className="text-lg font-medium text-slate-700">All caught up!</p>
                        <p className="text-sm">There are no pending submissions awaiting your review.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pending.map(sub => (
                            <div key={sub.id} className="flex flex-col md:flex-row justify-between md:items-center p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow">
                                <div className="mb-4 md:mb-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="warning">Pending</Badge>
                                        <span className="text-xs text-slate-500 font-mono">{sub.id}</span>
                                    </div>
                                    <h4 className="font-bold text-slate-900">Standard ID: {sub.standardId}</h4>
                                    <p className="text-sm text-slate-600 mt-1"><span className="font-medium text-slate-700">Evidence:</span> {sub.evidenceText}</p>
                                    <p className="text-xs text-slate-400 mt-1">Submitted: {new Date(sub.submittedAt).toLocaleDateString()}</p>
                                </div>
                                <div className="flex space-x-2 shrink-0">
                                    <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleReject(sub.id)}>
                                        <X size={16} className="mr-1" />
                                        Reject
                                    </Button>
                                    <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApprove(sub.id)}>
                                        <Check size={16} className="mr-1" />
                                        Approve
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};
