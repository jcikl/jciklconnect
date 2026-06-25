import React from 'react';
import { BatchImportModal } from '../../shared/batchImport/BatchImportModal';
import { standardImportConfig } from './config/standardImportConfig';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onImported: () => void;
    programId: string;
}

export const StandardBatchImportModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onImported,
    programId
}) => {
    return (
        <BatchImportModal
            isOpen={isOpen}
            onClose={onClose}
            config={standardImportConfig}
            onImported={onImported}
            context={{ programId }}
        />
    );
};
