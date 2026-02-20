/**
 * Member Import Configuration
 * Supports auto column matching with user override capability
 */

import {
  BatchImportConfig,
} from '../../../shared/batchImport/batchImportTypes';
import {
  isValidEmail,
  isValidDate,
  isValidTier,
  isValidGender,
  isValidPhone,
  notEmpty,
} from '../../../shared/batchImport/validators';
import {
  parseDatePreprocessor,
  createChainedPreprocessor,
  trimPreprocessor,
  trimLowerPreprocessor,
  trimUpperPreprocessor,
  removeWhitespacePreprocessor,
  formatPhonePreprocessor,
  splitCommaPreprocessor,
} from '../../../shared/batchImport/batchImportUtils';
import { MembersService } from '../../../../services/membersService';

export const memberImportConfig: BatchImportConfig = {
  name: 'Members',

  fields: [
    {
      key: 'name',
      label: 'Name',
      required: true,
      aliases: ['Name', '姓名', '名字', 'Full Name', 'Member Name', 'First Name'],
      validators: [notEmpty],
      preprocessor: createChainedPreprocessor(trimPreprocessor, trimUpperPreprocessor),
    },
    {
      key: 'email',
      label: 'Email',
      required: true,
      aliases: ['Email', '邮箱', 'E-Mail', '電郵', 'Email Address', 'Work Email'],
      validators: [isValidEmail],
      preprocessor: createChainedPreprocessor(trimPreprocessor, trimLowerPreprocessor),
    },
    {
      key: 'phone',
      label: 'Phone',
      required: false,
      aliases: ['Phone', '电话', '手机', 'Mobile', 'Tel', 'Telephone', 'Phone Number'],
      validators: [isValidPhone],
      preprocessor: createChainedPreprocessor(formatPhonePreprocessor),
    },
    {
      key: 'tier',
      label: 'Tier',
      required: false,
      aliases: ['Tier', '等级', 'Level', 'Membership Level', 'Status', 'Member Type'],
      validators: [isValidTier],
      defaultValue: 'Bronze',
      preprocessor: trimUpperPreprocessor,
    },
    {
      key: 'idNumber',
      label: 'National ID',
      required: false,
      aliases: [
        'National ID',
        '身份证',
        'ID Number',
        'ID No',
        'National ID Number',
        'NRIC',
        'IC',
        'Passport',
      ],
      validators: [],
      preprocessor: createChainedPreprocessor(trimPreprocessor, removeWhitespacePreprocessor),
    },
    {
      key: 'dateOfBirth',
      label: 'Date of Birth',
      required: false,
      aliases: ['Date of Birth', '出生日期', 'DOB', 'Birthday', 'Birth Date'],
      validators: [isValidDate],
      preprocessor: parseDatePreprocessor,
    },
    {
      key: 'gender',
      label: 'Gender',
      required: false,
      aliases: ['Gender', '性别', 'Sex'],
      validators: [isValidGender],
      preprocessor: trimUpperPreprocessor,
    },
    {
      key: 'address',
      label: 'Address',
      required: false,
      aliases: ['Address', '地址', 'Home Address', 'Residential Address', 'Street'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'emergencyContactName',
      label: 'Emergency Contact',
      required: false,
      aliases: [
        'Emergency Contact',
        '紧急联系人',
        'Emergency Contact Name',
        'Emergency Name',
        'Contact Name',
      ],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'emergencyContactPhone',
      label: 'Emergency Phone',
      required: false,
      aliases: [
        'Emergency Phone',
        '紧急电话',
        'Emergency Contact Phone',
        'Emergency Number',
      ],
      validators: [isValidPhone],
      preprocessor: formatPhonePreprocessor,
    },
    {
      key: 'areaId',
      label: 'Region',
      required: false,
      aliases: ['Region', '地区', 'Area', 'Location', 'City', 'District'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'nationality',
      label: 'Nationality',
      required: false,
      aliases: ['Nationality', '国籍', 'Country', 'Citizenship'],
      validators: [],
      defaultValue: 'Malaysia',
      preprocessor: trimPreprocessor,
    },
    {
      key: 'companyName',
      label: 'Company',
      required: false,
      aliases: ['Company', '公司', 'Company Name', 'Organization', 'Employer'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'departmentAndPosition',
      label: 'Position',
      required: false,
      aliases: ['Position', '职位', 'Title', 'Job Title', 'Department', 'Designation'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      required: false,
      aliases: ['LinkedIn', 'Linkedin URL', 'LinkedIn Profile'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      required: false,
      aliases: ['Facebook', 'Facebook URL', 'FB', 'Facebook Profile'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'instagram',
      label: 'Instagram',
      required: false,
      aliases: ['Instagram', 'Instagram URL', 'IG', 'Instagram Handle'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'wechat',
      label: 'WeChat',
      required: false,
      aliases: ['WeChat', 'Wechat', 'Wechat ID', 'WeChat ID'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'hobbies',
      label: 'Hobbies',
      required: false,
      aliases: ['Hobbies', '爱好', 'Interests', 'Hobby', 'Activities'],
      validators: [],
      preprocessor: splitCommaPreprocessor,
    },
  ],

  tableColumns: [
    { key: 'name', label: 'Name', width: 120 },
    { key: 'email', label: 'Email', width: 180 },
    { key: 'phone', label: 'Phone', width: 130 },
    { key: 'tier', label: 'Tier', width: 100 },
    { key: 'companyName', label: 'Company', width: 150 },
    { key: 'valid', label: 'Status', width: 80 },
  ],

  // Members supports auto column matching
  supportCsv: true,
  supportTsv: true,
  autoMapColumns: true, // Enable auto header matching
  columnMappingEditable: true, // Allow user to override
  autoMatchThreshold: 0.85, // 85% similarity required

  // Import function - called for each valid row
  importer: async (row) => {
    await MembersService.createMember({
      name: row.name,
      email: row.email,
      phone: row.phone || '',
      tier: row.tier || 'Bronze',
      idNumber: row.idNumber || '',
      dateOfBirth: row.dateOfBirth || '',
      gender: row.gender || '',
      address: row.address || '',
      emergencyContactName: row.emergencyContactName || '',
      emergencyContactPhone: row.emergencyContactPhone || '',
      areaId: row.areaId || null,
      nationality: row.nationality || 'Malaysia',
      companyName: row.companyName || '',
      departmentAndPosition: row.departmentAndPosition || '',
      linkedin: row.linkedin || '',
      facebook: row.facebook || '',
      instagram: row.instagram || '',
      wechat: row.wechat || '',
      hobbies: row.hobbies || [],
      // System-set fields
      joinDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      role: 'MEMBER',
      points: 0,
      avatar: '',
      skills: [],
      churnRisk: 'Low',
      attendanceRate: 0,
      duesStatus: 'Pending',
      badges: [],
    } as Parameters<typeof MembersService.createMember>[0]);
  },
};
