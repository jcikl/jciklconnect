import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Users, Calendar, LayoutDashboard, Briefcase, FolderKanban,
  LogOut, Award, Sparkles, TrendingUp,
  Menu, Bell, Search, AlertTriangle, Package, Building2, Workflow,
  MessageSquare, BookOpen, Heart, CheckSquare, Check, X, CheckCircle,
  Gift, Database, Megaphone, BarChart3, FileText, Code, Mail, Phone, Facebook, Instagram, Youtube, Clock, UserCircle,
  ChevronLeft, ChevronRight, ChevronDown, Target, Edit3, CreditCard, Image as ImageIcon, MapPin, Tag, Shield, RotateCcw, ArrowLeft,
  Download, Printer, Share2, Copy, ExternalLink, Eye, Upload, Info, Zap, Activity, DollarSign, Lock, Unlock
} from 'lucide-react';
import { Button, Card, Badge, StatCard, Modal, Drawer, ToastProvider, useToast, ProgressBar } from './components/ui/Common';
import * as Forms from './components/ui/Form';
import { LoginModal } from './components/auth/LoginModal';
import { RegisterModal } from './components/auth/RegisterModal';
import { UserRole, Notification, Event, Project } from './types';
const EventCalendarView = lazy(() => import('./components/modules/EventCalendarView').then(m => ({ default: m.EventCalendarView })));
import { AuthProvider, useAuth } from './hooks/useAuth';
import { usePermissions } from './hooks/usePermissions';
import { useMembers } from './hooks/useMembers';
import { useBusinessDirectory } from './hooks/useBusinessDirectory';
import { useEvents } from './hooks/useEvents';
import { useProjects } from './hooks/useProjects';
import { useCommunication } from './hooks/useCommunication';
import { usePoints } from './hooks/usePoints';
import { useBehavioralNudging } from './hooks/useBehavioralNudging';
import { NudgeBanner } from './components/ui/NudgeBanner';

// Error Boundary Components
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AsyncErrorBoundary } from './components/ui/AsyncErrorBoundary';
import { errorLoggingService } from './services/errorLoggingService';
import { CommunicationService } from './services/communicationService';
import { ProjectsService } from './services/projectsService';
import { FlagshipProjectsService } from './services/flagshipProjectsService';
import { BoardManagementService } from './services/boardManagementService';
import { trimCloudinaryImage } from './services/cloudinaryService';
import { MembersService } from './services/membersService';
import { registerPushNotifications, unregisterPushNotifications, onForegroundMessage } from './services/notificationService';
import { DEFAULT_LO_ID } from './config/constants';

// Module Imports &#8212; lazy-loaded for code splitting (each view is a separate chunk)
const FinanceView = lazy(() => import('./components/modules/FinanceView').then(m => ({ default: m.FinanceView })));
const PaymentRequestsView = lazy(() => import('./components/modules/PaymentRequestsView').then(m => ({ default: m.PaymentRequestsView })));
const GamificationView = lazy(() => import('./components/modules/GamificationView').then(m => ({ default: m.GamificationView })));
const EventsView = lazy(() => import('./components/modules/EventsView').then(m => ({ default: m.EventsView })));
const MembersView = lazy(() => import('./components/modules/MembersView').then(m => ({ default: m.MembersView })));
const ProjectsView = lazy(() => import('./components/modules/ProjectsView').then(m => ({ default: m.ProjectsView })));
const FlagshipProjectsManagementView = lazy(() => import('./components/modules/FlagshipProjectsManagementView').then(m => ({ default: m.FlagshipProjectsManagementView })));
const InventoryView = lazy(() => import('./components/modules/InventoryView').then(m => ({ default: m.InventoryView })));
const BusinessDirectoryView = lazy(() => import('./components/modules/BusinessDirectoryView').then(m => ({ default: m.BusinessDirectoryView })));
const AutomationStudio = lazy(() => import('./components/modules/AutomationStudio').then(m => ({ default: m.AutomationStudio })));
const KnowledgeView = lazy(() => import('./components/modules/KnowledgeView').then(m => ({ default: m.KnowledgeView })));
const CommunicationView = lazy(() => import('./components/modules/CommunicationView').then(m => ({ default: m.CommunicationView })));
const HobbyClubsView = lazy(() => import('./components/modules/HobbyClubsView').then(m => ({ default: m.HobbyClubsView })));
const SurveysView = lazy(() => import('./components/modules/SurveysView').then(m => ({ default: m.SurveysView })));
const MemberBenefitsView = lazy(() => import('./components/modules/MemberBenefitsView').then(m => ({ default: m.MemberBenefitsView })));
const DataImportExportView = lazy(() => import('./components/modules/DataImportExportView').then(m => ({ default: m.DataImportExportView })));
const AdvertisementsView = lazy(() => import('./components/modules/AdvertisementsView').then(m => ({ default: m.AdvertisementsView })));
const AIInsightsView = lazy(() => import('./components/modules/AIInsightsView').then(m => ({ default: m.AIInsightsView })));
const TemplatesView = lazy(() => import('./components/modules/TemplatesView').then(m => ({ default: m.TemplatesView })));
const ActivityPlansView = lazy(() => import('./components/modules/ActivityPlansView').then(m => ({ default: m.ActivityPlansView })));
const ReportsView = lazy(() => import('./components/modules/ReportsView').then(m => ({ default: m.ReportsView })));
const RoleSimulator = lazy(() => import('./components/dev/RoleSimulator').then(m => ({ default: m.RoleSimulator })));
const BoardDashboard = lazy(() => import('./components/dashboard/BoardDashboard').then(m => ({ default: m.BoardDashboard })));
const DashboardHome = lazy(() => import('./components/dashboard/DashboardHome').then(m => ({ default: m.DashboardHome })));
const DeveloperInterface = lazy(() => import('./components/modules/DeveloperInterface').then(m => ({ default: m.DeveloperInterface })));
const ToyyibView = lazy(() => import('./components/modules/ToyyibView').then(m => ({ default: m.ToyyibView })));
const WhapiConfigView = lazy(() => import('./components/modules/WhapiConfigView').then(m => ({ default: m.WhapiConfigView })));
const MembershipConfigView = lazy(() => import('./components/modules/MembershipConfigView').then(m => ({ default: m.MembershipConfigView })));
const AccessConfigView = lazy(() => import('./components/modules/AccessConfigView').then(m => ({ default: m.AccessConfigView })));
const PublicationsView = lazy(() => import('./components/modules/PublicationsView').then(m => ({ default: m.PublicationsView })));
const RadarDataImporter = lazy(() => import('./components/admin/RadarDataImporter').then(m => ({ default: m.RadarDataImporter })));
import { PublicationService, toGoogleDrivePreviewUrl, extractGoogleDriveFileId } from './services/publicationService';
import { BatchModeProvider, useBatchMode } from './contexts/BatchModeContext';
import { PartnershipsService } from './services/partnershipsService';
import { Partnership, FlagshipProject } from './types';
import { AdvertisementService } from './services/advertisementService';

// --- View Definitions ---

type ViewType = 'GUEST' | 'GUEST_EVENTS' | 'FLAGSHIP_PROJECTS' | 'GUEST_ABOUT' | 'GUEST_ENEWSLETTERS' | 'GUEST_DIRECTORY' | 'GUEST_PARTNERSHIPS' | 'DASHBOARD' | 'MEMBERS' | 'EVENTS' | 'PROJECTS' | 'ACTIVITIES' | 'FINANCE' | 'PAYMENT_REQUESTS' | 'GAMIFICATION' | 'INVENTORY' | 'DIRECTORY' | 'AUTOMATION' | 'KNOWLEDGE' | 'COMMUNICATION' | 'CLUBS' | 'SURVEYS' | 'BENEFITS' | 'DATA_IMPORT_EXPORT' | 'ADVERTISEMENTS' | 'AI_INSIGHTS' | 'TEMPLATES' | 'ACTIVITY_PLANS' | 'REPORTS' | 'DEVELOPER' | 'TOYYIB' | 'WHAPI_CONFIG' | 'MEMBERSHIP_CONFIG' | 'ACCESS_CONFIG' | 'PUBLICATIONS' | 'RADAR_IMPORTER' | 'FLAGSHIP_PROJECTS_MGT';

// --- Helper Components ---

