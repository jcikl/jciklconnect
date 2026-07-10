import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle, Download, Upload, FileSpreadsheet, ChevronDown, ChevronUp, Trash2, X } from 'lucide-react';
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
  const [autoMatchInfo, setAutoMatchInfo] = useState<string | null>(null);
  const [headerRowDetected, setHeaderRowDetected] = useState(false);
  const [activeTab, setActiveTab] = useState<'paste' | 'preview'>('paste');
  const [numExtraCols, setNumExtraCols] = useState(0);
  const [importing, setImporting] = useState(false);
  const [tablePreviewType, setTablePreviewType] = useState<'summary' | 'valid' | 'invalid'>('summary');
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

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
      setHeaderRowDetected(false);
      setAutoMatchInfo(null);
      setNumExtraCols(0);
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

  const handleTextChange = (text: string) => {
    const cleanedText = text.replace(/"/g, '');
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
        <div className="flex gap-2 w-full">
          <Button variant="outline" onClick={onClose} disabled={importing} className="flex-none px-5">
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={validRows.length === 0 || importing}
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
      }
    >
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".csv,.tsv" onChange={handleFileChange} className="hidden" />

      {/* Import progress overlay */}
      {importProgress && (
        <div className="absolute inset-0 z-[100] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 rounded-xl">
          <div className="w-56 h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-blue-600 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-base font-bold text-slate-900 mb-1">Importing…</p>
          <p className="text-sm text-slate-500">{importProgress.current} / {importProgress.total} rows</p>
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
        {config.supportCsv && (
          <div className="flex items-center gap-1.5 shrink-0">
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
          </div>
        )}
      </div>

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
                    {tableDisplayRows.map(row => (
                      <React.Fragment key={row.index}>
                        <tr
                          onClick={() => handleRowClick(row.index)}
                          className={`border-b border-slate-100 cursor-pointer transition-colors ${
                            row.valid ? 'bg-white hover:bg-green-50' : 'bg-red-50/60 hover:bg-red-100/60'
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
                                row.valid ? (
                                  row.isUpdate ? (
                                    <span className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                                      <CheckCircle size={11} />Update
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                                      <CheckCircle size={11} />Valid
                                    </span>
                                  )
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                    <AlertCircle size={11} />Error
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
                        </tr>
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
                      </React.Fragment>
                    ))}
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
