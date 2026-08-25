import React, { useEffect, useState } from 'react';

interface BusinessBookmarkUser {
  id?: string;
  bookmarkedBusinessIds?: string[];
}

interface UseBusinessBookmarksParams {
  currentUser: BusinessBookmarkUser | null | undefined;
  updateMemberProfile: (updates: { bookmarkedBusinessIds: string[] }) => Promise<unknown>;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const useBusinessBookmarks = ({
  currentUser,
  updateMemberProfile,
  showToast,
}: UseBusinessBookmarksParams) => {
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentUser?.bookmarkedBusinessIds) {
      setBookmarkedIds(new Set(currentUser.bookmarkedBusinessIds));
    }
  }, [currentUser?.id, currentUser?.bookmarkedBusinessIds]);

  const toggleBookmark = async (event: React.MouseEvent, bizId: string) => {
    event.stopPropagation();
    if (!currentUser) return;
    const previous = bookmarkedIds;
    const next = new Set(bookmarkedIds);
    if (next.has(bizId)) next.delete(bizId); else next.add(bizId);
    setBookmarkedIds(next);
    try {
      await updateMemberProfile({ bookmarkedBusinessIds: Array.from(next) });
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
