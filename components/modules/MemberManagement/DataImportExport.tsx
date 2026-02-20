import React, { useState, useRef } from 'react';
import { 
  DataImportResult, 
  DataExportRequest, 
  DataImportError, 
  ImportTemplate,
  DataExportFilter 
} from '../../../types';
import { DataImportExportService } from '../../../services/dataImportExportService';

interface DataImportExportProps {
  onImportComplete?: (result: DataImportResult) => void;
  onExportComplete?: (request: DataExportRequest) => void;
}

export const DataImportExport: React.FC<DataImportExportProps> = ({
  onImportComplete,
  onExportComplete
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importEntityType, setImportEntityType] = useState<string>('members');
  const [importResult, setImportResult] = useState<DataImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<DataImportError[]>([]);
  
  const [exportEntityType, setExportEntityType] = useState<string>('members');
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv');
  const [exportFields, setExportFields] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entityTypes = [
    { value: 'members', label: 'Members' },
    { value: 'events', label: 'Events' },
    { value: 'projects', label: 'Projects' },
    { value: 'transactions', label: 'Transactions' }
  ];

  const memberFields = [
    'id', 'name', 'email', 'phone', 'dateOfBirth', 'membershipType', 
    'status', 'joinDate', 'address', 'emergencyContact'
  ];

  const eventFields = [
    'id', 'title', 'description', 'date', 'time', 'location', 
    'type', 'capacity', 'registrationRequired', 'budget'
  ];

  const projectFields = [
    'id', 'name', 'description', 'startDate', 'endDate', 
    'status', 'budget', 'leaderId', 'category', 'progress'
  ];

  const getFieldsForEntity = (entityType: string): string[] => {
    switch (entityType) {
      case 'members': return memberFields;
      case 'events': return eventFields;
      case 'projects': return projectFields;
      default: return [];
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
      setImportErrors([]);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    setImportResult(null);
    setImportErrors([]);

    try {
      // Parse file
      const data = await DataImportExportService.parseFile(importFile);
      
      // Import data
      const result = await DataImportExportService.importData(
        data,
        importEntityType,
        'current-user-id', // In real app, get from auth context
        importFile.name
      );

      setImportResult(result);
      setImportErrors(result.errors);
      onImportComplete?.(result);
    } catch (error) {
      console.error('Import failed:', error);
      setImportErrors([{
        row: 0,
        message: `Import failed: ${error}`,
        severity: 'error'
      }]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    if (exportFields.length === 0) {
      alert('Please select at least one field to export');
      return;
    }

    setIsExporting(true);

    try {
      let data: string | ArrayBuffer;
      let filename: string;
      let mimeType: string;

      if (exportFormat === 'csv') {
        data = await DataImportExportService.exportToCSV(
          exportEntityType,
          exportFields,
          [], // No filters for now
          'current-user-id'
        );
        filename = `${exportEntityType}_export_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else {
        data = await DataImportExportService.exportToExcel(
          exportEntityType,
          exportFields,
          [], // No filters for now
          'current-user-id'
        );
        filename = `${exportEntityType}_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }

      // Download file
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Create export request object for callback
      const exportRequest: DataExportRequest = {
        id: Math.random().toString(36).substr(2, 9),
        entityType: exportEntityType as any,
        format: exportFormat,
        fields: exportFields,
        requestedBy: 'current-user-id',
        requestedAt: new Date(),
        status: 'completed',
        downloadUrl: url
      };

      onExportComplete?.(exportRequest);
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFieldToggle = (field: string) => {
    setExportFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const handleSelectAllFields = () => {
    const allFields = getFieldsForEntity(exportEntityType);
    setExportFields(allFields);
  };

  const handleDeselectAllFields = () => {
    setExportFields([]);
  };

  const downloadTemplate = () => {
    const template = DataImportExportService.generateImportTemplate(importEntityType);
    const csvData = template.sampleData || [];
    
    if (csvData.length > 0) {
      const csv = Object.keys(csvData[0]).join(',') + '\n' + 
                  csvData.map(row => Object.values(row).join(',')).join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${importEntityType}_template.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Data Import/Export</h2>
        <p className="text-gray-600">Import data from Excel/CSV files or export data to various formats</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'import'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Import Data
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'export'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Export Data
        </button>
      </div>

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Type
              </label>
              <select
                value={importEntityType}
                onChange={(e) => setImportEntityType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {entityTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Import File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Download Template
            </button>
            <button
              onClick={handleImport}
              disabled={!importFile || isImporting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isImporting ? 'Importing...' : 'Import Data'}
            </button>
          </div>

          {/* Import Results */}
          {importResult && (
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">Import Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{importResult.totalRows}</div>
                  <div className="text-sm text-gray-600">Total Rows</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{importResult.successfulRows}</div>
                  <div className="text-sm text-gray-600">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{importResult.failedRows}</div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{importResult.warnings.length}</div>
                  <div className="text-sm text-gray-600">Warnings</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600">{importResult.summary.created}</div>
                  <div className="text-xs text-gray-600">Created</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-blue-600">{importResult.summary.updated}</div>
                  <div className="text-xs text-gray-600">Updated</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-yellow-600">{importResult.summary.skipped}</div>
                  <div className="text-xs text-gray-600">Skipped</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-orange-600">{importResult.summary.duplicates}</div>
                  <div className="text-xs text-gray-600">Duplicates</div>
                </div>
              </div>
            </div>
          )}

          {/* Import Errors */}
          {importErrors.length > 0 && (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <h3 className="text-lg font-semibold text-red-800 mb-3">Import Errors</h3>
              <div className="max-h-60 overflow-y-auto">
                {importErrors.map((error, index) => (
                  <div key={index} className="mb-2 p-2 bg-white rounded border-l-4 border-red-400">
                    <div className="text-sm">
                      <span className="font-medium">Row {error.row}:</span>
                      {error.field && <span className="text-gray-600"> ({error.field})</span>}
                      <span className="ml-2">{error.message}</span>
                    </div>
                    {error.value && (
                      <div className="text-xs text-gray-500 mt-1">
                        Value: {String(error.value)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Type
              </label>
              <select
                value={exportEntityType}
                onChange={(e) => {
                  setExportEntityType(e.target.value);
                  setExportFields([]);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {entityTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export Format
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'csv' | 'excel')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Select Fields to Export
              </label>
              <div className="space-x-2">
                <button
                  onClick={handleSelectAllFields}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAllFields}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4 border border-gray-200 rounded-md max-h-60 overflow-y-auto">
              {getFieldsForEntity(exportEntityType).map(field => (
                <label key={field} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportFields.includes(field)}
                    onChange={() => handleFieldToggle(field)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{field}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleExport}
              disabled={exportFields.length === 0 || isExporting}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};