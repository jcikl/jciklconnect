import React, { useState, useMemo } from 'react';
import { X, AlertCircle, CheckCircle, Upload, Copy } from 'lucide-react';
import { Modal, Button, Badge, useToast } from '../../ui/Common';
import { Input, Select } from '../../ui/Form';
import { BankAccount, Transaction } from '../../../types';
import { FinanceService } from '../../../services/financeService';

interface ImportRow {
  index: number;
  raw: string;
  parsed: {
    date?: string;
    description?: string;
    referenceNumber?: string;
    income?: number;
    expense?: number;
  };
  errors: string[];
  valid: boolean;
}

interface ColumnMapping {
  date: number;
  description: number;
  referenceNumber: number;
  income: number;
  expense: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  onImported: () => void; // After successful import, refresh transaction list
}

// Helper function to parse date in multiple formats
const parseDate = (dateStr: string): string | null => {
  const monthMap: { [key: string]: string } = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
    'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
    'january': '01', 'february': '02', 'march': '03', 'april': '04', 'may': '05', 'june': '06',
    'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12',
  };

  const trim = dateStr.trim();

  // Format 1: YYYY-MM-DD (e.g., 2026-02-19)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trim)) {
    return trim;
  }

  // Format 2: YYYY/MM/DD (e.g., 2026/02/19)
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(trim)) {
    return trim.replace(/\//g, '-');
  }

  // Format 3: MM/DD/YYYY (e.g., 02/19/2026)
  const match3 = trim.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match3) {
    const [, month, day, year] = match3;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Format 4: DD/MM/YYYY (e.g., 19/02/2026) - assuming day > 12 or month > 12 detection
  const match4 = trim.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match4) {
    const [, first, second, year] = match4;
    const firstNum = parseInt(first, 10);
    const secondNum = parseInt(second, 10);
    // If first > 12, it's definitely day; if second > 12, it's definitely month
    if (firstNum > 12) {
      return `${year}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`;
    } else if (secondNum > 12) {
      return `${year}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
    }
    // Default to MM/DD/YYYY if ambiguous
    return `${year}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
  }

  // Format 5: MM-DD-YYYY (e.g., 02-19-2026)
  const match5 = trim.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match5) {
    const [, month, day, year] = match5;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Format 6: DD-MM-YYYY (e.g., 19-02-2026) - with day > 12 detection
  const match6 = trim.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match6) {
    const [, first, second, year] = match6;
    const firstNum = parseInt(first, 10);
    const secondNum = parseInt(second, 10);
    if (firstNum > 12) {
      return `${year}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`;
    } else if (secondNum > 12) {
      return `${year}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
    }
    // Default to MM-DD-YYYY if ambiguous
    return `${year}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
  }

  // Format 7: YYYY-MMM-DD (e.g., 2026-Feb-19)
  const match7 = trim.match(/^(\d{4})-([A-Za-z]+)-(\d{1,2})$/);
  if (match7) {
    const [, year, monthStr, day] = match7;
    const monthNum = monthMap[monthStr];
    if (monthNum) {
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }
  }

  // Format 8: YYYY/MMM/DD (e.g., 2026/Feb/19)
  const match8 = trim.match(/^(\d{4})\/([A-Za-z]+)\/(\d{1,2})$/);
  if (match8) {
    const [, year, monthStr, day] = match8;
    const monthNum = monthMap[monthStr];
    if (monthNum) {
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }
  }

  // Format 9: DD MMM YYYY (e.g., 19 Feb 2026)
  const match9 = trim.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match9) {
    const [, day, monthStr, year] = match9;
    const monthNum = monthMap[monthStr];
    if (monthNum) {
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }
  }

  // Format 10: MMM DD, YYYY (e.g., Feb 19, 2026)
  const match10 = trim.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (match10) {
    const [, monthStr, day, year] = match10;
    const monthNum = monthMap[monthStr];
    if (monthNum) {
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }
  }

  // Format 11: YYYY-MM-DD (alternative with single digit month/day)
  const match11 = trim.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match11) {
    const [, year, month, day] = match11;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
};

