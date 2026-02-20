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
    {
      key: 'category',
      label: 'Category',
      required: false,
      aliases: ['Category', 'Type'],
      validators: [(val) => {
        if (!val) return null;
        return ['Projects & Activities', 'Membership', 'Administrative'].includes(val) ? null : 'Invalid category';
      }],
      preprocessor: (val: any) => {
        if (!val) return '';
        const normalized = String(val).trim().toLowerCase();
        const map: Record<string, string> = {
          'projects & activities': 'Projects & Activities',
          'projects and activities': 'Projects & Activities',
          'membership': 'Membership',
          'administrative': 'Administrative',
          'admin': 'Administrative',
        };
        return map[normalized] || val;
      },
    },
    {
      key: 'projectTitle',
      label: 'Project Title',
      required: false,
      aliases: ['Project', 'Project Name', 'Activity'],
      validators: [
        (val, context) => {
          if (!val) return null;
          if (context?.projects) {
            const match = context.projects.find((p: any) =>
              (p.name?.toLowerCase() === val.toLowerCase()) ||
              (p.title?.toLowerCase() === val.toLowerCase())
            );
            if (!match) return `Project "${val}" not found`;
          }
          return null;
        }
      ],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'purpose',
      label: 'Purpose',
      required: false,
      aliases: ['Purpose', 'Goal', 'Target'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
  ],

  tableColumns: [
    { key: 'date', label: 'Date', width: 100 },
    { key: 'description', label: 'Description', width: 180 },
    { key: 'income', label: 'Income', width: 80 },
    { key: 'expense', label: 'Expense', width: 80 },
    { key: 'category', label: 'Category', width: 120 },
    { key: 'projectTitle', label: 'Project', width: 150 },
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
    category: 5,
    projectTitle: 6,
    purpose: 7,
  },

  sampleFileName: 'Bank_Statement_Import_Template.csv',
  sampleData: [
    ['Date', 'Description', 'Reference #', 'Income', 'Expense', 'Category', 'Project Title', 'Purpose'],
    ['2026-02-15', 'Membership Fees - John Doe', 'MBR-2026-001', '500', '0', 'Membership', '', 'Dues 2026'],
    ['2026-02-16', 'Venue Rental - Grand Hotel', 'EXP-2026-042', '0', '1200', 'Projects & Activities', 'Convention 2026', 'Venue Deposit'],
  ],

  // Import function - called for each valid row
  importer: async (row, context) => {
    let projectId = '';
    const projectTitle = row.projectTitle?.trim();

    if (projectTitle && context?.projects) {
      const match = context.projects.find((p: any) =>
        (p.name?.toLowerCase() === projectTitle.toLowerCase()) ||
        (p.title?.toLowerCase() === projectTitle.toLowerCase())
      );

      if (match) {
        projectId = match.id;
      }
    }

    const income = row.income || 0;
    const expense = row.expense || 0;
    const amount = income > 0 ? income : Math.abs(expense);
    const type = income > 0 ? 'Income' : 'Expense';

    await FinanceService.createTransaction({
      date: row.date,
      description: row.description,
      referenceNumber: row.referenceNumber,
      amount: amount,
      income: income,
      expense: expense,
      category: row.category,
      projectId: projectId || undefined,
      purpose: row.purpose,
      bankAccountId: context?.bankAccountId,
      status: 'Pending',
      type: type as 'Income' | 'Expense'
    } as any);
  },
};
