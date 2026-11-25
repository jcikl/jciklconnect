import React, { useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { GuestHeader } from './GuestHeader';
import { GuestFooter } from './GuestFooter';
import { Skeleton } from '../ui/Badge';
import './GuestPages.css';

type Page = React.ComponentProps<typeof GuestHeader>['currentPage'];
type ContentVariant = 'events' | 'projects' | 'board' | 'publications' | 'partners' | 'introduction';

/** Shared public-page presentation; leaves each page's data and actions in place. */
export function GuestPageFrame({ children, page }: { children: React.ReactNode; page: Page }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('gp-in-view');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    const scan = () => {
      if (preference.matches) return;
      element.querySelectorAll('main > section:not(.gp-hero), [data-guest-reveal]').forEach(item => {
        if (seen.has(item)) return;
        seen.add(item);
        item.classList.add('gp-reveal');
        observer.observe(item);
      });
    };
    const configure = () => {
      element.dataset.motion = preference.matches ? 'reduced' : 'enabled';
      if (preference.matches) {
        element.querySelectorAll('.gp-reveal').forEach(item => item.classList.add('gp-in-view'));
      } else scan();
    };
    configure();
    const changes = new MutationObserver(scan);
    changes.observe(element, { childList: true, subtree: true });
    preference.addEventListener('change', configure);
    return () => { observer.disconnect(); changes.disconnect(); preference.removeEventListener('change', configure); };
  }, []);
  return <div ref={root} className={`connect-guest gp-${page}`}>
    <Helmet>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300..800&display=swap" />
    </Helmet>
    {children}
  </div>;
}

/** Layout-matched placeholders built from the existing Skeleton primitive. */
export function GuestContentSkeleton({ variant, label = 'Loading content' }: { variant: ContentVariant; label?: string }) {
  return <div role="status" aria-live="polite" className={`gp-loading gp-loading-${variant}`}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">
      {variant === 'introduction' ? <div className="gp-loading-intro-grid">
        <div><Skeleton className="h-10 w-3/4 mb-6" />{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className={`h-4 mt-3 ${i === 4 ? 'w-2/3' : 'w-full'}`} />)}<Skeleton className="h-10 w-32 mt-6" /></div>
        <Skeleton className="gp-loading-intro-image" rounded="2xl" />
      </div> : variant === 'board' ? <div className="gp-loading-board-levels">
        <div className="gp-loading-board-leaders">{Array.from({ length: 2 }, (_, i) => <div className="gp-loading-board-person" key={i}><Skeleton className="h-24 w-24" rounded="full" /><Skeleton className="h-4 w-3/4 mt-4" /><Skeleton className="h-3 w-1/2 mt-3" /></div>)}</div>
        <div className="gp-loading-board-officers">{Array.from({ length: 4 }, (_, i) => <div className="gp-loading-board-person" key={i}><Skeleton className="h-14 w-14" rounded="xl" /><Skeleton className="h-4 w-3/4 mt-4" /><Skeleton className="h-3 w-1/2 mt-3" /></div>)}</div>
        <div className="gp-loading-board-vps">{Array.from({ length: 5 }, (_, i) => <div className="gp-loading-board-person" key={i}><Skeleton className="h-14 w-14" rounded="xl" /><Skeleton className="h-4 w-3/4 mt-4" /><Skeleton className="h-3 w-1/2 mt-3" /></div>)}</div>
      </div> : variant === 'events' ? <div className="gp-loading-event-grid">
        {Array.from({ length: 3 }, (_, i) => <div className="gp-loading-event" key={i}>
          <Skeleton className="gp-loading-event-image" />
          <div><Skeleton className="h-5 w-full" /><Skeleton className="h-3 w-2/3 mt-3" /><Skeleton className="h-3 w-1/2 mt-2" /><Skeleton className="h-10 w-full mt-6" /></div>
        </div>)}
      </div> : <div className="gp-loading-grid">
        {Array.from({ length: variant === 'projects' ? 2 : variant === 'partners' ? 4 : 3 }, (_, i) => <div key={i} className="gp-loading-card">
          <Skeleton className="gp-loading-image" rounded="lg" />
          <div className="gp-loading-copy"><Skeleton className="h-5 w-4/5" /><Skeleton className="h-3 w-full mt-3" />
          <Skeleton className="h-3 w-2/3 mt-2" />
          {variant === 'projects' && <>
            <Skeleton className="h-3 w-3/4 mt-2" />
            <div className="gp-loading-project-thumbs">{Array.from({ length: 5 }, (_, photo) => <Skeleton key={photo} className="h-12 w-12" />)}</div>
            <div className="gp-loading-project-action"><Skeleton className="h-8 w-32" /></div>
          </>}
          </div>
        </div>)}
      </div>}
    </div>
  </div>;
}

/** Lazy-route fallback includes the same navigation, title space and content geometry. */
export function GuestRouteSkeleton({ page, ...actions }: Omit<React.ComponentProps<typeof GuestHeader>, 'currentPage'> & { page: Page }) {
  const titles: Record<Page, string> = { home: 'Be Better. Do Better.', events: 'Upcoming Events', projects: 'Flagship Projects', about: 'About JCI Kuala Lumpur', enewsletters: 'E-Newsletters', partnerships: 'Member Perks' };
  const variants: Record<Page, ContentVariant> = { home: 'projects', events: 'events', projects: 'projects', about: 'introduction', enewsletters: 'publications', partnerships: 'partners' };
  return <GuestPageFrame page={page}>
    <GuestHeader currentPage={page} {...actions} />
    <main id="main-content" aria-busy="true">
      <section className="gp-hero" aria-label="Page header"><div className="gp-container"><p className="gp-kicker">JCI Kuala Lumpur</p><h1>{titles[page]}</h1><Skeleton className="h-4 w-2/3 mt-5 max-w-xl" /></div></section>
      <section className="gp-body"><div className="gp-container"><GuestContentSkeleton variant={variants[page]} label={`Loading ${titles[page]}`} /></div></section>
    </main>
    <GuestFooter whiteLogo />
  </GuestPageFrame>;
}
