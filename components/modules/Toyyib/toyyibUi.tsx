import React from 'react';
import { Briefcase, Users } from 'lucide-react';
import type { ToyyibCategory } from '../../../services/toyyibService';

export function billStatusBadge(billpaymentStatus: string) {
  switch (billpaymentStatus) {
    case '1': return { variant: 'success' as const, label: 'PAID' };
    case '3': return { variant: 'error' as const, label: 'FAILED' };
    default: return { variant: 'warning' as const, label: 'PENDING' };
  }
}

export function linkedLabel(cat: ToyyibCategory) {
  if (cat.linkedType === 'membership') {
    return {
      icon: <Users size={10} />,
      text: `Membership · ${cat.membershipType || ''}`,
      color: 'bg-purple-50 text-purple-700',
    };
  }

  if (cat.linkedType === 'project' && cat.linkedProjectName) {
    return {
      icon: <Briefcase size={10} />,
      text: cat.linkedProjectName,
      color: 'bg-blue-50 text-blue-700',
    };
  }

  return null;
}
