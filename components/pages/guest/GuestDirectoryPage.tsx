import React, { lazy, Suspense } from 'react';
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
            {/* Avatar stack */}
            <div className="flex justify-center -space-x-2.5 mb-6">
              {['E4A&background=0097D7', 'NW&background=1a3d7c', 'LK&background=FFC300&color=1a3d7c', 'RB&background=0a5fba'].map((q, i) => (
                <img key={i} src={`https://ui-avatars.com/api/?name=${q}&color=fff&size=48&bold=true`}
                  className="w-11 h-11 rounded-full border-2 border-jci-navy shadow-md" alt="member" />
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