export const BankTransactionImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  accounts,
  onImported,
}) => {
  const { showToast } = useToast();
  const [pastedText, setPastedText] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    date: 0,
    description: 1,
    referenceNumber: 2,
    income: 3,
    expense: 4,
  });
  const [showMapping, setShowMapping] = useState(false);
  const [importStrategy, setImportStrategy] = useState<'all-or-nothing' | 'partial'>('partial');
  const [importing, setImporting] = useState(false);
  const [previewType, setPreviewType] = useState<'summary' | 'valid' | 'invalid'>('summary');

  // Parse TSV data
  const parsedRows = useMemo(() => {
    if (!pastedText.trim()) return [];

    const lines = pastedText.trim().split('\n').filter(line => line.trim());
    const rows: ImportRow[] = lines.map((line, idx) => {
      const columns = line.split('\t');
      const errors: string[] = [];

      // Parse date
      const dateStr = columns[columnMapping.date]?.trim();
      let date: string | undefined;
      if (dateStr) {
        const parsedDate = parseDate(dateStr);
        if (!parsedDate) {
          errors.push(`Invalid date format: "${dateStr}" (YYYY-MM-DD, MM/DD/YYYY, DD MMM YYYY, etc.)`);
        } else {
          date = parsedDate;
        }
      } else {
        errors.push('Missing date');
      }

      // Parse other fields
      const description = columns[columnMapping.description]?.trim();
      if (!description) {
        errors.push('Missing description');
      }

      const referenceNumber = columns[columnMapping.referenceNumber]?.trim();

      // Parse income
      const incomeStr = columns[columnMapping.income]?.trim();
      let income: number | undefined;
      if (incomeStr) {
        const parsed = parseFloat(incomeStr);
        if (isNaN(parsed)) {
          errors.push(`Invalid income amount: "${incomeStr}"`);
        } else {
          income = parsed;
        }
      }

      // Parse expense
      const expenseStr = columns[columnMapping.expense]?.trim();
      let expense: number | undefined;
      if (expenseStr) {
        const parsed = parseFloat(expenseStr);
        if (isNaN(parsed)) {
          errors.push(`Invalid expense amount: "${expenseStr}"`);
        } else {
          expense = parsed;
        }
      }

      // Validate at least one amount exists
      if (!income && !expense) {
        errors.push('Must have either income or expense amount');
      }

      const valid = errors.length === 0;

      return {
        index: idx,
        raw: line,
        parsed: {
          date,
          description,
          referenceNumber,
          income,
          expense,
        },
        errors,
        valid,
      };
    });

    return rows;
  }, [pastedText, columnMapping]);

  const validRows = useMemo(() => parsedRows.filter(r => r.valid), [parsedRows]);
  const invalidRows = useMemo(() => parsedRows.filter(r => !r.valid), [parsedRows]);

  const handleImport = async () => {
    if (!selectedAccountId) {
      showToast('Please select a bank account', 'error');
      return;
    }

    if (validRows.length === 0) {
      showToast('No valid rows to import', 'error');
      return;
    }

    // Check strategy
    if (importStrategy === 'all-or-nothing' && invalidRows.length > 0) {
      showToast(`Cannot import: ${invalidRows.length} rows have errors. Fix them or switch to "Partial success" mode.`, 'error');
      return;
    }

    setImporting(true);
    let successCount = 0;
    let failureCount = 0;

    try {
      for (const row of validRows) {
        try {
          await FinanceService.createTransaction({
            date: row.parsed.date!,
            description: row.parsed.description!,
            purpose: '', // No purpose for bulk import
            amount: row.parsed.income || row.parsed.expense || 0,
            type: row.parsed.income ? 'Income' : 'Expense',
            category: 'Projects & Activities', // Default category
            status: 'Pending',
            bankAccountId: selectedAccountId,
            referenceNumber: row.parsed.referenceNumber,
            memberId: undefined,
            projectId: undefined,
          });
          successCount++;
        } catch (err) {
          failureCount++;
          console.error(`Failed to import row ${row.index}:`, err);
        }
      }

      showToast(
        `Import completed: ${successCount} success${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        failureCount === 0 ? 'success' : 'warning'
      );

      // Reset form
      setPastedText('');
      setSelectedAccountId('');
      setShowMapping(false);
      onImported(); // Refresh transaction list
      onClose();
    } catch (err) {
      showToast('Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const displayRows = useMemo(() => {
    if (previewType === 'valid') {
      return validRows;
    } else if (previewType === 'invalid') {
      return invalidRows;
    } else {
      return parsedRows.slice(0, 3);
    }
  }, [parsedRows, validRows, invalidRows, previewType]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Batch Import Bank Transactions" size="xl" scrollInBody={false}>
      <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Step 1: Select Account */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Bank Account</label>
          <Select
            name="bankAccountId"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            options={[
              { label: 'Select Account...', value: '' },
              ...accounts.map(acc => ({ label: `${acc.name} (${acc.currency})`, value: acc.id }))
            ]}
          />
        </div>

        {/* Step 2: Paste Data */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">Paste TSV Data</label>
            <button
              type="button"
              onClick={() => setShowMapping(!showMapping)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showMapping ? 'Hide' : 'Show'} Column Mapping
            </button>
          </div>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Paste TSV data (Date	Description	Ref	Income	Expense)"
            className="w-full h-24 p-2 border border-slate-200 rounded text-xs font-mono"
          />
          <p className="text-xs text-slate-500">Format: Tab-separated values with columns: Date, Description, Ref, Income, Expense</p>

          {/* Table Preview */}
          {parsedRows.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold text-slate-700 border-r border-slate-200">#</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-slate-700 border-r border-slate-200">Date</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-slate-700 border-r border-slate-200">Description</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-slate-700 border-r border-slate-200">Ref</th>
                      <th className="px-2 py-1.5 text-right font-semibold text-slate-700 border-r border-slate-200">Income</th>
                      <th className="px-2 py-1.5 text-right font-semibold text-slate-700">Expense</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map(row => (
                      <tr
                        key={row.index}
                        className={`border-b border-slate-200 ${
                          row.valid ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'
                        }`}
                      >
                        <td className="px-2 py-1 text-slate-600 border-r border-slate-200">{row.index + 1}</td>
                        <td className="px-2 py-1 text-slate-700 border-r border-slate-200 font-mono">
                          <span className={row.parsed.date ? 'text-slate-900' : 'text-red-600'}>
                            {row.parsed.date || '—'}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-slate-700 border-r border-slate-200 truncate max-w-lg">
                          <span className={row.parsed.description ? 'text-slate-900' : 'text-red-600'}>
                            {row.parsed.description || '—'}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-slate-600 border-r border-slate-200">{row.parsed.referenceNumber || '—'}</td>
                        <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200 font-mono">
                          {row.parsed.income ? `${row.parsed.income.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-2 py-1 text-right text-slate-700 font-mono">
                          {row.parsed.expense ? `${row.parsed.expense.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 0 && (
                <div className="bg-slate-50 px-2 py-1.5 border-t border-slate-200 text-xs text-slate-600">
                  Showing {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''}
                  {invalidRows.length > 0 && ` • ${invalidRows.length} error${invalidRows.length !== 1 ? 's' : ''}`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column Mapping (if shown) */}
        {showMapping && (
          <div className="bg-slate-50 p-3 rounded-lg space-y-2 border border-slate-200">
            <p className="text-xs font-semibold text-slate-700">Column Positions (0-indexed)</p>
            <div className="grid grid-cols-5 gap-2">
              <Input
                type="number"
                label="Date (col)"
                min={0}
                value={String(columnMapping.date)}
                onChange={(e) => setColumnMapping(prev => ({ ...prev, date: parseInt(e.target.value, 10) || 0 }))}
              />
              <Input
                type="number"
                label="Description (col)"
                min={0}
                value={String(columnMapping.description)}
                onChange={(e) => setColumnMapping(prev => ({ ...prev, description: parseInt(e.target.value, 10) || 0 }))}
              />
              <Input
                type="number"
                label="Ref (col)"
                min={0}
                value={String(columnMapping.referenceNumber)}
                onChange={(e) => setColumnMapping(prev => ({ ...prev, referenceNumber: parseInt(e.target.value, 10) || 0 }))}
              />
              <Input
                type="number"
                label="Income (col)"
                min={0}
                value={String(columnMapping.income)}
                onChange={(e) => setColumnMapping(prev => ({ ...prev, income: parseInt(e.target.value, 10) || 0 }))}
              />
              <Input
                type="number"
                label="Expense (col)"
                min={0}
                value={String(columnMapping.expense)}
                onChange={(e) => setColumnMapping(prev => ({ ...prev, expense: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
          </div>
        )}

        {/* Preview */}
        {parsedRows.length > 0 && (
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
            {/* Preview Type Tabs */}
            <div className="flex gap-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setPreviewType('summary')}
                className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition ${
                  previewType === 'summary'
                    ? 'border-blue-500 text-blue-600 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Summary ({parsedRows.length})
              </button>
              <button
                type="button"
                onClick={() => setPreviewType('valid')}
                className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition ${
                  previewType === 'valid'
                    ? 'border-green-500 text-green-600 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Valid ({validRows.length})
              </button>
              <button
                type="button"
                onClick={() => setPreviewType('invalid')}
                className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition ${
                  previewType === 'invalid'
                    ? 'border-red-500 text-red-600 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Errors ({invalidRows.length})
              </button>
            </div>

            {/* Preview Content */}
            <div className="max-h-48 overflow-y-auto space-y-1 text-xs font-mono">
              {displayRows.length > 0 ? (
                displayRows.map(row => (
                  <div key={row.index} className={row.valid ? 'text-green-600' : 'text-red-600'}>
                    <div className="flex items-start gap-2">
                      {row.valid ? <CheckCircle size={14} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 break-words">
                        <div>
                          Row {row.index + 1}: {row.parsed.date} | {row.parsed.description} | {row.parsed.referenceNumber || '-'}
                        </div>
                        {!row.valid && (
                          <div className="text-red-600 text-xs mt-0.5 ml-0">
                            Errors: {row.errors.join('; ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 text-xs py-2">
                  {previewType === 'summary' ? 'No data pasted yet' : `No ${previewType} rows`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        {parsedRows.length > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-blue-50 p-2 rounded border border-blue-200">
              <div className="font-semibold text-blue-900">{parsedRows.length}</div>
              <div className="text-blue-700">Total rows</div>
            </div>
            <div className="bg-green-50 p-2 rounded border border-green-200">
              <div className="font-semibold text-green-900">{validRows.length}</div>
              <div className="text-green-700">Valid</div>
            </div>
            <div className="bg-red-50 p-2 rounded border border-red-200">
              <div className="font-semibold text-red-900">{invalidRows.length}</div>
              <div className="text-red-700">Errors</div>
            </div>
          </div>
        )}

        {/* Import Strategy */}
        {validRows.length > 0 && invalidRows.length > 0 && (
          <div className="space-y-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
            <label className="block text-sm font-medium text-slate-700">Import Strategy</label>
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="strategy"
                  value="partial"
                  checked={importStrategy === 'partial'}
                  onChange={(e) => setImportStrategy(e.target.value as 'partial' | 'all-or-nothing')}
                />
                <span className="text-sm">✓ Partial Success (import valid rows only)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="strategy"
                  value="all-or-nothing"
                  checked={importStrategy === 'all-or-nothing'}
                  onChange={(e) => setImportStrategy(e.target.value as 'partial' | 'all-or-nothing')}
                />
                <span className="text-sm">✗ All-or-Nothing (reject if any errors)</span>
              </label>
            </div>
          </div>
        )}

        {/* Errors Detail (if many) */}
        {invalidRows.length > 0 && invalidRows.length <= 10 && (
          <div className="bg-red-50 p-3 rounded-lg border border-red-200 space-y-1">
            <p className="text-xs font-semibold text-red-900">Failed Rows</p>
            {invalidRows.map(row => (
              <div key={row.index} className="text-xs text-red-700">
                <strong>Row {row.index + 1}:</strong> {row.errors.join('; ')}
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={importing} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedAccountId || validRows.length === 0 || importing}
            loading={importing}
            className="flex-1"
          >
            {importing ? 'Importing...' : `Import ${validRows.length} rows`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default BankTransactionImportModal;
