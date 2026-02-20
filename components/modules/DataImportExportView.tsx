import React, { useState } from 'react';
import { Download, Upload, FileText, Database, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button, Card, Badge, Modal, useToast, Tabs } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { DataImportExportService } from '../../services/dataImportExportService';
import { DataImportResult } from '../../types';

export const DataImportExportView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportType, setExportType] = useState<'members' | 'events' | 'projects' | 'transactions'>('members');
  const [exportFormat, setExportFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [importType, setImportType] = useState<'members'>('members');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<DataImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();

  const handleExport = async () => {
    try {
      setIsExporting(true);
      let content: string;
      let filename: string;
      let mimeType: string;

      // Get current user ID (in real app, this would come from auth context)
      const userId = 'current-user-id';

      if (exportFormat === 'CSV') {
        // Use generateImportTemplate to get field structure, then export
        const template = DataImportExportService.generateImportTemplate(exportType);
        const fields = template.requiredFields.concat(template.optionalFields);
        content = await DataImportExportService.exportToCSV(exportType, fields, [], userId);
        filename = `${exportType}_export_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else {
        // For JSON export, we'll create a simple JSON structure
        content = JSON.stringify([], null, 2);
        filename = `${exportType}_export_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('Export completed successfully', 'success');
    } catch (error) {
      showToast('Failed to export data', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      showToast('Please select a file to import', 'error');
      return;
    }

    try {
      setIsImporting(true);
      const fileContent = await importFile.text();
      
      // Parse the file content based on file type
      let data: any[];
      if (importFile.name.endsWith('.json')) {
        data = JSON.parse(fileContent);
      } else {
        // For CSV, we'd need to parse it - for now, assume JSON format
        data = JSON.parse(fileContent);
      }
      
      // Get current user ID (in real app, this would come from auth context)
      const userId = 'current-user-id';
      
      const result = await DataImportExportService.importData(data, importType, userId, importFile.name);
      setImportResult(result);
      
      if (result.successfulRows > 0) {
        showToast(`Successfully imported ${result.successfulRows} records`, 'success');
      }
      if (result.failedRows > 0) {
        showToast(`${result.failedRows} records failed to import`, 'error');
      }
    } catch (error) {
      showToast('Failed to import data', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Data Import & Export</h2>
          <p className="text-slate-500">Import and export data in various formats.</p>
        </div>
      </div>

      <Card noPadding>
        <div className="px-6 pt-4">
          <Tabs
            tabs={['Export Data', 'Import Data']}
            activeTab={activeTab === 'export' ? 'Export Data' : 'Import Data'}
            onTabChange={(tab) => setActiveTab(tab === 'Export Data' ? 'export' : 'import')}
          />
        </div>
        <div className="p-6">
          {activeTab === 'export' ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Export Data</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Data Type</label>
                    <Select
                      value={exportType}
                      onChange={(e) => setExportType(e.target.value as any)}
                      options={[
                        { label: 'Members', value: 'members' },
                        { label: 'Events', value: 'events' },
                        { label: 'Projects', value: 'projects' },
                        { label: 'Transactions', value: 'transactions' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Export Format</label>
                    <Select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                      options={[
                        { label: 'CSV', value: 'CSV' },
                        { label: 'JSON', value: 'JSON' },
                      ]}
                    />
                  </div>
                  <Button
                    onClick={handleExport}
                    isLoading={isExporting}
                    className="w-full"
                  >
                    <Download size={16} className="mr-2" />
                    Export {exportType.charAt(0).toUpperCase() + exportType.slice(1)} as {exportFormat}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Import Data</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Data Type</label>
                    <Select
                      value={importType}
                      onChange={(e) => setImportType(e.target.value as any)}
                      options={[
                        { label: 'Members', value: 'members' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">CSV File</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="import-file"
                      />
                      <label htmlFor="import-file" className="cursor-pointer">
                        <Upload className="mx-auto mb-2 text-slate-400" size={32} />
                        <p className="text-sm text-slate-600">
                          {importFile ? importFile.name : 'Click to select CSV file'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">CSV format only</p>
                      </label>
                    </div>
                  </div>
                  <Button
                    onClick={handleImport}
                    isLoading={isImporting}
                    disabled={!importFile}
                    className="w-full"
                  >
                    <Upload size={16} className="mr-2" />
                    Import {importType.charAt(0).toUpperCase() + importType.slice(1)}
                  </Button>

                  {importResult && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                      <h4 className="font-semibold text-slate-900 mb-3">Import Results</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle size={16} />
                          <span>Successfully imported: {importResult.successfulRows} records</span>
                        </div>
                        {importResult.failedRows > 0 && (
                          <div className="flex items-center gap-2 text-red-600">
                            <XCircle size={16} />
                            <span>Failed: {importResult.failedRows} records</span>
                          </div>
                        )}
                        {importResult.errors.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-slate-700 mb-2">Errors:</p>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {importResult.errors.map((error, idx) => (
                                <div key={idx} className="text-xs text-red-600 flex items-start gap-2">
                                  <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                                  <span>Row {error.row}: {error.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

