import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { AlertCircle, CheckCircle, Download, Upload, FileSpreadsheet, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Modal, Button, useToast } from '../../ui/Common';
import { Input } from '../../ui/Form';
import { BatchImportConfig, ImportRow, ColumnMapping, ImportContext } from './batchImportTypes';
import { autoMapColumns, validateColumnMapping } from './stringMatching';
import { validateField } from './validators';
import { preprocessRow } from './batchImportUtils';
import Papa from 'papaparse';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: BatchImportConfig;
  onImported: () => void;
  context?: ImportContext;
  children?: React.ReactNode;
}

export const BatchImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  config,
  onImported,
  context,
  children,
}) => {
  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [pastedText, setPastedText] = useState('');
  // importMode removed - always use paste/TSV flow
  // const [importMode, setImportMode] = useState<'paste' | 'upload'>('paste');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [showMapping, setShowMapping] = useState(false);
  const [autoMatchInfo, setAutoMatchInfo] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [tablePreviewType, setTablePreviewType] = useState<'summary' | 'valid' | 'invalid'>('summary');
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  // Initialize field key to column index mapping
  useEffect(() => {
    if (config.autoMapColumns === false && config.columnMapping) {
      // Use hardcoded mapping
      setColumnMapping(config.columnMapping);
      setShowMapping(false);
    }
  }, [config]);

  // Handle file upload - Convert CSV/TSV to TSV format for unified processing
  const handleFileUpload = useCallback((file: File) => {
    const isCSV = file.name.endsWith('.csv');
    const isTSV = file.name.endsWith('.tsv') || file.type === 'text/tab-separated-values';

    if (!isCSV && !isTSV) {
      showToast('Please upload a CSV or TSV file', 'error');
      return;
    }

    // fill pastedText directly from uploaded CSV/TSV

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          showToast(`Parsing errors: ${results.errors.map(e => e.message).join(', ')}`, 'error');
          return;
        }

        const rows = results.data as string[][];
        if (rows.length === 0) {
          showToast('File is empty', 'error');
          return;
        }

        // Convert rows to TSV format
        const tsvData = rows.map(row => row.join('\t')).join('\n');

        // Set pasted text with TSV data
        setPastedText(tsvData);
        // no upload state kept; pastedText is authoritative

        showToast('CSV imported. Paste TSV data is ready.', 'success');
      },
      error: (error) => {
        showToast(`Failed to parse file: ${error.message}`, 'error');
      },
    });
  }, [showToast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = useCallback(() => {
    let content = '';

    if (config.sampleData && config.sampleData.length > 0) {
      // Use provided sample data
      content = config.sampleData.map(row => row.join(',')).join('\n');
    } else {
      // Generate headers from fields
      const headers = config.fields.map(f => f.label);
      content = headers.join(',');
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', config.sampleFileName || `${config.name.replace(/\s+/g, '_')}_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Template download started', 'success');
  }, [config, showToast]);

  // Parse CSV rows - Not used anymore as CSV is converted to TSV
  // CSV parsed rows removed — CSV is converted to TSV and placed into `pastedText`

  // Parse TSV rows
  const parsedTsvRows = useMemo(() => {
    if (!pastedText.trim()) return [];

    const lines = pastedText.trim().split('\n').filter(line => line.trim());
    return lines.map((line, idx) => {
      const columns = line.split('\t');
      const errors: string[] = [];
      const parsed: Partial<any> = {};

      for (const field of config.fields) {
        const columnIndex = columnMapping[field.key];
        const rawValue = columns[columnIndex]?.trim() || '';

        // Preprocess
        let processedValue = rawValue;
        if (field.preprocessor && rawValue) {
          try {
            processedValue = field.preprocessor(rawValue);
          } catch (err) {
            processedValue = rawValue;
          }
        }
        parsed[field.key] = (processedValue !== undefined && processedValue !== null && processedValue !== '')
          ? processedValue
          : (field.defaultValue !== undefined ? field.defaultValue : '');

        // Validate
        const valueToValidate = (processedValue !== undefined && processedValue !== null && processedValue !== '')
          ? processedValue
          : (field.defaultValue !== undefined ? field.defaultValue : '');

        if (valueToValidate !== '' || field.required) {
          const fieldErrors = validateField(valueToValidate, field.validators, { ...context, row: parsed });
          errors.push(...fieldErrors);
        }
      }

      let rowObj: ImportRow = {
        index: idx,
        raw: line,
        parsed,
        errors,
        valid: errors.length === 0 && !config.fields.some(f => f.required && !parsed[f.key]),
      };

      if (config.rowPostProcessor) {
        rowObj = config.rowPostProcessor(rowObj, context);
      }

      return rowObj;
    });
  }, [pastedText, columnMapping, config, context]);

  const parsedRows = parsedTsvRows;
  const validRows = useMemo(() => parsedRows.filter(r => r.valid), [parsedRows]);
  const invalidRows = useMemo(() => parsedRows.filter(r => !r.valid), [parsedRows]);

  const tableDisplayRows = useMemo(() => {
    if (tablePreviewType === 'valid') return validRows;
    if (tablePreviewType === 'invalid') return invalidRows;
    return parsedRows;
  }, [parsedRows, validRows, invalidRows, tablePreviewType]);

  const handleToggleSelectRow = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedRows);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === tableDisplayRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(tableDisplayRows.map(r => r.index)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedRows.size === 0) return;

    const lines = pastedText.split('\n');
    const newLines = lines.filter((_, idx) => !selectedRows.has(idx));
    setPastedText(newLines.join('\n'));
    setSelectedRows(new Set());
    showToast(`Deleted ${selectedRows.size} row(s)`, 'success');
  };

  const handleImport = async () => {
    if (validRows.length === 0) {
      showToast('No valid rows to import', 'error');
      return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: validRows.length });
    let successCount = 0;
    let failureCount = 0;

    try {
      if (config.batchImporter) {
        await config.batchImporter(
          validRows.map(r => r.parsed),
          context,
          (current, total) => setImportProgress({ current, total })
        );
        successCount = validRows.length;
      } else {
        // Process in chunks of 10 for better performance and stability
        const CHUNK_SIZE = 10;
        const results: { success: boolean }[] = [];

        for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
          const chunk = validRows.slice(i, i + CHUNK_SIZE);
          const chunkResults = await Promise.all(
            chunk.map(async (row) => {
              try {
                await config.importer(row.parsed, context);
                return { success: true };
              } catch (err) {
                console.error(`Failed to import row ${row.index}:`, err);
                return { success: false };
              }
            })
          );
          results.push(...chunkResults);
          setImportProgress(prev => prev ? { ...prev, current: Math.min(prev.current + chunk.length, prev.total) } : null);
        }

        successCount = results.filter(r => r.success).length;
        failureCount = results.filter(r => !r.success).length;
      }

      showToast(
        `Import completed: ${successCount} success${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        failureCount === 0 ? 'success' : 'warning'
      );

      // Reset form
      setPastedText('');
      setShowMapping(false);
      setImportProgress(null);
      onImported();
      onClose();
    } catch (err) {
      showToast('Import failed', 'error');
      setImportProgress(null);
    } finally {
      setImporting(false);
    }
  };

  const handleToggleError = (rowIndex: number) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(rowIndex)) {
      newExpanded.delete(rowIndex);
    } else {
      newExpanded.add(rowIndex);
    }
    setExpandedErrors(newExpanded);
  };

  const handleRowClick = (rowIndex: number) => {
    setSelectedRowIndex(rowIndex);

    if (!textareaRef.current) return;

    const lines = pastedText.split('\n');
    let charPosition = 0;

    for (let i = 0; i < rowIndex && i < lines.length; i++) {
      charPosition += lines[i].length + 1;
    }

    const lineLength = lines[rowIndex]?.length || 0;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(charPosition, charPosition + lineLength);
    textareaRef.current.scrollTop = rowIndex * 20;
  };

  const handleTextChange = (text: string) => {
    const cleanedText = text.replace(/"/g, '');
    setPastedText(cleanedText);

    // Auto-detect headers from first line if needed
    if (config.autoMapColumns && cleanedText.trim()) {
      const lines = cleanedText.trim().split('\n');
      if (lines.length > 0) {
        const headers = lines[0].split('\t');
        const threshold = config.autoMatchThreshold || 0.85;
        const result = autoMapColumns(headers, config.fields, threshold);

        // Merge with existing mapping instead of overwriting entirely
        // This ensures un-matched fields retain their default positions (index-based)
        if (Object.keys(result.columnMapping).length > 0) {
          setColumnMapping(prev => ({ ...prev, ...result.columnMapping }));
        }

        if (result.allRequired) {
          setAutoMatchInfo(`✅ All ${headers.length} columns matched automatically`);
          setShowMapping(false);
        } else {
          const unmatchedCount = result.unmatchedRequired.length;
          setAutoMatchInfo(
            `⚠️ ${unmatchedCount} column(s) need manual adjustment`
          );
          setShowMapping(false);
        }
      }
    }
  };

  const handleClearFile = () => {
    // Clear pasted text and file input value
    setPastedText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Initialize column mapping if not already set
  useEffect(() => {
    if (Object.keys(columnMapping).length === 0 && config.fields.length > 0) {
      if (config.autoMapColumns === false && config.columnMapping) {
        setColumnMapping(config.columnMapping);
      } else {
        // Default: field key = column index in alphabetical order
        const defaultMapping: ColumnMapping = {};
        config.fields.forEach((field, idx) => {
          defaultMapping[field.key] = idx;
        });
        setColumnMapping(defaultMapping);
      }
    }
  }, [config, columnMapping]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Batch Import: ${config.name}`}
      size="2xl"
      scrollInBody={false}
      bottomSheet
      drawerOnMobile
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={importing} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={validRows.length === 0 || importing}
            isLoading={importing}
            className="flex-1"
          >
            {importing ? 'Importing...' : `Import ${validRows.length} ${config.name.toLowerCase()}`}
          </Button>
        </div>
      }
    >
      {/* Hidden file input - Always present so Upload button works */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto relative">
        {importProgress && (
          <div className="absolute inset-0 z-[100] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-64 h-3 bg-slate-100 rounded-full overflow-hidden mb-4 border border-slate-200">
              <div
                className="h-full bg-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
            <div className="text-xl font-bold text-slate-900 mb-1">
              Importing Data...
            </div>
            <div className="text-slate-500 font-medium">
              Processed {importProgress.current} of {importProgress.total} rows
            </div>
          </div>
        )}

        {children}

        {/* Header */}
        <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100 uppercase tracking-tight">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-blue-600" size={20} />
            <span className="text-sm font-medium text-blue-900">
              Import {config.name} from {config.supportCsv && config.supportTsv ? 'CSV/TSV' : config.supportCsv ? 'CSV' : 'TSV'}
            </span>
          </div>
          {config.supportCsv && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
              >
                <Download size={14} />
                Download Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={triggerFileUpload}
                className="flex items-center gap-1"
              >
                <Upload size={14} />
                Upload CSV
              </Button>
            </div>
          )}
        </div>

        {/* Data Input Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">
              Paste TSV Data
            </label>
            {config.columnMappingEditable && (
              <button
                type="button"
                onClick={() => setShowMapping(!showMapping)}
                className="text-xs text-blue-600 hover:underline"
              >
                {showMapping ? 'Hide' : 'Show'} Column Mapping
              </button>
            )}
          </div>

          <div className="border border-slate-200 rounded overflow-x-auto bg-white">
            <textarea
              ref={textareaRef}
              value={pastedText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={`Paste TSV data (${config.fields.length} columns: ${config.fields.map(f => f.label).join(', ')})`}
              className="w-full h-32 p-2 text-xs font-mono bg-white focus:outline-none resize-none"
              style={{ whiteSpace: 'pre', overflowWrap: 'normal' }}
            />
          </div>
          <p className="text-xs text-slate-500">
            Tab-separated values • Required: {config.fields.filter(f => f.required).map(f => f.label).join(', ')} • Quotes will be auto-removed
          </p>

          {autoMatchInfo && (
            <div className={`p-3 rounded-lg border ${autoMatchInfo.startsWith('✅')
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-yellow-50 border-yellow-200 text-yellow-700'
              }`}>
              <p className="text-sm">{autoMatchInfo}</p>
            </div>
          )}
        </div>

        {/* Column Mapping (Optional) */}
        {showMapping && config.columnMappingEditable && (
          <div className="bg-slate-50 p-3 rounded-lg space-y-3 border border-slate-200 max-h-48 overflow-y-auto">
            <p className="text-xs font-semibold text-slate-700">
              Column Positions (0-indexed)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {config.fields.map(field => (
                <Input
                  key={field.key}
                  type="number"
                  label={field.label}
                  min={0}
                  value={String(columnMapping[field.key] ?? '')}
                  onChange={(e) =>
                    setColumnMapping(prev => ({
                      ...prev,
                      [field.key]: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="text-xs"
                />
              ))}
            </div>
          </div>
        )}

        {/* Table Preview */}
        {parsedRows.length > 0 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 bg-slate-50 px-2 pt-2">
              <button
                type="button"
                onClick={() => setTablePreviewType('summary')}
                className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition ${tablePreviewType === 'summary'
                  ? 'border-blue-500 text-blue-600 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
              >
                All ({parsedRows.length})
              </button>
              <button
                type="button"
                onClick={() => setTablePreviewType('valid')}
                className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition ${tablePreviewType === 'valid'
                  ? 'border-green-500 text-green-600 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
              >
                Valid ({validRows.length})
              </button>
              <button
                type="button"
                onClick={() => setTablePreviewType('invalid')}
                className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition ${tablePreviewType === 'invalid'
                  ? 'border-red-500 text-red-600 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
              >
                Errors ({invalidRows.length})
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full min-w-max text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap w-8">
                      <input
                        type="checkbox"
                        checked={tableDisplayRows.length > 0 && selectedRows.size === tableDisplayRows.length}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-2 py-1.5 text-left font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap w-8 text-center">
                      #
                    </th>
                    {config.tableColumns.map(col => {
                      const fieldDef = config.fields.find(f => f.key === col.key);
                      const isRequired = fieldDef?.required === true;
                      return (
                        <th
                          key={col.key}
                          className="px-2 py-1.5 text-left font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap"
                          style={{ width: col.width ? `${col.width}px` : 'auto' }}
                        >
                          {col.label}
                          {isRequired && <span className="text-red-500 ml-0.5">*</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {tableDisplayRows.map(row => (
                    <React.Fragment key={row.index}>
                      <tr
                        onClick={() => handleRowClick(row.index)}
                        className={`border-b border-slate-200 cursor-pointer transition-colors ${row.valid ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'
                          } ${selectedRowIndex === row.index ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
                      >
                        <td className="px-2 py-1 border-r border-slate-200 w-8 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedRows.has(row.index)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedRows);
                              if (e.target.checked) newSelected.add(row.index);
                              else newSelected.delete(row.index);
                              setSelectedRows(newSelected);
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-1 text-slate-600 border-r border-slate-200 w-8 text-center">
                          {row.index + 1}
                        </td>
                        {config.tableColumns.map(col => (
                          <td
                            key={col.key}
                            className="px-2 py-1 text-slate-700 border-r border-slate-200 truncate"
                            title={String(row.parsed[col.key] || '—')}
                          >
                            {col.key === 'valid' ? (
                              row.valid ? (
                                row.isUpdate ? (
                                  <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                                    <CheckCircle size={12} />
                                    Updated
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                                    <CheckCircle size={12} />
                                    Valid
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                  <AlertCircle size={12} />
                                  Error
                                </span>
                              )
                            ) : (
                              (() => {
                                const val = row.parsed[col.key];
                                if (val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
                                  return '—';
                                }
                                if (val === 0 || val === '0') return '0';
                                return String(val || '—');
                              })()
                            )}
                          </td>
                        ))}
                      </tr>
                      {!row.valid && row.errors.length > 0 && (
                        <tr className="bg-red-100 border-b border-slate-200">
                          <td colSpan={config.tableColumns.length + 2} className="px-2 py-1">
                            <button
                              type="button"
                              onClick={() => handleToggleError(row.index)}
                              className="w-full text-left flex items-center gap-1 text-xs text-red-700 hover:text-red-900"
                            >
                              {expandedErrors.has(row.index) ? (
                                <ChevronUp size={12} />
                              ) : (
                                <ChevronDown size={12} />
                              )}
                              <span className="font-semibold">Errors:</span>
                              {expandedErrors.has(row.index) ? (
                                <span className="block mt-1">{row.errors.join('; ')}</span>
                              ) : (
                                <span>{row.errors.length} error(s)</span>
                              )}
                            </button>
                            {expandedErrors.has(row.index) && (
                              <div className="mt-1 ml-4 space-y-1">
                                {row.errors.map((error, idx) => (
                                  <p key={idx} className="text-xs text-red-700">• {error}</p>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="bg-slate-50 px-2 py-1.5 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-600">
                Showing {tableDisplayRows.length} row{tableDisplayRows.length !== 1 ? 's' : ''}
                {tablePreviewType === 'summary' && invalidRows.length > 0 && ` • ${invalidRows.length} error(s)`}
                {selectedRows.size > 0 && ` • ${selectedRows.size} selected`}
              </div>
              {selectedRows.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteSelected}
                  className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  Delete Selected
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Statistics */}
        {parsedRows.length > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-blue-50 p-2 rounded border border-blue-200">
              <div className="font-semibold text-blue-900">{parsedRows.length}</div>
              <div className="text-blue-700">Total rows</div>
            </div>
            <div className="bg-green-50 p-2 rounded border border-green-200">
              <div className="font-semibold text-green-900">{validRows.length}</div>
              <div className="text-green-700">Valid</div>
            </div>
            <div className="bg-red-50 p-2 rounded border border-red-200">
              <div className="font-semibold text-red-900">{invalidRows.length}</div>
              <div className="text-red-700">Errors</div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BatchImportModal;
