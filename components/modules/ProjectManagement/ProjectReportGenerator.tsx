import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Settings,
  BarChart3,
  Calendar,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Filter,
  Save,
  Eye,
  Trash2,
  Plus
} from 'lucide-react';
import {
  ProjectReport,
  ReportTemplate,
  ReportExportOptions,
  ProjectReportService
} from '../../../services/projectReportService';
import { Project } from '../../../types';
import * as Forms from '../../ui/Form';

interface ProjectReportGeneratorProps {
  project: Project;
  onClose: () => void;
}

export const ProjectReportGenerator: React.FC<ProjectReportGeneratorProps> = ({
  project,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'templates'>('generate');
  const [reportType, setReportType] = useState<'status' | 'progress' | 'financial' | 'comprehensive'>('comprehensive');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [generatedReport, setGeneratedReport] = useState<ProjectReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'json' | 'text'>('pdf');

  // Template creation state
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    reportType: 'comprehensive' as const,
    includeCharts: true,
    includeFinancials: true,
    includeTeamDetails: true,
    includeRisks: true,
  });

  useEffect(() => {
    loadTemplates();
    ProjectReportService.initializeDefaultTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const templateList = await ProjectReportService.listReportTemplates();
      setTemplates(templateList);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const report = await ProjectReportService.generateReport(project.id, reportType);
      setGeneratedReport(report);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async () => {
    if (!generatedReport) return;

    setLoading(true);
    try {
      const exportOptions: ReportExportOptions = {
        format: exportFormat,
        templateId: selectedTemplate || undefined,
        includeCharts: true,
      };

      const exportResult = await ProjectReportService.exportReport(project.id, exportOptions);
      
      // Create download link
      const blobData = typeof exportResult.data === 'string' 
        ? [exportResult.data] 
        : [new Uint8Array(exportResult.data)];
      const blob = new Blob(blobData, { type: exportResult.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportResult.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const templateData = {
        name: newTemplate.name,
        description: newTemplate.description,
        reportType: newTemplate.reportType,
        sections: [
          { id: 'summary', name: 'Executive Summary', type: 'summary' as const, enabled: true, configuration: {} },
          { id: 'timeline', name: 'Timeline', type: 'chart' as const, enabled: true, configuration: {} },
          { id: 'team', name: 'Team Performance', type: 'table' as const, enabled: newTemplate.includeTeamDetails, configuration: {} },
          { id: 'financial', name: 'Financial Analysis', type: 'chart' as const, enabled: newTemplate.includeFinancials, configuration: {} },
          { id: 'risks', name: 'Risks & Issues', type: 'table' as const, enabled: newTemplate.includeRisks, configuration: {} },
        ],
        formatting: {
          includeCharts: newTemplate.includeCharts,
          includeFinancials: newTemplate.includeFinancials,
          includeTeamDetails: newTemplate.includeTeamDetails,
          includeRisks: newTemplate.includeRisks,
        },
      };

      await ProjectReportService.createReportTemplate(templateData, 'current-user');
      await loadTemplates();
      setShowCreateTemplate(false);
      setNewTemplate({
        name: '',
        description: '',
        reportType: 'comprehensive',
        includeCharts: true,
        includeFinancials: true,
        includeTeamDetails: true,
        includeRisks: true,
      });
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await ProjectReportService.deleteReportTemplate(templateId);
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'active':
      case 'in progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'on hold':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Project Reports</h1>
          <p className="text-gray-600 mt-1">{project.name ?? project.title ?? 'Project'}</p>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Close
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('generate')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'generate'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Generate Report
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Templates
          </button>
        </nav>
      </div>

      {/* Generate Report Tab */}
      {activeTab === 'generate' && (
        <div className="space-y-6">
          {/* Report Configuration */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Report Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Forms.Select
                label="Report Type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                options={[
                  { label: 'Status Report', value: 'status' },
                  { label: 'Progress Report', value: 'progress' },
                  { label: 'Financial Report', value: 'financial' },
                  { label: 'Comprehensive Report', value: 'comprehensive' },
                ]}
              />

              <Forms.Select
                label="Template (Optional)"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                options={[
                  { label: 'No Template', value: '' },
                  ...templates.map(template => ({
                    label: template.name,
                    value: template.id,
                  }))
                ]}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleGenerateReport}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <BarChart3 size={16} />
                {loading ? 'Generating...' : 'Generate Report'}
              </button>

              {generatedReport && (
                <div className="flex items-center gap-2">
                  <Forms.Select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as any)}
                    className="!py-2"
                    options={[
                      { label: 'PDF', value: 'pdf' },
                      { label: 'Excel', value: 'excel' },
                      { label: 'JSON', value: 'json' },
                      { label: 'Text', value: 'text' },
                    ]}
                  />
                  
                  <button
                    onClick={handleExportReport}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Download size={16} />
                    Export
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Generated Report Preview */}
          {generatedReport && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Report Preview</h3>
              
              {/* Executive Summary */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
                  {getStatusIcon(generatedReport.executiveSummary.status)}
                  Executive Summary
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium">{generatedReport.executiveSummary.status}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Completion</p>
                    <p className="font-medium">{generatedReport.executiveSummary.completionPercentage}%</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Total Tasks</p>
                    <p className="font-medium">{generatedReport.executiveSummary.totalTasks}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="font-medium">{generatedReport.executiveSummary.completedTasks}</p>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              {generatedReport.financialSummary && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Financial Summary
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-600">Budget</p>
                      <p className="font-medium">{formatCurrency(generatedReport.financialSummary.budget)}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-600">Expenses</p>
                      <p className="font-medium">{formatCurrency(generatedReport.financialSummary.totalExpenses)}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-600">Balance</p>
                      <p className="font-medium">{formatCurrency(generatedReport.financialSummary.currentBalance)}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-600">Utilization</p>
                      <p className="font-medium">{generatedReport.financialSummary.budgetUtilization.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Team Performance */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Team Performance
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Total Members</p>
                    <p className="font-medium">{generatedReport.teamPerformance.totalMembers}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Active Members</p>
                    <p className="font-medium">{generatedReport.teamPerformance.activeMembers}</p>
                  </div>
                </div>
                
                {generatedReport.teamPerformance.memberContributions.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2">Member</th>
                          <th className="text-left py-2">Completed</th>
                          <th className="text-left py-2">In Progress</th>
                          <th className="text-left py-2">Contribution %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedReport.teamPerformance.memberContributions.map((member) => (
                          <tr key={member.memberId} className="border-b border-gray-100">
                            <td className="py-2">{member.memberName}</td>
                            <td className="py-2">{member.tasksCompleted}</td>
                            <td className="py-2">{member.tasksInProgress}</td>
                            <td className="py-2">{member.contributionPercentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Upcoming Deadlines */}
              {generatedReport.timeline.upcomingDeadlines.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-orange-600" />
                    Upcoming Deadlines
                  </h4>
                  <div className="space-y-2">
                    {generatedReport.timeline.upcomingDeadlines.slice(0, 5).map((deadline) => (
                      <div key={deadline.taskId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">{deadline.taskName}</p>
                          <p className="text-sm text-gray-600">
                            Assigned to: {deadline.assignee || 'Unassigned'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{new Date(deadline.dueDate).toLocaleDateString()}</p>
                          <span className={`px-2 py-1 rounded text-xs ${
                            deadline.priority === 'High' 
                              ? 'bg-red-100 text-red-800' 
                              : deadline.priority === 'Medium'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {deadline.priority}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risks and Issues */}
              {generatedReport.risksAndIssues.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Risks & Issues
                  </h4>
                  <div className="space-y-2">
                    {generatedReport.risksAndIssues.map((risk, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded text-xs ${
                            risk.severity === 'high' 
                              ? 'bg-red-100 text-red-800' 
                              : risk.severity === 'medium'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {risk.severity.toUpperCase()} {risk.type.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm">{risk.description}</p>
                        {risk.mitigation && (
                          <p className="text-sm text-gray-600 mt-1">
                            <strong>Mitigation:</strong> {risk.mitigation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {generatedReport.recommendations.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    Recommendations
                  </h4>
                  <ul className="space-y-1">
                    {generatedReport.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-purple-600 mt-1">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              {generatedReport.nextSteps.length > 0 && (
                <div>
                  <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Next Steps
                  </h4>
                  <ul className="space-y-1">
                    {generatedReport.nextSteps.map((step, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-green-600 mt-1">•</span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Template Actions */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Report Templates</h3>
            <button
              onClick={() => setShowCreateTemplate(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              Create Template
            </button>
          </div>

          {/* Templates List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <div key={template.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedTemplate(template.id)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="Use Template"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete Template"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Type:</span>
                    <span className="capitalize">{template.reportType}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Sections:</span>
                    <span>{template.sections.filter(s => s.enabled).length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.formatting.includeCharts && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Charts</span>
                    )}
                    {template.formatting.includeFinancials && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Financial</span>
                    )}
                    {template.formatting.includeTeamDetails && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">Team</span>
                    )}
                    {template.formatting.includeRisks && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">Risks</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Create Template Modal */}
          {showCreateTemplate && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create Report Template</h3>
                
                <div className="space-y-4">
                  <Forms.Input
                    label="Template Name"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter template name"
                    required
                  />

                  <Forms.Textarea
                    label="Description"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe this template"
                    rows={3}
                  />

                  <Forms.Select
                    label="Report Type"
                    value={newTemplate.reportType}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, reportType: e.target.value as any }))}
                    options={[
                      { label: 'Status Report', value: 'status' },
                      { label: 'Progress Report', value: 'progress' },
                      { label: 'Financial Report', value: 'financial' },
                      { label: 'Comprehensive Report', value: 'comprehensive' },
                    ]}
                  />

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Include Sections</label>
                    
                    <Forms.Checkbox
                      label="Charts and Visualizations"
                      checked={newTemplate.includeCharts}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, includeCharts: e.target.checked }))}
                    />
                    
                    <Forms.Checkbox
                      label="Financial Analysis"
                      checked={newTemplate.includeFinancials}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, includeFinancials: e.target.checked }))}
                    />
                    
                    <Forms.Checkbox
                      label="Team Performance Details"
                      checked={newTemplate.includeTeamDetails}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, includeTeamDetails: e.target.checked }))}
                    />
                    
                    <Forms.Checkbox
                      label="Risks and Issues"
                      checked={newTemplate.includeRisks}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, includeRisks: e.target.checked }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateTemplate(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Save size={16} />
                    Create Template
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};