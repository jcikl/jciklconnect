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
    trimPreprocessor,
} from '../../../shared/batchImport/batchImportUtils';
import { ProjectsService } from '../../../../services/projectsService';
import { ProjectCommitteeMember } from '../../../../types';

interface JciMalaysiaEvent {
  id: string;
  title: string;
  group: string;       // "JCIM Program" | "Skill Development" | "Events" | "LO Projects"
  category: string;   // e.g. "National Convention", "JCIM Leadership Summit"
  datetime: string;   // "2026-11-11 00:00 am - 2026-11-14 23:59 pm"
  level: string;      // "National"
  chapter: string | null;
  area: string;
  status: string;     // "published" | "completed"
  year: string;
  coHosting?: string; // enriched by proxy from fetch-event detail
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
 * category (ev.category) → Category; group (ev.group) → Type;
 * ev.id → Roadmap ID; ev.chapter → Hosting LO; ev.area → Area.
 */
function parseJciEventsJson(json: string): string {
  const parsed = JSON.parse(json) as { data?: JciMalaysiaEvent[] };
  const events = parsed?.data;
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('No events found in JCI Malaysia response');
  }

  const headers = [
    'Project Title', 'Category', 'Type',
    'Event Start Date', 'Event End Date',
    'Level', 'Roadmap ID', 'Hosting LO', 'Area', 'Co-Hosting',
  ];
  const rows: string[][] = [headers];

  for (const ev of events) {
    const startDate = extractStartDate(ev.datetime);
    const endDate = extractEndDate(ev.datetime, startDate);

    rows.push([
      ev.title,
      ev.category,          // specific JCI Malaysia category name (free-form)
      ev.group,             // type preprocessor: "JCIM Program"→program, "LO Projects"→project, etc.
      startDate,
      endDate,
      ev.level,
      ev.id,
      ev.chapter || '',
      ev.area,
      ev.coHosting || '',
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
            aliases: ['Title', 'Project Name', 'Name', '项目名称', '标题', 'Name of Project'],
            validators: [notEmpty],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'category',
            label: 'Category',
            required: false,
            aliases: ['Category', '项目类别', '组别', 'Classification'],
            validators: [],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'type',
            label: 'Type',
            required: false,
            aliases: ['Type', '类型', 'JCIM Program', 'LO Projects', 'Skill Development', 'Events'],
            validators: [],
            preprocessor: (val: any) => {
                if (!val) return 'project';
                const lower = String(val).trim().toLowerCase();
                if (lower.includes('event')) return 'event';
                if (lower.includes('program') || lower === 'jcim program') return 'program';
                if (lower.includes('skill') || lower.includes('development') || lower.includes('training')) return 'skill_development';
                if (lower.includes('project') || lower === 'lo projects') return 'project';
                return 'project';
            },
            defaultValue: 'project',
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
            key: 'eventStartDate',
            label: 'Event Start Date',
            required: false,
            aliases: ['Event Start Date', '活动开始日期', 'Start Date'],
            validators: [isValidDate],
            preprocessor: parseDatePreprocessor,
        },
        {
            key: 'eventEndDate',
            label: 'Event End Date',
            required: false,
            aliases: ['Event End Date', '活动结束日期', 'End Date'],
            validators: [isValidDate],
            preprocessor: parseDatePreprocessor,
        },
        {
            key: 'roadmapId',
            label: 'Roadmap ID',
            required: false,
            aliases: ['Roadmap ID', 'JCI ID', 'roadmapid'],
            validators: [],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'hostingLo',
            label: 'Hosting LO',
            required: false,
            aliases: ['Hosting LO', 'Chapter', 'Host Chapter', 'chapter'],
            validators: [],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'area',
            label: 'Area',
            required: false,
            aliases: ['Area', '地区', 'area'],
            validators: [],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'coHosting',
            label: 'Co-Hosting',
            required: false,
            aliases: ['Co-Hosting', 'Co-host', 'Co Host', 'Cohosting', 'cohosts'],
            validators: [],
            preprocessor: trimPreprocessor,
        },
    ],

    tableColumns: [
        { key: 'title', label: 'Title', width: 200 },
        { key: 'category', label: 'Category', width: 130 },
        { key: 'type', label: 'Type', width: 100 },
        { key: 'eventStartDate', label: 'Start', width: 100 },
        { key: 'eventEndDate', label: 'End', width: 100 },
        { key: 'level', label: 'Level', width: 80 },
        { key: 'valid', label: 'Status', width: 70 },
    ],

    supportCsv: true,
    supportTsv: true,
    autoMapColumns: true,
    columnMappingEditable: true,
    autoMatchThreshold: 0.85,

    sampleFileName: 'JCI_Project_Import_Template.csv',
    sampleData: [
        ['Project Title', 'Category', 'Type', 'Event Start Date', 'Event End Date', 'Level', 'Pillar', 'Description', 'Roadmap ID', 'Hosting LO', 'Area'],
        ['Leadership Summit', 'National Convention', 'program', '2026-07-20', '2026-07-22', 'National', 'Individual', 'Annual leadership training', 'JCI001', 'JCI KL', 'Central'],
        ['Community Clean-up', 'Environmental Project', 'project', '2026-04-22', '2026-04-22', 'Local', 'Community', 'Green city initiative', '', 'JCI PJ', 'West'],
    ],

    loaders: [
        {
            label: 'JCI Malaysia',
            load: async () => {
                const res = await fetch('/api/jci-events-proxy');
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

        await ProjectsService.createProject({
            name: row.title,
            title: row.title,
            description: row.description || '',
            proposedDate: row.eventStartDate || new Date().toISOString().split('T')[0],
            proposedBudget: 0,
            category: row.category || '',
            type: row.type as any || 'project',
            level: row.level as any || 'Local',
            pillar: row.pillar as any || 'Community',
            eventStartDate: row.eventStartDate || undefined,
            eventEndDate: row.eventEndDate || undefined,
            roadmapId: row.roadmapId || undefined,
            roadmapUrl: row.roadmapId ? `https://jcimalaysia.cc/roadmap/event-details-public.php?eventid=${row.roadmapId}` : undefined,
            hostingLo: row.hostingLo || undefined,
            coHosting: row.coHosting || undefined,
            area: row.area || undefined,
            status: 'Planning',
            submittedBy: member?.id || '',
            committee: defaultCommittee,
        } as any);
    },
};
