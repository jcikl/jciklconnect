import React from 'react';
import { Gift, Globe, Send } from 'lucide-react';
import type { BusinessProfile, Member } from '../../../types';
import { Badge, Button, Modal } from '../../ui/Common';
import { getInitialsSvg } from './businessDirectoryUtils';

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
  const position = ownerMember?.business?.position || 'Representative';
  const intlStatus = business.acceptsInternationalBusiness;

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
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <img src={avatarUrl} alt={business.ownerName} className="w-16 h-16 rounded-full object-cover border border-slate-200 flex-shrink-0 shadow-sm" />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">
              {business.ownerName}
              {chineseName && <span className="text-sm text-slate-400 font-normal ml-1">({chineseName})</span>}
            </h3>
            <p className="text-sm text-slate-500">{position} · {business.companyName}</p>
            <p className="text-xs text-jci-blue font-bold mt-0.5">JCI Kuala Lumpur</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {business.industry && <Badge variant="info" className="text-xs">{business.industry}</Badge>}
          {intlStatus === 'Yes' && <Badge variant="success" className="text-xs">Accepts International Business</Badge>}
          {intlStatus === 'Willing to Explore' && <Badge variant="warning" className="text-xs">Exploring International Business</Badge>}
          {(!intlStatus || intlStatus === 'No') && <Badge variant="neutral" className="text-xs">Local Business Only</Badge>}
        </div>

        {business.description ? (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">About</p>
            <p className="text-sm text-slate-600 leading-relaxed">{business.description}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No company description provided yet.</p>
        )}

        {business.idealReferralTypes && business.idealReferralTypes.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Ideal Referral</p>
            <div className="flex flex-wrap gap-1.5">
              {business.idealReferralTypes.map(ref => (
                <span key={ref} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-100">{ref}</span>
              ))}
            </div>
          </div>
        )}

        {business.offer && (
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1 mb-1.5">
              <Gift size={11} /> JCI Member Deal
            </p>
            <p className="text-sm font-semibold text-amber-900 leading-snug">{business.offer}</p>
            {business.offerTerms && (
              <p className="text-xs text-amber-700/70 mt-1.5 leading-relaxed"><span className="font-semibold">T&C:</span> {business.offerTerms}</p>
            )}
            {business.offerExpiry && (
              <p className="text-xs text-amber-600/60 mt-1">Valid until {business.offerExpiry}</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
