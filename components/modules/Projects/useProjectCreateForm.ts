import { useCallback, useEffect, useState } from 'react';
import { Member, Project, ProjectCommitteeMember, ProjectLevel, ProjectPillar } from '../../../types';
import { fetchRoadmapEventDetails } from '../../../utils/roadmapUtils';

type ShowToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;

interface UseProjectCreateFormOptions {
  member: Member | null | undefined;
  createProject: (projectData: Omit<Project, 'id'>) => Promise<string | void>;
  showToast: ShowToast;
}

export const useProjectCreateForm = ({ member, createProject, showToast }: UseProjectCreateFormOptions) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [newRoadmapUrl, setNewRoadmapUrl] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [isFetchingPoster, setIsFetchingPoster] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLevel, setNewLevel] = useState<ProjectLevel | ''>('');
  const [newPillar, setNewPillar] = useState<ProjectPillar | ''>('');
  const [projectType, setProjectType] = useState<string>('');
  const [newCategory, setNewCategory] = useState('');
  const [newProposedDate, setNewProposedDate] = useState('');
  const [newEventStartDate, setNewEventStartDate] = useState('');
  const [newEventEndDate, setNewEventEndDate] = useState('');
  const [newEventStartTime, setNewEventStartTime] = useState('');
  const [newEventEndTime, setNewEventEndTime] = useState('');
  const [newPriceMin, setNewPriceMin] = useState('');
  const [newPriceMax, setNewPriceMax] = useState('');
  const [newGalleryUrl, setNewGalleryUrl] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setNewRoadmapUrl('');
    setNewLogoUrl('');
    setNewTitle('');
    setNewDescription('');
    setNewLevel('');
    setNewPillar('');
    setProjectType('');
    setNewCategory('');
    setNewProposedDate('');
    setNewEventStartDate('');
    setNewEventEndDate('');
    setNewEventStartTime('');
    setNewEventEndTime('');
    setNewPriceMin('');
    setNewPriceMax('');
    setNewGalleryUrl('');
  }, [isOpen]);

  const open = useCallback(() => {
    setStep(1);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setStep(1);
  }, []);

  const back = useCallback(() => {
    if (step === 1) {
      close();
      return;
    }
    setStep(1);
  }, [close, step]);

  const next = useCallback(() => {
    if (!newTitle.trim()) {
      showToast('Project title is required', 'error');
      return;
    }
    setStep(2);
  }, [newTitle, showToast]);

  const fetchPoster = useCallback(async () => {
    if (!newRoadmapUrl) {
      showToast('Please enter a Roadmap Event URL or ID', 'warning');
      return;
    }

    setIsFetchingPoster(true);
    try {
      const details = await fetchRoadmapEventDetails(newRoadmapUrl);
      setNewLogoUrl(details.logoUrl);
      if (details.title) setNewTitle(details.title);
      if (details.description) setNewDescription(details.description);
      if (details.level) setNewLevel(details.level);
      if (details.pillar) setNewPillar(details.pillar);
      if (details.type) setProjectType(details.type);
      if (details.category) setNewCategory(details.category);
      if (details.eventStartDate) {
        setNewEventStartDate(details.eventStartDate);
        setNewProposedDate(details.eventStartDate);
      }
      if (details.eventEndDate) setNewEventEndDate(details.eventEndDate);
      if (details.eventStartTime) setNewEventStartTime(details.eventStartTime);
      if (details.eventEndTime) setNewEventEndTime(details.eventEndTime);
      if (details.priceMin != null) setNewPriceMin(String(details.priceMin));
      if (details.priceMax != null) setNewPriceMax(String(details.priceMax));

      showToast('Successfully synchronized event details!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to sync event details', 'error');
    } finally {
      setIsFetchingPoster(false);
    }
  }, [newRoadmapUrl, showToast]);

  const submit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!member) {
      showToast('Please login to create projects', 'error');
      return;
    }

    if (!newLevel || !newPillar || !projectType || !newCategory) {
      showToast('Please fill in all required classification fields (Level, Pillar, Type, Category)', 'error');
      return;
    }

    if (newEventEndDate && newEventStartDate && newEventEndDate < newEventStartDate) {
      showToast('End date must be on or after start date', 'error');
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const defaultCommittee: ProjectCommitteeMember[] = [
        {
          role: 'Ex-Officio',
          memberId: '',
          tasks: [{ title: '', dueDate: '' }],
        },
        {
          role: 'Organising Chairperson',
          memberId: '',
          tasks: [{ title: '', dueDate: '' }],
        },
      ];

      await createProject({
        name: formData.get('title') as string,
        title: formData.get('title') as string,
        description: formData.get('description') as string || '',
        level: (formData.get('level') as any) || undefined,
        pillar: (formData.get('pillar') as any) || undefined,
        type: (formData.get('type') as any) || undefined,
        category: (formData.get('category') as string) || undefined,
        proposedDate: formData.get('proposedDate') as string,
        objectives: formData.get('objectives') as string,
        expectedImpact: formData.get('expectedImpact') as string || '',
        eventStartDate: (formData.get('eventStartDate') as string) || undefined,
        eventEndDate: (formData.get('eventEndDate') as string) || undefined,
        eventStartTime: (formData.get('eventStartTime') as string) || undefined,
        eventEndTime: (formData.get('eventEndTime') as string) || undefined,
        status: 'Planning',
        submittedBy: member.id,
        committee: defaultCommittee,
        logoUrl: newLogoUrl || undefined,
        roadmapUrl: newRoadmapUrl || undefined,
        galleryUrls: newGalleryUrl ? [newGalleryUrl] : undefined,
        priceMin: newPriceMin !== '' ? Number(newPriceMin) : undefined,
        priceMax: newPriceMax !== '' ? Number(newPriceMax) : undefined,
      });

      setIsOpen(false);
      form.reset();
      showToast('Project created successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create project', 'error');
    }
  }, [
    createProject,
    member,
    newCategory,
    newEventEndDate,
    newEventStartDate,
    newGalleryUrl,
    newLevel,
    newLogoUrl,
    newPillar,
    newPriceMax,
    newPriceMin,
    newRoadmapUrl,
    projectType,
    showToast,
  ]);

  return {
    drawerProps: {
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
      onClose: close,
      onBack: back,
      onNext: next,
      onSubmit: submit,
      onFetchPoster: fetchPoster,
      onTitleChange: setNewTitle,
      onDescriptionChange: setNewDescription,
      onLevelChange: setNewLevel,
      onPillarChange: setNewPillar,
      onProjectTypeChange: (value: string) => {
        setProjectType(value);
        setNewCategory('');
      },
      onCategoryChange: setNewCategory,
      onProposedDateChange: setNewProposedDate,
      onEventStartDateChange: setNewEventStartDate,
      onEventEndDateChange: setNewEventEndDate,
      onEventStartTimeChange: setNewEventStartTime,
      onEventEndTimeChange: setNewEventEndTime,
      onPriceMinChange: setNewPriceMin,
      onPriceMaxChange: setNewPriceMax,
      onRoadmapUrlChange: setNewRoadmapUrl,
      onLogoUrlChange: setNewLogoUrl,
      onGalleryUrlChange: setNewGalleryUrl,
    },
    open,
  };
};
