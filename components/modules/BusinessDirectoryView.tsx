import React, { useCallback, useMemo, useState } from 'react';

import { useToast } from '../ui/Common';
import { MembersOnlyOverlay } from '../ui/MembersOnlyOverlay';
import { useBusinessDirectory } from '../../hooks/useBusinessDirectory';
import { useMembers } from '../../hooks/useMembers';
import { BusinessProfile } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { BusinessDetailModal } from './BusinessDirectory/BusinessDetailModal';
import { BusinessDirectoryFilterDrawer } from './BusinessDirectory/BusinessDirectoryFilterDrawer';
import { BusinessDirectoryHeader } from './BusinessDirectory/BusinessDirectoryHeader';
import { BusinessInquiryModal } from './BusinessDirectory/BusinessInquiryModal';
import { useSisterChapterMembers } from '../../hooks/useSisterChapterMembers';
import { getInitialsSvg } from './BusinessDirectory/businessDirectoryUtils';
import { useBusinessBookmarks } from './BusinessDirectory/useBusinessBookmarks';
import { useBusinessInquiry } from './BusinessDirectory/useBusinessInquiry';
import { DirectoryList, type DirectoryScore } from './BusinessDirectory/DirectoryList';
import { DirectoryFilterPanel } from './BusinessDirectory/DirectoryFilterPanel';
import { SisterMemberDetailModal } from './BusinessDirectory/SisterMemberDetailModal';
import { useDirectoryFilters } from './BusinessDirectory/useDirectoryFilters';
import { businessToDirectoryItem, cardToDirectoryItem, type DirectoryItem } from './BusinessDirectory/directoryFacets';
import { ShareCardNotice } from './BusinessDirectory/ShareCardNotice';
import { KL_CHAPTER } from '../../utils/internationalCards';

const NO_BUSINESSES: BusinessProfile[] = [];

interface BusinessDirectoryViewProps {
  searchQuery?: string;
  initialSelectedBusinessId?: string | null;
  onClearSelection?: () => void;
  isGuest?: boolean;
  onGuestCta?: () => void;
  /**
   * Externals (AFFILIATE / CHAPTER_ADMIN): member cards only. The local business list is not loaded
   * (it reads the KL members list, which the rules deny them), and without card sharing the whole
   * view is the ShareCardNotice (reciprocity gate).
   */
  cardsOnly?: boolean;
}

