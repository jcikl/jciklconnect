import { useEffect, useState } from 'react';
import type { Member } from '../../../types';
import type { RegistrationFormData } from './EventRegistrationFormModal';

interface UseEventRegistrationFormOptions {
  member: Member | null;
  onRegister: (formData: RegistrationFormData) => void | Promise<void>;
  onRegisteredOptimistic: () => void;
}

const createInitialRegistrationForm = (member: Member | null): RegistrationFormData => ({
  dietary: (member?.general?.dietaryPreference as 'normal' | 'vegetarian' | 'halal') ?? 'normal',
  emergencyContactName: member?.contact?.emergency?.name ?? '',
  emergencyContactPhone: member?.contact?.emergency?.phone ?? '',
  tshirtSize: member?.tshirtSize ?? '',
});

export const useEventRegistrationForm = ({
  member,
  onRegister,
  onRegisteredOptimistic,
}: UseEventRegistrationFormOptions) => {
  const [showRegForm, setShowRegForm] = useState(false);
  const [isRegSubmitting, setIsRegSubmitting] = useState(false);
  const [regForm, setRegForm] = useState<RegistrationFormData>(() => createInitialRegistrationForm(member));

  useEffect(() => {
    setRegForm(createInitialRegistrationForm(member));
  }, [member?.id]);

  const handleOpenRegForm = () => setShowRegForm(true);
  const handleCloseRegForm = () => setShowRegForm(false);

  const handleRegFormSubmit = async () => {
    if (isRegSubmitting) return;
    setIsRegSubmitting(true);
    try {
      setShowRegForm(false);
      onRegisteredOptimistic();
      await onRegister(regForm);
    } finally {
      setIsRegSubmitting(false);
    }
  };

  return {
    showRegForm,
    isRegSubmitting,
    regForm,
    setRegForm,
    handleOpenRegForm,
    handleCloseRegForm,
    handleRegFormSubmit,
  };
};
