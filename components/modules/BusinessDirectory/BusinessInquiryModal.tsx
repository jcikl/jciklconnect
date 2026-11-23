import React from 'react';
import { Send } from 'lucide-react';
import type { BusinessProfile, Member } from '../../../types';
import { Button, Modal } from '../../ui/Common';
import { Input, Textarea } from '../../ui/Form';
import type { BusinessInquiryForm } from './useBusinessInquiry';

interface BusinessInquiryModalProps {
  isOpen: boolean;
  business: BusinessProfile | null;
  members?: Member[];
  form: BusinessInquiryForm;
  errors: Record<string, string>;
  submitting: boolean;
  onClose: () => void;
  onFormChange: React.Dispatch<React.SetStateAction<BusinessInquiryForm>>;
  onSubmit: () => void;
}

export const BusinessInquiryModal: React.FC<BusinessInquiryModalProps> = ({
  isOpen,
  business,
  form,
  errors,
  submitting,
  onClose,
  onFormChange,
  onSubmit,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={business ? `Contact ${business.ownerName}` : 'Send inquiry'}
    drawerOnMobile
    size="lg"
  >
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-4">
        <p className="text-sm text-slate-500">
          Fill in your details and requirements. The business owner will contact you shortly.
        </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <label className="w-20 sm:w-28 pt-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Name <span className="text-red-500">*</span></label>
              <div className="flex-1">
                <Input
                  placeholder="Your full name"
                  value={form.name}
                  error={errors.name}
                  onChange={(event) => onFormChange({ ...form, name: event.target.value })}
                />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <label className="w-20 sm:w-28 pt-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Job Title</label>
              <div className="flex-1">
                <Input
                  placeholder="E.g. Managing Director (optional)"
                  value={form.jobTitle}
                  onChange={(event) => onFormChange({ ...form, jobTitle: event.target.value })}
                />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <label className="w-20 sm:w-28 pt-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Company</label>
              <div className="flex-1">
                <Input
                  placeholder="Your company name (optional)"
                  value={form.company}
                  onChange={(event) => onFormChange({ ...form, company: event.target.value })}
                />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <label className="w-20 sm:w-28 pt-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Phone <span className="text-red-500">*</span></label>
              <div className="flex-1">
                <Input
                  placeholder="E.g. +60123456789"
                  value={form.phone}
                  error={errors.phone}
                  onChange={(event) => onFormChange({ ...form, phone: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Requirements <span className="text-red-500">*</span></label>
              <Textarea
                placeholder="What products or services are you looking for?"
                value={form.requirements}
                error={errors.requirements}
                onChange={(event) => onFormChange({ ...form, requirements: event.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white pt-4 pb-2 border-t border-slate-100 mt-6 z-10 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 font-bold"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button className="flex-1 font-bold shadow-lg shadow-jci-blue/20" onClick={onSubmit} disabled={submitting}>
            <Send size={16} className="mr-2" /> {submitting ? 'Sending…' : 'Send Inquiry'}
          </Button>
        </div>
    </div>
  </Modal>
);
