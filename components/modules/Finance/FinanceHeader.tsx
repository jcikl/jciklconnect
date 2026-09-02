import React from 'react';
import { FileText } from 'lucide-react';
import { Button, Tabs } from '../../ui/Common';
import { Select } from '../../ui/Form';

interface FinanceHeaderProps {
  reportYear: number;
  allTransactionYears: number[];
  activeTab: string;
  canOperateFinance: boolean;
  onReportYearChange: (year: number) => void;
  onTabChange: (tab: string) => void;
  onOpenReports: () => void;
  onOpenImport: () => void;
  onOpenTransaction: () => void;
}

const FINANCE_TABS = ['Dashboard', 'Transactions', 'Project Account', 'Membership', 'Administrative', 'Payment Requests', 'Reconciliation'];

export const FinanceHeader: React.FC<FinanceHeaderProps> = ({
  reportYear,
  allTransactionYears,
  activeTab,
  canOperateFinance,
  onReportYearChange,
  onTabChange,
  onOpenReports,
  onOpenImport,
  onOpenTransaction,
}) => (
  <div className="space-y-3">
    <div className="flex flex-row items-center justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Financial Management</h2>
        <p className="text-slate-500 text-xs sm:text-sm truncate">{'Bookkeeping \u00b7 dues collection \u00b7 budgeting'}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-20 shrink-0">
          <Select
            value={reportYear.toString()}
            onChange={(event) => onReportYearChange(parseInt(event.target.value, 10))}
            options={[
              { label: 'All Years', value: '0' },
              ...allTransactionYears.map(year => ({ label: year.toString(), value: year.toString() })),
            ]}
          />
        </div>
        <Button variant="outline" size="sm" onClick={onOpenReports} title="Reports" className="shrink-0 h-[38px] px-2.5 sm:px-3">
          <FileText size={14} className="sm:mr-1.5" /><span className="hidden sm:inline">Reports</span>
        </Button>
      </div>
    </div>

    <Tabs
      tabs={FINANCE_TABS}
      activeTab={activeTab}
      onTabChange={onTabChange}
    />
  </div>
);
