import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Users, Calendar, LayoutDashboard, Briefcase, FolderKanban,
  LogOut, Award, Sparkles, TrendingUp,
  Menu, Bell, Search, AlertTriangle, Package, Building2, Workflow,
  MessageSquare, BookOpen, Heart, CheckSquare, Check, X, CheckCircle,
  Gift, Database, Megaphone, BarChart3, FileText, Code, Mail, Phone, Facebook, Instagram, Youtube, Clock, UserCircle,
  ChevronLeft, ChevronRight, ChevronDown, Target, Edit3, CreditCard, Image as ImageIcon, MapPin, Tag, Shield, RotateCcw,
  Download, Printer, Share2, Copy, ExternalLink, Eye, Upload, Info, Zap, Activity, DollarSign
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
import { NonMemberLeadService } from './services/nonMemberLeadService';
import { CommunicationService } from './services/communicationService';
import { ProjectsService } from './services/projectsService';
import { FlagshipProjectsService } from './services/flagshipProjectsService';
import { BoardManagementService } from './services/boardManagementService';
import { MembersService } from './services/membersService';
import { registerPushNotifications, unregisterPushNotifications, onForegroundMessage } from './services/notificationService';
import { DEFAULT_LO_ID } from './config/constants';

// Module Imports — lazy-loaded for code splitting (each view is a separate chunk)
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
const CanvaView = lazy(() => import('./components/modules/CanvaView').then(m => ({ default: m.CanvaView })));
const DeveloperInterface = lazy(() => import('./components/modules/DeveloperInterface').then(m => ({ default: m.DeveloperInterface })));
const ToyyibView = lazy(() => import('./components/modules/ToyyibView').then(m => ({ default: m.ToyyibView })));
const WhapiConfigView = lazy(() => import('./components/modules/WhapiConfigView').then(m => ({ default: m.WhapiConfigView })));
const MembershipConfigView = lazy(() => import('./components/modules/MembershipConfigView').then(m => ({ default: m.MembershipConfigView })));
const AccessConfigView = lazy(() => import('./components/modules/AccessConfigView').then(m => ({ default: m.AccessConfigView })));
const PublicationsView = lazy(() => import('./components/modules/PublicationsView').then(m => ({ default: m.PublicationsView })));
const RadarDataImporter = lazy(() => import('./components/admin/RadarDataImporter').then(m => ({ default: m.RadarDataImporter })));
import { PublicationService, toGoogleDrivePreviewUrl, extractGoogleDriveFileId } from './services/publicationService';
import { HelpModalProvider } from './contexts/HelpModalContext';
import { BatchModeProvider, useBatchMode } from './contexts/BatchModeContext';
import { PartnershipsService } from './services/partnershipsService';
import { Partnership, FlagshipProject } from './types';
import { AdvertisementService } from './services/advertisementService';

// --- View Definitions ---

type ViewType = 'GUEST' | 'GUEST_EVENTS' | 'FLAGSHIP_PROJECTS' | 'GUEST_ABOUT' | 'GUEST_ENEWSLETTERS' | 'GUEST_DIRECTORY' | 'GUEST_PARTNERSHIPS' | 'DASHBOARD' | 'MEMBERS' | 'EVENTS' | 'PROJECTS' | 'ACTIVITIES' | 'FINANCE' | 'PAYMENT_REQUESTS' | 'GAMIFICATION' | 'INVENTORY' | 'DIRECTORY' | 'AUTOMATION' | 'KNOWLEDGE' | 'COMMUNICATION' | 'CLUBS' | 'SURVEYS' | 'BENEFITS' | 'DATA_IMPORT_EXPORT' | 'ADVERTISEMENTS' | 'AI_INSIGHTS' | 'TEMPLATES' | 'ACTIVITY_PLANS' | 'REPORTS' | 'DEVELOPER' | 'TOYYIB' | 'CANVA' | 'WHAPI_CONFIG' | 'MEMBERSHIP_CONFIG' | 'ACCESS_CONFIG' | 'PUBLICATIONS' | 'RADAR_IMPORTER' | 'FLAGSHIP_PROJECTS_MGT';

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
}) => (
  <div className="min-h-screen bg-slate-50">
    <GuestHeader currentPage="home" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

    <main id="main-content">
      {/* Hero */}
      <section className="relative bg-jci-navy py-32 overflow-hidden" aria-label="Hero">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Be Better. <span className="text-jci-lightblue">Do Better.</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
            Join a global network of young active citizens creating positive change.
            Manage your growth, connect with mentors, and lead impactful projects.
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" onClick={onRegister}>
              Become a Member
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white text-white bg-transparent hover:border-jci-blue hover:text-jci-blue focus:ring-jci-blue text-lg hover:bg-white hover:text-jci-navy"
              onClick={() => onPageChange('events')}
            >
              View Activity Calendar
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            <div className="text-center p-6 rounded-2xl bg-slate-50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-16 h-16 bg-jci-blue/10 text-jci-blue rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Sparkles size={32} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">Personalized Growth</h3>
              <p className="text-slate-600 leading-relaxed">
                AI-driven recommendations for trainings and roles that match your career goals.
              </p>
            </div>

            <div className="text-center p-6 rounded-2xl bg-slate-50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-16 h-16 bg-jci-blue/10 text-jci-blue rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Briefcase size={32} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">Project Leadership</h3>
              <p className="text-slate-600 leading-relaxed">
                Lead real-world projects with automated financial tracking and team management tools.
              </p>
            </div>

            <div className="text-center p-6 rounded-2xl bg-slate-50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-16 h-16 bg-jci-blue/10 text-jci-blue rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Users size={32} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">Global Networking</h3>
              <p className="text-slate-600 leading-relaxed">
                Connect with members locally and internationally. Expand your business reach.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Additional CTA Section */}
      <section className="py-16 bg-gradient-to-r from-jci-blue to-jci-lightblue">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Make an Impact?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of young leaders creating positive change in their communities.
          </p>
          <Button
            size="lg"
            onClick={onRegister}
            className="bg-transparent text-white border-2 border-white hover:bg-white hover:text-jci-blue focus:ring-jci-blue shadow-lg hover:shadow-xl transition-all"
          >
            Get Started Today
          </Button>
        </div>
      </section>

    </main>
    <GuestFooter />
  </div>
);

