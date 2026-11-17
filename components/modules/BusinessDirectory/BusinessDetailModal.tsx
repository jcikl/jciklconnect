import React from 'react';
import { Gift, Globe, Send } from 'lucide-react';
import type { BusinessProfile, Member, SpecialOffer } from '../../../types';
import { Button, Modal } from '../../ui/Common';
import { getInitialsSvg } from './businessDirectoryUtils';
import { normalizeIdealReferrals } from '../../../utils/idealReferrals.mjs';

interface BusinessDetailModalProps {
  isOpen: boolean;
  business: BusinessProfile | null;
  members: Member[];
  onClose: () => void;
  onContact: (business: BusinessProfile) => void;
}

export const BusinessDetailModal: React.FC<BusinessDetailModalProps> = ({
  isOpen,
  business,
  members,
  onClose,
  onContact,
}) => {
  if (!business) return null;

  const ownerMember = members.find(m => m.id === business.memberId);
  const avatarUrl = ownerMember?.general?.avatarUrl || getInitialsSvg(business.ownerName || '');
  const chineseName = ownerMember?.general?.chineseName;
  const position = ownerMember?.business?.departmentAndPosition || ownerMember?.business?.position || '';
  const description = ownerMember?.business?.companyDescription || business.description;
  const levelOfManagement = ownerMember?.business?.levelOfManagement;
  const intlStatus = ownerMember?.business?.acceptInternationalBusiness ?? business.acceptsInternationalBusiness;
  const businessCategories = ownerMember?.business?.businessCategory ?? [];
  const productsAndServices = ownerMember?.business?.productsAndServices ?? [];
  const idealReferralIndustries = normalizeIdealReferrals(ownerMember?.idealReferralIndustry);
  const idealReferralTypes: string[] = ownerMember?.business?.idealReferralTypes
    ?? ownerMember?.business?.idealReferrals
    ?? business.idealReferralTypes
    ?? [];

  const rawOffers: SpecialOffer[] = ownerMember?.business?.specialOffers
    ?? (ownerMember?.business?.specialOffer
      ? [typeof ownerMember.business.specialOffer === 'string'
          ? { description: ownerMember.business.specialOffer }
          : ownerMember.business.specialOffer]
      : []);
  const activeOffers = rawOffers.filter(o => !o.status || o.status === 'Active');
  const offersToShow: SpecialOffer[] = activeOffers.length
    ? activeOffers
    : business.offer
      ? [{ description: business.offer, terms: business.offerTerms, expiryDate: business.offerExpiry }]
      : [];

  const hasReferralSection = idealReferralIndustries.length > 0 || idealReferralTypes.length > 0;
  const hasCategoriesSection = businessCategories.length > 0 || productsAndServices.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={business.companyName}
      drawerOnMobile
      size="lg"
      footer={
        <div className="flex gap-3 w-full">
          {business.website && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.open(business.website!.startsWith('http') ? business.website : `https://${business.website}`, '_blank')}
            >
              <Globe size={14} className="mr-2" /> Website
            </Button>
          )}
          <Button
            variant="primary"
            className="flex-1 bg-jci-blue text-white"
            onClick={() => onContact(business)}
          >
            <Send size={14} className="mr-2" /> Contact
          </Button>
        </div>
      }
    >
      <div className="space-y-4">

        {/* Hero */}
        <div className="flex items-center gap-4">
          <img src={avatarUrl} alt={business.ownerName} className="w-14 h-14 rounded-full object-cover border border-slate-200 flex-shrink-0 shadow-sm" />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              {business.ownerName}
              {chineseName && <span className="text-sm text-slate-400 font-normal ml-1.5">({chineseName})</span>}
            </h3>
            {position && <p className="text-sm text-slate-500 mt-0.5">{position} · {business.companyName}</p>}
            <p className="text-xs text-jci-blue font-bold mt-0.5">JCI Kuala Lumpur</p>
          </div>
        </div>

        {/* Identity badges */}
        <div className="flex flex-wrap gap-1.5">
          {business.industry && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">{business.industry}</span>
          )}
          {levelOfManagement && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">{levelOfManagement} management</span>
          )}
          {(intlStatus === 'Yes') && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-100">Open to international business</span>
          )}
          {intlStatus === 'Willing to Explore' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">Exploring international business</span>
          )}
        </div>

        {/* About */}
        {description ? (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">About</p>
            <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No company description provided yet.</p>
        )}

        {/* Categories + Products */}
        {hasCategoriesSection && (
          <>
            <hr className="border-slate-100" />
            {businessCategories.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Business categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {businessCategories.map(cat => (
                    <span key={cat} className="px-2 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">{cat}</span>
                  ))}
                </div>
              </div>
            )}
            {productsAndServices.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Products and services</p>
                <div className="flex flex-wrap gap-1.5">
                  {productsAndServices.map((item, i) => (
                    <span key={i} className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200">{item}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Ideal referrals */}
        {hasReferralSection && (
          <>
            <hr className="border-slate-100" />
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Looking for referrals in</p>
              {idealReferralIndustries.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide mb-1">Industries</p>
                  <div className="flex flex-wrap gap-1.5">
                    {idealReferralIndustries.map(ind => (
                      <span key={ind} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-[11px] font-semibold border border-blue-100">{ind}</span>
                    ))}
                  </div>
                </div>
              )}
              {idealReferralTypes.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide mb-1">Referral types</p>
                  <div className="flex flex-wrap gap-1.5">
                    {idealReferralTypes.map(ref => (
                      <span key={ref} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-[11px] font-semibold border border-blue-100">{ref}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Offers */}
        {offersToShow.length > 0 && (
          <>
            <hr className="border-slate-100" />
            <div className="space-y-3">
              {offersToShow.map((offer, i) => (
                <div key={i} className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <div className="flex gap-3 items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                        <Gift size={11} /> JCI member deal
                      </p>
                      <p className="text-sm font-semibold text-amber-900 leading-snug">{offer.description}</p>
                      {offer.terms && (
                        <p className="text-xs text-amber-700/70 mt-1.5 leading-relaxed"><span className="font-semibold">T&C:</span> {offer.terms}</p>
                      )}
                      {offer.expiryDate && (
                        <p className="text-xs text-amber-600/60 mt-1">Valid until {offer.expiryDate}</p>
                      )}
                    </div>
                    {offer.logoUrl && (
                      <img src={offer.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-amber-200 flex-shrink-0" />
                    )}
                  </div>
                  {offer.imageUrl && (
                    <img src={offer.imageUrl} alt="" className="mt-3 w-full rounded-lg object-cover border border-amber-200 max-h-32" />
                  )}
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </Modal>
  );
};
