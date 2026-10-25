import React from 'react';
import { Share2 } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import { Button } from '../../ui/Button';

/**
 * Reciprocity notice for viewers who have not opted in to sharing their own card.
 * Default: shown instead of a card list. `compact`: a small banner above a list that still shows other items.
 */
export const ShareCardNotice: React.FC<{ onShare: () => void; sharing: boolean; compact?: boolean }> = ({ onShare, sharing, compact = false }) => {
  if (compact) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 sm:flex-row sm:items-center dark:border-sky-900/50 dark:bg-sky-900/20">
        <Share2 size={16} className="hidden shrink-0 text-sky-600 sm:block dark:text-sky-400" />
        <p className="flex-1 text-xs text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-slate-100">Sister chapter members are hidden.</span>{' '}
          Cards are shared both ways: share your card to see theirs. You can turn it off any time in your profile.
        </p>
        <Button size="sm" onClick={onShare} disabled={sharing} className="!min-h-0 shrink-0 py-2">
          {sharing ? 'Saving...' : 'Share my card'}
        </Button>
      </div>
    );
  }
  return (
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
};
