import React, { useState, useEffect } from 'react';
import { Briefcase, ChevronLeft, ChevronRight, Image as ImageIcon, X } from 'lucide-react';
import { Button, Modal } from '@/components/ui/Common';
import { FlagshipProjectsService } from '@/services/flagshipProjectsService';
import { GuestHeader } from '@/components/layout/GuestHeader';
import { GuestFooter } from '@/components/layout/GuestFooter';
import { FlagshipProject } from '@/types';

export const FlagshipProjectsPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => void;
}) => {
  const [projects, setProjects] = useState<FlagshipProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<FlagshipProject | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    FlagshipProjectsService.getAllProjects().then(data => {
      if (!cancelled) {
        setProjects(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const activeProjects = projects.filter(p => p.status === 'Active');

  const handlePrevPhoto = (photosCount: number) => {
    if (lightboxIndex === null) return;
    setLightboxIndex(lightboxIndex === 0 ? photosCount - 1 : lightboxIndex - 1);
  };

  const handleNextPhoto = (photosCount: number) => {
    if (lightboxIndex === null) return;
    setLightboxIndex(lightboxIndex === photosCount - 1 ? 0 : lightboxIndex + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <GuestHeader currentPage="projects" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        <section className="relative py-14 md:py-20 bg-gradient-to-br from-jci-navy via-[#1a3d7c] to-jci-blue overflow-hidden" aria-label="Page header">
          <div className="absolute top-0 right-0 w-96 h-96 bg-jci-blue/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest mb-3">Impact & Community</p>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4">Flagship Projects</h1>
            <p className="text-blue-200 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Discover the impactful initiatives driving positive change in our community and beyond.
            </p>
          </div>
        </section>

        <section className="py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <style>{`
              .scrollbar-none::-webkit-scrollbar { display: none; }
              .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-jci-blue mb-4"></div>
                <p className="text-slate-500 text-sm font-semibold">Loading projects...</p>
              </div>
            ) : activeProjects.length === 0 ? (
              <div className="text-center py-20">
                <Briefcase size={48} className="mx-auto mb-4 text-slate-300" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">No active projects</h3>
                <p className="text-slate-500">Check back soon for new projects!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeProjects.map(project => {
                  const allPhotos = project.galleryUrls?.length
                    ? project.galleryUrls
                    : Object.values(project.galleryByYear || {}).flat();
                  const coverPhoto = allPhotos[0] || null;
                  const hasPhotos = allPhotos.length > 0;
                  const previewPhotos = allPhotos.slice(0, 5);
                  const extraCount = allPhotos.length - 5;

                  return (
                    <div key={project.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 overflow-hidden flex flex-col group">
                      {/* Cover */}
                      <div className="relative h-48 bg-gradient-to-br from-jci-navy to-jci-blue overflow-hidden shrink-0">
                        {coverPhoto ? (
                          <img src={coverPhoto} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          project.logoUrl && <img src={project.logoUrl} alt={project.title} className="w-full h-full object-contain p-12 opacity-20" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                        {/* Pillar chip */}
                        {project.pillar && (
                          <div className="absolute top-3 left-3">
                            <span className="text-[9px] font-black uppercase tracking-widest bg-black/30 border border-white/20 text-white px-2.5 py-1 rounded-full backdrop-blur-sm">
                              {project.pillar}
                            </span>
                          </div>
                        )}

                        {/* UNSDG icons */}
                        {project.unsdg && project.unsdg.length > 0 && (
                          <div className="absolute top-3 right-3 flex gap-1">
                            {project.unsdg.slice(0, 4).map(goalId => (
                              <img key={goalId} src={`/UNSDG/${goalId}.png`} alt={goalId} title={goalId}
                                className="w-8 h-8 rounded-lg object-cover shadow-md border-2 border-white/60 hover:scale-110 transition-transform" />
                            ))}
                            {project.unsdg.length > 4 && (
                              <div className="w-8 h-8 rounded-lg bg-black/30 border-2 border-white/40 flex items-center justify-center backdrop-blur-sm">
                                <span className="text-[9px] font-black text-white">+{project.unsdg.length - 4}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Logo badge */}
                        {project.logoUrl && coverPhoto && (
                          <div className="absolute bottom-3 left-4 w-11 h-11 rounded-xl bg-white shadow-lg border-2 border-white overflow-hidden">
                            <img src={project.logoUrl} alt="" className="w-full h-full object-contain p-1" />
                          </div>
                        )}
                      </div>

                      {/* Body */}
                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="font-black text-slate-900 text-lg leading-tight mb-2">{project.title}</h3>

                        {/* Meta chips */}
                        {!!(project.level || project.startDate || project.teamSize) && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {project.level && (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-jci-blue bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                                {project.level}
                              </span>
                            )}
                            {project.startDate && (
                              <span className="text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                                {project.startDate.slice(0, 4)}
                              </span>
                            )}
                            {!!project.teamSize && (
                              <span className="text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                                {project.teamSize} members
                              </span>
                            )}
                          </div>
                        )}

                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 flex-1 mb-4">
                          {project.description || 'No description available.'}
                        </p>

                        {/* Photo strip */}
                        {hasPhotos && (
                          <div className="mb-4">
                            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                              {previewPhotos.map((url, i) => (
                                <button
                                  key={i}
                                  className="w-16 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-100 hover:border-jci-blue/40 transition-colors"
                                  onClick={() => { setSelectedProject(project); setLightboxIndex(i); }}
                                >
                                  <img src={url} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform duration-200" />
                                </button>
                              ))}
                              {extraCount > 0 && (
                                <button
                                  className="w-16 h-12 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center border border-slate-200 hover:bg-slate-200 transition-colors"
                                  onClick={() => { setSelectedProject(project); setLightboxIndex(5); }}
                                >
                                  <span className="text-xs font-bold text-slate-500">+{extraCount}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                          {hasPhotos ? (
                            <button
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-jci-blue hover:text-sky-600 transition-colors"
                              onClick={() => { setSelectedProject(project); setLightboxIndex(0); }}
                            >
                              <ImageIcon size={13} /> {allPhotos.length} {allPhotos.length === 1 ? 'Photo' : 'Photos'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 flex items-center gap-1"><ImageIcon size={12} /> No photos yet</span>
                          )}
                          <Button
                            onClick={onRegister}
                            className="text-xs font-bold px-4 py-1.5 bg-jci-blue hover:bg-jci-blue/90 text-white border-0 h-8 rounded-xl"
                          >
                            Get Involved
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Project Detail & Photo Gallery Modal */}
        {selectedProject && (
          <Modal
            isOpen={true}
            onClose={() => {
              setSelectedProject(null);
              setLightboxIndex(null);
            }}
            title={selectedProject.title}
            size="lg"
            drawerOnMobile
          >
            <div className="space-y-6">
              {/* Top Section with Logo and Banner */}
              <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-100">
                {selectedProject.logoUrl ? (
                  <div className="w-24 h-24 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm flex-shrink-0 flex items-center justify-center">
                    <img src={selectedProject.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                    <Briefcase size={36} />
                  </div>
                )}
                <div className="text-center sm:text-left flex-1">

                  <h2 className="text-2xl font-extrabold text-slate-900 mb-1">
                    {selectedProject.title}
                  </h2>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">About the Project</h4>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base">
                  {selectedProject.description || 'No description available.'}
                </p>
              </div>

              {/* Project Stats and Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                {selectedProject.startDate && (
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Start Date</span>
                    <span className="text-sm font-medium text-slate-800 font-sans">
                      {new Date(selectedProject.startDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>
                )}
                {selectedProject.endDate && (
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">End Date</span>
                    <span className="text-sm font-medium text-slate-800 font-sans">
                      {new Date(selectedProject.endDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>
                )}
              </div>

              {/* UNSDG Goals Section */}
              {selectedProject.unsdg && selectedProject.unsdg.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">UN Sustainable Development Goals</h4>
                  <div className="flex flex-wrap gap-2.5">
                    {selectedProject.unsdg.map(goalId => (
                      <div key={goalId} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl p-2 pr-4 shadow-sm">
                        <img
                          src={`/UNSDG/${goalId}.png`}
                          alt={goalId}
                          className="w-8 h-8 rounded object-cover"
                        />
                        <span className="text-xs font-semibold text-slate-700">{goalId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Photo Gallery Timeline */}
              {selectedProject.galleryUrls && selectedProject.galleryUrls.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Event Photo Gallery</h4>

                  {(() => {
                    const foldersData: Record<string, string[]> = selectedProject.galleryByYear || {
                      'General': selectedProject.galleryUrls || []
                    };
                    const sortedFolders = Object.keys(foldersData).sort((a, b) => a.localeCompare(b));

                    return (
                      <div className="relative pl-6 border-l-2 border-slate-100 space-y-8 ml-2">
                        {sortedFolders.map((folder) => {
                          const urls = foldersData[folder] || [];
                          if (urls.length === 0) return null;
                          return (
                            <div key={folder} className="relative">
                              {/* Timeline Node Ring */}
                              <div className="absolute -left-[32px] top-1.5 w-4 h-4 rounded-full bg-white border-4 border-jci-blue ring-4 ring-blue-50 shadow-sm" />

                              <div className="mb-3 flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 bg-slate-100 border border-slate-200/50 px-3 py-1 rounded-xl shadow-sm">
                                  {folder}
                                </span>
                                <span className="text-xs text-slate-400 font-medium">({urls.length} photos)</span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {urls.map((url, imgIndex) => {
                                  const globalIndex = selectedProject.galleryUrls?.indexOf(url) ?? imgIndex;
                                  return (
                                    <div
                                      key={imgIndex}
                                      className="relative group cursor-pointer border border-slate-100 rounded-xl overflow-hidden aspect-video bg-white hover:shadow-md transition-shadow"
                                      onClick={() => setLightboxIndex(globalIndex)}
                                    >
                                      <img
                                        src={url}
                                        alt={`Gallery Item ${folder}-${imgIndex}`}
                                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                      />
                                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white text-xs bg-black/40 px-2 py-1 rounded-md backdrop-blur-sm">Enlarge</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Lightbox / Overlay for Photo Enlarging */}
              {lightboxIndex !== null && selectedProject.galleryUrls && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4">
                  <button
                    className="absolute top-4 right-4 text-white hover:text-slate-300 transition-colors p-2 z-[110]"
                    onClick={() => setLightboxIndex(null)}
                  >
                    <X size={32} />
                  </button>

                  <button
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 transition-colors p-2 z-[110] bg-white/10 hover:bg-white/20 rounded-full"
                    onClick={() => handlePrevPhoto(selectedProject.galleryUrls!.length)}
                  >
                    <ChevronLeft size={36} />
                  </button>

                  <div className="max-w-4xl max-h-[80vh] flex items-center justify-center">
                    <img
                      src={selectedProject.galleryUrls[lightboxIndex]}
                      alt={`Enlarged Gallery Item ${lightboxIndex}`}
                      className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                    />
                  </div>

                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 transition-colors p-2 z-[110] bg-white/10 hover:bg-white/20 rounded-full"
                    onClick={() => handleNextPhoto(selectedProject.galleryUrls!.length)}
                  >
                    <ChevronRight size={36} />
                  </button>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-slate-400 text-sm font-semibold">
                    {lightboxIndex + 1} / {selectedProject.galleryUrls.length}
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <Button onClick={onRegister} className="flex-1 bg-jci-blue text-white hover:bg-jci-blue/90 border-0 py-3 text-sm font-bold shadow-md">
                  Register / Get Involved
                </Button>
                <Button variant="ghost" onClick={() => setSelectedProject(null)} className="flex-1 border border-slate-200 text-slate-700 font-semibold py-3 text-sm">
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </main>
      <GuestFooter />
    </div>
  );
};
