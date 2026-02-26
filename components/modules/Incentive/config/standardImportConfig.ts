/**
 * Incentive Standard Import Configuration
 */
import { BatchImportConfig } from '../../../shared/batchImport/batchImportTypes';
import { notEmpty } from '../../../shared/batchImport/validators';
import {
    trimPreprocessor,
} from '../../../shared/batchImport/batchImportUtils';
import { PointsService } from '../../../../services/pointsService';

export const standardImportConfig: BatchImportConfig = {
    name: 'Incentive Standards',
    fields: [
        {
            key: 'category',
            label: 'Category',
            required: true,
            aliases: ['Category', '类别', 'Star Category'],
            validators: [notEmpty],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'title',
            label: 'Standard Title',
            required: true,
            aliases: ['Title', 'Standard Title', 'Standard Name', 'Task Name', '标题', '名称'],
            validators: [notEmpty],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'milestoneTitle',
            label: 'Milestone Title',
            required: false,
            aliases: ['Milestone Title', 'Milestone', 'Requirement', 'Description', '描述', '分阶段题目'],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'points',
            label: 'Point',
            required: true,
            aliases: ['Point', 'Points', 'Score', 'Score Awarded', '分数', '分值'],
            validators: [notEmpty],
            preprocessor: (val) => String(val).trim(),
        },
        {
            key: 'deadline',
            label: 'Deadline',
            required: false,
            aliases: ['Deadline', 'Due Date', '截止日期', '期限制'],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'remarks',
            label: 'Remarks',
            required: false,
            aliases: ['Remarks', 'Note', '备注', '说明'],
            preprocessor: trimPreprocessor,
        },
        {
            key: 'targetType',
            label: 'Target',
            required: false,
            aliases: ['Target', 'Target Type', '对象', 'LO/Member'],
            defaultValue: 'MEMBER',
            preprocessor: (val) => {
                const s = String(val).toUpperCase();
                if (s.includes('LO') || s.includes('组织')) return 'LO';
                return 'MEMBER';
            },
        },
        {
            key: 'verificationType',
            label: 'Method',
            required: false,
            aliases: ['Method', 'Verification Type', '验证方式'],
            defaultValue: 'HYBRID',
            preprocessor: (val) => {
                const s = String(val).toUpperCase();
                if (s.includes('AUTO') || s.includes('系统')) return 'AUTO_SYSTEM';
                if (s.includes('MANUAL') || s.includes('手动')) return 'MANUAL_UPLOAD';
                return 'HYBRID';
            },
        }
    ],
    tableColumns: [
        { key: 'category', label: 'Category', width: 100 },
        { key: 'title', label: 'Standard Title', width: 160 },
        { key: 'milestoneTitle', label: 'Milestone Title', width: 160 },
        { key: 'points', label: 'Point', width: 80 },
        { key: 'deadline', label: 'Deadline', width: 100 },
        { key: 'remarks', label: 'Remarks', width: 120 },
        { key: 'targetType', label: 'Target', width: 80 },
        { key: 'verificationType', label: 'Method', width: 80 },
        { key: 'valid', label: 'Status', width: 80 },
    ],
    supportCsv: true,
    supportTsv: true,
    autoMapColumns: true,
    columnMappingEditable: true,
    importer: async (row, context) => {
        // Fallback for direct single-row import if needed, but we prefer batchImporter
        const programId = context?.programId;
        if (!programId) throw new Error('Program ID not found in context');
        const parsed = parseRowToStandard(row, programId);
        await PointsService.saveStandard(parsed as any);
    },
    batchImporter: async (rows, context, onProgress) => {
        const programId = context?.programId;
        if (!programId) throw new Error('Program ID not found in context');

        // 1. Group rows by Standard Title
        const groups: Record<string, any[]> = {};
        for (const row of rows) {
            const title = String(row.title || '').trim();
            if (!groups[title]) groups[title] = [];
            groups[title].push(row);
        }

        const groupTitles = Object.keys(groups);
        const total = groupTitles.length;

        // 2. Process each group
        for (let i = 0; i < groupTitles.length; i++) {
            const title = groupTitles[i];
            const groupRows = groups[title];

            // Use data from the first row for standard-level info
            const firstRow = groupRows[0];
            const standard = parseRowToStandard(firstRow, programId);

            // Merge milestones from ALL rows in the group
            const allMilestones: any[] = [];
            groupRows.forEach((row, rowIdx) => {
                const rowStandard = parseRowToStandard(row, programId);
                if (rowStandard.milestones) {
                    // Update milestone labels to ensure they are unique/descriptive if multiple rows
                    const ms = rowStandard.milestones.map((m, mIdx) => ({
                        ...m,
                        id: `ms_${title.replace(/\s+/g, '_')}_${rowIdx}_${mIdx}`
                    }));
                    allMilestones.push(...ms);
                }
            });

            if (allMilestones.length > 0) {
                standard.milestones = allMilestones;
                // If more than one milestone, it might be additive or tiered. 
                // Default to additive unless specified in milestones parsing.
            }

            await PointsService.saveStandard(standard as any);
            if (onProgress) onProgress(i + 1, total);
        }
    }
};

