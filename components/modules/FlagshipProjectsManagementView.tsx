import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Edit, Trash2, Image as ImageIcon, Link as LinkIcon, Percent, Users, Check, Upload, Folder } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, ProgressBar } from '../ui/Common';
import { Input, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { FlagshipProjectsService } from '../../services/flagshipProjectsService';
import { FlagshipProject } from '../../types';
import { uploadToCloudinary, deleteFromCloudinary } from '../../services/cloudinaryService';
import imageCompression from 'browser-image-compression';

const UNSDG_GOALS = Array.from({ length: 17 }, (_, i) => {
  const goalNum = String(i + 1).padStart(2, '0');
  return {
    id: `Goal ${goalNum}`,
    image: `/UNSDG/Goal ${goalNum}.png`,
    title: `Goal ${goalNum}`
  };
});

export const FlagshipProjectsManagementView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const [projects, setProjects] = useState<FlagshipProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<FlagshipProject | null>(null);

  // Local state for photo gallery and logo in the modals
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [galleryByYear, setGalleryByYear] = useState<Record<string, string[]>>({});
  const [selectedUploadYear, setSelectedUploadYear] = useState<string>(new Date().getFullYear().toString());
  const [customUploadYear, setCustomUploadYear] = useState<string>('');
  const [selectedUploadVenue, setSelectedUploadVenue] = useState<string>('General');
  const [customUploadVenue, setCustomUploadVenue] = useState<string>('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);
  const [galleryUploadProgress, setGalleryUploadProgress] = useState(0);
  const [selectedPhotos, setSelectedPhotos] = useState<Array<{ folder: string, url: string }>>([]);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [selectedSdgs, setSelectedSdgs] = useState<string[]>([]);
  const [pendingDeletePhotos, setPendingDeletePhotos] = useState<string[]>([]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await FlagshipProjectsService.getAllProjects();
      setProjects(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch flagship projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Sync gallery photos and logo state when editing project changes
  useEffect(() => {
    if (selectedProject) {
      if (selectedProject.galleryByYear) {
        setGalleryByYear(selectedProject.galleryByYear);
      } else if (selectedProject.galleryUrls) {
        const defaultYear = selectedProject.startDate
          ? new Date(selectedProject.startDate).getFullYear().toString()
          : new Date().getFullYear().toString();
        setGalleryByYear({ [defaultYear]: selectedProject.galleryUrls });
      } else {
        setGalleryByYear({});
      }
      setLogoPreviewUrl(selectedProject.logoUrl || '');
    } else {
      setGalleryByYear({});
      setLogoPreviewUrl('');
    }
    setSelectedPhotos([]);
  }, [selectedProject]);

  // Sync selected SDG goals and reset states when modals open or selectedProject changes
  useEffect(() => {
    if (isEditModalOpen && selectedProject) {
      setSelectedSdgs(selectedProject.unsdg || []);
    } else if (isCreateModalOpen) {
      setSelectedSdgs([]);
      setLogoPreviewUrl('');
      setGalleryByYear({});
      setSelectedUploadYear(new Date().getFullYear().toString());
      setCustomUploadYear('');
      setSelectedUploadVenue('General');
      setCustomUploadVenue('');
    }
    setSelectedPhotos([]);
    setPendingDeletePhotos([]);
  }, [isEditModalOpen, isCreateModalOpen, selectedProject]);

  // Dynamic parsing of existing folders to extract years and venues
  const yearOptions = React.useMemo(() => {
    const existingYears = new Set<string>();
    Object.keys(galleryByYear).forEach((key) => {
      const parts = key.split(' - ');
      if (parts.length === 2) {
        existingYears.add(parts[0].trim());
      } else if (/^\d{4}$/.test(key.trim())) {
        existingYears.add(key.trim());
      }
    });
    if (existingYears.size === 0) {
      return [new Date().getFullYear().toString()];
    }
    return Array.from(existingYears).sort((a, b) => b.localeCompare(a));
  }, [galleryByYear]);

  const venueOptions = React.useMemo(() => {
    const existingVenues = new Set<string>();
    Object.keys(galleryByYear).forEach((key) => {
      const parts = key.split(' - ');
      if (parts.length === 2) {
        existingVenues.add(parts[1].trim());
      } else if (!/^\d{4}$/.test(key.trim())) {
        existingVenues.add(key.trim());
      }
    });
    if (existingVenues.size === 0) {
      return ['General'];
    }
    return Array.from(existingVenues).sort((a, b) => a.localeCompare(b));
  }, [galleryByYear]);

  const filteredProjects = React.useMemo(() => {
    const term = (searchQuery || '').toLowerCase();
    if (!term) return projects;
    return projects.filter(p =>
      (p.title || '').toLowerCase().includes(term) ||
      (p.description || '').toLowerCase().includes(term)
    );
  }, [projects, searchQuery]);

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string || '';
    const logoUrl = logoPreviewUrl;
    const completion = 0;
    const teamSize = 0;
    const status = formData.get('status') as 'Active' | 'Inactive' || 'Active';

    try {
      const flattenedUrls = Object.values(galleryByYear).flat();
      await FlagshipProjectsService.createProject({
        title,
        description,
        logoUrl,
        galleryUrls: flattenedUrls,
        galleryByYear,
        status,
        completion,
        teamSize,
        unsdg: selectedSdgs,
      });
      showToast('Flagship project created successfully', 'success');
      setCreateModalOpen(false);
      setGalleryByYear({});
      setLogoPreviewUrl('');
      fetchProjects();
    } catch (err) {
      showToast('Failed to create flagship project', 'error');
    }
  };

  const handleUpdateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProject) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string || '';
    const logoUrl = logoPreviewUrl;
    const completion = 0;
    const teamSize = 0;
    const status = formData.get('status') as 'Active' | 'Inactive' || 'Active';

    try {
      const flattenedUrls = Object.values(galleryByYear).flat();
      await FlagshipProjectsService.updateProject(selectedProject.id, {
        title,
        description,
        logoUrl,
        galleryUrls: flattenedUrls,
        galleryByYear,
        status,
        completion,
        teamSize,
        unsdg: selectedSdgs,
      });

      // Trigger deletion of removed photos from Cloudinary
      if (pendingDeletePhotos.length > 0) {
        Promise.all(pendingDeletePhotos.map(url => deleteFromCloudinary(url)))
          .then(results => {
            const successCount = results.filter(Boolean).length;
            console.log(`Deleted ${successCount}/${pendingDeletePhotos.length} images from Cloudinary.`);
          })
          .catch(err => console.error('Error deleting from Cloudinary:', err));
        setPendingDeletePhotos([]);
      }

      showToast('Flagship project updated successfully', 'success');
      setEditModalOpen(false);
      setSelectedProject(null);
      fetchProjects();
    } catch (err) {
      showToast('Failed to update flagship project', 'error');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this flagship project? This will remove it from the public display.')) {
      try {
        const projectToDelete = projects.find(p => p.id === projectId);
        await FlagshipProjectsService.deleteProject(projectId);

        // Also delete all of its images from Cloudinary!
        if (projectToDelete && projectToDelete.galleryUrls && projectToDelete.galleryUrls.length > 0) {
          Promise.all(projectToDelete.galleryUrls.map(url => deleteFromCloudinary(url)))
            .then(results => {
              const successCount = results.filter(Boolean).length;
              console.log(`Deleted all ${successCount}/${projectToDelete.galleryUrls!.length} project images from Cloudinary.`);
            })
            .catch(err => console.error('Failed to clean up Cloudinary assets on project deletion:', err));
        }

        showToast('Flagship project deleted successfully', 'success');
        fetchProjects();
      } catch (err) {
        showToast('Failed to delete flagship project', 'error');
      }
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setLogoUploadProgress(0);
    try {
      let fileToUpload = file;
      try {
        const options = {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 1024,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);
        fileToUpload = new File([compressedFile], file.name, {
          type: compressedFile.type,
          lastModified: Date.now(),
        });
      } catch (compressErr) {
        console.error('Logo compression failed, using original:', compressErr);
      }

      const downloadUrl = await uploadToCloudinary(
        fileToUpload,
        'flagship_projects/logos',
        (progress) => setLogoUploadProgress(progress)
      );
      setLogoPreviewUrl(downloadUrl);
      showToast('Logo uploaded successfully', 'success');
    } catch (err) {
      console.error('Logo upload failed:', err);
      showToast('Failed to upload logo', 'error');
    } finally {
      setIsUploadingLogo(false);
      setLogoUploadProgress(0);
    }
  };

  const handleGalleryPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const targetYear = selectedUploadYear === '__new_year__' ? (customUploadYear.trim() || new Date().getFullYear().toString()) : selectedUploadYear;
    const targetVenue = selectedUploadVenue === '__new_venue__' ? (customUploadVenue.trim() || 'General') : selectedUploadVenue;
    const targetFolder = `${targetYear} - ${targetVenue}`;

    const currentPhotosCount = galleryByYear[targetFolder]?.length || 0;
    const availableSlots = 12 - currentPhotosCount;
    if (availableSlots <= 0) {
      showToast(`Each folder is only allowed up to 12 images. "${targetFolder}" is already full.`, 'error');
      e.target.value = '';
      return;
    }

    let filesToUpload = Array.from(files);
    if (filesToUpload.length > availableSlots) {
      showToast(`Only ${availableSlots} photo(s) can be uploaded to "${targetFolder}" due to the 12-image limit.`, 'warning');
      filesToUpload = filesToUpload.slice(0, availableSlots);
    }

    const titleInput = document.querySelector('input[name="title"]') as HTMLInputElement | null;
    const projectTitle = titleInput?.value?.trim() || selectedProject?.title || 'Unnamed Project';

    setIsUploadingGallery(true);
    setGalleryUploadProgress(0);
    const uploadedUrls: string[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      try {
        let fileToUpload = file;
        try {
          const options = {
            maxSizeMB: 0.2,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
          };
          const compressedFile = await imageCompression(file, options);
          fileToUpload = new File([compressedFile], file.name, {
            type: compressedFile.type,
            lastModified: Date.now(),
          });
        } catch (compressErr) {
          console.error('Gallery image compression failed, using original:', compressErr);
        }

        const baseProgress = (i / filesToUpload.length) * 100;
        const downloadUrl = await uploadToCloudinary(
          fileToUpload,
          `${projectTitle}/album/${targetYear}/${targetVenue}`,
          (progress) => {
            const currentTotalProgress = Math.round(baseProgress + (progress / filesToUpload.length));
            setGalleryUploadProgress(currentTotalProgress);
          }
        );
        uploadedUrls.push(downloadUrl);
        successCount++;
      } catch (err) {
        console.error(`Gallery photo upload failed for ${file.name}:`, err);
        failCount++;
      }
    }

    if (uploadedUrls.length > 0) {
      setGalleryByYear(prev => {
        const currentFolderPhotos = prev[targetFolder] || [];
        return {
          ...prev,
          [targetFolder]: [...currentFolderPhotos, ...uploadedUrls]
        };
      });
    }

    if (failCount === 0) {
      showToast(`Successfully uploaded ${successCount} photo(s)`, 'success');
    } else {
      showToast(`Uploaded ${successCount} photo(s) (${failCount} failed)`, 'warning');
    }
    setIsUploadingGallery(false);
    setGalleryUploadProgress(0);

    if (selectedUploadYear === '__new_year__') {
      setSelectedUploadYear(targetYear);
      setCustomUploadYear('');
    }
    if (selectedUploadVenue === '__new_venue__') {
      setSelectedUploadVenue(targetVenue);
      setCustomUploadVenue('');
    }
    e.target.value = '';
  };

  const handleRemovePhoto = (folder: string, index: number) => {
    const photoUrl = galleryByYear[folder]?.[index];
    if (photoUrl) {
      setPendingDeletePhotos(prev => [...prev, photoUrl]);
    }
    setGalleryByYear(prev => {
      const updatedPhotos = (prev[folder] || []).filter((_, i) => i !== index);
      const copy = { ...prev };
      if (updatedPhotos.length === 0) {
        delete copy[folder];
      } else {
        copy[folder] = updatedPhotos;
      }
      return copy;
    });
  };

  const togglePhotoSelection = (folder: string, url: string) => {
    setSelectedPhotos(prev => {
      const exists = prev.some(p => p.folder === folder && p.url === url);
      if (exists) {
        return prev.filter(p => !(p.folder === folder && p.url === url));
      } else {
        return [...prev, { folder, url }];
      }
    });
  };

  const handleDragStart = (e: React.DragEvent, folder: string, url: string) => {
    let targetSelection = selectedPhotos;
    const isDraggedSelected = selectedPhotos.some(p => p.folder === folder && p.url === url);
    if (!isDraggedSelected) {
      targetSelection = [{ folder, url }];
      setSelectedPhotos([{ folder, url }]);
    }
    e.dataTransfer.setData('text/plain', JSON.stringify(targetSelection));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    setDragOverFolder(null);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const draggedItems = JSON.parse(dataStr) as Array<{ folder: string, url: string }>;
      if (!Array.isArray(draggedItems) || draggedItems.length === 0) return;

      // Check capacity of target folder
      const currentPhotos = galleryByYear[targetFolder] || [];
      const movingFromOtherFolders = draggedItems.filter(item => item.folder !== targetFolder);
      const newPhotosCount = currentPhotos.length + movingFromOtherFolders.length;

      if (newPhotosCount > 12) {
        showToast(`Cannot move photos. "${targetFolder}" would exceed the limit of 12 photos.`, 'error');
        setSelectedPhotos([]);
        return;
      }

      setGalleryByYear(prev => {
        const next = { ...prev };

        // Remove from original folders
        draggedItems.forEach(item => {
          if (next[item.folder]) {
            next[item.folder] = next[item.folder].filter(u => u !== item.url);
            if (next[item.folder].length === 0) {
              delete next[item.folder];
            }
          }
        });

        // Add to targetFolder
        const targetPhotos = next[targetFolder] || [];
        const newUrls = draggedItems.map(item => item.url).filter(url => !targetPhotos.includes(url));
        next[targetFolder] = [...targetPhotos, ...newUrls];

        return next;
      });

      showToast(`Moved ${draggedItems.length} photo(s) to ${targetFolder}`, 'success');
      setSelectedPhotos([]);
    } catch (err) {
      console.error('Drop failed:', err);
    }
  };

  const handleBatchMoveToFolder = (targetFolder: string) => {
    if (selectedPhotos.length === 0) return;

    // Check capacity of target folder
    const currentPhotos = galleryByYear[targetFolder] || [];
    const movingFromOtherFolders = selectedPhotos.filter(item => item.folder !== targetFolder);
    const newPhotosCount = currentPhotos.length + movingFromOtherFolders.length;

    if (newPhotosCount > 12) {
      showToast(`Cannot move photos. "${targetFolder}" would exceed the limit of 12 photos.`, 'error');
      setSelectedPhotos([]);
      return;
    }

    setGalleryByYear(prev => {
      const next = { ...prev };
      selectedPhotos.forEach(item => {
        if (next[item.folder]) {
          next[item.folder] = next[item.folder].filter(u => u !== item.url);
          if (next[item.folder].length === 0) {
            delete next[item.folder];
          }
        }
      });
      const targetPhotos = next[targetFolder] || [];
      const newUrls = selectedPhotos.map(item => item.url).filter(url => !targetPhotos.includes(url));
      next[targetFolder] = [...targetPhotos, ...newUrls];
      return next;
    });

    showToast(`Moved ${selectedPhotos.length} photo(s) to ${targetFolder}`, 'success');
    setSelectedPhotos([]);
  };

  const handleBatchDelete = () => {
    if (selectedPhotos.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedPhotos.length} selected photo(s)?`)) return;

    const urlsToDelete = selectedPhotos.map(p => p.url);
    setPendingDeletePhotos(prev => [...prev, ...urlsToDelete]);

    setGalleryByYear(prev => {
      const next = { ...prev };
      selectedPhotos.forEach(item => {
        if (next[item.folder]) {
          next[item.folder] = next[item.folder].filter(u => u !== item.url);
          if (next[item.folder].length === 0) {
            delete next[item.folder];
          }
        }
      });
      return next;
    });

    showToast(`Deleted ${selectedPhotos.length} photo(s)`, 'success');
    setSelectedPhotos([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Flagship Projects</h2>
          <p className="text-slate-500">Configure logo, title, description, and galleries for the guest-facing flagship page.</p>
        </div>
        <Button onClick={() => {
          setGalleryByYear({});
          setCreateModalOpen(true);
        }} className="bg-jci-blue hover:bg-jci-blue/90 border-0">
          <Plus size={16} className="mr-2" /> New Flagship Project
        </Button>
      </div>

      <Card noPadding>
        <div className="p-6">
          <LoadingState loading={loading} error={error} empty={filteredProjects.length === 0} emptyMessage="No flagship projects found">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map(project => {
                const photoCount = project.galleryUrls?.length || 0;
                return (
                  <Card key={project.id} noPadding className="hover:shadow-lg transition-all border border-slate-100 flex flex-col h-full bg-white rounded-xl overflow-hidden group">
                    <div className="h-40 bg-slate-50 relative flex items-center justify-center border-b border-slate-100 overflow-hidden">
                      {project.logoUrl ? (
                        <img src={project.logoUrl} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <Briefcase size={32} className="text-slate-400" />
                      )}
                      <div className="absolute top-3 right-3 flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="bg-white/95 hover:bg-white text-slate-700 shadow-sm p-1.5 h-8 w-8 rounded-full"
                          onClick={() => {
                            setSelectedProject(project);
                            setEditModalOpen(true);
                          }}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="bg-white/95 hover:bg-white text-red-600 shadow-sm p-1.5 h-8 w-8 rounded-full"
                          onClick={() => handleDeleteProject(project.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <div className="absolute bottom-3 left-3">
                        <Badge variant={project.status === 'Active' ? 'success' : 'neutral'}>
                          {project.status}
                        </Badge>
                      </div>

                      {/* Selected UNSDG goals row in cover wrapper */}
                      {project.unsdg && project.unsdg.length > 0 && (
                        <div className="absolute bottom-3 right-3 flex gap-1 z-10">
                          {project.unsdg.map(goalId => (
                            <img
                              key={goalId}
                              src={`/UNSDG/${goalId}.png`}
                              alt={goalId}
                              className="w-12 h-12 rounded object-cover shadow-sm border border-white"
                              title={goalId}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">{project.title}</h3>
                        <p className="text-xs text-slate-500 mb-3 font-medium">
                          {photoCount} {photoCount === 1 ? 'photo' : 'photos'} in gallery
                        </p>
                        {project.description ? (
                          <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed mb-3">{project.description}</p>
                        ) : (
                          <p className="text-sm text-slate-400 italic mb-3">No description set.</p>
                        )}
                      </div>


                    </div>
                  </Card>
                );
              })}
            </div>
          </LoadingState>
        </div>
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Start New Flagship Project"
        size="lg"
        drawerOnMobile
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Input
            name="title"
            label="Project Title *"
            placeholder="e.g. Youth Mentorship Flagship 2024"
            required
            icon={<Briefcase size={16} />}
          />

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Project Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 relative flex items-center justify-center">
                {logoPreviewUrl ? (
                  <img
                    src={logoPreviewUrl}
                    alt="Logo Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon size={24} />
                    <span className="text-[10px] mt-1">Logo</span>
                  </div>
                )}
                {isUploadingLogo && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-jci-blue border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="create-project-logo-upload"
                  disabled={isUploadingLogo}
                />
                <label
                  htmlFor="create-project-logo-upload"
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all cursor-pointer ${isUploadingLogo
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'text-jci-blue bg-blue-50 border-blue-100 hover:bg-blue-100'
                    }`}
                >
                  <Upload size={16} />
                  {logoPreviewUrl ? 'Change Logo Image' : 'Upload Logo Image'}
                </label>
                {isUploadingLogo && (
                  <div className="mt-2 w-full max-w-xs">
                    <ProgressBar progress={logoUploadProgress} label={`Uploading logo... ${logoUploadProgress}%`} />
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">Select an image to upload as the project logo.</p>
              </div>
            </div>
          </div>

          <Textarea
            name="description"
            label="Description"
            placeholder="Introduce the goals, details, and impact of the flagship project..."
            rows={4}
          />

          {/* UNSDG selector grid */}
          <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-slate-50">
            <label className="text-sm font-semibold text-slate-700 block">UN Sustainable Development Goals (UNSDG)</label>
            <p className="text-xs text-slate-400 mb-3">Select one or more UNSDGs associated with this project:</p>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
              {UNSDG_GOALS.map((goal) => {
                const isSelected = selectedSdgs.includes(goal.id);
                return (
                  <div
                    key={goal.id}
                    onClick={() => {
                      setSelectedSdgs(prev =>
                        prev.includes(goal.id)
                          ? prev.filter(id => id !== goal.id)
                          : [...prev, goal.id]
                      );
                    }}
                    className={`relative cursor-pointer aspect-square rounded-lg overflow-hidden border transition-all ${isSelected
                      ? 'ring-2 ring-jci-blue border-jci-blue opacity-100 scale-105'
                      : 'border-slate-200 opacity-40 hover:opacity-85'
                      }`}
                    title={goal.title}
                  >
                    <img src={goal.image} alt={goal.title} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute top-0.5 right-0.5 bg-jci-blue text-white rounded-full p-0.5 shadow-sm">
                        <Check size={8} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 border border-slate-200 rounded-xl p-5 bg-gradient-to-b from-slate-50 to-slate-100/50 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={18} className="text-jci-blue" />
                <label className="text-sm font-bold text-slate-800">Activity Photo Gallery</label>
              </div>
              <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-0.5 rounded-full font-bold">
                Max 12 images per folder
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-2">
              Upload and organize photos in your project's details gallery. Drag and drop items between categories to group them.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm w-full">
              {/* Year Select & Input */}
              <div className="w-full sm:w-1/4 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">Year</label>
                <select
                  value={selectedUploadYear}
                  onChange={(e) => setSelectedUploadYear(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-lg p-2.5 text-sm font-semibold text-slate-800 transition-colors focus:ring-2 focus:ring-jci-blue focus:border-jci-blue"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                  <option value="__new_year__">+ Custom Year...</option>
                </select>
              </div>

              {selectedUploadYear === '__new_year__' && (
                <div className="w-full sm:w-1/4 flex flex-col gap-1.5 animate-fade-in">
                  <label className="text-xs font-bold text-slate-600">Custom Year</label>
                  <input
                    type="text"
                    value={customUploadYear}
                    onChange={(e) => setCustomUploadYear(e.target.value)}
                    placeholder="e.g. 2026"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-jci-blue focus:border-jci-blue"
                  />
                </div>
              )}

              {/* Venue Select & Input */}
              <div className="w-full sm:w-1/3 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">Venue / Event</label>
                <select
                  value={selectedUploadVenue}
                  onChange={(e) => setSelectedUploadVenue(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-lg p-2.5 text-sm font-semibold text-slate-800 transition-colors focus:ring-2 focus:ring-jci-blue focus:border-jci-blue"
                >
                  {venueOptions.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                  <option value="__new_venue__">+ Custom Venue...</option>
                </select>
              </div>

              {selectedUploadVenue === '__new_venue__' && (
                <div className="w-full sm:w-1/3 flex flex-col gap-1.5 animate-fade-in">
                  <label className="text-xs font-bold text-slate-600">Custom Venue</label>
                  <input
                    type="text"
                    value={customUploadVenue}
                    onChange={(e) => setCustomUploadVenue(e.target.value)}
                    placeholder="e.g. CSR Activity"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-jci-blue focus:border-jci-blue"
                  />
                </div>
              )}

              <div className="flex-1 flex items-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryPhotoUpload}
                  className="hidden"
                  id="create-gallery-photo-upload"
                  disabled={isUploadingGallery}
                />
                <label
                  htmlFor="create-gallery-photo-upload"
                  className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg border shadow-sm transition-all cursor-pointer w-full sm:w-auto ${isUploadingGallery
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'text-white bg-gradient-to-r from-jci-blue to-indigo-600 hover:from-jci-blue/95 hover:to-indigo-600/95 border-0 hover:shadow active:scale-95 duration-150'
                    }`}
                >
                  <Upload size={16} />
                  {isUploadingGallery ? 'Uploading...' : 'Upload Photos (Multiple)'}
                </label>
                {isUploadingGallery && (
                  <div className="flex-1 max-w-xs animate-pulse">
                    <ProgressBar progress={galleryUploadProgress} label={`Uploading... ${galleryUploadProgress}%`} />
                  </div>
                )}
              </div>
            </div>

            {selectedPhotos.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 border border-blue-200 p-3 rounded-xl mb-4 animate-fade-in shadow-sm select-none">
                <div className="flex items-center gap-2">
                  <Badge className="px-2 py-0.5 rounded-full text-xs font-bold bg-jci-blue text-white">
                    {selectedPhotos.length} selected
                  </Badge>
                  <span className="text-xs font-semibold text-slate-700">photos</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-medium">Move to:</span>
                    <select
                      onChange={(e) => {
                        const targetFolder = e.target.value;
                        if (!targetFolder) return;
                        if (targetFolder === '__new_batch__') {
                          const newName = prompt('Enter new folder name:');
                          if (newName && newName.trim()) {
                            handleBatchMoveToFolder(newName.trim());
                          }
                        } else {
                          handleBatchMoveToFolder(targetFolder);
                        }
                        e.target.value = '';
                      }}
                      className="bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs font-semibold focus:ring-1 focus:ring-jci-blue focus:border-jci-blue"
                    >
                      <option value="">Folder...</option>
                      <option value="General">General</option>
                      <option value="Launch Ceremony">Launch Ceremony</option>
                      <option value="Press Conference">Press Conference</option>
                      <option value="Main Event">Main Event</option>
                      <option value="Closing Ceremony">Closing Ceremony</option>
                      {Object.keys(galleryByYear)
                        .filter(f => !['General', 'Launch Ceremony', 'Press Conference', 'Main Event', 'Closing Ceremony'].includes(f))
                        .map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))
                      }
                      <option value="__new_batch__">+ Create New...</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleBatchDelete}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPhotos([])}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-1 py-1"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {Object.keys(galleryByYear).length > 0 ? (
              <div className="space-y-4 mt-4 max-h-[300px] overflow-y-auto pr-1">
                {Object.keys(galleryByYear)
                  .sort((a, b) => a.localeCompare(b))
                  .map((folder) => {
                    const photos = galleryByYear[folder] || [];
                    const isDragOver = dragOverFolder === folder;
                    return (
                      <div
                        key={folder}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverFolder(folder);
                        }}
                        onDragLeave={() => setDragOverFolder(null)}
                        onDrop={(e) => handleDrop(e, folder)}
                        className={`bg-white p-4 rounded-xl border transition-all duration-300 ${isDragOver
                          ? 'border-dashed border-jci-blue bg-blue-50/80 scale-[1.01] shadow-md ring-4 ring-jci-blue/15'
                          : 'border-slate-200/60 shadow-sm hover:shadow-md'
                          }`}
                      >
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 pointer-events-none select-none">
                          <span className="text-xs font-bold text-slate-800 bg-slate-100/80 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                            <Folder size={13} className="text-jci-blue fill-jci-blue/10" />
                            {folder}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-semibold">{photos.length} photo(s)</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${photos.length >= 12
                              ? 'bg-red-50 text-red-600 border-red-200/80'
                              : photos.length >= 9
                                ? 'bg-amber-50 text-amber-600 border-amber-200/80'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200/80'
                              }`}>
                              {photos.length}/12 slots
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {photos.map((url, index) => {
                            const isSelected = selectedPhotos.some(p => p.folder === folder && p.url === url);
                            return (
                              <div
                                key={index}
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, folder, url)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePhotoSelection(folder, url);
                                }}
                                className={`relative group border rounded-lg overflow-hidden aspect-video bg-slate-50 cursor-grab active:cursor-grabbing transition-all duration-200 select-none shadow-sm ${isSelected
                                  ? 'ring-2 ring-jci-blue border-jci-blue scale-[0.96] shadow-inner'
                                  : 'border-slate-200 hover:border-slate-300 hover:shadow hover:scale-[1.02]'
                                  }`}
                              >
                                <img src={url} alt={`Gallery ${folder}-${index}`} className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-200" />

                                {/* Overlay gradient on hover */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none flex items-end p-1.5">
                                  <span className="text-[8px] text-white font-medium drop-shadow-sm select-none">Drag to move</span>
                                </div>

                                <div
                                  className={`absolute top-1.5 left-1.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isSelected
                                    ? 'bg-jci-blue border-jci-blue text-white shadow-sm'
                                    : 'bg-white/90 border-slate-300 opacity-0 group-hover:opacity-100 shadow-sm'
                                    }`}
                                >
                                  {isSelected && <Check size={10} strokeWidth={4} />}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemovePhoto(folder, index);
                                    setSelectedPhotos(prev => prev.filter(p => !(p.folder === folder && p.url === url)));
                                  }}
                                  className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md hover:scale-110"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs bg-slate-50/50">
                No gallery photos uploaded yet.
              </div>
            )}
          </div>

          <div className="pt-4 flex gap-3">
            <Button className="flex-grow bg-jci-blue hover:bg-jci-blue/90 border-0" type="submit" disabled={isUploadingLogo || isUploadingGallery}>Create Flagship Project</Button>
            <Button variant="ghost" type="button" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      {selectedProject && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedProject(null);
          }}
          title="Edit Flagship Project Settings"
          size="lg"
          drawerOnMobile
        >
          <form onSubmit={handleUpdateProject} className="space-y-4">
            <Input
              name="title"
              label="Project Title *"
              defaultValue={selectedProject.title}
              required
              icon={<Briefcase size={16} />}
            />

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Project Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 relative flex items-center justify-center">
                  {logoPreviewUrl ? (
                    <img
                      src={logoPreviewUrl}
                      alt="Logo Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                      <ImageIcon size={24} />
                      <span className="text-[10px] mt-1">Logo</span>
                    </div>
                  )}
                  {isUploadingLogo && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-jci-blue border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="edit-project-logo-upload"
                    disabled={isUploadingLogo}
                  />
                  <label
                    htmlFor="edit-project-logo-upload"
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all cursor-pointer ${isUploadingLogo
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'text-jci-blue bg-blue-50 border-blue-100 hover:bg-blue-100'
                      }`}
                  >
                    <Upload size={16} />
                    {logoPreviewUrl ? 'Change Logo Image' : 'Upload Logo Image'}
                  </label>
                  {isUploadingLogo && (
                    <div className="mt-2 w-full max-w-xs">
                      <ProgressBar progress={logoUploadProgress} label={`Uploading logo... ${logoUploadProgress}%`} />
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1">Select an image to upload as the project logo.</p>
                </div>
              </div>
            </div>

            <Textarea
              name="description"
              label="Description"
              defaultValue={selectedProject.description}
              placeholder="Introduce the goals, details, and impact of the flagship project..."
              rows={4}
            />

            {/* UNSDG selector grid */}
            <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-slate-50">
              <label className="text-sm font-semibold text-slate-700 block">UN Sustainable Development Goals (UNSDG)</label>
              <p className="text-xs text-slate-400 mb-3">Select one or more UNSDGs associated with this project:</p>
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
                {UNSDG_GOALS.map((goal) => {
                  const isSelected = selectedSdgs.includes(goal.id);
                  return (
                    <div
                      key={goal.id}
                      onClick={() => {
                        setSelectedSdgs(prev =>
                          prev.includes(goal.id)
                            ? prev.filter(id => id !== goal.id)
                            : [...prev, goal.id]
                        );
                      }}
                      className={`relative cursor-pointer aspect-square rounded-lg overflow-hidden border transition-all ${isSelected
                        ? 'ring-2 ring-jci-blue border-jci-blue opacity-100 scale-105'
                        : 'border-slate-200 opacity-40 hover:opacity-85'
                        }`}
                      title={goal.title}
                    >
                      <img src={goal.image} alt={goal.title} className="w-full h-full object-cover" />
                      {isSelected && (
                        <div className="absolute top-0.5 right-0.5 bg-jci-blue text-white rounded-full p-0.5 shadow-sm">
                          <Check size={8} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 border border-slate-200 rounded-xl p-5 bg-gradient-to-b from-slate-50 to-slate-100/50 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon size={18} className="text-jci-blue" />
                  <label className="text-sm font-bold text-slate-800">Activity Photo Gallery</label>
                </div>
                <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-0.5 rounded-full font-bold">
                  Max 12 images per folder
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-2">
                Upload and organize photos in your project's details gallery. Drag and drop items between categories to group them.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm w-full">
                {/* Year Select & Input */}
                <div className="w-full sm:w-1/4 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">Year</label>
                  <select
                    value={selectedUploadYear}
                    onChange={(e) => setSelectedUploadYear(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-lg p-2.5 text-sm font-semibold text-slate-800 transition-colors focus:ring-2 focus:ring-jci-blue focus:border-jci-blue"
                  >
                    {yearOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                    <option value="__new_year__">+ Custom Year...</option>
                  </select>
                </div>

                {selectedUploadYear === '__new_year__' && (
                  <div className="w-full sm:w-1/4 flex flex-col gap-1.5 animate-fade-in">
                    <label className="text-xs font-bold text-slate-600">Custom Year</label>
                    <input
                      type="text"
                      value={customUploadYear}
                      onChange={(e) => setCustomUploadYear(e.target.value)}
                      placeholder="e.g. 2026"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-jci-blue focus:border-jci-blue"
                    />
                  </div>
                )}

                {/* Venue Select & Input */}
                <div className="w-full sm:w-1/3 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">Venue / Event</label>
                  <select
                    value={selectedUploadVenue}
                    onChange={(e) => setSelectedUploadVenue(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-lg p-2.5 text-sm font-semibold text-slate-800 transition-colors focus:ring-2 focus:ring-jci-blue focus:border-jci-blue"
                  >
                    {venueOptions.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                    <option value="__new_venue__">+ Custom Venue...</option>
                  </select>
                </div>

                {selectedUploadVenue === '__new_venue__' && (
                  <div className="w-full sm:w-1/3 flex flex-col gap-1.5 animate-fade-in">
                    <label className="text-xs font-bold text-slate-600">Custom Venue</label>
                    <input
                      type="text"
                      value={customUploadVenue}
                      onChange={(e) => setCustomUploadVenue(e.target.value)}
                      placeholder="e.g. CSR Activity"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-jci-blue focus:border-jci-blue"
                    />
                  </div>
                )}

                <div className="flex-1 flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGalleryPhotoUpload}
                    className="hidden"
                    id="edit-gallery-photo-upload"
                    disabled={isUploadingGallery}
                  />
                  <label
                    htmlFor="edit-gallery-photo-upload"
                    className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg border shadow-sm transition-all cursor-pointer w-full sm:w-auto ${isUploadingGallery
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'text-white bg-gradient-to-r from-jci-blue to-indigo-600 hover:from-jci-blue/95 hover:to-indigo-600/95 border-0 hover:shadow active:scale-95 duration-150'
                      }`}
                  >
                    <Upload size={16} />
                    {isUploadingGallery ? 'Uploading...' : 'Upload Photos (Multiple)'}
                  </label>
                  {isUploadingGallery && (
                    <div className="flex-1 max-w-xs animate-pulse">
                      <ProgressBar progress={galleryUploadProgress} label={`Uploading... ${galleryUploadProgress}%`} />
                    </div>
                  )}
                </div>
              </div>

              {selectedPhotos.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 border border-blue-200 p-3 rounded-xl mb-4 animate-fade-in shadow-sm select-none">
                  <div className="flex items-center gap-2">
                    <Badge className="px-2 py-0.5 rounded-full text-xs font-bold bg-jci-blue text-white">
                      {selectedPhotos.length} selected
                    </Badge>
                    <span className="text-xs font-semibold text-slate-700">photos</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-medium">Move to:</span>
                      <select
                        onChange={(e) => {
                          const targetFolder = e.target.value;
                          if (!targetFolder) return;
                          if (targetFolder === '__new_batch__') {
                            const newName = prompt('Enter new folder name:');
                            if (newName && newName.trim()) {
                              handleBatchMoveToFolder(newName.trim());
                            }
                          } else {
                            handleBatchMoveToFolder(targetFolder);
                          }
                          e.target.value = '';
                        }}
                        className="bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs font-semibold focus:ring-1 focus:ring-jci-blue focus:border-jci-blue"
                      >
                        <option value="">Folder...</option>
                        <option value="General">General</option>
                        <option value="Launch Ceremony">Launch Ceremony</option>
                        <option value="Press Conference">Press Conference</option>
                        <option value="Main Event">Main Event</option>
                        <option value="Closing Ceremony">Closing Ceremony</option>
                        {Object.keys(galleryByYear)
                          .filter(f => !['General', 'Launch Ceremony', 'Press Conference', 'Main Event', 'Closing Ceremony'].includes(f))
                          .map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))
                        }
                        <option value="__new_batch__">+ Create New...</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleBatchDelete}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPhotos([])}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-1 py-1"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {Object.keys(galleryByYear).length > 0 ? (
                <div className="space-y-4 mt-4 max-h-[300px] overflow-y-auto pr-1">
                  {Object.keys(galleryByYear)
                    .sort((a, b) => a.localeCompare(b))
                    .map((folder) => {
                      const photos = galleryByYear[folder] || [];
                      const isDragOver = dragOverFolder === folder;
                      return (
                        <div
                          key={folder}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverFolder(folder);
                          }}
                          onDragLeave={() => setDragOverFolder(null)}
                          onDrop={(e) => handleDrop(e, folder)}
                          className={`bg-white p-4 rounded-xl border transition-all duration-300 ${isDragOver
                            ? 'border-dashed border-jci-blue bg-blue-50/80 scale-[1.01] shadow-md ring-4 ring-jci-blue/15'
                            : 'border-slate-200/60 shadow-sm hover:shadow-md'
                            }`}
                        >
                          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 pointer-events-none select-none">
                            <span className="text-xs font-bold text-slate-800 bg-slate-100/80 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                              <Folder size={13} className="text-jci-blue fill-jci-blue/10" />
                              {folder}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 font-semibold">{photos.length} photo(s)</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${photos.length >= 12
                                ? 'bg-red-50 text-red-600 border-red-200/80'
                                : photos.length >= 9
                                  ? 'bg-amber-50 text-amber-600 border-amber-200/80'
                                  : 'bg-emerald-50 text-emerald-600 border-emerald-200/80'
                                }`}>
                                {photos.length}/12 slots
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {photos.map((url, index) => {
                              const isSelected = selectedPhotos.some(p => p.folder === folder && p.url === url);
                              return (
                                <div
                                  key={index}
                                  draggable={true}
                                  onDragStart={(e) => handleDragStart(e, folder, url)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePhotoSelection(folder, url);
                                  }}
                                  className={`relative group border rounded-lg overflow-hidden aspect-video bg-slate-50 cursor-grab active:cursor-grabbing transition-all duration-200 select-none shadow-sm ${isSelected
                                    ? 'ring-2 ring-jci-blue border-jci-blue scale-[0.96] shadow-inner'
                                    : 'border-slate-200 hover:border-slate-300 hover:shadow hover:scale-[1.02]'
                                    }`}
                                >
                                  <img src={url} alt={`Gallery ${folder}-${index}`} className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-200" />

                                  {/* Overlay gradient on hover */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none flex items-end p-1.5">
                                    <span className="text-[8px] text-white font-medium drop-shadow-sm select-none">Drag to move</span>
                                  </div>

                                  <div
                                    className={`absolute top-1.5 left-1.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isSelected
                                      ? 'bg-jci-blue border-jci-blue text-white shadow-sm'
                                      : 'bg-white/90 border-slate-300 opacity-0 group-hover:opacity-100 shadow-sm'
                                      }`}
                                  >
                                    {isSelected && <Check size={10} strokeWidth={4} />}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemovePhoto(folder, index);
                                      setSelectedPhotos(prev => prev.filter(p => !(p.folder === folder && p.url === url)));
                                    }}
                                    className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md hover:scale-110"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs bg-slate-50/50">
                  No gallery photos uploaded yet.
                </div>
              )}
            </div>

            <div className="pt-4 flex gap-3">
              <Button className="flex-grow bg-jci-blue hover:bg-jci-blue/90 border-0" type="submit" disabled={isUploadingLogo || isUploadingGallery}>Save Changes</Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setEditModalOpen(false);
                  setSelectedProject(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
