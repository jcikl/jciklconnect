import React from 'react';
import { Check, Clock, FileText, Globe, Lock, MoreVertical, Send, X } from 'lucide-react';
import { Badge, Button } from '../../ui/Common';
import type { Project } from '../../../types';

interface ProjectsDetailHeaderProps {
  project: Project;
  isPrivileged: boolean;
  isStatusUpdating: boolean;
  onBack: () => void;
  onStatusUpdate: (status: Project['status']) => void;
}

export const ProjectsDetailHeader: React.FC<ProjectsDetailHeaderProps> = ({
  project,
  isPrivileged,
  isStatusUpdating,
  onBack,
  onStatusUpdate,
}) => (
  <>
    <button onClick={onBack} className="text-xs text-slate-400 hover:text-jci-blue font-semibold transition-colors">← Events Management</button>
    <div className="flex flex-row justify-between items-center gap-2">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg md:text-2xl font-bold text-slate-900 truncate leading-tight">{project.name ?? project.title ?? 'Project'}</h2>
      </div>
      <div className="flex gap-2 shrink-0">
        <div className="hidden md:flex gap-2">
          {(project.status === 'Planning' || project.status === 'Draft') && (
            <>
              <Button variant="ghost" onClick={() => onStatusUpdate('Planning')} disabled={isStatusUpdating}>Save Draft</Button>
              <Button onClick={() => onStatusUpdate('Under Review')} disabled={isStatusUpdating}><Send size={16} className="mr-2" />Submit</Button>
            </>
          )}
          {project.status === 'Under Review' && !isPrivileged && (
            <Button disabled variant="outline"><Clock size={16} className="mr-2" />Under Review</Button>
          )}
          {project.status === 'Under Review' && isPrivileged && (
            <>
              <div className="flex items-center px-3 bg-slate-100 rounded-lg text-slate-600 text-sm font-medium"><Clock size={14} className="mr-1" />Under Review</div>
              <Button variant="danger" onClick={() => onStatusUpdate('Planning')} disabled={isStatusUpdating}><X size={16} className="mr-2" />Reject</Button>
              <Button variant="primary" onClick={() => onStatusUpdate('Approved')} disabled={isStatusUpdating}><Check size={16} className="mr-2" />Approve</Button>
            </>
          )}
          {project.status === 'Approved' && (
            <Button onClick={() => onStatusUpdate('Active')} disabled={isStatusUpdating}><Globe size={16} className="mr-2" />Publish</Button>
          )}
          {project.status === 'Active' && (
            <>
              <Badge variant="success" className="h-10 px-4"><Globe size={14} className="mr-1" />Published</Badge>
              <Button variant="danger" onClick={() => onStatusUpdate('Approved')} disabled={isStatusUpdating}><Lock size={16} className="mr-2" />Unpublish</Button>
            </>
          )}
        </div>

        <div className="flex md:hidden items-center gap-2">
          {(project.status === 'Planning' || project.status === 'Draft') && (
            <Button size="sm" onClick={() => onStatusUpdate('Under Review')} disabled={isStatusUpdating}><Send size={14} className="mr-1" />Submit</Button>
          )}
          {project.status === 'Under Review' && !isPrivileged && (
            <Badge variant="neutral" className="h-8 px-3 text-xs"><Clock size={12} className="mr-1" />Reviewing</Badge>
          )}
          {project.status === 'Under Review' && isPrivileged && (
            <Button size="sm" variant="primary" onClick={() => onStatusUpdate('Approved')} disabled={isStatusUpdating}><Check size={14} className="mr-1" />Approve</Button>
          )}
          {project.status === 'Approved' && (
            <Button size="sm" onClick={() => onStatusUpdate('Active')} disabled={isStatusUpdating}><Globe size={14} className="mr-1" />Publish</Button>
          )}
          {project.status === 'Active' && (
            <Badge variant="success" className="h-8 px-3 text-xs"><Globe size={12} className="mr-1" />Published</Badge>
          )}
          <div className="relative group">
            <button className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-all">
              <MoreVertical size={16} />
            </button>
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 hidden group-focus-within:block">
              {(project.status === 'Planning' || project.status === 'Draft') && (
                <button onClick={() => onStatusUpdate('Planning')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <FileText size={14} />Save Draft
                </button>
              )}
              {project.status === 'Under Review' && isPrivileged && (
                <button onClick={() => onStatusUpdate('Planning')} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                  <X size={14} />Reject
                </button>
              )}
              {project.status === 'Active' && (
                <button onClick={() => onStatusUpdate('Approved')} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                  <Lock size={14} />Unpublish
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);
