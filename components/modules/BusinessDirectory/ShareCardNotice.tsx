import React from 'react';
import { Share2 } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import { Button } from '../../ui/Button';

/** Shown instead of a card list when the viewer has not opted in to sharing their own card (reciprocity rule). */
export const ShareCardNotice: React.FC<{ onShare: () => void; sharing: boolean }> = ({ onShare, sharing }) => (
  <div className="mx-auto w-full max-w-md px-4 py-8">
    <EmptyState
      title="Share your card to view other members' cards"
      description="Cards are shared both ways. Turn on sharing for your own card to see the cards of other members. You can turn it off any time in your profile."
      icon={<Share2 size={20} />}
      action={
        <Button onClick={onShare} disabled={sharing} className="w-full sm:w-auto">
          {sharing ? 'Saving...' : 'Share my card'}
        </Button>
      }
    />
  </div>
);
