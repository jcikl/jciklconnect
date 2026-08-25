import { useEffect, useState } from 'react';
import type { BusinessProfile, Member } from '../../../types';
import { submitInquiry } from '../../../services/inquiryService';

export interface BusinessInquiryForm {
  name: string;
  jobTitle: string;
  company: string;
  phone: string;
  requirements: string;
}

interface UseBusinessInquiryParams {
  businesses: BusinessProfile[];
  members: Member[];
  currentUser: Member | null;
  initialSelectedBusinessId?: string | null;
  onClearSelection?: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const createPrefilledInquiryForm = (currentUser: Member | null): BusinessInquiryForm => ({
  name: currentUser?.general?.name || '',
  jobTitle: currentUser?.business?.position || '',
  company: currentUser?.companyName || '',
  phone: currentUser?.contact?.phone || '',
  requirements: '',
});

export const useBusinessInquiry = ({
  businesses,
  members,
  currentUser,
  initialSelectedBusinessId,
  onClearSelection,
  showToast,
}: UseBusinessInquiryParams) => {
  const [selectedBiz, setSelectedBiz] = useState<BusinessProfile | null>(null);
  const [isInquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquiryForm, setInquiryForm] = useState<BusinessInquiryForm>(() => createPrefilledInquiryForm(null));
  const [inquiryErrors, setInquiryErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openInquiryForBusiness = (business: BusinessProfile) => {
    setSelectedBiz(business);
    setInquiryForm(createPrefilledInquiryForm(currentUser));
    setInquiryErrors({});
    setInquiryModalOpen(true);
  };

  useEffect(() => {
    if (initialSelectedBusinessId && businesses.length > 0) {
      const bizToSelect = businesses.find(business => business.id === initialSelectedBusinessId);
      if (bizToSelect) {
        openInquiryForBusiness(bizToSelect);
        if (onClearSelection) onClearSelection();
      }
    }
  }, [initialSelectedBusinessId, businesses, currentUser, onClearSelection]);

  const handleSendInquiry = async () => {
    const errors: Record<string, string> = {};
    if (!inquiryForm.name.trim()) errors.name = 'Name is required';
    if (!inquiryForm.phone.trim()) errors.phone = 'Phone number is required';
    if (!inquiryForm.requirements.trim()) errors.requirements = 'Requirements are required';

    if (Object.keys(errors).length > 0) {
      setInquiryErrors(errors);
      return;
    }

    if (!selectedBiz || !currentUser) return;
    setIsSubmitting(true);

    try {
      const recipient = members.find(member => member.id === selectedBiz.memberId);
      const recipientPhone = recipient?.contact?.phone || '';
      const recipientInGroup = recipient?.contact?.whatsappJoined ?? false;
      const senderInGroup = currentUser.contact?.whatsappJoined ?? false;

      const { channel, waUrl } = await submitInquiry({
        senderId: currentUser.id,
        senderName: inquiryForm.name,
        senderPhone: inquiryForm.phone,
        senderJobTitle: inquiryForm.jobTitle || undefined,
        senderCompany: inquiryForm.company || undefined,
        senderInGroup,
        recipientId: selectedBiz.memberId,
        recipientName: selectedBiz.ownerName,
        recipientPhone,
        recipientInGroup,
        businessId: selectedBiz.id,
        businessName: selectedBiz.companyName,
        requirements: inquiryForm.requirements,
      });

      setInquiryModalOpen(false);
      setSelectedBiz(null);

      if (channel === 'whatsapp_direct' && waUrl) {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
        showToast('Opening WhatsApp — your message is pre-filled!', 'success');
      } else if (channel === 'whapi_bot') {
        showToast('Inquiry sent! The member and admin will be notified via WhatsApp.', 'success');
      } else {
        showToast('Inquiry recorded. Admin has been notified via WhatsApp.', 'success');
      }
    } catch (error) {
      console.error('Inquiry submission error:', error);
      showToast('Failed to send inquiry. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    selectedBiz,
    setSelectedBiz,
    isInquiryModalOpen,
    setInquiryModalOpen,
    inquiryForm,
    setInquiryForm,
    inquiryErrors,
    isSubmitting,
    openInquiryForBusiness,
    handleSendInquiry,
  };
};
