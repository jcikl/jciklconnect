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
} from '../../../shared/batchImport/batchImportUtils';
import { ProjectsService } from '../../../../services/projectsService';
import { ProjectCommitteeMember } from '../../../../types';

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
            key: 'description',
            label: 'Description',
            required: false,
            aliases: ['Description', '项目描述', '简介', 'About'],
            validators: [],
            preprocessor: trimPreprocessor,
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
            key: 'category',
            label: 'Category',
            required: false,
            aliases: ['Category', '项目类别', '组别', 'Classification'],
            validators: [],
            preprocessor: trimPreprocessor,
            defaultValue: 'projects',
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
            key: 'proposedBudget',
            label: 'Proposed Budget',
            required: false,
            aliases: ['Budget', 'Proposed Budget', '预计预算', '预算', 'Estimated Cost'],
            validators: [],
            defaultValue: '0',
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
        ['Project Title', 'Description', 'Proposed Date', 'Category', 'Level', 'Pillar', 'Proposed Budget', 'Objectives', 'Target Audience'],
        ['Summer Leadership Summit', 'Annual youth leadership training program', '2026-07-15', 'programs', 'Local', 'Individual', '5000', 'Develop leadership skills in 50 youth', 'Members and students'],
        ['Community Clean-up Day', 'Environmental awareness project', '2026-04-22', 'projects', 'Local', 'Community', '1200', 'Clean up Central Park area', 'Public'],
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
            proposedDate: row.proposedDate,
            proposedBudget: parseFloat(row.proposedBudget) || 0,
            objectives: row.objectives || '',
            category: row.category as any || 'projects',
            level: row.level as any || 'Local',
            pillar: row.pillar as any || 'Community',
            targetAudience: row.targetAudience || '',
            status: 'Planning',
            submittedBy: member?.id || '',
            committee: defaultCommittee,
        } as any);
    },
};
