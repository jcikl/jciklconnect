/**
 * "Sync JCI Malaysia" on the Member Directory header — developer accounts only (renders nothing otherwise;
 * every function re-checks members.isDeveloper on the server). One button opens one modal with three tabs,
 * each with its own preview → apply and per-row verification:
 *   Membership — membership no. / join date / user id onto members
 *   Event QR   — jciMalaysiaRegcode onto each member's own registration
 *   Senatorship — senator number onto members (board-validated preserved)
 * Each tab loads its (heavy) preview lazily the first time it is opened; reopening the modal starts fresh.
 */
import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Modal } from '../../ui/Common';
import { useAuth } from '../../../hooks/useAuth';
import { usePermissions } from '../../../hooks/usePermissions';
import { MembershipSyncPanel } from './MembershipSyncPanel';
import { EventRegcodeSyncPanel } from './EventRegcodeSyncPanel';
import { SenatorshipSyncPanel } from './SenatorshipSyncPanel';

type TabId = 'membership' | 'regcode' | 'senatorship';
const TABS: { id: TabId; label: string }[] = [
  { id: 'membership', label: 'Membership' },
  { id: 'regcode', label: 'Event QR' },
  { id: 'senatorship', label: 'Senatorship' },
];

export const JciMalaysiaSyncButton: React.FC = () => {
  const { member } = useAuth();
  const { isDeveloper: isDevModeDeveloper } = usePermissions();
  // Button visibility only; each netlify function re-checks members/{uid}.isDeveloper itself.
  const canSync = isDevModeDeveloper || member?.isDeveloper === true;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>('membership');
  // Bumped on each open so the panels remount fresh (clearing their lazily-loaded previews).
  const [openSeq, setOpenSeq] = useState(0);

  if (!canSync) return null;

  const openModal = () => { setTab('membership'); setOpenSeq(s => s + 1); setOpen(true); };
  const close = () => setOpen(false);

  const footer = <div className="flex justify-end w-full"><Button variant="outline" onClick={close}>Close</Button></div>;

  return (
    <>
      <Button variant="outline" size="sm" onClick={openModal}>
        <RefreshCw size={14} className="mr-1.5" /> Sync JCI Malaysia
      </Button>

      <Modal isOpen={open} onClose={close} title="Sync JCI Malaysia" size="3xl" drawerOnMobile footer={footer}>
        {/* Own surface: the Modal shell is light-only, so the content carries both themes itself. */}
        <div className="space-y-3 rounded-lg p-2 sm:p-3 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
          <div className="flex gap-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 p-1" role="tablist">
            {TABS.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 min-w-0 truncate rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {open && (
            // key by openSeq: remount all panels on each open so each starts idle again (nothing auto-runs).
            // All three stay mounted (hidden) so a preview you loaded is kept when you switch tabs within this open.
            <div key={openSeq}>
              <div className={tab === 'membership' ? '' : 'hidden'}><MembershipSyncPanel /></div>
              <div className={tab === 'regcode' ? '' : 'hidden'}><EventRegcodeSyncPanel /></div>
              <div className={tab === 'senatorship' ? '' : 'hidden'}><SenatorshipSyncPanel /></div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