export const BusinessDirectoryView: React.FC<BusinessDirectoryViewProps> = ({ searchQuery, initialSelectedBusinessId, onClearSelection, isGuest = false, onGuestCta, cardsOnly = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [detailBiz, setDetailBiz] = useState<BusinessProfile | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [sisterDetail, setSisterDetail] = useState<DirectoryItem | null>(null);

  const { members: rawIntlMembers, chapters, loading: intlLoading, canView: canViewIntl, optIn, optingIn } = useSisterChapterMembers();
  const { businesses: loadedBusinesses, loading: businessesLoading, error } = useBusinessDirectory({ enabled: !cardsOnly });
  const businesses = cardsOnly ? NO_BUSINESSES : loadedBusinesses;
  const loading = cardsOnly ? intlLoading : businessesLoading;
  const { members } = useMembers();
  const { showToast } = useToast();
  const { member: currentUser, updateMemberProfile } = useAuth();

  const { bookmarkedIds, toggleBookmark } = useBusinessBookmarks({
    currentUser,
    updateMemberProfile,
    showToast,
  });

  const {
    selectedBiz,
    isInquiryModalOpen,
    setInquiryModalOpen,
    inquiryForm,
    setInquiryForm,
    inquiryErrors,
    isSubmitting,
    openInquiryForBusiness,
    handleSendInquiry,
  } = useBusinessInquiry({
    businesses,
    members,
    currentUser,
    initialSelectedBusinessId,
    onClearSelection,
    showToast,
  });

  // One list: local businesses + (when the viewer may see cards) sister-chapter member cards.
  const showSister = !isGuest && canViewIntl;
  const businessById = useMemo(() => new Map(businesses.map(b => [b.id, b])), [businesses]);
  const items = useMemo<DirectoryItem[]>(() => {
    const membersById = new Map(members.map(m => [m.id, m]));
    const local = businesses.map(biz => {
      const owner = membersById.get(biz.memberId);
      return businessToDirectoryItem(biz, {
        avatarUrl: owner?.general?.avatarUrl || getInitialsSvg(biz.ownerName || ''),
        chineseName: owner?.general?.chineseName,
        position: owner?.business?.position || 'Representative',
      });
    });
    const sister = showSister ? rawIntlMembers.map(card => cardToDirectoryItem(card, name => getInitialsSvg(name))) : [];
    return [...local, ...sister];
  }, [businesses, members, rawIntlMembers, showSister]);

  const directory = useDirectoryFilters(items, searchQuery || searchTerm);

  // The viewer's own chapter: items from it show no chapter chip (KL viewers: JCI Kuala Lumpur).
  const homeChapter = currentUser?.loId && currentUser.loId !== KL_CHAPTER.id
    ? chapters.find(c => c.id === currentUser.loId)?.name
    : KL_CHAPTER.name;

  // Ideal match: the viewer's ideal referral industries vs the item's industry. Bookmarks: any item
  // (stored on the viewer's own member doc, business.bookmarkedBusinessIds, as member / business ids).
  const idealIndustries = useMemo(() => new Set(
    (currentUser?.idealReferralIndustry ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean),
  ), [currentUser?.idealReferralIndustry]);
  const getScore = useCallback((item: DirectoryItem): DirectoryScore => {
    if (bookmarkedIds.has(item.id)) return 0;
    if (idealIndustries.size > 0 && item.industry && idealIndustries.has(item.industry.toLowerCase())) return 1;
    return 2;
  }, [bookmarkedIds, idealIndustries]);
  const sortedItems = useMemo(
    () => [...directory.filtered].sort((a, b) => (getScore(a) - getScore(b)) || a.name.localeCompare(b.name)),
    [directory.filtered, getScore],
  );

  const openItem = (item: DirectoryItem) => {
    if (item.source === 'sister') { setSisterDetail(item); return; }
    const biz = businessById.get(item.id);
    if (!biz) return;
    setDetailBiz(biz);
    setIsDetailOpen(true);
  };

  // Logged-in GUEST role: mask the directory like the Benefits page (public guest landing page uses isGuest prop instead)
  const isGuestRole = !isGuest && (currentUser?.role || '') === 'GUEST';

  // Externals: reciprocity gate as before, no list until they share their own card (all hooks are above).
  if (cardsOnly && !canViewIntl) return <ShareCardNotice onShare={optIn} sharing={optingIn} />;

  return (
    <div className={`space-y-2 relative${isGuestRole ? ' pt-px' : ''}`}>
      {isGuestRole && (
        <MembersOnlyOverlay
          description="The member business directory is exclusive to JCI Kuala Lumpur members. Join us to connect with local businesses and the global JCI network."
          member={currentUser}
        />
      )}

      <BusinessDirectoryHeader />

      <DirectoryList
        items={sortedItems}
        totalCount={items.length}
        loading={loading}
        error={error}
        isGuest={isGuest}
        homeChapter={homeChapter}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        activeFiltersCount={directory.activeCount}
        onResetFilters={directory.reset}
        onFilterDrawerOpen={() => setIsFilterDrawerOpen(true)}
        filterPanel={(
          <DirectoryFilterPanel
            variant="sidebar"
            filters={directory.filters}
            facets={directory.facets}
            toggleValue={directory.toggleValue}
            toggleFlag={directory.toggleFlag}
            clearSection={directory.clearSection}
          />
        )}
        showShareNotice={!isGuest && !canViewIntl && !cardsOnly}
        onShare={optIn}
        sharing={optingIn}
        bookmarkedIds={bookmarkedIds}
        getScore={getScore}
        onItemOpen={openItem}
        onGuestCta={onGuestCta}
        onBookmarkToggle={toggleBookmark}
      />

      <SisterMemberDetailModal item={sisterDetail} onClose={() => setSisterDetail(null)} />

      <BusinessDetailModal
        isOpen={isDetailOpen}
        business={detailBiz}
        members={members}
        onClose={() => setIsDetailOpen(false)}
        onContact={(biz) => {
          setIsDetailOpen(false);
          openInquiryForBusiness(biz);
        }}
      />

      <BusinessInquiryModal
        isOpen={isInquiryModalOpen}
        business={selectedBiz}
        members={members}
        form={inquiryForm}
        errors={inquiryErrors}
        submitting={isSubmitting}
        onClose={() => setInquiryModalOpen(false)}
        onFormChange={setInquiryForm}
        onSubmit={handleSendInquiry}
      />
      <BusinessDirectoryFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        state={directory}
      />
    </div>
  );
};
