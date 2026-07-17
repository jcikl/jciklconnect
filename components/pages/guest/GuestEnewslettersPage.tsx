import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { BookOpen, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Printer, Share2 } from 'lucide-react';
import { Button, Modal, useToast } from '@/components/ui/Common';
import { PublicationService, toGoogleDrivePreviewUrl, extractGoogleDriveFileId } from '@/services/publicationService';
import { GuestHeader } from '@/components/layout/GuestHeader';
import { GuestFooter } from '@/components/layout/GuestFooter';

// Newsletter thumbnail component with error fallback — not exported
const NewsletterThumbnail = ({ src, alt }: { src: string | null | undefined; alt: string }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <FileText size={40} className="text-slate-300 mb-2 group-hover:scale-110 transition-transform duration-300" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Preview Image</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
      loading="lazy"
    />
  );
};

export const GuestEnewslettersPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => void;
}) => {
  const [dbPublications, setDbPublications] = useState<any[]>([]);
  const [loadingPubs, setLoadingPubs] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchPubs = async () => {
      try {
        const data = await PublicationService.getPublished();
        if (active) {
          setDbPublications(data);
        }
      } catch (err) {
        console.error('Failed to load publications from Firestore', err);
      } finally {
        if (active) setLoadingPubs(false);
      }
    };
    fetchPubs();
    return () => { active = false; };
  }, []);

  const newsletters = useMemo(() => {
    if (loadingPubs) return [];
    const groups: Record<string, any[]> = {};
    dbPublications.forEach(p => {
      groups[p.year] = groups[p.year] || [];
      const driveId = extractGoogleDriveFileId(p.pdfUrl);
      groups[p.year].push({
        issue: p.issue,
        title: p.title,
        link: toGoogleDrivePreviewUrl(p.pdfUrl),
        thumbnail: driveId ? `https://lh3.googleusercontent.com/d/${driveId}=w400` : null,
      });
    });
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(year => ({
        year,
        items: groups[year]
      }));
  }, [dbPublications, loadingPubs]);

  // Year tab filter
  const [activeYearTab, setActiveYearTab] = useState<string | null>(null);

  // Initialize to latest year when newsletters load
  React.useEffect(() => {
    if (newsletters.length > 0 && !activeYearTab) {
      setActiveYearTab(newsletters[0].year);
    }
  }, [newsletters]);

  const displayedNewsletters = activeYearTab
    ? newsletters.filter(g => g.year === activeYearTab)
    : newsletters;

  // PDF Reader State
  const [selectedNewsletter, setSelectedNewsletter] = useState<{
    issue: string;
    title: string;
    link: string;
    year: string;
    thumbnail?: string | null;
  } | null>(null);

  const [readerTheme, setReaderTheme] = useState<'light' | 'dark'>('dark');
  const [readerZoom, setReaderZoom] = useState<'fit' | 'wide' | 'full'>('fit');

  const { showToast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Flattened newsletters to support simple navigation inside reader
  const flatNewsletters = newsletters.flatMap((yg) =>
    yg.items.map((item) => ({ ...item, year: yg.year }))
  );

  const currentIdx = selectedNewsletter
    ? flatNewsletters.findIndex(
      (item) =>
        item.title === selectedNewsletter.title &&
        item.issue === selectedNewsletter.issue
    )
    : -1;

  const handlePrevNewsletter = () => {
    if (currentIdx > 0) {
      setSelectedNewsletter(flatNewsletters[currentIdx - 1]);
    }
  };

  const handleNextNewsletter = () => {
    if (currentIdx < flatNewsletters.length - 1) {
      setSelectedNewsletter(flatNewsletters[currentIdx + 1]);
    }
  };

  const activeUrl = selectedNewsletter && selectedNewsletter.link !== '#' ? selectedNewsletter.link : null;

  const handleCopyLink = () => {
    if (!selectedNewsletter) return;
    const currentUrl = window.location.href.split('#')[0];
    const hash = `newsletter-${selectedNewsletter.year}-${selectedNewsletter.issue.replace(/\s+/g, '-').toLowerCase()}`;
    navigator.clipboard.writeText(`${currentUrl}#${hash}`);
    showToast('Direct newsletter link copied to clipboard!', 'success');
  };

  const handlePrint = () => {
    if (iframeRef.current && activeUrl) {
      try {
        iframeRef.current.contentWindow?.print();
      } catch (e) {
        window.open(activeUrl, '_blank', 'noopener,noreferrer');
        showToast('Opening PDF in new tab to print due to browser cross-origin policy.', 'info');
      }
    } else {
      showToast('Load a PDF document to trigger printing.', 'error');
    }
  };

  const totalIssues = newsletters.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>E-Newsletters — JCI Kuala Lumpur</title>
        <meta name="description" content="Read JCI Kuala Lumpur's latest e-newsletters covering chapter news, events, member highlights, and community updates." />
        <link rel="canonical" href="https://jcikl.cc/enewsletters" />
        <meta property="og:title" content="E-Newsletters — JCI Kuala Lumpur" />
        <meta property="og:description" content="Read JCI Kuala Lumpur's latest e-newsletters and chapter updates." />
        <meta property="og:image" content="/JCI%20Kuala%20Lumpur-transparent.png" />
        <meta property="og:url" content="https://jcikl.cc/enewsletters" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      <GuestHeader currentPage="enewsletters" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        {/* Hero */}
        <section className="relative py-14 md:py-20 bg-gradient-to-br from-jci-navy via-[#1a3d7c] to-jci-blue overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-jci-blue/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest mb-3">Publications</p>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4">E-Newsletters</h1>
            <p className="text-blue-200 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Stories, projects, achievements and impact from JCI Kuala Lumpur — curated every term.
            </p>
            {!loadingPubs && totalIssues > 0 && (
              <div className="flex items-center justify-center gap-6 md:gap-10 mt-8">
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-black text-white">{totalIssues}</p>
                  <p className="text-blue-300 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Issue{totalIssues !== 1 ? 's' : ''}</p>
                </div>
                <div className="w-px h-8 bg-white/15" />
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-black text-white">{newsletters.length}</p>
                  <p className="text-blue-300 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Year{newsletters.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {loadingPubs ? (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jci-blue mx-auto mb-4" />
                <p className="text-slate-500 text-sm">Loading publications...</p>
              </div>
            ) : newsletters.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm max-w-xl mx-auto p-10">
                <BookOpen size={44} className="text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-black text-slate-800 mb-2">No Publications Yet</h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
                  There are currently no published newsletters. Please check back later!
                </p>
              </div>
            ) : (
              <div className="space-y-10">
                {/* Year tab filter */}
                {newsletters.length > 1 && (
                  <div className="flex items-end justify-between mb-2">
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                      {newsletters.map(g => (
                        <button
                          key={g.year}
                          onClick={() => setActiveYearTab(g.year)}
                          className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${activeYearTab === g.year ? 'bg-jci-blue text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-jci-blue hover:text-jci-blue'}`}
                        >
                          {g.year}
                          <span className="ml-1.5 text-xs opacity-60">({g.items.length})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {displayedNewsletters.map((yearGroup) => (
                  <div key={yearGroup.year}>
                    <div className="flex items-center gap-3 mb-6">
                      <h2 className="text-xl font-black text-slate-900">
                        {yearGroup.year} Publications
                      </h2>
                      <span className="bg-blue-50 text-jci-blue font-bold px-3 py-1 rounded-full text-xs border border-blue-100">
                        {yearGroup.items.length} {yearGroup.items.length === 1 ? 'Issue' : 'Issues'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
                      {yearGroup.items.map((item, index) => (
                        <div
                          key={index}
                          onClick={() => setSelectedNewsletter({ ...item, year: yearGroup.year })}
                          className="group cursor-pointer flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                        >
                          {/* Thumbnail */}
                          <div className="relative overflow-hidden bg-slate-100 border-b border-slate-100" style={{ aspectRatio: '210/297' }}>
                            <NewsletterThumbnail src={item.thumbnail} alt={`${item.title} Cover`} />
                            <div className="absolute top-2 left-2 z-10">
                              <span className="text-[9px] font-black uppercase tracking-wider bg-jci-blue text-white px-2.5 py-1 rounded-full shadow-sm">
                                {item.issue}
                              </span>
                            </div>
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-jci-navy/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                              <span className="flex items-center gap-1.5 bg-white text-jci-navy text-xs font-black px-4 py-2 rounded-full shadow-lg">
                                <BookOpen size={12} /> Read
                              </span>
                            </div>
                          </div>

                          <div className="p-3 flex flex-col flex-1">
                            <h3 className="text-xs font-black text-slate-900 group-hover:text-jci-blue transition-colors leading-snug line-clamp-2 mb-2" title={item.title}>
                              {item.title}
                            </h3>
                            <div className="mt-auto flex items-center justify-between">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{yearGroup.year}</span>
                              <ChevronRight size={12} className="text-slate-300 group-hover:text-jci-blue transition-colors" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-gradient-to-br from-jci-navy to-jci-blue overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <FileText size={28} className="text-white/80" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-black text-white mb-2">Want to stay updated?</h2>
              <p className="text-blue-200 text-sm leading-relaxed max-w-lg">
                Become a JCI Kuala Lumpur member to receive our newsletters directly and be part of the stories we tell every term.
              </p>
            </div>
            <Button size="lg" variant="outline" onClick={onRegister}
              className="shrink-0 bg-white !text-jci-navy border-white hover:bg-sky-50 hover:!text-jci-navy font-black shadow-lg">
              Join JCI Kuala Lumpur
            </Button>
          </div>
        </section>
      </main>

      <GuestFooter />

      {/* PDF Viewer Interactive Modal */}
      {selectedNewsletter && (
        <Modal
          isOpen={!!selectedNewsletter}
          onClose={() => setSelectedNewsletter(null)}
          title={
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
              <span className="bg-sky-100 text-jci-blue text-xs font-bold px-2.5 py-1 rounded-md uppercase self-start md:self-auto">
                {selectedNewsletter.year} · {selectedNewsletter.issue}
              </span>
              <h2 className="text-lg font-bold text-slate-800 line-clamp-1">{selectedNewsletter.title}</h2>
            </div>
          }
          size="4xl"
          scrollInBody={false}
          className="h-[92vh] max-h-[92vh] md:max-h-[92vh] flex flex-col"
        >
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 h-full">

            {/* Left Viewer pane */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 relative min-h-[400px] md:min-h-0">

              {/* Toolbar */}
              <div className="bg-slate-950/90 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 z-10 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                    {(['light', 'dark'] as const).map(t => (
                      <button key={t} onClick={() => setReaderTheme(t)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${readerTheme === t ? (t === 'light' ? 'bg-white text-slate-900 shadow' : 'bg-slate-950 text-white shadow') : 'text-slate-400 hover:text-white'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {activeUrl && (
                  <div className="hidden sm:flex items-center gap-2 bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                    {([['fit', 'Standard'], ['wide', 'Wide'], ['full', 'Full Width']] as const).map(([z, label]) => (
                      <button key={z} onClick={() => setReaderZoom(z)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${readerZoom === z ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  {activeUrl && (
                    <>
                      <button onClick={handlePrint} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all" title="Print PDF">
                        <Printer size={16} />
                      </button>
                      <a href={activeUrl} download={`${selectedNewsletter.title.replace(/\s+/g, '_')}.pdf`}
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all" title="Download PDF">
                        <Download size={16} />
                      </a>
                      <a href={activeUrl} target="_blank" rel="noopener noreferrer"
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all" title="Open in new tab">
                        <ExternalLink size={16} />
                      </a>
                    </>
                  )}
                  <button onClick={handleCopyLink} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all" title="Share">
                    <Share2 size={16} />
                  </button>
                </div>
              </div>

              {/* Reader viewport */}
              <div className={`flex-1 h-full flex flex-col justify-between p-4 ${readerTheme === 'dark' ? 'bg-slate-950' : 'bg-slate-100'} transition-colors duration-300 relative overflow-y-auto`}>
                {activeUrl ? (
                  <div className="flex-grow w-full flex justify-center items-center h-full min-h-[300px]">
                    <iframe
                      ref={iframeRef}
                      src={activeUrl}
                      title={selectedNewsletter.title}
                      className={`h-full rounded-lg border shadow-2xl transition-all duration-300 ${readerTheme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-300 bg-white'} ${readerZoom === 'fit' ? 'w-full max-w-3xl' : readerZoom === 'wide' ? 'w-full max-w-5xl' : 'w-full'}`}
                      style={{ height: '100%', minHeight: '520px' }}
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[480px]">
                    <div className="w-full max-w-xs bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                      <div className="bg-gradient-to-br from-jci-navy via-jci-blue to-sky-500 p-8 text-white text-center relative overflow-hidden">
                        <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-white/10 rounded-full" />
                        <div className="absolute -left-10 -top-10 w-28 h-28 bg-white/5 rounded-full" />
                        <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-4">
                          <BookOpen size={28} className="text-white/80" />
                        </div>
                        <h2 className="text-base font-black leading-snug mb-1">{selectedNewsletter.title}</h2>
                        <p className="text-xs text-sky-200/80 font-semibold">{selectedNewsletter.issue} · {selectedNewsletter.year}</p>
                      </div>
                      <div className="p-5 text-center">
                        <p className="text-xs text-slate-500 leading-relaxed">PDF preview is not available for this issue. Use the buttons above to open or download.</p>
                        {activeUrl === null && selectedNewsletter.link !== '#' && (
                          <a href={selectedNewsletter.link} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 mt-4 text-xs font-black text-jci-blue hover:underline">
                            <ExternalLink size={12} /> Open in Google Drive
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Issue navigation bar */}
                <div className="bg-slate-900/85 px-4 py-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-white text-xs max-w-sm mx-auto w-full mt-4 backdrop-blur shadow-xl">
                  <button onClick={handlePrevNewsletter} disabled={currentIdx <= 0}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1 font-semibold">
                    <ChevronLeft size={16} /><span>Prev</span>
                  </button>
                  <span className="font-bold text-slate-400 select-none">
                    {currentIdx + 1} / {flatNewsletters.length}
                  </span>
                  <button onClick={handleNextNewsletter} disabled={currentIdx >= flatNewsletters.length - 1}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1 font-semibold">
                    <span>Next</span><ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Right archive panel */}
            <div className="w-full md:w-72 bg-white flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={13} className="text-jci-blue" /> All Issues
                </h3>
                <span className="bg-blue-50 text-jci-blue font-bold px-2 py-0.5 rounded-full text-[10px] border border-blue-100">
                  {flatNewsletters.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <div className="space-y-2">
                  {flatNewsletters.map((item, idx) => {
                    const isCurrent = item.title === selectedNewsletter.title && item.issue === selectedNewsletter.issue;
                    return (
                      <div key={idx} onClick={() => setSelectedNewsletter(item)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${isCurrent ? 'bg-blue-50 border-jci-blue shadow-sm' : 'bg-slate-50/50 border-slate-200/60 hover:bg-slate-50 hover:border-slate-300'}`}>
                        <FileText size={14} className={`flex-shrink-0 mt-0.5 ${isCurrent ? 'text-jci-blue' : 'text-slate-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-black truncate leading-tight ${isCurrent ? 'text-jci-blue' : 'text-slate-700'}`}>{item.title}</p>
                          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{item.year} · {item.issue}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
