import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, FolderKanban, Users, FileText, Briefcase, Gift, Menu, X } from 'lucide-react';
import { Button } from '../ui/Common';

type GuestPage = 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships';

export const GuestHeader: React.FC<{
  currentPage: GuestPage;
  onPageChange: (page: GuestPage) => void;
  onLogin: () => void;
  onRegister: () => void;
}> = ({ onPageChange, onLogin }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getCurrentPageFromPath = (): GuestPage => {
    const path = location.pathname;
    if (path === '/about') return 'about';
    if (path === '/events') return 'events';
    if (path === '/projects') return 'projects';
    if (path === '/enewsletters') return 'enewsletters';
    if (path === '/directory') return 'directory';
    if (path === '/partnerships') return 'partnerships';
    return 'home';
  };

  const activePage = getCurrentPageFromPath();

  const handleNavigation = (page: GuestPage) => {
    onPageChange(page);
    setIsMobileMenuOpen(false);
    navigate(page === 'home' ? '/' : `/${page}`);
  };

  const navItems: { page: GuestPage; label: string; icon: React.ReactNode }[] = [
    { page: 'home', label: 'Home', icon: <LayoutDashboard size={18} /> },
    { page: 'events', label: 'Events', icon: <Calendar size={18} /> },
    { page: 'projects', label: 'Flagship Projects', icon: <FolderKanban size={18} /> },
    { page: 'about', label: 'About', icon: <Users size={18} /> },
    { page: 'enewsletters', label: 'E-Newsletters', icon: <FileText size={18} /> },
    { page: 'directory', label: 'Directory', icon: <Briefcase size={18} /> },
    { page: 'partnerships', label: 'Partnerships', icon: <Gift size={18} /> },
  ];

  return (
    <>
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
          <Link to="/" onClick={() => handleNavigation('home')} className="flex items-center hover:opacity-80 transition-opacity">
            <img src="/JCI Kuala Lumpur-transparent.png" alt="JCI Kuala Lumpur Logo" className="h-8 md:h-10 w-auto object-contain" />
          </Link>

          <nav className="hidden md:flex space-x-8">
            {navItems.map(item => (
              <Link
                key={item.page}
                to={item.page === 'home' ? '/' : `/${item.page}`}
                onClick={() => handleNavigation(item.page)}
                className={`no-underline font-medium transition-colors ${activePage === item.page ? 'text-jci-blue' : 'text-slate-600 hover:text-jci-blue'}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button onClick={onLogin} size="sm" className="h-10">Login / Join Now</Button>
            <button
              className="md:hidden w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <div className={`md:hidden fixed top-16 left-0 right-0 z-40 overflow-hidden bg-white shadow-xl border-t border-slate-100 transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
        <nav className="px-4 py-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.page}
              onClick={() => handleNavigation(item.page)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left font-medium text-sm transition-all ${activePage === item.page ? 'bg-blue-50 text-jci-blue' : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100'}`}
            >
              <span className={`flex-shrink-0 ${activePage === item.page ? 'text-jci-blue' : 'text-slate-400'}`}>{item.icon}</span>
              {item.label}
              {activePage === item.page && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-jci-blue" />}
            </button>
          ))}
          <div className="pt-3 pb-2 px-4 border-t border-slate-100 mt-2">
            <Button onClick={() => { onLogin(); setIsMobileMenuOpen(false); }} className="w-full">Log In</Button>
          </div>
        </nav>
      </div>
    </>
  );
};
