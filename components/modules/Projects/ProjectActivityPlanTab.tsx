import React, { useState, useEffect } from 'react';
import { FileText, Edit, RefreshCw, Download, Globe, Image, ExternalLink, Plus, Trash2, Clock, DollarSign, Check, Calendar, Info, MapPin } from 'lucide-react';
import { Button, Badge, Drawer, useToast } from '../../ui/Common';
import { Input, Select, Textarea } from '../../ui/Form';
import { Project, ProjectLevel, ProjectPillar, ProjectType } from '../../../types';
import { PROJECT_LEVELS, PROJECT_PILLARS, PROJECT_TYPES, PROJECT_CATEGORIES_BY_TYPE, PROJECT_TYPE_LABELS } from '../../../config/constants';
import { formatDate, toDate } from '../../../utils/dateUtils';
import { fetchRoadmapEventDetails } from '../../../utils/roadmapUtils';

// Project Activity Plan Tab Component (inline edit, no modal)
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
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editStep, setEditStep] = useState<1 | 2>(1);
  const [formType, setFormType] = useState<string>(project.type || '');
  const [isSaving, setIsSaving] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [editRoadmapUrl, setEditRoadmapUrl] = useState(project.roadmapUrl || '');
  const [editLogoUrl, setEditLogoUrl] = useState(project.logoUrl || '');
  const [isFetchingPoster, setIsFetchingPoster] = useState(false);

  // States for Edit Project Form
  const [editTitle, setEditTitle] = useState(project.title ?? project.name ?? '');
  const [editDescription, setEditDescription] = useState(project.description || '');
  const [editLevel, setEditLevel] = useState<ProjectLevel | ''>(project.level || '');
  const [editPillar, setEditPillar] = useState<ProjectPillar | ''>(project.pillar || '');
  const [editCategory, setEditCategory] = useState(project.category || '');
  const [editProposedDate, setEditProposedDate] = useState(project.proposedDate || '');
  const [editEventStartDate, setEditEventStartDate] = useState(project.eventStartDate || '');
  const [editEventEndDate, setEditEventEndDate] = useState(project.eventEndDate || '');
  const [editEventStartTime, setEditEventStartTime] = useState(project.eventStartTime || '');
  const [editEventEndTime, setEditEventEndTime] = useState(project.eventEndTime || '');
  const [editPriceMin, setEditPriceMin] = useState(project.priceMin != null ? String(project.priceMin) : '');
  const [editPriceMax, setEditPriceMax] = useState(project.priceMax != null ? String(project.priceMax) : '');
  const [editLocation, setEditLocation] = useState(project.location || '');
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    setEditRoadmapUrl(project.roadmapUrl || '');
    setEditLogoUrl(project.logoUrl || '');
    setEditTitle(project.title ?? project.name ?? '');
    setEditDescription(project.description || '');
    setEditLevel(project.level || '');
    setEditPillar(project.pillar || '');
    setFormType(project.type || '');
    setEditCategory(project.category || '');
    setEditProposedDate(project.proposedDate || '');
    setEditEventStartDate(project.eventStartDate || '');
    setEditEventEndDate(project.eventEndDate || '');
    setEditEventStartTime(project.eventStartTime || '');
    setEditEventEndTime(project.eventEndTime || '');
    setEditPriceMin(project.priceMin != null ? String(project.priceMin) : '');
    setEditPriceMax(project.priceMax != null ? String(project.priceMax) : '');
    // Reset edit mode when project changes so stepper always starts at step 1
    setIsEditing(false);
    setEditStep(1);
  }, [project.id]);

  const handleFetchPosterForEdit = async () => {
    if (!editRoadmapUrl) {
      showToast('Please enter a Roadmap Event URL or ID', 'warning');
      return;
    }
    setIsFetchingPoster(true);
    try {
      const details = await fetchRoadmapEventDetails(editRoadmapUrl);
      setEditLogoUrl(details.logoUrl);
      if (details.title) setEditTitle(details.title);
      if (details.description) setEditDescription(details.description);
      if (details.level) setEditLevel(details.level);
      if (details.pillar) setEditPillar(details.pillar);
      if (details.type) {
        setFormType(details.type);
      }
      if (details.category) setEditCategory(details.category);
      if (details.eventStartDate) {
        setEditEventStartDate(details.eventStartDate);
        setEditProposedDate(details.eventStartDate);
      }
      if (details.eventEndDate) setEditEventEndDate(details.eventEndDate);
      if (details.eventStartTime) setEditEventStartTime(details.eventStartTime);
      if (details.eventEndTime) setEditEventEndTime(details.eventEndTime);
      if (details.priceMin != null) setEditPriceMin(String(details.priceMin));
      if (details.priceMax != null) setEditPriceMax(String(details.priceMax));

      showToast('Successfully synchronized event details!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to sync event details', 'error');
    } finally {
      setIsFetchingPoster(false);
    }
  };

  // Auto-sync when a valid JCI Roadmap URL is pasted (only if different from saved value)
  useEffect(() => {
    const isJciRoadmapUrl = /jcimalaysia\.cc\/roadmap\/.*[?&]eventid=\d+/.test(editRoadmapUrl)
      || /^\d{4,6}$/.test(editRoadmapUrl.trim());
    // Skip if the URL hasn't changed from what's already saved — avoids firing on mount/StrictMode double-run
    if (isJciRoadmapUrl && !isFetchingPoster && editRoadmapUrl !== (project.roadmapUrl || '')) {
      handleFetchPosterForEdit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRoadmapUrl]);

  useEffect(() => {
    const urls = project.galleryUrls || [];
    setGalleryPhotos(urls);
    setNewPhotoUrl(urls[0] || '');
  }, [project.galleryUrls]);

  const hasPlanFields =
    project.proposedDate ||
    project.proposedBudget != null ||
    project.objectives ||
    project.eventStartDate ||
    project.eventEndDate ||
    project.logoUrl ||
    (project.galleryUrls && project.galleryUrls.length > 0);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Guard: if Enter pressed on step 1, advance instead of saving
    if (editStep === 1) {
      if (!editTitle.trim()) { showToast('Title is required', 'error'); return; }
      setEditStep(2);
      return;
    }
    setIsSaving(true);
    try {
      const formData = new FormData(e.currentTarget);
      await onSave({
        // Step 1 fields " use state because those inputs are unmounted on step 2
        title: editTitle,
        name: editTitle,
        description: editDescription || '',
        logoUrl: editLogoUrl || '',
        roadmapUrl: editRoadmapUrl || '',
        galleryUrls: galleryPhotos,
        // Step 2 fields " inputs are mounted at submit time, formData is fine
        level: (formData.get('level') as any) || undefined,
        pillar: (formData.get('pillar') as any) || undefined,
        type: (formData.get('type') as any) || undefined,
        category: (formData.get('category') as string) || undefined,
        proposedDate: editProposedDate || '',
        objectives: (formData.get('objectives') as string) || '',
        expectedImpact: (formData.get('expectedImpact') as string) || '',
        eventStartDate: editEventStartDate || undefined,
        eventEndDate: editEventEndDate || undefined,
        eventStartTime: editEventStartTime || undefined,
        eventEndTime: editEventEndTime || undefined,
        priceMin: editPriceMin !== '' ? Number(editPriceMin) : undefined,
        priceMax: editPriceMax !== '' ? Number(editPriceMax) : undefined,
        location: editLocation || undefined,
      });
      setIsEditing(false);
      setEditStep(1);
    } catch (err) {
      // Error handling is done by caller via toast
    } finally {
      setIsSaving(false);
    }
  };

  // Edit form " bottom drawer (rendered alongside view/empty state)
  const STEPS: { s: 1 | 2; label: string }[] = [
    { s: 1, label: 'Basics & Media' },
    { s: 2, label: 'Classification & Schedule' },
  ];

  const editDrawer = (
    <Drawer
      isOpen={isEditing}
      onClose={() => { setIsEditing(false); setEditStep(1); }}
      title={editStep === 1 ? 'Edit Activity Plan " Basics & Media' : 'Edit Activity Plan " Classification & Schedule'}
      position="bottom"
      size="xl"
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button" onClick={() => {
              if (editStep === 1) { setIsEditing(false); setEditStep(1); }
              else setEditStep(1);
            }}>
              {editStep === 1 ? 'Cancel' : '← Back'}
            </Button>
            <button
              type="button"
              onClick={async () => { await onDelete(); setIsEditing(false); }}
              className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} className="inline mr-1" />Delete
            </button>
          </div>
          {editStep === 1 ? (
            <Button key="next" type="button" onClick={() => {
              if (!editTitle.trim()) { showToast('Title is required', 'error'); return; }
              setEditStep(2);
            }}>Next →</Button>
          ) : (
            <Button key="save" type="submit" form="plan-edit-form" disabled={isSaving}>{isSaving ? 'Saving' : 'Save Changes'}</Button>
          )}
        </div>
      }
    >
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-4">
        {STEPS.map(({ s, label }, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${s < editStep ? 'bg-jci-blue/10 text-jci-blue' :
              s === editStep ? 'bg-jci-blue text-white shadow-sm' :
                'bg-slate-100 text-slate-400'
              }`}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-white/30">
                {s < editStep ? '✓' : s}
              </span>
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{s === 1 ? 'Media' : 'Details'}</span>
            </div>
            {i === 0 && <div className={`flex-1 h-px max-w-[24px] ${editStep > 1 ? 'bg-jci-blue' : 'bg-slate-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      <form id="plan-edit-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1: Basics & Media */}
        {editStep === 1 && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-3">Project Info</p>
              <div className="space-y-3">
                <Input name="title" label="Title *" placeholder="e.g. Summer Leadership Summit"
                  value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  icon={<FileText size={16} />} required />
                <Textarea name="description" label="Description" placeholder="Brief description of the activity plan..."
                  value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-3">Media</p>
              <div className="md:grid md:grid-cols-2 md:gap-4 space-y-3 md:space-y-0">
                <div className="space-y-2">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 mb-1.5">JCI Roadmap Sync</p>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Input name="roadmapUrl" label="" placeholder="Roadmap URL or Event ID (e.g. 6274)"
                          value={editRoadmapUrl} onChange={(e) => setEditRoadmapUrl(e.target.value)} icon={<Globe size={16} />} />
                      </div>
                      <Button type="button" variant="outline" onClick={handleFetchPosterForEdit} disabled={isFetchingPoster}
                        className="h-10 shrink-0 flex items-center gap-1.5 border-jci-blue text-jci-blue hover:bg-sky-50 mb-px">
                        {isFetchingPoster ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                        <span className="text-xs">{isFetchingPoster ? 'Syncing' : 'Sync'}</span>
                      </Button>
                    </div>
                  </div>
                  <Input name="logoUrl" label="Poster / Logo URL" placeholder="https://example.com/poster.png"
                    value={editLogoUrl} onChange={(e) => setEditLogoUrl(e.target.value)} icon={<Image size={16} />} />
                  {editLogoUrl && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex justify-center p-2">
                      <img src={editLogoUrl} alt="Poster preview" className="max-h-36 object-contain rounded-lg" />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold text-slate-500">Activity Photo Gallery</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Paste a Google Drive <strong>folder</strong> link shared as "Anyone with the link"</p>
                  <Input label="" placeholder="https://drive.google.com/drive/folders/"
                    value={newPhotoUrl} onChange={(e) => {
                      setNewPhotoUrl(e.target.value);
                      setGalleryPhotos(e.target.value.trim() ? [e.target.value.trim()] : []);
                    }} />
                  {galleryPhotos.length > 0 && (
                    <p className="text-[11px] text-green-700 font-medium flex items-center gap-1">
                      <Check size={11} />Folder linked
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Classification & Schedule */}
        {editStep === 2 && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Classification</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Select name="level" label="Level *" required value={editLevel} onChange={(e) => setEditLevel(e.target.value as any)}
                  options={[{ label: '— Select —', value: '' }, ...PROJECT_LEVELS.map(l => ({ label: l, value: l }))]} />
                <Select name="pillar" label="Pillar *" required value={editPillar} onChange={(e) => setEditPillar(e.target.value as any)}
                  options={[{ label: '— Select —', value: '' }, ...PROJECT_PILLARS.map(p => ({ label: p, value: p }))]} />
                <Select name="type" label="Type *" required value={formType}
                  options={[{ label: '— Select —', value: '' }, ...PROJECT_TYPES.map(c => ({ label: PROJECT_TYPE_LABELS[c] || c, value: c }))]}
                  onChange={(e) => { setFormType(e.target.value); setEditCategory(''); }} />
                <Select name="category" label="Category *" required value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
                  options={[{ label: '— Select —', value: '' }, ...(formType ? (PROJECT_CATEGORIES_BY_TYPE[formType] ?? []) : []).map(t => ({ label: t, value: t }))]} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Schedule</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input name="proposedDate" label="Proposed *" type="date" value={editProposedDate}
                  onChange={(e) => setEditProposedDate(e.target.value)} icon={<Calendar size={16} />} required />
                <Input name="eventStartDate" label="Start Date *" type="date" value={editEventStartDate}
                  onChange={(e) => setEditEventStartDate(e.target.value)} icon={<Calendar size={16} />} required />
                <Input name="eventEndDate" label="End Date" type="date" value={editEventEndDate}
                  onChange={(e) => setEditEventEndDate(e.target.value)} icon={<Calendar size={16} />} />
                <div />
                <Input name="eventStartTime" label="Start Time" type="time" value={editEventStartTime}
                  onChange={(e) => setEditEventStartTime(e.target.value)} icon={<Clock size={16} />} />
                <Input name="eventEndTime" label="End Time" type="time" value={editEventEndTime}
                  onChange={(e) => setEditEventEndTime(e.target.value)} icon={<Clock size={16} />} />
                <Input name="priceMin" label="Min Price (RM)" type="number" min="0" placeholder="0"
                  value={editPriceMin} onChange={(e) => setEditPriceMin(e.target.value)} icon={<DollarSign size={16} />} />
                <Input name="priceMax" label="Max Price (RM)" type="number" min="0" placeholder="e.g. 150"
                  value={editPriceMax} onChange={(e) => setEditPriceMax(e.target.value)} icon={<DollarSign size={16} />} />
              </div>
              <div className="mt-2">
                <Input name="location" label="Location" placeholder="e.g. KLCC Convention Centre"
                  value={editLocation} onChange={(e) => setEditLocation(e.target.value)} icon={<MapPin size={16} />} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Goals</p>
              <div className="md:grid md:grid-cols-2 md:gap-3 space-y-2 md:space-y-0">
                <Textarea name="objectives" label="Objectives & Goals" placeholder="Goals and expected community impact..."
                  defaultValue={project.objectives} rows={2} />
                <Textarea name="expectedImpact" label="Expected Impact" placeholder="Expected outcomes and impact..."
                  defaultValue={project.expectedImpact} rows={2} />
              </div>
            </div>
          </div>
        )}
      </form>
    </Drawer>
  );

  // Empty state (no plan data yet)
  if (!hasPlanFields) {
    return (
      <>
        <div className="text-center py-12">
          <FileText className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-500 mb-4">No activity plan data found on this project</p>
          <Button onClick={() => { setIsEditing(true); setEditStep(1); }}>
            <Plus size={16} className="mr-2" />
            Create Activity Plan
          </Button>
        </div>
        {editDrawer}
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
      {/* Action bar */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => { setIsEditing(true); setEditStep(1); }}>
          <Edit size={14} className="mr-1.5" />Edit
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Trash2 size={14} className="mr-1.5" />Delete
        </Button>
      </div>

      {/* Classification badges " visible on mobile above poster */}
      <div className="flex flex-wrap gap-1.5 md:hidden">
        {project.level && <Badge variant="jci" className="text-xs px-2.5 py-1">{project.level}</Badge>}
        {project.pillar && <Badge variant="neutral" className="text-xs px-2.5 py-1">{project.pillar}</Badge>}
        {project.type && <Badge variant="neutral" className="text-xs px-2.5 py-1">{PROJECT_TYPE_LABELS[project.type] || project.type}</Badge>}
        {project.category && <Badge variant="neutral" className="text-xs px-2.5 py-1">{project.category}</Badge>}
      </div>

      {/* 2-col on desktop, single col on mobile */}
      <div className="md:grid md:grid-cols-[240px_1fr] md:gap-5">
        {/* Left: poster + gallery */}
        <div className="space-y-3 mb-4 md:mb-0">
          {project.logoUrl ? (
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 aspect-[4/3] md:aspect-[3/4] w-full shadow-sm">
              <img src={project.logoUrl} alt="Poster" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-[4/3] md:aspect-[3/4] w-full flex flex-col items-center justify-center gap-2 text-slate-300">
              <Image size={32} />
              <span className="text-xs font-semibold">No poster</span>
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

        {/* Right: metadata + info */}
        <div className="space-y-4">
          {/* Classification badges " desktop only */}
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

          {/* Schedule " compact grid */}
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
      {editDrawer}
    </div>
  );
};
