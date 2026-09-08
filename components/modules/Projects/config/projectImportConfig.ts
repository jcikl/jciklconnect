/**
 * Project Import Configuration
 * Supports auto column matching with user override capability
 */

import {
    BatchImportConfig,
} from '../../../shared/batchImport/batchImportTypes';
import {
    notEmpty,
    isValidDate,
} from '../../../shared/batchImport/validators';
import {
    parseDatePreprocessor,
    createChainedPreprocessor,
    trimPreprocessor,
    toNumberPreprocessor,
} from '../../../shared/batchImport/batchImportUtils';
import { ProjectsService } from '../../../../services/projectsService';
import { ProjectCommitteeMember } from '../../../../types';

/**
 * Parse an HTML table returned by the JCI Malaysia national events page into TSV text.
 * Uses DOMParser (browser-only) to extract rows from the first <table> found.
 * Columns detected from <th> headers; rows from <td> cells.
 * Unknown columns are preserved as-is so the user can remap them in the modal.
 */
function parseJciEventsHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) throw new Error('No table found in JCI Malaysia response');

  const rows: string[][] = [];

  // Header row
  const ths = Array.from(table.querySelectorAll('thead tr th, thead tr td'));
  if (ths.length > 0) {
    rows.push(ths.map(th => th.textContent?.trim() ?? ''));
  }

  // Data rows
  table.querySelectorAll('tbody tr').forEach(tr => {
    const cells = Array.from(tr.querySelectorAll('td'));
    if (cells.length === 0) return;
    rows.push(cells.map(td => td.textContent?.trim() ?? ''));
  });

  // Fallback: no thead — treat first <tr> as header
  if (rows.length === 0) {
    table.querySelectorAll('tr').forEach(tr => {
      const cells = Array.from(tr.querySelectorAll('th, td'));
      if (cells.length === 0) return;
      rows.push(cells.map(c => c.textContent?.trim() ?? ''));
    });
  }

  if (rows.length === 0) throw new Error('Table in JCI Malaysia response has no rows');

  return rows.map(r => r.join('\t')).join('\n');
}

export const projectImportConfig: BatchImportConfig = {
    name: 'Projects',

    fields: [
        {
            key: 'title',
            label: 'Project Title',
            required: true,
            aliases: ['Title', 'Project Name', 'Name', '项目名称', '标题', 'Name of Project', 'Match'],
            validators: [notEmpty],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'category',
            label: 'Category',
            required: false,
            aliases: ['Category', '项目类别', '组别', 'Classification', 'events', 'programs', 'projects', 'skill_development'],
            validators: [],
            preprocessor: (val: any) => {
                if (!val) return 'projects';
                const lower = String(val).trim().toLowerCase();
                // Map common variations to canonical keys
                if (lower.includes('event')) return 'events';
                if (lower.includes('program')) return 'programs';
                if (lower.includes('skill')) return 'skill_development';
                if (lower.includes('project')) return 'projects';
                return lower;
            },
            defaultValue: 'projects',
        },
        {
            key: 'proposedDate',
            label: 'Proposed Date',
            required: true,
            aliases: ['Proposed Date', '建议日期', 'Project Date', 'Date'],
            validators: [isValidDate],
            preprocessor: parseDatePreprocessor,
            defaultValue: new Date().toISOString().split('T')[0],
        },
        {
            key: 'proposedBudget',
            label: 'Proposed Budget',
            required: false,
            aliases: ['Budget', 'Proposed Budget', '预计预算', '预算', 'Estimated Cost'],
            validators: [],
            preprocessor: toNumberPreprocessor,
            defaultValue: 0,
        },
        {
            key: 'description',
            label: 'Description',
            required: false,
            aliases: ['Description', '项目描述', '简介', 'About'],
            validators: [],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'level',
            label: 'Level',
            required: false,
            aliases: ['Level', '项目层级', '级别'],
            validators: [],
            preprocessor: trimPreprocessor,
            defaultValue: 'Local',
        },
        {
            key: 'pillar',
            label: 'Pillar',
            required: false,
            aliases: ['Pillar', '发展机会', '四大机会'],
            validators: [],
            preprocessor: trimPreprocessor,
            defaultValue: 'Community',
        },
        {
            key: 'objectives',
            label: 'Objectives',
            required: false,
            aliases: ['Objectives', 'Goals', '项目目标', '目标'],
            validators: [],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'eventStartDate',
            label: 'Event Start Date',
            required: false,
            aliases: ['Event Start Date', '活动开始日期', 'Start Date'],
            validators: [isValidDate],
            preprocessor: parseDatePreprocessor,
        },
        {
            key: 'targetAudience',
            label: 'Target Audience',
            required: false,
            aliases: ['Target Audience', '目标群体', '对象'],
            validators: [],
            preprocessor: trimPreprocessor,
        },
    ],

    tableColumns: [
        { key: 'title', label: 'Title', width: 200 },
        { key: 'category', label: 'Category', width: 120 },
        { key: 'proposedDate', label: 'Date', width: 120 },
        { key: 'proposedBudget', label: 'Budget', width: 100 },
        { key: 'valid', label: 'Status', width: 80 },
    ],

    supportCsv: true,
    supportTsv: true,
    autoMapColumns: true,
    columnMappingEditable: true,
    autoMatchThreshold: 0.85,

    sampleFileName: 'JCI_Project_Import_Template.csv',
    sampleData: [
        ['Project Title', 'Description', 'Proposed Date', 'Event Start Date', 'Category', 'Level', 'Pillar', 'Proposed Budget', 'Objectives', 'Target Audience'],
        ['Summer Leadership Summit', 'Annual youth leadership training program', '2026-07-15', '2026-07-20', 'programs', 'Local', 'Individual', '5000', 'Develop leadership skills in 50 youth', 'Members and students'],
        ['Community Clean-up Day', 'Environmental awareness project', '2026-04-22', '2026-04-22', 'projects', 'Local', 'Community', '1200', 'Clean up Central Park area', 'Public'],
    ],

    loaders: [
        {
            label: 'JCI Malaysia',
            load: async () => {
                const res = await fetch('/.netlify/functions/jci-events-proxy');
                if (!res.ok) throw new Error(`Server error ${res.status}`);
                const html = await res.text();
                return parseJciEventsHtml(html);
            },
        },
    ],

    importer: async (row, context) => {
        const member = context?.user;

        const defaultCommittee: ProjectCommitteeMember[] = [
            {
                role: 'Organising Chairperson',
                memberId: '',
                tasks: [{ title: '', dueDate: '' }],
            },
        ];

        // Fall back to proposedDate when eventStartDate is not explicitly set,
        // so that date-dependent features (Finance year filter, Events view) work correctly.
        const eventStartDate = row.eventStartDate || row.proposedDate || undefined;

        await ProjectsService.createProject({
            name: row.title,
            title: row.title,
            description: row.description || '',
            proposedDate: row.proposedDate,
            proposedBudget: parseFloat(row.proposedBudget) || 0,
            objectives: row.objectives || '',
            category: row.category as any || 'projects',
            level: row.level as any || 'Local',
            pillar: row.pillar as any || 'Community',
            targetAudience: row.targetAudience || '',
            eventStartDate,
            status: 'Planning',
            submittedBy: member?.id || '',
            committee: defaultCommittee,
        } as any);
    },
};
