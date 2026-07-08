import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Share2, Building2, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Common';
import { Advertisement, AdvertisementService } from '../../services/advertisementService';

interface PartnershipDetailModalProps {
  ad: Advertisement;
  ads?: Advertisement[];
  onClose: () => void;
  onNavigate?: (ad: Advertisement) => void;
}

type SnapState = 'half' | 'full';

export const PartnershipDetailModal: React.FC<PartnershipDetailModalProps> = ({ ad, ads = [], onClose, onNavigate }) => {
  const [visible, setVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [snap, setSnap] = useState<SnapState>('half');
  const [dragOffset, setDragOffset] = useState(0); // signed px, positive = down
  const [slideX, setSlideX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isDraggingY = useRef(false);
  const isDraggingX = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentIndex = ads.findIndex(a => a.id === ad.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < ads.length - 1;

  useEffect(() => {
    setVisible(true);
    const t = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => { setVisible(false); onClose(); }, 320);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDraggingY.current = false;
    isDraggingX.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - touchStartY.current;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const scrollTop = scrollRef.current?.scrollTop ?? 0;

    // Determine drag direction on first meaningful movement
    if (!isDraggingY.current && !isDraggingX.current) {
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        isDraggingX.current = true;
      } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
        // Allow vertical drag: down always OK at scrollTop=0; up only when half
        if ((deltaY > 0 && scrollTop === 0) || (deltaY < 0 && snap === 'half')) {
          isDraggingY.current = true;
        }
      }
    }

    if (isDraggingX.current) {
      setSlideX(deltaX);
    } else if (isDraggingY.current) {
      const scrollTop2 = scrollRef.current?.scrollTop ?? 0;
      // While full, only drag down when at top
      if (snap === 'full' && deltaY < 0) return;
      if (snap === 'full' && scrollTop2 > 0) return;
      setDragOffset(deltaY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    if (isDraggingX.current && Math.abs(deltaX) > 60 && onNavigate) {
      if (deltaX < 0 && hasNext) onNavigate(ads[currentIndex + 1]);
      else if (deltaX > 0 && hasPrev) onNavigate(ads[currentIndex - 1]);
    } else if (isDraggingY.current) {
      const vh = window.innerHeight;
      // Base position in px: half=50vh, full=0
      const baseY = snap === 'half' ? vh * 0.5 : 0;
      const newY = baseY + dragOffset;

      if (newY > vh * 0.7) {
        handleClose();
      } else if (newY < vh * 0.25) {
        setSnap('full');
      } else {
        setSnap('half');
      }
    }

    setDragOffset(0);
    setSlideX(0);
    isDraggingY.current = false;
    isDraggingX.current = false;
  };

  if (!visible) return null;

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const baseY = !isOpen ? vh : snap === 'half' ? vh * 0.5 : 0;
  const currentY = dragOffset !== 0 ? Math.max(0, baseY + dragOffset) : baseY;
  const isDragging = dragOffset !== 0 || slideX !== 0;

  const sheetStyle: React.CSSProperties = {
    height: '100vh',
    transform: `translateY(${currentY}px)` + (slideX !== 0 ? ` translateX(${slideX * 0.15}px)` : ''),
    transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.32,0.72,0,1)',
  };

  const backdropOpacity = isOpen
    ? dragOffset !== 0
      ? Math.max(0, 1 - dragOffset / (vh * 0.5))
      : 1
    : 0;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[54] bg-black/50 backdrop-blur-[2px]"
        style={{ opacity: backdropOpacity, transition: isDragging ? 'none' : 'opacity 0.3s ease', pointerEvents: isOpen ? 'auto' : 'none' }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[55] flex flex-col rounded-t-[28px] bg-white shadow-2xl md:left-1/2 md:-translate-x-1/2 md:w-[560px] md:rounded-t-2xl"
        style={sheetStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Hero image */}
        <div className="relative h-56 w-full overflow-hidden shrink-0 rounded-t-[28px] md:rounded-t-2xl">
          {/* Drag handle */}
          <div className="absolute top-0 left-0 right-0 z-10 pt-3 pb-1 flex justify-center">
            <div className="w-9 h-1 rounded-full bg-white/60" />
          </div>
          <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-full bg-black/25 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: ad.title, text: ad.description, url: ad.linkUrl }).catch(() => {});
                } else if (ad.linkUrl) {
                  navigator.clipboard.writeText(ad.linkUrl);
                }
              }}
              className="w-9 h-9 rounded-full bg-black/25 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all"
            >
              <Share2 size={18} />
            </button>
          </div>
          {/* Pagination dots */}
          {ads.length > 1 && (
            <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center gap-1.5">
              {ads.map((_, i) => (
                <div key={i} className={`rounded-full transition-all duration-200 ${i === currentIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`} />
              ))}
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain rounded-t-2xl -mt-5 bg-white relative z-10">
          <div className="px-5 pt-5 pb-4">
            <h2 className="text-xl font-black text-slate-900 leading-tight mb-1">{ad.title}</h2>
            {ad.provider && (
              <div className="flex items-center gap-1.5 text-slate-500 text-sm font-medium mb-4">
                <Building2 size={14} className="text-slate-400" />
                <span>{ad.provider}</span>
              </div>
            )}
            {ad.description && (
              <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">About this Partnership</p>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{ad.description}</p>
              </div>
            )}
            {ad.termsAndConditions && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Terms &amp; Conditions</p>
                <p className="text-slate-500 text-xs leading-relaxed whitespace-pre-wrap">{ad.termsAndConditions}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        {ad.linkUrl && (
          <div className="shrink-0 px-5 py-4 border-t border-slate-100 bg-white pb-safe flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-slate-900 leading-none">{ad.provider || 'JCI KL Partner'}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Exclusive Promotion</p>
            </div>
            <Button
              className="flex-1 max-w-[200px] h-12 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              onClick={() => {
                if (ad.id) AdvertisementService.recordClick(ad.id).catch(console.error);
                window.open(ad.linkUrl, '_blank');
              }}
            >
              <span>Learn More</span>
              <ExternalLink size={16} />
            </Button>
          </div>
        )}
      </div>
    </>,
    document.body
  );
};
