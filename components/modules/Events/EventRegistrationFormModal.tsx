import React from 'react';
import { Button, Modal } from '../../ui/Common';

export interface RegistrationFormData {
  dietary: 'normal' | 'vegetarian' | 'halal';
  emergencyContactName: string;
  emergencyContactPhone: string;
  tshirtSize: string;
}

interface EventRegistrationFormModalProps {
  isOpen: boolean;
  form: RegistrationFormData;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormChange: React.Dispatch<React.SetStateAction<RegistrationFormData>>;
}

const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL', '7XL'] as const;
const DIETARY_OPTIONS = ['normal', 'vegetarian', 'halal'] as const;

export const EventRegistrationFormModal: React.FC<EventRegistrationFormModalProps> = ({
  isOpen,
  form,
  submitting,
  onClose,
  onSubmit,
  onFormChange,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="活动报名"
      size="sm"
      footer={
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={onSubmit} disabled={submitting}>确认报名</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            饮食要求 <span className="normal-case font-normal">Dietary Preference</span>
          </label>
          <div className="flex gap-2">
            {DIETARY_OPTIONS.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => onFormChange(current => ({ ...current, dietary: option }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.dietary === option ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-jci-blue/40'}`}
              >
                {option === 'normal' ? 'Normal' : option === 'vegetarian' ? '🌿 Veg' : '☪️ Halal'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            紧急联络人姓名 <span className="normal-case font-normal">Emergency Contact</span>
          </label>
          <input
            type="text"
            value={form.emergencyContactName}
            onChange={event => onFormChange(current => ({ ...current, emergencyContactName: event.target.value }))}
            placeholder="Full name"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            紧急联络人电话 <span className="normal-case font-normal">Emergency Phone</span>
          </label>
          <input
            type="tel"
            value={form.emergencyContactPhone}
            onChange={event => onFormChange(current => ({ ...current, emergencyContactPhone: event.target.value }))}
            placeholder="+60 12-345 6789"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            衣服尺码 <span className="normal-case font-normal">T-Shirt Size</span>
          </label>
          <select
            value={form.tshirtSize}
            onChange={event => onFormChange(current => ({ ...current, tshirtSize: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue bg-white"
          >
            <option value="">-- 请选择 --</option>
            {TSHIRT_SIZES.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
};
