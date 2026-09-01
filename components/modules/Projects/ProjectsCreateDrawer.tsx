import React from 'react';
import { Calendar, Check, Clock, DollarSign, Download, FileText, Globe, Image, RefreshCw } from 'lucide-react';
import { Button, Drawer } from '../../ui/Common';
import { Input, Select, Textarea } from '../../ui/Form';
import { PROJECT_CATEGORIES_BY_TYPE, PROJECT_LEVELS, PROJECT_PILLARS, PROJECT_TYPES, PROJECT_TYPE_LABELS } from '../../../config/constants';
import type { ProjectLevel, ProjectPillar } from '../../../types';

interface ProjectsCreateDrawerProps {
  isOpen: boolean;
  step: 1 | 2;
  newTitle: string;
  newDescription: string;
  newLevel: ProjectLevel | '';
  newPillar: ProjectPillar | '';
  projectType: string;
  newCategory: string;
  newProposedDate: string;
  newEventStartDate: string;
  newEventEndDate: string;
  newEventStartTime: string;
  newEventEndTime: string;
  newPriceMin: string;
  newPriceMax: string;
  newRoadmapUrl: string;
  newLogoUrl: string;
  newGalleryUrl: string;
  isFetchingPoster: boolean;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onFetchPoster: () => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onLevelChange: (value: ProjectLevel | '') => void;
  onPillarChange: (value: ProjectPillar | '') => void;
  onProjectTypeChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onProposedDateChange: (value: string) => void;
  onEventStartDateChange: (value: string) => void;
  onEventEndDateChange: (value: string) => void;
  onEventStartTimeChange: (value: string) => void;
  onEventEndTimeChange: (value: string) => void;
  onPriceMinChange: (value: string) => void;
  onPriceMaxChange: (value: string) => void;
  onRoadmapUrlChange: (value: string) => void;
  onLogoUrlChange: (value: string) => void;
  onGalleryUrlChange: (value: string) => void;
}

const CREATE_STEPS: { s: 1 | 2; label: string }[] = [
  { s: 1, label: 'Basics & Media' },
  { s: 2, label: 'Classification & Schedule' },
];

