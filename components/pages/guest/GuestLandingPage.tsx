import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Users, Calendar, ChevronRight, FolderKanban, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Common';
import { useEvents } from '@/hooks/useEvents';
import { BoardManagementService } from '@/services/boardManagementService';
import { trimCloudinaryImage } from '@/services/cloudinaryService';
import { GuestHeader } from '@/components/layout/GuestHeader';
import { GuestFooter } from '@/components/layout/GuestFooter';

export const GuestLandingPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => void;
}) => {
  const currentYear = String(new Date().getFullYear());
  const [president, setPresident] = useState<{ name: string; avatar: string; company: string } | null>(null);
  const [termSettings, setTermSettings] = useState<{ presidentTheme?: string; tagline?: string; shortDescription?: string; logoUrl?: string; memberGroupPhotoUrl?: string } | null>(null);
  const { events } = useEvents({ publicMode: true });

  const upcomingEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return events
      .filter(e => e.date && new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
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
    { image: '/pillars/business-portrait.webp', title: 'Business', description: 'Connect with entrepreneurs, grow your network, and sharpen your professional edge.', accent: 'from-jci-navy/80 to-jci-blue/60' },
    { image: '/pillars/community-portrait.webp', title: 'Community', description: 'Lead meaningful service projects that create lasting impact in Kuala Lumpur.', accent: 'from-rose-900/70 to-rose-600/50' },
    { image: '/pillars/international-portrait.webp', title: 'International', description: 'Join a worldwide network spanning 124 countries and 200,000 active members.', accent: 'from-emerald-900/70 to-emerald-600/50' },
    { image: '/pillars/individual-portrait.webp', title: 'Individual', description: 'Unlock your leadership potential through training, mentorship, and real experiences.', accent: 'from-amber-900/70 to-amber-600/50' },
  ];

  const eventTypeColor: Record<string, string> = {
    Meeting: 'from-blue-500 to-blue-600',
    Training: 'from-violet-500 to-purple-600',
    Social: 'from-emerald-500 to-teal-600',
    Project: 'from-orange-500 to-amber-600',
    International: 'from-jci-blue to-sky-500',
  };

  const ogImage = termSettings?.memberGroupPhotoUrl || '/JCI%20Kuala%20Lumpur-transparent.png';

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>JCI Kuala Lumpur — Be Better. Do Better.</title>
        <meta name="description" content="JCI Kuala Lumpur is the first Malaysia Junior Chamber Chapter — a global network of young active citizens creating positive change since 1954." />
        <link rel="canonical" href="https://jcikl.cc/" />
        <meta property="og:title" content="JCI Kuala Lumpur — Be Better. Do Better." />
        <meta property="og:description" content="JCI Kuala Lumpur is the first Malaysia Junior Chamber Chapter — a global network of young active citizens creating positive change since 1954." />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content="https://jcikl.cc/" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "JCI Kuala Lumpur",
          "url": "https://jcikl.cc",
          "logo": "https://jcikl.cc/JCI%20Kuala%20Lumpur-transparent.png",
          "foundingDate": "1954",
          "address": { "@type": "PostalAddress", "addressLocality": "Kuala Lumpur", "addressCountry": "MY" },
          "sameAs": ["https://jci.cc"]
        })}</script>
      </Helmet>
      <GuestHeader currentPage="home" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        {/* Hero */}
        <section className="relative bg-jci-navy overflow-hidden min-h-[580px] md:min-h-[680px] flex items-center" aria-label="Hero">
          {/* Geometric background pattern */}
          <div className="absolute inset-0 pointer-events-none select-none opacity-[0.06]"
            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="absolute inset-0 bg-gradient-to-br from-jci-navy via-jci-navy to-[#0a2a6e] pointer-events-none" />
          {/* Glow orbs */}
          <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-jci-blue/20 rounded-full -translate-y-1/2 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-sky-600/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full py-16 md:py-20">
            <div className="flex flex-col md:flex-row items-center gap-10 md:gap-20 lg:gap-24">
              {/* Left: text */}
              <div className="flex-1 text-center md:text-left relative z-10">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/70 mb-7">
                  <span>JCI Kuala Lumpur</span>
                  <span className="w-1 h-1 rounded-full bg-white/40" />
                  <span>Est. 1954</span>
                </div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white mb-5 leading-[0.92] tracking-tight">
                  Be Better.<br /><span className="text-sky-300">Do Better.</span>
                </h1>
                <p className="text-base md:text-lg text-slate-300/80 max-w-lg mb-9 leading-relaxed">
                  The first Malaysia Junior Chamber Chapter — a global network of young active citizens creating positive change since 1954.
                </p>
                {/* Mobile-only group photo */}
                {termSettings?.memberGroupPhotoUrl && (
                  <div className="relative block md:hidden mb-7" style={{ zIndex: 0 }}>
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="absolute rounded-2xl pointer-events-none"
                        style={{
                          inset: '-8px',
                          border: '1px solid rgba(255,255,255,0.5)',
                          animation: `ring-ripple-out 4s ease-out ${i}s infinite backwards`,
                        }} />
                    ))}
                    <div className="relative w-full rounded-2xl overflow-hidden border border-white/[0.12] shadow-xl shadow-black/30" style={{ aspectRatio: '16/9' }}>
                      <img src={termSettings.memberGroupPhotoUrl} alt="JCI KL Members" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-jci-navy/70 to-transparent pt-8 pb-3 px-4">
                        <p className="text-white text-xs font-black tracking-wide">JCI Kuala Lumpur</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-row gap-3 justify-center md:justify-start relative z-10">
                  <Button size="lg" onClick={onRegister} className="shadow-xl shadow-jci-blue/30 font-black px-7">
                    Become a Member
                  </Button>
                  <Button size="lg" variant="outline"
                    className="border-2 border-white/40 text-white bg-transparent hover:bg-white hover:text-jci-navy font-black px-7"
                    onClick={() => onPageChange('events')}>
                    View Activity Calendar
                  </Button>
                </div>
                {/* Stats strip */}
                <div className="flex items-center gap-6 md:gap-10 mt-12 pt-8 border-t border-white/[0.12] justify-center md:justify-start flex-wrap">
                  {[{ v: '1954', l: 'Founded' }, { v: '200+', l: 'Members' }, { v: '50+', l: 'Events / Year' }, { v: '70+', l: 'Years Active' }].map((s, i) => (
                    <div key={i} className="text-center md:text-left">
                      <p className="text-3xl font-black text-white leading-none tracking-tight">{s.v}</p>
                      <p className="text-[9px] text-sky-300/70 uppercase tracking-widest mt-1 font-black">{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: photo */}
              <div className="shrink-0 hidden md:flex items-center justify-center">
                <div className="relative">
                  {/* Ripple rings — 1 per second sonar */}
                  <style>{`
                    @keyframes ring-ripple-out {
                      0%   { transform: scale(1);   opacity: 0;    }
                      5%   { transform: scale(1);   opacity: 0.45; }
                      100% { transform: scale(1.6); opacity: 0;    }
                    }
                  `}</style>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="absolute rounded-[2.5rem] pointer-events-none"
                      style={{
                        inset: '-20px',
                        border: '1px solid rgba(255,255,255,0.5)',
                        animation: `ring-ripple-out 4s ease-out ${i}s infinite backwards`,
                      }} />
                  ))}
                  {/* Outer glow ring */}
                  <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-sky-400/20 to-jci-blue/10 blur-xl" />
                  {/* Decorative corner accents */}
                  <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-sky-400/40 rounded-tl-xl pointer-events-none" />
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-sky-400/40 rounded-br-xl pointer-events-none" />
                  <div className="relative w-[400px] h-[260px] lg:w-[480px] lg:h-[300px] rounded-[1.75rem] overflow-hidden shadow-2xl shadow-black/40 border border-white/[0.12]">
                    {termSettings?.memberGroupPhotoUrl ? (
                      <img src={termSettings.memberGroupPhotoUrl} alt="JCI KL Members" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white/5 backdrop-blur-sm flex items-center justify-center p-10">
                        <img src="/JCI Kuala Lumpur-transparent.png" alt="JCI KL" width="400" height="400" className="w-full h-full object-contain drop-shadow-lg" />
                      </div>
                    )}
                    {/* Photo overlay label */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-jci-navy/80 to-transparent pt-10 pb-4 px-5">
                      <p className="text-white text-xs font-black tracking-wide">JCI Kuala Lumpur</p>
                      <p className="text-white/50 text-[10px]">Young Active Citizens</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

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

        {/* JCI 4 Pillars */}
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <span className="text-[10px] font-black uppercase tracking-widest text-jci-blue">What We Stand For</span>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-2 mb-2">The Four Pillars of JCI</h2>
              <p className="text-slate-500 text-sm max-w-xl mx-auto">Everything we do is guided by four areas that empower young active citizens.</p>
            </div>
            {/* Mobile: 2-col short landscape | Desktop: 4-col taller portrait */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
              {pillars.map((p) => (
                <div
                  key={p.title}
                  className="group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-default
                    aspect-[3/2] sm:aspect-[4/3] lg:aspect-[3/4]"
                >
                  <img
                    src={p.image}
                    alt={p.title}
                    width="400"
                    height="533"
                    className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Colour tint overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-t ${p.accent} via-transparent opacity-60`} />
                  {/* Dark legibility gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
                  {/* Text */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 md:p-5">
                    <h3 className="text-sm md:text-lg font-black text-white mb-0.5 md:mb-1 leading-tight">{p.title}</h3>
                    <p className="text-white/75 text-[10px] md:text-xs leading-relaxed hidden sm:block">{p.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <section className="py-16 bg-slate-50/80">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-jci-blue">What's Coming</span>
                  <h2 className="text-2xl font-black text-slate-900 mt-1">Upcoming Events</h2>
                </div>
                <button onClick={() => onPageChange('events')} className="flex items-center gap-1 text-sm font-bold text-jci-blue hover:text-sky-600 transition-colors">
                  View All <ChevronRight size={15} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {upcomingEvents.map(event => (
                  <div key={event.id} onClick={() => onPageChange('events')}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden group cursor-pointer">
                    <div className="h-36 overflow-hidden relative">
                      {event.imageUrl ? (
                        <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${eventTypeColor[event.type] || 'from-jci-blue to-sky-500'} flex items-center justify-center`}>
                          <Calendar size={36} className="text-white/30" />
                        </div>
                      )}
                      <span className="absolute top-3 left-3 text-[9px] font-black uppercase tracking-wider bg-white/90 text-slate-700 px-2.5 py-1 rounded-full shadow-sm">
                        {event.type}
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] font-bold text-jci-blue uppercase tracking-wider mb-1">
                        {new Date(event.date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <h4 className="font-bold text-slate-900 text-sm line-clamp-2 mb-1">{event.title}</h4>
                      {event.location && <p className="text-[11px] text-slate-400 flex items-center gap-1"><MapPin size={10} />{event.location}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Dual CTA */}
        <section className="py-16 bg-gradient-to-br from-jci-navy to-jci-blue overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-3xl font-black text-white mb-3 leading-tight">Ready to Make an Impact?</h2>
                <p className="text-blue-200 text-base mb-6 leading-relaxed">Join a community of young leaders creating positive change across Malaysia and the world.</p>
                <Button size="lg" variant="outline" onClick={onRegister} className="bg-white !text-jci-navy border-white hover:bg-sky-50 hover:!text-jci-navy font-black shadow-lg">
                  Get Started Today
                </Button>
              </div>
              <div className="hidden md:flex flex-col gap-3">
                {[
                  { icon: <FolderKanban size={18} className="text-white" />, title: 'Explore Flagship Projects', sub: 'See the initiatives making a difference', page: 'projects' as const },
                  { icon: <Users size={18} className="text-white" />, title: 'Meet the Board of Directors', sub: 'Leadership driving JCI Kuala Lumpur forward', page: 'about' as const },
                ].map(item => (
                  <button key={item.page} onClick={() => onPageChange(item.page)}
                    className="flex items-center gap-4 bg-white/10 hover:bg-white/15 border border-white/20 rounded-2xl p-4 transition-all group text-left">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm">{item.title}</p>
                      <p className="text-blue-200/70 text-xs">{item.sub}</p>
                    </div>
                    <ChevronRight size={15} className="text-white/40 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <GuestFooter />
    </div>
  );
};
