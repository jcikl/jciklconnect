import React, { useState } from 'react';
import { Modal, Button } from '../../ui/Common';
import { Select, Input } from '../../ui/Form';
import { UserRole } from '../../../types';
import type { Member } from '../../../types';

interface BatchFieldUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onApply: (updates: Partial<Member>) => Promise<void>;
}

const FIELD_OPTIONS = [
  { label: 'Select field...', value: '' },
  { label: 'Introducer', value: 'introducer' },
  { label: 'Cut Style', value: 'cutStyle' },
  { label: 'T-Shirt Size', value: 'tshirtSize' },
  { label: 'Jacket Size', value: 'jacketSize' },
  { label: 'Role', value: 'role' },
];

const CUT_STYLE_OPTIONS = ['Unisex', 'Lady Cut'].map(v => ({ label: v, value: v }));
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL', '7XL'].map(v => ({ label: v, value: v }));
const ROLE_OPTIONS = [
  UserRole.GUEST, UserRole.MEMBER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INACTIVE,
].map(r => ({ label: r, value: r }));

export const BatchFieldUpdateModal: React.FC<BatchFieldUpdateModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  onApply,
}) => {
  const [field, setField] = useState('');
  const [value, setValue] = useState<string>('');
  const [applying, setApplying] = useState(false);

  const handleClose = () => {
    setField('');
    setValue('');
    onClose();
  };

  const handleApply = async () => {
    if (!field || !value) return;
    setApplying(true);
    try {
      await onApply({ [field]: value } as Partial<Member>);
      handleClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Batch Set Fields"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button disabled={!field || !value || applying} onClick={handleApply}>
            {applying ? 'Applying...' : `Apply to ${selectedCount} members`}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Field to Set</label>
          <Select
            options={FIELD_OPTIONS}
            value={field}
            onChange={e => { setField(e.target.value); setValue(''); }}
          />
        </div>

        {field && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">Value</label>
            {field === 'introducer' ? (
              <Input value={value} onChange={e => setValue(e.target.value)} placeholder="Enter introducer name" />
            ) : field === 'role' ? (
              <Select options={ROLE_OPTIONS} value={value} onChange={e => setValue(e.target.value)} />
            ) : field === 'cutStyle' ? (
              <Select options={CUT_STYLE_OPTIONS} value={value} onChange={e => setValue(e.target.value)} />
            ) : (
              <Select options={SIZE_OPTIONS} value={value} onChange={e => setValue(e.target.value)} />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
