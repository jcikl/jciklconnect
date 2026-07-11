import React from 'react';
import { Download, CheckCircle } from 'lucide-react';
import { Modal, Button, Badge, useToast } from '../../ui/Common';
import { ProjectReportService, ProjectReport } from '../../../services/projectReportService';

export interface ProjectReportModalProps {
  report: ProjectReport;
  onClose: () => void;
}

export const ProjectReportModal: React.FC<ProjectReportModalProps> = ({ report, onClose }) => {
  const { showToast } = useToast();

  const handleExportJSON = async () => {
    try {
      const json = await ProjectReportService.exportReportAsJSON(report.projectId);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-report-${report.projectId}-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Report exported successfully', 'success');
    } catch (err) {
      showToast('Failed to export report', 'error');
    }
  };

  const handleExportText = async () => {
    try {
      const text = await ProjectReportService.exportReportAsText(report.projectId);
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-report-${report.projectId}-${new Date().toISOString()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Report exported successfully', 'success');
    } catch (err) {
      showToast('Failed to export report', 'error');
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Project Report: ${report.projectName}`} size="xl">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
        {/* Export actions */}
        <div className="flex gap-2 pb-4 border-b border-slate-100">
          <Button variant="outline" size="sm" onClick={handleExportJSON}>
            <Download size={13} className="mr-1.5" /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportText}>
            <Download size={13} className="mr-1.5" /> Text
          </Button>
        </div>

        {/* Executive Summary */}
        <div className="pl-4 border-l-4 border-jci-blue">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Executive Summary</h3>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Status</span>
              <Badge variant="info">{report.executiveSummary.status}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Completion</span>
              <span className="text-sm font-bold text-slate-800">{report.executiveSummary.completionPercentage.toFixed(1)}%</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 min-w-0">
              <div className="text-xs text-slate-500 mb-1">Total Tasks</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums">{report.executiveSummary.totalTasks}</div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 min-w-0">
              <div className="text-xs text-green-600 mb-1">Completed</div>
              <div className="text-xl font-bold text-green-700 tabular-nums">{report.executiveSummary.completedTasks}</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 min-w-0">
              <div className="text-xs text-amber-600 mb-1">In Progress</div>
              <div className="text-xl font-bold text-amber-700 tabular-nums">{report.executiveSummary.inProgressTasks}</div>
            </div>
          </div>
        </div>

        {/* Team Performance */}
        {report.teamPerformance && (
          <div className="pl-4 border-l-4 border-violet-400">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Team Performance</h3>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-white">
                <span className="text-slate-600">Total Members</span>
                <span className="font-semibold tabular-nums">{report.teamPerformance.totalMembers}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-white">
                <span className="text-slate-600">Active Members</span>
                <span className="font-semibold tabular-nums">{report.teamPerformance.activeMembers}</span>
              </div>
            </div>
          </div>
        )}

        {/* Risks & Issues */}
        {report.risksAndIssues.length > 0 && (
          <div className="pl-4 border-l-4 border-amber-400">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Risks & Issues</h3>
            <div className="space-y-2">
              {report.risksAndIssues.map((risk, index) => (
                <div key={index} className="rounded-xl border border-slate-100 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <Badge variant={risk.severity === 'high' ? 'error' : risk.severity === 'medium' ? 'warning' : 'neutral'}>
                      {risk.severity}
                    </Badge>
                    <Badge variant="neutral">{risk.type}</Badge>
                  </div>
                  <p className="text-sm text-slate-700">{risk.description}</p>
                  {risk.mitigation && (
                    <p className="text-xs text-slate-400 mt-1.5 italic">Mitigation: {risk.mitigation}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div className="pl-4 border-l-4 border-green-400">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Recommendations</h3>
            <ul className="space-y-1.5">
              {report.recommendations.map((rec, index) => (
                <li key={index} className="flex gap-2 text-sm text-slate-700">
                  <CheckCircle size={14} className="flex-shrink-0 mt-0.5 text-green-500" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next Steps */}
        {report.nextSteps.length > 0 && (
          <div className="pl-4 border-l-4 border-slate-300">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Next Steps</h3>
            <ul className="space-y-1.5">
              {report.nextSteps.map((step, index) => (
                <li key={index} className="flex gap-2 text-sm text-slate-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center mt-0.5">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
};
