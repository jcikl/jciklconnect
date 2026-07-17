export interface InventoryItem {
  id: string;
  name: string;
  category: 'Electronics' | 'Furniture' | 'Merchandise' | 'Stationery' | 'Equipment' | 'Supplies' | 'Other';
  quantity: number;
  location: string;
  status: 'Available' | 'Low Stock' | 'Out of Stock' | 'Checked Out';
  lastAudit?: string;
  custodian?: string;
  condition?: string;
  description?: string;
  lastCheckedOut?: string;
  expectedReturnDate?: string;
  checkedOutTo?: string;
  checkedOutDate?: string;
  returnedDate?: string;
  minQuantity?: number;
  lastCheckedAt?: string;
  lastTransactionId?: string;
  lastTransactionDate?: string;
  lastSaleDate?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  depreciationMethod?: 'Straight Line' | 'Declining Balance' | 'Units of Production' | 'None';
  depreciationRate?: number;
  currentValue?: number;
  usefulLife?: number;
  lastDepreciationUpdate?: string;
  variants?: { size: string; quantity: number; sku?: string }[];
}

export interface MaintenanceSchedule {
  id?: string;
  itemId: string;
  type: 'Preventive' | 'Corrective' | 'Inspection' | 'Calibration';
  frequency?: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual' | 'Custom';
  customDays?: number;
  lastMaintained?: string;
  nextMaintenanceDate?: string;
  scheduledDate?: string;
  assignedTo?: string;
  notes?: string;
  description?: string;
  status?: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  estimatedDuration?: number;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  createdAt?: string;
  completedDate?: string;
  active?: boolean;
}

export interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  date: string;
  type: 'In' | 'Out' | 'Adjustment';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  variant?: string;
  reason: string;
  referenceId?: string;
  performedBy: string;
}

export interface InventoryAlert {
  id?: string;
  itemId: string;
  type: 'Low Stock' | 'Overdue Return' | 'Maintenance Due' | 'Maintenance Overdue' | 'Out of Stock';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  message: string;
  createdAt: string;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface Notification {
  id: string;
  memberId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'ai' | 'dues_reminder' | 'event_reminder' | 'payment_request_cancelled' | 'payment_request_submitted' | 'payment_request_updated' | 'event_registration_cancelled';
  read: boolean;
  timestamp: string;
  readAt?: string;
  isDismissible?: boolean;
}

export interface ClubActivity {
  id: string;
  date: string;
  description: string;
}

export interface HobbyClub {
  id: string;
  name: string;
  category?: string;
  membersCount: number;
  nextActivity?: string;
  activities?: ClubActivity[];
  lead: string;
  image: string;
  memberIds?: string[];
  description?: string;
  whatsappUrl?: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  type: 'JCI Official' | 'Local Skill' | 'Leadership';
  duration: string;
  completionStatus: 'Not Started' | 'In Progress' | 'Completed';
  pointsReward: number;
  image: string;
}

export interface Document {
  id: string;
  name: string;
  description?: string;
  type: 'PDF' | 'DOC' | 'XLS' | 'IMG';
  category: 'Policy' | 'Meeting Minutes' | 'Project Report' | 'Template';
  uploadedDate: string;
  size: string;
}

export interface NewsPost {
  id: string;
  author: { name: string; avatar: string; role: string };
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  type: 'Announcement' | 'Update' | 'Poll';
  image?: string;
}

export interface DataImportError {
  row: number;
  field?: string;
  message: string;
  value?: any;
  severity: 'error' | 'warning';
}

export interface DataImportWarning {
  row: number;
  field?: string;
  message: string;
  value?: any;
}

export interface DataImportSummary {
  created: number;
  updated: number;
  skipped: number;
  duplicates: number;
  invalidRecords: number;
}

export interface DataImportResult {
  id: string;
  filename: string;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: DataImportError[];
  warnings: DataImportWarning[];
  status: 'success' | 'partial' | 'failed';
  importedAt: Date;
  importedBy: string;
  duration: number;
  summary: DataImportSummary;
}

export interface DataExportFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  value: any;
  values?: any[];
}

export interface DataExportRequest {
  id: string;
  entityType: 'members' | 'events' | 'projects' | 'transactions' | 'all';
  format: 'csv' | 'excel';
  fields: string[];
  filters?: DataExportFilter[];
  requestedBy: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: Date;
}

export interface DataValidationRule {
  field: string;
  type: 'required' | 'email' | 'phone' | 'date' | 'number' | 'enum' | 'unique' | 'length' | 'pattern';
  config?: {
    min?: number;
    max?: number;
    pattern?: string;
    values?: string[];
    message?: string;
  };
}

export interface ImportTemplate {
  id: string;
  name: string;
  entityType: 'members' | 'events' | 'projects' | 'transactions';
  requiredFields: string[];
  optionalFields: string[];
  validationRules: DataValidationRule[];
  fieldMappings: Record<string, string>;
  sampleData?: Record<string, any>[];
  createdAt: Date;
  createdBy: string;
}

export interface DataOperation {
  id: string;
  type: 'import' | 'export';
  entityType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  filename?: string;
  fileSize?: number;
  recordCount?: number;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  performedBy: string;
  result?: DataImportResult | DataExportRequest;
  error?: string;
}

export interface PartnershipPeriod {
  startDate: string;
  endDate: string;
}

export interface Partnership {
  id?: string;
  name: string;
  period: PartnershipPeriod;
  redeemMethod: string;
  memberBenefits: string;
  logo?: string;
  banner: string;
  eligibleRoles: string[];
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}
