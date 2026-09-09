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
  desc?: string;      // short description from fetch-event
  lgDesc?: string;    // long description from fetch-event
  startTime?: string; // HH:MM 24h, enriched from fetch-event start_time
  endTime?: string;   // HH:MM 24h, enriched from fetch-event end_time
  logoUrl?: string;   // enriched from event HTML page (og:image)
  pillar?: string;    // enriched from event HTML page (badge)
  priceMin?: number;  // enriched from event HTML page (ticket prices)
  priceMax?: number;  // enriched from event HTML page (ticket prices)
}

/** Strip HTML tags and decode entities from API description fields. */
function decodeHtml(raw: string): string {
  if (!raw) return '';
  // Remove HTML tags
  const stripped = raw.replace(/<[^>]*>/g, ' ');
  // Decode common named + numeric entities via DOMParser (browser) or regex fallback
  try {
    const doc = new DOMParser().parseFromString(stripped, 'text/html');
    return (doc.body.textContent ?? stripped).replace(/\s+/g, ' ').trim();
  } catch {
    return stripped
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/\s+/g, ' ').trim();
  }
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

/** Convert "HH:MM am/pm" → "HH:MM" (24-hour). Returns '' if no match. */
function parseAmPmTime(segment: string): string {
  const m = segment.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = m[3].toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${min}`;
}

/** Extract start time (HH:MM 24h) from "2026-11-11 00:00 am - ..." */
function extractStartTime(datetime: string): string {
  return parseAmPmTime(datetime.split(' - ')[0] ?? '');
}

/** Extract end time (HH:MM 24h) from "... - 2026-11-14 23:59 pm" */
function extractEndTime(datetime: string): string {
  return parseAmPmTime(datetime.split(' - ')[1] ?? '');
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
    'Event Start Date', 'Event End Date', 'Event Start Time', 'Event End Time',
    'Level', 'Roadmap ID', 'Hosting LO', 'Area', 'Co-Hosting',
    'Description', 'Long Description', 'Status',
    'Logo URL', 'Pillar', 'Price Min', 'Price Max',
  ];
  const rows: string[][] = [headers];

  for (const ev of events) {
    const startDate = extractStartDate(ev.datetime);
    const endDate = extractEndDate(ev.datetime, startDate);

    rows.push([
      ev.title,
      ev.category,
      ev.group,
      startDate,
      endDate,
      ev.startTime || extractStartTime(ev.datetime),
      ev.endTime   || extractEndTime(ev.datetime),
      ev.level,
      ev.id,
      ev.chapter || '',
      ev.area,
      ev.coHosting || '',
      decodeHtml(ev.desc || ''),
      decodeHtml(ev.lgDesc || ''),
      ev.status || '',
      ev.logoUrl || '',
      ev.pillar || '',
      ev.priceMin != null ? String(ev.priceMin) : '',
      ev.priceMax != null ? String(ev.priceMax) : '',
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
            aliases: ['Description', '项目描述', '简介', 'About', 'Short Description'],
            validators: [],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'lgDesc',
            label: 'Long Description',
            required: false,
            aliases: ['Long Description', 'lg_desc', 'lgDesc', '详细描述', '长描述'],
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
            key: 'eventStartTime',
            label: 'Event Start Time',
            required: false,
            aliases: ['Event Start Time', 'Start Time', '开始时间'],
            validators: [],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'eventEndTime',
            label: 'Event End Time',
            required: false,
            aliases: ['Event End Time', 'End Time', '结束时间'],
            validators: [],
            preprocessor: trimPreprocessor,
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
        {
            key: 'logoUrl',
            label: 'Logo URL',
            required: false,
            aliases: ['Logo URL', 'logoUrl', 'Logo', 'Image URL', 'Poster URL'],
            validators: [],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'priceMin',
            label: 'Price Min',
            required: false,
            aliases: ['Price Min', 'priceMin', 'Min Price', 'Minimum Price', 'Price From'],
            validators: [],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'priceMax',
            label: 'Price Max',
            required: false,
            aliases: ['Price Max', 'priceMax', 'Max Price', 'Maximum Price', 'Price To'],
            validators: [],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'status',
            label: 'Status',
            required: false,
            aliases: ['Status', 'status', 'Event Status'],
            validators: [],
            // Map JCI Malaysia status → Project status
            preprocessor: (val: any) => {
                const v = String(val || '').toLowerCase().trim();
                if (v === 'completed') return 'Completed';
                if (v === 'published') return 'Active';
                if (v === 'draft') return 'Draft';
                return 'Planning';
            },
            defaultValue: 'Planning',
        },
    ],

    tableColumns: [
        { key: 'title', label: 'Title', width: 200 },
        { key: 'category', label: 'Category', width: 130 },
        { key: 'type', label: 'Type', width: 100 },
        { key: 'eventStartDate', label: 'Start', width: 100 },
        { key: 'eventEndDate', label: 'End', width: 100 },
        { key: 'level', label: 'Level', width: 80 },
        { key: 'status', label: 'JCI Status', width: 90 },
        { key: 'valid', label: 'Valid', width: 70 },
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
            params: [
                {
                    key: 'year',
                    label: 'Year',
                    type: 'select' as const,
                    options: (() => {
                        const cur = new Date().getFullYear();
                        return [String(cur + 1), String(cur), String(cur - 1), String(cur - 2)];
                    })(),
                    default: String(new Date().getFullYear()),
                },
                {
                    key: 'skip_step3',
                    label: 'Skip poster/pillar/price',
                    type: 'select' as const,
                    options: ['No', 'Yes'],
                    default: 'Yes',
                },
            ],
            load: async (onProgress, params) => {
                const year = params?.year ?? String(new Date().getFullYear());
                // Step 1: fetch merged event list from all 4 levels
                onProgress?.(`1/3 · 获取 ${year} 年活动列表…`);
                const listRes = await fetch(`/api/jci-events-proxy?year=${year}`);
                if (!listRes.ok) throw new Error(`Server error ${listRes.status}`);
                const listData = await listRes.json();
                if (listData.error) throw new Error(listData.error);
                const allEvents: JciMalaysiaEvent[] = listData.data ?? [];
                if (!allEvents.length) throw new Error('JCI Malaysia returned no events');

                // Filter out projects already in Firestore (deduplicate by roadmapId)
                const existingIds = await ProjectsService.getExistingRoadmapIds();
                const events = allEvents.filter(ev => !existingIds.has(ev.id));
                const skippedCount = allEvents.length - events.length;
                if (!events.length) throw new Error(`所有 ${allEvents.length} 个活动已存在于数据库，无需重新导入`);
                onProgress?.(skippedCount > 0
                    ? `1/3 · 共 ${allEvents.length} 个，跳过 ${skippedCount} 个已存在，新增 ${events.length} 个…`
                    : `1/3 · 共 ${allEvents.length} 个活动，全部为新项目…`);
                // Brief pause so the user can read the count before step 2 starts
                await new Promise(r => setTimeout(r, 800));

                // Step 2: batch-fetch detail (desc, lg_desc, cohosting, start/end time) in chunks
                const ids = events.map(ev => ev.id);
                const CHUNK = 100;
                const detailMap: Record<string, { desc: string; lgDesc: string; coHosting: string; startTime: string; endTime: string }> = {};
                let done = 0;
                onProgress?.(`2/3 · 加载详情 0/${ids.length}…`);
                for (let i = 0; i < ids.length; i += CHUNK) {
                    const chunk = ids.slice(i, i + CHUNK);
                    const res = await fetch('/api/jci-event-details', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: chunk }),
                    });
                    if (res.ok) Object.assign(detailMap, await res.json());
                    done += chunk.length;
                    onProgress?.(`2/3 · 加载详情 ${done}/${ids.length}…`);
                }

                // Step 3: batch-fetch HTML pages for logo, pillar and pricing (optional)
                const PAGE_CHUNK = 50;
                const pageMap: Record<string, { logoUrl: string; pillar: string; priceMin?: number; priceMax?: number }> = {};
                if (params?.skip_step3 !== 'Yes') {
                    done = 0;
                    onProgress?.(`3/3 · 同步海报/Pillar/价格 0/${ids.length}…`);
                    for (let i = 0; i < ids.length; i += PAGE_CHUNK) {
                        const chunk = ids.slice(i, i + PAGE_CHUNK);
                        try {
                            const res = await fetch('/api/jci-page-details', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ids: chunk }),
                            });
                            if (res.ok) Object.assign(pageMap, await res.json());
                        } catch { /* non-blocking — missing logo/pillar/price is acceptable */ }
                        done += chunk.length;
                        onProgress?.(`3/3 · 同步海报/Pillar/价格 ${done}/${ids.length}…`);
                    }
                } else {
                    onProgress?.('3/3 · 已跳过海报/Pillar/价格');
                }

                // Merge all enriched data into events
                const enriched = events.map(ev => ({
                    ...ev,
                    desc: detailMap[ev.id]?.desc || ev.desc || '',
                    lgDesc: detailMap[ev.id]?.lgDesc || ev.lgDesc || '',
                    coHosting: detailMap[ev.id]?.coHosting || ev.coHosting || '',
                    startTime: detailMap[ev.id]?.startTime || '',
                    endTime: detailMap[ev.id]?.endTime || '',
                    logoUrl: pageMap[ev.id]?.logoUrl || '',
                    pillar: pageMap[ev.id]?.pillar || '',
                    priceMin: pageMap[ev.id]?.priceMin,
                    priceMax: pageMap[ev.id]?.priceMax,
                }));

                return parseJciEventsJson(JSON.stringify({ data: enriched }));
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
            lgDesc: row.lgDesc || undefined,
            proposedDate: row.eventStartDate || new Date().toISOString().split('T')[0],
            proposedBudget: 0,
            category: row.category || '',
            type: row.type as any || 'project',
            level: row.level as any || 'Local',
            pillar: row.pillar as any || 'Community',
            eventStartDate: row.eventStartDate || undefined,
            eventEndDate: row.eventEndDate || undefined,
            eventStartTime: row.eventStartTime || undefined,
            eventEndTime: row.eventEndTime || undefined,
            roadmapId: row.roadmapId || undefined,
            roadmapUrl: row.roadmapId ? `https://jcimalaysia.cc/roadmap/event-details-public.php?eventid=${row.roadmapId}` : undefined,
            hostingLo: row.hostingLo || undefined,
            coHosting: row.coHosting || undefined,
            area: row.area || undefined,
            logoUrl: row.logoUrl || undefined,
            priceMin: row.priceMin ? parseFloat(row.priceMin) || undefined : undefined,
            priceMax: row.priceMax ? parseFloat(row.priceMax) || undefined : undefined,
            status: (row.status as any) || 'Planning',
            submittedBy: member?.id || '',
            committee: defaultCommittee,
        } as any);
    },
};
