import React from 'react';
import { Gift, Globe, Phone } from 'lucide-react';
import { Button, Modal } from '../../ui/Common';
import type { DirectoryItem } from './directoryFacets';

interface SisterMemberDetailModalProps {
  item: DirectoryItem | null;
  onClose: () => void;
}

/** Detail view of a member card (sister chapter, or any chapter for externals). A card carries phone and social links only when the member shares it. */
export const SisterMemberDetailModal: React.FC<SisterMemberDetailModalProps> = ({ item, onClose }) => {
  if (!item) return null;
  return (
    <Modal isOpen={!!item} onClose={onClose} title={item.company || item.name} drawerOnMobile>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <img src={item.avatarUrl} alt={item.name} className="h-14 w-14 flex-shrink-0 rounded-full border border-slate-200 object-cover" />
          <div className="min-w-0">
            <div className="font-bold text-slate-900">{item.name}</div>
            <div className="text-sm text-slate-500">{[item.position, item.company].filter(Boolean).join(' · ')}</div>
            <div className="mt-0.5 text-xs font-bold text-jci-blue">{[item.chapter, item.country].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {item.industry && <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700">{item.industry}</span>}
          {item.categories.map(c => <span key={c} className="rounded-full border border-sky-100 bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700">{c}</span>)}
          {item.hasDeal && <span className="flex items-center gap-0.5 rounded-full border border-amber-100 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700"><Gift size={9} /> Deal</span>}
        </div>
        {item.description && <p className="text-sm leading-relaxed text-slate-600">{item.description}</p>}
        {(item.phone || item.socials) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
            {item.phone && <a href={`tel:${item.phone}`} className="flex items-center gap-1 text-jci-blue"><Phone size={14} /> {item.phone}</a>}
            {item.socials && Object.entries(item.socials).map(([k, v]) => (
              /^https?:\/\//i.test(v)
                ? <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="capitalize text-jci-blue">{k}</a>
                : <span key={k}><span className="capitalize">{k}</span>: {v}</span>
            ))}
          </div>
        )}
        {item.idealReferrals.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Ideal Referrals</p>
            <p className="text-sm text-slate-700">{item.idealReferrals.join(', ')}</p>
          </div>
        )}
        {item.hasDeal && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-700"><Gift size={11} /> Sister Deal</span>
            <p className="text-sm font-semibold leading-snug text-amber-900">{item.dealSummary}</p>
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" size="sm" className="flex-1" disabled={!item.website}
          onClick={() => window.open(item.website, '_blank', 'noopener')}>
          <Globe size={14} className="mr-2" /> Website
        </Button>
      </div>
    </Modal>
  );
};
