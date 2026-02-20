/**
 * Bank Transaction Import Configuration
 * Hardcoded column mapping, no automatic matching needed
 */

import {
  BatchImportConfig,
  ColumnMapping,
} from '../../../shared/batchImport/batchImportTypes';
import {
  isValidDate,
  isValidAmount,
} from '../../../shared/batchImport/validators';
import {
  parseDatePreprocessor,
  toNumberPreprocessor,
  trimPreprocessor,
} from '../../../shared/batchImport/batchImportUtils';
import { FinanceService } from '../../../../services/financeService';

export const bankTransactionImportConfig: BatchImportConfig = {
  name: 'Bank Transactions',

  fields: [
    {
      key: 'date',
      label: 'Date',
      required: true,
      aliases: ['Date', 'Transaction Date', 'Date Issued', 'Created Date'],
      validators: [isValidDate],
      preprocessor: parseDatePreprocessor,
    },
    {
      key: 'description',
      label: 'Description',
      required: true,
      aliases: ['Description', 'Memo', 'Reference', 'Remarks', 'Details'],
      validators: [(val) => !val || (typeof val === 'string' && val.trim() !== '') ? null : 'Description is required'],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'referenceNumber',
      label: 'Reference #',
      required: false,
      aliases: ['Reference', 'Ref', 'Reference No', 'Ref #', 'Transaction ID'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'income',
      label: 'Income',
      required: false,
      aliases: ['Income', 'Deposit', 'Credit', 'Received', 'Income Amount'],
      validators: [isValidAmount],
      defaultValue: 0,
      preprocessor: toNumberPreprocessor,
    },
    {
      key: 'expense',
      label: 'Expense',
      required: false,
      aliases: ['Expense', 'Cost', 'Withdrawal', 'Debit', 'Expense Amount'],
      validators: [isValidAmount],
      defaultValue: 0,
      preprocessor: toNumberPreprocessor,
    },
  ],

  tableColumns: [
    { key: 'date', label: 'Date', width: 120 },
    { key: 'description', label: 'Description', width: 240 },
    { key: 'income', label: 'Income', width: 100 },
    { key: 'expense', label: 'Expense', width: 100 },
    { key: 'valid', label: 'Status', width: 80 },
  ],

  // Finance uses TSV format with predictable column order
  supportCsv: true,
  supportTsv: true,
  autoMapColumns: false, // Don't auto-match, use hardcoded mapping
  columnMappingEditable: false, // User cannot change column mapping

  // Hardcoded column mapping for standard bank transaction format
  columnMapping: {
    date: 0,
    description: 1,
    referenceNumber: 2,
    income: 3,
    expense: 4,
  },

  sampleFileName: 'Bank_Statement_Import_Template.csv',
  sampleData: [
    ['Date', 'Description', 'Reference #', 'Income', 'Expense'],
    ['2026-02-15', 'Membership Fees - John Doe', 'MBR-2026-001', '500', '0'],
    ['2026-02-16', 'Venue Rental - Grand Hotel', 'EXP-2026-042', '0', '1200'],
  ],

  // Import function - called for each valid row
  importer: async (row) => {
    await FinanceService.createTransaction({
      date: row.date,
      description: row.description,
      referenceNumber: row.referenceNumber,
      income: row.income || 0,
      expense: row.expense || 0,
    } as any);
  },
};
