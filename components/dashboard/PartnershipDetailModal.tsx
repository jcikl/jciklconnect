import * as React from 'react';
import { useState } from 'react';
import { ArrowLeft, Share2, Building2, ExternalLink } from 'lucide-react';
import { Modal, Button, Badge } from '../ui/Common';
import { Advertisement, AdvertisementService } from '../../services/advertisementService';
import { formatDate, toDate } from '../../utils/dateUtils';

interface PartnershipDetailModalProps {
  ad: Advertisement;
  onClose: () => void;
}

export const PartnershipDetailModal: React.FC<PartnershipDetailModalProps> = ({ ad, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={null}
      size="lg"
      drawerOnMobile
      mobileHeight={isExpanded ? "h-screen" : "h-[80vh] md:h-auto"}
      scrollInBody={true}
      onScroll={(e) => {
        const scrollTop = e.currentTarget.scrollTop;
        if (scrollTop > 10 && !isExpanded) {
          setIsExpanded(true);
        } else if (scrollTop <= 0 && isExpanded) {
          setIsExpanded(false);
        }
      }}
      className="premium-event-modal"
      footerClassName="flex-none p-6 bg-white border-t border-slate-50 rounded-t-[40px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.15)] z-30 pb-safe"
      footer={
        ad.linkUrl ? (
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-900 leading-none">
                {ad.provider || 'JCI KL Partner'}
              </span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Exclusive Promotion</span>
            </div>
            <Button
              className="flex-1 max-w-[220px] h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100"
              onClick={() => {
                if (ad.id) {
                  AdvertisementService.recordClick(ad.id).catch(console.error);
                }
                if (ad.linkUrl) window.open(ad.linkUrl, '_blank');
              }}
            >
              <span>Learn More</span>
              <ExternalLink size={18} />
            </Button>
          </div>
        ) : null
      }
    >
      <div className="-m-4 md:-m-6 relative">
        {/* Hero Image Section */}
        <div
          className="relative h-64 md:h-80 w-full overflow-hidden cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <img
            src={ad.imageUrl}
            alt={ad.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>

          {/* Top Bar Controls */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all animate-fade-in"
            >
              <ArrowLeft size={20} />
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: ad.title,
                    text: ad.description,
                    url: ad.linkUrl
                  }).catch(console.error);
                } else if (ad.linkUrl) {
                  navigator.clipboard.writeText(ad.linkUrl);
                  alert('Link copied to clipboard!');
                }
              }}
              className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all animate-fade-in"
            >
              <Share2 size={20} />
            </button>
          </div>
        </div>

        {/* Content Body - Overlapping Card Style */}
        <div className="relative bg-white rounded-t-[32px] -mt-10 px-6 pt-8 pb-10 min-h-[300px]">
          {/* Header Info */}
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight mb-2">
              {ad.title}
            </h2>
            {ad.provider && (
              <div className="flex items-center text-slate-600 gap-1.5 text-sm font-medium">
                <Building2 size={16} className="text-slate-400" />
                <span>Provided by {ad.provider}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">About this Partnership</h3>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
              {ad.description || 'No description available for this partnership.'}
            </p>
          </div>

          {/* Terms & Conditions */}
          {ad.termsAndConditions && (
            <div className="space-y-2 border-t border-slate-100 mt-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Terms & Conditions</h3>
              <p className="text-slate-500 text-xs leading-relaxed whitespace-pre-wrap">
                {ad.termsAndConditions}
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
