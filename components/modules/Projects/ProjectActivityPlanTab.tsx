import React, { useState } from 'react';
import { FileText, Edit, ExternalLink, Plus, DollarSign, Info, MapPin, Image } from 'lucide-react';
import { Button, Badge } from '../../ui/Common';
import { Project } from '../../../types';
import { PROJECT_TYPE_LABELS } from '../../../config/constants';
import { formatDate, toDate } from '../../../utils/dateUtils';
import { ProjectActivityDrawer } from './ProjectActivityDrawer';

interface ProjectActivityPlanTabProps {
  project: Project;
  onSave: (planData: Partial<Project>) => Promise<void>;
  onDelete: () => void | Promise<void>;
}

export const ProjectActivityPlanTab: React.FC<ProjectActivityPlanTabProps> = ({
  project,
  onSave,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const hasPlanFields =
    project.proposedDate ||
    project.proposedBudget != null ||
    project.objectives ||
    project.eventStartDate ||
    project.eventEndDate ||
    project.logoUrl ||
    project.roadmapId ||
    project.hostingLo ||
    project.description ||
    (project.galleryUrls && project.galleryUrls.length > 0);

  const drawer = (
    <ProjectActivityDrawer
      isOpen={isEditing}
      onClose={() => setIsEditing(false)}
      onSave={onSave}
      onDelete={async () => { await onDelete(); }}
      project={project}
    />
  );

  // Empty state
  if (!hasPlanFields) {
    return (
      <>
        <div className="text-center py-12">
          <FileText className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-500 mb-4">No activity plan data found on this project</p>
          <Button onClick={() => setIsEditing(true)}>
            <Plus size={16} className="mr-2" />
            Create Activity Plan
          </Button>
        </div>
        {drawer}
      </>
    );
  }

  // View mode
  const scheduleItems: { label: string; date: string; time?: string }[] = [];
  if (project.proposedDate) scheduleItems.push({ label: 'Proposed', date: formatDate(toDate(project.proposedDate as any)) });
  if (project.eventStartDate) scheduleItems.push({ label: 'Start', date: formatDate(toDate(project.eventStartDate as any)), time: project.eventStartTime });
  if (project.eventEndDate) scheduleItems.push({ label: 'End', date: formatDate(toDate(project.eventEndDate as any)), time: project.eventEndTime });

  return (
    <div className="space-y-4">
      {/* Classification badges — mobile */}
      <div className="flex flex-wrap gap-1.5 md:hidden">
        {project.level && <Badge variant="jci" className="text-xs px-2.5 py-1">{project.level}</Badge>}
        {project.pillar && <Badge variant="neutral" className="text-xs px-2.5 py-1">{project.pillar}</Badge>}
        {project.type && <Badge variant="neutral" className="text-xs px-2.5 py-1">{PROJECT_TYPE_LABELS[project.type] || project.type}</Badge>}
        {project.category && <Badge variant="neutral" className="text-xs px-2.5 py-1">{project.category}</Badge>}
      </div>

      <div className="md:grid md:grid-cols-[240px_1fr] md:gap-5">
        {/* Left: poster + gallery */}
        <div className="space-y-3 mb-4 md:mb-0">
          {project.logoUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 aspect-[4/3] md:aspect-[3/4] w-full shadow-sm group">
              <img src={project.logoUrl} alt="Poster" className="w-full h-full object-cover" />
              <button
                onClick={() => setIsEditing(true)}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-slate-700 hover:text-jci-blue border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-colors opacity-100"
              >
                <Edit size={12} />Edit
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-jci-blue hover:bg-sky-50 aspect-[4/3] md:aspect-[3/4] w-full flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-jci-blue transition-colors"
            >
              <Image size={32} />
              <span className="text-xs font-semibold">No poster · click to edit</span>
            </div>
          )}
          {project.galleryUrls && project.galleryUrls.length > 0 && project.galleryUrls[0] && (
            <a
              href={project.galleryUrls[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-jci-blue hover:bg-sky-50 transition-colors"
            >
              <ExternalLink size={14} />
              Photo Gallery
            </a>
          )}
        </div>

        {/* Right: metadata */}
        <div className="space-y-4">
          {/* Classification badges — desktop */}
          <div className="hidden md:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Classification</p>
            <div className="flex flex-wrap gap-1.5">
              {project.level && <Badge variant="jci" className="text-xs px-2.5 py-1">{project.level}</Badge>}
              {project.pillar && <Badge variant="neutral" className="text-xs px-2.5 py-1">{project.pillar}</Badge>}
              {project.type && <Badge variant="neutral" className="text-xs px-2.5 py-1">{PROJECT_TYPE_LABELS[project.type] || project.type}</Badge>}
              {project.category && <Badge variant="neutral" className="text-xs px-2.5 py-1">{project.category}</Badge>}
              {!project.level && !project.pillar && !project.type && !project.category && <span className="text-xs text-slate-400">—</span>}
            </div>
          </div>

          {/* Schedule */}
          {(scheduleItems.length > 0 || project.priceMin != null || project.priceMax != null) && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Schedule</p>
              <div className={`grid gap-2 ${scheduleItems.length >= 3 ? 'grid-cols-3' : scheduleItems.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {scheduleItems.map(item => (
                  <div key={item.label} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">{item.label}</p>
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{item.date}</p>
                    {item.time && <p className="text-xs text-slate-500 mt-0.5">{item.time}</p>}
                  </div>
                ))}
              </div>
              {(project.priceMin != null || project.priceMax != null) && (
                <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                  <DollarSign size={13} className="text-jci-blue shrink-0" />
                  <div>
                    <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Price Range</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {project.priceMin != null && project.priceMax != null
                        ? `RM ${project.priceMin} - RM ${project.priceMax}`
                        : project.priceMin != null
                          ? `From RM ${project.priceMin}`
                          : `Up to RM ${project.priceMax}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* JCI Malaysia */}
          {(project.location || project.hostingLo || project.area || project.coHosting || project.roadmapId) && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">JCI Malaysia</p>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 space-y-1.5">
                {project.hostingLo && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-20 shrink-0 mt-0.5">Hosting LO</span>
                    <span className="text-sm text-slate-700">{project.hostingLo}</span>
                  </div>
                )}
                {project.area && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-20 shrink-0 mt-0.5">Area</span>
                    <span className="text-sm text-slate-700">{project.area}</span>
                  </div>
                )}
                {project.coHosting && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-20 shrink-0 mt-0.5">Co-Hosting</span>
                    <span className="text-sm text-slate-700">{project.coHosting}</span>
                  </div>
                )}
                {project.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={11} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700">{project.location}</span>
                  </div>
                )}
                {project.roadmapId && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-20 shrink-0 mt-0.5">Roadmap</span>
                    <a
                      href={project.roadmapUrl || `https://jcimalaysia.cc/roadmap/event-details-public.php?eventid=${project.roadmapId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-jci-blue hover:underline flex items-center gap-1"
                    >
                      #{project.roadmapId} <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {project.description && (() => {
            const lines = project.description!.split('\n');
            const isLong = lines.length > 3 || project.description!.length > 180;
            const preview = isLong && !descExpanded
              ? lines.slice(0, 3).join('\n').slice(0, 180) + '…'
              : project.description!;
            return (
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Info size={11} />About</p>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{preview}</p>
                {isLong && (
                  <button type="button" onClick={() => setDescExpanded(v => !v)}
                    className="mt-1.5 text-xs font-medium text-jci-blue hover:underline">
                    {descExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            );
          })()}

          {/* Objectives + Expected Impact */}
          {(project.objectives || project.expectedImpact) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {project.objectives && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Objectives</p>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{project.objectives}</p>
                </div>
              )}
              {project.expectedImpact && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Expected Impact</p>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{project.expectedImpact}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {drawer}
    </div>
  );
};
