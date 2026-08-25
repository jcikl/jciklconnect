import React, { useEffect, useState, type FormEvent } from 'react';
import { Button, Modal } from '../../ui/Common';
import { Input, Select, Textarea } from '../../ui/Form';
import type { InventoryItem, MaintenanceSchedule } from '../../../types';

interface InventoryMaintenanceScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: MaintenanceSchedule | null;
  items: InventoryItem[];
  members: any[];
  onSave: (schedule: Omit<MaintenanceSchedule, 'id'>) => Promise<string | void>;
  drawerOnMobile?: boolean;
  bottomSheet?: boolean;
}

export const InventoryMaintenanceScheduleModal: React.FC<InventoryMaintenanceScheduleModalProps> = ({
  isOpen,
  onClose,
  schedule,
  items,
  members,
  onSave,
  drawerOnMobile,
  bottomSheet,
}) => {
  const getInitialFormData = () => ({
    itemId: schedule?.itemId || '',
    type: (schedule?.type || 'Preventive') as 'Preventive' | 'Corrective' | 'Inspection' | 'Calibration',
    frequency: schedule?.frequency || 'Monthly',
    customDays: schedule?.customDays || undefined,
    assignedTo: schedule?.assignedTo || '',
    notes: schedule?.notes || '',
    active: schedule?.active !== undefined ? schedule.active : true,
  });

  const [formData, setFormData] = useState(getInitialFormData);

  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormData());
    }
  }, [isOpen, schedule]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await onSave({
        ...formData,
        lastMaintained: schedule?.lastMaintained,
        nextMaintenanceDate: schedule?.nextMaintenanceDate || new Date().toISOString(),
      });
    } catch (err) {
      // Error handled in parent.
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={schedule ? 'Edit Maintenance Schedule' : 'Create Maintenance Schedule'}
      bottomSheet={bottomSheet}
      drawerOnMobile={drawerOnMobile}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" type="button" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" form="maintenance-schedule-form" className="flex-1">Save Schedule</Button>
        </div>
      }
    >
      <form id="maintenance-schedule-form" onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Item"
          value={formData.itemId}
          onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
          options={[
            { label: 'Select item...', value: '' },
            ...items.map(item => ({ label: item.name, value: item.id })),
          ]}
          required
        />
        <Select
          label="Maintenance Type"
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Preventive' | 'Corrective' | 'Inspection' | 'Calibration' })}
          options={[
            { label: 'Preventive', value: 'Preventive' },
            { label: 'Corrective', value: 'Corrective' },
            { label: 'Inspection', value: 'Inspection' },
            { label: 'Calibration', value: 'Calibration' },
          ]}
          required
        />
        <Select
          label="Frequency"
          value={formData.frequency}
          onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
          options={[
            { label: 'Daily', value: 'Daily' },
            { label: 'Weekly', value: 'Weekly' },
            { label: 'Monthly', value: 'Monthly' },
            { label: 'Quarterly', value: 'Quarterly' },
            { label: 'Semi-Annual', value: 'Semi-Annual' },
            { label: 'Annual', value: 'Annual' },
            { label: 'Custom', value: 'Custom' },
          ]}
          required
        />
        {formData.frequency === 'Custom' && (
          <Input
            label="Custom Days"
            type="number"
            value={formData.customDays?.toString() || ''}
            onChange={(e) => setFormData({ ...formData, customDays: parseInt(e.target.value) || undefined })}
            placeholder="Number of days"
            required
          />
        )}
        <Select
          label="Assigned To (Optional)"
          value={formData.assignedTo}
          onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
          options={[
            { label: 'Unassigned', value: '' },
            ...members.map(m => ({ label: m.name, value: m.id })),
          ]}
        />
        <Textarea
          label="Notes (Optional)"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
          rows={3}
        />
      </form>
    </Modal>
  );
};
