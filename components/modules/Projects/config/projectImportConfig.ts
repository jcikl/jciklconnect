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

interface JciMalaysiaEvent {
  id: string;
  title: string;
  group: string;       // "Events" | "Skill Development" | "Programs" | "Projects"
  category: string;   // e.g. "National Convention", "JCIM Leadership Summit"
  datetime: string;   // "2026-11-11 00:00 am - 2026-11-14 23:59 pm"
  level: string;      // "National"
  chapter: string | null;
  area: string;
  status: string;     // "published" | "completed"
  year: string;
}

/** Extract YYYY-MM-DD from "2026-11-11 00:00 am - ..." */
function extractStartDate(datetime: string): string {
  const match = datetime.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

/** Extract end date YYYY-MM-DD from "... - 2026-11-14 23:59 pm", or fall back to start */
function extractEndDate(datetime: string, startDate: string): string {
  const parts = datetime.split(' - ');
  if (parts.length >= 2) {
    const match = parts[1].match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  return startDate;
}

/**
 * Parse the JSON response from JCI Malaysia national events API into TSV.
 * Maps: title → Project Title, group → Category, datetime start → Proposed Date + Event Start Date,
 * datetime end → Event End Date, level → Level, category → Description, chapter/area → Objectives.
 */
function parseJciEventsJson(json: string): string {
  const parsed = JSON.parse(json) as { data?: JciMalaysiaEvent[] };
  const events = parsed?.data;
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('No events found in JCI Malaysia response');
  }

  const headers = ['Project Title', 'Category', 'Proposed Date', 'Event Start Date', 'Level', 'Description', 'Objectives'];
  const rows: string[][] = [headers];

  for (const ev of events) {
    const startDate = extractStartDate(ev.datetime);
    const endDate = extractEndDate(ev.datetime, startDate);
    const description = [ev.category, ev.status === 'completed' ? '(Completed)' : '']
      .filter(Boolean).join(' ');
    const objectives = [ev.chapter, ev.area].filter(Boolean).join(', ');

    rows.push([
      ev.title,
      ev.group,         // preprocessor maps "Events"→events, "Skill Development"→skill_development, etc.
      startDate,
      endDate,
      ev.level,
      description,
      objectives,
    ]);
  }

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
                if (lower.includes('event')) return 'events';
                if (lower.includes('program')) return 'programs';
                if (lower.includes('skill') || lower.includes('development') || lower.includes('training')) return 'skill_development';
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
                const json = await res.text();
                return parseJciEventsJson(json);
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
