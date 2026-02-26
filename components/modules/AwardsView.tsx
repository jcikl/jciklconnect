import React from 'react';
import { AwardsManagementView } from './AwardsManagementView';

interface AwardsViewProps {
    searchQuery?: string;
}

export const AwardsView: React.FC<AwardsViewProps> = ({ searchQuery }) => {
    return (
        <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto py-4">
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <AwardsManagementView searchQuery={searchQuery} />
            </div>
        </div>
    );
};
