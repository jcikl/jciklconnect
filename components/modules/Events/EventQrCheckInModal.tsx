import React from 'react';
import { Modal } from '../../ui/Common';
import { EventQRCheckIn } from './EventQRCheckIn';

interface EventQrCheckInModalProps {
  isOpen: boolean;
  eventId: string;
  eventName: string;
  checkedInCount: number;
  onClose: () => void;
}

export const EventQrCheckInModal: React.FC<EventQrCheckInModalProps> = ({
  isOpen,
  eventId,
  eventName,
  checkedInCount,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen onClose={onClose} title="Check-In QR Code" size="sm">
      <EventQRCheckIn
        eventId={eventId}
        eventName={eventName}
        checkedInCount={checkedInCount}
      />
    </Modal>
  );
};
