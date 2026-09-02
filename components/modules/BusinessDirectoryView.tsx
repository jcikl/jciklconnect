import React, { useState } from 'react';
import { Building2, Globe } from 'lucide-react';

import { useToast } from '../ui/Common';
import { MembersOnlyOverlay } from '../ui/MembersOnlyOverlay';
import { useBusinessDirectory } from '../../hooks/useBusinessDirectory';
import { useMembers } from '../../hooks/useMembers';
import { BusinessProfile } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { BusinessDetailModal } from './BusinessDirectory/BusinessDetailModal';
import { BusinessDirectoryFilterDrawer } from './BusinessDirectory/BusinessDirectoryFilterDrawer';
import { BusinessDirectoryHeader, type BusinessDirectoryTab } from './BusinessDirectory/BusinessDirectoryHeader';
import { BusinessInquiryModal } from './BusinessDirectory/BusinessInquiryModal';
import { MOCK_SISTER_CHAPTER_MEMBERS } from './BusinessDirectory/businessDirectoryMocks';
import { useBusinessBookmarks } from './BusinessDirectory/useBusinessBookmarks';
import { useBusinessDirectoryFilters } from './BusinessDirectory/useBusinessDirectoryFilters';
import { useBusinessInquiry } from './BusinessDirectory/useBusinessInquiry';
import { InternationalNetworkTab } from './BusinessDirectory/InternationalNetworkTab';
import { LocalBusinessTab } from './BusinessDirectory/LocalBusinessTab';
import { useSisterChapterFilters } from './BusinessDirectory/useSisterChapterFilters';

