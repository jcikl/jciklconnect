import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle, Download, Upload, FileSpreadsheet, ChevronDown, ChevronUp, Trash2, X, Globe } from 'lucide-react';
import { Modal, Button, useToast, ProgressBar } from '../../ui/Common';
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
  importBlockedReason?: string;
}

export const BatchImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  config,
  onImported,
  context,
  children,
  importBlockedReason,
}) => {
  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [pastedText, setPastedText] = useState('');
  // importMode removed - always use paste/TSV flow
  // const [importMode, setImportMode] = useState<'paste' | 'upload'>('paste');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [autoMatchInfo, setAutoMatchInfo] = useState<string | null>(null);
  const [headerRowDetected, setHeaderRowDetected] = useState(false);
  const [activeTab, setActiveTab] = useState<'paste' | 'preview'>('paste');
  const [numExtraCols, setNumExtraCols] = useState(0);
  const [importing, setImporting] = useState(false);
  const [tablePreviewType, setTablePreviewType] = useState<'summary' | 'valid' | 'invalid'>('summary');
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; errors: number; done: boolean } | null>(null);
  const [failedImportRows, setFailedImportRows] = useState<Set<number>>(new Set());
  const [loadingSource, setLoadingSource] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [loaderParams, setLoaderParams] = useState<Record<string, Record<string, string>>>(() => {
    const init: Record<string, Record<string, string>> = {};
    config.loaders?.forEach(loader => {
      if (loader.params) {
        init[loader.label] = {};
        loader.params.forEach(p => { init[loader.label][p.key] = p.default; });
      }
    });
    return init;
  });
  // Step-1 confirm panel state (pause between Step 1 and Steps 2+3)
  const [step1Confirm, setStep1Confirm] = useState<{
    info: { found: number; newCount: number; skipped: number; yearOptions: string[]; countByYear: Record<string, { found: number; newCount: number; skipped: number }> };
    resolve: (params: Record<string, string> | null) => void;
    loaderLabel: string;
    originalParams: Record<string, string>;
  } | null>(null);
  const [confirmParams, setConfirmParams] = useState<Record<string, string>>({});
  // Reactive counts that update immediately when year selector changes
  const [confirmCounts, setConfirmCounts] = useState<{ found: number; newCount: number; skipped: number } | null>(null);

  // Inline row editing (情景 LL)
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingRowValues, setEditingRowValues] = useState<Record<string, any>>({});
  const [manualOverrideRows, setManualOverrideRows] = useState<Record<number, ImportRow>>({});

  // Custom column-header dropdown
  const [openDropdownCol, setOpenDropdownCol] = useState<number | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const headerBtnRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const dropdownPanelRef = useRef<HTMLDivElement>(null);

  const openColDropdown = useCallback((colIdx: number) => {
    const btn = headerBtnRefs.current.get(colIdx);
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 200) });
    }
    setDropdownSearch('');
    setOpenDropdownCol(colIdx);
  }, []);

  useEffect(() => {
    if (openDropdownCol === null) return;
    const handleOutside = (e: MouseEvent) => {
      const btn = headerBtnRefs.current.get(openDropdownCol);
      if (
        dropdownPanelRef.current && !dropdownPanelRef.current.contains(e.target as Node) &&
        btn && !btn.contains(e.target as Node)
      ) {
        setOpenDropdownCol(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenDropdownCol(null); };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleOutside); document.removeEventListener('keydown', handleEsc); };
  }, [openDropdownCol]);

  // Initialize field key to column index mapping
  useEffect(() => {
    if (config.autoMapColumns === false && config.columnMapping) {
      // Use hardcoded mapping
      setColumnMapping(config.columnMapping);
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

        // Convert rows to TSV format (cells are already trimmed by PapaParse)
        const tsvData = rows.map(row => row.join('\t')).join('\n');

        // Route through handleTextChange so trimming/cleaning is consistent
        handleTextChange(tsvData);
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

    const allLines = pastedText.trim().split('\n').filter(line => line.trim());
    // Skip first line when it was auto-detected as a header row
    const lines = headerRowDetected ? allLines.slice(1) : allLines;
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

  // Merge manual overrides into parsedRows (情景 LL)
  const parsedRows = useMemo(() =>
    parsedTsvRows.map(r => manualOverrideRows[r.index] ?? r),
    [parsedTsvRows, manualOverrideRows]
  );
  const validRows = useMemo(() => parsedRows.filter(r => r.valid), [parsedRows]);
  const invalidRows = useMemo(() => parsedRows.filter(r => !r.valid), [parsedRows]);
  const warnRows = useMemo(() => parsedRows.filter(r => r.valid && r.warnings && r.warnings.length > 0), [parsedRows]);

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

  // Save inline-edited row: re-run preprocessors + validators + rowPostProcessor (情景 LL)
  const handleSaveEditedRow = useCallback((rowIndex: number) => {
    const parsed = { ...editingRowValues };
    const errors: string[] = [];
    for (const field of config.fields) {
      const rawVal = parsed[field.key];
      const processed = field.preprocessor ? field.preprocessor(rawVal) : rawVal;
      parsed[field.key] = processed;
      const valueToValidate = (processed !== undefined && processed !== null && processed !== '') ? processed : (field.defaultValue !== undefined ? field.defaultValue : '');
      if (valueToValidate !== '' || field.required) {
        const fieldErrors = validateField(valueToValidate, field.validators, { ...context, row: parsed });
        errors.push(...fieldErrors);
      }
    }
    let rowObj: ImportRow = {
      index: rowIndex,
      raw: editingRowValues,
      parsed,
      errors,
      valid: errors.length === 0 && !config.fields.some(f => f.required && !parsed[f.key]),
    };
    if (config.rowPostProcessor) {
      rowObj = config.rowPostProcessor(rowObj, context);
    }
    setManualOverrideRows(prev => ({ ...prev, [rowIndex]: rowObj }));
    setEditingRowIndex(null);
    setEditingRowValues({});
  }, [editingRowValues, config, context]);

  const handleDeleteSelected = () => {
    if (selectedRows.size === 0) return;

    const lines = pastedText.split('\n');
    const offset = headerRowDetected ? 1 : 0;
    const newLines = lines.filter((_, idx) => !selectedRows.has(idx - offset));
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
    setFailedImportRows(new Set());
    setImportProgress({ current: 0, total: validRows.length, errors: 0, done: false });
    let successCount = 0;
    let failureCount = 0;

    try {
      if (config.batchImporter) {
        await config.batchImporter(
          validRows.map(r => r.parsed),
          context,
          (current, total) => setImportProgress(prev => ({ ...(prev ?? { errors: 0, done: false }), current, total }))
        );
        successCount = validRows.length;
      } else {
        // Process in chunks of 10 for better performance and stability
        const CHUNK_SIZE = 10;
        const newFailedRows = new Set<number>();

        for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
          const chunk = validRows.slice(i, i + CHUNK_SIZE);
          const chunkResults = await Promise.all(
            chunk.map(async (row) => {
              try {
                await config.importer(row.parsed, context);
                return { success: true, rowIndex: row.index };
              } catch (err) {
                console.error(`Failed to import row ${row.index}:`, err);
                return { success: false, rowIndex: row.index };
              }
            })
          );
          chunkResults.forEach(r => { if (!r.success) newFailedRows.add(r.rowIndex); });
          const chunkErrors = chunkResults.filter(r => !r.success).length;
          setImportProgress(prev => prev
            ? { ...prev, current: Math.min(prev.current + chunk.length, prev.total), errors: prev.errors + chunkErrors }
            : null
          );
        }

        successCount = validRows.length - newFailedRows.size;
        failureCount = newFailedRows.size;
        setFailedImportRows(newFailedRows);
      }

      showToast(
        `Import completed: ${successCount} success${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        failureCount === 0 ? 'success' : 'warning'
      );

      setImportProgress(prev => prev ? { ...prev, done: true, errors: failureCount } : null);
      onImported();

      if (failureCount === 0) {
        // No failures — reset and close
        setPastedText('');
        setHeaderRowDetected(false);
        setAutoMatchInfo(null);
        setNumExtraCols(0);
        setImportProgress(null);
        onClose();
      } else {
        // Keep modal open so user can review failed rows in preview tab
        setActiveTab('preview');
      }
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
    const offset = headerRowDetected ? 1 : 0;
    const actualLineIndex = rowIndex + offset;
    let charPosition = 0;

    for (let i = 0; i < actualLineIndex && i < lines.length; i++) {
      charPosition += lines[i].length + 1;
    }

    const lineLength = lines[actualLineIndex]?.length || 0;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(charPosition, charPosition + lineLength);
    textareaRef.current.scrollTop = actualLineIndex * 20;
  };

  // Trim including non-breaking space (U+00A0), zero-width space (U+200B), BOM (U+FEFF)
  const cellTrim = (s: string) => s.replace(/^[\s ​﻿]+|[\s ​﻿]+$/g, '');

  const handleTextChange = (text: string) => {
    // Strip quotes, trim the whole block, then trim whitespace from each cell
    const cleanedText = text
      .replace(/"/g, '')
      .trim()
      .split('\n')
      .map(line => line.split('\t').map(cell => cellTrim(cell)).join('\t'))
      .join('\n');
    setPastedText(cleanedText);

    if (config.autoMapColumns && cleanedText.trim()) {
      const lines = cleanedText.trim().split('\n');
      if (lines.length > 0) {
        const firstLine = lines[0].split('\t');
        const threshold = config.autoMatchThreshold || 0.85;
        const result = autoMapColumns(firstLine, config.fields, threshold);

        // Heuristic: treat first row as header if ≥ half of matched columns
        // have high similarity (i.e., first line looks like column names, not data)
        const matchedCount = Object.keys(result.columnMapping).length;
        const looksLikeHeader = matchedCount >= Math.ceil(config.fields.filter(f => f.required).length);

        if (looksLikeHeader && Object.keys(result.columnMapping).length > 0) {
          setColumnMapping(prev => ({ ...prev, ...result.columnMapping }));
          setHeaderRowDetected(true);

          if (result.allRequired) {
            setAutoMatchInfo(`✅ Header row detected — ${matchedCount} column(s) matched`);
          } else {
            setAutoMatchInfo(`⚠️ Header detected — ${result.unmatchedRequired.length} required column(s) unmatched`);
          }
          // (mapping panel removed — header dropdowns handle this)
        } else {
          setHeaderRowDetected(false);
          setAutoMatchInfo(null);
        }
      }
    } else {
      setHeaderRowDetected(false);
      setAutoMatchInfo(null);
    }
  };

  const handleClearFile = () => {
    setPastedText('');
    setHeaderRowDetected(false);
    setAutoMatchInfo(null);
    setNumExtraCols(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ── Grid helpers ──────────────────────────────────────────────────────────

  // Reverse map: column index → field definition
  const colIndexToField = useMemo(() => {
    const map = new Map<number, (typeof config.fields)[0]>();
    Object.entries(columnMapping).forEach(([fieldKey, colIdx]) => {
      const field = config.fields.find(f => f.key === fieldKey);
      if (field) map.set(colIdx, field);
    });
    return map;
  }, [columnMapping, config.fields]);

  // Number of columns to show in the grid
  const numCols = useMemo(() => {
    const fromMapping = Object.values(columnMapping).length > 0
      ? Math.max(...Object.values(columnMapping)) + 1
      : 0;
    const fromData = pastedText.trim()
      ? Math.max(...pastedText.split('\n').map(l => l.split('\t').length), 0)
      : 0;
    // When empty, default to required fields + 2 optional slots
    const defaultCols = pastedText.trim() ? 0 : config.fields.filter(f => f.required).length + 2;
    return Math.max(fromMapping, fromData, defaultCols, 1) + numExtraCols;
  }, [columnMapping, pastedText, config.fields, numExtraCols]);

  // 2D array of cell strings derived from pastedText
  const gridRows = useMemo(() => {
    if (!pastedText.trim()) return Array.from({ length: 3 }, () => [] as string[]);
    return pastedText.split('\n').map(line => line.split('\t'));
  }, [pastedText]);

  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    const rows = pastedText.trim()
      ? pastedText.split('\n').map(l => l.split('\t'))
      : Array.from({ length: rowIdx + 1 }, () => [] as string[]);
    while (rows.length <= rowIdx) rows.push([]);
    while (rows[rowIdx].length <= colIdx) rows[rowIdx].push('');
    rows[rowIdx][colIdx] = value;
    handleTextChange(rows.map(r => r.join('\t')).join('\n'));
  };

  const handleDeleteRow = (rowIdx: number) => {
    if (!pastedText.trim()) return;
    const rows = pastedText.split('\n').filter((_, i) => i !== rowIdx);
    handleTextChange(rows.join('\n'));
  };

  const handleAddRow = useCallback(() => {
    const emptyRow = Array(numCols).fill('').join('\t');
    const newText = pastedText.trim() ? pastedText.trimEnd() + '\n' + emptyRow : emptyRow;
    setPastedText(newText);
  }, [numCols, pastedText]);

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const next = e.shiftKey ? colIdx - 1 : colIdx + 1;
      if (next >= 0 && next < numCols) {
        (document.querySelector(`[data-cell="${rowIdx}-${next}"]`) as HTMLInputElement)?.focus();
      } else if (!e.shiftKey) {
        const nr = rowIdx + 1;
        if (nr < gridRows.length) {
          (document.querySelector(`[data-cell="${nr}-0"]`) as HTMLInputElement)?.focus();
        } else {
          handleAddRow();
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const nr = rowIdx + 1;
      if (nr < gridRows.length) {
        (document.querySelector(`[data-cell="${nr}-${colIdx}"]`) as HTMLInputElement)?.focus();
      } else {
        handleAddRow();
      }
    }
  };

  const handleHeaderFieldChange = (colIdx: number, newFieldKey: string) => {
    setColumnMapping(prev => {
      const next = { ...prev };
      // Find what field was previously assigned to this column, remove it
      const prevFieldKey = Object.entries(next).find(([, v]) => v === colIdx)?.[0];
      if (prevFieldKey) delete next[prevFieldKey];
      if (!newFieldKey) return next; // unassign only
      // If newFieldKey is already used elsewhere, swap it to the old column
      if (next[newFieldKey] !== undefined) {
        if (prevFieldKey) next[prevFieldKey] = next[newFieldKey];
        delete next[newFieldKey];
      }
      next[newFieldKey] = colIdx;
      return next;
    });
  };

  const handleGridPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (text.includes('\n') || text.includes('\t')) {
      e.preventDefault();
      handleTextChange(text);
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

  // Auto-switch to Preview when rows appear; back to Paste when cleared
  useEffect(() => {
    if (parsedRows.length > 0) setActiveTab('preview');
    else setActiveTab('paste');
  }, [parsedRows.length]);

  const formatType = config.supportCsv && config.supportTsv ? 'CSV/TSV' : config.supportCsv ? 'CSV' : 'TSV';

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
        <div className="flex flex-col gap-2 w-full">
          {importBlockedReason && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium">
              <AlertCircle size={13} className="shrink-0" />
              {importBlockedReason}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={importing} className="flex-none px-5">
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!!importBlockedReason || validRows.length === 0 || importing}
              isLoading={importing}
              className="flex-1"
            >
              {importing
                ? 'Importing…'
                : validRows.length === 0
                  ? `Import ${config.name}`
                  : (
                    <span className="flex items-center justify-center gap-2">
                      Import
                      <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {validRows.length}
                      </span>
                      {config.name}
                    </span>
                  )
              }
            </Button>
          </div>
        </div>
      }
    >
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".csv,.tsv" onChange={handleFileChange} className="hidden" />

      {/* Import progress overlay */}
      {importProgress && (
        <div className="absolute inset-0 z-[100] bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 rounded-xl">
          {importProgress.done ? (
            /* ── Done summary ── */
            <div className="flex flex-col items-center gap-4 w-64 text-center">
              <div className="flex flex-col gap-2 w-full">
                <span className="flex items-center justify-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
                  <CheckCircle size={16} />
                  成功 {importProgress.total - importProgress.errors} 条
                </span>
                {importProgress.errors > 0 && (
                  <span className="flex items-center justify-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
                    <AlertCircle size={16} />
                    失败 {importProgress.errors} 条
                  </span>
                )}
              </div>
              {importProgress.errors > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  失败的行已在预览表格中以红色高亮显示
                </p>
              )}
              <Button
                variant="outline"
                onClick={() => setImportProgress(null)}
                className="mt-1 w-full"
              >
                关闭
              </Button>
            </div>
          ) : (
            /* ── In-progress ── */
            <div className="flex flex-col items-center gap-3 w-64">
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                正在导入 {importProgress.current}/{importProgress.total} 条…
              </p>
              <div className="w-full">
                <ProgressBar
                  progress={(importProgress.current / importProgress.total) * 100}
                  color="bg-blue-600"
                />
              </div>
              {importProgress.errors > 0 && (
                <p className="text-xs text-red-500 dark:text-red-400">
                  已失败 {importProgress.errors} 条
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {children}

      {/* ── Top tab bar ── */}
      <div className="flex items-center border-b border-slate-200 -mx-4 md:-mx-6 px-4 md:px-6 mb-4">
        {/* Tabs left */}
        <div className="flex flex-1 gap-0">
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === 'paste'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileSpreadsheet size={14} />
            Paste
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === 'preview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Preview
            {parsedRows.length > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                invalidRows.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}>
                {parsedRows.length}
              </span>
            )}
          </button>
        </div>
        {/* Actions right — always visible */}
        <div className="flex items-center gap-1.5 shrink-0">
          {config.loaders?.map((loader) => (
            <div key={loader.label} className="flex items-center gap-1">
              {loader.params?.filter(p => !p.confirmOnly).map(p => (
                <select
                  key={p.key}
                  value={loaderParams[loader.label]?.[p.key] ?? p.default}
                  onChange={e => setLoaderParams(prev => ({
                    ...prev,
                    [loader.label]: { ...prev[loader.label], [p.key]: e.target.value },
                  }))}
                  disabled={loadingSource !== null}
                  className="text-xs border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-50"
                >
                  {p.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ))}
              <button
                type="button"
                disabled={loadingSource !== null}
                onClick={async () => {
                  setLoadingSource(loader.label);
                  setLoadingMessage(null);
                  try {
                    const params = loaderParams[loader.label];
                    const waitForConfirm = (
                      info: { found: number; newCount: number; skipped: number; yearOptions: string[]; countByYear: Record<string, { found: number; newCount: number; skipped: number }> },
                      currentParams: Record<string, string>
                    ) => new Promise<Record<string, string> | null>(resolve => {
                      setConfirmParams({ ...currentParams });
                      setConfirmCounts(info.countByYear[currentParams.year ?? ''] ?? { found: info.found, newCount: info.newCount, skipped: info.skipped });
                      setStep1Confirm({ info, resolve, loaderLabel: loader.label, originalParams: { ...currentParams } });
                    });
                    const tsv = await loader.load((msg) => setLoadingMessage(msg), params, waitForConfirm);
                    handleTextChange(tsv);
                    setActiveTab('paste');
                    showToast(`Loaded from ${loader.label}`, 'success');
                  } catch (err: any) {
                    if (!err?.cancelled) showToast(`Failed to load: ${err.message}`, 'error');
                  } finally {
                    setLoadingSource(null);
                    setLoadingMessage(null);
                    setStep1Confirm(null);
                  }
                }}
                title={`Load data from ${loader.label}`}
                className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Globe size={13} className={loadingSource === loader.label ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">
                  {loadingSource === loader.label ? 'Loading…' : loader.label}
                </span>
              </button>
            </div>
          ))}
          {config.supportCsv && (
            <>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                title="Download template"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Template</span>
              </button>
              <button
                type="button"
                onClick={triggerFileUpload}
                title="Upload CSV file"
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-100 transition-colors"
              >
                <Upload size={13} />
                <span className="hidden sm:inline">Upload</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Loader progress banner / Step-1 confirm panel ── */}
      {loadingSource !== null && (
        step1Confirm !== null ? (() => {
          const loaderDef = config.loaders?.find(l => l.label === step1Confirm.loaderLabel);
          const counts = confirmCounts ?? { found: step1Confirm.info.found, newCount: step1Confirm.info.newCount, skipped: step1Confirm.info.skipped };
          return (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 space-y-3 text-sm">
              <div className="font-semibold text-blue-900">
                Step 1 完成 — 共找到 <strong>{counts.found}</strong> 个活动
                {counts.skipped > 0 && <span className="text-blue-700">，跳过 <strong>{counts.skipped}</strong> 个已存在</span>}
                ，将导入 <strong>{counts.newCount}</strong> 个新项目
              </div>
              {(loaderDef?.params ?? []).length > 0 && (
                <div className="flex flex-wrap gap-3 items-center text-xs">
                  <span className="text-blue-700 font-medium">调整参数：</span>
                  {(loaderDef?.params ?? []).map(p => {
                    const opts = p.key === 'year' && step1Confirm.info.yearOptions.length
                      ? step1Confirm.info.yearOptions
                      : p.options;
                    return (
                      <label key={p.key} className="flex items-center gap-1.5 text-blue-800">
                        {p.label}:
                        <select
                          value={confirmParams[p.key] ?? p.default}
                          onChange={e => {
                            const newVal = e.target.value;
                            setConfirmParams(prev => ({ ...prev, [p.key]: newVal }));
                            if (p.key === 'year' && step1Confirm.info.countByYear) {
                              setConfirmCounts(step1Confirm.info.countByYear[newVal] ?? { found: 0, newCount: 0, skipped: 0 });
                            }
                          }}
                          className="rounded border border-blue-300 text-xs px-2 py-0.5 bg-white text-slate-700"
                        >
                          {opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { step1Confirm.resolve(null); setStep1Confirm(null); }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => { const p = { ...confirmParams }; setStep1Confirm(null); step1Confirm.resolve(p); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                >
                  继续导入 Steps 2–3 →
                </button>
              </div>
            </div>
          );
        })() : (() => {
          // Parse "N/T · description [done/total]…" from onProgress messages
          const msg = loadingMessage ?? '';
          const stepMatch = msg.match(/^(\d+)\/(\d+)\s*·\s*(.+?)(?:\s+(\d+)\/(\d+))?…?$/);
          const stepCurrent = stepMatch ? parseInt(stepMatch[1]) : null;
          const stepTotal   = stepMatch ? parseInt(stepMatch[2]) : null;
          const desc        = stepMatch ? stepMatch[3] : (loadingMessage ?? `Loading from ${loadingSource}…`);
          const done        = stepMatch?.[4] != null ? parseInt(stepMatch[4]) : null;
          const total       = stepMatch?.[5] != null ? parseInt(stepMatch[5]) : null;
          const pct         = done != null && total != null && total > 0 ? Math.round((done / total) * 100) : null;

          return (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 space-y-1.5">
              <div className="flex items-center gap-2">
                <svg className="animate-spin shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <span className="flex-1 font-medium truncate">{desc}</span>
                {stepTotal != null && (
                  <span className="flex items-center gap-1 shrink-0">
                    {Array.from({ length: stepTotal }, (_, i) => (
                      <span
                        key={i}
                        className={`inline-block rounded-full ${i < (stepCurrent ?? 0) ? 'bg-emerald-500' : 'bg-emerald-200'}`}
                        style={{ width: 6, height: 6 }}
                      />
                    ))}
                    <span className="ml-1 text-emerald-600">{stepCurrent}/{stepTotal}</span>
                  </span>
                )}
              </div>
              {pct != null && (
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[10px] text-emerald-600">
                    <span>{done!.toLocaleString()} / {total!.toLocaleString()}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-emerald-200 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* ── Tab: Paste ── */}
      {activeTab === 'paste' && (
        <div className="flex flex-col gap-3">
          {/* Cell grid */}
          <div
            className="overflow-auto rounded-xl border border-slate-200 bg-white"
            style={{ maxHeight: '300px' }}
            onPaste={handleGridPaste}
          >
            <table className="min-w-max text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  {/* Row-number corner */}
                  <th className="w-7 bg-slate-50 border-r border-slate-200 select-none" />
                  {Array.from({ length: numCols }, (_, i) => {
                    const assignedField = colIndexToField.get(i);
                    const isRequired = assignedField?.required === true;
                    const isAssigned = !!assignedField;
                    const isOpen = openDropdownCol === i;

                    const headerBg = isRequired ? 'bg-blue-600' : isAssigned ? 'bg-slate-100' : 'bg-white';
                    const labelColor = isRequired ? 'text-white' : isAssigned ? 'text-slate-700' : 'text-slate-400';
                    const chevronColor = isRequired ? 'text-blue-200' : isAssigned ? 'text-slate-400' : 'text-slate-300';

                    return (
                      <th
                        key={i}
                        className={`p-0 border-r border-slate-200 ${headerBg} ${!isAssigned ? 'border-dashed' : ''}`}
                        style={{ minWidth: '140px' }}
                      >
                        <button
                          ref={el => { if (el) headerBtnRefs.current.set(i, el); else headerBtnRefs.current.delete(i); }}
                          type="button"
                          onClick={() => isOpen ? setOpenDropdownCol(null) : openColDropdown(i)}
                          className={`w-full flex items-center gap-1 pl-2 pr-1.5 py-2 text-[11px] font-semibold focus:outline-none focus:ring-1 focus:ring-inset ${
                            isRequired ? 'focus:ring-blue-300 hover:bg-blue-700' : 'focus:ring-blue-400 hover:bg-black/5'
                          } transition-colors ${labelColor}`}
                          title={assignedField ? `${assignedField.label}${isRequired ? ' (required)' : ''}` : 'Click to assign a field'}
                        >
                          <span className="flex-1 text-left truncate">
                            {assignedField
                              ? <>{assignedField.label}{isRequired && <span className={`ml-1 text-[9px] font-normal opacity-75`}>(required)</span>}</>
                              : '— Skip —'}
                          </span>
                          <ChevronDown size={11} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${chevronColor}`} />
                        </button>
                      </th>
                    );
                  })}
                  {/* Add column button */}
                  <th className="bg-white w-9 border-l border-dashed border-slate-200">
                    <button
                      type="button"
                      onClick={() => setNumExtraCols(n => n + 1)}
                      title="Add column"
                      className="w-full h-full py-2 text-slate-300 hover:text-blue-500 font-bold text-base transition-colors leading-none"
                    >
                      +
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {gridRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-slate-100 group">
                    <td className="px-2 py-0 text-center text-slate-300 border-r border-slate-100 font-mono text-[10px] select-none w-7">
                      {rowIdx + 1}
                    </td>
                    {Array.from({ length: numCols }, (_, colIdx) => {
                      const val = row[colIdx] ?? '';
                      const field = colIndexToField.get(colIdx);
                      const isEmpty = val === '' && field?.required;
                      return (
                        <td key={colIdx} className={`p-0 border-r border-slate-100 ${isEmpty ? 'bg-red-50/40' : ''}`}>
                          <input
                            type="text"
                            data-cell={`${rowIdx}-${colIdx}`}
                            value={val}
                            onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                            placeholder={!pastedText.trim() && field ? field.label : ''}
                            className="w-full min-w-[130px] px-2 py-1.5 bg-transparent focus:outline-none focus:bg-blue-50/50 text-slate-700 placeholder:text-slate-200"
                          />
                        </td>
                      );
                    })}
                    <td className="w-9 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(rowIdx)}
                        className="p-0.5 text-slate-300 hover:text-red-400 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={numCols + 2} className="px-3 py-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="text-xs text-slate-400 hover:text-blue-500 font-medium transition-colors"
                    >
                      + Add row
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Custom column-header dropdown — portal to body so table overflow doesn't clip it */}
          {openDropdownCol !== null && dropdownPos && createPortal(
            <div
              ref={dropdownPanelRef}
              className="fixed bg-white rounded-lg shadow-xl border border-slate-200 flex flex-col overflow-hidden"
              style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, maxHeight: 280, zIndex: 9999 }}
            >
              {/* Search */}
              <div className="px-2 pt-2 pb-1 border-b border-slate-100">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search fields…"
                  value={dropdownSearch}
                  onChange={e => setDropdownSearch(e.target.value)}
                  className="w-full px-2 py-1 text-[11px] rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-slate-50"
                />
              </div>
              <div className="overflow-y-auto flex-1">
                {/* Skip */}
                <button
                  type="button"
                  onClick={() => { handleHeaderFieldChange(openDropdownCol, ''); setOpenDropdownCol(null); }}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-slate-400 italic hover:bg-slate-50 transition-colors"
                >
                  — Skip column —
                </button>

                {/* Required group */}
                {config.fields.filter(f => f.required && f.label.toLowerCase().includes(dropdownSearch.toLowerCase())).length > 0 && (
                  <>
                    <div className="px-3 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-400 bg-blue-50 border-y border-blue-100">Required</div>
                    {config.fields
                      .filter(f => f.required && f.label.toLowerCase().includes(dropdownSearch.toLowerCase()))
                      .map(f => {
                        const usedAtCol = columnMapping[f.key];
                        const isCurrentCol = usedAtCol === openDropdownCol;
                        const usedElsewhere = usedAtCol !== undefined && !isCurrentCol;
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => { handleHeaderFieldChange(openDropdownCol, f.key); setOpenDropdownCol(null); }}
                            className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-colors ${
                              isCurrentCol ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-slate-800'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCurrentCol ? 'bg-white' : 'bg-blue-400'}`} />
                            <span className="flex-1 truncate font-medium">{f.label}</span>
                            {usedElsewhere && <span className={`text-[9px] shrink-0 ${isCurrentCol ? 'text-blue-200' : 'text-slate-400'}`}>col {usedAtCol! + 1}</span>}
                          </button>
                        );
                      })}
                  </>
                )}

                {/* Optional group */}
                {config.fields.filter(f => !f.required && f.label.toLowerCase().includes(dropdownSearch.toLowerCase())).length > 0 && (
                  <>
                    <div className="px-3 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border-y border-slate-100">Optional</div>
                    {config.fields
                      .filter(f => !f.required && f.label.toLowerCase().includes(dropdownSearch.toLowerCase()))
                      .map(f => {
                        const usedAtCol = columnMapping[f.key];
                        const isCurrentCol = usedAtCol === openDropdownCol;
                        const usedElsewhere = usedAtCol !== undefined && !isCurrentCol;
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => { handleHeaderFieldChange(openDropdownCol, f.key); setOpenDropdownCol(null); }}
                            className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-colors ${
                              isCurrentCol ? 'bg-slate-700 text-white' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCurrentCol ? 'bg-white' : 'bg-slate-300'}`} />
                            <span className="flex-1 truncate">{f.label}</span>
                            {usedElsewhere && <span className={`text-[9px] shrink-0 ${isCurrentCol ? 'text-slate-300' : 'text-slate-400'}`}>col {usedAtCol! + 1}</span>}
                          </button>
                        );
                      })}
                  </>
                )}

                {/* Empty state */}
                {dropdownSearch && config.fields.filter(f => f.label.toLowerCase().includes(dropdownSearch.toLowerCase())).length === 0 && (
                  <div className="px-3 py-3 text-[11px] text-slate-400 text-center">No fields match "{dropdownSearch}"</div>
                )}
              </div>
            </div>,
            document.body
          )}

          {/* Footer hints */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-400">
              Tab / Enter to navigate · Paste CSV/TSV anywhere in the grid
            </p>
            {pastedText && (
              <button
                type="button"
                onClick={handleClearFile}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={11} />
                Clear
              </button>
            )}
          </div>

          {autoMatchInfo && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
              autoMatchInfo.startsWith('✅')
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {autoMatchInfo}
            </div>
          )}

          {/* Switch to preview */}
          {parsedRows.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-dashed border-blue-300 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <CheckCircle size={15} />
              {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} ready — view Preview →
            </button>
          )}
        </div>
      )}

      {/* ── Tab: Preview ── */}
      {activeTab === 'preview' && (
        <div className="flex flex-col gap-3">
          {/* Stats row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
              {parsedRows.length} total
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
              <CheckCircle size={11} />
              {validRows.length} valid
            </span>
            {warnRows.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                <AlertCircle size={11} />
                {warnRows.length} warning{warnRows.length !== 1 ? 's' : ''}
              </span>
            )}
            {invalidRows.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                <AlertCircle size={11} />
                {invalidRows.length} error{invalidRows.length !== 1 ? 's' : ''}
              </span>
            )}
            {parsedRows.length === 0 && (
              <span className="text-xs text-slate-400">No data yet — paste data in the Paste tab first.</span>
            )}
          </div>

          {/* Table */}
          {parsedRows.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              {/* Sub-tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50">
                {[
                  { key: 'summary', label: 'All',    count: parsedRows.length,  color: 'blue'  },
                  { key: 'valid',   label: 'Valid',   count: validRows.length,   color: 'green' },
                  { key: 'invalid', label: 'Errors',  count: invalidRows.length, color: 'red'   },
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTablePreviewType(tab.key as any)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold border-b-2 transition-colors ${
                      tablePreviewType === tab.key
                        ? tab.color === 'blue'  ? 'border-blue-500 text-blue-600 bg-white'
                        : tab.color === 'green' ? 'border-green-500 text-green-600 bg-white'
                        :                         'border-red-500 text-red-600 bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                      tablePreviewType === tab.key
                        ? tab.color === 'blue'  ? 'bg-blue-100 text-blue-700'
                        : tab.color === 'green' ? 'bg-green-100 text-green-700'
                        :                         'bg-red-100 text-red-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Table body */}
              <div className="overflow-x-auto max-h-[50vh] md:max-h-[55vh] overflow-y-auto">
                <table className="w-full min-w-max text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                    <tr>
                      <th className="px-2 py-2 text-left border-r border-slate-200 w-8">
                        <input
                          type="checkbox"
                          checked={tableDisplayRows.length > 0 && selectedRows.size === tableDisplayRows.length}
                          onChange={handleSelectAll}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-2 py-2 font-semibold text-slate-600 border-r border-slate-200 w-8 text-center">#</th>
                      {config.tableColumns.map(col => {
                        const isRequired = config.fields.find(f => f.key === col.key)?.required === true;
                        return (
                          <th
                            key={col.key}
                            className="px-2 py-2 text-left font-semibold text-slate-600 border-r border-slate-200 whitespace-nowrap"
                            style={{ width: col.width ? `${col.width}px` : 'auto' }}
                          >
                            {col.label}{isRequired && <span className="text-red-400 ml-0.5">*</span>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {tableDisplayRows.map(row => {
                      const importFailed = failedImportRows.has(row.index);
                      return (
                      <React.Fragment key={row.index}>
                        <tr
                          onClick={() => { if (editingRowIndex !== row.index) handleRowClick(row.index); }}
                          className={`border-b border-slate-100 cursor-pointer transition-colors ${
                            editingRowIndex === row.index
                              ? 'bg-blue-50/60'
                              : importFailed
                              ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100/80 dark:hover:bg-red-900/30'
                              : !row.valid
                              ? 'bg-red-50/60 hover:bg-red-100/60'
                              : row.warnings?.length
                              ? 'bg-amber-50/50 hover:bg-amber-50'
                              : 'bg-white hover:bg-green-50'
                          } ${selectedRowIndex === row.index ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
                        >
                          <td className="px-2 py-1.5 border-r border-slate-100 w-8 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedRows.has(row.index)}
                              onChange={(e) => {
                                const s = new Set(selectedRows);
                                e.target.checked ? s.add(row.index) : s.delete(row.index);
                                setSelectedRows(s);
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-slate-400 border-r border-slate-100 w-8 text-center font-mono">
                            {row.index + 1}
                          </td>
                          {config.tableColumns.map(col => (
                            <td
                              key={col.key}
                              className="px-2 py-1.5 text-slate-700 border-r border-slate-100 truncate max-w-[160px]"
                              title={String(row.parsed[col.key] || '—')}
                            >
                              {col.key === 'valid' ? (
                                importFailed ? (
                                  <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                    <AlertCircle size={11} />导入失败
                                  </span>
                                ) : !row.valid ? (
                                  <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                    <AlertCircle size={11} />Error
                                  </span>
                                ) : row.warnings?.length ? (
                                  <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                                    <AlertCircle size={11} />Warning
                                  </span>
                                ) : row.isUpdate ? (
                                  <span className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                                    <CheckCircle size={11} />Update
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                                    <CheckCircle size={11} />Valid
                                  </span>
                                )
                              ) : (() => {
                                const val = row.parsed[col.key];
                                if (col.formatter) return col.formatter(val);
                                if (val === null || val === undefined || (typeof val === 'number' && isNaN(val))) return '—';
                                if (val === 0 || val === '0') return '0';
                                return String(val || '—');
                              })()}
                            </td>
                          ))}
                          {/* Edit button (情景 LL) */}
                          <td className="px-1 py-1.5 w-7 text-center" onClick={e => e.stopPropagation()}>
                            {editingRowIndex === row.index ? (
                              <button type="button" onClick={() => { setEditingRowIndex(null); setEditingRowValues({}); }}
                                className="text-[10px] text-slate-400 hover:text-red-500 px-1 py-0.5 rounded" title="Cancel edit">✕</button>
                            ) : (
                              <button type="button" onClick={() => { setEditingRowIndex(row.index); setEditingRowValues({ ...row.parsed }); }}
                                className="text-[10px] text-slate-400 hover:text-jci-blue px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Edit row">✎</button>
                            )}
                          </td>
                          {/* Import-failure dot indicator at end of row */}
                          {importFailed && (
                            <td className="px-2 py-1.5 w-6 text-center" title="导入时出错">
                              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                            </td>
                          )}
                        </tr>
                        {/* Inline edit sub-row (情景 LL) */}
                        {editingRowIndex === row.index && (
                          <tr className="bg-blue-50/40 border-b border-blue-200">
                            <td colSpan={2} />
                            {config.tableColumns.filter(c => c.key !== 'valid').map(col => (
                              <td key={col.key} className="px-1 py-1">
                                <input
                                  type={col.key === 'income' || col.key === 'expense' ? 'number' : col.key === 'date' ? 'date' : 'text'}
                                  value={editingRowValues[col.key] ?? ''}
                                  onChange={e => setEditingRowValues(prev => ({ ...prev, [col.key]: e.target.value }))}
                                  className="w-full text-xs px-1.5 py-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                                  placeholder={col.label}
                                />
                              </td>
                            ))}
                            <td className="px-1 py-1">
                              <button type="button" onClick={() => handleSaveEditedRow(row.index)}
                                className="text-[11px] font-semibold text-white bg-jci-blue hover:bg-blue-700 px-2 py-1 rounded">Save</button>
                            </td>
                            <td />
                          </tr>
                        )}
                        {!row.valid && row.errors.length > 0 && (
                          <tr className="bg-red-50 border-b border-red-100">
                            <td colSpan={config.tableColumns.length + 2} className="px-3 py-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleError(row.index)}
                                className="w-full text-left flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800"
                              >
                                {expandedErrors.has(row.index) ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                <span className="font-semibold">
                                  {expandedErrors.has(row.index) ? 'Hide errors' : `${row.errors.length} error${row.errors.length !== 1 ? 's' : ''}`}
                                </span>
                              </button>
                              {expandedErrors.has(row.index) && (
                                <ul className="mt-1 ml-4 space-y-0.5">
                                  {row.errors.map((error, i) => (
                                    <li key={i} className="text-xs text-red-600">• {error}</li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                        {row.valid && row.warnings && row.warnings.length > 0 && (
                          <tr className="bg-amber-50 border-b border-amber-100">
                            <td colSpan={config.tableColumns.length + 3} className="px-3 py-1.5">
                              <ul className="space-y-0.5">
                                {row.warnings.map((w, i) => (
                                  <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                                    <AlertCircle size={11} className="shrink-0 mt-0.5" />
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                        {importFailed && (
                          <tr className="bg-red-50 dark:bg-red-900/20 border-b border-red-100">
                            <td colSpan={config.tableColumns.length + 3} className="px-3 py-1 text-xs text-red-600 font-medium">
                              ❌ 此行在导入时发生错误，请检查数据后重试
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table footer */}
              <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {tableDisplayRows.length} row{tableDisplayRows.length !== 1 ? 's' : ''}
                  {selectedRows.size > 0 && ` · ${selectedRows.size} selected`}
                </span>
                <div className="flex items-center gap-3">
                  {selectedRows.size > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      <Trash2 size={11} />
                      Delete selected
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab('paste')}
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                  >
                    ← Edit data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default BatchImportModal;
