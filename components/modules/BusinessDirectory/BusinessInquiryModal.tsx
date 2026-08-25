import React from 'react';
import { Globe, Send } from 'lucide-react';
import type { BusinessProfile, Member } from '../../../types';
import { Badge, Button, Modal } from '../../ui/Common';
import { Input, Textarea } from '../../ui/Form';
import { getInitialsSvg } from './businessDirectoryUtils';
import type { BusinessInquiryForm } from './useBusinessInquiry';

interface BusinessInquiryModalProps {
  isOpen: boolean;
  business: BusinessProfile | null;
  members: Member[];
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
  members,
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
    title={business ? business.companyName : 'Inquiry'}
    drawerOnMobile
    size="2xl"
  >
    <div className={business ? 'grid md:grid-cols-2 gap-6' : 'space-y-4'}>
      {business && (
        <div className="space-y-4 border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-6">
          <div className="flex items-start gap-4 mb-4 mt-2">
            <img
              src={business.logo || getInitialsSvg(business.companyName || '')}
              alt={business.companyName}
              className="w-16 h-16 rounded-lg object-cover border border-slate-200 shadow-sm"
            />
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-900 leading-tight">{business.ownerName}</h3>
              <p className="text-sm text-slate-500 font-medium truncate">{business.companyName}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="neutral" className="text-[10px] px-1.5 py-0">{business.industry}</Badge>
                {business.website && (
                  <a
                    href={business.website.startsWith('http') ? business.website : `https://${business.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-jci-blue hover:text-sky-600 hover:underline flex items-center gap-1 font-black uppercase tracking-widest transition-colors"
                  >
                    <Globe size={10} /> Visit Site
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 text-sm mt-2">
            <div>
              <span className="font-bold text-slate-700 block mb-1 uppercase text-[10px] tracking-widest">About</span>
              <p className="text-slate-600 leading-relaxed min-h-[60px]">{business.description || 'No description provided.'}</p>
            </div>

            <div className="pt-3 border-t border-slate-50">
              <span className="font-bold text-slate-700 block mb-2 uppercase text-[10px] tracking-widest">Categories</span>
              <div className="flex flex-wrap gap-1.5">
                {business.businessCategory ? (
                  business.businessCategory.split(', ').map((category, index) => (
                    <Badge key={index} variant="info" className="bg-blue-50/50 text-blue-600 border border-blue-100">{category}</Badge>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400 italic">No specific categories listed</span>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-50">
              <span className="font-bold text-slate-700 block mb-2 uppercase text-[10px] tracking-widest">Interested Industries</span>
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const owner = members.find(member => member.id === business.memberId);
                  const industries = owner?.business?.interestedIndustries;
                  return (Array.isArray(industries) && industries.length > 0) ? (
                    industries.map((industry: string, index: number) => (
                      <Badge key={index} variant="neutral" className="bg-purple-50/50 text-purple-600 border border-purple-100 font-bold">{industry}</Badge>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Exploring various industries and connections</span>
                  );
                })()}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-50">
              <span className="font-bold text-slate-700 block mb-2 uppercase text-[10px] tracking-widest">Seeking Partnerships</span>
              <div className="flex flex-wrap gap-1.5">
                {business.internationalPartnershipTypes && business.internationalPartnershipTypes.length > 0 ? (
                  business.internationalPartnershipTypes.map((type, index) => (
                    <Badge key={index} variant="neutral" className="bg-sky-50/50 text-sky-600 border border-sky-100 font-bold">{type}</Badge>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400 italic">Open to all partnership opportunities</span>
                )}
              </div>
            </div>

            {business.offer && (
              <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 rounded-xl p-4 shadow-inner">
                <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                  JCI Member Deal
                </span>
                <p className="text-slate-700 font-medium leading-relaxed">{business.offer}</p>
                {business.offerTerms && (
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed"><span className="font-semibold">T&C:</span> {business.offerTerms}</p>
                )}
                {business.offerExpiry && (
                  <p className="text-xs text-slate-400 mt-1">Valid until {business.offerExpiry}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col h-full">
        <div className="flex-1 space-y-4">
          {business ? (
            <div className="mb-4 mt-2">
              <h4 className="font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Send size={18} className="text-jci-blue" /> Submit Inquiry
              </h4>
              <p className="text-xs text-slate-500 mt-3 font-medium">
                Please fill in your details and requirements. The business owner will contact you shortly.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-4">
              Please fill in your details and requirements. The business owner will contact you shortly.
            </p>
          )}

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
    </div>
  </Modal>
);
