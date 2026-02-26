import React, { useState, useEffect } from 'react';
import { Card, Button } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { PointsService } from '../../services/pointsService';
import { IncentiveStandard } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../ui/Common';

export const SubmitEvidenceView: React.FC = () => {
    const [standards, setStandards] = useState<IncentiveStandard[]>([]);
    const { member } = useAuth();
    const { showToast } = useToast();

    useEffect(() => {
        PointsService.getStandards('2026_MY').then(setStandards).catch(console.error);
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!member) {
            showToast('You must be logged in to submit evidence.', 'error');
            return;
        }

        const formData = new FormData(e.currentTarget);
        const standardId = formData.get('standardId') as string;
        const evidenceText = formData.get('evidenceText') as string;

        try {
            await PointsService.submitIncentiveClaim({
                standardId,
                loId: member.loId || 'default-lo',
                memberId: member.id,
                quantity: 1,
                evidenceText,
                evidenceFiles: [],
            });
            showToast('Evidence submitted successfully for verification', 'success');
            e.currentTarget.reset();
        } catch (err) {
            showToast('Failed to submit evidence', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <Card title="Submit Evidence (Quest Board)">
                <p className="text-sm text-slate-500 mb-6">
                    Submit evidence for LO Star Rating requirements. Submissions will be reviewed by the National Board.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
                    <Select
                        name="standardId"
                        label="Claim Type (Standard)"
                        options={standards.map(s => ({
                            label: `${s.title} (${s.milestones?.reduce((acc, m) => acc + m.points, 0) || 0} pts)`,
                            value: s.id
                        }))}
                        required
                    />
                    <Input
                        name="evidenceText"
                        label="Evidence (Link or Description)"
                        placeholder="e.g. Google Drive Link, Facebook Post URL..."
                        required
                    />
                    {/* File input could be added here in the future for actual file uploads */}
                    <div className="pt-4">
                        <Button type="submit" className="w-full">Submit for Verification</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
