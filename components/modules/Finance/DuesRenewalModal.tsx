import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, Modal, useToast } from '../../ui/Common';
import { Select } from '../../ui/Form';

// Dues Renewal Modal
export interface DuesRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  onYearChange: (year: number) => void;
  onRenew: () => Promise<void>;
  isRenewing: boolean;
}

export const DuesRenewalModal: React.FC<DuesRenewalModalProps> = ({
  isOpen,
  onClose,
  year,
  onYearChange,
  onRenew,
  isRenewing,
}) => {
  const { showToast } = useToast();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear + i);

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (year < currentYear) {
      showToast('Cannot renew for past years', 'error');
      return;
    }
    await onRenew();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Initiate Annual Dues Renewal"
      size="lg"
      bottomSheet
      drawerOnMobile
      footer={
        <div className="flex gap-3 w-full">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="dues-renewal-form" className="flex-1" disabled={isRenewing}>
            {isRenewing ? 'Initiating...' : 'Initiate Renewal'}
          </Button>
        </div>
      }
    >
      <form id="dues-renewal-form" onSubmit={handleRenew} className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-600 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1">Annual Dues Renewal (Calendar Year)</h4>
              <p className="text-sm text-blue-700">
                This will create renewal transactions for all members who paid dues in the previous year ({year - 1}).
                Pro-rata payments will be automatically calculated for mid-year joiners. Notifications will be automatically sent to all affected members.
              </p>
            </div>
          </div>
        </div>

        <Select
          label="Renewal Year"
          value={year.toString()}
          onChange={(e) => onYearChange(parseInt(e.target.value))}
          options={years.map(y => ({ label: y.toString(), value: y.toString() }))}
          required
        />

        <div className="p-4 bg-slate-50 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Previous Year:</span>
            <span className="font-semibold text-slate-900">{year - 1}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Renewal Year:</span>
            <span className="font-semibold text-slate-900">{year}</span>
          </div>
          <div className="pt-2 border-t border-slate-200 mt-2">
            <p className="text-xs text-slate-500">
              <strong>Note:</strong> Dues amounts are calculated per member type (Probation RM300, Visiting RM500, Associate RM50, Honorary RM0).
              All first-year members are charged an additional RM50 registration fee. Pro-rata applies for mid-year joiners.
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
};
