import React from 'react';
import { BarChart3, Users, GitBranch, CheckCircle, RefreshCw, FileText } from 'lucide-react';
import { Button } from '../../ui/Common';

export interface ProjectReportsTabProps {
  projectId: string;
  projectName: string;
  onGenerateReport: () => Promise<void>;
  loading: boolean;
}

export const ProjectReportsTab: React.FC<ProjectReportsTabProps> = ({
  projectName,
  onGenerateReport,
  loading,
}) => {
  const REPORT_SECTIONS = [
    { icon: <BarChart3 size={16} />, label: 'Executive Summary', color: 'text-jci-blue bg-jci-blue/10' },
    { icon: <Users size={16} />, label: 'Team Performance', color: 'text-violet-600 bg-violet-100' },
    { icon: <GitBranch size={16} />, label: 'Risks & Issues', color: 'text-amber-600 bg-amber-100' },
    { icon: <CheckCircle size={16} />, label: 'Recommendations', color: 'text-green-600 bg-green-100' },
  ];

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Project Reports</h3>
          <p className="text-sm text-slate-500 mt-0.5">Comprehensive AI-generated report for <span className="font-medium text-slate-700">{projectName}</span></p>
        </div>
        <Button onClick={onGenerateReport} disabled={loading} size="sm">
          {loading
            ? <><RefreshCw size={14} className="mr-1.5 animate-spin" /> Generating</>
            : <><FileText size={14} className="mr-1.5" /> Generate Report</>}
        </Button>
      </div>

      {/* Feature chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {REPORT_SECTIONS.map(s => (
          <div key={s.label} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}>
              {s.icon}
            </div>
            <span className="text-xs font-medium text-slate-700 leading-tight">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
