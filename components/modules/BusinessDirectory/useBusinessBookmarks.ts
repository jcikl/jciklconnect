import React, { useEffect, useState } from 'react';
import type { Member } from '../../../types';

interface BusinessBookmarkUser {
  id?: string;
  business?: {
    bookmarkedBusinessIds?: string[];
  };
  bookmarkedBusinessIds?: string[];
}

interface UseBusinessBookmarksParams {
  currentUser: BusinessBookmarkUser | null | undefined;
  updateMemberProfile: (updates: Partial<Member>) => Promise<unknown>;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const useBusinessBookmarks = ({
  currentUser,
  updateMemberProfile,
  showToast,
}: UseBusinessBookmarksParams) => {
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = currentUser?.business?.bookmarkedBusinessIds ?? currentUser?.bookmarkedBusinessIds;
    if (ids) {
      setBookmarkedIds(new Set(ids));
    }
  }, [currentUser?.id, currentUser?.business?.bookmarkedBusinessIds, currentUser?.bookmarkedBusinessIds]);

  const toggleBookmark = async (event: React.MouseEvent, bizId: string) => {
    event.stopPropagation();
    if (!currentUser) return;
    const previous = bookmarkedIds;
    const next = new Set(bookmarkedIds);
    if (next.has(bizId)) next.delete(bizId); else next.add(bizId);
    setBookmarkedIds(next);
    try {
      await updateMemberProfile({
        // currentUser.business is the member's full business record; the write merges.
        business: {
          ...currentUser.business,
          bookmarkedBusinessIds: Array.from(next),
        } as Member['business'],
      });
    } catch {
      setBookmarkedIds(previous);
      showToast('Failed to update bookmark', 'error');
    }
  };

  return {
    bookmarkedIds,
    toggleBookmark,
  };
};