/**
 * Helper to parse a single row's raw data into a partial IncentiveStandard
 */
function parseRowToStandard(row: any, programId: string) {
    const rawScore = String(row.points || '');
    const rawDeadline = String(row.deadline || '');
    const milestones: any[] = [];
    let isTiered = false;

    // A. Parse complex scores (e.g. "5 + 5", "5-Oct")
    const scoreParts = rawScore.match(/\d+/g);
    const firstPointValue = scoreParts ? parseInt(scoreParts[0]) : 0;

    if (rawScore.includes('+') || rawScore.includes('-') || rawScore.toLowerCase().includes('or') || (scoreParts && scoreParts.length > 1)) {
        if (rawScore.includes('-') || rawScore.toLowerCase().includes('or')) isTiered = true;

        scoreParts?.forEach((s, idx) => {
            milestones.push({
                id: `ms_${Date.now()}_${idx}`,
                label: `Step ${idx + 1}`,
                points: parseInt(s) || 0
            });
        });
    }

    // B. Parse complex deadlines
    const deadlineMatches = rawDeadline.match(/(\d{1,2}\s+[A-Za-z]{3,}|[A-Z]{1,3}\s+\d{1,2})[^(]*(\(([^)]+)\))?/g);
    if (deadlineMatches && deadlineMatches.length > 1) {
        deadlineMatches.forEach((match, idx) => {
            const datePart = match.match(/(\d{1,2}\s+[A-Za-z]{3,}|[A-Z]{1,3}\s+\d{1,2})/)?.[0].trim();
            const labelPart = match.match(/\(([^)]+)\)/)?.[1];

            if (milestones[idx]) {
                milestones[idx].deadline = datePart;
                if (labelPart) milestones[idx].label = labelPart;
            } else {
                milestones.push({
                    id: `ms_dl_${Date.now()}_${idx}`,
                    label: labelPart || `Milestone ${idx + 1}`,
                    points: firstPointValue,
                    deadline: datePart
                });
            }
        });
    }

    return {
        programId,
        category: (() => {
            const cat = (row.category || '').toLowerCase().trim();
            if (cat.includes('efficient')) return 'efficient';
            if (cat.includes('network')) return 'network';
            if (cat.includes('experience')) return 'experience';
            if (cat.includes('outreach')) return 'outreach';
            if (cat.includes('impact')) return 'impact';
            return cat.replace(/\s+/g, '_');
        })(),
        title: row.title,
        remarks: row.remarks || '',
        targetType: row.targetType,
        verificationType: row.verificationType,
        order: 1,
        milestones: milestones.length > 0 ? milestones : (row.deadline || firstPointValue > 0 || row.milestoneTitle ? [{
            id: `ms_default_${Date.now()}`,
            label: row.milestoneTitle || 'Requirement',
            points: firstPointValue,
            deadline: row.deadline || ''
        }] : undefined),
        isTiered,
        evidenceRequirements: []
    };
}
