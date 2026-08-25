import React from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import type { Member } from '../../../types';
import { Button } from '../../ui/Common';
import { MemberSelector } from '../../ui/MemberSelector';

export interface EventAddParticipantFormData {
  dietary: 'normal' | 'vegetarian' | 'halal';
  tshirtSize: string;
}

interface EventAddParticipantFormProps {
  members: Member[];
  participationsMemberIds: Set<string>;
  value: string;
  form: EventAddParticipantFormData;
  adding: boolean;
  onMemberChange: (memberId: string, member?: Member) => void;
  onFormChange: React.Dispatch<React.SetStateAction<EventAddParticipantFormData>>;
  onConfirm: () => void;
  onCancel: () => void;
}

export const EventAddParticipantForm: React.FC<EventAddParticipantFormProps> = ({
  members,
  participationsMemberIds,
  value,
  form,
  adding,
  onMemberChange,
  onFormChange,
  onConfirm,
  onCancel,
}) => (
  <div className="px-3 py-3 bg-blue-50/40 space-y-2">
    <div className="flex items-center gap-2 mb-1">
      <div className="w-8 h-8 rounded-lg bg-jci-blue/10 flex items-center justify-center shrink-0">
        <Plus size={14} className="text-jci-blue" />
      </div>
      <span className="text-sm font-semibold text-slate-700">Add Participant</span>
    </div>
    <MemberSelector
      members={members.filter(member => !participationsMemberIds.has(member.id))}
      value={value}
      onChange={(memberId) => {
        onMemberChange(memberId, members.find(member => member.id === memberId));
      }}
      placeholder="Search members..."
    />
    <div className="flex gap-1.5">
      {(['normal', 'vegetarian', 'halal'] as const).map(option => (
        <button
          key={option}
          type="button"
          onClick={() => onFormChange(current => ({ ...current, dietary: option }))}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.dietary === option ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-jci-blue/40'}`}
        >
          {option === 'normal' ? 'Normal' : option === 'vegetarian' ? '🌿 Veg' : '☪️ Halal'}
        </button>
      ))}
    </div>
    <select
      value={form.tshirtSize}
      onChange={event => onFormChange(current => ({ ...current, tshirtSize: event.target.value }))}
      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue bg-white"
    >
      <option value="">T-Shirt Size (optional)</option>
      {(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL', '7XL'] as const).map(size => (
        <option key={size} value={size}>{size}</option>
      ))}
    </select>
    <div className="flex gap-2">
      <Button size="sm" className="flex-1" disabled={!value || adding} onClick={onConfirm}>
        {adding ? <RefreshCw size={12} className="animate-spin mr-1" /> : null}
        Confirm
      </Button>
      <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
    </div>
  </div>
);