export const BusinessDirectoryView: React.FC<{ searchQuery?: string; initialSelectedBusinessId?: string | null; onClearSelection?: () => void; isGuest?: boolean; onGuestCta?: () => void }> = ({ searchQuery, initialSelectedBusinessId, onClearSelection, isGuest = false, onGuestCta }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<BusinessDirectoryTab>('local');
  const [selectedIndustries, setSelectedIndustries] = useState<Set<string>>(new Set());
  const [selectedInterestedIndustry, setSelectedInterestedIndustry] = useState<string>('All');
  const [selectedIntlBiz, setSelectedIntlBiz] = useState<string>('All');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedIdealReferral, setSelectedIdealReferral] = useState<string>('All');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [showDealsOnly, setShowDealsOnly] = useState(false);

  const {
    selectedSisterChapter,
    selectedSisterCountry,
    selectedSisterIndustry,
    setSelectedSisterChapter,
    setSelectedSisterCountry,
    setSelectedSisterIndustry,
    sisterChapters,
    sisterCountries,
    sisterIndustries,
    sisterFiltersCount,
  } = useSisterChapterFilters(MOCK_SISTER_CHAPTER_MEMBERS);

  const [detailBiz, setDetailBiz] = useState<BusinessProfile | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { businesses, loading, error } = useBusinessDirectory();
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

  const {
    uniqueIndustries,
    uniqueInterestedIndustries,
    uniqueIdealReferrals,
    activeFiltersCount,
    filteredBusinesses,
    getBizScore,
  } = useBusinessDirectoryFilters({
    businesses,
    searchTerm,
    searchQuery,
    selectedIndustries,
    selectedInterestedIndustry,
    selectedIntlBiz,
    selectedCategories,
    selectedIdealReferral,
    showDealsOnly,
    bookmarkedIds,
    idealReferralIndustry: currentUser?.idealReferralIndustry,
    currentUserId: currentUser?.id,
  });

  // Logged-in GUEST role: mask the directory like the Benefits page (public guest landing page uses isGuest prop instead)
  const isGuestRole = !isGuest && (currentUser?.role || '') === 'GUEST';

  return (
    <div className={`space-y-2 relative${isGuestRole ? ' pt-px' : ''}`}>
      {isGuestRole && (
        <MembersOnlyOverlay
          description="The member business directory is exclusive to JCI Kuala Lumpur members. Join us to connect with local businesses and the global JCI network."
          member={currentUser}
        />
      )}

      <BusinessDirectoryHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Member-profile-style icon sidebar on mobile */}
      <div className="flex md:block rounded-xl md:rounded-none border border-slate-200 md:border-0 overflow-hidden md:overflow-visible shadow-sm md:shadow-none">
        {/* Left icon column (mobile only) */}
        <div className="md:hidden flex flex-col border-r border-slate-200 bg-slate-50 w-12 shrink-0">
          {([
            { id: 'local', label: 'Local Businesses', icon: Building2 },
            { id: 'international', label: 'International', icon: Globe },
          ] as const).map((tab, i) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                title={tab.label}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center justify-center py-5 w-full transition-all ${i > 0 ? 'border-t border-slate-200' : ''} ${isActive ? 'bg-white text-jci-blue' : 'text-slate-400 hover:text-slate-600 hover:bg-white/60'}`}
              >
                {isActive && (
                  <>
                    <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-jci-blue" />
                    <span className="absolute right-0 top-0 bottom-0 w-px bg-white" />
                  </>
                )}
                <Icon size={16} className="shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Content panel */}
        <div className="flex-1 md:flex-none min-w-0">
          {/* Active tab title (mobile only) */}
          <div className="md:hidden px-4 py-2.5 border-b border-slate-100 bg-white">
            <span className="text-sm font-bold text-slate-700">
              {activeTab === 'local' ? 'Local Businesses' : 'International Network'}
            </span>
          </div>
          <div className="p-4 md:p-0 bg-transparent">
          {activeTab === 'local' ? (
            <LocalBusinessTab
              businesses={businesses}
              filteredBusinesses={filteredBusinesses}
              members={members}
              loading={loading}
              error={error}
              isGuest={isGuest}
              searchTerm={searchTerm}
              activeFiltersCount={activeFiltersCount}
              selectedIndustries={selectedIndustries}
              selectedIntlBiz={selectedIntlBiz}
              showDealsOnly={showDealsOnly}
              uniqueIndustries={uniqueIndustries}
              bookmarkedIds={bookmarkedIds}
              onSearchTermChange={setSearchTerm}
              onFilterDrawerOpen={() => setIsFilterDrawerOpen(true)}
              onBusinessOpen={(biz) => {
                setDetailBiz(biz);
                setIsDetailOpen(true);
              }}
              onGuestCta={onGuestCta}
              onBookmarkToggle={toggleBookmark}
              onSelectedIndustriesChange={setSelectedIndustries}
              onSelectedInterestedIndustryChange={setSelectedInterestedIndustry}
              onSelectedIntlBizChange={setSelectedIntlBiz}
              onSelectedCategoriesChange={setSelectedCategories}
              onSelectedIdealReferralChange={setSelectedIdealReferral}
              onShowDealsOnlyChange={setShowDealsOnly}
              getBizScore={getBizScore}
            />
          ) : (
            <InternationalNetworkTab
              onContact={(biz) => {
                openInquiryForBusiness(biz);
              }}
            />
          )}
          </div>{/* end p-4 wrapper */}
        </div>{/* end content panel */}
      </div>{/* end outer card wrapper */}

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
        activeTab={activeTab}
        businesses={businesses}
        filteredBusinessCount={filteredBusinesses.length}
        activeFiltersCount={activeFiltersCount}
        selectedIndustries={selectedIndustries}
        selectedInterestedIndustry={selectedInterestedIndustry}
        selectedIntlBiz={selectedIntlBiz}
        selectedCategories={selectedCategories}
        selectedIdealReferral={selectedIdealReferral}
        showDealsOnly={showDealsOnly}
        uniqueIndustries={uniqueIndustries}
        uniqueInterestedIndustries={uniqueInterestedIndustries}
        uniqueIdealReferrals={uniqueIdealReferrals}
        sisterMembers={MOCK_SISTER_CHAPTER_MEMBERS}
        sisterChapters={sisterChapters}
        sisterCountries={sisterCountries}
        sisterIndustries={sisterIndustries}
        selectedSisterChapter={selectedSisterChapter}
        selectedSisterCountry={selectedSisterCountry}
        selectedSisterIndustry={selectedSisterIndustry}
        onClose={() => setIsFilterDrawerOpen(false)}
        onSelectedIndustriesChange={setSelectedIndustries}
        onSelectedInterestedIndustryChange={setSelectedInterestedIndustry}
        onSelectedIntlBizChange={setSelectedIntlBiz}
        onSelectedCategoriesChange={setSelectedCategories}
        onSelectedIdealReferralChange={setSelectedIdealReferral}
        onShowDealsOnlyChange={setShowDealsOnly}
        onSelectedSisterChapterChange={setSelectedSisterChapter}
        onSelectedSisterCountryChange={setSelectedSisterCountry}
        onSelectedSisterIndustryChange={setSelectedSisterIndustry}
      />
    </div>
  );
};