// Guest Navigation Header Component (shared across guest pages)
const GuestHeader = ({
  currentPage,
  onPageChange,
  onLogin,
  onRegister
}: {
  currentPage: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships';
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => void;
  onLogin: () => void;
  onRegister: () => void;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Determine current page from URL
  const getCurrentPageFromPath = (): 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships' => {
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

  const handleNavigation = (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => {
    onPageChange(page);
    setIsMobileMenuOpen(false);
    if (page === 'home') {
      navigate('/');
    } else {
      navigate(`/${page}`);
    }
  };

  const navItems: { page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships'; label: string; icon: React.ReactNode }[] = [
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
          {/* Logo */}
          <Link
            to="/"
            onClick={() => handleNavigation('home')}
            className="flex items-center hover:opacity-80 transition-opacity"
          >
            <img
              src="/JCI Kuala Lumpur-transparent.png"
              alt="JCI Kuala Lumpur Logo"
              className="h-8 md:h-10 w-auto object-contain"
            />
          </Link>

          {/* Desktop Navigation */}
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

          {/* Right side: Login + Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <Button onClick={onLogin} size="sm" className="hidden sm:inline-flex">Log In</Button>
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

      {/* Mobile Navigation Panel */}
      <div
        className={`md:hidden fixed top-16 left-0 right-0 z-40 overflow-hidden bg-white shadow-xl border-t border-slate-100 transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
          }`}
      >
        <nav className="px-4 py-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.page}
              onClick={() => handleNavigation(item.page)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left font-medium text-sm transition-all ${activePage === item.page
                ? 'bg-blue-50 text-jci-blue'
                : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100'
                }`}
            >
              <span className={`flex-shrink-0 ${activePage === item.page ? 'text-jci-blue' : 'text-slate-400'}`}>
                {item.icon}
              </span>
              {item.label}
              {activePage === item.page && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-jci-blue"></div>
              )}
            </button>
          ))}
          <div className="pt-3 pb-2 px-4 border-t border-slate-100 mt-2">
            <Button onClick={() => { onLogin(); setIsMobileMenuOpen(false); }} className="w-full">
              Log In
            </Button>
          </div>
        </nav>
      </div>
    </>
  );
};

// Guest Footer Component (shared across guest pages)
const GuestFooter = () => (
  <footer className="bg-slate-900 text-slate-400 py-12">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid md:grid-cols-4 gap-8">
        <div>
          <div className="flex flex-col items-start mb-4">
            <img
              src="/JCI Kuala Lumpur-transparent.png"
              alt="JCI Kuala Lumpur Logo"
              className="h-8 w-auto object-contain mb-2"
            />
          </div>
          <p className="text-sm">
            Empowering young active citizens to create positive change.
          </p>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4">Platform</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4">Resources</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Community</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4">Connect</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-white transition-colors">About JCI</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
        <p>&copy; {new Date().getFullYear()} JCI Kuala Lumpur. All rights reserved.</p>
      </div>
    </div>
  </footer>
);

const SidebarItem = ({ icon, label, isActive, onClick, isCollapsed }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void, isCollapsed?: boolean }) => (
  <button
    onClick={onClick}
    title={isCollapsed ? label : undefined}
    className={`w-full flex items-center transition-all duration-200 rounded-lg text-sm font-medium ${isCollapsed ? 'justify-center px-0 py-3' : 'space-x-3 px-4 py-3'} ${isActive
      ? 'bg-jci-blue text-white shadow-md'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
  >
    <div className={`flex-shrink-0 ${isCollapsed ? '' : ''}`}>
      {icon}
    </div>
    {!isCollapsed && <span className="truncate">{label}</span>}
  </button>
);

const GuestLandingPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => void;
}) => {
  const currentYear = String(new Date().getFullYear());
  const [president, setPresident] = useState<{ name: string; avatar: string; company: string } | null>(null);
  const [termSettings, setTermSettings] = useState<{ presidentTheme?: string; tagline?: string; shortDescription?: string; logoUrl?: string } | null>(null);
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

  return (
    <div className="min-h-screen bg-slate-50">
      <GuestHeader currentPage="home" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        {/* Hero */}
        <section className="relative bg-jci-navy py-20 overflow-hidden" aria-label="Hero">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-r from-jci-navy via-jci-navy/90 to-jci-navy/50 pointer-events-none" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-jci-blue/10 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider text-white/80 mb-6">
                  <span>JCI Kuala Lumpur</span>
                  <span className="w-1 h-1 rounded-full bg-white/50" />
                  <span>Est. 1954</span>
                </div>
                <h1 className="text-5xl md:text-6xl font-black text-white mb-5 leading-tight tracking-tight">
                  Be Better.<br /><span className="text-sky-300">Do Better.</span>
                </h1>
                <p className="text-lg text-slate-300 max-w-xl mb-8 leading-relaxed">
                  The first Malaysia Junior Chamber Chapter &#8212; a global network of young active citizens creating positive change since 1954.
                </p>
                <div className="flex gap-4 flex-wrap justify-center md:justify-start">
                  <Button size="lg" onClick={onRegister} className="shadow-lg shadow-jci-blue/30 font-bold">
                    Become a Member
                  </Button>
                  <Button size="lg" variant="outline"
                    className="border-2 border-white/60 text-white bg-transparent hover:bg-white hover:text-jci-navy font-bold"
                    onClick={() => onPageChange('events')}>
                    View Activity Calendar
                  </Button>
                </div>
                <div className="flex items-center gap-8 mt-10 pt-8 border-t border-white/10 justify-center md:justify-start flex-wrap">
                  {[{ v: '1954', l: 'Founded' }, { v: '200+', l: 'Members' }, { v: '50+', l: 'Events / Year' }, { v: '70+', l: 'Years Active' }].map((s, i) => (
                    <div key={i} className="text-center md:text-left">
                      <p className="text-2xl font-black text-white leading-none">{s.v}</p>
                      <p className="text-[10px] text-sky-300/80 uppercase tracking-widest mt-0.5 font-bold">{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="shrink-0 hidden md:flex">
                <div className="w-52 h-52 rounded-3xl bg-white/5 border border-white/10 p-8 flex items-center justify-center shadow-2xl shadow-black/30 backdrop-blur-sm">
                  <img src="/JCI Kuala Lumpur-transparent.png" alt="JCI KL" className="w-full h-full object-contain drop-shadow-lg" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* President Spotlight */}
        {president && (
          <section className="relative bg-jci-navy overflow-hidden">

            {/* ── Background layer ── */}
            <div className="absolute inset-0 pointer-events-none select-none">
              <div className="absolute bottom-0 right-0 leading-none font-black text-white/[0.04] text-[140px] lg:text-[200px]">
                {currentYear}
              </div>
              <div className="absolute inset-0 opacity-[0.025]"
                style={{ backgroundImage: 'repeating-linear-gradient(135deg, white 0px, white 1px, transparent 1px, transparent 40px)' }} />
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

                  {/* Description — capped at 2 lines */}
                  <p className="text-white/50 text-[11px] leading-relaxed line-clamp-2">
                    {termSettings?.shortDescription || 'This year, JCI Kuala Lumpur commits to igniting the spark of leadership in every young active citizen — building a community that leads with purpose.'}
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
                <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-jci-navy/100 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-jci-navy/100 to-transparent" />
                <div className="absolute bottom-8 inset-x-0 flex flex-col items-center gap-1 z-10">
                  <p className="text-white font-black text-xl drop-shadow-lg leading-snug">{president.name}</p>
                  <p className="text-white/55 text-sm drop-shadow">{president.company}</p>
                  <div className="mt-2 bg-amber-400 text-jci-navy text-[9px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                    President {currentYear}
                  </div>
                </div>
                {/* Vertical amber divider */}
                <div className="absolute right-0 inset-y-0 flex flex-col items-center py-10">
                  <div className="flex-1 w-px bg-gradient-to-b from-transparent via-amber-400/35 to-transparent" />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60 my-1 animate-pulse" />
                  <div className="flex-1 w-px bg-gradient-to-b from-transparent via-amber-400/35 to-transparent" />
                </div>
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
                      {termSettings?.shortDescription || 'This year, JCI Kuala Lumpur commits to igniting the spark of leadership in every young active citizen — building a community that leads with purpose and transforms Kuala Lumpur for generations to come.'}
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

// Guest Events Page
const GuestEventsPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => void;
}) => {
  const { events, loading } = useEvents({ publicMode: true });
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [guestRegistrationData, setGuestRegistrationData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    notes: '',
  });
  const { showToast } = useToast();
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events.filter(e => {
      const eventDate = e.date ? new Date(e.date) : null;
      if (!eventDate) return false;
      return eventDate >= today;
    });
  }, [events]);

  const publicEvents = upcomingEvents;
  const allPublishedEvents = events;

  return (
    <div className="min-h-screen bg-slate-50">
      <GuestHeader currentPage="events" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        <section className="relative py-14 md:py-20 bg-gradient-to-br from-jci-navy via-[#1a3d7c] to-jci-blue overflow-hidden" aria-label="Page header">
          <div className="absolute top-0 right-0 w-96 h-96 bg-jci-blue/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest mb-3">JCI Kuala Lumpur Events</p>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4">Upcoming Events</h1>
            <p className="text-blue-200 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Join us for exciting events, trainings, and networking opportunities.
            </p>
          </div>
        </section>

        {/* Public Activity Calendar View */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Activity Calendar</h2>
                <p className="text-slate-600">View all upcoming events and activities</p>
              </div>
              <Button variant="outline" onClick={onLogin}>
                Login to Register
              </Button>
            </div>
            <div className="mt-8">
              <EventCalendarView
                events={allPublishedEvents}
                readonly={true}
                upcomingOnly={true}
                onEventClick={(event) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const eventDate = new Date(event.date);
                  if (eventDate >= today) {
                    setSelectedEvent(event);
                    setIsRegistrationModalOpen(true);
                  } else {
                    showToast('This event has already passed', 'info');
                  }
                }}
              />
            </div>
          </div>
        </section>

        {/* Guest Event Registration Modal */}
      </main>

      {selectedEvent && isRegistrationModalOpen && (() => {
        const evDate = new Date(selectedEvent.date);
        const evEndDate = selectedEvent.endDate ? new Date(selectedEvent.endDate) : null;
        const evIsMultiDay = evEndDate && evEndDate.toDateString() !== evDate.toDateString();
        const evFormatDay = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const evFormatWeekday = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' });
        const evTime = selectedEvent.time || (evDate.getHours() !== 0 || evDate.getMinutes() !== 0 ? evDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);
        const evPriceMin = selectedEvent.priceMin ?? selectedEvent.price;
        const evPriceMax = selectedEvent.priceMax;
        const closeModal = () => {
          setIsRegistrationModalOpen(false);
          setSelectedEvent(null);
          setDescExpanded(false);
          setGuestRegistrationData({ name: '', email: '', phone: '', organization: '', notes: '' });
        };
        return (
        <Modal
          isOpen={isRegistrationModalOpen}
          onClose={closeModal}
          title={null}
          size="2xl"
          bottomSheet={true}
          drawerOnMobile
          mobileHeight="h-[92vh]"
          scrollInBody={true}
          className="premium-registration-modal"
          footerClassName="flex-none px-5 py-4 bg-white border-t border-slate-100 z-30 pb-safe shadow-[0_-4px_16px_-2px_rgba(0,0,0,0.08)]"
          footer={(
            <div className="flex items-center gap-4 w-full">
              <div className="shrink-0 min-w-[80px]">
                {evPriceMin != null ? (
                  <>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block leading-none mb-0.5">From</span>
                    <span className="text-lg font-black text-slate-900 leading-none">
                      RM {evPriceMin}{evPriceMax != null && evPriceMax !== evPriceMin ? ` – ${evPriceMax}` : ''}
                    </span>
                  </>
                ) : (
                  <span className="text-xl font-black text-green-600 leading-none">FREE</span>
                )}
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block leading-none mt-0.5">/ person</span>
              </div>
              <div className="flex-1">
                <Button
                  form="guest-registration-form"
                  type="submit"
                  className="w-full h-12 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 font-black uppercase tracking-widest text-sm shadow-lg shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} className="stroke-[3]" />
                  <span>Confirm Registration</span>
                </Button>
              </div>
            </div>
          )}
        >
          <div className="-m-4 md:-m-6 relative">
            {/* Hero Image */}
            <div className="relative h-56 md:h-72 w-full overflow-hidden">
              <img
                src={selectedEvent.imageUrl || "https://images.unsplash.com/photo-1540575861501-7cf05a4b125a?auto=format&fit=crop&q=80"}
                alt={selectedEvent.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                <button
                  onClick={closeModal}
                  className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all"
                >
                  <ArrowLeft size={18} />
                </button>
              </div>
              {/* Title overlay */}
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 md:px-6 md:pb-6">
                <Badge variant="jci" className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold mb-1.5">
                  {selectedEvent.type || 'Event'}
                </Badge>
                <h2 className="text-xl md:text-2xl font-black text-white leading-tight drop-shadow-sm">
                  {selectedEvent.title}
                </h2>
              </div>
            </div>

            {/* Content body */}
            <div className="relative bg-white rounded-t-[28px] -mt-6 px-5 pt-5 pb-10 md:px-6 md:pt-6">
              {/* Info card */}
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden mb-6">
                {/* Date */}
                <div className="flex items-center gap-3 px-3.5 py-3 bg-white">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Calendar size={14} className="text-jci-blue" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</p>
                    {evIsMultiDay ? (
                      <>
                        <p className="text-sm font-semibold text-slate-800">{evFormatDay(evDate)} – {evFormatDay(evEndDate!)}</p>
                        <p className="text-xs text-slate-500">{evFormatWeekday(evDate)} – {evFormatWeekday(evEndDate!)}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-slate-800">{evFormatDay(evDate)}</p>
                        {evTime && <p className="text-xs text-slate-500">{evFormatWeekday(evDate)} · {evTime}</p>}
                      </>
                    )}
                  </div>
                </div>
                {/* Location */}
                {selectedEvent.location && (
                  <div className="flex items-center gap-3 px-3.5 py-3 bg-white">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <MapPin size={14} className="text-jci-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</p>
                      <p className="text-sm font-semibold text-slate-800 truncate">{selectedEvent.location}</p>
                    </div>
                  </div>
                )}
                {/* Spots */}
                {selectedEvent.maxAttendees && (
                  <div className="flex items-center gap-3 px-3.5 py-3 bg-white">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <Users size={14} className="text-jci-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spots</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedEvent.attendees || 0} / {selectedEvent.maxAttendees} registered</p>
                      <div className="mt-1 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div style={{ width: `${Math.min(100, Math.round(((selectedEvent.attendees || 0) / selectedEvent.maxAttendees) * 100))}%` }} className="h-full bg-jci-blue rounded-full" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedEvent.description && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3 mb-6">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">About</p>
                  <div className={`text-sm text-slate-700 leading-relaxed space-y-2 ${descExpanded ? '' : 'line-clamp-3'}`}>
                    {selectedEvent.description.split(/\n+/).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                  <button onClick={() => setDescExpanded(v => !v)} className="text-[11px] font-bold text-jci-blue mt-1.5">
                    {descExpanded ? 'Show less' : 'Show more'}
                  </button>
                </div>
              )}

              {/* Registration Form */}
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-jci-blue rounded-full" />
                Your Particulars
              </h3>
              <form
                id="guest-registration-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const { EventsService } = await import('./services/eventsService');
                    await EventsService.registerGuestForEvent(selectedEvent.id, guestRegistrationData);
                    showToast('Registration submitted successfully! We will contact you soon.', 'success');
                    closeModal();
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Failed to register for event';
                    showToast(errorMessage, 'error');
                  }
                }}
                className="space-y-4"
              >
                  {/* Full Name */}
                  <div className="flex flex-row items-center gap-3 sm:gap-6 group">
                    <label className="w-28 sm:w-32 flex-shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-jci-blue transition-colors leading-tight">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="flex-1">
                      <Forms.Input
                        placeholder="e.g. John Doe"
                        value={guestRegistrationData.name}
                        onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, name: e.target.value })}
                        required
                        className="!mb-0"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex flex-row items-center gap-3 sm:gap-6 group">
                    <label className="w-28 sm:w-32 flex-shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-jci-blue transition-colors leading-tight">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="flex-1">
                      <Forms.Input
                        type="email"
                        placeholder="john@example.com"
                        value={guestRegistrationData.email}
                        onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, email: e.target.value })}
                        required
                        className="!mb-0"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="flex flex-row items-center gap-3 sm:gap-6 group">
                    <label className="w-28 sm:w-32 flex-shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-jci-blue transition-colors leading-tight">
                      Contact Number <span className="text-red-500">*</span>
                    </label>
                    <div className="flex-1">
                      <Forms.Input
                        type="tel"
                        placeholder="+60 12-345 6789"
                        value={guestRegistrationData.phone}
                        onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, phone: e.target.value })}
                        required
                        className="!mb-0"
                      />
                    </div>
                  </div>

                  {/* Organization */}
                  <div className="flex flex-row items-center gap-3 sm:gap-6 group">
                    <label className="w-28 sm:w-32 flex-shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-jci-blue transition-colors leading-tight">
                      Organization
                    </label>
                    <div className="flex-1">
                      <Forms.Input
                        placeholder="Company or University"
                        value={guestRegistrationData.organization}
                        onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, organization: e.target.value })}
                        className="!mb-0"
                      />
                    </div>
                  </div>

                  {/* Additional Notes */}
                  <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-6 group">
                    <label className="sm:w-32 flex-shrink-0 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-jci-blue transition-colors leading-tight">
                      Remarks
                    </label>
                    <div className="flex-1 w-full">
                      <Forms.Textarea
                        placeholder="Any special requirements or dietary needs?"
                        value={guestRegistrationData.notes}
                        onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, notes: e.target.value })}
                        rows={2}
                        className="!mb-0"
                      />
                    </div>
                  </div>
              </form>
            </div>
          </div>
        </Modal>
        );
      })()}

      <GuestFooter />
    </div>
  );
};

