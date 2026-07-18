// Data Import/Export Service
import Papa from 'papaparse';
import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
// xlsx is dynamically imported inside importFromFile() and exportToExcel() to avoid eager loading
import {
  DataImportResult,
  DataImportError,
  DataImportWarning,
  DataImportSummary,
  DataExportRequest,
  DataExportFilter,
  DataValidationRule,
  ImportTemplate,
  DataOperation,
  Member,
  Event,
  Project,
  Transaction
} from '../types';
import { MembersService } from './membersService';
import { isMalaysianIC, getBirthPlaceFromIC, getDateOfBirthFromIC, getGenderFromIC } from '../utils/malaysianIdUtils';
import { EventsService } from './eventsService';

export type RawImportRow = Record<string, string>;

export class DataImportExportService {
  private static validationRules: Record<string, DataValidationRule[]> = {
    members: [
      { field: 'name', type: 'required' },
      { field: 'email', type: 'required' },
      { field: 'email', type: 'email' },
      { field: 'email', type: 'unique' },
      { field: 'phone', type: 'phone', config: { message: 'Invalid phone format' } },
      { field: 'role', type: 'enum', config: { values: ['GUEST', 'MEMBER', 'BOARD', 'ADMIN', 'INACTIVE'] } },
      { field: 'tier', type: 'enum', config: { values: ['Bronze', 'Silver', 'Gold', 'Platinum'] } },
      { field: 'membershipType', type: 'enum', config: { values: ['Guest', 'Official', 'Probation', 'Honorary', 'Visiting', 'Senator'] } },
      { field: 'status', type: 'enum', config: { values: ['Active', 'Inactive', 'Suspended', 'Pending'] } },
      { field: 'gender', type: 'enum', config: { values: ['Male', 'Female'] } },
      { field: 'ethnicity', type: 'enum', config: { values: ['Chinese', 'Malay', 'Indian', 'Others'] } },
      { field: 'cutStyle', type: 'enum', config: { values: ['Unisex', 'Lady Cut'] } },
      { field: 'tshirtStatus', type: 'enum', config: { values: ['NA', 'Requested', 'Sent', 'Delivered', 'Received'] } }
    ],
    events: [
      { field: 'title', type: 'required' },
      { field: 'date', type: 'required' },
      { field: 'date', type: 'date' },
      { field: 'type', type: 'enum', config: { values: ['Meeting', 'Training', 'Social', 'Project', 'International'] } },
      { field: 'capacity', type: 'number', config: { min: 1 } }
    ],
    projects: [
      { field: 'name', type: 'required' },
      { field: 'startDate', type: 'required' },
      { field: 'startDate', type: 'date' },
      { field: 'endDate', type: 'date' },
      { field: 'status', type: 'enum', config: { values: ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'] } },
      { field: 'budget', type: 'number', config: { min: 0 } }
    ]
  };

  /**
   * Parse uploaded file and extract data
   */
  static async parseFile(file: File): Promise<RawImportRow[]> {
    if (file.size > 10 * 1024 * 1024) throw new Error('文件过大（最大 10MB），请拆分后分批导入');
    return new Promise((resolve, reject) => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
          transform: (value) => value.trim(),
          complete: (results) => {
            if (results.errors.length > 0) {
              reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
            } else {
              resolve(results.data as RawImportRow[]);
            }
          },
          error: (error) => reject(error)
        });
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const XLSX = await import('xlsx');
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
              header: 1,
              defval: '',
              blankrows: false
            });

            if (jsonData.length === 0) {
              reject(new Error('Excel file is empty'));
              return;
            }

            // Convert to objects with headers
            const headers = (jsonData[0] as string[]).map(h => String(h).trim());
            const rows = jsonData.slice(1) as any[][];
            const objects: RawImportRow[] = rows.map(row => {
              const obj: RawImportRow = {};
              headers.forEach((header, index) => {
                obj[header] = row[index] ? String(row[index]).trim() : '';
              });
              return obj;
            });

