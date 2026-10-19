import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { getExternalStatusMessage } from '../../utils/externalAccess';
import type { AffiliationStatus } from '../../types/member';

/** Shown to external users whose affiliation is not active (pending / suspended / expired). */
export const ExternalAccessNotice: React.FC<{ status?: AffiliationStatus | null }> = ({ status }) => {
  const { title, description } = getExternalStatusMessage(status);
  return (
    <div className="mx-auto max-w-md py-10">
      <EmptyState title={title} description={description} icon={<ShieldAlert size={20} />} />
    </div>
  );
};