// Flagship Projects Page
const FlagshipProjectsPage = ({ onLogin, onRegister, onPageChange }: {
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

// Guest About Page
const GuestAboutPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => void;
}) => {
  const timelineEvents = [
    { year: '1953', title: 'JCI Kuala Lumpur was Initiated', description: 'Initiated by JC Frank Wakerman in 1953 followed up by President JC Wong Peng Tuck.' },
    { year: '1954', title: 'JCI Kuala Lumpur was Formed', description: 'JCI Kuala Lumpur ("JCI KL") is the first Malaysia Junior Chamber Chapter that was formed in 1954.' },
    { year: '1980s', title: 'JCI Asia Pacific Conference', description: 'JCI Kuala Lumpur hosted JCI Asia Pacific Conference under our Past President, JCI Sen. Loh Yit Lock as Conference Director.' },
    { year: '1980s', title: '1st JCI MALAYSIA National Convention', description: 'Past President, Robert Ng as Conference Director.' },
    { year: '1984', title: '2nd JCI Asia Pacific Conference', description: 'During our 30th Anniversary, JCI Kuala Lumpur was the Hosting Chapter for JCI Asia Pacific Conference held in Genting Highlands Resort under our Past President JCI Sen. Larry Koh as Conference Director.' },
    { year: '1990s', title: 'JCI National Convention', description: 'We hosted the National Convention.' },
    { year: '2000s', title: 'Area Peninsular Malaysia Convention', description: 'We hosted the Area Peninsular Malaysia Convention.' },
    { year: '2010s', title: 'JCI National Convention', description: 'We hosted the National Convention.' },
    { year: '2019', title: 'JCI Malaysia National Convention Best of the Best', description: 'Under leadership of President Thomas Chin and BODs, JCI Kuala Lumpur awarded the award in JCI Malaysia National Convention at Kuching.' },
    { year: '2020s', title: 'JCI Malaysia Area Central South Convention', description: '' },
    { year: '2023', title: 'JCI Malaysia National Convention Best of the Best', description: 'Under leadership of President Chris Teng and BODs, JCI Kuala Lumpur awarded the award in JCI Malaysia National Convention at Sabah.' },
    { year: '2024', title: 'Program NextGen awarded as Best of the Best Project in JCI World Congress', description: '' },
  ];

  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));
  const [boardMembers, setBoardMembers] = useState<any[]>([]);
  const [loadingBoard, setLoadingBoard] = useState<boolean>(true);

  // Available years: from JCI KL's founding year to the current calendar year.
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years = [];
    for (let y = currentYear; y >= 1954; y--) {
      years.push(String(y));
    }
    return years;
  }, [currentYear]);

  const getMockBoardData = (year: string) => {
    const data: Record<string, Array<{ position: string; name: string; avatar?: string; company?: string }>> = {
      '2026': [
        { position: 'President', name: 'Eric Wong', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', company: 'TechNova Solutions' },
        { position: 'Immediate Past President', name: 'Chris Teng', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', company: 'Teng Holdings' },
        { position: 'Secretary', name: 'Lim Mei Kee', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', company: 'Lumina PR' },
        { position: 'Honorary Treasurer', name: 'Tan Ka Yi', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80', company: 'Nexus Advisory' },
        { position: 'General Legal Counsel', name: 'Nicholas Chew', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', company: 'Chew & Partners' },
        { position: 'Executive Vice President', name: 'Chong Wei Sheng', avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&auto=format&fit=crop&q=80', company: 'Apex Ventures' },
        { position: 'Vice President (Individual)', name: 'Jessie Liew', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', company: 'Bright Horizons' },
        { position: 'Vice President (Community)', name: 'Marcus Wong', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80', company: 'GreenEarth Co.' },
        { position: 'Vice President (Business)', name: 'Alvin Tan', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', company: 'ScaleUp Consulting' },
        { position: 'Vice President (International Affairs)', name: 'Derrick Lim', avatar: 'https://images.unsplash.com/photo-1489980508314-941910ded1f4?w=150&auto=format&fit=crop&q=80', company: 'Global Bridge Inc.' },
        { position: 'Vice President (LOM)', name: 'Cheah Kok Wai', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', company: 'Synergy Labs' },
      ],
      '2025': [
        { position: 'President', name: 'Chris Teng', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', company: 'Teng Holdings' },
        { position: 'Immediate Past President', name: 'Thomas Chin', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', company: 'Chin & Associates' },
        { position: 'Secretary', name: 'Jane Doe', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', company: 'JCI Kuala Lumpur' },
        { position: 'Honorary Treasurer', name: 'John Smith', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', company: 'Capital Partners' },
        { position: 'General Legal Counsel', name: 'Alice Johnson', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', company: 'Apex Legal' },
        { position: 'Executive Vice President', name: 'Bob Brown', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', company: 'Brown Enterprises' },
        { position: 'Vice President (Individual)', name: 'Sarah Connor', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', company: 'Cyberdyne Systems' },
        { position: 'Vice President (Community)', name: 'Michael Scott', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', company: 'Dunder Mifflin' },
        { position: 'Vice President (Business)', name: 'David Brent', avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&auto=format&fit=crop&q=80', company: 'Wernham Hogg' },
        { position: 'Vice President (International Affairs)', name: 'Emma Watson', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80', company: 'HeForShe' },
        { position: 'Vice President (LOM)', name: 'Ryan Gosling', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80', company: 'Kenergy Ltd' },
      ],
      '2024': [
        { position: 'President', name: 'Alex Rivera', avatar: 'https://i.pravatar.cc/150?u=alex', company: 'Rivera Growth Co.' },
        { position: 'Immediate Past President', name: 'Jessica Day', avatar: 'https://i.pravatar.cc/150?u=jessica', company: 'Day Strategies' },
        { position: 'Secretary', name: 'Sarah Chen', avatar: 'https://i.pravatar.cc/150?u=sarah', company: 'Chen Events' },
        { position: 'Honorary Treasurer', name: 'Michael Ross', avatar: 'https://i.pravatar.cc/150?u=michael', company: 'Pearson Specter' },
        { position: 'General Legal Counsel', name: 'Harvey Specter', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', company: 'Specter Litt' },
        { position: 'Executive Vice President', name: 'Louis Litt', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', company: 'Litt & Partners' },
        { position: 'Vice President (Individual)', name: 'Donna Paulsen', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', company: 'Donna Corp' },
        { position: 'Vice President (Community)', name: 'Rachel Zane', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80', company: 'Zane Legal' },
        { position: 'Vice President (Business)', name: 'Mike Ross', avatar: 'https://i.pravatar.cc/150?u=michael', company: 'Ross Advisory' },
        { position: 'Vice President (International Affairs)', name: 'Katrina Bennett', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', company: 'Bennett Global' },
        { position: 'Vice President (LOM)', name: 'Samantha Wheeler', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', company: 'Wheeler Media' },
      ],
      '2023': [
        { position: 'President', name: 'Chris Teng', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', company: 'Teng Holdings' },
        { position: 'Immediate Past President', name: 'Thomas Chin', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', company: 'Chin & Associates' },
        { position: 'Secretary', name: 'Jane Doe', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', company: 'JCI Kuala Lumpur' },
        { position: 'Honorary Treasurer', name: 'John Smith', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', company: 'Capital Partners' },
        { position: 'General Legal Counsel', name: 'Alice Johnson', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', company: 'Apex Legal' },
        { position: 'Executive Vice President', name: 'Bob Brown', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', company: 'Brown Enterprises' },
        { position: 'Vice President (Individual)', name: 'Sarah Connor', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', company: 'Cyberdyne Systems' },
        { position: 'Vice President (Community)', name: 'Michael Scott', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', company: 'Dunder Mifflin' },
        { position: 'Vice President (Business)', name: 'David Brent', avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&auto=format&fit=crop&q=80', company: 'Wernham Hogg' },
        { position: 'Vice President (International Affairs)', name: 'Emma Watson', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80', company: 'HeForShe' },
        { position: 'Vice President (LOM)', name: 'Ryan Gosling', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80', company: 'Kenergy Ltd' },
      ]
    };
    return data[year] || data['2026'];
  };

  useEffect(() => {
    let active = true;
    const fetchBoard = async () => {
      setLoadingBoard(true);
      try {
        const termMembers = await BoardManagementService.getBoardMembersByYear(selectedYear);

        if (!active) return;

        const activeBoard = termMembers.filter(m => m.isActive);
        if (activeBoard.length > 0) {
          const mapped = activeBoard.map((bm) => ({
            position: bm.position,
            name: bm.memberName || 'JCI Member',
            avatar: bm.boardAvatarUrl || bm.avatarUrl,
            company: bm.companyName || 'JCI Kuala Lumpur',
            commissionDirectors: (bm.commissionDirectorIds || []).map(id => ({
              id,
              name: bm.commissionDirectorNames?.[id] || 'JCI Member',
              avatar: bm.commissionDirectorAvatars?.[id] || '',
            })),
          }));
          setBoardMembers(mapped);
        } else {
          setBoardMembers(getMockBoardData(selectedYear));
        }
      } catch (err) {
        console.error('Error fetching board members:', err);
        if (active) {
          setBoardMembers(getMockBoardData(selectedYear));
        }
      } finally {
        if (active) {
          setLoadingBoard(false);
        }
      }
    };

    fetchBoard();
    return () => {
      active = false;
    };
  }, [selectedYear]);

  // Tree lookup helpers
  const president = boardMembers.find(bm => (bm.position || '').toLowerCase() === 'president');
  const ipp = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('past president') || pos.includes('ipp');
  });
  const secretary = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('secretary') && !pos.includes('vice');
  });
  const treasurer = boardMembers.find(bm => (bm.position || '').toLowerCase().includes('treasurer'));
  const glc = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('legal counsel') || pos.includes('legal council') || pos.includes('glc');
  });
  const evp = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('executive vice') || pos.includes('evp');
  });
  const vpIndividual = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('vice president') && (pos.includes('individual') || pos.includes('ind'));
  });
  const vpCommunity = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('vice president') && (pos.includes('community') || pos.includes('com'));
  });
  const vpBusiness = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('vice president') && (pos.includes('business') || pos.includes('bus'));
  });
  const vpInternational = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('vice president') && (pos.includes('international') || pos.includes('int'));
  });
  const vpLom = boardMembers.find(bm => {
    const pos = (bm.position || '').toLowerCase();
    return pos.includes('vice president') && (pos.includes('lom') || pos.includes('local organisation') || pos.includes('local organization'));
  });

  const BoardNode = ({ member, defaultRole, variant = 'default' }: {
    member?: any;
    defaultRole: string;
    variant?: 'default' | 'president' | 'ipp' | 'vp';
  }) => {
    const name = member?.name || 'Vacant';
    const role = member?.position || defaultRole;
    const avatar = member?.avatar;
    const company = member?.company || 'JCI Kuala Lumpur';
    const commissionDirectors: Array<{ id: string; name: string; avatar: string }> = member?.commissionDirectors || [];

    const AvatarCircle = ({ src, label, size }: { src?: string; label: string; size: string }) =>
      src ? (
        <img src={src} alt={label} className={`${size} rounded-full object-cover border border-white/40 shadow-sm`} />
      ) : (
        <div className={`${size} rounded-full bg-white/20 flex items-center justify-center`}>
          <span className="font-bold text-white/60 text-xs">{label.charAt(0)}</span>
        </div>
      );

    if (variant === 'president') {
      return (
        <div className="relative bg-gradient-to-br from-jci-navy to-jci-blue text-white rounded-3xl p-6 md:p-8 flex items-center gap-5 md:gap-7 shadow-xl shadow-jci-blue/25 overflow-hidden w-full max-w-2xl mx-auto group hover:shadow-2xl hover:shadow-jci-blue/30 transition-all">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/[0.04] rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-white/[0.04] rounded-full translate-y-1/2 pointer-events-none" />
          <div className="shrink-0 relative z-10">
            {avatar ? (
              <img src={avatar} alt={name} className="w-20 h-20 md:w-28 md:h-28 rounded-2xl object-cover border-2 border-white/25 shadow-xl" />
            ) : (
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center">
                <span className="text-4xl font-black text-white/40">{name.charAt(0)}</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 relative z-10">
            <span className="inline-block text-[9px] font-black uppercase tracking-widest bg-white/15 border border-white/20 px-3 py-1 rounded-full mb-2.5">President {selectedYear}</span>
            <h3 className="text-xl md:text-2xl font-black leading-tight mb-1">{name}</h3>
            <p className="text-sky-200/80 text-sm truncate">{company}</p>
            {commissionDirectors.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {commissionDirectors.map(dir => (
                  <div key={dir.id} className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full pl-0.5 pr-2.5 py-0.5">
                    <AvatarCircle src={dir.avatar} label={dir.name} size="w-5 h-5" />
                    <span className="text-[10px] text-white/75 font-medium max-w-[80px] truncate">{dir.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (variant === 'ipp') {
      return (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-4 flex items-center gap-4 w-full max-w-xl mx-auto hover:border-slate-300 hover:shadow-md transition-all group">
          <div className="shrink-0">
            {avatar ? (
              <img src={avatar} alt={name} className="w-14 h-14 rounded-xl object-cover border border-slate-200 group-hover:border-jci-blue/30 transition-colors" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                <span className="text-lg font-bold text-slate-300">{name.charAt(0)}</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-block text-[8px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full mb-1">Immediate Past President</span>
            <h4 className="font-bold text-slate-800 text-sm leading-tight truncate">{name}</h4>
            <p className="text-[11px] text-slate-400 truncate">{company}</p>
          </div>
        </div>
      );
    }

    if (variant === 'vp') {
      const shortRole = role.replace('Vice President', 'VP');
      return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-jci-blue/25 transition-all p-4 flex items-start gap-3.5 h-full group">
          <div className="shrink-0 mt-0.5">
            {avatar ? (
              <img src={avatar} alt={name} className="w-12 h-12 rounded-xl object-cover border border-slate-100 group-hover:border-jci-blue/30 transition-colors" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-100 flex items-center justify-center">
                <span className="text-base font-bold text-slate-300">{name.charAt(0)}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-jci-blue mb-0.5 truncate">{shortRole}</p>
            <h4 className="font-bold text-slate-900 text-sm truncate">{name}</h4>
            <p className="text-[11px] text-slate-400 truncate mb-0">{company}</p>
            {commissionDirectors.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Commission Directors</p>
                <div className="flex flex-wrap gap-1.5">
                  {commissionDirectors.map(dir => (
                    <div key={dir.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-full pl-0.5 pr-2 py-0.5">
                      {dir.avatar ? (
                        <img src={dir.avatar} alt={dir.name} className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">{dir.name.charAt(0)}</div>
                      )}
                      <span className="text-[10px] font-medium text-slate-600 max-w-[90px] truncate">{dir.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // default &#8212; Secretary, Treasurer, GLC, EVP
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md hover:border-jci-blue/25 transition-all flex flex-col items-center text-center w-full h-full group">
        <div className="mb-3">
          {avatar ? (
            <img src={avatar} alt={name} className="w-14 h-14 rounded-xl object-cover border-2 border-slate-100 shadow-sm group-hover:border-jci-blue/20 transition-colors" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-slate-100 border-2 border-slate-100 flex items-center justify-center">
              <span className="text-xl font-bold text-slate-300">{name.charAt(0)}</span>
            </div>
          )}
        </div>
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-jci-blue mb-0.5 w-full truncate px-1">{role}</p>
        <h4 className="font-bold text-slate-900 text-sm mb-0.5 line-clamp-1">{name}</h4>
        <p className="text-[11px] text-slate-400 line-clamp-1">{company}</p>
        {commissionDirectors.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 w-full">
            <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Commission Directors</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {commissionDirectors.map(dir => (
                <div key={dir.id} className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-full pl-0.5 pr-1.5 py-0.5">
                  {dir.avatar ? (
                    <img src={dir.avatar} alt={dir.name} className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">{dir.name.charAt(0)}</div>
                  )}
                  <span className="text-[9px] font-medium text-slate-600 max-w-[60px] truncate">{dir.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <GuestHeader currentPage="about" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        <section className="relative py-14 md:py-20 bg-gradient-to-br from-jci-navy via-[#1a3d7c] to-jci-blue overflow-hidden" aria-label="Page header">
          <div className="absolute top-0 right-0 w-96 h-96 bg-jci-blue/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest mb-3">Est. 1954 · Kuala Lumpur</p>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4">About JCI Kuala Lumpur</h1>
            <p className="text-blue-200 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              The first Malaysia Junior Chamber Chapter, empowering young active citizens to create positive change since 1954.
            </p>
          </div>
        </section>

        {/* JCI Kuala Lumpur Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-6">JCI Kuala Lumpur</h2>
                <div className="h-1 w-20 bg-jci-blue mb-6"></div>
                <p className="text-lg text-slate-600 leading-relaxed mb-4">
                  JCI Kuala Lumpur ("JCI KL") is the first Malaysia Junior Chamber Chapter formed in 1954,
                  initiated by JC Frank Wakerman in 1953 followed up by President JC Wong Peng Tuck.
                </p>
                <p className="text-lg text-slate-600 leading-relaxed mb-6">
                  We inspire young people to recognize their responsibility to create a better world and
                  empower them to drive change.
                </p>
                <div className="h-1 w-20 bg-jci-blue mb-6"></div>
                <Button variant="outline" onClick={() => window.location.href = '/contact'}>
                  Contact Us
                </Button>
              </div>
              <div className="bg-gradient-to-br from-jci-navy to-jci-blue rounded-2xl p-8 h-96 flex items-center justify-center">
                <img
                  src="/JCI Kuala Lumpur-transparent.png"
                  alt="JCI Kuala Lumpur"
                  className="max-w-full max-h-full object-contain opacity-90"
                />
              </div>
            </div>
          </div>
        </section>

        {/* JCI Creed, Mission, Vision */}
        <section className="py-16 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-8">
              {/* JCI Creed - Full Width on Top */}
              <Card className="bg-white">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-6">JCI Creed</h3>
                  <ul className="space-y-4 text-slate-600">
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">•</span>
                      <span>That faith in God gives meaning and purpose to human life;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">•</span>
                      <span>That the brotherhood of man transcends the sovereignty of nations;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">•</span>
                      <span>That economic justice can best be won by free men through free enterprise;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">•</span>
                      <span>That government should be of laws rather than of men;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">•</span>
                      <span>That earth's great treasure lies in human personality;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">•</span>
                      <span>And that service to humanity is the best work of life.</span>
                    </li>
                  </ul>
                </div>
              </Card>

              {/* JCI Mission and Vision - Side by Side Below */}
              <div className="grid md:grid-cols-2 gap-8">
                <Card className="bg-white">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-6">JCI Mission</h3>
                    <p className="text-lg text-slate-600 leading-relaxed">
                      To provide development opportunities that empower young people to create positive change.
                    </p>
                  </div>
                </Card>

                <Card className="bg-white">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-6">JCI Vision</h3>
                    <p className="text-lg text-slate-600 leading-relaxed">
                      To be the leading global network of young active citizens.
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Board of Directors */}
        <section className="py-16 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-12">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Board of Directors</h2>
                <p className="text-slate-500 text-sm mt-1">Meet the leaders driving positive impact in Kuala Lumpur</p>
              </div>
              <label className="flex flex-col gap-1.5 self-start md:self-auto">
                <span className="text-[10px] font-black uppercase tracking-wider text-jci-blue">Board Year</span>
                <div className="relative rounded-2xl bg-gradient-to-r from-jci-blue to-jci-lightblue p-[1px] shadow-sm shadow-jci-blue/10">
                  <select
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(event.target.value)}
                    className="appearance-none min-w-[156px] rounded-2xl border-0 bg-white px-4 py-2.5 pr-10 text-sm font-black text-slate-900 outline-none transition-all cursor-pointer hover:bg-sky-50 focus:ring-2 focus:ring-jci-blue/20"
                    aria-label="Select board year"
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-jci-blue">
                    <ChevronDown size={16} strokeWidth={3} />
                  </div>
                </div>
              </label>
            </div>

            {loadingBoard ? (
              <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-jci-blue mb-4"></div>
                <p className="text-slate-500 text-sm font-semibold">Loading Board Directory...</p>
              </div>
            ) : (
              <div className="space-y-10">
                {/* Level 1: President + IPP */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-10">
                  <div className="w-full sm:flex-1 max-w-md">
                    <BoardNode member={president} defaultRole="President" variant="president" />
                  </div>
                  <div className="hidden sm:flex flex-col items-center gap-1 shrink-0">
                    <div className="w-12 h-px border-t-2 border-dashed border-slate-300" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-full">Support</span>
                  </div>
                  <div className="w-full sm:w-auto">
                    <BoardNode member={ipp} defaultRole="Immediate Past President" variant="ipp" />
                  </div>
                </div>

                {/* Connector */}
                <div className="hidden lg:block w-px h-8 bg-gradient-to-b from-jci-blue/30 to-transparent mx-auto" />

                {/* Level 2: Secretary, Treasurer, GLC, EVP */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
                  <BoardNode member={secretary} defaultRole="Secretary" />
                  <BoardNode member={treasurer} defaultRole="Honorary Treasurer" />
                  <BoardNode member={glc} defaultRole="General Legal Counsel" />
                  <div className="relative">
                    <div className="absolute -inset-px bg-gradient-to-br from-jci-blue/20 to-sky-400/20 rounded-2xl blur-sm" />
                    <div className="relative h-full">
                      <BoardNode member={evp} defaultRole="Executive Vice President" />
                    </div>
                  </div>
                </div>

                {/* Connector */}
                <div className="hidden lg:block w-px h-8 bg-gradient-to-b from-transparent via-slate-300/60 to-transparent mx-auto" />

                {/* Level 3: VPs */}
                <div className="rounded-3xl bg-slate-50/60 border border-slate-200/60 p-6 sm:p-8 mx-auto">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1 h-px bg-slate-200/80" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-jci-blue px-3 py-1 bg-sky-50 border border-sky-100/80 rounded-full shrink-0">Vice Presidents</span>
                    <div className="flex-1 h-px bg-slate-200/80" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                    <BoardNode member={vpIndividual} defaultRole="Vice President (Individual)" variant="vp" />
                    <BoardNode member={vpCommunity} defaultRole="Vice President (Community)" variant="vp" />
                    <BoardNode member={vpBusiness} defaultRole="Vice President (Business)" variant="vp" />
                    <BoardNode member={vpInternational} defaultRole="Vice President (International Affairs)" variant="vp" />
                    <BoardNode member={vpLom} defaultRole="Vice President (LOM)" variant="vp" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Our Story Over The Years */}
        <section className="py-16 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">
              Our Story <span className="text-jci-blue">Over The Years</span>
            </h2>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-jci-blue/20 transform md:-translate-x-1/2"></div>

              <div className="space-y-8">
                {timelineEvents.map((event, index) => (
                  <div key={index} className="relative flex items-start md:items-center">
                    {/* Timeline dot */}
                    <div className="absolute left-6 md:left-1/2 w-4 h-4 bg-jci-blue rounded-full border-4 border-white shadow-md transform md:-translate-x-1/2 z-10"></div>

                    {/* Content */}
                    <div className={`ml-16 md:ml-0 md:w-1/2 ${index % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:ml-auto md:pl-12'}`}>
                      <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 mb-2">
                          <Clock size={18} className="text-jci-blue" />
                          <span className="text-sm font-semibold text-jci-blue">{event.year}</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">{event.title}</h3>
                        {event.description && (
                          <p className="text-slate-600">{event.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* What We Do */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">What We Do</h2>
            <div className="grid md:grid-cols-4 gap-6">
              <Card>
                <div className="p-4">
                  <div className="w-12 h-12 bg-jci-blue/10 text-jci-blue rounded-lg flex items-center justify-center mb-4">
                    <Users size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Leadership Development</h3>
                  <p className="text-slate-600">
                    We provide training and opportunities for members to develop leadership skills through
                    hands-on experience in project management and community service.
                  </p>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="w-12 h-12 bg-jci-blue/10 text-jci-blue rounded-lg flex items-center justify-center mb-4">
                    <Briefcase size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Community Projects</h3>
                  <p className="text-slate-600">
                    Our members lead and participate in various community service projects that address
                    local needs and create lasting positive impact.
                  </p>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="w-12 h-12 bg-jci-blue/10 text-jci-blue rounded-lg flex items-center justify-center mb-4">
                    <Sparkles size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Networking</h3>
                  <p className="text-slate-600">
                    Connect with like-minded young professionals and entrepreneurs from diverse backgrounds
                    and industries, both locally and internationally.
                  </p>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="w-12 h-12 bg-jci-blue/10 text-jci-blue rounded-lg flex items-center justify-center mb-4">
                    <Award size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Personal Growth</h3>
                  <p className="text-slate-600">
                    Through our gamification system and mentorship programs, members are recognized and
                    rewarded for their contributions and growth.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-r from-jci-blue to-jci-lightblue">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Ready to Join Us?</h2>
            <p className="text-xl text-blue-100 mb-8">
              Become part of a global network of young leaders making a difference.
            </p>
            <div className="flex justify-center gap-4">
              <Button
                size="lg"
                onClick={onRegister}
                className="bg-transparent text-white border-2 border-white hover:bg-white hover:text-jci-blue"
              >
                Become a Member
              </Button>
            </div>
          </div>
        </section>

      </main>
      <GuestFooter />
    </div>
  );
};

// Newsletter thumbnail component with error fallback
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

// Guest E-Newsletters Page
const GuestEnewslettersPage = ({ onLogin, onRegister, onPageChange }: {
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
        window.open(activeUrl, '_blank');
        showToast('Opening PDF in new tab to print due to browser cross-origin policy.', 'info');
      }
    } else {
      showToast('Load a PDF document to trigger printing.', 'error');
    }
  };

  const totalIssues = newsletters.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="min-h-screen bg-slate-50">
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
                {selectedNewsletter.year} &middot; {selectedNewsletter.issue}
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
                        <p className="text-xs text-sky-200/80 font-semibold">{selectedNewsletter.issue} &middot; {selectedNewsletter.year}</p>
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
                          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{item.year} &middot; {item.issue}</p>
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


// Guest Business Directory Page
const GuestDirectoryPage = ({ onLogin, onRegister, onPageChange }: {
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
            <BusinessDirectoryView isGuest onGuestCta={onRegister} />
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

// Guest Partnership Page
const GuestPartnershipPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => void;
}) => {
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<Partnership | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const { user, member } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPartnerships = async () => {
      try {
        const data = await PartnershipsService.getAllPartnerships();
        const activePartnerships = data.filter(p => p.status === 'active');
        setPartnerships(activePartnerships);

        // Record impressions for all active partnerships loaded
        activePartnerships.forEach(p => {
          if (p.id && !p.id.startsWith('mock')) {
            AdvertisementService.recordImpression(p.id).catch(console.error);
          }
        });
      } catch (err) {
        console.error('Failed to load partnerships:', err);
        showToast('Failed to load partnerships', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchPartnerships();
  }, []);

  const handleCardClick = (partner: Partnership) => {
    setSelectedPartner(partner);
    setIsDetailModalOpen(true);
    if (partner.id && !partner.id.startsWith('mock')) {
      AdvertisementService.recordClick(partner.id).catch(console.error);
    }
  };

  // Benefit Shielding Logic
  const checkRedeemPermission = (partner: Partnership) => {
    if (!user || !member) {
      return { allowed: false, reason: 'login' };
    }

    const userRole = member.role || 'guest';
    const isRoleEligible = !partner.eligbleRoles || partner.eligbleRoles.length === 0 || partner.eligbleRoles.includes(userRole);
    if (!isRoleEligible) {
      return { allowed: false, reason: 'role' };
    }

    const isDuesPaid = member.jciCareer?.isDuesPaidCurrentYear ?? false;
    if (!isDuesPaid) {
      return { allowed: false, reason: 'dues' };
    }

    return { allowed: true };
  };

  const redeemStatus = selectedPartner ? checkRedeemPermission(selectedPartner) : { allowed: false, reason: 'login' };

  return (
    <div className="min-h-screen bg-slate-50">
      <GuestHeader currentPage="partnerships" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        {/* Hero */}
        <section className="relative py-14 md:py-20 bg-gradient-to-br from-jci-navy via-[#1a3d7c] to-jci-blue overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-jci-blue/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest mb-3">Member Benefits</p>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4">Member Perks</h1>
            <p className="text-blue-200 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Exclusive discounts and rewards from our merchant partners — curated for JCI Kuala Lumpur members.
            </p>
            {!loading && partnerships.length > 0 && (
              <div className="flex items-center justify-center gap-6 md:gap-10 mt-8">
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-black text-white">{partnerships.length}</p>
                  <p className="text-blue-300 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Active Partner{partnerships.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Partners Grid */}
        <section className="py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jci-blue mx-auto mb-4" />
                <p className="text-slate-500 text-sm">Loading partnerships...</p>
              </div>
            ) : partnerships.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm max-w-xl mx-auto p-10">
                <Gift size={44} className="text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-black text-slate-800 mb-2">No Active Partnerships</h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
                  There are currently no active merchant partnerships. Check back soon!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
                {partnerships.map(partner => {
                  return (
                    <div
                      key={partner.id}
                      className="group flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden"
                      onClick={() => handleCardClick(partner)}
                    >
                      {/* Logo area */}
                      <div className="relative w-full h-36 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
                        {partner.logo ? (
                          <img
                            src={partner.logo}
                            alt={partner.name}
                            className="max-w-full max-h-full object-contain drop-shadow-sm"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              img.onerror = null; img.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-300">
                            <Gift size={36} />
                          </div>
                        )}
                      </div>

                      {/* Body */}
                      <div className="flex flex-col flex-1 p-4 gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-black text-slate-900 text-sm leading-tight">{partner.name}</h3>
                          <Lock size={13} className="shrink-0 text-slate-300 mt-0.5 group-hover:text-jci-blue transition-colors" />
                        </div>
                        {partner.memberBenefits && (
                          <p className="text-sm text-jci-blue font-semibold line-clamp-2 leading-snug">{partner.memberBenefits}</p>
                        )}
                        <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Tap to unlock details</span>
                          <ChevronRight size={13} className="text-slate-300 group-hover:text-jci-blue transition-colors" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Merchant CTA */}
        <section className="py-16 bg-gradient-to-br from-jci-navy to-jci-blue overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Briefcase size={28} className="text-white/80" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-black text-white mb-2">Are you a merchant?</h2>
              <p className="text-blue-200 text-sm leading-relaxed max-w-lg">
                Partner with JCI Kuala Lumpur to offer exclusive discounts to our professional network of 200+ members across Kuala Lumpur.
              </p>
            </div>
            <Button size="lg" variant="outline" onClick={onRegister}
              className="shrink-0 bg-white !text-jci-navy border-white hover:bg-sky-50 hover:!text-jci-navy font-black shadow-lg">
              Partner With Us
            </Button>
          </div>
        </section>
      </main>

      <GuestFooter />

      {/* Benefit Shielding Modal */}
      {selectedPartner && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => { setIsDetailModalOpen(false); setSelectedPartner(null); }}
          title={selectedPartner.name}
          size="md"
          drawerOnMobile
        >
          <div className="space-y-5">
            {/* Banner + Logo */}
            <div className="relative w-full h-44 overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100">
              {selectedPartner.banner ? (
                <img src={selectedPartner.banner} alt={selectedPartner.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { const img = e.target as HTMLImageElement; img.onerror = null; img.style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Gift size={48} className="text-slate-300" />
                </div>
              )}
              {selectedPartner.logo && (
                <div className="absolute bottom-3 left-3 w-12 h-12 rounded-xl bg-white shadow-md border border-slate-100 overflow-hidden flex items-center justify-center p-1.5">
                  <img src={selectedPartner.logo} alt="logo"
                    className="w-full h-full object-contain"
                    onError={(e) => { const img = e.target as HTMLImageElement; img.onerror = null; img.parentElement!.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>

            {/* Benefit headline */}
            <div className="bg-jci-blue/5 border border-jci-blue/10 rounded-xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-jci-blue mb-1">Member Benefit</p>
              <p className="text-base font-black text-slate-900 leading-snug">{selectedPartner.memberBenefits}</p>
            </div>

            {/* Redeem */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">How to Redeem</p>
              {redeemStatus.allowed ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 text-sm font-bold">
                    <Unlock size={15} className="shrink-0" />
                    Eligibility verified &#8212; benefit unlocked
                  </div>
                  <p className="text-sm font-black text-slate-900 bg-white px-4 py-3 rounded-lg border border-emerald-100 shadow-sm">{selectedPartner.redeemMethod}</p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center mx-auto">
                    <Lock size={18} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="font-black text-slate-800 text-sm">
                      {redeemStatus.reason === 'login' && 'Login to view how to redeem'}
                      {redeemStatus.reason === 'role' && 'Not available for your member tier'}
                      {redeemStatus.reason === 'dues' && 'Settle annual dues to unlock'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Benefit details are protected under JCI Kuala Lumpur Member Benefit Shielding.
                    </p>
                  </div>
                  {redeemStatus.reason === 'login' && (
                    <div className="flex gap-3 justify-center pt-1">
                      <Button size="sm" onClick={() => { setIsDetailModalOpen(false); onLogin(); }}>Login</Button>
                      <Button size="sm" variant="outline" onClick={() => { setIsDetailModalOpen(false); onRegister(); }}>Register</Button>
                    </div>
                  )}
                  {redeemStatus.reason === 'dues' && (
                    <Button size="sm" onClick={() => { setIsDetailModalOpen(false); navigate('/roadmap'); }}>
                      Go to Dues Billing
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// --- Authenticated Dashboard Views ---


const NotificationDrawer: React.FC<{
  isOpen: boolean,
  onClose: () => void,
  notifications: Notification[],
  onMarkAsRead: (id: string) => Promise<void>
}> = ({ isOpen, onClose, notifications, onMarkAsRead }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'Active' | 'History'>('Active');

  const handleAction = async (id: string, type: string) => {
    try {
      await onMarkAsRead(id);
      showToast(type === 'dismiss' ? 'Notification moved to history' : 'Action taken successfully', type === 'dismiss' ? 'info' : 'success');
    } catch (error) {
      showToast('Failed to update notification', 'error');
    }
  }

  const filteredNotifications = notifications.filter(n =>
    activeTab === 'Active' ? !n.read : n.read
  );

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Action Center">
      <div className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('Active')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'Active' ? 'bg-white text-jci-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Active ({notifications.filter(n => !n.read).length})
            </button>
            <button
              onClick={() => setActiveTab('History')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'History' ? 'bg-white text-jci-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              History
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {filteredNotifications.map(note => (
            <div key={note.id} className={`p-4 border rounded-lg shadow-sm transition-colors ${note.read ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200 hover:border-jci-blue'}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 rounded-full flex-shrink-0 ${note.type === 'ai' ? 'bg-purple-100 text-purple-600' : note.type === 'warning' ? 'bg-amber-100 text-amber-600' : note.title.includes('ðŸŽ‚') ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
                  {note.type === 'ai' ? <Sparkles size={16} /> : note.type === 'warning' ? <AlertTriangle size={16} /> : note.title.includes('ðŸŽ‚') ? <Gift size={16} /> : <Bell size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-bold truncate ${note.read ? 'text-slate-600' : 'text-slate-900'}`}>{note.title}</h4>
                  <p className="text-[10px] text-slate-500">
                    {note.timestamp === 'Today' ? 'Today' : (isNaN(new Date(note.timestamp).getTime()) ? note.timestamp : new Date(note.timestamp).toLocaleString())}
                  </p>
                </div>
              </div>
              <p className={`text-sm mb-4 ${note.read ? 'text-slate-500' : 'text-slate-600'}`}>{note.message}</p>

              {!note.read && !note.id.startsWith('birthday-') && (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 text-xs h-8" onClick={() => handleAction(note.id, 'act')}><Check size={14} className="mr-1" /> Approve/Act</Button>
                  <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => handleAction(note.id, 'dismiss')}><X size={14} className="mr-1" /> Dismiss</Button>
                </div>
              )}
            </div>
          ))}

          {filteredNotifications.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <Bell size={32} className="mx-auto mb-2 opacity-20" />
              <p>{activeTab === 'Active' ? 'No new notifications.' : 'No notification history.'}</p>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  )
}

const SearchDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNavigate: (view: ViewType, selectedId?: string) => void;
}> = ({ isOpen, onClose, searchQuery, onSearchChange, onNavigate }) => {
  const { members } = useMembers(); // These hooks are already imported or available
  const { events } = useEvents();
  const { projects } = useProjects();
  const { businesses } = useBusinessDirectory();

  const filteredMembers = searchQuery ? members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5) : [];

  const filteredEvents = searchQuery ? events.filter(e =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5) : [];

  const filteredProjects = searchQuery ? projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5) : [];

  const filteredBusinesses = searchQuery ? businesses.filter(b =>
    (b.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.industry || '').toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5) : [];

  const totalResults = filteredMembers.length + filteredEvents.length + filteredProjects.length + filteredBusinesses.length;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Global Search">
      <div className="space-y-6">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search size={18} className="text-slate-400 group-focus-within:text-jci-blue transition-colors" />
          </div>
          <input
            autoFocus
            type="text"
            placeholder="Search members, events, or projects..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-jci-blue/20 focus:border-jci-blue outline-none transition-all text-sm"
          />
        </div>

        {searchQuery && totalResults === 0 && (
          <div className="text-center py-10 text-slate-400">
            <Search size={32} className="mx-auto mb-2 opacity-20" />
            <p>No results found for "{searchQuery}"</p>
          </div>
        )}

        {filteredMembers.length > 0 && (
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Users size={12} /> Members
            </h4>
            <div className="space-y-2">
              {filteredMembers.map(m => (
                <div
                  key={m.id}
                  onClick={() => { onNavigate('MEMBERS', m.id); onClose(); }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 cursor-pointer transition-all group"
                >
                  <img
                    src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=0097D7&color=fff`}
                    className="w-8 h-8 rounded-full object-cover"
                    alt=""
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-jci-blue transition-colors">{m.name}</p>
                    <p className="text-xs text-slate-500 truncate">{m.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredEvents.length > 0 && (
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Calendar size={12} /> Events
            </h4>
            <div className="space-y-2">
              {filteredEvents.map(e => (
                <div
                  key={e.id}
                  onClick={() => { onNavigate('EVENTS', e.id); onClose(); }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 cursor-pointer transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-jci-blue flex items-center justify-center flex-shrink-0">
                    <Calendar size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-jci-blue transition-colors">{e.title}</p>
                    <p className="text-xs text-slate-500 truncate">{new Date(e.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredProjects.length > 0 && (
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Briefcase size={12} /> Projects
            </h4>
            <div className="space-y-2">
              {filteredProjects.map(p => (
                <div
                  key={p.id}
                  onClick={() => { onNavigate('PROJECTS', p.id); onClose(); }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 cursor-pointer transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                    <Briefcase size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-jci-blue transition-colors">{p.name}</p>
                    <p className="text-xs text-slate-500 truncate">{p.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredBusinesses.length > 0 && (
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Building2 size={12} /> Directory
            </h4>
            <div className="space-y-2">
              {filteredBusinesses.map(b => (
                <div
                  key={b.id}
                  onClick={() => { onNavigate('DIRECTORY', b.id); onClose(); }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 cursor-pointer transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-jci-blue transition-colors">{b.companyName}</p>
                    <p className="text-xs text-slate-500 truncate">{b.industry}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!searchQuery && (
          <div className="text-center py-10 text-slate-400">
            <Search size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Start typing to search across the platform</p>
          </div>
        )}
      </div>
    </Drawer>
  )
}

// --- Main App Shell ---



export const JCIKLApp: React.FC = () => {
  const [view, setView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem('jc_last_view');
    return (savedView as ViewType) || 'GUEST';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);
  const [isNotificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [isSearchDrawerOpen, setSearchDrawerOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [initialSelectedMemberId, setInitialSelectedMemberId] = useState<string | null>(null);
  const [initialSelectedEventId, setInitialSelectedEventId] = useState<string | null>(null);
  const [initialSelectedProjectId, setInitialSelectedProjectId] = useState<string | null>(null);
  const [initialSelectedBusinessId, setInitialSelectedBusinessId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { isBatchMode } = useBatchMode();

  // All hooks must be called before any conditional returns
  const navigate = useNavigate();
  const location = useLocation();

  const [isUpgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isSimulateDropdownOpen, setIsSimulateDropdownOpen] = useState(false);
  const [showBoardDashboard, setShowBoardDashboard] = useState(false);

  const { user, member, loading: authLoading, signOut, simulatedRole, simulateRole, isDevMode } = useAuth();
  const { showToast } = useToast();
  const {
    isBoard,
    isAdmin,
    isDeveloper,
    isMember,
    isPlainMember,
    isGuest,
    canAccessWorkspaceModules,
    effectiveRole,
    hasPermission,
  } = usePermissions();
  const { projects } = useProjects();
  const canViewEventsManagement = React.useMemo(() => {
    if (!member) return false;
    if (isAdmin || isBoard || isDeveloper) return true;
    return projects.some(p => {
      const isCreator = p.organizerId === member.id || p.submittedBy === member.id;
      const isCommittee = p.committee?.some(c => c.memberId === member.id) ?? false;
      return isCreator || isCommittee;
    });
  }, [member, isAdmin, isBoard, isDeveloper, projects]);


  // useCommunication hook is safe to call even without authentication
  // It handles the case when member is null internally
  const { notifications, markNotificationAsRead } = useCommunication();
  const { members } = useMembers();
  const { events } = useEvents();

  const metrics = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const totalMembers = members.length;
    const activeMembers = members.filter(m => {
      const record = (m.membership as any)?.[currentYear];
      const isPaid = record?.status === 'paid' || record?.status === 'over paid';
      return m.role !== UserRole.GUEST && isPaid;
    }).length;

    const newMembersThisMonth = members.filter(m => {
      if (!m.joinDate) return false;
      const joinDate = new Date(m.joinDate);
      const now = new Date();
      return joinDate.getMonth() === now.getMonth() && joinDate.getFullYear() === now.getFullYear();
    }).length;

    const upcomingEvents = events.filter(e => new Date(e.date) >= new Date() && e.status === 'Upcoming').length;
    const activeProjects = projects.filter(p => p.status === 'Active').length;

    return {
      totalMembers,
      activeMembers,
      newMembersThisMonth,
      upcomingEvents,
      activeProjects,
    };
  }, [members, events, projects]);

  // FCM push notification registration
  React.useEffect(() => {
    if (!user?.uid) return;
    registerPushNotifications(user.uid);
    const unsubscribe = onForegroundMessage(({ title, body }) => {
      showToast(`${title}: ${body}`, 'info');
    });
    return () => {
      unsubscribe();
    };
  }, [user?.uid]);

  // Unregister FCM token on logout
  const handleSignOut = React.useCallback(async () => {
    if (user?.uid) await unregisterPushNotifications(user.uid);
    signOut();
  }, [user?.uid, signOut]);

  // Generate birthday notifications
  const birthdayNotifications: Notification[] = React.useMemo(() => {
    if (!members.length) return [];

    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDate = today.getDate();

    return members
      .filter(m => {
        if (!m.dateOfBirth) return false;
        const [y, mStr, dStr] = m.dateOfBirth.split('-');
        return parseInt(mStr) === todayMonth && parseInt(dStr) === todayDate;
      })
      .map(m => ({
        id: `birthday-${m.id}-${today.toISOString().split('T')[0]}`,
        title: `ðŸŽ‚ Member Birthday Today!`,
        message: `It's ${m.name}'s birthday today! Let's send them some warm wishes.`,
        type: 'info' as const,
        read: false,
        timestamp: 'Today'
      }));
  }, [members]);

  // Combined notifications (stable order: birthdays first)
  const allNotifications = React.useMemo(() => {
    return [...birthdayNotifications, ...notifications];
  }, [birthdayNotifications, notifications]);

  const unreadNotifications = allNotifications.filter(n => !n.read);

  // Background trigger for daily 1 PM birthday notifications
  React.useEffect(() => {
    // Only admins or board members trigger the system-wide check to minimize overhead
    if (!member || !['ADMIN', 'BOARD', 'MEMBER'].includes(member.role)) return;

    const checkBirthdays = async () => {
      try {
        await CommunicationService.processDailyBirthdays();
      } catch (error) {
        console.error('Background birthday check failed:', error);
      }
    };

    // Run once on mount
    checkBirthdays();

    // Then every 15 minutes
    const interval = setInterval(checkBirthdays, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [member]);

  // Sync document.title for accessibility (WCAG 2.4.2)
  React.useEffect(() => {
    const titles: Partial<Record<ViewType, string>> = {
      GUEST: 'Home',
      GUEST_EVENTS: 'Events',
      FLAGSHIP_PROJECTS: 'Flagship Projects',
      GUEST_ABOUT: 'About',
      GUEST_ENEWSLETTERS: 'E-Newsletters',
      GUEST_DIRECTORY: 'Business Directory',
      DASHBOARD: 'Dashboard',
      MEMBERS: 'Members',
      EVENTS: 'Events',
      PROJECTS: 'Projects',
      ACTIVITIES: 'Activity Plans',
      FINANCE: 'Finance',
      PAYMENT_REQUESTS: 'Payment Requests',
      GAMIFICATION: 'Gamification',
      INVENTORY: 'Inventory',
      DIRECTORY: 'Business Directory',
      AUTOMATION: 'Automation Studio',
      KNOWLEDGE: 'Knowledge',
      COMMUNICATION: 'Communication',
      CLUBS: 'Hobby Clubs',
      SURVEYS: 'Surveys',
      BENEFITS: 'Member Benefits',
      DATA_IMPORT_EXPORT: 'Data Import/Export',
      TOYYIB: 'ToyyibPay Test',
      ADVERTISEMENTS: 'Partnership & Promotions',
      AI_INSIGHTS: 'AI Insights',
      TEMPLATES: 'Templates',
      ACTIVITY_PLANS: 'Activity Plans',
      REPORTS: 'Reports',
      DEVELOPER: 'Developer Interface',
      WHAPI_CONFIG: 'Whapi Configuration',
    };
    const pageTitle = titles[view] ?? 'JCI LO Management';
    document.title = `${pageTitle} | JCI Kuala Lumpur`;

    // Persist non-guest views to localStorage
    if (view && !view.startsWith('GUEST')) {
      localStorage.setItem('jc_last_view', view);
    }
  }, [view]);


  // Update view based on auth state
  React.useEffect(() => {
    if (!authLoading) {
      if (user && member) {
        // Authenticated
        navigate('/roadmap');

        // If the current view is a GUEST view, switch to DASHBOARD
        // Otherwise, keep the current view (likely restored from localStorage)
        if (view.startsWith('GUEST')) {
          setView('DASHBOARD');
        }
        setSearchQuery('');
      } else {
        // Not authenticated
        const savedView = localStorage.getItem('jc_last_view');
        // If we have a saved guest view, use it, otherwise default to GUEST
        if (savedView && savedView.startsWith('GUEST')) {
          setView(savedView as ViewType);
        } else {
          setView('GUEST');
        }
        setSearchQuery('');
      }
    }
  }, [user, member, authLoading, navigate]);

  // Sync URL with view state - must be before any conditional returns
  React.useEffect(() => {
    if (!user || !member) {
      // Guest pages - sync view with URL
      const path = location.pathname;

      // Protect /roadmap route - redirect to home if not authenticated
      if (path === '/roadmap') {
        navigate('/', { replace: true });
        setView('GUEST');
        return;
      }

      if (path === '/about') {
        setView('GUEST_ABOUT');
      } else if (path === '/events') {
        setView('GUEST_EVENTS');
      } else if (path === '/projects') {
        setView('FLAGSHIP_PROJECTS');
      } else if (path === '/enewsletters') {
        setView('GUEST_ENEWSLETTERS');
      } else if (path === '/directory') {
        setView('GUEST_DIRECTORY');
      } else if (path === '/partnerships') {
        setView('GUEST_PARTNERSHIPS');
      } else if (path === '/') {
        setView('GUEST');
      }
    } else {
      // Authenticated pages - redirect if accessing guest pages
      const path = location.pathname;
      const guestPaths = ['/', '/about', '/events', '/projects', '/enewsletters', '/directory', '/partnerships'];

      if (guestPaths.includes(path)) {
        // Redirect authenticated users away from guest pages
        navigate('/roadmap', { replace: true });
        // Only set to DASHBOARD if we're coming from a guest page
        if (view.startsWith('GUEST')) {
          setView('DASHBOARD');
        }
      } else if (path === '/roadmap') {
        // We're already on roadmap. If view is still a guest view, 
        // it means we just loaded/refreshed and need to default to DASHBOARD
        // OR restore from local state (handled by the other useEffect)
        if (view.startsWith('GUEST')) {
          setView('DASHBOARD');
        }
      }
    }
  }, [location.pathname, user, member, navigate]);

  const handleLogin = () => {
    setLoginModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await handleSignOut();
      localStorage.removeItem('jc_last_view'); // Clear persisted view on logout
      navigate('/', { replace: true });
      setView('GUEST');
      showToast('Logged out successfully', 'success');
    } catch (error) {
      showToast('Failed to logout', 'error');
    }
  };

  const handleViewChange = (newView: ViewType, selectedId?: string) => {
    setSearchQuery('');
    setView(newView);
    if (newView === 'MEMBERS' && selectedId) setInitialSelectedMemberId(selectedId);
    if (newView === 'EVENTS' && selectedId) setInitialSelectedEventId(selectedId);
    if (newView === 'PROJECTS' && selectedId) setInitialSelectedProjectId(selectedId);
    if (newView === 'DIRECTORY' && selectedId) setInitialSelectedBusinessId(selectedId);
  };

  const handleEditProfile = () => {
    if (member) {
      setInitialSelectedMemberId(member.id);
      setView('MEMBERS');
    }
  };

  const openRegistration = () => setRegisterModalOpen(true);
  const closeRegistration = () => setRegisterModalOpen(false);
  const openLogin = () => setLoginModalOpen(true);
  const closeLogin = () => setLoginModalOpen(false);

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <main id="main-content" role="main" className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="sr-only">Loading</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jci-blue mx-auto mb-4" aria-hidden />
          <p className="text-slate-600">Loading...</p>
        </div>
      </main>
    );
  }

  // Handle guest page navigation
  const handleGuestPageChange = (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => {
    setSearchQuery('');
    if (page === 'home') {
      setView('GUEST');
      navigate('/');
    } else if (page === 'events') {
      setView('GUEST_EVENTS');
      navigate('/events');
    } else if (page === 'projects') {
      setView('FLAGSHIP_PROJECTS');
      navigate('/projects');
    } else if (page === 'about') {
      setView('GUEST_ABOUT');
      navigate('/about');
    } else if (page === 'enewsletters') {
      setView('GUEST_ENEWSLETTERS');
      navigate('/enewsletters');
    } else if (page === 'directory') {
      setView('GUEST_DIRECTORY');
      navigate('/directory');
    } else if (page === 'partnerships') {
      setView('GUEST_PARTNERSHIPS');
      navigate('/partnerships');
    }
  };

  // Conditional Rendering Helper for Guest Pages
  if (view === 'GUEST' || view === 'GUEST_EVENTS' || view === 'FLAGSHIP_PROJECTS' || view === 'GUEST_ABOUT' || view === 'GUEST_ENEWSLETTERS' || view === 'GUEST_DIRECTORY' || view === 'GUEST_PARTNERSHIPS') {
    const guestPageProps = {
      onLogin: handleLogin,
      onRegister: openRegistration,
      onPageChange: handleGuestPageChange,
    };

    return (
      <>
        <Routes>
          <Route path="/" element={<GuestLandingPage {...guestPageProps} />} />
          <Route path="/events" element={<GuestEventsPage {...guestPageProps} />} />
          <Route path="/projects" element={<FlagshipProjectsPage {...guestPageProps} />} />
          <Route path="/about" element={<GuestAboutPage {...guestPageProps} />} />
          <Route path="/enewsletters" element={<GuestEnewslettersPage {...guestPageProps} />} />
          <Route path="/directory" element={<GuestDirectoryPage {...guestPageProps} />} />
          <Route path="/partnerships" element={<GuestPartnershipPage {...guestPageProps} />} />
          <Route path="/roadmap" element={<div />} />
          <Route path="*" element={<GuestLandingPage {...guestPageProps} />} />
        </Routes>
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={closeLogin}
          onSwitchToRegister={() => {
            closeLogin();
            openRegistration();
          }}
        />
        <RegisterModal
          isOpen={isRegisterModalOpen}
          onClose={closeRegistration}
          onSwitchToLogin={() => {
            closeRegistration();
            openLogin();
          }}
        />
      </>
    );
  }

  // Render current view based on selected view
  // Note: Cannot use hooks inside this function - use values from component scope
  const renderCurrentView = (scrollRef?: React.RefObject<HTMLDivElement>) => {
    switch (view) {
      case 'MEMBERS': return <MembersView searchQuery={searchQuery} initialSelectedMemberId={initialSelectedMemberId} onClearSelection={() => setInitialSelectedMemberId(null)} />;
      case 'ACTIVITIES': return <ActivityPlansView searchQuery={searchQuery} />;
      case 'PROJECTS':
        if (!canViewEventsManagement) {
          return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />;
        }
        return <ProjectsView onNavigate={handleViewChange} searchQuery={searchQuery} initialSelectedProjectId={initialSelectedProjectId} onClearSelection={() => setInitialSelectedProjectId(null)} />;
      case 'FLAGSHIP_PROJECTS_MGT':
        if (!canViewEventsManagement || isPlainMember) {
          return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />;
        }
        return <FlagshipProjectsManagementView searchQuery={searchQuery} />;
      case 'EVENTS': return <EventsView searchQuery={searchQuery} initialSelectedEventId={initialSelectedEventId} onClearSelection={() => setInitialSelectedEventId(null)} />;
      case 'FINANCE': if (member?.role === UserRole.GUEST) return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />; return hasPermission('canViewFinance') ? <FinanceView searchQuery={searchQuery} /> : <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />;
      case 'PAYMENT_REQUESTS': return <PaymentRequestsView searchQuery={searchQuery} />;
      case 'GAMIFICATION': if (member?.role === UserRole.GUEST) return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />; return <GamificationView />;
      case 'INVENTORY': if (member?.role === UserRole.GUEST) return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />; return hasPermission('canViewFinance') ? <InventoryView searchQuery={searchQuery} /> : <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />;
      case 'DIRECTORY': return <BusinessDirectoryView searchQuery={searchQuery} initialSelectedBusinessId={initialSelectedBusinessId} onClearSelection={() => setInitialSelectedBusinessId(null)} />;
      case 'AUTOMATION': if (member?.role === UserRole.GUEST) return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />; return hasPermission('canViewFinance') ? <AutomationStudio /> : <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />;
      case 'KNOWLEDGE': return <KnowledgeView searchQuery={searchQuery} />;
      case 'COMMUNICATION': return <CommunicationView searchQuery={searchQuery} />;
      case 'CLUBS': return <HobbyClubsView searchQuery={searchQuery} />;
      case 'SURVEYS': return <SurveysView searchQuery={searchQuery} />;
      case 'BENEFITS': return <MemberBenefitsView searchQuery={searchQuery} />;
      case 'DATA_IMPORT_EXPORT': if (member?.role === UserRole.GUEST || isPlainMember) return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />; return <DataImportExportView />;
      case 'RADAR_IMPORTER': if (member?.role === UserRole.GUEST || isPlainMember) return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />; return <RadarDataImporter />;
      case 'ADVERTISEMENTS': if (member?.role === UserRole.GUEST || isPlainMember) return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />; return <AdvertisementsView searchQuery={searchQuery} />;
      case 'AI_INSIGHTS': if (member?.role === UserRole.GUEST) return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />; return <AIInsightsView onNavigate={handleViewChange} searchQuery={searchQuery} />;
      case 'TEMPLATES': if (member?.role === UserRole.GUEST || isPlainMember) return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />; return <TemplatesView searchQuery={searchQuery} />;
      case 'ACTIVITY_PLANS': return <ActivityPlansView searchQuery={searchQuery} />;
      case 'REPORTS': if (member?.role === UserRole.GUEST || isPlainMember) return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />; return <ReportsView />;
      case 'DEVELOPER': return <DeveloperInterface />;
      case 'TOYYIB': return <ToyyibView />;
      case 'WHAPI_CONFIG': return <WhapiConfigView />;
      case 'MEMBERSHIP_CONFIG': return <MembershipConfigView />;
      case 'ACCESS_CONFIG': return <AccessConfigView />;
      case 'PUBLICATIONS': if (member?.role === UserRole.GUEST || isPlainMember) return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />; return <PublicationsView />;
      default:
        if ((isBoard || isAdmin) && showBoardDashboard) {
          return <BoardDashboard
            onNavigate={handleViewChange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            scrollRef={scrollRef}
          />;
        }
        return <DashboardHome
          userRole={(member?.role as UserRole) || UserRole.MEMBER}
          onNavigate={handleViewChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          scrollRef={scrollRef}
        />;
    }
  };

  return (
    <>
      <div className="h-screen bg-slate-50 flex overflow-hidden">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            role="presentation"
            aria-hidden="true"
          />
        )}

        {/* Sidebar - Responsive (Desktop & Mobile Drawer) */}
        <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:relative md:flex
        ${isSidebarCollapsed ? 'w-40' : 'w-64'}
      `}>
          <div className="h-full flex flex-col min-h-0">
            {/* Logo & Toggle */}
            <div className={`h-16 flex items-center border-b border-slate-100 flex-shrink-0 transition-all duration-200 ${isSidebarCollapsed ? 'pl-4 justify-center' : 'pl-6 justify-between'}`}>
              {!isSidebarCollapsed && (
                <img
                  src="/JCI Kuala Lumpur-transparent.png"
                  alt="JCI Kuala Lumpur Logo"
                  className="h-8 w-auto object-contain"
                />
              )}
              {isSidebarCollapsed && (
                <img
                  src="/JCI-logo-only.png"
                  alt="JCI Logo"
                  className="h-8 w-auto object-contain"
                  onError={(e) => {
                    // Fallback if logo-only doesn't exist
                    e.currentTarget.src = "/JCI Kuala Lumpur-transparent.png";
                  }}
                />
              )}
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden md:flex rounded-lg text-slate-400 items-center hover:text-jci-blue transition-colors"
                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden min-h-0">
              <SidebarItem
                icon={<LayoutDashboard size={18} />}
                label="Dashboard"
                isActive={view === 'DASHBOARD'}
                onClick={() => { handleViewChange('DASHBOARD'); setIsSidebarOpen(false); }}
                isCollapsed={isSidebarCollapsed}
              />

              {canAccessWorkspaceModules && (
                <SidebarItem
                  icon={<Users size={18} />}
                  label="Members"
                  isActive={view === 'MEMBERS'}
                  onClick={() => { handleViewChange('MEMBERS'); setIsSidebarOpen(false); }}
                  isCollapsed={isSidebarCollapsed}
                />
              )}
              {canAccessWorkspaceModules && (
                <SidebarItem
                  icon={<Calendar size={18} />}
                  label="Event List"
                  isActive={view === 'EVENTS'}
                  onClick={() => { handleViewChange('EVENTS'); setIsSidebarOpen(false); }}
                  isCollapsed={isSidebarCollapsed}
                />
              )}
              {canAccessWorkspaceModules && (
                <SidebarItem
                  icon={<MessageSquare size={18} />}
                  label="Communication"
                  isActive={view === 'COMMUNICATION'}
                  onClick={() => { handleViewChange('COMMUNICATION'); setIsSidebarOpen(false); }}
                  isCollapsed={isSidebarCollapsed}
                />
              )}
              <SidebarItem
                icon={<Building2 size={18} />}
                label="Directory"
                isActive={view === 'DIRECTORY'}
                onClick={() => { handleViewChange('DIRECTORY'); setIsSidebarOpen(false); }}
                isCollapsed={isSidebarCollapsed}
              />
              <SidebarItem
                icon={<BookOpen size={18} />}
                label="Knowledge"
                isActive={view === 'KNOWLEDGE'}
                onClick={() => { handleViewChange('KNOWLEDGE'); setIsSidebarOpen(false); }}
                isCollapsed={isSidebarCollapsed}
              />
              {member?.role !== UserRole.GUEST && (
                <SidebarItem
                  icon={<Gift size={18} />}
                  label="Benefits"
                  isActive={view === 'BENEFITS'}
                  onClick={() => { handleViewChange('BENEFITS'); setIsSidebarOpen(false); }}
                  isCollapsed={isSidebarCollapsed}
                />
              )}
              <SidebarItem
                icon={<Heart size={18} />}
                label="Hobby Clubs"
                isActive={view === 'CLUBS'}
                onClick={() => { handleViewChange('CLUBS'); setIsSidebarOpen(false); }}
                isCollapsed={isSidebarCollapsed}
              />

              {member?.role !== UserRole.GUEST && (
                <div className="pt-4 mt-4 border-t border-slate-100">
                  <p className={`px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>Workspace</p>

                  {canViewEventsManagement && (
                    <>
                      <SidebarItem
                        icon={<FolderKanban size={18} />}
                        label="Events Management"
                        isActive={view === 'PROJECTS'}
                        onClick={() => { handleViewChange('PROJECTS'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      {!isPlainMember && (
                        <SidebarItem
                          icon={<Briefcase size={18} />}
                          label="Flagship Projects Mgt"
                          isActive={view === 'FLAGSHIP_PROJECTS_MGT'}
                          onClick={() => { handleViewChange('FLAGSHIP_PROJECTS_MGT'); setIsSidebarOpen(false); }}
                          isCollapsed={isSidebarCollapsed}
                        />
                      )}
                    </>
                  )}
                  <SidebarItem
                    icon={<CheckSquare size={18} />}
                    label="Surveys"
                    isActive={view === 'SURVEYS'}
                    onClick={() => { handleViewChange('SURVEYS'); setIsSidebarOpen(false); }}
                    isCollapsed={isSidebarCollapsed}
                  />
                  {canAccessWorkspaceModules && (
                    <SidebarItem
                      icon={<FileText size={18} />}
                      label="Payment Requests"
                      isActive={view === 'PAYMENT_REQUESTS'}
                      onClick={() => { handleViewChange('PAYMENT_REQUESTS'); setIsSidebarOpen(false); }}
                      isCollapsed={isSidebarCollapsed}
                    />
                  )}
                  {hasPermission('canViewFinance') && (
                    <>
                      <SidebarItem
                        icon={<TrendingUp size={18} />}
                        label="Finances"
                        isActive={view === 'FINANCE'}
                        onClick={() => { handleViewChange('FINANCE'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <SidebarItem
                        icon={<Package size={18} />}
                        label="Inventory"
                        isActive={view === 'INVENTORY'}
                        onClick={() => { handleViewChange('INVENTORY'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                    </>
                  )}
                  {(isBoard || isAdmin) && (
                    <>
                      <SidebarItem
                        icon={<Megaphone size={18} />}
                        label="Partnerships & Promotions"
                        isActive={view === 'ADVERTISEMENTS'}
                        onClick={() => { handleViewChange('ADVERTISEMENTS'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />

                    </>
                  )}
                  {canAccessWorkspaceModules && (
                    <SidebarItem
                      icon={<Award size={18} />}
                      label="Gamification"
                      isActive={view === 'GAMIFICATION'}
                      onClick={() => { handleViewChange('GAMIFICATION'); setIsSidebarOpen(false); }}
                      isCollapsed={isSidebarCollapsed}
                    />
                  )}
                </div>
              )}
              {member?.role !== UserRole.GUEST && (isBoard || isAdmin || isDeveloper) && (
                <div className="pt-4 mt-4 border-t border-slate-100 px-2">
                  <p className={`px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>System</p>
                  {(isBoard || isAdmin || isDeveloper) && (
                    <>
                      <SidebarItem
                        icon={<FileText size={18} />}
                        label="Templates"
                        isActive={view === 'TEMPLATES'}
                        onClick={() => { handleViewChange('TEMPLATES'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <SidebarItem
                        icon={<BarChart3 size={18} />}
                        label="Reports"
                        isActive={view === 'REPORTS'}
                        onClick={() => { handleViewChange('REPORTS'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <SidebarItem
                        icon={<Database size={18} />}
                        label="Data Import / Export"
                        isActive={view === 'DATA_IMPORT_EXPORT'}
                        onClick={() => { handleViewChange('DATA_IMPORT_EXPORT'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <SidebarItem
                        icon={<Zap size={18} />}
                        label="Radar Data Importer"
                        isActive={view === 'RADAR_IMPORTER'}
                        onClick={() => { handleViewChange('RADAR_IMPORTER'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <SidebarItem
                        icon={<CreditCard size={18} />}
                        label="ToyyibPay"
                        isActive={view === 'TOYYIB'}
                        onClick={() => { handleViewChange('TOYYIB'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <SidebarItem
                        icon={<MessageSquare size={18} />}
                        label="Whapi API"
                        isActive={view === 'WHAPI_CONFIG'}
                        onClick={() => { handleViewChange('WHAPI_CONFIG'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <SidebarItem
                        icon={<Users size={18} />}
                        label="Membership Config"
                        isActive={view === 'MEMBERSHIP_CONFIG'}
                        onClick={() => { handleViewChange('MEMBERSHIP_CONFIG'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <SidebarItem
                        icon={<Shield size={18} />}
                        label="Access Config"
                        isActive={view === 'ACCESS_CONFIG'}
                        onClick={() => { handleViewChange('ACCESS_CONFIG'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <SidebarItem
                        icon={<BookOpen size={18} />}
                        label="Publications"
                        isActive={view === 'PUBLICATIONS'}
                        onClick={() => { handleViewChange('PUBLICATIONS'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                    </>
                  )}
                  {(isBoard || isAdmin) && (
                    <SidebarItem
                      icon={<Workflow size={18} />}
                      label="Automation Studio"
                      isActive={view === 'AUTOMATION'}
                      onClick={() => { handleViewChange('AUTOMATION'); setIsSidebarOpen(false); }}
                      isCollapsed={isSidebarCollapsed}
                    />
                  )}
                </div>
              )}
              {isDeveloper && (
                <div className="pt-4 mt-4 border-t border-slate-100 px-2">
                  <p className={`px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>Developer</p>
                  <SidebarItem
                    icon={<Sparkles size={18} />}
                    label="AI Insights"
                    isActive={view === 'AI_INSIGHTS'}
                    onClick={() => { setView('AI_INSIGHTS'); setIsSidebarOpen(false); }}
                    isCollapsed={isSidebarCollapsed}
                  />
                  <SidebarItem
                    icon={<Code size={18} />}
                    label="Developer Interface"
                    isActive={view === 'DEVELOPER'}
                    onClick={() => { handleViewChange('DEVELOPER'); setIsSidebarOpen(false); }}
                    isCollapsed={isSidebarCollapsed}
                  />
                </div>
              )}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main id="main-content" className="flex-1 flex flex-col min-w-0 h-full overflow-hidden" tabIndex={-1} role="main">
          <h1 className="sr-only">
            {view === 'DASHBOARD' ? 'Dashboard' : view === 'MEMBERS' ? 'Members' : view === 'EVENTS' ? 'Event List' : view === 'PROJECTS' ? 'Events Management' : view === 'ACTIVITIES' ? 'Activity Plans' : view === 'FINANCE' ? 'Finance' : view === 'PAYMENT_REQUESTS' ? 'Payment Requests' : view === 'GAMIFICATION' ? 'Gamification' : view === 'INVENTORY' ? 'Inventory' : view === 'DIRECTORY' ? 'Business Directory' : view === 'AUTOMATION' ? 'Automation Studio' : view === 'KNOWLEDGE' ? 'Knowledge' : view === 'COMMUNICATION' ? 'Communication' : view === 'CLUBS' ? 'Hobby Clubs' : view === 'SURVEYS' ? 'Surveys' : view === 'BENEFITS' ? 'Member Benefits' : view === 'DATA_IMPORT_EXPORT' ? 'Data Import/Export' : view === 'ADVERTISEMENTS' ? 'Partnership & Promotions' : view === 'AI_INSIGHTS' ? 'AI Insights' : view === 'TEMPLATES' ? 'Templates' : view === 'ACTIVITY_PLANS' ? 'Activity Plans' : view === 'REPORTS' ? 'Reports' : view === 'DEVELOPER' ? 'Developer Interface' : 'JCI LO Management'}
          </h1>
          {/* Topbar removed for premium gradient header replacement */}

          {/* Global Persistent Header - Always visible, not affected by scrolling */}
          {member && (
            <div className="z-[50] text-white relative pt-4 pb-4 px-5 sm:px-8">
              {/* Background with rounded corners, shadow, and overflow hidden */}
              <div className="absolute inset-0 bg-gradient-to-br from-jci-navy to-jci-blue rounded-b-[40px] overflow-hidden z-0 shadow-2xl">
                {/* Decorative Background Pattern */}
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
              </div>

              <div className="relative z-10 space-y-6 max-w-7xl mx-auto">
                {/* Top Row: Avatar & Status | Notifications */}
                <div className="flex justify-end items-center">
                  <div className="flex items-center">
                    {(isDevMode || member.role === UserRole.ADMIN || simulatedRole !== null) && (
                      <div className="relative mr-2 z-30">
                        <button
                          onClick={() => setIsSimulateDropdownOpen(!isSimulateDropdownOpen)}
                          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 rounded-xl px-2.5 py-1.5 transition-all text-white text-[11px] font-bold shadow-sm"
                          title="Simulate Role"
                        >
                          <Shield size={12} className="text-purple-300 shrink-0" />
                          <span>{simulatedRole ? `${simulatedRole} Mode` : 'Dev/Admin'}</span>
                          <ChevronDown size={11} className={`text-white/60 transition-transform duration-200 ${isSimulateDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isSimulateDropdownOpen && (
                          <>
                            {/* Backdrop click outside capture */}
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setIsSimulateDropdownOpen(false)}
                            />
                            {/* Popover Dropdown Menu */}
                            <div className="absolute right-0 mt-2 w-40 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                              {[
                                { value: '', label: 'Dev/Admin', desc: 'Full privileges' },
                                { value: UserRole.ADMIN, label: 'Admin', desc: 'Administrator' },
                                { value: UserRole.MEMBER, label: 'Member', desc: 'Official Member' },
                                { value: UserRole.GUEST, label: 'Guest', desc: 'Registered Guest' }
                              ].map((opt) => {
                                const isSelected = (simulatedRole || '') === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    onClick={() => {
                                      const val = opt.value;
                                      simulateRole(val ? val as UserRole : null);
                                      showToast(val ? `Simulating ${val} role` : 'Reset to Admin role', 'info');
                                      setIsSimulateDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] transition-all flex flex-col gap-0.5 ${isSelected
                                      ? 'bg-blue-600 text-white font-bold'
                                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>{opt.label}</span>
                                      {isSelected && <Check size={10} className="text-white" />}
                                    </div>
                                    <span className={`text-[9px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                      {opt.desc}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {(isBoard || isAdmin) && (
                      <button
                        onClick={() => setShowBoardDashboard(v => !v)}
                        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 mr-1 transition-all text-[11px] font-bold border ${showBoardDashboard
                          ? 'bg-white text-jci-navy border-white/30 shadow-sm'
                          : 'bg-white/10 hover:bg-white/20 border-white/10 hover:border-white/20 text-white'
                          }`}
                        title="Toggle Board Dashboard"
                      >
                        <LayoutDashboard size={12} className="shrink-0" />
                        <span>{showBoardDashboard ? 'Board' : 'Board'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSearchDrawerOpen(true)}
                      className="p-3 rounded-full hover:bg-white/20 transition-all hover:shadow-xl"
                      title="Search"
                    >
                      <Search size={20} className="group-hover:scale-110 transition-transform" />
                    </button>

                    <button
                      onClick={() => setNotificationDrawerOpen(true)}
                      className="relative p-3 rounded-full hover:bg-white/20 transition-all hover:shadow-xl"
                    >
                      <Bell size={20} className="group-hover:rotate-12 transition-transform" />
                      {unreadNotifications.length > 0 && (
                        <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[10px] flex items-center justify-center">
                          {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={handleLogout}
                      className="hidden md:flex items-center gap-1.5 p-3 rounded-full hover:bg-white/20 transition-all hover:shadow-xl"
                      title="Sign Out"
                    >
                      <LogOut size={20} />
                    </button>

                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable Area */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pt-4 pb-32 md:pb-4 px-5 sm:px-8 ">
            <Suspense fallback={
              <div className="flex flex-col gap-4 animate-pulse pt-2">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3" />
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
              </div>
            }>
              {renderCurrentView(scrollContainerRef)}
            </Suspense>
          </div>
        </main>

        <NotificationDrawer
          isOpen={isNotificationDrawerOpen}
          onClose={() => setNotificationDrawerOpen(false)}
          notifications={allNotifications}
          onMarkAsRead={async (id) => {
            if (id.startsWith('birthday-')) {
              // Virtual notification, just close or ignore
              return;
            }
            await markNotificationAsRead(id);
          }}
        />

        <SearchDrawer
          isOpen={isSearchDrawerOpen}
          onClose={() => setSearchDrawerOpen(false)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNavigate={handleViewChange}
        />


      </div >

      {/* Floating Bottom Navigation Bar (Mobile) */}
      {
        (isMember || isGuest || isBoard || isAdmin || isDeveloper) && !isBatchMode && (
          <>
            <div className={`md:hidden fixed bottom-6 left-6 right-6 ${isBoard || isAdmin || isDeveloper ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-slate-200/50'} backdrop-blur-md rounded-[40px] shadow-2xl border flex items-center justify-around h-20 px-4 z-50`}>
              <button
                onClick={() => handleViewChange('DASHBOARD')}
                className={`flex flex-col items-center gap-1 transition-all duration-300 min-w-[64px] ${view === 'DASHBOARD' ? 'text-jci-blue' : 'text-slate-400'}`}
              >
                <div className={`p-2 rounded-2xl transition-all duration-300 ${view === 'DASHBOARD' ? 'bg-jci-blue text-white shadow-lg shadow-jci-blue/30' : (isBoard || isAdmin || isDeveloper ? 'bg-white/5' : '')}`}>
                  <LayoutDashboard size={20} />
                </div>
                <span className={`text-[9px] font-bold tracking-widest uppercase transition-colors duration-300 ${view === 'DASHBOARD' ? 'text-jci-blue' : 'text-slate-400'}`}>Dashboard</span>
              </button>

              <button
                onClick={() => {
                  if (member?.role === UserRole.GUEST) setUpgradeModalOpen(true);
                  else handleViewChange('DIRECTORY');
                }}
                className={`flex flex-col items-center gap-1 transition-all duration-300 min-w-[64px] ${view === 'DIRECTORY' ? 'text-jci-blue' : 'text-slate-400'}`}
              >
                <div className={`p-2 rounded-2xl transition-all duration-300 ${view === 'DIRECTORY' ? 'bg-jci-blue text-white shadow-lg shadow-jci-blue/30' : (isBoard || isAdmin || isDeveloper ? 'bg-white/5' : '')}`}>
                  <Building2 size={20} />
                </div>
                <span className={`text-[9px] font-bold tracking-widest uppercase transition-colors duration-300 ${view === 'DIRECTORY' ? 'text-jci-blue' : 'text-slate-400'}`}>Directory</span>
              </button>
              <button
                onClick={() => {
                  if (member?.role === UserRole.GUEST) setUpgradeModalOpen(true);
                  else handleViewChange('BENEFITS');
                }}
                className={`flex flex-col items-center gap-1 transition-all duration-300 min-w-[64px] ${view === 'BENEFITS' ? 'text-jci-blue' : 'text-slate-400'}`}
              >
                <div className={`p-2 rounded-2xl transition-all duration-300 ${view === 'BENEFITS' ? 'bg-jci-blue text-white shadow-lg shadow-jci-blue/30' : (isBoard || isAdmin || isDeveloper ? 'bg-white/5' : '')}`}>
                  <Gift size={20} />
                </div>
                <span className={`text-[9px] font-bold tracking-widest uppercase transition-colors duration-300 ${view === 'BENEFITS' ? 'text-jci-blue' : 'text-slate-400'}`}>Benefits</span>
              </button>

              <button
                onClick={() => setShowMobileMenu(true)}
                className={`flex flex-col items-center gap-1 transition-all duration-300 min-w-[64px] ${showMobileMenu ? 'text-jci-blue' : 'text-slate-400'}`}
              >
                <div className={`rounded-2xl transition-all duration-300 overflow-hidden ${showMobileMenu ? 'ring-2 ring-jci-blue ring-offset-1 shadow-lg shadow-jci-blue/30' : 'ring-2 ring-transparent'}`}>
                  {member?.avatar ? (
                    <img src={member.avatar} alt={member?.name || 'Me'} className="w-9 h-9 rounded-2xl object-cover" />
                  ) : (
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-black ${showMobileMenu ? 'bg-jci-blue text-white' : (isBoard || isAdmin || isDeveloper ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600')}`}>
                      {(member?.name || 'M').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className={`text-[9px] font-bold tracking-widest uppercase transition-colors duration-300 ${showMobileMenu ? 'text-jci-blue' : 'text-slate-400'}`}>Menu</span>
              </button>
            </div>

            {/* Mobile Menu Bottom Drawer */}
            {showMobileMenu && (
              <div className="md:hidden fixed inset-0 z-[60]" onClick={() => setShowMobileMenu(false)}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <div
                  className={`absolute bottom-0 left-0 right-0 ${isBoard || isAdmin || isDeveloper ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border-t rounded-t-3xl px-6 pb-10 pt-4 shadow-2xl max-h-[85vh] overflow-y-auto`}
                  onClick={e => e.stopPropagation()}
                >
                  <div className={`w-10 h-1 rounded-full mx-auto mb-4 ${isBoard || isAdmin || isDeveloper ? 'bg-slate-600' : 'bg-slate-200'}`} />

                  {/* Profile Card */}
                  <div
                    className={`flex items-center gap-3 p-3 rounded-2xl mb-4 cursor-pointer active:scale-[0.98] transition-all ${isBoard || isAdmin || isDeveloper ? 'bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100'}`}
                    onClick={() => { handleViewChange('MEMBERS', member?.id); setShowMobileMenu(false); }}
                  >
                    <div className="relative shrink-0">
                      {member?.avatar ? (
                        <img src={member.avatar} alt={member?.name || ''} className="w-12 h-12 rounded-full object-cover border-2 border-white/20" />
                      ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black ${isBoard || isAdmin || isDeveloper ? 'bg-jci-blue text-white' : 'bg-slate-200 text-slate-600'}`}>
                          {(member?.name || 'M').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-black text-sm leading-tight truncate ${isBoard || isAdmin || isDeveloper ? 'text-white' : 'text-slate-900'}`}>{member?.name || 'Member'}</p>
                      <p className={`text-xs truncate mt-0.5 ${isBoard || isAdmin || isDeveloper ? 'text-slate-400' : 'text-slate-500'}`}>{member?.email || ''}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isBoard || isAdmin || isDeveloper ? 'bg-jci-blue/20 text-jci-blue' : 'bg-slate-200 text-slate-600'}`}>{member?.tier || 'Member'}</span>
                        <span className={`text-[10px] font-bold ${isBoard || isAdmin || isDeveloper ? 'text-slate-500' : 'text-slate-400'}`}>{member?.points ?? 0} pts</span>
                      </div>
                    </div>
                    <div className={`text-xs font-bold shrink-0 ${isBoard || isAdmin || isDeveloper ? 'text-slate-500' : 'text-slate-400'}`}>
                      View Profile →
                    </div>
                  </div>

                  {/* Main grid */}
                  <div className="grid grid-cols-5 gap-y-4 gap-x-1 mb-4">
                    {canAccessWorkspaceModules && (
                      <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('MEMBERS'); setShowMobileMenu(false); }}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${isBoard || isAdmin || isDeveloper ? 'bg-purple-950/30 text-purple-400 border-purple-900/50' : 'bg-purple-50 text-purple-600 border-purple-100'}`}><Users size={22} /></div>
                        <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${isBoard || isAdmin || isDeveloper ? 'text-slate-300' : 'text-slate-600'}`}>Members</span>
                      </div>
                    )}
                    {canAccessWorkspaceModules && (
                      <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('EVENTS'); setShowMobileMenu(false); }}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${isBoard || isAdmin || isDeveloper ? 'bg-green-950/30 text-green-400 border-green-900/50' : 'bg-green-50 text-green-600 border-green-100'}`}><Calendar size={22} /></div>
                        <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${isBoard || isAdmin || isDeveloper ? 'text-slate-300' : 'text-slate-600'}`}>Event List</span>
                      </div>
                    )}
                    {canAccessWorkspaceModules && (
                      <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('COMMUNICATION'); setShowMobileMenu(false); }}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${isBoard || isAdmin || isDeveloper ? 'bg-sky-950/30 text-sky-400 border-sky-900/50' : 'bg-sky-50 text-sky-600 border-sky-100'}`}><MessageSquare size={22} /></div>
                        <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${isBoard || isAdmin || isDeveloper ? 'text-slate-300' : 'text-slate-600'}`}>Comm</span>
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('KNOWLEDGE'); setShowMobileMenu(false); }}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${isBoard || isAdmin || isDeveloper ? 'bg-indigo-950/30 text-indigo-400 border-indigo-900/50' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}><BookOpen size={22} /></div>
                      <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${isBoard || isAdmin || isDeveloper ? 'text-slate-300' : 'text-slate-600'}`}>Knowledge</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('CLUBS'); setShowMobileMenu(false); }}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${isBoard || isAdmin || isDeveloper ? 'bg-pink-950/30 text-pink-400 border-pink-900/50' : 'bg-pink-50 text-pink-600 border-pink-100'}`}><Heart size={22} /></div>
                      <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${isBoard || isAdmin || isDeveloper ? 'text-slate-300' : 'text-slate-600'}`}>Hobbies</span>
                    </div>
                  </div>

                  {/* Workspace section */}
                  {member?.role !== UserRole.GUEST && (
                    <div className={`pt-4 border-t ${isBoard || isAdmin || isDeveloper ? 'border-slate-700/50' : 'border-slate-100'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isBoard || isAdmin || isDeveloper ? 'text-slate-500' : 'text-slate-400'}`}>Workspace</p>
                      <div className="grid grid-cols-4 gap-y-4 gap-x-1 mb-4">
                        {canViewEventsManagement && (
                          <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('PROJECTS'); setShowMobileMenu(false); }}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${isBoard || isAdmin || isDeveloper ? 'bg-blue-950/30 text-blue-400 border-blue-900/50' : 'bg-blue-50 text-blue-600 border-blue-100'}`}><FolderKanban size={22} /></div>
                            <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${isBoard || isAdmin || isDeveloper ? 'text-slate-300' : 'text-slate-600'}`}>Evts Mgt</span>
                          </div>
                        )}
                        {canViewEventsManagement && !isPlainMember && (
                          <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('FLAGSHIP_PROJECTS_MGT'); setShowMobileMenu(false); }}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${isBoard || isAdmin || isDeveloper ? 'bg-violet-950/30 text-violet-400 border-violet-900/50' : 'bg-violet-50 text-violet-600 border-violet-100'}`}><Briefcase size={22} /></div>
                            <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${isBoard || isAdmin || isDeveloper ? 'text-slate-300' : 'text-slate-600'}`}>Flagship</span>
                          </div>
                        )}
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('SURVEYS'); setShowMobileMenu(false); }}>
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${isBoard || isAdmin || isDeveloper ? 'bg-rose-950/30 text-rose-400 border-rose-900/50' : 'bg-rose-50 text-rose-600 border-rose-100'}`}><CheckSquare size={22} /></div>
                          <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${isBoard || isAdmin || isDeveloper ? 'text-slate-300' : 'text-slate-600'}`}>Surveys</span>
                        </div>
                        {canAccessWorkspaceModules && (
                          <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('PAYMENT_REQUESTS'); setShowMobileMenu(false); }}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${isBoard || isAdmin || isDeveloper ? 'bg-amber-950/30 text-amber-400 border-amber-900/50' : 'bg-amber-50 text-amber-600 border-amber-100'}`}><FileText size={22} /></div>
                            <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${isBoard || isAdmin || isDeveloper ? 'text-slate-300' : 'text-slate-600'}`}>Payment Req</span>
                          </div>
                        )}
                        {hasPermission('canViewFinance') && (
                          <>
                            <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('FINANCE'); setShowMobileMenu(false); }}>
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${isBoard || isAdmin || isDeveloper ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}><TrendingUp size={22} /></div>
                              <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${isBoard || isAdmin || isDeveloper ? 'text-slate-300' : 'text-slate-600'}`}>Finances</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('INVENTORY'); setShowMobileMenu(false); }}>
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${isBoard || isAdmin || isDeveloper ? 'bg-amber-950/30 text-amber-400 border-amber-900/50' : 'bg-amber-50 text-amber-600 border-amber-100'}`}><Package size={22} /></div>
                              <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${isBoard || isAdmin || isDeveloper ? 'text-slate-300' : 'text-slate-600'}`}>Inventory</span>
                            </div>
                          </>
                        )}
                        {(isBoard || isAdmin) && (
                          <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('ADVERTISEMENTS'); setShowMobileMenu(false); }}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${isBoard || isAdmin || isDeveloper ? 'bg-orange-950/30 text-orange-400 border-orange-900/50' : 'bg-orange-50 text-orange-600 border-orange-100'}`}><Megaphone size={22} /></div>
                            <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${isBoard || isAdmin || isDeveloper ? 'text-slate-300' : 'text-slate-600'}`}>Partners</span>
                          </div>
                        )}
                        {canAccessWorkspaceModules && (
                          <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('GAMIFICATION'); setShowMobileMenu(false); }}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${isBoard || isAdmin || isDeveloper ? 'bg-yellow-950/30 text-yellow-400 border-yellow-900/50' : 'bg-yellow-50 text-yellow-600 border-yellow-100'}`}><Award size={22} /></div>
                            <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${isBoard || isAdmin || isDeveloper ? 'text-slate-300' : 'text-slate-600'}`}>Gamify</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* System section */}
                  {(isBoard || isAdmin || isDeveloper) && (
                    <div className="pt-4 border-t border-slate-700/50">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-slate-500">System</p>
                      <div className="grid grid-cols-5 gap-y-4 gap-x-1">
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('TEMPLATES'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><FileText size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Templates</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('REPORTS'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><BarChart3 size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Reports</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('DATA_IMPORT_EXPORT'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><Database size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Data I/O</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('RADAR_IMPORTER'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><Zap size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Radar</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('TOYYIB'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><CreditCard size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">ToyyibPay</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('WHAPI_CONFIG'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><MessageSquare size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Whapi API</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('MEMBERSHIP_CONFIG'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><Users size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Mbr Config</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('ACCESS_CONFIG'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><Shield size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Access Cfg</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('PUBLICATIONS'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><BookOpen size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Publications</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('AUTOMATION'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><Activity size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Automation</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Logout */}
                  <div className={`mt-4 pt-4 border-t ${isBoard || isAdmin || isDeveloper ? 'border-slate-700/50' : 'border-slate-100'}`}>
                    <button
                      onClick={() => { setShowMobileMenu(false); handleLogout(); }}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] ${isBoard || isAdmin || isDeveloper ? 'bg-red-950/30 text-red-400 border border-red-900/40 hover:bg-red-950/50' : 'bg-red-50 text-red-500 border border-red-100 hover:bg-red-100'}`}
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )
      }

      <Modal
        isOpen={isUpgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Join Member to Unlock More"
        size="md"
        footer={(
          <div className="flex flex-col gap-3 w-full">
            <Button className="w-full" onClick={() => { setUpgradeModalOpen(false); /* Route to Join Us or open registration */ }}>
              Join Us Now
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setUpgradeModalOpen(false)}>
              Maybe Later
            </Button>
          </div>
        )}
      >
        <div className="text-center p-4">
          <div className="w-16 h-16 bg-blue-50 text-jci-blue rounded-full flex items-center justify-center mx-auto mb-4">
            <Award size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Unlock More Features</h3>
          <p className="text-sm text-slate-500 mb-4">
            Upgrade your account to access Claims, Business Directory, Projects, Mentorship, and more exclusive member benefits!
          </p>
        </div>
      </Modal>
    </>
  );
};

const App: React.FC = () => {
  return (
    <BatchModeProvider>
      <ErrorBoundary
        onError={(error, errorInfo) => {
          // Log error to our error logging service
          errorLoggingService.logError(error, {
            component: 'App',
            action: 'render'
          }, errorInfo);
        }}
      >
        <BrowserRouter>
          <AsyncErrorBoundary
            onError={(error) => {
              errorLoggingService.logError(error, {
                component: 'App',
                action: 'async_operation'
              });
            }}
          >
            <AuthProvider>
              <ToastProvider>
                <ErrorBoundary
                  onError={(error, errorInfo) => {
                    errorLoggingService.logError(error, {
                      component: 'JCIKLApp',
                      action: 'main_app_render'
                    }, errorInfo);
                  }}
                >
                  <JCIKLApp />
                </ErrorBoundary>
              </ToastProvider>
            </AuthProvider>
          </AsyncErrorBoundary>
        </BrowserRouter>
      </ErrorBoundary>
    </BatchModeProvider>
  );
}

export default App;
