import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { MyProfileSelfView } from '../modules/Members/MyProfileSelfView';

/**
 * Own profile for external users (AFFILIATE / CHAPTER_ADMIN). Rendered from the signed-in member
 * (`useAuth().member`), so no members list query runs (the rules only allow externals to read their own doc).
 */
export const ExternalSelfProfile: React.FC = () => {
  const { member, updateMemberProfile } = useAuth();
  if (!member) return null;
  return <MyProfileSelfView member={member} onSave={updateMemberProfile} />;
};