export const ProjectsCreateDrawer: React.FC<ProjectsCreateDrawerProps> = ({
  isOpen,
  step,
  newTitle,
  newDescription,
  newLevel,
  newPillar,
  projectType,
  newCategory,
  newProposedDate,
  newEventStartDate,
  newEventEndDate,
  newEventStartTime,
  newEventEndTime,
  newPriceMin,
  newPriceMax,
  newRoadmapUrl,
  newLogoUrl,
  newGalleryUrl,
  isFetchingPoster,
  onClose,
  onBack,
  onNext,
  onSubmit,
  onFetchPoster,
  onTitleChange,
  onDescriptionChange,
  onLevelChange,
  onPillarChange,
  onProjectTypeChange,
  onCategoryChange,
  onProposedDateChange,
  onEventStartDateChange,
  onEventEndDateChange,
  onEventStartTimeChange,
  onEventEndTimeChange,
  onPriceMinChange,
  onPriceMaxChange,
  onRoadmapUrlChange,
  onLogoUrlChange,
  onGalleryUrlChange,
}) => {
  const today = new Date().toISOString().split('T')[0];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={step === 1 ? 'New Activity " Basics & Media' : 'New Activity " Classification & Schedule'}
      position="bottom"
      size="xl"
      footer={
        <div className="flex items-center justify-between">
          <Button variant="ghost" type="button" onClick={onBack}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step === 1 ? (
            <Button key="next" type="button" onClick={onNext}>Next</Button>
          ) : (
            <Button key="create" type="submit" form="create-project-form">Create Project</Button>
          )}
        </div>
      }
    >
      <div className="flex items-center gap-2 mb-4">
        {CREATE_STEPS.map(({ s, label }, index) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${s < step ? 'bg-jci-blue/10 text-jci-blue' :
              s === step ? 'bg-jci-blue text-white shadow-sm' :
                'bg-slate-100 text-slate-400'
              }`}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-white/30">
                {s < step ? '✓' : s}
              </span>
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{s === 1 ? 'Media' : 'Details'}</span>
            </div>
            {index === 0 && <div className={`flex-1 h-px max-w-[24px] ${step > 1 ? 'bg-jci-blue' : 'bg-slate-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      <form id="create-project-form" onSubmit={onSubmit} className="space-y-4">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-3">Project Info</p>
              <div className="space-y-3">
                <Input name="title" label="Title *" placeholder="e.g. Summer Leadership Summit"
                  value={newTitle} onChange={(event) => onTitleChange(event.target.value)}
                  icon={<FileText size={16} />} required />
                <Textarea name="description" label="Description" placeholder="Brief description of the project..."
                  value={newDescription} onChange={(event) => onDescriptionChange(event.target.value)} rows={3} />
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
                          value={newRoadmapUrl} onChange={(event) => onRoadmapUrlChange(event.target.value)} icon={<Globe size={16} />} />
                      </div>
                      <Button type="button" variant="outline" onClick={onFetchPoster} disabled={isFetchingPoster}
                        className="h-10 shrink-0 flex items-center gap-1.5 border-jci-blue text-jci-blue hover:bg-sky-50 mb-px">
                        {isFetchingPoster ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                        <span className="text-xs">{isFetchingPoster ? 'Syncing' : 'Sync'}</span>
                      </Button>
                    </div>
                  </div>
                  <Input name="logoUrl" label="Poster / Logo URL" placeholder="https://example.com/poster.png"
                    value={newLogoUrl} onChange={(event) => onLogoUrlChange(event.target.value)} icon={<Image size={16} />} />
                  {newLogoUrl && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex justify-center p-2">
                      <img src={newLogoUrl} alt="Preview" className="max-h-36 object-contain rounded-lg" />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold text-slate-500">Activity Photo Gallery</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Paste a Google Drive <strong>folder</strong> link shared as "Anyone with the link"</p>
                  <Input label="" placeholder="https://drive.google.com/drive/folders/"
                    value={newGalleryUrl} onChange={(event) => onGalleryUrlChange(event.target.value)} />
                  {newGalleryUrl && (
                    <p className="text-[11px] text-green-700 font-medium flex items-center gap-1">
                      <Check size={11} />Folder linked
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Classification</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Select name="level" label="Level *" required value={newLevel}
                  onChange={(event) => onLevelChange(event.target.value as ProjectLevel | '')}
                  options={[{ label: '" Select "', value: '' }, ...PROJECT_LEVELS.map(level => ({ label: level, value: level }))]} />
                <Select name="pillar" label="Pillar *" required value={newPillar}
                  onChange={(event) => onPillarChange(event.target.value as ProjectPillar | '')}
                  options={[{ label: '" Select "', value: '' }, ...PROJECT_PILLARS.map(pillar => ({ label: pillar, value: pillar }))]} />
                <Select name="type" label="Type *" required value={projectType}
                  onChange={(event) => onProjectTypeChange(event.target.value)}
                  options={[{ label: '" Select "', value: '' }, ...PROJECT_TYPES.map(type => ({ label: PROJECT_TYPE_LABELS[type] || type, value: type }))]} />
                <Select name="category" label="Category *" required value={newCategory}
                  onChange={(event) => onCategoryChange(event.target.value)}
                  options={[{ label: '" Select "', value: '' }, ...(projectType ? (PROJECT_CATEGORIES_BY_TYPE[projectType] ?? []) : []).map(type => ({ label: type, value: type }))]} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Schedule</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input name="proposedDate" label="Proposed *" type="date" value={newProposedDate}
                  onChange={(event) => onProposedDateChange(event.target.value)} icon={<Calendar size={16} />} required min={today} />
                <Input name="eventStartDate" label="Start Date *" type="date" value={newEventStartDate}
                  onChange={(event) => onEventStartDateChange(event.target.value)} icon={<Calendar size={16} />} required min={today} />
                <Input name="eventEndDate" label="End Date" type="date" value={newEventEndDate}
                  onChange={(event) => onEventEndDateChange(event.target.value)} icon={<Calendar size={16} />} min={newEventStartDate || today} />
                <div />
                <Input name="eventStartTime" label="Start Time" type="time" value={newEventStartTime}
                  onChange={(event) => onEventStartTimeChange(event.target.value)} icon={<Clock size={16} />} />
                <Input name="eventEndTime" label="End Time" type="time" value={newEventEndTime}
                  onChange={(event) => onEventEndTimeChange(event.target.value)} icon={<Clock size={16} />} />
                <Input name="priceMin" label="Min Price (RM)" type="number" min="0" placeholder="0"
                  value={newPriceMin} onChange={(event) => onPriceMinChange(event.target.value)} icon={<DollarSign size={16} />} />
                <Input name="priceMax" label="Max Price (RM)" type="number" min="0" placeholder="e.g. 150"
                  value={newPriceMax} onChange={(event) => onPriceMaxChange(event.target.value)} icon={<DollarSign size={16} />} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Goals</p>
              <div className="md:grid md:grid-cols-2 md:gap-3 space-y-2 md:space-y-0">
                <Textarea name="objectives" label="Objectives & Goals" placeholder="Goals and expected community impact..." rows={2} />
                <Textarea name="expectedImpact" label="Expected Impact" placeholder="Expected outcomes and impact..." rows={2} />
              </div>
            </div>
          </div>
        )}
      </form>
    </Drawer>
  );
};
