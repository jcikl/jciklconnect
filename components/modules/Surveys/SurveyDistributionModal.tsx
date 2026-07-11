import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Modal, Button, useToast } from '../../ui/Common';
import { Checkbox } from '../../ui/Form';
import { Survey } from '../../../services/surveysService';

interface SurveyDistributionModalProps {
    survey: Survey;
    selectedChannels: ('email' | 'in-app' | 'link')[];
    onChannelsChange: (channels: ('email' | 'in-app' | 'link')[]) => void;
    onClose: () => void;
    onDistribute: (survey: Survey) => Promise<void>;
    drawerOnMobile?: boolean;
}

export const SurveyDistributionModal: React.FC<SurveyDistributionModalProps> = ({
    survey,
    selectedChannels,
    onChannelsChange,
    onClose,
    onDistribute,
    drawerOnMobile,
}) => {
    const { showToast } = useToast();
    const [isDistributing, setIsDistributing] = useState(false);

    const handleChannelToggle = (channel: 'email' | 'in-app' | 'link') => {
        if (selectedChannels.includes(channel)) {
            onChannelsChange(selectedChannels.filter(c => c !== channel));
        } else {
            onChannelsChange([...selectedChannels, channel]);
        }
    };

    const handleDistribute = async () => {
        if (selectedChannels.length === 0) {
            showToast('Please select at least one distribution channel', 'error');
            return;
        }

        setIsDistributing(true);
        try {
            await onDistribute(survey);
        } finally {
            setIsDistributing(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`Distribute Survey: ${survey.title}`} size="lg" drawerOnMobile={drawerOnMobile}>
            <div className="space-y-6">
                <div>
                    <p className="text-sm text-slate-600 mb-4">
                        Select the channels through which you want to distribute this survey to your target audience.
                    </p>
                    <div className="text-sm text-slate-500 mb-4">
                        <strong>Target Audience:</strong> {survey.targetAudience}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <Checkbox
                            checked={selectedChannels.includes('in-app')}
                            onChange={() => handleChannelToggle('in-app')}
                        />
                        <div className="flex-1">
                            <div className="font-semibold text-slate-900">In-App Notifications</div>
                            <div className="text-sm text-slate-500">Send notifications to members within the platform</div>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <Checkbox
                            checked={selectedChannels.includes('email')}
                            onChange={() => handleChannelToggle('email')}
                        />
                        <div className="flex-1">
                            <div className="font-semibold text-slate-900">Email</div>
                            <div className="text-sm text-slate-500">Send survey invitation via email to target audience</div>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <Checkbox
                            checked={selectedChannels.includes('link')}
                            onChange={() => handleChannelToggle('link')}
                        />
                        <div className="flex-1">
                            <div className="font-semibold text-slate-900">Shareable Link</div>
                            <div className="text-sm text-slate-500">Generate a shareable link that can be distributed manually</div>
                        </div>
                    </label>
                </div>

                {selectedChannels.includes('link') && survey.shareableLink && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="text-sm font-medium text-blue-900 mb-2">Shareable Link:</div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={survey.shareableLink}
                                className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    navigator.clipboard.writeText(survey.shareableLink || '');
                                    showToast('Link copied to clipboard', 'success');
                                }}
                            >
                                <Share2 size={16} />
                            </Button>
                        </div>
                    </div>
                )}

                <div className="flex gap-3 pt-4 border-t">
                    <Button variant="ghost" onClick={onClose} disabled={isDistributing}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDistribute}
                        disabled={isDistributing || selectedChannels.length === 0}
                        className="flex-1"
                    >
                        {isDistributing ? 'Distributing...' : 'Distribute Survey'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
