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
  trimProperPreprocessor,
  removeWhitespacePreprocessor,
  formatPhonePreprocessor,
  splitCommaPreprocessor,
} from '../../../shared/batchImport/batchImportUtils';
import { MembersService } from '../../../../services/membersService';
import { formatDateToDDMMMYYYY } from '../../../../utils/dateUtils';

export const memberImportConfig: BatchImportConfig = {
  name: 'Members',

  fields: [
    {
      key: 'fullName',
      label: 'Full Name',
      required: true,
      aliases: ['Full Name', 'Full Name (ID)', 'fullname', '全名'],
      validators: [notEmpty],
      preprocessor: createChainedPreprocessor(trimPreprocessor, trimProperPreprocessor),
    },
    {
      key: 'idNumber',
      label: 'National ID',
      required: true,
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
      key: 'phone',
      label: 'Phone',
      required: true,
      aliases: ['Phone', '电话', '手机', 'Mobile', 'Tel', 'Telephone', 'Phone Number'],
      validators: [isValidPhone],
      preprocessor: createChainedPreprocessor(formatPhonePreprocessor),
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
      key: 'name',
      label: 'Name',
      required: false,
      aliases: ['Name', '姓名', '名字', 'Member Name', 'Short Name', 'Display Name'],
      validators: [],
      preprocessor: createChainedPreprocessor(trimPreprocessor, trimUpperPreprocessor),
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
    {
      key: 'joinDate',
      label: 'Join Date',
      required: false,
      aliases: ['Join Date', '加入日期', 'Member Since', 'Joined At'],
      validators: [isValidDate],
      preprocessor: parseDatePreprocessor,
    },
    {
      key: 'membershipType',
      label: 'Membership Type',
      required: false,
      aliases: ['Membership Type', '会员类型', 'Member Category', 'Type'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'introducer',
      label: 'Introducer',
      required: false,
      aliases: ['Introducer', '推荐人', 'Proposed By', 'Referred By'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'ethnicity',
      label: 'Ethnicity',
      required: false,
      aliases: ['Ethnicity', '种族', 'Race'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'businessCategory',
      label: 'Business Category',
      required: false,
      aliases: ['Business Category', '商业类别', 'Business Type', 'Biz Category'],
      validators: [],
      preprocessor: splitCommaPreprocessor,
    },
    {
      key: 'industry',
      label: 'Industry',
      required: false,
      aliases: ['Industry', '行业', 'Business Field', 'Nature of Business'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'cutStyle',
      label: 'Cut Style',
      required: false,
      aliases: ['Cut Style', '衣服版型', 'T-Shirt Cut', 'Uniform Style'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'tshirtSize',
      label: 'T-Shirt Size',
      required: false,
      aliases: ['T-Shirt Size', 'T恤尺寸', 'Shirt Size', 'Tee Size'],
      validators: [],
      preprocessor: trimUpperPreprocessor,
    },
    {
      key: 'jacketSize',
      label: 'Jacket Size',
      required: false,
      aliases: ['Jacket Size', '外套尺寸', 'Coat Size', 'Uniform Size'],
      validators: [],
      preprocessor: trimUpperPreprocessor,
    },
    {
      key: 'embroideredName',
      label: 'Embroidered Name',
      required: false,
      aliases: ['Embroidered Name', '刺绣名字', 'Embroidery Name', 'Name on Shirt'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'tshirtStatus',
      label: 'T-Shirt Status',
      required: false,
      aliases: ['T-Shirt Status', 'T恤状态', 'Uniform Status', 'Apparel Status'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'companyWebsite',
      label: 'Company Website',
      required: false,
      aliases: ['Company Website', '公司网站', 'Website', 'URL'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'acceptInternationalBusiness',
      label: 'Accept International Business',
      required: false,
      aliases: ['Accept International Business', '国际业务', 'Intl Biz', 'Cross-border Biz'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
    {
      key: 'companyDescription',
      label: 'Company Description',
      required: false,
      aliases: ['Company Description', '公司描述', 'About Company', 'Biz Summary'],
      validators: [],
      preprocessor: trimPreprocessor,
    },
  ],

  tableColumns: [
    { key: 'fullName', label: 'Full Name', width: 160 },
    { key: 'idNumber', label: 'National ID', width: 120 },
    { key: 'phone', label: 'Phone', width: 130 },
    { key: 'email', label: 'Email', width: 180 },
    { key: 'name', label: 'Name', width: 120 },
    { key: 'dateOfBirth', label: 'DOB', width: 120, formatter: formatDateToDDMMMYYYY },
    { key: 'gender', label: 'Gender', width: 80 },
    { key: 'nationality', label: 'Nationality', width: 100 },
    { key: 'companyName', label: 'Company', width: 150 },
    { key: 'departmentAndPosition', label: 'Position', width: 120 },
    { key: 'joinDate', label: 'Join Date', width: 120, formatter: formatDateToDDMMMYYYY },
    { key: 'membershipType', label: 'Membership Type', width: 120 },
    { key: 'introducer', label: 'Introducer', width: 120 },
    { key: 'ethnicity', label: 'Ethnicity', width: 80 },
    { key: 'industry', label: 'Industry', width: 150 },
    { key: 'tshirtSize', label: 'T-Shirt', width: 80 },
    { key: 'jacketSize', label: 'Jacket', width: 80 },
    { key: 'valid', label: 'Status', width: 80 },
  ],

  // Members supports auto column matching
  supportCsv: true,
  supportTsv: true,
  autoMapColumns: true, // Enable auto header matching
  columnMappingEditable: true, // Allow user to override
  autoMatchThreshold: 0.85, // 85% similarity required

  // Import function - called for each valid row
  importer: async (row, context) => {
    // Find existing member by ID number
    const normalizeIdNumber = (value: any) => String(value || '').replace(/\s/g, '').toUpperCase();
    const idNumber = normalizeIdNumber(row.idNumber);
    let existingId = row._existingId;

    if (!existingId && idNumber && context?.members && Array.isArray(context.members)) {
      const existing = context.members.find((m: any) => normalizeIdNumber(m.idNumber) === idNumber);
      if (existing) {
        existingId = existing.id;
      }
    }

    const isUpdate = !!existingId;

    // Helper to check if a value is "empty" for import purposes (should not overwrite)
    const isEmptyValue = (val: any) => {
      return val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
    };

    if (isUpdate) {
      // UPDATE MODE: Partial update, ignoring empty fields in the import data
      const updates: any = {};
      
      // List of all fields that can be updated from the import row
      const updateableFields = [
        'name', 'email', 'phone', 'idNumber', 'dateOfBirth', 'gender', 
        'address', 'emergencyContactName', 'emergencyContactPhone', 'areaId', 
        'nationality', 'companyName', 'departmentAndPosition', 'linkedin', 
        'facebook', 'instagram', 'wechat', 'hobbies', 'joinDate', 
        'introducer', 'fullName', 'ethnicity', 
        'businessCategory', 'industry', 'cutStyle', 'tshirtSize', 
        'jacketSize', 'embroideredName', 'tshirtStatus', 'companyWebsite', 
        'acceptInternationalBusiness', 'companyDescription'
      ];

      updateableFields.forEach(field => {
        let val = row[field];

        // Only include in update if the value is not empty
        if (!isEmptyValue(val)) {
          updates[field] = val;
        }
      });

      if (Object.keys(updates).length > 0) {
        await MembersService.updateMember(existingId, updates);
      }
    } else {
      // CREATE MODE: Build full payload with defaults for new records
      const payload = {
        name: row.name,
        email: row.email,
        phone: row.phone || '',
        tier: 'Bronze',
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
        joinDate: row.joinDate || new Date().toISOString().split('T')[0],
        introducer: row.introducer || '',
        fullName: row.fullName || row.name,
        ethnicity: row.ethnicity || '',
        businessCategory: row.businessCategory || [],
        industry: row.industry || '',
        cutStyle: row.cutStyle || '',
        tshirtSize: row.tshirtSize || '',
        jacketSize: row.jacketSize || '',
        embroideredName: row.embroideredName || '',
        tshirtStatus: row.tshirtStatus || 'NA',
        companyWebsite: row.companyWebsite || '',
        acceptInternationalBusiness: row.acceptInternationalBusiness || 'No',
        companyDescription: row.companyDescription || '',
        
        // System-set fields for new members
        status: 'Active',
        role: 'MEMBER',
        points: 0,
        avatar: '',
        skills: [],
        churnRisk: 'Low',
        attendanceRate: 0,
        duesStatus: 'Pending',
        badges: []
      } as Parameters<typeof MembersService.createMember>[0];
      
      await MembersService.createMember(payload);
    }
  },

  rowPostProcessor: (row, context) => {
    if (context?.members && Array.isArray(context.members)) {
      const normalizeIdNumber = (value: any) => String(value || '').replace(/\s/g, '').toUpperCase();
      const idNumber = normalizeIdNumber(row.parsed?.idNumber);
      if (idNumber) {
        const existing = context.members.find((m: any) => normalizeIdNumber(m.idNumber) === idNumber);
        if (existing) {
          row.isUpdate = true;
          row.parsed._existingId = existing.id;
        }
      }

    }
    return row;
  },
};
