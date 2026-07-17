import React, { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/Common';
import { GuestHeader } from '@/components/layout/GuestHeader';
import { GuestFooter } from '@/components/layout/GuestFooter';

const BusinessDirectoryView = lazy(() =>
  import('@/components/modules/BusinessDirectoryView').then(m => ({ default: m.BusinessDirectoryView }))
);

export const GuestDirectoryPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => void;
}) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>Member Business Directory — JCI Kuala Lumpur</title>
        <meta name="description" content="Discover JCI Kuala Lumpur member businesses. Connect with 200+ active members across 10+ industries and unlock exclusive member-only deals." />
        <link rel="canonical" href="https://jcikl.cc/directory" />
        <meta property="og:title" content="Member Business Directory — JCI Kuala Lumpur" />
        <meta property="og:description" content="Discover JCI Kuala Lumpur member businesses across 10+ industries." />
        <meta property="og:image" content="/JCI%20Kuala%20Lumpur-transparent.png" />
        <meta property="og:url" content="https://jcikl.cc/directory" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      <GuestHeader currentPage="directory" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        {/* ── Hero ── */}
        <section className="relative py-14 md:py-20 bg-gradient-to-br from-jci-navy via-[#1a3d7c] to-jci-blue overflow-hidden" aria-label="Page header">
          <div className="absolute top-0 right-0 w-96 h-96 bg-jci-blue/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest mb-3">Member Business Directory</p>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4">
              Connect with<br className="hidden md:block" /> JCI Member Businesses
            </h1>
            <p className="text-blue-200 text-sm md:text-base mb-6 max-w-xl mx-auto leading-relaxed">
              Discover member businesses, explore partnership opportunities, and unlock exclusive member-only deals.
            </p>

            {/* Stats row */}
            <div className="flex items-center justify-center gap-6 md:gap-10 mt-6">
              {[
                { value: '200+', label: 'Active Members' },
                { value: '80+', label: 'Businesses Listed' },
                { value: '10+', label: 'Industries' },
              ].map((stat, i, arr) => (
                <React.Fragment key={stat.label}>
                  <div className="text-center">
                    <p className="text-2xl md:text-3xl font-black text-white">{stat.value}</p>
                    <p className="text-blue-300 text-[10px] font-semibold uppercase tracking-wider mt-0.5">{stat.label}</p>
                  </div>
                  {i < arr.length - 1 && <div className="w-px h-8 bg-white/15" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        <section className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-jci-blue" /></div>}>
              <BusinessDirectoryView isGuest onGuestCta={onRegister} />
            </Suspense>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-20 bg-gradient-to-br from-jci-navy to-jci-blue overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Avatar stack — inline SVG placeholders, no external requests */}
            <div className="flex justify-center -space-x-2.5 mb-6">
              {[
                { initials: 'EA', bg: '#0097D7', fg: '#fff' },
                { initials: 'NW', bg: '#1a3d7c', fg: '#fff' },
                { initials: 'LK', bg: '#FFC300', fg: '#1a3d7c' },
                { initials: 'RB', bg: '#0a5fba', fg: '#fff' },
              ].map(({ initials, bg, fg }, i) => (
                <svg key={i} width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg"
                  className="rounded-full border-2 border-jci-navy shadow-md flex-shrink-0" aria-hidden="true">
                  <circle cx="22" cy="22" r="22" fill={bg} />
                  <text x="22" y="27" textAnchor="middle" fontSize="14" fontWeight="bold" fill={fg} fontFamily="system-ui,sans-serif">{initials}</text>
                </svg>
              ))}
              <div className="w-11 h-11 rounded-full border-2 border-jci-navy bg-white/10 backdrop-blur flex items-center justify-center text-white text-[10px] font-black">+196</div>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Want to List Your Business?</h2>
            <p className="text-blue-200 mb-8 max-w-lg mx-auto leading-relaxed">
              Join 200+ JCI Kuala Lumpur members. Get your business listed, unlock member-only deals, and connect with a global network of entrepreneurs.
            </p>
            <Button size="lg" onClick={onRegister}
              className="bg-amber-400 hover:bg-amber-300 text-jci-navy font-black border-0 shadow-xl shadow-amber-400/25 px-10">
              Join JCI Kuala Lumpur Today →
            </Button>
          </div>
        </section>
      </main>

      <GuestFooter />
    </div>
  );
};
