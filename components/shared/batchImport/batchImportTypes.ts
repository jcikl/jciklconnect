/**
 * Batch Import Shared Type Definitions
 * Used by both Finance and Members modules
 */

export interface FieldDefinition {
  /** 字段键名 */
  key: string;
  /** 显示标签 */
  label: string;
  /** 是否必需 */
  required: boolean;
  /** 字段别名（用于自动列头匹配） */
  aliases?: string[];
  /** 验证函数列表 */
  validators?: ((value: any, context?: any) => string | null)[];
  /** 默认值 */
  defaultValue?: any;
  /** 预处理函数（格式化、清理等） */
  preprocessor?: (value: any) => any;
}

export interface TableColumnDefinition {
  /** 对应的字段键 */
  key: string;
  /** 列显示标签 */
  label: string;
  /** 列宽度 (像素) */
  width?: number;
}

export interface ColumnMapping {
  [fieldKey: string]: number; // 字段 => CSV/TSV 列索引
}

export interface DisplayColumnMapping {
  [fieldKey: string]: number; // 字段 => 显示顺序
}

export interface AutoMatchResult {
  /** 自动匹配的列映射 */
  columnMapping: ColumnMapping;
  /** 匹配结果详情 */
  matches: {
    [fieldKey: string]: {
      csvHeaderIndex: number;
      csvHeaderName: string;
      matchedAlias: string;
      similarity: number; // 0-1
      isAutoMatched: boolean;
    };
  };
  /** 是否所有必需字段都匹配了 */
  allRequired: boolean;
  /** 未匹配的必需字段 */
  unmatchedRequired: string[];
}

export interface ImportContext {
  user?: {
    id: string;
    [key: string]: any;
  } | null;
  [key: string]: any;
}

export interface BatchImportConfig {
  /** 导入类型名称 */
  name: string;
  /** 字段定义 */
  fields: FieldDefinition[];
  /** 表格显示列 */
  tableColumns: TableColumnDefinition[];
  /** 支持 CSV */
  supportCsv: boolean;
  /** 支持 TSV */
  supportTsv: boolean;
  /** 是否启用自动列头匹配 */
  autoMapColumns: boolean;
  /** 用户是否可以编辑列映射 */
  columnMappingEditable: boolean;
  /** 自动匹配的相似度阈值 (0-1) */
  autoMatchThreshold?: number;
  /** 列映射硬编码值（仅当 autoMapColumns=false 时使用） */
  columnMapping?: ColumnMapping;
  /** 模板下载文件名 */
  sampleFileName?: string;
  /** 示例数据 (第一行为列头) */
  sampleData?: string[][];
  /** 导入函数（处理单条数据） */
  importer: (row: Partial<any>, context?: ImportContext) => Promise<void>;
  /** 导入成功后的回调 */
  onSuccess?: () => void;
}

export interface ImportRow {
  /** 行索引 */
  index: number;
  /** 原始行数据 */
  raw: string | Record<string, any>;
  /** 解析后的数据 */
  parsed: Partial<any>;
  /** 验证错误列表 */
  errors: string[];
  /** 是否有效 */
  valid: boolean;
}

export interface BatchImportResult {
  successful: number;
  failed: number;
  totalProcessed: number;
  errors: {
    rowIndex: number;
    errors: string[];
  }[];
}
