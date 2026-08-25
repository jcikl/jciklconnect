import React from 'react';
import { ConfirmDialog } from '../../ui/Common';
import type { EventRegistration } from '../../../types';

interface EventCancelRegistrationConfirmProps {
  registration: EventRegistration | null;
  onCancel: () => void;
  onConfirm: (registration: EventRegistration) => void;
}

export const EventCancelRegistrationConfirm: React.FC<EventCancelRegistrationConfirmProps> = ({
  registration,
  onCancel,
  onConfirm,
}) => (
  <ConfirmDialog
    open={!!registration}
    title="Cancel Registration"
    message={`Cancel registration for ${registration?.memberName ?? registration?.memberId ?? 'this member'}? This cannot be undone.`}
    confirmLabel="Cancel Registration"
    cancelLabel="Go Back"
    variant="danger"
    onConfirm={() => {
      if (registration) onConfirm(registration);
    }}
    onCancel={onCancel}
  />
);
