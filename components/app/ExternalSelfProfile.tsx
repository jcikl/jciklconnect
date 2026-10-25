import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { MemberDetail } from '../modules/Members/MemberDetail';

/**
 * Own profile for external users (AFFILIATE / CHAPTER_ADMIN): the same MemberDetail self view KL members get,
 * rendered from the signed-in member (`useAuth().member`, kept live by its own-doc listener), so no members
 * list query runs. MemberDetail skips KL-only loads and tabs for externals (utils/externalAccess.ts canRunLoader).
 */
export const ExternalSelfProfile: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { member } = useAuth();
  if (!member) return null;
  return (
    <div className="space-y-6 pb-40 md:pb-0">
      <MemberDetail member={member} onBack={onBack} isSelfView />
    </div>
  );
};
