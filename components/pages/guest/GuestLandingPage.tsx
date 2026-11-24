import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowUpRight, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/Common';
import { useEvents } from '@/hooks/useEvents';
import { EventRow } from '@/components/modules/Events/EventRow';
import { useNavigate } from 'react-router-dom';
import { isKlRelevantEvent } from '@/utils/loHosting.mjs';
import { BoardManagementService } from '@/services/boardManagementService';
import { trimCloudinaryImage } from '@/services/cloudinaryService';
import { GuestHeader } from '@/components/layout/GuestHeader';
import { GuestFooter } from '@/components/layout/GuestFooter';
import './GuestLandingPage.css';

export const GuestLandingPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'partnerships') => void;
}) => {
  const currentYear = String(new Date().getFullYear());
  const chapterYears = Number(currentYear) - 1954;
  const numbersSection = useRef<HTMLParagraphElement>(null);
  const [chapterNumbers, setChapterNumbers] = useState({ years: chapterYears, countries: 100, communities: 5000 });
  const [activePillar, setActivePillar] = useState(0);
  const pillarSection = useRef<HTMLElement>(null);
  const pillarRail = useRef<HTMLDivElement>(null);
  const [president, setPresident] = useState<{ name: string; avatar: string; company: string } | null>(null);
  const [termSettings, setTermSettings] = useState<{ presidentTheme?: string; tagline?: string; shortDescription?: string; logoUrl?: string; memberGroupPhotoUrl?: string } | null>(null);
  // Retain the existing public, upcoming-only query and KL relevance rules.
  const { events } = useEvents({ publicMode: true, scope: 'upcoming' });
  const navigate = useNavigate();
  const openEvent = (eventId: string) => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    navigate(`/events?event=${encodeURIComponent(eventId)}`);
  };
  const upcomingEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return events
      .filter(e => e.date && new Date(e.date) >= today && isKlRelevantEvent(e as any))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);
  useEffect(() => {
    Promise.all([
      BoardManagementService.getBoardMembersByYear(currentYear),
      BoardManagementService.getBoardTermSettings(currentYear),
    ]).then(([members, ts]) => {
      const pres = members.find(m => m.position === 'President' && m.isActive);
      if (pres) setPresident({ name: pres.memberName || 'JCI Member', avatar: pres.boardAvatarUrl || pres.avatarUrl || '', company: pres.companyName || 'JCI Kuala Lumpur' });
      if (ts) setTermSettings(ts);
    }).catch(() => { });
  }, [currentYear]);
  const pillars = [
    { image: '/pillars/business-portrait.webp', title: 'Business', label: 'Business & Entrepreneurship', description: 'Connect with entrepreneurs, grow your network, and sharpen your professional edge.' },
    { image: '/pillars/community-portrait.webp', title: 'Community', label: 'Community Impact', description: 'Lead meaningful service projects that create lasting impact in Kuala Lumpur.' },
    { image: '/pillars/international-portrait.webp', title: 'International', label: 'International Cooperation', description: 'Join a worldwide network spanning 124 countries and 200,000 active members.' },
    { image: '/pillars/individual-portrait.webp', title: 'Individual', label: 'Individual Development', description: 'Unlock your leadership potential through training, mentorship, and real experiences.' },
  ];
  useEffect(() => {
    const sections = document.querySelectorAll('.connect-home .home-section, .connect-home .home-organization, .connect-home .home-legacy');
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('home-in-view');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });
    sections.forEach(section => { section.classList.add('home-reveal'); observer.observe(section); });
    const words = document.querySelectorAll('.connect-home .home-organization-values li');
    const wordObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('home-word-on', entry.isIntersecting));
    }, { rootMargin: '-35% 0px -35% 0px', threshold: 0 });
    words.forEach(word => wordObserver.observe(word));
    return () => {
      observer.disconnect(); wordObserver.disconnect();
      sections.forEach(section => section.classList.remove('home-reveal', 'home-in-view'));
      words.forEach(word => word.classList.remove('home-word-on'));
    };
  }, [upcomingEvents.length, president]);
  useEffect(() => {
    const section = numbersSection.current;
    if (!section) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finalNumbers = { years: chapterYears, countries: 100, communities: 5000 };
    let frame = 0;
    const finish = () => { cancelAnimationFrame(frame); setChapterNumbers(finalNumbers); };
    const onPreferenceChange = () => { if (preference.matches) finish(); };
    if (preference.matches || !('IntersectionObserver' in window)) { finish(); return; }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      if (preference.matches) { finish(); return; }
      section.classList.add('home-numbers-entered');
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / 1400);
        const eased = 1 - Math.pow(1 - progress, 3);
        setChapterNumbers({ years: Math.round(chapterYears * eased), countries: Math.round(100 * eased), communities: Math.round(5000 * eased) });
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: .2 });
    observer.observe(section);
    preference.addEventListener('change', onPreferenceChange);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); preference.removeEventListener('change', onPreferenceChange); };
  }, [chapterYears]);
  // Vertical page progress moves the native horizontal rail; no wheel/touch cancellation.
  useEffect(() => {
    const section = pillarSection.current, rail = pillarRail.current;
    const sticky = section?.querySelector<HTMLElement>('.home-pillar-sticky');
    if (!section || !rail || !sticky) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const sync = () => {
      frame = 0;
      if (preference.matches || section.dataset.scrollLinked !== 'true') return;
      const top = parseFloat(getComputedStyle(sticky).top) || 0;
      const distance = section.offsetHeight - sticky.offsetHeight;
      const progress = Math.max(0, Math.min(1, (top - section.getBoundingClientRect().top) / Math.max(1, distance)));
      rail.scrollLeft = progress * (rail.scrollWidth - rail.clientWidth);
      setActivePillar(Math.round(progress * 3));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
    const configure = () => {
      section.dataset.scrollLinked = String(!preference.matches);
      const stickyTop = window.innerWidth < 768 ? 64 : 80;
      section.dataset.scrollLinked = String(!preference.matches && window.innerHeight >= sticky.offsetHeight + stickyTop);
      schedule();
    };
    configure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', configure);
    preference.addEventListener('change', configure);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    observer?.observe(sticky);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', configure);
      preference.removeEventListener('change', configure);
      observer?.disconnect();
      delete section.dataset.scrollLinked;
    };
  }, []);
  const selectPillar = (index: number) => {
    setActivePillar(index);
    const section = pillarSection.current, rail = pillarRail.current;
    const sticky = section?.querySelector<HTMLElement>('.home-pillar-sticky');
    if (!section || !rail || !sticky) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && section.dataset.scrollLinked === 'true') {
      const top = parseFloat(getComputedStyle(sticky).top) || 0;
      window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top - top + (section.offsetHeight - sticky.offsetHeight) * index / 3, behavior: 'smooth' });
    } else {
      rail.scrollTo({ left: (rail.scrollWidth - rail.clientWidth) * index / 3, behavior: reduced ? 'instant' : 'smooth' });
    }
  };
  const ogImage = termSettings?.memberGroupPhotoUrl || '/JCI%20Kuala%20Lumpur-transparent.png';
  return (
    <div className="connect-home">
      <Helmet>
        <title>JCI Kuala Lumpur — Be Better. Do Better.</title>
        <meta name="description" content="JCI Kuala Lumpur is the first Malaysia Junior Chamber Chapter — a global network of young active citizens creating positive change since 1954." />
        <link rel="canonical" href="https://jcikl.cc/" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300..800&display=swap" />
        <meta property="og:title" content="JCI Kuala Lumpur — Be Better. Do Better." />
        <meta property="og:description" content="JCI Kuala Lumpur is the first Malaysia Junior Chamber Chapter — a global network of young active citizens creating positive change since 1954." />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content="https://jcikl.cc/" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org', '@type': 'Organization', name: 'JCI Kuala Lumpur',
          url: 'https://jcikl.cc', logo: 'https://jcikl.cc/JCI%20Kuala%20Lumpur-transparent.png',
          foundingDate: '1954', address: { '@type': 'PostalAddress', addressLocality: 'Kuala Lumpur', addressCountry: 'MY' }, sameAs: ['https://jci.cc'],
        })}</script>
      </Helmet>
      <GuestHeader currentPage="home" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />
      <main id="main-content">
        <section className="home-hero home-container" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <p className="home-context">JCI Kuala Lumpur · Since 1954</p>
            <h1 id="home-title"><span className="home-title-line">Be Better.</span>{' '}<span className="home-title-line">Do Better.</span></h1>
            <p className="sr-only">Since 1954, Malaysia’s first Junior Chamber chapter has spent {chapterYears} years developing young leaders, as part of a JCI network active in over 100 countries and more than 5,000 communities.</p>
            <p ref={numbersSection} className="home-intro home-numbers-copy" aria-hidden="true">Since <strong>1954</strong>, Malaysia’s first Junior Chamber chapter has spent <strong className="home-number-accent">{chapterNumbers.years}</strong> years developing young leaders, as part of a JCI network active in over <strong>{chapterNumbers.countries}</strong> countries and more than <strong>{chapterNumbers.communities.toLocaleString('en-US')}</strong> communities.</p>
            <div className="home-actions">
              <button type="button" onClick={onRegister} className="home-primary">Become a Member <ArrowUpRight size={18} aria-hidden="true" /></button>
              <button onClick={() => onPageChange('events')} className="home-text-link">View activities <ChevronRight size={17} aria-hidden="true" /></button>
            </div>
            <div className="home-hero-note"><span>Malaysia’s first Junior Chamber chapter.</span><span>A local community. A global network.</span></div>
          </div>
          <figure className="home-hero-photo">
            <div className="home-photo-stage">
              <span className="home-photo-ring home-photo-ring-outer" aria-hidden="true" />
              <span className="home-photo-ring home-photo-ring-inner" aria-hidden="true" />
              <div className="home-photo-window">
                <img key={termSettings?.memberGroupPhotoUrl || 'fallback'} src={termSettings?.memberGroupPhotoUrl || '/pillars/community-portrait.webp'} alt="JCI Kuala Lumpur members together" fetchPriority="high" />
                {termSettings?.memberGroupPhotoUrl && <img className="home-photo-alternate" src="/pillars/community-portrait.webp" alt="JCI community participation" aria-hidden="true" />}
              </div>
            </div>
            <figcaption><span>People. Possibilities. Purpose.</span></figcaption>
            <p className="home-photo-location">Kuala Lumpur, Malaysia</p>
          </figure>
        </section>
        {upcomingEvents.length > 0 && (
          <section className="home-section home-container" aria-labelledby="home-events-title">
            <div className="home-section-heading">
              <div><p className="home-context">Make your next connection</p><h2 id="home-events-title">Coming up at JCI KL.</h2></div>
              <button onClick={() => onPageChange('events')} className="home-text-link">All activities <ArrowUpRight size={17} aria-hidden="true" /></button>
            </div>
            <div className="home-events-list">{upcomingEvents.map(event => <EventRow key={event.id} event={event} horizontal onClick={() => openEvent(event.id)} onRegister={() => openEvent(event.id)} />)}</div>
          </section>
        )}
        <section className="home-organization" aria-labelledby="home-organization-title">
          <div className="home-container">
            <h2 id="home-organization-title"><span>Not just a network.</span><strong>A place to lead.</strong></h2>
            <div className="home-organization-columns">
              <p>At JCI Kuala Lumpur, leadership isn’t something you study from the sidelines. You practise it. Members plan real projects, run real teams, work with real partners and solve real problems in the city they live in.</p>
              <div>
                <p>Some people arrive to meet new people. They stay because someone handed them the microphone, the timeline and the responsibility. Since 1954, Malaysia’s first Junior Chamber chapter has been a training ground for people aged 18 to 40 who would rather build than wait.</p>
                <button type="button" onClick={() => onPageChange('about')} className="home-story-link">Read our story <span aria-hidden="true"><ChevronRight size={20} /></span></button>
              </div>
            </div>
            <ul className="home-organization-values">
              <li><h3>Learn.</h3><p>Training, coaching and feedback you use the same month.</p></li>
              <li><h3>Lead.</h3><p>Chair a project, run a team, own the outcome.</p></li>
              <li><h3>Connect.</h3><p>Meet founders, professionals and changemakers outside your usual circle.</p></li>
              <li><h3>Impact.</h3><p>Leave Kuala Lumpur a little better than you found it.</p></li>
            </ul>
          </div>
        </section>
        <section ref={pillarSection} className="home-pillar-scroll home-container" aria-labelledby="home-pillars-title">
          <div className="home-pillar-sticky">
          <div className="home-section-heading"><div><p className="home-context">The four pillars of JCI</p><h2 id="home-pillars-title">Find your way to grow.</h2></div><p>Real experiences. New perspectives.<br />A place to put your ideas into practice.</p></div>
          <div ref={pillarRail} className="home-pillars home-pillars-interactive" tabIndex={0} role="group" aria-label="Four areas of opportunity" onKeyDown={event => {
            if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? pillars.length - 1 : (activePillar + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + pillars.length) % pillars.length;
            selectPillar(next);
            (pillarRail.current?.children[next] as HTMLElement | undefined)?.focus({ preventScroll: true });
          }}>{pillars.map((pillar, index) => <article key={pillar.title} id={`home-pillar-panel-${index}`} role="region" aria-label={pillar.label} className={activePillar === index ? 'is-active' : ''} tabIndex={0} onKeyDown={event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); selectPillar(index); } }}>
            <button type="button" className="home-pillar-collapsed" aria-label={`Expand ${pillar.label}`} aria-expanded={activePillar === index} onClick={() => selectPillar(index)}><span>{pillar.label}</span><span className="home-pillar-mark" aria-hidden="true" /></button>
            <h3>{pillar.label}</h3><img src={pillar.image} alt={pillar.title} loading="lazy" width="400" height="533" /><p>{pillar.description}</p>
          </article>)}</div>
          <button onClick={() => onPageChange('projects')} className="home-text-link home-project-link">Explore flagship projects <ArrowUpRight size={18} aria-hidden="true" /></button>
          </div>
        </section>
        <div className="home-legacy">
{/* President Spotlight */}
        {president && (
          <section className="relative bg-jci-navy overflow-hidden">

            {/* ── Background layer ── */}
            <div className="absolute inset-0 pointer-events-none select-none z-0">
              <div className="absolute bottom-0 right-0 leading-none font-black text-white/[0.04] text-[140px] lg:text-[200px]">
                {currentYear}
              </div>
              <style>{`
                @keyframes stripe-wipe {
                  0%   { -webkit-mask-position: -100% 0; mask-position: -100% 0; }
                  100% { -webkit-mask-position: 200% 0;  mask-position: 200% 0; }
                }
              `}</style>
              {/* Base stripes — always visible */}
              <div className="absolute inset-0 opacity-[0.025]"
                style={{ backgroundImage: 'repeating-linear-gradient(135deg, white 0px, white 1px, transparent 1px, transparent 40px)' }} />
              {/* Bright stripes — revealed left to right via mask */}
              <div className="absolute inset-0 opacity-[0.13]"
                style={{
                  backgroundImage: 'repeating-linear-gradient(135deg, white 0px, white 1px, transparent 1px, transparent 40px)',
                  WebkitMaskImage: 'linear-gradient(to right, transparent 0%, white 25%, white 75%, transparent 100%)',
                  maskImage: 'linear-gradient(to right, transparent 0%, white 25%, white 75%, transparent 100%)',
                  WebkitMaskSize: '60% 100%',
                  maskSize: '60% 100%',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  animation: 'stripe-wipe 4s ease-in-out infinite',
                }} />
              <div className="absolute top-0 left-1/2 w-96 h-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-jci-blue/15 blur-3xl" />
              <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-sky-600/10 blur-3xl" />
            </div>

            {/* ── MOBILE: full-bleed cinematic overlay ── */}
            <div className="lg:hidden relative h-[620px] overflow-hidden">
              {president.avatar ? (
                <img src={president.avatar} alt={president.name}
                  className="absolute inset-0 w-full h-full object-cover object-top" />
              ) : (
                <div className="absolute inset-0 bg-white/5" />
              )}
              {/* Gradient anchored to bottom — stops 100px above president name */}
              <div className="absolute bottom-0 inset-x-0 h-[50%] bg-gradient-to-t from-jci-navy via-jci-navy/100 to-transparent" />

              {/* Content overlay */}
              <div className="absolute inset-0 z-10 flex flex-col justify-end">
                <div className="px-5 pb-7 space-y-3">

                  {/* President identity row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-black text-base leading-tight">{president.name}</p>
                      <p className="text-white/45 text-[11px] mt-0.5">{president.company}</p>
                    </div>
                    <div className="bg-amber-400 text-jci-navy text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                      President {currentYear}
                    </div>
                  </div>

                  {/* Amber divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-amber-400/25" />
                    <div className="w-1 h-1 rounded-full bg-amber-400/50" />
                    <div className="flex-1 h-px bg-amber-400/25" />
                  </div>

                  {/* Eyebrow */}
                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-400/75">Presidential Theme {currentYear}</p>

                  {/* Headline + logo side by side */}
                  {(() => {
                    const raw = termSettings?.presidentTheme || 'Ignite. Lead. Transform.';
                    const parts = raw.split('.').map((s: string) => s.trim()).filter(Boolean);
                    const lineH = 1.8; // rem: text-[2rem] × leading-[0.9]
                    const containerH = `${(parts.length * lineH).toFixed(2)}rem`;
                    return (
                      <div className="flex items-center gap-4" style={{ height: containerH }}>
                        <div className="flex-1 flex flex-col justify-center h-full">
                          {parts.map((part: string, i: number) => (
                            <h2 key={i} className={`text-[2rem] font-black leading-[0.9] tracking-tight whitespace-nowrap ${i === Math.floor(parts.length / 2)
                              ? 'bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent'
                              : 'text-white'
                              }`}>
                              {part}.
                            </h2>
                          ))}
                        </div>
                        {termSettings?.logoUrl && (
                          <div className="relative shrink-0 h-full">
                            <div className="absolute inset-0 scale-[2] rounded-full bg-amber-400/20 blur-xl animate-pulse" />
                            <img src={trimCloudinaryImage(termSettings.logoUrl)} alt="Presidential theme logo"
                              className="relative z-10 h-full w-auto object-contain drop-shadow-2xl"
                              onError={(e) => { e.currentTarget.parentElement!.style.display = 'none'; }} />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {termSettings?.tagline && (
                    <p className="text-amber-300/80 text-[10px] font-black uppercase tracking-widest mb-2">{termSettings.tagline}</p>
                  )}

                  {/* Description — capped at 2 lines */}
                  <p className="text-white/50 text-[11px] leading-relaxed line-clamp-2">
                    {termSettings?.shortDescription || 'JCI Kuala Lumpur commits to igniting the spark of leadership in every young active citizen — building a community that leads with purpose.'}
                  </p>

                  {/* CTA full-width */}
                  <button onClick={() => onPageChange('about')}
                    className="w-full flex items-center justify-center gap-2 text-xs font-black text-jci-navy bg-amber-400 hover:bg-amber-300 active:scale-95 py-3 rounded-xl transition-all shadow-lg shadow-amber-400/20">
                    <Users size={13} /> Meet the Board
                  </button>
                </div>
              </div>
            </div>

            {/* ── DESKTOP: two-panel grid ── */}
            <div className="hidden lg:grid lg:grid-cols-[5fr_8fr] lg:min-h-[560px] relative">

              {/* Left: photo panel */}
              <div className="relative overflow-hidden">
                {president.avatar ? (
                  <img src={president.avatar} alt={president.name}
                    className="absolute inset-0 w-full h-full object-cover object-top scale-100" />
                ) : (
                  <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
                    <span className="text-8xl font-black text-white/20">{president.name.charAt(0)}</span>
                  </div>
                )}
                <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-jci-navy to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-jci-navy/100 to-transparent" />
                <div className="absolute bottom-8 inset-x-0 flex flex-col items-center gap-1 z-10">
                  <p className="text-white font-black text-xl drop-shadow-lg leading-snug">{president.name}</p>
                  <p className="text-white/55 text-sm drop-shadow">{president.company}</p>
                  <div className="mt-2 bg-amber-400 text-jci-navy text-[9px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                    President {currentYear}
                  </div>
                </div>
              </div>

              {/* Vertical amber divider — between panels */}
              <div className="absolute inset-y-0 flex flex-col items-center py-10 pointer-events-none z-10" style={{ left: 'calc(5 / 13 * 100%)', transform: 'translateX(-50%)' }}>
                <div className="flex-1 w-px bg-gradient-to-b from-transparent via-amber-400/35 to-transparent" />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60 my-1 animate-pulse" />
                <div className="flex-1 w-px bg-gradient-to-b from-transparent via-amber-400/35 to-transparent" />
              </div>

              {/* Right: content panel */}
              <div className="flex items-center px-12 xl:px-16 py-16">
                <div className="w-full max-w-lg">

                  {/* Eyebrow */}
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-5 h-px bg-amber-400/50 shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-400/80">Presidential Theme {currentYear}</span>
                  </div>

                  {/* Headline + logo side by side */}
                  {(() => {
                    const raw = termSettings?.presidentTheme || 'Ignite. Lead. Transform.';
                    const parts = raw.split('.').map((s: string) => s.trim()).filter(Boolean);
                    // text-5xl leading-[0.92] = 3rem × 0.92; xl:text-[3.5rem] leading-[0.92] = 3.5rem × 0.92
                    const containerH = `${(parts.length * 2.76).toFixed(2)}rem`;
                    return (
                      <div className="flex items-center gap-6 mb-4 xl:hidden" style={{ height: containerH }}>
                        <div className="flex-1 flex flex-col justify-center h-full">
                          {parts.map((part: string, i: number) => (
                            <h2 key={i} className={`text-5xl font-black leading-[0.92] tracking-tight whitespace-nowrap ${i === Math.floor(parts.length / 2)
                              ? 'bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent'
                              : 'text-white'
                              }`}>
                              {part}.
                            </h2>
                          ))}
                        </div>
                        {termSettings?.logoUrl && (
                          <div className="relative shrink-0 h-full">
                            <div className="absolute inset-0 scale-[2.5] rounded-full bg-amber-400/15 blur-2xl animate-pulse" />
                            <img src={trimCloudinaryImage(termSettings.logoUrl)} alt="Presidential theme logo"
                              className="relative z-10 h-full w-auto object-contain drop-shadow-2xl"
                              onError={(e) => { e.currentTarget.parentElement!.style.display = 'none'; }} />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {(() => {
                    const raw = termSettings?.presidentTheme || 'Ignite. Lead. Transform.';
                    const parts = raw.split('.').map((s: string) => s.trim()).filter(Boolean);
                    const containerH = `${(parts.length * 3.22).toFixed(2)}rem`;
                    return (
                      <div className="hidden xl:flex items-center gap-6 mb-4" style={{ height: containerH }}>
                        <div className="flex-1 flex flex-col justify-center h-full">
                          {parts.map((part: string, i: number) => (
                            <h2 key={i} className={`text-[3.5rem] font-black leading-[0.92] tracking-tight whitespace-nowrap ${i === Math.floor(parts.length / 2)
                              ? 'bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent'
                              : 'text-white'
                              }`}>
                              {part}.
                            </h2>
                          ))}
                        </div>
                        {termSettings?.logoUrl && (
                          <div className="relative shrink-0 h-full">
                            <div className="absolute inset-0 scale-[2.5] rounded-full bg-amber-400/15 blur-2xl animate-pulse" />
                            <img src={trimCloudinaryImage(termSettings.logoUrl)} alt="Presidential theme logo"
                              className="relative z-10 h-full w-auto object-contain drop-shadow-2xl"
                              onError={(e) => { e.currentTarget.parentElement!.style.display = 'none'; }} />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {termSettings?.tagline && (
                    <p className="text-amber-300/75 text-[10px] font-black uppercase tracking-widest mb-5">{termSettings.tagline}</p>
                  )}

                  <div className="w-10 h-0.5 bg-amber-400/40 mb-5" />

                  {/* Pull quote description */}
                  <div className="border-l-2 border-amber-400/40 pl-4 bg-white/[0.03] rounded-r-lg py-3 pr-3 mb-7">
                    <p className="text-white/55 text-sm leading-relaxed">
                      {termSettings?.shortDescription || 'JCI Kuala Lumpur commits to igniting the spark of leadership in every young active citizen — building a community that leads with purpose and transforms Kuala Lumpur for generations to come.'}
                    </p>
                  </div>

                  <button onClick={() => onPageChange('about')}
                    className="inline-flex items-center gap-2 text-xs font-black text-jci-navy bg-amber-400 hover:bg-amber-300 active:scale-95 px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-400/20">
                    <Users size={13} /> Meet the Board
                  </button>

                </div>
              </div>

            </div>
          </section>
        )}
        </div>
        <section className="home-section home-container home-join" aria-labelledby="home-join-title">
          <div><p className="home-context">Your next chapter</p><h2 id="home-join-title">Take your place.</h2><p>Join a community of young leaders creating positive change across Malaysia and the world.</p><Button size="lg" onClick={onRegister}>Become a Member <ArrowUpRight size={18} aria-hidden="true" /></Button></div>
          <div className="home-next-links">
            <button onClick={() => onPageChange('partnerships')}><span><strong>Build impact together</strong><span>Discover partnerships and opportunities to collaborate.</span></span><ArrowUpRight size={21} aria-hidden="true" /></button>
            <button onClick={() => onPageChange('projects')}><span><strong>Explore flagship projects</strong><span>See the initiatives making a difference.</span></span><ArrowUpRight size={21} aria-hidden="true" /></button>
            <button onClick={() => onPageChange('about')}><span><strong>Meet our leadership</strong><span>The people helping our chapter move forward.</span></span><ArrowUpRight size={21} aria-hidden="true" /></button>
          </div>
        </section>
      </main>
      <GuestFooter whiteLogo />
    </div>
  );
};