            resolve(objects);
          } catch (error) {
            reject(new Error(`Excel parsing error: ${error}`));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read Excel file'));
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Unsupported file format. Please use CSV or Excel files.'));
      }
    });
  }

  /**
   * Parse CSV content string
   */
  static async parseCSVContent(content: string): Promise<RawImportRow[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
          } else {
            resolve(results.data as RawImportRow[]);
          }
        },
        error: (error) => reject(error)
      });
    });
  }

  /**
   * Validate imported data
   */
  static validateData(data: any[], entityType: string): { errors: DataImportError[], warnings: DataImportWarning[] } {
    const errors: DataImportError[] = [];
    const warnings: DataImportWarning[] = [];
    const rules = this.validationRules[entityType] || [];
    const uniqueFields = rules.filter(r => r.type === 'unique').map(r => r.field);
    const seenValues: Record<string, Set<any>> = {};

    // Initialize unique field tracking
    uniqueFields.forEach(field => {
      seenValues[field] = new Set();
    });

    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because index is 0-based and we skip header row

      rules.forEach(rule => {
        const value = row[rule.field];

        switch (rule.type) {
          case 'required':
            if (!value || value === '') {
              errors.push({
                row: rowNumber,
                field: rule.field,
                message: `[${rule.field}] is required`,
                value,
                severity: 'error'
              });
            }
            break;

          case 'email':
            if (value && !this.isValidEmail(value)) {
              errors.push({
                row: rowNumber,
                field: rule.field,
                message: `[${rule.field}] Invalid email format: ${value}`,
                value,
                severity: 'error'
              });
            }
            break;

          case 'phone':
            if (value && !this.isValidPhone(value)) {
              warnings.push({
                row: rowNumber,
                field: rule.field,
                message: `[${rule.field}] Invalid phone format: ${value}`,
                value
              });
            }
            break;

          case 'date':
            if (value && !this.isValidDate(value)) {
              errors.push({
                row: rowNumber,
                field: rule.field,
                message: `[${rule.field}] Invalid date format: ${value}`,
                value,
                severity: 'error'
              });
            }
            break;

          case 'number':
            if (value && isNaN(Number(value))) {
              errors.push({
                row: rowNumber,
                field: rule.field,
                message: `[${rule.field}] Invalid number format: ${value}`,
                value,
                severity: 'error'
              });
            } else if (value && rule.config) {
              const num = Number(value);
              if (rule.config.min !== undefined && num < rule.config.min) {
                errors.push({
                  row: rowNumber,
                  field: rule.field,
                  message: `[${rule.field}] Value must be at least ${rule.config.min}`,
                  value,
                  severity: 'error'
                });
              }
              if (rule.config.max !== undefined && num > rule.config.max) {
                errors.push({
                  row: rowNumber,
                  field: rule.field,
                  message: `[${rule.field}] Value must be at most ${rule.config.max}`,
                  value,
                  severity: 'error'
                });
              }
            }
            break;

          case 'enum':
            if (value && rule.config?.values && !rule.config.values.includes(value)) {
              errors.push({
                row: rowNumber,
                field: rule.field,
                message: `[${rule.field}] Invalid value. Must be one of: ${rule.config.values.join(', ')}`,
                value,
                severity: 'error'
              });
            }
            break;

          case 'unique':
            if (value) {
              if (seenValues[rule.field].has(value)) {
                errors.push({
                  row: rowNumber,
                  field: rule.field,
                  message: `[${rule.field}] Duplicate value: ${value}`,
                  value,
                  severity: 'error'
                });
              } else {
                seenValues[rule.field].add(value);
              }
            }
            break;

          case 'length':
            if (value && rule.config) {
              const length = String(value).length;
              if (rule.config.min !== undefined && length < rule.config.min) {
                errors.push({
                  row: rowNumber,
                  field: rule.field,
                  message: `[${rule.field}] Minimum length is ${rule.config.min} characters`,
                  value,
                  severity: 'error'
                });
              }
              if (rule.config.max !== undefined && length > rule.config.max) {
                errors.push({
                  row: rowNumber,
                  field: rule.field,
                  message: `[${rule.field}] Maximum length is ${rule.config.max} characters`,
                  value,
                  severity: 'error'
                });
              }
            }
            break;

          case 'pattern':
            if (value && rule.config?.pattern) {
              const regex = new RegExp(rule.config.pattern);
              if (!regex.test(value)) {
                errors.push({
                  row: rowNumber,
                  field: rule.field,
                  message: rule.config.message || `[${rule.field}] Value does not match required pattern`,
                  value,
                  severity: 'error'
                });
              }
            }
            break;
        }
      });
    });

    return { errors, warnings };
  }

  /**
   * Import data after validation
   */
  static async importData(
    data: any[],
    entityType: string,
    userId: string,
    filename: string
  ): Promise<DataImportResult> {
    const startTime = Date.now();
    const { errors, warnings } = this.validateData(data, entityType);

    // If there are validation errors, return failed result
    if (errors.length > 0) {
      return {
        id: this.generateId(),
        filename,
        totalRows: data.length,
        successfulRows: 0,
        failedRows: data.length,
        errors,
        warnings,
        status: 'failed',
        importedAt: new Date(),
        importedBy: userId,
        duration: Date.now() - startTime,
        summary: {
          created: 0,
          updated: 0,
          skipped: 0,
          duplicates: 0,
          invalidRecords: errors.length
        }
      };
    }

    // Process valid data
    const summary: DataImportSummary = {
      created: 0,
      updated: 0,
      skipped: 0,
      duplicates: 0,
      invalidRecords: 0
    };

    // Header mapping to normalize CSV headers to Member properties
    const headerMapping: Record<string, string> = {
      // Basic Info
      'fullname': 'fullName',
      'idnumber': 'idNumber',
      'email': 'email',
      'phone': 'phone',
      'dateofbirth': 'dateOfBirth',
      'gender': 'gender',
      'ethnicity': 'ethnicity',
      'nationality': 'nationality',
      'hobbies': 'hobbies',
      // Professional
      'companyname': 'companyName',
      'companywebsite': 'companyWebsite',
      'companydescription': 'companyDescription',
      'departmentandposition': 'departmentAndPosition',
      'industry': 'industry',
      'businesscategory': 'businessCategory',
      'interestedindustries': 'interestedIndustries',
      'acceptinternationalbusiness': 'acceptInternationalBusiness',
      'specialoffer': 'specialOffer',
      'companylogourl': 'companyLogoUrl',
      // Contact
      'alternatephone': 'alternatePhone',
      'whatsappgroup': 'whatsappGroup',
      'address': 'address',
      'linkedin': 'linkedin',
      'facebook': 'facebook',
      'instagram': 'instagram',
      'wechat': 'wechat',
      'emergencycontactname': 'emergencyContactName',
      'emergencycontactphone': 'emergencyContactPhone',
      'emergencycontactrelationship': 'emergencyContactRelationship',
      // Apparel
      'cutstyle': 'cutStyle',
      'tshirtsize': 'tshirtSize',
      'jacketsize': 'jacketSize',
      'embroideredname': 'embroideredName',
      'tshirtstatus': 'tshirtStatus',
      // Others
      'introducer': 'introducer',
      'duesyear': 'duesYear',
      'duespaiddate': 'duesPaidDate',
      'senatorcertified': 'senatorCertified',
      'skills': 'skills'
    };

    const arrayFields = ['skills', 'hobbies', 'businessCategory', 'interestedIndustries'];

    // Pre-fetch all existing member emails in one Firestore read to avoid O(n) per-row queries.
    // Map: normalised email → member id, used by checkIfRecordExists below.
    const existingMemberEmailToId = new Map<string, string>();
    if (entityType === 'members') {
      const allMembers = await MembersService.getAllMembers();
      for (const m of allMembers) {
        if (m.email && m.id) {
          existingMemberEmailToId.set(m.email.toLowerCase(), m.id);
        }
      }
    }

    // Normalize all rows first
    const normalizedRows: Array<{ row: any; originalIndex: number }> = data.map((row, index) => {
      const normalizedRow: any = {};
      Object.keys(row).forEach(header => {
        const normalizedHeader = headerMapping[header.toLowerCase()] || header;
        let value = row[header];

        if (arrayFields.includes(normalizedHeader) && typeof value === 'string') {
          value = value.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        }
        if ((normalizedHeader === 'senatorCertified' || normalizedHeader === 'whatsappGroup') && typeof value === 'string') {
          value = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
        }
        if (normalizedHeader === 'duesYear' && typeof value === 'string' && value !== '') {
          value = parseInt(value, 10);
        }
        if (normalizedHeader === 'gender' && typeof value === 'string') {
          const g = value.trim().toLowerCase();
          if (g === 'male' || g === 'm') value = 'Male';
          else if (g === 'female' || g === 'f') value = 'Female';
        }
        normalizedRow[normalizedHeader] = value;
      });

      if (entityType === 'members') {
        const ic: string = normalizedRow.idNumber || normalizedRow.nationalId || '';
        if (isMalaysianIC(ic)) {
          if (!normalizedRow.birthPlace) { const bp = getBirthPlaceFromIC(ic); if (bp) normalizedRow.birthPlace = bp; }
          if (!normalizedRow.dateOfBirth) { const dob = getDateOfBirthFromIC(ic); if (dob) normalizedRow.dateOfBirth = dob; }
          if (!normalizedRow.gender) { const gender = getGenderFromIC(ic); if (gender) normalizedRow.gender = gender; }
        }
      }

      return { row: normalizedRow, originalIndex: index };
    });

    // Process rows using Firestore WriteBatch (max 499 ops per batch).
    // NOTE: This bypasses service-layer side effects (e.g. point initialization).
    // For complex entities, callers should use the service methods directly after bulk import.
    const FIRESTORE_BATCH_LIMIT = 499;
    let currentBatch = writeBatch(db);
    let opsInCurrentBatch = 0;
    let committedBatches = 0;

    const getCollectionName = (et: string): string => {
      if (et === 'members') return COLLECTIONS.MEMBERS;
      if (et === 'events') return COLLECTIONS.EVENTS;
      return et;
    };

    const flushBatch = async () => {
      if (opsInCurrentBatch > 0) {
        await currentBatch.commit();
        committedBatches++;
        currentBatch = writeBatch(db);
        opsInCurrentBatch = 0;
      }
    };

    for (const { row: normalizedRow, originalIndex } of normalizedRows) {
      try {
        // Fix 12 (P1): pass member rows through normalizeMemberData so nested
        // schema fields (general, contact, business, jciCareer) are populated.
        if (entityType === 'members' || entityType === COLLECTIONS.MEMBERS) {
          const memberNormalized = MembersService.normalizeMemberData(normalizedRow);
          Object.assign(normalizedRow, memberNormalized);
        }

        const existingId = await this.checkIfRecordExists(normalizedRow, entityType, existingMemberEmailToId);
        const colName = getCollectionName(entityType);
        if (existingId) {
          // Fix 14 (P1): stamp updatedAt on every imported update
          normalizedRow.updatedAt = Timestamp.now();
          currentBatch.update(doc(db, colName, existingId), normalizedRow);
          summary.updated++;
        } else {
          // Fix 14 (P1): stamp createdAt + updatedAt on every new imported document
          normalizedRow.createdAt = Timestamp.now();
          normalizedRow.updatedAt = Timestamp.now();
          const newDocRef = doc(collection(db, colName));
          currentBatch.set(newDocRef, normalizedRow);
          // P2 Fix: Write a memberEmails dedup slot atomically with each new member so that
          // bulk-imported members participate in the same email-uniqueness guarantee as
          // members created via MembersService.createMember().
          // TODO: wire up createRecord/updateRecord — bulk-imported members skip memberEmails dedup slots
          if ((entityType === 'members' || entityType === COLLECTIONS.MEMBERS) && normalizedRow.email) {
            const sanitized = String(normalizedRow.email).toLowerCase().replace(/[^a-z0-9@.]/g, '_');
            // 'memberEmails' collection — no COLLECTIONS constant yet; add one when available
            currentBatch.set(doc(db, 'memberEmails', sanitized), {
              email: normalizedRow.email,
              memberId: newDocRef.id,
              createdAt: Timestamp.now(),
            });
          }
          summary.created++;
        }
        opsInCurrentBatch++;
        if (opsInCurrentBatch >= FIRESTORE_BATCH_LIMIT) {
          await flushBatch();
        }
      } catch (error) {
        summary.skipped++;
        const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error during persistence';
        errors.push({ row: originalIndex + 2, message: errorMessage, severity: 'error' });
      }
    }

    try {
      await flushBatch();
    } catch (batchError) {
      const batchErrorMessage = batchError instanceof Error ? batchError.message : 'Batch write failed';
      throw new Error(`导入中断：已成功提交 ${committedBatches} 批，最后批次失败：${batchErrorMessage}`);
    } finally {
      // P1 Fix: Invalidate cache in finally so it runs even when the final flushBatch throws.
      // Previously the invalidation was skipped on batch failure, leaving stale cache behind.
      if (entityType === 'members' || entityType === COLLECTIONS.MEMBERS) {
        await MembersService.invalidateMembersCache();
      }
    }

    const status = errors.length > 0 ? 'partial' : 'success';
    const successfulRows = summary.created + summary.updated;
    const failedRows = data.length - successfulRows;

    return {
      id: this.generateId(),
      filename,
      totalRows: data.length,
      successfulRows,
      failedRows,
      errors,
      warnings,
      status,
      importedAt: new Date(),
      importedBy: userId,
      duration: Date.now() - startTime,
      summary
    };
  }

  /**
   * Export data to CSV format
   */
  static async exportToCSV(
    entityType: string,
    fields: string[],
    filters: DataExportFilter[] = [],
    userId: string
  ): Promise<string> {
    // Get data based on entity type and filters
    const data = await this.fetchDataForExport(entityType, filters, userId);

    // Filter fields based on user permissions
    const allowedFields = this.filterFieldsByPermissions(fields, entityType, userId);

    // Select only requested fields
    const filteredData = data.map(record => {
      const filtered: any = {};
      allowedFields.forEach(field => {
        filtered[field] = record[field] || '';
      });
      return filtered;
    });

    // Convert to CSV
    const csv = Papa.unparse(filteredData, {
      header: true,
      skipEmptyLines: true
    });

    return csv;
  }

  /**
   * Export data to JSON (Story 6.1 â€“ ä¸»æ¡£å¯¼å‡ºçº¦å®šæ ¼å¼)
   */
  static async exportToJSON(
    entityType: string,
    fields: string[],
    filters: DataExportFilter[] = [],
    userId: string
  ): Promise<string> {
    const data = await this.fetchDataForExport(entityType, filters, userId);
    const allowedFields = this.filterFieldsByPermissions(fields, entityType, userId);
    const filteredData = data.map((record) => {
      const filtered: any = {};
      allowedFields.forEach((field) => {
        filtered[field] = record[field] ?? null;
      });
      return filtered;
    });
    return JSON.stringify(filteredData, null, 2);
  }

  /**
   * Export data to Excel format
   */
  static async exportToExcel(
    entityType: string,
    fields: string[],
    filters: DataExportFilter[] = [],
    userId: string
  ): Promise<ArrayBuffer> {
    // Get data based on entity type and filters
    const data = await this.fetchDataForExport(entityType, filters, userId);

    // Filter fields based on user permissions
    const allowedFields = this.filterFieldsByPermissions(fields, entityType, userId);

    // Select only requested fields
    const filteredData = data.map(record => {
      const filtered: any = {};
      allowedFields.forEach(field => {
        filtered[field] = record[field] || '';
      });
      return filtered;
    });

    // Create workbook
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(filteredData);

    // Auto-size columns
    const colWidths = allowedFields.map(field => ({
      wch: Math.max(field.length, 15)
    }));
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, entityType);

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    return buffer;
  }

  /**
   * Generate import template
   */
  static generateImportTemplate(entityType: string): ImportTemplate {
    const rules = this.validationRules[entityType] || [];
    const requiredFields = rules.filter(r => r.type === 'required').map(r => r.field);
    const allFields = this.getEntityFields(entityType);
    const optionalFields = allFields.filter(f => !requiredFields.includes(f));

    return {
      id: this.generateId(),
      name: `${entityType} Import Template`,
      entityType: entityType as any,
      requiredFields,
      optionalFields,
      validationRules: rules,
      fieldMappings: {},
      sampleData: this.generateSampleData(entityType),
      createdAt: new Date(),
      createdBy: 'system'
    };
  }

  // Private helper methods

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  private static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  private static async checkIfRecordExists(
    row: any,
    entityType: string,
    existingMemberEmailToId?: Map<string, string>
  ): Promise<string | null> {
    if (entityType === 'members' && row.email) {
      // Use the pre-fetched map when available (avoids one Firestore read per row)
      if (existingMemberEmailToId) {
        return existingMemberEmailToId.get(row.email.toLowerCase()) ?? null;
      }
      const member = await MembersService.getMemberByEmail(row.email);
      return member ? (member.id ?? null) : null;
    }

    // For other entities, we might need different logic
    if (row.id) return row.id;

    return null;
  }

  // TODO: wire up createRecord/updateRecord — bulk-imported members skip memberEmails dedup slots
  // when these methods are called directly; use the batch import path instead which now writes
  // the memberEmails slot atomically with the member document.
  private static async createRecord(row: any, entityType: string): Promise<void> {
    if (entityType === 'members') {
      await MembersService.createMember(row);
    } else if (entityType === 'events') {
      await EventsService.createEvent(row);
    }
    // Add other entities as needed
  }

  private static async updateRecord(id: string, row: any, entityType: string): Promise<void> {
    if (entityType === 'members') {
      await MembersService.updateMember(id, row);
    } else if (entityType === 'events') {
      // Assuming EventsService has updateEvent
      const { EventsService: ES } = await import('./eventsService');
      await ES.updateEvent(id, row);
    }
  }

  private static async fetchDataForExport(
    entityType: string,
    filters: DataExportFilter[],
    userId: string
  ): Promise<any[]> {
    const loIdFilter = filters.find((f) => f.field === 'loId' && f.operator === 'equals')?.value as string | undefined;

    if (entityType === 'members') {
      const list = await MembersService.getAllMembers(loIdFilter ?? undefined);
      return list.map((m) => ({ ...m })) as any[];
    }
    if (entityType === 'events') {
      const { EventsService: ES } = await import('./eventsService');
      const list = await ES.getAllEvents();
      return list.map((e) => ({ ...e })) as any[];
    }
    if (entityType === 'projects') {
      const { ProjectsService: PS } = await import('./projectsService');
      const list = await PS.getAllProjects();
      return list.map((p) => ({ ...p })) as any[];
    }
    if (entityType === 'transactions') {
      const { FinanceService: FS } = await import('./financeService');
      const list = await FS.getAllTransactions();
      return list.map((t) => ({ ...t })) as any[];
    }
    return [];
  }

  private static filterFieldsByPermissions(
    fields: string[],
    entityType: string,
    userId: string
  ): string[] {
    // TODO: move to server-side Netlify Function for enforcement.
    // This client-side guard is UX convenience only — a determined caller can bypass it.
    // eslint-disable-next-line no-console
    console.warn('[SECURITY] Client-side field filtering is UX-only; enforce in server');
    const restrictedFields = ['password', 'ssn', 'bankAccount'];
    // Sensitive member fields: only ADMIN+ should export these
    // We check if the current user is the same as userId and rely on server-side role enforcement.
    // For a belt-and-suspenders client-side guard, restrict sensitive fields unless the caller is
    // authenticated as the same user performing the export (full role check requires async claims).
    const sensitiveMemberFields = ['idNumber', 'contactInfo.phone', 'contactInfo.address', 'emergencyContact',
      'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship'];
    const currentUid = auth.currentUser?.uid;
    // If the current authenticated user is not recognised or is exporting someone else's data,
    // apply the sensitive field restriction as a conservative default.
    // TODO: Make this method async to read ID token claims and perform full ADMIN role check.
    // Fix 11 (P2): isAdminContext was incorrectly set to true when exporting one's own data,
    // allowing self-export to bypass sensitive field restrictions. Admin context must be based
    // on role (not self-export match). Defaulting to false (most restrictive) here;
    // full role enforcement must happen server-side.
    // TODO: Pass caller role from service layer for proper client-side enforcement.
    const isAdminContext = false;
    const allRestricted = isAdminContext
      ? restrictedFields
      : [...restrictedFields, ...sensitiveMemberFields];
    return fields.filter(field => !allRestricted.some(r => field === r || field.startsWith(r + '.')));
  }

  private static getEntityFields(entityType: string): string[] {
    const fieldMappings: Record<string, string[]> = {
      members: [
        'id', 'loId',
        // Basic Info
        'name', 'fullName', 'idNumber', 'email', 'dateOfBirth', 'gender', 'ethnicity', 'nationality', 'role', 'status', 'tier', 'points', 'joinDate', 'introducer', 'membershipType', 'duesYear', 'duesPaidDate', 'senatorCertified', 'bio', 'avatar',
        // 2. Professional & Business Information
        'companyName', 'companyWebsite', 'companyDescription', 'departmentAndPosition', 'industry', 'businessCategory', 'interestedIndustries', 'acceptInternationalBusiness', 'specialOffer', 'companyLogoUrl',
        // 3. Contact Information (Personal & Emergency)
        'phone', 'alternatePhone', 'whatsappGroup', 'address', 'linkedin', 'facebook', 'instagram', 'wechat', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship',
        // 4. Apparel & Items
        'cutStyle', 'tshirtSize', 'jacketSize', 'embroideredName', 'tshirtStatus',
        // 5. Skills & Hobbies
        'skills', 'hobbies', 'churnRisk', 'attendanceRate', 'duesStatus'
      ],
      events: ['id', 'title', 'description', 'date', 'time', 'location', 'type', 'capacity', 'registrationRequired'],
      projects: ['id', 'name', 'description', 'startDate', 'endDate', 'status', 'budget', 'leaderId', 'category'],
      transactions: ['id', 'amount', 'description', 'purpose', 'date', 'type', 'category', 'memberId', 'projectId']
    };
    return fieldMappings[entityType] || [];
  }

  private static generateSampleData(entityType: string, count: number = 3): any[] {
    const sampleMappings: Record<string, any[]> = {
      members: [
        {
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone: '+1234567890',
          role: 'MEMBER',
          membershipType: 'Official',
          status: 'Active',
          gender: 'Male',
          industry: 'Technology',
          companyName: 'Tech Corp',
          tshirtSize: 'L'
        },
        {
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          phone: '+1234567891',
          role: 'BOARD',
          membershipType: 'Probation',
          status: 'Active',
          gender: 'Female',
          industry: 'Consulting',
          companyName: 'Smith Consulting',
          tshirtSize: 'M'
        },
      ],
      events: [
        { title: 'Monthly Meeting', date: '2024-01-15', type: 'Meeting', capacity: 50 },
        { title: 'Leadership Training', date: '2024-01-20', type: 'Training', capacity: 25 },
        { title: 'Community Service', date: '2024-01-25', type: 'Project', capacity: 30 }
      ],
      projects: [
        { name: 'Food Drive', startDate: '2024-01-01', status: 'Active', budget: 5000 },
        { name: 'Youth Mentorship', startDate: '2024-02-01', status: 'Planning', budget: 3000 },
        { name: 'Environmental Cleanup', startDate: '2024-03-01', status: 'Completed', budget: 2000 }
      ]
    };

    const samples = sampleMappings[entityType] || [];
    return samples.slice(0, count);
  }

  private static generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