// Guest Events Page
const GuestEventsPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => void;
}) => {
  const { events, loading } = useEvents({ publicMode: true });
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
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
        <section className="py-16 bg-gradient-to-r from-jci-navy to-jci-blue text-white" aria-label="Page header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Upcoming Events</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
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

      {selectedEvent && isRegistrationModalOpen && (
        <Modal
          isOpen={isRegistrationModalOpen}
          onClose={() => {
            setIsRegistrationModalOpen(false);
            setSelectedEvent(null);
            setGuestRegistrationData({
              name: '',
              email: '',
              phone: '',
              organization: '',
              notes: '',
            });
          }}
          title={null}
          size="lg"
          bottomSheet={true}
          drawerOnMobile
          mobileHeight="h-[90vh]"
          scrollInBody={true}
          className="premium-registration-modal"
          footerClassName="flex-none p-6 bg-white border-t border-slate-50 rounded-t-[40px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.15)] z-30 pb-safe"
          footer={(
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex flex-col">
                <span className="text-2xl font-black text-slate-900 leading-none">
                  {selectedEvent.price ? `RM ${selectedEvent.price}` : 'FREE'}
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">per person</span>
              </div>
              <Button
                form="guest-registration-form"
                type="submit"
                className="flex-1 max-w-[240px] h-14 bg-blue-600 text-white hover:bg-blue-700 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <CheckCircle size={20} className="stroke-[3]" />
                <span>Confirm Registration</span>
              </Button>
            </div>
          )}
        >
          <div className="-m-4 md:-m-6 relative">
            {/* Hero Image Section */}
            <div className="relative h-48 md:h-64 w-full overflow-hidden">
              <img
                src={selectedEvent.imageUrl || "https://images.unsplash.com/photo-1540575861501-7cf05a4b125a?auto=format&fit=crop&q=80"}
                alt={selectedEvent.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>

              {/* Top Controls */}
              <div className="absolute top-4 left-4">
                <button
                  onClick={() => setIsRegistrationModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all"
                >
                  <ChevronLeft size={20} />
                </button>
              </div>
            </div>

            {/* Content Body - Overlapping Card Style */}
            <div className="relative bg-white rounded-t-[32px] -mt-10 px-6 pt-8 pb-10">
              <div className="mb-6">
                <Badge variant="jci" className="bg-blue-50 text-jci-blue border-none px-3 py-1 text-[11px] font-bold mb-2">
                  {selectedEvent.type || 'Event Registration'}
                </Badge>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                  {selectedEvent.title}
                </h2>
              </div>

              {/* Event Info Grid - Replicating EventDetailModal Style */}
              <div className="bg-white border border-slate-100 rounded-[24px] shadow-sm overflow-hidden mb-8">
                <div className="divide-y divide-slate-50">
                  <div className="flex items-center gap-4 px-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-jci-blue flex-shrink-0">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</p>
                      <p className="text-sm font-bold text-slate-800">
                        {new Date(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} â€¢ {selectedEvent.time || 'TBA'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 px-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-jci-blue flex-shrink-0">
                      <MapPin size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</p>
                      <p className="text-sm font-bold text-slate-800 truncate">{selectedEvent.location || 'TBA (To Be Announced)'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 px-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-jci-blue flex-shrink-0">
                      <Tag size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Price</p>
                      <p className="text-sm font-bold text-slate-800">
                        {selectedEvent.price ? `RM ${selectedEvent.price}` : 'FREE'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Registration Form */}
              <form
                id="guest-registration-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const { EventsService } = await import('./services/eventsService');
                    await EventsService.registerGuestForEvent(selectedEvent.id, guestRegistrationData);
                    showToast('Registration submitted successfully! We will contact you soon.', 'success');
                    setIsRegistrationModalOpen(false);
                    setSelectedEvent(null);
                    setGuestRegistrationData({
                      name: '',
                      email: '',
                      phone: '',
                      organization: '',
                      notes: '',
                    });
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Failed to register for event';
                    showToast(errorMessage, 'error');
                  }
                }}
                className="space-y-6"
              >
                <div className="space-y-5">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 bg-jci-blue rounded-full"></div>
                    Your Particulars
                  </h3>

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
                </div>
              </form>
            </div>
          </div>
        </Modal>
      )}

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
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  const toggleFlip = (id: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    setFlippedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

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
        <section className="py-16 bg-gradient-to-r from-jci-navy to-jci-blue text-white" aria-label="Page header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Flagship Projects</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Discover the impactful projects we're working on to create positive change in our community.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jci-blue mx-auto mb-4"></div>
                <p className="text-slate-600">Loading projects...</p>
              </div>
            ) : activeProjects.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase size={48} className="mx-auto mb-4 text-slate-300" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">No active projects</h3>
                <p className="text-slate-600">Check back soon for new projects!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 mx-auto">
                {/* 3D Flip Card Styles */}
                <style>{`
                  .flip-card {
                    perspective: 1000px;
                    height: 480px;
                    width: 100%;
                  }
                  @media (min-width: 768px) {
                    .flip-card {
                      height: 320px;
                    }
                  }
                  .flip-card-inner {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                    transform-style: preserve-3d;
                  }
                  .flip-card.flipped .flip-card-inner {
                    transform: rotateY(180deg);
                  }
                  .flip-card-front, .flip-card-back {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                    border-radius: 1rem;
                    overflow: hidden;
                  }
                  .flip-card-front {
                    transform: rotateY(0deg);
                  }
                  .flip-card-back {
                    transform: rotateY(180deg);
                  }
                  .truncate-2-lines {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                  }
                  .scrollbar-none::-webkit-scrollbar {
                    display: none;
                  }
                  .scrollbar-none {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                  }
                `}</style>

                {activeProjects.map(project => {
                  const hasPhotos = project.galleryUrls && project.galleryUrls.length > 0;
                  const isFlipped = !!flippedCards[project.id];
                  return (
                    <div
                      key={project.id}
                      className={`flip-card ${isFlipped ? 'flipped' : ''}`}
                      onClick={(e) => toggleFlip(project.id, e)}
                    >
                      <div className="flip-card-inner">
                        {/* FRONT FACE (2-Column Layout) */}
                        <div className="flip-card-front bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row overflow-hidden cursor-pointer h-full">
                          {/* Left Column: Project Logo */}
                          <div className="w-full md:w-1/3 bg-slate-50 flex items-center justify-center relative p-6 border-b md:border-b-0 md:border-r border-slate-100 flex-shrink-0 h-44 md:h-full">
                            {project.logoUrl ? (
                              <img
                                src={project.logoUrl}
                                alt={`${project.title} Logo`}
                                className="max-w-full max-h-full object-contain rounded-lg"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                                <Briefcase size={32} />
                              </div>
                            )}
                          </div>

                          {/* Right Column: Banner, Title, Description, Progress & Buttons */}
                          <div className="w-full md:w-2/3 p-6 flex flex-col justify-between h-full min-w-0">
                            <div>
                              {/* Banner Wrapper */}
                              <div className="relative mb-3">
                                {/* Banner */}
                                <div className="h-10 w-full rounded bg-gradient-to-r from-jci-blue/10 to-indigo-500/10 flex items-center px-2 border-l-2 border-jci-blue">
                                  <span className="text-[24px] font-bold text-jci-blue uppercase tracking-wider">{project.title}</span>
                                </div>

                                {/* Selected UNSDG goals row */}
                                {project.unsdg && project.unsdg.length > 0 && (
                                  <div className="absolute right-0 -bottom-3 flex gap-1 z-10">
                                    {project.unsdg.map(goalId => (
                                      <img
                                        key={goalId}
                                        src={`/UNSDG/${goalId}.png`}
                                        alt={goalId}
                                        className="w-12 h-12 rounded object-cover shadow-sm border border-white hover:scale-110 transition-transform duration-200"
                                        title={goalId}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>

                              {project.description ? (
                                <p className="text-slate-600 text-xs line-clamp-6 leading-relaxed whitespace-pre-wrap mb-3">{project.description}</p>
                              ) : (
                                <div className="text-slate-400 text-xs italic mb-3">No description available.</div>
                              )}
                            </div>

                            <div className="flex justify-between items-center gap-2 mt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFlip(project.id, e);
                                }}
                                className="inline-flex items-center text-xs font-semibold text-jci-blue hover:text-sky-600 transition-colors"
                              >
                                <ImageIcon size={14} className="mr-1" /> View Gallery
                              </button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRegister();
                                }}
                                className="text-xs font-semibold px-3 py-1.5 bg-jci-blue hover:bg-jci-blue/90 text-white border-0 h-8"
                              >
                                Get Involved
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* BACK FACE: Photo Gallery */}
                        <div className="flip-card-back bg-white border border-slate-100 shadow-sm p-6 flex flex-col justify-between h-full overflow-hidden cursor-pointer">
                          <div className="flex justify-between items-center pb-3 border-b border-slate-100 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              <ImageIcon size={16} className="text-jci-blue" />
                              <h4 className="font-bold text-slate-800 text-sm">Photo Gallery</h4>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFlip(project.id, e);
                              }}
                              className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                              title="Back to details"
                            >
                              <RotateCcw size={16} />
                            </button>
                          </div>

                          <div className="flex-1 py-4 overflow-y-auto min-h-0">
                            {hasPhotos ? (() => {
                              const foldersData: Record<string, string[]> = project.galleryByYear || {
                                'General': project.galleryUrls || []
                              };
                              const sortedFolders = Object.keys(foldersData).sort((a, b) => a.localeCompare(b));
                              return (
                                <div className="relative pl-4 border-l-2 border-slate-100 space-y-6 ml-2 my-2">
                                  {sortedFolders.map((folder) => {
                                    const urls = foldersData[folder] || [];
                                    if (urls.length === 0) return null;
                                    return (
                                      <div key={folder} className="relative flex flex-col sm:flex-row gap-4 items-start border-b border-slate-50 pb-4 last:border-b-0 last:pb-0">
                                        {/* Timeline Dot */}
                                        <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-jci-blue border-2 border-white ring-4 ring-blue-50 shadow-sm" />

                                        {/* Folder Label Column */}
                                        <div className="flex sm:flex-col items-start gap-1 w-full sm:w-28 flex-shrink-0">
                                          <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded select-none flex items-center gap-1">
                                            {folder}
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-medium pl-1 sm:pl-0">{urls.length} photo(s)</span>
                                        </div>

                                        {/* 6x2 Grid Column */}
                                        <div className="grid grid-cols-6 gap-1.5 flex-1 w-full">
                                          {urls.slice(0, 12).map((url, imgIndex) => {
                                            const globalIndex = project.galleryUrls?.indexOf(url) ?? imgIndex;
                                            return (
                                              <div
                                                key={imgIndex}
                                                className="aspect-video rounded-lg overflow-hidden border border-slate-100 cursor-pointer relative group shadow-sm hover:shadow transition-shadow"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedProject(project);
                                                  setLightboxIndex(globalIndex);
                                                }}
                                              >
                                                <img src={url} alt={`Gallery ${folder}-${imgIndex}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                                                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                  <span className="text-[8px] text-white bg-black/50 px-1 py-0.5 rounded scale-75 sm:scale-100">Enlarge</span>
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
                            })() : (
                              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <ImageIcon size={32} className="mb-2 opacity-50" />
                                <p className="text-xs">No photos in gallery yet.</p>
                              </div>
                            )}
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex justify-between items-center flex-shrink-0">
                            <span className="text-xs text-slate-500 font-medium">
                              {project.galleryUrls?.length || 0} photos available
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFlip(project.id, e);
                              }}
                              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                            >
                              <RotateCcw size={12} /> Flip to details
                            </button>
                          </div>
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
    { year: '1953', title: 'JCI KL was Initiated', description: 'Initiated by JC Frank Wakerman in 1953 followed up by President JC Wong Peng Tuck.' },
    { year: '1954', title: 'JCI KL was Formed', description: 'JCI Kuala Lumpur ("JCI KL") is the first Malaysia Junior Chamber Chapter that was formed in 1954.' },
    { year: '1980s', title: 'JCI Asia Pacific Conference', description: 'JCI KL hosted JCI Asia Pacific Conference under our Past President, JCI Sen. Loh Yit Lock as Conference Director.' },
    { year: '1980s', title: '1st JCI MALAYSIA National Convention', description: 'Past President, Robert Ng as Conference Director.' },
    { year: '1984', title: '2nd JCI Asia Pacific Conference', description: 'During our 30th Anniversary, JCI KL was the Hosting Chapter for JCI Asia Pacific Conference held in Genting Highlands Resort under our Past President JCI Sen. Larry Koh as Conference Director.' },
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
        { position: 'Secretary', name: 'Jane Doe', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', company: 'JCI KL' },
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
        { position: 'Secretary', name: 'Jane Doe', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', company: 'JCI KL' },
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
            avatar: bm.avatarUrl,
            company: bm.companyName || 'JCI Kuala Lumpur',
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
    variant?: 'default' | 'president' | 'ipp';
  }) => {
    const name = member?.name || 'Vacant';
    const role = member?.position || defaultRole;
    const avatar = member?.avatar;
    const company = member?.company || 'JCI Kuala Lumpur';

    let cardClasses = "bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md hover:border-jci-blue transition-all flex flex-col items-center text-center w-full max-w-[210px] mx-auto shrink-0 relative group";
    let roleClasses = "text-[10px] font-extrabold uppercase tracking-wider text-jci-blue mb-0.5 max-w-full truncate";
    let nameClasses = "font-bold text-slate-800 text-sm mb-0.5 line-clamp-1";
    let avatarSize = "w-16 h-16";

    if (variant === 'president') {
      cardClasses = "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/80 rounded-2xl p-5 shadow-md hover:shadow-lg hover:border-jci-blue transition-all flex flex-col items-center text-center w-full max-w-[230px] mx-auto shrink-0 relative group ring-2 ring-jci-blue/10";
      roleClasses = "text-[11px] font-black uppercase tracking-widest text-jci-blue mb-1 max-w-full truncate";
      nameClasses = "font-black text-slate-900 text-base mb-0.5 line-clamp-1";
      avatarSize = "w-20 h-20 border-2 border-jci-blue/20";
    } else if (variant === 'ipp') {
      cardClasses = "bg-white border-2 border-dashed border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-jci-blue transition-all flex flex-col items-center text-center w-full max-w-[210px] mx-auto shrink-0 relative group";
      roleClasses = "text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5 max-w-full truncate";
    }

    return (
      <div className={cardClasses}>
        {variant === 'president' && (
          <div className="absolute top-0 right-0 bg-jci-blue text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-bl-lg">
            Leader
          </div>
        )}
        {variant === 'ipp' && (
          <div className="absolute top-0 right-0 bg-slate-100 text-slate-500 text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-bl-lg">
            Support
          </div>
        )}
        <div className="relative mb-3">
          {avatar ? (
            <img src={avatar} alt={name} className={`${avatarSize} rounded-full object-cover border-2 border-slate-100 shadow-sm group-hover:border-jci-blue transition-colors`} />
          ) : (
            <div className={`${avatarSize} rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-100 text-slate-400`}>
              <span className="text-xl font-bold text-slate-300">{name.charAt(0)}</span>
            </div>
          )}
        </div>
        <p className={roleClasses}>{role}</p>
        <h4 className={nameClasses}>{name}</h4>
        <p className="text-[11px] text-slate-400 line-clamp-1">{company}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <GuestHeader currentPage="about" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        <section className="py-16 bg-gradient-to-r from-jci-navy to-jci-blue text-white" aria-label="Page header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">About JCI Kuala Lumpur</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Empowering young active citizens to create positive change.
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
              <div className="bg-slate-100 rounded-2xl p-8 h-96 flex items-center justify-center">
                <Users size={120} className="text-slate-300" />
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
                      <span className="text-jci-blue mr-2">â€¢</span>
                      <span>That faith in God gives meaning and purpose to human life;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">â€¢</span>
                      <span>That the brotherhood of man transcends the sovereignty of nations;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">â€¢</span>
                      <span>That economic justice can best be won by free men through free enterprise;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">â€¢</span>
                      <span>That government should be of laws rather than of men;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">â€¢</span>
                      <span>That earth's great treasure lies in human personality;</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-jci-blue mr-2">â€¢</span>
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
              <div className="space-y-12">
                {/* Level 1: President & IPP */}
                <div className="relative flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16">
                  {/* President */}
                  <div className="w-full max-w-[240px]">
                    <BoardNode member={president} defaultRole="President" variant="president" />
                  </div>

                  {/* Connecting Line for Support */}
                  <div className="hidden md:flex flex-col items-center justify-center shrink-0">
                    <div className="w-16 h-0.5 border-t-2 border-dashed border-slate-300"></div>
                    <span className="mt-1 px-2.5 py-0.5 bg-sky-50 text-jci-blue font-extrabold uppercase tracking-widest text-[8px] rounded-full border border-sky-100">
                      Support
                    </span>
                  </div>

                  {/* Immediate Past President */}
                  <div className="w-full max-w-[220px]">
                    <BoardNode member={ipp} defaultRole="Immediate Past President" variant="ipp" />
                  </div>
                </div>

                {/* Line downwards from President to Level 2 */}
                <div className="hidden lg:block w-0.5 h-10 bg-gradient-to-b from-slate-300 to-slate-200 mx-auto -mt-6"></div>

                {/* Level 2: Secretary, Treasurer, GLC, EVP */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                  <div className="w-full">
                    <BoardNode member={secretary} defaultRole="Secretary" />
                  </div>
                  <div className="w-full">
                    <BoardNode member={treasurer} defaultRole="Honorary Treasurer" />
                  </div>
                  <div className="w-full">
                    <BoardNode member={glc} defaultRole="General Legal Counsel" />
                  </div>
                  <div className="w-full relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-jci-blue to-jci-lightblue rounded-2xl blur opacity-15 group-hover:opacity-30 transition duration-300"></div>
                    <div className="relative">
                      <BoardNode member={evp} defaultRole="Executive Vice President" />
                    </div>
                  </div>
                </div>

                {/* Line downwards from EVP to Level 3 VPs */}
                <div className="hidden lg:block w-0.5 h-10 bg-gradient-to-b from-slate-200 to-slate-100 mx-auto"></div>

                {/* Level 3: VPs under Executive Vice President */}
                <div className="bg-slate-50/50 rounded-3xl p-6 sm:p-8 border border-slate-200/50 max-w-6xl mx-auto">
                  <div className="text-center mb-8">
                    <span className="px-4 py-1 bg-sky-50 border border-sky-100 text-jci-blue font-extrabold text-[10px] uppercase tracking-wider rounded-full">
                      Vice Presidents
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 justify-center">
                    <div className="w-full"><BoardNode member={vpIndividual} defaultRole="Vice President (Individual)" /></div>
                    <div className="w-full"><BoardNode member={vpCommunity} defaultRole="Vice President (Community)" /></div>
                    <div className="w-full"><BoardNode member={vpBusiness} defaultRole="Vice President (Business)" /></div>
                    <div className="w-full"><BoardNode member={vpInternational} defaultRole="Vice President (International Affairs)" /></div>
                    <div className="w-full"><BoardNode member={vpLom} defaultRole="Vice President (LOM)" /></div>
                  </div>
                </div>
              </div>
            )}

            {/* Optional Group Photo Section */}
            <div className="max-w-4xl mx-auto mt-16 pt-12 border-t border-slate-100">
              <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm">
                <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 relative">
                  <div className="text-center p-8">
                    <Users size={48} className="mx-auto mb-3 text-slate-400/80" />
                    <p className="text-slate-600 font-bold text-base">{selectedYear} Board of Directors Group Photo</p>
                    <p className="text-slate-400 text-xs mt-1">Photo will be updated shortly</p>
                  </div>
                </div>
              </div>
            </div>
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
            <div className="grid md:grid-cols-2 gap-6">
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

  return (
    <div className="min-h-screen bg-slate-50">
      <GuestHeader currentPage="enewsletters" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        <section className="py-20 bg-gradient-to-r from-jci-navy to-jci-blue text-white relative overflow-hidden" aria-label="Page header">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
          <div className="absolute -left-16 -top-16 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-sky-400/10 rounded-full blur-3xl"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight drop-shadow-sm">
              E-Newsletters
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto font-light leading-relaxed">
              Stay connected and inspired. Access our extensive digital repository of stories, developmental projects, achievements, and impact.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {newsletters.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm max-w-xl mx-auto p-8 animate-in fade-in duration-300">
                <BookOpen size={48} className="text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800">No Publications Yet</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-sm mx-auto">
                  There are currently no active publications. Please check back later or contact local chapter administrators!
                </p>
              </div>
            ) : (
              <div className="space-y-16">
                {newsletters.map((yearGroup) => (
                  <div key={yearGroup.year} className="animate-in fade-in slide-in-from-bottom-6 duration-500">
                    <div className="flex items-center gap-4 mb-8 pb-3 border-b border-slate-200">
                      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        JCI KL {yearGroup.year} Publications
                      </h2>
                      <span className="bg-sky-100 text-jci-blue font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">
                        {yearGroup.items.length} {yearGroup.items.length === 1 ? 'Issue' : 'Issues'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                      {yearGroup.items.map((item, index) => (
                        <Card
                          key={index}
                          onClick={() => setSelectedNewsletter({ ...item, year: yearGroup.year })}
                          className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border border-slate-200 hover:border-jci-blue group overflow-hidden bg-white flex flex-col h-full"
                        >
                          {/* Thumbnail / Header Preview Image */}
                          <div
                            className="w-full bg-slate-100 overflow-hidden relative border-b border-slate-100 flex items-center justify-center"
                            style={{ aspectRatio: '210/297' }}
                          >
                            <NewsletterThumbnail src={item.thumbnail} alt={`${item.title} Cover`} />
                            {/* Floating Badge */}
                            <div className="absolute top-3 left-3 z-10">
                              <Badge variant="jci">{item.issue}</Badge>
                            </div>
                          </div>

                          <div className="p-5 flex flex-col flex-1 justify-between">
                            <div>
                              <h3 className="text-base font-bold text-slate-900 mb-2 group-hover:text-jci-blue transition-colors leading-snug line-clamp-2" title={item.title}>
                                {item.title}
                              </h3>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-4">
                              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                                {yearGroup.year} Edition
                              </span>
                              <span className="text-jci-blue font-bold text-xs inline-flex items-center gap-1 group-hover:underline">
                                Read Online
                                <FileText size={14} className="group-hover:translate-x-0.5 transition-transform" />
                              </span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* PDF Viewer Interactive Modal */}
      {selectedNewsletter && (
        <Modal
          isOpen={!!selectedNewsletter}
          onClose={() => {
            setSelectedNewsletter(null);
          }}
          title={
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
              <span className="bg-sky-100 text-jci-blue text-xs font-bold px-2.5 py-1 rounded-md uppercase self-start md:self-auto">
                {selectedNewsletter.year} â€¢ {selectedNewsletter.issue}
              </span>
              <h2 className="text-lg font-bold text-slate-800 line-clamp-1">{selectedNewsletter.title}</h2>
            </div>
          }
          size="4xl"
          scrollInBody={false}
          className="h-[92vh] max-h-[92vh] md:max-h-[92vh] flex flex-col"
        >
          {/* Main split dashboard pane */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 h-full">

            {/* Left Viewer pane */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 relative min-h-[400px] md:min-h-0">

              {/* Floating interactive toolbar */}
              <div className="bg-slate-950/90 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 z-10 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                    <button
                      onClick={() => setReaderTheme('light')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${readerTheme === 'light' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      Light
                    </button>
                    <button
                      onClick={() => setReaderTheme('dark')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${readerTheme === 'dark' ? 'bg-slate-950 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      Dark
                    </button>
                  </div>
                </div>

                {activeUrl && (
                  <div className="hidden sm:flex items-center gap-2 bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                    <button
                      onClick={() => setReaderZoom('fit')}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${readerZoom === 'fit' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      Standard
                    </button>
                    <button
                      onClick={() => setReaderZoom('wide')}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${readerZoom === 'wide' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      Wide
                    </button>
                    <button
                      onClick={() => setReaderZoom('full')}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${readerZoom === 'full' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      Full Width
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  {activeUrl && (
                    <>
                      <button
                        onClick={handlePrint}
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all button-press"
                        title="Print PDF"
                      >
                        <Printer size={16} />
                      </button>
                      <a
                        href={activeUrl}
                        download={`${selectedNewsletter.title.replace(/\s+/g, '_')}.pdf`}
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all button-press"
                        title="Download PDF"
                      >
                        <Download size={16} />
                      </a>
                      <a
                        href={activeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all button-press"
                        title="Open in new tab"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </>
                  )}
                  <button
                    onClick={handleCopyLink}
                    className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all button-press"
                    title="Share Newsletter"
                  >
                    <Share2 size={16} />
                  </button>
                </div>
              </div>

              {/* Reader viewport */}
              <div className={`flex-1 h-full flex flex-col justify-between p-4 ${readerTheme === 'dark' ? 'bg-slate-950' : 'bg-slate-100'
                } transition-colors duration-300 relative overflow-y-auto`}>

                {activeUrl ? (
                  <div className="flex-grow w-full flex justify-center items-center h-full min-h-[300px]">
                    <iframe
                      ref={iframeRef}
                      src={activeUrl}
                      title={selectedNewsletter.title}
                      className={`h-full rounded-lg border shadow-2xl transition-all duration-300 ${readerTheme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-300 bg-white'
                        } ${readerZoom === 'fit' ? 'w-full max-w-3xl' : readerZoom === 'wide' ? 'w-full max-w-5xl' : 'w-full'
                        }`}
                      style={{ height: '100%', minHeight: '520px' }}
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-4 text-slate-800 rounded-lg min-h-[480px]">

                    {/* Beautiful digital newsletter cover style */}
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 transform hover:scale-[1.01] transition-transform duration-300">

                      {/* Cover Header */}
                      <div className="bg-gradient-to-br from-jci-navy via-jci-blue to-sky-600 p-6 text-white text-center relative overflow-hidden">
                        <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                        <div className="absolute -left-10 -top-10 w-28 h-28 bg-white/5 rounded-full blur-xl"></div>

                        <div className="inline-block bg-white/15 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2 backdrop-blur-md">
                          Digital Issue simulation
                        </div>
                        <h2 className="text-xl font-extrabold tracking-tight leading-snug">{selectedNewsletter.title}</h2>
                        <div className="flex items-center justify-center gap-2 mt-3 text-xs text-sky-100 font-medium">
                          <span>{selectedNewsletter.issue}</span>
                          <span>â€¢</span>
                          <span>{selectedNewsletter.year}</span>
                        </div>
                      </div>

                      {/* Cover Body */}
                      <div className="p-5 space-y-5 bg-white">
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-bold text-jci-blue uppercase tracking-widest">Featured Highlights Inside</h4>
                          <div className="grid grid-cols-1 gap-2.5 mt-2">
                            <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-sky-50/40 hover:border-sky-100 transition-colors">
                              <span className="flex-shrink-0 w-5.5 h-5.5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-xs">1</span>
                              <div>
                                <h5 className="font-bold text-xs text-slate-900 leading-none">President's Term Message</h5>
                                <p className="text-[10px] text-slate-500 mt-1 leading-normal">Core directives and welcoming visions for term growth.</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-sky-50/40 hover:border-sky-100 transition-colors">
                              <span className="flex-shrink-0 w-5.5 h-5.5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-xs">2</span>
                              <div>
                                <h5 className="font-bold text-xs text-slate-900 leading-none">Sustainable Outreach</h5>
                                <p className="text-[10px] text-slate-500 mt-1 leading-normal">Community campaigns, project impact matrices, and SDG reviews.</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-sky-50/40 hover:border-sky-100 transition-colors">
                              <span className="flex-shrink-0 w-5.5 h-5.5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-xs">3</span>
                              <div>
                                <h5 className="font-bold text-xs text-slate-900 leading-none">Banquet & Awards Compilation</h5>
                                <p className="text-[10px] text-slate-500 mt-1 leading-normal">Review of banquet highlights and local organization awardees.</p>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                )}

                {/* PDF Page navigation toolbar simulation */}
                <div className="bg-slate-900/85 px-4 py-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-white text-xs max-w-sm mx-auto w-full mt-4 backdrop-blur shadow-xl relative z-10">
                  <button
                    onClick={handlePrevNewsletter}
                    disabled={currentIdx <= 0}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1 font-semibold"
                    title="Previous newsletter publication"
                  >
                    <ChevronLeft size={16} />
                    <span>Prev Issue</span>
                  </button>

                  <span className="font-bold text-slate-400 select-none">
                    Issue {currentIdx + 1} of {flatNewsletters.length}
                  </span>

                  <button
                    onClick={handleNextNewsletter}
                    disabled={currentIdx >= flatNewsletters.length - 1}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1 font-semibold"
                    title="Next newsletter publication"
                  >
                    <span>Next Issue</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Control & Metadata Panel (Desktop) */}
            <div className="w-full md:w-80 bg-white flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={14} className="text-jci-blue" />
                  Available Archives
                </h3>
                <span className="bg-sky-100 text-jci-blue font-bold px-2 py-0.5 rounded-full text-[10px] uppercase">
                  {flatNewsletters.length} Issues
                </span>
              </div>

              {/* Sidebar Content viewport */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2.5">
                  {flatNewsletters.map((item, idx) => {
                    const isCurrent = item.title === selectedNewsletter.title && item.issue === selectedNewsletter.issue;
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedNewsletter(item);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${isCurrent
                          ? 'bg-sky-50/80 border-jci-blue text-jci-blue shadow-sm'
                          : 'bg-slate-50/50 border-slate-200/60 hover:bg-slate-50 hover:border-slate-300 text-slate-700'
                          }`}
                      >
                        <FileText size={16} className={`flex-shrink-0 mt-0.5 ${isCurrent ? 'text-jci-blue' : 'text-slate-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-extrabold truncate leading-tight">{item.title}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] font-semibold text-slate-400">
                            <span>{item.year}</span>
                            <span>â€¢</span>
                            <span>{item.issue}</span>
                          </div>
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
        <section className="py-16 bg-gradient-to-r from-jci-navy to-jci-blue text-white" aria-label="Page header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Business Directory</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Explore the businesses of our members and connect with the global JCI network.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <BusinessDirectoryView />
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-slate-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Want to List Your Business?</h2>
            <p className="text-slate-600 mb-8">
              Join JCI Kuala Lumpur and showcase your business to our local and global network.
            </p>
            <Button size="lg" onClick={onRegister}>
              Join JCI KL Today
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
        <section className="py-16 bg-gradient-to-r from-jci-navy to-jci-blue text-white" aria-label="Page header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Merchant Partnerships</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Exclusive discounts and rewards curated for JCI Kuala Lumpur members.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jci-blue mx-auto mb-4" />
                <p className="text-slate-600">Loading partnerships...</p>
              </div>
            ) : partnerships.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm max-w-xl mx-auto p-8">
                <Gift size={48} className="text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800">No Active Partnerships</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-sm mx-auto">
                  There are currently no active merchant partnerships. Please check back later!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                {partnerships.map(partner => (
                  <div
                    key={partner.id}
                    className="flex flex-col h-full items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="w-full h-32 relative flex items-center justify-center p-4">
                      {partner.banner ? (
                        <img
                          src={partner.banner}
                          alt={partner.name}
                          className={`max-w-full max-h-full object-contain ${partner.redeemMethod?.startsWith('http') ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
                          onClick={() => {
                            if (partner.redeemMethod?.startsWith('http')) {
                              if (partner.id && !partner.id.startsWith('mock')) {
                                AdvertisementService.recordClick(partner.id).catch(console.error);
                              }
                              window.open(partner.redeemMethod, '_blank');
                            }
                          }}
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.onerror = null;
                            img.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-300">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                          <span className="text-xs mt-2 font-medium">No Logo</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-slate-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Are you a merchant?</h2>
            <p className="text-slate-600 mb-8">
              Partner with JCI Kuala Lumpur to offer exclusive discounts to our vast professional network of members.
            </p>
            <Button size="lg" onClick={onRegister}>
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
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedPartner(null);
          }}
          title={selectedPartner.name}
          size="md"
          drawerOnMobile
        >
          <div className="space-y-6">
            <div className="w-full h-48 overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
              {selectedPartner.banner ? (
                <img
                  src={selectedPartner.banner}
                  alt={selectedPartner.name}
                  className="max-w-full max-h-full object-contain drop-shadow-sm"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.onerror = null;
                    img.style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-300">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                  <span className="text-xs mt-2 font-medium">No Logo</span>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Member Benefit</h4>
              <p className="text-lg font-bold text-slate-800">{selectedPartner.memberBenefits}</p>
            </div>

            <div className="border-t border-b border-slate-100 py-4 flex justify-between text-sm text-slate-600">
              <div>
                <span className="font-semibold block">Valid From</span>
                <span>{selectedPartner.period.startDate}</span>
              </div>
              <div className="text-right">
                <span className="font-semibold block">Valid Until</span>
                <span>{selectedPartner.period.endDate}</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">How to Redeem</h4>
              {redeemStatus.allowed ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-sm font-medium">
                  <p className="mb-2">ðŸ”“ Eligibility Verified successfully.</p>
                  <p className="text-base font-bold bg-white px-3 py-2 rounded-lg border border-emerald-100 shadow-sm mt-2">{selectedPartner.redeemMethod}</p>
                </div>
              ) : (
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-6 text-slate-700 text-center space-y-4">
                  <p className="font-semibold text-slate-800">
                    {redeemStatus.reason === 'login' && 'ðŸ”’ Please login to view how to redeem.'}
                    {redeemStatus.reason === 'role' && 'ðŸ”’ This benefit is not available for your member tier.'}
                    {redeemStatus.reason === 'dues' && 'ðŸ”’ Please settle annual dues to unlock benefit details.'}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Merchant discount codes and instruction details are protected by JCI Kuala Lumpur Member Benefit Shielding policies.
                  </p>
                  {redeemStatus.reason === 'login' && (
                    <div className="flex gap-3 justify-center pt-2">
                      <Button size="sm" onClick={() => { setIsDetailModalOpen(false); onLogin(); }}>
                        Login
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setIsDetailModalOpen(false); onRegister(); }}>
                        Register
                      </Button>
                    </div>
                  )}
                  {redeemStatus.reason === 'dues' && (
                    <div className="pt-2">
                      <Button size="sm" onClick={() => { setIsDetailModalOpen(false); navigate('/roadmap'); }}>
                        Go to Dues Billing
                      </Button>
                    </div>
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
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [leadFormSubmitted, setLeadFormSubmitted] = useState(false);
  const [leadFormSubmitting, setLeadFormSubmitting] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadInterests, setLeadInterests] = useState('');

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

  const canViewLeads = isAdmin || isBoard;
  const [leadList, setLeadList] = useState<{ id: string; name: string; email: string; phone?: string | null; interests?: string[] | null; createdAt: string }[]>([]);
  const [leadListLoading, setLeadListLoading] = useState(false);

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

  React.useEffect(() => {
    if (!isHelpModalOpen || !canViewLeads || !member) return;
    const loId = (member as { loId?: string })?.loId ?? DEFAULT_LO_ID;
    setLeadListLoading(true);
    NonMemberLeadService.listByLo(loId)
      .then(setLeadList)
      .catch(() => setLeadList([]))
      .finally(() => setLeadListLoading(false));
  }, [isHelpModalOpen, canViewLeads, member]);

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
      case 'CANVA': return <CanvaView />;
      case 'WHAPI_CONFIG': return <WhapiConfigView />;
      case 'MEMBERSHIP_CONFIG': return <MembershipConfigView />;
      case 'ACCESS_CONFIG': return <AccessConfigView />;
      case 'PUBLICATIONS': if (member?.role === UserRole.GUEST || isPlainMember) return <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />; return <PublicationsView />;
      default:
        // Show dashboard home for all users
        // Use isBoard and isAdmin from component scope (already fetched at top level)
        if (isBoard || isAdmin) {
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
    <HelpModalProvider onOpenHelp={() => setIsHelpModalOpen(true)}>
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
                      <SidebarItem
                        icon={<ImageIcon size={18} />}
                        label="Canva"
                        isActive={view === 'CANVA'}
                        onClick={() => { handleViewChange('CANVA'); setIsSidebarOpen(false); }}
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
                  <SidebarItem
                    icon={<BookOpen size={18} />}
                    label="Help / New Process Guide"
                    isActive={false}
                    onClick={() => { setIsHelpModalOpen(true); setIsSidebarOpen(false); }}
                    isCollapsed={isSidebarCollapsed}
                  />
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

        <Modal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} title="Help / New Process Guide" size="lg">
          <div className="space-y-4 text-sm text-slate-700">
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Reference number format</h3>
              <p>Payment requests and transactions use a unified reference format: <code className="bg-slate-100 px-1 rounded">PR-{'{loId}'}-{'{YYYYMMDD}'}-{'{seq}'}</code> (e.g. PR-default-lo-20250216-001). Please use this reference in your bank transfer memo for reconciliation.</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Payment request flow</h3>
              <p>Go to Payment Requests â†’ Submit request (purpose, amount, activity) â†’ System generates reference number â†’ Finance reviews (Approve/Reject) â†’ Applicant can check status under My Applications.</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Member profile lookup</h3>
              <p>When submitting payment requests or creating events, you can select a member and the system will auto-fill name, term, contact details and other profile fields to avoid duplicate entry.</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Reconciliation</h3>
              <p>Under Finances â†’ Reconciliation, search by reference number to find transactions and payment requests. Match bank entries with business records, then mark as reconciled and keep an audit trail.</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Member data export and migration</h3>
              <p>Admins and organization secretaries can export member data (CSV/JSON) from the Members page; export scope is limited by the current LO. Data migration or cleanup should follow the scope and rules defined in the implementation plan; acceptance criteria are set out there.</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Non-member lead capture (Story 9.1)</h3>
              <p className="mb-2">Non-members can leave contact details and interests at check-in or via agreed flows for follow-up and outreach.</p>
              {canViewLeads && (
                <div className="mb-4">
                  <h4 className="text-slate-700 font-medium mb-2">Lead list (for follow-up and outreach)</h4>
                  {leadListLoading ? (
                    <p className="text-slate-500 text-sm">Loadingâ€¦</p>
                  ) : leadList.length === 0 ? (
                    <p className="text-slate-500 text-sm">No leads yet</p>
                  ) : (
                    <div className="overflow-x-auto max-h-48 overflow-y-auto border border-slate-200 rounded text-xs">
                      <table className="w-full">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="text-left p-2">Name</th>
                            <th className="text-left p-2">Email</th>
                            <th className="text-left p-2">Phone</th>
                            <th className="text-left p-2">Interests</th>
                            <th className="text-left p-2">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leadList.slice(0, 50).map((l) => (
                            <tr key={l.id} className="border-t border-slate-100">
                              <td className="p-2">{l.name}</td>
                              <td className="p-2">{l.email}</td>
                              <td className="p-2">{l.phone ?? 'â€”'}</td>
                              <td className="p-2">{(l.interests ?? []).join(', ') || 'â€”'}</td>
                              <td className="p-2">{l.createdAt?.slice(0, 10) ?? 'â€”'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {leadList.length > 50 && <p className="p-2 text-slate-500">Showing latest 50 only</p>}
                    </div>
                  )}
                </div>
              )}
              {leadFormSubmitted ? (
                <p className="text-green-700">Thank you. We will contact you soon.</p>
              ) : (
                <form
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!leadName.trim() || !leadEmail.trim()) {
                      showToast('Please enter name and email', 'error');
                      return;
                    }
                    setLeadFormSubmitting(true);
                    try {
                      await NonMemberLeadService.create({
                        name: leadName.trim(),
                        email: leadEmail.trim(),
                        phone: leadPhone.trim() || null,
                        interests: leadInterests.trim() ? leadInterests.trim().split(/[,ï¼Œ]/).map((s) => s.trim()).filter(Boolean) : null,
                        source: 'help_modal',
                        loId: (member as { loId?: string })?.loId ?? DEFAULT_LO_ID,
                      });
                      setLeadFormSubmitted(true);
                      showToast('Lead submitted', 'success');
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Submit failed', 'error');
                    } finally {
                      setLeadFormSubmitting(false);
                    }
                  }}
                >
                  <Forms.Input label="Name" value={leadName} onChange={(e) => setLeadName(e.target.value)} required />
                  <Forms.Input label="Email" type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} required />
                  <Forms.Input label="Phone" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} />
                  <div className="sm:col-span-2">
                    <Forms.Input label="Interests (comma-separated)" value={leadInterests} onChange={(e) => setLeadInterests(e.target.value)} placeholder="e.g. training, networking, leadership" />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" disabled={leadFormSubmitting}>{leadFormSubmitting ? 'Submittingâ€¦' : 'Submit lead'}</Button>
                  </div>
                </form>
              )}
            </section>
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Transition and handover (Story 9.1)</h3>
              <p className="mb-2">The organization can use documentation and handover checklists for term changes or role transitions; responsibilities are defined in the implementation plan and the system provides the entry points.</p>
              <ul className="list-disc list-inside text-slate-600 space-y-1">
                <li>Handover of communications and member data maintenance</li>
                <li>Handover of finance / payment request approval permissions</li>
                <li>Handover of reference number and reconciliation process documentation</li>
                <li>Member data export and migration acceptance documentation</li>
              </ul>
              <p className="mt-2 text-slate-500 text-xs">Follow the implementation plan for detailed checklists and acceptance criteria; document links in the system can be configured later if needed.</p>
            </section>
          </div>
        </Modal>

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
                  className={`absolute bottom-0 left-0 right-0 ${isBoard || isAdmin || isDeveloper ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border-t rounded-t-3xl px-6 pb-10 pt-4 shadow-2xl`}
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

                  {/* Board Metrics Grid */}
                  {(isBoard || isAdmin || isDeveloper) && (
                    <div className="mb-6">
                      <p className="text-xs font-bold uppercase tracking-widest mb-3 text-slate-400">Board Overview</p>
                      <div className="grid grid-cols-4 gap-2 bg-slate-800/40 p-2 rounded-xl border border-slate-800/60">
                        {/* Total Members */}
                        <div
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900/40 border border-slate-800/40 cursor-pointer active:scale-95 transition-all text-center"
                          onClick={() => {
                            handleViewChange('MEMBERS');
                            setShowMobileMenu(false);
                          }}
                        >
                          <Users size={16} className="text-blue-400 mb-1" />
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider scale-90">Members</span>
                          <span className="text-sm font-black text-white mt-0.5">{metrics.totalMembers}</span>
                        </div>

                        {/* Active Members */}
                        <div
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900/40 border border-slate-800/40 cursor-pointer active:scale-95 transition-all text-center"
                          onClick={() => {
                            handleViewChange('MEMBERS');
                            setShowMobileMenu(false);
                          }}
                        >
                          <CheckCircle size={16} className="text-green-400 mb-1" />
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider scale-90">Active</span>
                          <span className="text-sm font-black text-white mt-0.5">{metrics.activeMembers}</span>
                        </div>

                        {/* Upcoming Events */}
                        <div
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900/40 border border-slate-800/40 cursor-pointer active:scale-95 transition-all text-center"
                          onClick={() => {
                            handleViewChange('EVENTS');
                            setShowMobileMenu(false);
                          }}
                        >
                          <Calendar size={16} className="text-purple-400 mb-1" />
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider scale-90">Events</span>
                          <span className="text-sm font-black text-white mt-0.5">{metrics.upcomingEvents}</span>
                        </div>

                        {/* Active Projects */}
                        <div
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900/40 border border-slate-800/40 cursor-pointer active:scale-95 transition-all text-center"
                          onClick={() => {
                            handleViewChange('PROJECTS');
                            setShowMobileMenu(false);
                          }}
                        >
                          <Briefcase size={16} className="text-amber-400 mb-1" />
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider scale-90">Projects</span>
                          <span className="text-sm font-black text-white mt-0.5">{metrics.activeProjects}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${isBoard || isAdmin || isDeveloper ? 'text-slate-400' : 'text-slate-400'}`}>More</p>
                  <div className="grid grid-cols-4 gap-y-4 gap-x-1 my-2">
                    {(isBoard || isAdmin || isDeveloper) ? (
                      <>
                        {/* 1. Projects */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            handleViewChange('PROJECTS');
                            setShowMobileMenu(false);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm bg-blue-950/30 text-blue-400 border-blue-900/50">
                            <Briefcase size={22} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">
                            Projects
                          </span>
                        </div>

                        {/* 2. Survey */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            handleViewChange('SURVEYS');
                            setShowMobileMenu(false);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm bg-rose-950/30 text-rose-400 border-rose-900/50">
                            <CheckSquare size={22} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">
                            Surveys
                          </span>
                        </div>

                        {/* 3. Members */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            handleViewChange('MEMBERS');
                            setShowMobileMenu(false);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm bg-purple-950/30 text-purple-400 border-purple-900/50">
                            <Users size={22} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">
                            Members
                          </span>
                        </div>

                        {/* 4. Inventories */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            handleViewChange('INVENTORY');
                            setShowMobileMenu(false);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm bg-amber-950/30 text-amber-400 border-amber-900/50">
                            <Package size={22} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">
                            Inventories
                          </span>
                        </div>

                        {/* 5. Calendar */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            handleViewChange('EVENTS');
                            setShowMobileMenu(false);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm bg-green-950/30 text-green-400 border-green-900/50">
                            <Zap size={22} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">
                            Calendar
                          </span>
                        </div>

                        {/* 6. Communication */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            handleViewChange('COMMUNICATION');
                            setShowMobileMenu(false);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm bg-sky-950/30 text-sky-400 border-sky-900/50">
                            <Activity size={22} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">
                            Comm
                          </span>
                        </div>

                        {/* 7. Knowledge */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            handleViewChange('KNOWLEDGE');
                            setShowMobileMenu(false);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm bg-indigo-950/30 text-indigo-400 border-indigo-900/50">
                            <BookOpen size={22} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">
                            Knowledge
                          </span>
                        </div>

                        {/* 8. Hobby Clubs */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            handleViewChange('CLUBS');
                            setShowMobileMenu(false);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm bg-pink-950/30 text-pink-400 border-pink-900/50">
                            <Heart size={22} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">
                            Hobbies
                          </span>
                        </div>

                        {/* 9. Finance */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            handleViewChange('FINANCE');
                            setShowMobileMenu(false);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm bg-emerald-950/30 text-emerald-400 border-emerald-900/50">
                            <DollarSign size={22} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">
                            Finance
                          </span>
                        </div>

                        {/* 10. Claim */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            handleViewChange('PAYMENT_REQUESTS');
                            setShowMobileMenu(false);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm bg-amber-950/30 text-amber-400 border-amber-900/50">
                            <CreditCard size={22} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">
                            Claim
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* My Projects */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            setShowMobileMenu(false);
                            if (member?.role === UserRole.GUEST) {
                              setUpgradeModalOpen(true);
                            } else {
                              handleViewChange('PROJECTS');
                            }
                          }}
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm ${member?.role === UserRole.GUEST ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-green-50 text-green-600 border-green-100'}`}>
                            <Briefcase size={22} />
                          </div>
                          <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${member?.role === UserRole.GUEST ? 'text-slate-400' : 'text-slate-600'}`}>
                            My Projects
                          </span>
                        </div>

                        {/* Survey */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            handleViewChange('SURVEYS');
                            setShowMobileMenu(false);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm bg-rose-50 text-rose-600 border-rose-100">
                            <CheckSquare size={22} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-600">
                            Survey
                          </span>
                        </div>

                        {/* Hobby Clubs */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            handleViewChange('CLUBS');
                            setShowMobileMenu(false);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm bg-pink-50 text-pink-600 border-pink-100">
                            <Heart size={22} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-600">
                            Hobby Clubs
                          </span>
                        </div>

                        {/* Knowledge */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            handleViewChange('KNOWLEDGE');
                            setShowMobileMenu(false);
                          }}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm bg-indigo-50 text-indigo-600 border-indigo-100">
                            <BookOpen size={22} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-600">
                            Knowledge
                          </span>
                        </div>

                        {/* Claim */}
                        <div
                          className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transform transition-transform"
                          onClick={() => {
                            setShowMobileMenu(false);
                            if (member?.role === UserRole.GUEST) {
                              setUpgradeModalOpen(true);
                            } else {
                              handleViewChange('PAYMENT_REQUESTS');
                            }
                          }}
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm ${member?.role === UserRole.GUEST ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                            <CreditCard size={22} />
                          </div>
                          <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${member?.role === UserRole.GUEST ? 'text-slate-400' : 'text-slate-600'}`}>
                            Claim
                          </span>
                        </div>
                      </>
                    )}
                  </div>

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
    </HelpModalProvider>
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
