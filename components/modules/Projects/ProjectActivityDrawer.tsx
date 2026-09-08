import React, { useEffect, useState } from 'react';
import { Calendar, Check, Clock, DollarSign, Download, FileText, Globe, Image, MapPin, RefreshCw, Trash2 } from 'lucide-react';
import { Button, Drawer, useToast } from '../../ui/Common';
import { Input, Select, Textarea } from '../../ui/Form';
import { Project, ProjectLevel, ProjectPillar } from '../../../types';
import { PROJECT_CATEGORIES_BY_TYPE, PROJECT_LEVELS, PROJECT_PILLARS, PROJECT_TYPES, PROJECT_TYPE_LABELS } from '../../../config/constants';
import { fetchRoadmapEventDetails } from '../../../utils/roadmapUtils';

interface ProjectActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Receives collected form data; caller handles create vs update. */
  onSave: (data: Partial<Project>) => Promise<void>;
  /** If provided, a Delete button is shown in edit mode. */
  onDelete?: () => Promise<void>;
  /** Edit mode when supplied; create mode when absent. */
  project?: Project;
}

const STEPS: { s: 1 | 2; label: string }[] = [
  { s: 1, label: 'Basics & Media' },
  { s: 2, label: 'Classification & Schedule' },
];

export const ProjectActivityDrawer: React.FC<ProjectActivityDrawerProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  project,
}) => {
  const { showToast } = useToast();
  const isEdit = !!project;
  const [step, setStep] = useState<1 | 2>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingPoster, setIsFetchingPoster] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [roadmapUrl, setRoadmapUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [galleryUrl, setGalleryUrl] = useState('');
  const [level, setLevel] = useState<ProjectLevel | ''>('');
  const [pillar, setPillar] = useState<ProjectPillar | ''>('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [location, setLocation] = useState('');
  const [roadmapId, setRoadmapId] = useState('');
  const [hostingLo, setHostingLo] = useState('');
  const [area, setArea] = useState('');
  const [coHosting, setCoHosting] = useState('');

  // Reset / populate state whenever the drawer opens or the project changes
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setTitle(project?.title ?? project?.name ?? '');
    setDescription(project?.description ?? '');
    setRoadmapUrl(project?.roadmapUrl ?? '');
    setLogoUrl(project?.logoUrl ?? '');
    setGalleryUrl(project?.galleryUrls?.[0] ?? '');
    setLevel(project?.level ?? '');
    setPillar(project?.pillar ?? '');
    setType(project?.type ?? '');
    setCategory(project?.category ?? '');
    setEventStartDate(project?.eventStartDate ?? '');
    setEventEndDate(project?.eventEndDate ?? '');
    setEventStartTime(project?.eventStartTime ?? '');
    setEventEndTime(project?.eventEndTime ?? '');
    setPriceMin(project?.priceMin != null ? String(project.priceMin) : '');
    setPriceMax(project?.priceMax != null ? String(project.priceMax) : '');
    setLocation(project?.location ?? '');
    setRoadmapId(project?.roadmapId ?? '');
    setHostingLo(project?.hostingLo ?? '');
    setArea(project?.area ?? '');
    setCoHosting(project?.coHosting ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, project?.id]);

  // Auto-sync when a valid JCI Roadmap URL or bare event ID is pasted
  useEffect(() => {
    const isJciUrl =
      /jcimalaysia\.cc\/roadmap\/.*[?&]eventid=\d+/.test(roadmapUrl) ||
      /^\d{4,6}$/.test(roadmapUrl.trim());
    const savedUrl = project?.roadmapUrl ?? '';
    if (isJciUrl && !isFetchingPoster && roadmapUrl !== savedUrl) {
      handleFetchPoster();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmapUrl]);

  const handleFetchPoster = async () => {
    if (!roadmapUrl) { showToast('Please enter a Roadmap Event URL or ID', 'warning'); return; }
    setIsFetchingPoster(true);
    try {
      const details = await fetchRoadmapEventDetails(roadmapUrl);
      if (details.logoUrl) setLogoUrl(details.logoUrl);
      if (details.title) setTitle(details.title);
      if (details.description) setDescription(details.description);
      if (details.level) setLevel(details.level);
      if (details.pillar) setPillar(details.pillar);
      if (details.type) setType(details.type);
      if (details.category) setCategory(details.category);
      if (details.eventStartDate) setEventStartDate(details.eventStartDate);
      if (details.eventEndDate) setEventEndDate(details.eventEndDate);
      if (details.eventStartTime) setEventStartTime(details.eventStartTime);
      if (details.eventEndTime) setEventEndTime(details.eventEndTime);
      if (details.priceMin != null) setPriceMin(String(details.priceMin));
      if (details.priceMax != null) setPriceMax(String(details.priceMax));
      showToast('Successfully synchronized event details!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to sync event details', 'error');
    } finally {
      setIsFetchingPoster(false);
    }
  };

  const handleClose = () => { onClose(); setStep(1); };

  const handleNext = () => {
    if (!title.trim()) { showToast('Title is required', 'error'); return; }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step === 1) { handleNext(); return; }

    if (!level || !pillar || !type || !category) {
      showToast('Please fill in Level, Pillar, Type, and Category', 'error');
      return;
    }
    if (eventEndDate && eventStartDate && eventEndDate < eventStartDate) {
      showToast('End date must be on or after start date', 'error');
      return;
    }

    const formData = new FormData(e.currentTarget);
    setIsSaving(true);
    try {
      await onSave({
        title,
        name: title,
        description: description || '',
        logoUrl: logoUrl || '',
        roadmapUrl: roadmapUrl || '',
        galleryUrls: galleryUrl ? [galleryUrl] : [],
        level: (formData.get('level') as ProjectLevel) || undefined,
        pillar: (formData.get('pillar') as ProjectPillar) || undefined,
        type: (formData.get('type') as any) || undefined,
        category: (formData.get('category') as string) || undefined,
        proposedDate: eventStartDate || '',
        eventStartDate: eventStartDate || undefined,
        eventEndDate: eventEndDate || undefined,
        eventStartTime: eventStartTime || undefined,
        eventEndTime: eventEndTime || undefined,
        priceMin: priceMin !== '' ? Number(priceMin) : undefined,
        priceMax: priceMax !== '' ? Number(priceMax) : undefined,
        location: location || undefined,
        roadmapId: roadmapId || undefined,
        hostingLo: hostingLo || undefined,
        area: area || undefined,
        coHosting: coHosting || undefined,
      });
      handleClose();
    } catch {
      // error toast is the caller's responsibility
    } finally {
      setIsSaving(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={
        isEdit
          ? (step === 1 ? 'Edit Activity Plan – Basics & Media' : 'Edit Activity Plan – Classification & Schedule')
          : (step === 1 ? 'New Activity – Basics & Media' : 'New Activity – Classification & Schedule')
      }
      position="bottom"
      size="xl"
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button" onClick={step === 1 ? handleClose : () => setStep(1)}>
              {step === 1 ? 'Cancel' : '← Back'}
            </Button>
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={async () => { await onDelete(); handleClose(); }}
                className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
              >
                <Trash2 size={12} className="inline mr-1" />Delete
              </button>
            )}
          </div>
          {step === 1 ? (
            <Button type="button" onClick={handleNext}>Next →</Button>
          ) : (
            <Button type="submit" form="activity-drawer-form" disabled={isSaving}>
              {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Project'}
            </Button>
          )}
        </div>
      }
    >
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-4">
        {STEPS.map(({ s, label }, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
              s < step ? 'bg-jci-blue/10 text-jci-blue' :
              s === step ? 'bg-jci-blue text-white shadow-sm' :
              'bg-slate-100 text-slate-400'
            }`}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-white/30">
                {s < step ? '✓' : s}
              </span>
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{s === 1 ? 'Media' : 'Details'}</span>
            </div>
            {i === 0 && <div className={`flex-1 h-px max-w-[24px] ${step > 1 ? 'bg-jci-blue' : 'bg-slate-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      <form id="activity-drawer-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1: Basics & Media */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-3">Project Info</p>
              <div className="space-y-3">
                <Input label="Title" placeholder="e.g. Summer Leadership Summit"
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  icon={<FileText size={16} />} required />
                <Textarea label="Description" placeholder="Brief description of the activity plan..."
                  value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
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
                        <Input label="" placeholder="Roadmap URL or Event ID (e.g. 6274)"
                          value={roadmapUrl} onChange={(e) => setRoadmapUrl(e.target.value)} icon={<Globe size={16} />} />
                      </div>
                      <Button type="button" variant="outline" onClick={handleFetchPoster} disabled={isFetchingPoster}
                        className="h-10 shrink-0 flex items-center gap-1.5 border-jci-blue text-jci-blue hover:bg-sky-50 mb-px">
                        {isFetchingPoster ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                        <span className="text-xs">{isFetchingPoster ? 'Syncing' : 'Sync'}</span>
                      </Button>
                    </div>
                  </div>
                  <Input label="Poster / Logo URL" placeholder="https://example.com/poster.png"
                    value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} icon={<Image size={16} />} />
                  {logoUrl && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex justify-center p-2">
                      <img src={logoUrl} alt="Poster preview" className="max-h-36 object-contain rounded-lg" />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold text-slate-500">Activity Photo Gallery</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Paste a Google Drive <strong>folder</strong> link shared as &ldquo;Anyone with the link&rdquo;</p>
                  <Input label="" placeholder="https://drive.google.com/drive/folders/"
                    value={galleryUrl} onChange={(e) => setGalleryUrl(e.target.value)} />
                  {galleryUrl && (
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
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">JCI Malaysia</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input label="Roadmap ID" placeholder="e.g. 7780"
                  value={roadmapId} onChange={(e) => setRoadmapId(e.target.value)} />
                <Input label="Hosting LO" placeholder="e.g. JCI KL"
                  value={hostingLo} onChange={(e) => setHostingLo(e.target.value)} />
                <Input label="Area" placeholder="e.g. Kuala Lumpur"
                  value={area} onChange={(e) => setArea(e.target.value)} />
                <Input label="Co-Hosting" placeholder="e.g. JCI PJ, JCI Ampang"
                  value={coHosting} onChange={(e) => setCoHosting(e.target.value)} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Classification</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Select name="level" label="Level" required value={level} onChange={(e) => setLevel(e.target.value as ProjectLevel | '')}
                  options={[{ label: '— Select —', value: '' }, ...PROJECT_LEVELS.map(l => ({ label: l, value: l }))]} />
                <Select name="pillar" label="Pillar" required value={pillar} onChange={(e) => setPillar(e.target.value as ProjectPillar | '')}
                  options={[{ label: '— Select —', value: '' }, ...PROJECT_PILLARS.map(p => ({ label: p, value: p }))]} />
                <Select name="type" label="Type" required value={type}
                  options={[{ label: '— Select —', value: '' }, ...PROJECT_TYPES.map(c => ({ label: PROJECT_TYPE_LABELS[c] || c, value: c }))]}
                  onChange={(e) => { setType(e.target.value); setCategory(''); }} />
                <Select name="category" label="Category" required value={category} onChange={(e) => setCategory(e.target.value)}
                  options={[{ label: '— Select —', value: '' }, ...(type ? (PROJECT_CATEGORIES_BY_TYPE[type] ?? []) : []).map(t => ({ label: t, value: t }))]} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Schedule</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input label="Start Date" type="date" value={eventStartDate}
                  onChange={(e) => setEventStartDate(e.target.value)} icon={<Calendar size={16} />} required
                  min={!isEdit ? today : undefined} />
                <Input label="End Date" type="date" value={eventEndDate}
                  onChange={(e) => setEventEndDate(e.target.value)} icon={<Calendar size={16} />}
                  min={!isEdit ? (eventStartDate || today) : undefined} />
                <div />
                <Input label="Start Time" type="time" value={eventStartTime}
                  onChange={(e) => setEventStartTime(e.target.value)} icon={<Clock size={16} />} />
                <Input label="End Time" type="time" value={eventEndTime}
                  onChange={(e) => setEventEndTime(e.target.value)} icon={<Clock size={16} />} />
                <Input label="Min Price (RM)" type="number" min="0" placeholder="0"
                  value={priceMin} onChange={(e) => setPriceMin(e.target.value)} icon={<DollarSign size={16} />} />
                <Input label="Max Price (RM)" type="number" min="0" placeholder="e.g. 150"
                  value={priceMax} onChange={(e) => setPriceMax(e.target.value)} icon={<DollarSign size={16} />} />
              </div>
              <div className="mt-2">
                <Input label="Location" placeholder="e.g. KLCC Convention Centre"
                  value={location} onChange={(e) => setLocation(e.target.value)} icon={<MapPin size={16} />} />
              </div>
            </div>
          </div>
        )}
      </form>
    </Drawer>
  );
};
