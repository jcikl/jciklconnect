import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Users, Calendar, LayoutDashboard, Briefcase, FolderKanban,
  LogOut, Award, Sparkles, TrendingUp,
  Menu, Bell, Search, AlertTriangle, Package, Building2, Workflow,
  MessageSquare, BookOpen, Heart, CheckSquare, Check, X, CheckCircle,
  Gift, Database, Megaphone, BarChart3, FileText, Code, Mail, Phone, Facebook, Instagram, Youtube, Clock, UserCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button, Card, Badge, StatCard, Modal, Drawer, ToastProvider, useToast, ProgressBar } from './components/ui/Common';
import * as Forms from './components/ui/Form';
import { LoginModal } from './components/auth/LoginModal';
import { RegisterModal } from './components/auth/RegisterModal';
import { MemberGrowthChart, PointsDistributionChart } from './components/dashboard/Analytics';
import { UserRole, Notification, Event } from './types';
import { EventCalendarView } from './components/modules/EventCalendarView';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { usePermissions } from './hooks/usePermissions';
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
import { DEFAULT_LO_ID } from './config/constants';

// Module Imports
import { FinanceView } from './components/modules/FinanceView';
import { PaymentRequestsView } from './components/modules/PaymentRequestsView';
import { GamificationView } from './components/modules/GamificationView';
import { EventsView } from './components/modules/EventsView';
import { MembersView } from './components/modules/MembersView';
import { ProjectsView } from './components/modules/ProjectsView';
import { InventoryView } from './components/modules/InventoryView';
import { BusinessDirectoryView } from './components/modules/BusinessDirectoryView';
import { AutomationStudio } from './components/modules/AutomationStudio';
import { KnowledgeView } from './components/modules/KnowledgeView';
import { CommunicationView } from './components/modules/CommunicationView';
import { HobbyClubsView } from './components/modules/HobbyClubsView';
import { SurveysView } from './components/modules/SurveysView';
import { MemberBenefitsView } from './components/modules/MemberBenefitsView';
import { DataImportExportView } from './components/modules/DataImportExportView';
import { AdvertisementsView } from './components/modules/AdvertisementsView';
import { AIInsightsView } from './components/modules/AIInsightsView';
import { TemplatesView } from './components/modules/TemplatesView';
import { ActivityPlansView } from './components/modules/ActivityPlansView';
import { ReportsView } from './components/modules/ReportsView';
import { RoleSimulator } from './components/dev/RoleSimulator';
import { BoardDashboard } from './components/dashboard/BoardDashboard';
import { DashboardHome } from './components/dashboard/DashboardHome';
import { DeveloperInterface } from './components/modules/DeveloperInterface';
import { HelpModalProvider } from './contexts/HelpModalContext';

// --- View Definitions ---
type ViewType = 'GUEST' | 'GUEST_EVENTS' | 'GUEST_PROJECTS' | 'GUEST_ABOUT' | 'GUEST_ENEWSLETTERS' | 'DASHBOARD' | 'MEMBERS' | 'EVENTS' | 'PROJECTS' | 'ACTIVITIES' | 'FINANCE' | 'PAYMENT_REQUESTS' | 'GAMIFICATION' | 'INVENTORY' | 'DIRECTORY' | 'AUTOMATION' | 'KNOWLEDGE' | 'COMMUNICATION' | 'CLUBS' | 'SURVEYS' | 'BENEFITS' | 'DATA_IMPORT_EXPORT' | 'ADVERTISEMENTS' | 'AI_INSIGHTS' | 'TEMPLATES' | 'ACTIVITY_PLANS' | 'REPORTS' | 'DEVELOPER';

// --- Helper Components ---

// Guest Navigation Header Component (shared across guest pages)
const GuestHeader = ({
  currentPage,
  onPageChange,
  onLogin,
  onRegister
}: {
  currentPage: 'home' | 'events' | 'projects' | 'about' | 'enewsletters';
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters') => void;
  onLogin: () => void;
  onRegister: () => void;
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine current page from URL
  const getCurrentPageFromPath = (): 'home' | 'events' | 'projects' | 'about' | 'enewsletters' => {
    const path = location.pathname;
    if (path === '/about') return 'about';
    if (path === '/events') return 'events';
    if (path === '/projects') return 'projects';
    if (path === '/enewsletters') return 'enewsletters';
    return 'home';
  };

  const activePage = getCurrentPageFromPath();

  const handleNavigation = (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters') => {
    onPageChange(page);
    if (page === 'home') {
      navigate('/');
    } else {
      navigate(`/${page}`);
    }
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link
          to="/"
          onClick={() => handleNavigation('home')}
          className="flex items-center hover:opacity-80 transition-opacity"
        >
          <img
            src="/JCI Kuala Lumpur-transparent.png"
            alt="JCI Kuala Lumpur Logo"
            className="h-10 w-auto object-contain"
          />
        </Link>
        <nav className="hidden md:flex space-x-8">
          <Link
            to="/events"
            onClick={() => handleNavigation('events')}
            className={`no-underline font-medium transition-colors ${activePage === 'events' ? 'text-jci-blue' : 'text-slate-600 hover:text-jci-blue'}`}
          >
            Events
          </Link>
          <Link
            to="/projects"
            onClick={() => handleNavigation('projects')}
            className={`no-underline font-medium transition-colors ${activePage === 'projects' ? 'text-jci-blue' : 'text-slate-600 hover:text-jci-blue'}`}
          >
            Projects
          </Link>
          <Link
            to="/about"
            onClick={() => handleNavigation('about')}
            className={`no-underline font-medium transition-colors ${activePage === 'about' ? 'text-jci-blue' : 'text-slate-600 hover:text-jci-blue'}`}
          >
            About
          </Link>
          <Link
            to="/enewsletters"
            onClick={() => handleNavigation('enewsletters')}
            className={`no-underline font-medium transition-colors ${activePage === 'enewsletters' ? 'text-jci-blue' : 'text-slate-600 hover:text-jci-blue'}`}
          >
            E-Newsletters
          </Link>
        </nav>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={onLogin}>Log In</Button>
          <Button onClick={onRegister}>Join Us</Button>
        </div>
      </div>
    </header>
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
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters') => void;
}) => (
  <div className="min-h-screen bg-slate-50">
    <a href="#main-content" className="skip-link">Skip to main content</a>
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
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters') => void;
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
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <GuestHeader currentPage="events" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        <section className="py-16 bg-gradient-to-r from-jci-navy to-jci-blue text-white" aria-label="Page header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Upcoming Events</h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
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
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
              <EventCalendarView
                events={allPublishedEvents}
                readonly={true}
                onEventClick={(event) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const eventDate = new Date(event.date);
                  if (eventDate >= today) {
                    setSelectedEvent(event);
                    setIsRegistrationModalOpen(true);
                  } else {
                    showToast('Registration is not available for past events.', 'info');
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
          title={`Register for ${selectedEvent.title}`}
          size="lg"
        >
          <form
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
            className="space-y-4"
          >
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Event Details:</strong>
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Date: {new Date(selectedEvent.date).toLocaleString()}
              </p>
              <p className="text-sm text-blue-700">
                Location: {selectedEvent.location}
              </p>
            </div>
            <Forms.Input
              label="Full Name *"
              value={guestRegistrationData.name}
              onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, name: e.target.value })}
              required
            />
            <Forms.Input
              label="Email *"
              type="email"
              value={guestRegistrationData.email}
              onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, email: e.target.value })}
              required
            />
            <Forms.Input
              label="Phone Number *"
              type="tel"
              value={guestRegistrationData.phone}
              onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, phone: e.target.value })}
              required
            />
            <Forms.Input
              label="Organization"
              value={guestRegistrationData.organization}
              onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, organization: e.target.value })}
            />
            <Forms.Textarea
              label="Additional Notes"
              value={guestRegistrationData.notes}
              onChange={(e) => setGuestRegistrationData({ ...guestRegistrationData, notes: e.target.value })}
              rows={3}
              placeholder="Any special requirements or questions..."
            />
            <div className="pt-4 flex gap-3 border-t">
              <Button type="submit" className="flex-1">
                Submit Registration
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setIsRegistrationModalOpen(false);
                  setSelectedEvent(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}

      <GuestFooter />
    </div>
  );
};

// Guest Projects Page
const GuestProjectsPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters') => void;
}) => {
  const { projects, loading } = useProjects();
  const activeProjects = projects.filter(p => p.status === 'Active');

  return (
    <div className="min-h-screen bg-slate-50">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <GuestHeader currentPage="projects" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        <section className="py-16 bg-gradient-to-r from-jci-navy to-jci-blue text-white" aria-label="Page header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Our Projects</h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
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
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeProjects.map(project => (
                  <Card key={project.id} className="hover:shadow-lg transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <Badge variant={project.status === 'Active' ? 'success' : 'neutral'}>
                          {project.status}
                        </Badge>
                        <span className="text-sm text-slate-500">{project.completion}% complete</span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{project.name}</h3>
                      {project.description && (
                        <p className="text-slate-600 text-sm mb-4 line-clamp-3">{project.description}</p>
                      )}
                      <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                        <span>{project.teamSize} team members</span>
                        <span>{project.status}</span>
                      </div>
                      <ProgressBar progress={project.completion} />
                      <Button className="w-full" onClick={onRegister}>
                        Get Involved
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

      </main>
      <GuestFooter />
    </div>
  );
};

// Guest About Page
const GuestAboutPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters') => void;
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

  return (
    <div className="min-h-screen bg-slate-50">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <GuestHeader currentPage="about" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        <section className="py-16 bg-gradient-to-r from-jci-navy to-jci-blue text-white" aria-label="Page header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">About JCI Kuala Lumpur</h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
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
                <div className="p-8">
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
                  <div className="p-8">
                    <h3 className="text-2xl font-bold text-slate-900 mb-6">JCI Mission</h3>
                    <p className="text-lg text-slate-600 leading-relaxed">
                      To provide development opportunities that empower young people to create positive change.
                    </p>
                  </div>
                </Card>

                <Card className="bg-white">
                  <div className="p-8">
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
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">Board of Directors</h2>

            {/* Group Photo */}
            <div className="max-w-4xl mx-auto">
              <div className="bg-slate-100 rounded-2xl overflow-hidden shadow-lg">
                <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-jci-blue/10 to-jci-lightblue/10">
                  <div className="text-center p-8">
                    <Users size={80} className="mx-auto mb-4 text-jci-blue/50" />
                    <p className="text-slate-500 text-lg">2025 Board of Directors Group Photo</p>
                    <p className="text-slate-400 text-sm mt-2">Photo will be displayed here</p>
                  </div>
                  {/* Uncomment and replace with actual image when available:
                <img 
                  src="/images/board-of-directors-2025.jpg" 
                  alt="2025 JCI Kuala Lumpur Board of Directors" 
                  className="w-full h-full object-cover"
                />
                */}
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
                <div className="p-6">
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
                <div className="p-6">
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
                <div className="p-6">
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
                <div className="p-6">
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

// Guest E-Newsletters Page
const GuestEnewslettersPage = ({ onLogin, onRegister, onPageChange }: {
  onLogin: () => void;
  onRegister: () => void;
  onPageChange: (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters') => void;
}) => {
  const newsletters = [
    {
      year: '2025',
      items: [
        { issue: 'Issue 1', title: 'JCI KL 2025 E-Newsletter', link: '#' },
      ],
    },
    {
      year: '2024',
      items: [
        { issue: 'Issue 1', title: 'JCI KL 2024 E-Newsletter', link: '#' },
        { issue: 'Issue 2', title: 'JCI KL 2024 E-Newsletter', link: '#' },
        { issue: 'Issue 3', title: 'JCI KL 2024 E-Newsletter', link: '#' },
      ],
    },
    {
      year: '2023',
      items: [
        { issue: 'Issue 1', title: 'JCI KL 2023 E-Newsletter', link: '#' },
        { issue: 'Issue 2', title: 'JCI KL 2023 E-Newsletter', link: '#' },
        { issue: 'Issue 3', title: 'JCI KL 2023 E-Newsletter', link: '#' },
      ],
    },
    {
      year: '2022',
      items: [
        { issue: 'Issue 1', title: 'JCI KL 2022 E-Newsletter', link: '#' },
        { issue: 'Issue 2', title: 'JCI KL 2022 E-Newsletter', link: '#' },
        { issue: 'Issue 3', title: 'JCI KL 2022 E-Newsletter', link: '#' },
        { issue: 'Issue 4', title: 'JCI KL 2022 E-Newsletter', link: '#' },
        { issue: 'Awards Compilation Booklet', title: '2022 Awards Compilation Booklet', link: '#' },
      ],
    },
    {
      year: '2021',
      items: [
        { issue: 'E-Magazine', title: 'JCI KL 69th Installation & Awards Banquet E-Magazine', link: '#' },
        { issue: 'Issue 1', title: 'JCI KL 2021 E-Newsletter', link: '#' },
        { issue: 'Issue 2', title: 'JCI KL 2021 E-Newsletter', link: '#' },
        { issue: 'Issue 3', title: 'JCI KL 2021 E-Newsletter', link: '#' },
        { issue: 'Issue 4', title: 'JCI KL 2021 E-Newsletter', link: '#' },
      ],
    },
    {
      year: '2020',
      items: [
        { issue: 'Issue 1', title: 'JCI KL 2020 E-Newsletter', link: '#' },
        { issue: 'Issue 2', title: 'JCI KL 2020 E-Newsletter', link: '#' },
        { issue: 'Issue 3', title: 'JCI KL 2020 E-Newsletter', link: '#' },
        { issue: 'Issue 4', title: 'JCI KL 2020 E-Newsletter', link: '#' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <GuestHeader currentPage="enewsletters" onPageChange={onPageChange} onLogin={onLogin} onRegister={onRegister} />

      <main id="main-content">
        <section className="py-16 bg-gradient-to-r from-jci-navy to-jci-blue text-white" aria-label="Page header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">E-Newsletters</h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Stay updated with our latest news, events, and achievements.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-12">
              {newsletters.map((yearGroup) => (
                <div key={yearGroup.year}>
                  <h2 className="text-3xl font-bold text-slate-900 mb-6 pb-3 border-b-2 border-jci-blue">
                    JCI KL {yearGroup.year} E-Newsletter
                  </h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {yearGroup.items.map((item, index) => (
                      <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="info">{item.issue}</Badge>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-jci-blue hover:text-jci-navy font-medium text-sm inline-flex items-center gap-1"
                          >
                            View Newsletter
                            <FileText size={16} />
                          </a>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
      <GuestFooter />
    </div>
  );
};

// --- Authenticated Dashboard Views ---


const NotificationDrawer: React.FC<{ isOpen: boolean, onClose: () => void, notifications: Notification[] }> = ({ isOpen, onClose, notifications: initialNotifications }) => {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState(initialNotifications.filter(n => !n.read));

  const handleAction = (id: string, type: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
    showToast(type === 'dismiss' ? 'Notification dismissed' : 'Action taken successfully', type === 'dismiss' ? 'info' : 'success');
  }

  const handleClearAll = () => {
    setNotifications([]);
    showToast('All notifications cleared', 'info');
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Action Center">
      <div className="space-y-4">
        <div className="flex justify-between items-center text-xs text-slate-500 uppercase font-bold tracking-wider">
          <span>Pending Items</span>
          <button onClick={handleClearAll} className="text-jci-blue hover:underline">Clear All</button>
        </div>

        {notifications.map(note => (
          <div key={note.id} className="p-4 border border-slate-200 rounded-lg shadow-sm bg-white hover:border-jci-blue transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <div className={`p-2 rounded-full flex-shrink-0 ${note.type === 'ai' ? 'bg-purple-100 text-purple-600' : note.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                {note.type === 'ai' ? <Sparkles size={16} /> : note.type === 'warning' ? <AlertTriangle size={16} /> : <Bell size={16} />}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{note.title}</h4>
                <p className="text-xs text-slate-500">{note.timestamp}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">{note.message}</p>

            <div className="flex gap-2">
              <Button size="sm" className="flex-1 text-xs h-8" onClick={() => handleAction(note.id, 'act')}><Check size={14} className="mr-1" /> Approve/Act</Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => handleAction(note.id, 'dismiss')}><X size={14} className="mr-1" /> Dismiss</Button>
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <Bell size={32} className="mx-auto mb-2 opacity-20" />
            <p>No new notifications.</p>
          </div>
        )}
      </div>
    </Drawer>
  )
}

// --- Main App Shell ---

const JCIKLApp: React.FC = () => {
  const [view, setView] = useState<ViewType>('GUEST');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);
  const [isNotificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [leadFormSubmitted, setLeadFormSubmitted] = useState(false);
  const [leadFormSubmitting, setLeadFormSubmitting] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadInterests, setLeadInterests] = useState('');

  // All hooks must be called before any conditional returns
  const navigate = useNavigate();
  const location = useLocation();

  const { user, member, loading: authLoading, signOut, simulatedRole } = useAuth();
  const { showToast } = useToast();
  const { isBoard, isAdmin, isDeveloper, isMember, isOrganizationSecretary, effectiveRole, hasPermission } = usePermissions();
  const canViewLeads = isAdmin || isBoard || isOrganizationSecretary;
  const [leadList, setLeadList] = useState<{ id: string; name: string; email: string; phone?: string | null; interests?: string[] | null; createdAt: string }[]>([]);
  const [leadListLoading, setLeadListLoading] = useState(false);

  // useCommunication hook is safe to call even without authentication
  // It handles the case when member is null internally
  const { notifications } = useCommunication();

  const unreadNotifications = notifications.filter(n => !n.read);

  // Sync document.title for accessibility (WCAG 2.4.2)
  React.useEffect(() => {
    const titles: Partial<Record<ViewType, string>> = {
      GUEST: 'Home',
      GUEST_EVENTS: 'Events',
      GUEST_PROJECTS: 'Projects',
      GUEST_ABOUT: 'About',
      GUEST_ENEWSLETTERS: 'E-Newsletters',
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
      ADVERTISEMENTS: 'Advertisements',
      AI_INSIGHTS: 'AI Insights',
      TEMPLATES: 'Templates',
      ACTIVITY_PLANS: 'Activity Plans',
      REPORTS: 'Reports',
      DEVELOPER: 'Developer Interface',
    };
    const pageTitle = titles[view] ?? 'JCI LO Management';
    document.title = `${pageTitle} | JCI Kuala Lumpur`;
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
        // Redirect to /roadmap after login
        navigate('/roadmap');
        setView('DASHBOARD');
      } else {
        setView('GUEST');
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
        setView('GUEST_PROJECTS');
      } else if (path === '/enewsletters') {
        setView('GUEST_ENEWSLETTERS');
      } else if (path === '/') {
        setView('GUEST');
      }
    } else {
      // Authenticated pages - redirect if accessing guest pages
      const path = location.pathname;
      const guestPaths = ['/', '/about', '/events', '/projects', '/enewsletters'];

      if (guestPaths.includes(path)) {
        // Redirect authenticated users away from guest pages
        navigate('/roadmap', { replace: true });
        setView('DASHBOARD');
      } else if (path === '/roadmap') {
        setView('DASHBOARD');
      }
    }
  }, [location.pathname, user, member, navigate]);

  const handleLogin = () => {
    setLoginModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/', { replace: true });
      setView('GUEST');
      showToast('Logged out successfully', 'success');
    } catch (error) {
      showToast('Failed to logout', 'error');
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
  const handleGuestPageChange = (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters') => {
    if (page === 'home') {
      setView('GUEST');
      navigate('/');
    } else if (page === 'events') {
      setView('GUEST_EVENTS');
      navigate('/events');
    } else if (page === 'projects') {
      setView('GUEST_PROJECTS');
      navigate('/projects');
    } else if (page === 'about') {
      setView('GUEST_ABOUT');
      navigate('/about');
    } else if (page === 'enewsletters') {
      setView('GUEST_ENEWSLETTERS');
      navigate('/enewsletters');
    }
  };

  // Conditional Rendering Helper for Guest Pages
  if (view === 'GUEST' || view === 'GUEST_EVENTS' || view === 'GUEST_PROJECTS' || view === 'GUEST_ABOUT' || view === 'GUEST_ENEWSLETTERS') {
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
          <Route path="/projects" element={<GuestProjectsPage {...guestPageProps} />} />
          <Route path="/about" element={<GuestAboutPage {...guestPageProps} />} />
          <Route path="/enewsletters" element={<GuestEnewslettersPage {...guestPageProps} />} />
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
  const renderCurrentView = () => {
    switch (view) {
      case 'MEMBERS': return <MembersView />;
      case 'ACTIVITIES': return <ActivityPlansView />;
      case 'PROJECTS': return <ProjectsView onNavigate={(view) => setView(view as ViewType)} />;
      case 'EVENTS': return <EventsView />;
      case 'FINANCE': if (member?.role === UserRole.GUEST) return <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />; return hasPermission('canViewFinance') ? <FinanceView /> : <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />;
      case 'PAYMENT_REQUESTS': return <PaymentRequestsView />;
      case 'GAMIFICATION': if (member?.role === UserRole.GUEST) return <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />; return <GamificationView />;
      case 'INVENTORY': if (member?.role === UserRole.GUEST) return <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />; return hasPermission('canViewFinance') ? <InventoryView /> : <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />;
      case 'DIRECTORY': return <BusinessDirectoryView />;
      case 'AUTOMATION': if (member?.role === UserRole.GUEST) return <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />; return hasPermission('canViewFinance') ? <AutomationStudio /> : <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />;
      case 'KNOWLEDGE': return <KnowledgeView />;
      case 'COMMUNICATION': return <CommunicationView />;
      case 'CLUBS': return <HobbyClubsView />;
      case 'SURVEYS': if (member?.role === UserRole.GUEST) return <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />; return <SurveysView />;
      case 'BENEFITS': if (member?.role === UserRole.GUEST) return <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />; return <MemberBenefitsView />;
      case 'DATA_IMPORT_EXPORT': if (member?.role === UserRole.GUEST || isMember) return <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />; return <DataImportExportView />;
      case 'ADVERTISEMENTS': if (member?.role === UserRole.GUEST || isMember) return <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />; return <AdvertisementsView />;
      case 'AI_INSIGHTS': if (member?.role === UserRole.GUEST) return <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />; return <AIInsightsView onNavigate={(view) => setView(view as ViewType)} />;
      case 'TEMPLATES': if (member?.role === UserRole.GUEST || isMember) return <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />; return <TemplatesView />;
      case 'ACTIVITY_PLANS': return <ActivityPlansView />;
      case 'REPORTS': if (member?.role === UserRole.GUEST || isMember) return <DashboardHome userRole={member?.role || UserRole.MEMBER} onOpenNotifications={() => setNotificationDrawerOpen(true)} onNavigate={(view) => setView(view as ViewType)} />; return <ReportsView />;
      case 'DEVELOPER': return <DeveloperInterface />;
      default:
        // Show dashboard home for all users
        // Use isBoard and isAdmin from component scope (already fetched at top level)
        if (isBoard || isAdmin) {
          return <BoardDashboard onNavigate={(view) => setView(view as ViewType)} />;
        }
        return <DashboardHome
          userRole={member?.role || UserRole.MEMBER}
          onOpenNotifications={() => setNotificationDrawerOpen(true)}
          onNavigate={(view) => setView(view as ViewType)}
        />;
    }
  };

  return (
    <HelpModalProvider onOpenHelp={() => setIsHelpModalOpen(true)}>
      <div className="h-screen bg-slate-50 flex overflow-hidden">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            role="presentation"
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside className={`
        fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 transform transition-all duration-200 ease-in-out
        md:relative md:translate-x-0
        ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}
        ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'}
      `}>
          <div className="h-full flex flex-col min-h-0">
            {/* Logo & Toggle */}
            <div className={`h-16 flex items-center border-b border-slate-100 flex-shrink-0 transition-all duration-200 ${isSidebarCollapsed ? 'px-4 justify-center' : 'px-6 justify-between'}`}>
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
                onClick={() => { setView('DASHBOARD'); setIsSidebarOpen(false); }}
                isCollapsed={isSidebarCollapsed}
              />
              <SidebarItem
                icon={<Users size={18} />}
                label={member?.role === UserRole.MEMBER || member?.role === UserRole.GUEST ? 'Profile' : 'Members'}
                isActive={view === 'MEMBERS'}
                onClick={() => { setView('MEMBERS'); setIsSidebarOpen(false); }}
                isCollapsed={isSidebarCollapsed}
              />
              <SidebarItem
                icon={<Calendar size={18} />}
                label="Event List"
                isActive={view === 'EVENTS'}
                onClick={() => { setView('EVENTS'); setIsSidebarOpen(false); }}
                isCollapsed={isSidebarCollapsed}
              />
              <SidebarItem
                icon={<MessageSquare size={18} />}
                label="Communication"
                isActive={view === 'COMMUNICATION'}
                onClick={() => { setView('COMMUNICATION'); setIsSidebarOpen(false); }}
                isCollapsed={isSidebarCollapsed}
              />
              <SidebarItem
                icon={<Building2 size={18} />}
                label="Directory"
                isActive={view === 'DIRECTORY'}
                onClick={() => { setView('DIRECTORY'); setIsSidebarOpen(false); }}
                isCollapsed={isSidebarCollapsed}
              />
              <SidebarItem
                icon={<BookOpen size={18} />}
                label="Knowledge"
                isActive={view === 'KNOWLEDGE'}
                onClick={() => { setView('KNOWLEDGE'); setIsSidebarOpen(false); }}
                isCollapsed={isSidebarCollapsed}
              />
              {member?.role !== UserRole.GUEST && (
                <SidebarItem
                  icon={<Gift size={18} />}
                  label="Benefits"
                  isActive={view === 'BENEFITS'}
                  onClick={() => { setView('BENEFITS'); setIsSidebarOpen(false); }}
                  isCollapsed={isSidebarCollapsed}
                />
              )}
              <SidebarItem
                icon={<Heart size={18} />}
                label="Hobby Clubs"
                isActive={view === 'CLUBS'}
                onClick={() => { setView('CLUBS'); setIsSidebarOpen(false); }}
                isCollapsed={isSidebarCollapsed}
              />

              {member?.role !== UserRole.GUEST && (
                <div className="pt-4 mt-4 border-t border-slate-100">
                  <p className={`px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>Workspace</p>

                  <SidebarItem
                    icon={<FolderKanban size={18} />}
                    label="Events Management"
                    isActive={view === 'PROJECTS'}
                    onClick={() => { setView('PROJECTS'); setIsSidebarOpen(false); }}
                    isCollapsed={isSidebarCollapsed}
                  />
                  <SidebarItem
                    icon={<CheckSquare size={18} />}
                    label="Surveys"
                    isActive={view === 'SURVEYS'}
                    onClick={() => { setView('SURVEYS'); setIsSidebarOpen(false); }}
                    isCollapsed={isSidebarCollapsed}
                  />
                  <SidebarItem
                    icon={<FileText size={18} />}
                    label="Payment Requests"
                    isActive={view === 'PAYMENT_REQUESTS'}
                    onClick={() => { setView('PAYMENT_REQUESTS'); setIsSidebarOpen(false); }}
                    isCollapsed={isSidebarCollapsed}
                  />
                  {hasPermission('canViewFinance') && (
                    <>
                      <SidebarItem
                        icon={<TrendingUp size={18} />}
                        label="Finances"
                        isActive={view === 'FINANCE'}
                        onClick={() => { setView('FINANCE'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <SidebarItem
                        icon={<Package size={18} />}
                        label="Inventory"
                        isActive={view === 'INVENTORY'}
                        onClick={() => { setView('INVENTORY'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                    </>
                  )}
                  <SidebarItem
                    icon={<Award size={18} />}
                    label="Gamification"
                    isActive={view === 'GAMIFICATION'}
                    onClick={() => { setView('GAMIFICATION'); setIsSidebarOpen(false); }}
                    isCollapsed={isSidebarCollapsed}
                  />
                </div>
              )}
              {member?.role !== UserRole.GUEST && !isMember && (
                <div className="pt-4 mt-4 border-t border-slate-100 px-2">
                  <p className={`px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>System</p>
                  {(isBoard || isAdmin || isDeveloper) && (
                    <>
                      <SidebarItem
                        icon={<Megaphone size={18} />}
                        label="Advertisements"
                        isActive={view === 'ADVERTISEMENTS'}
                        onClick={() => { setView('ADVERTISEMENTS'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <SidebarItem
                        icon={<FileText size={18} />}
                        label="Templates"
                        isActive={view === 'TEMPLATES'}
                        onClick={() => { setView('TEMPLATES'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <SidebarItem
                        icon={<BarChart3 size={18} />}
                        label="Reports & BI"
                        isActive={view === 'REPORTS'}
                        onClick={() => { setView('REPORTS'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <SidebarItem
                        icon={<Database size={18} />}
                        label="Data Import/Export"
                        isActive={view === 'DATA_IMPORT_EXPORT'}
                        onClick={() => { setView('DATA_IMPORT_EXPORT'); setIsSidebarOpen(false); }}
                        isCollapsed={isSidebarCollapsed}
                      />
                    </>
                  )}
                  {hasPermission('canViewFinance') && (
                    <SidebarItem
                      icon={<Workflow size={18} />}
                      label="Automation"
                      isActive={view === 'AUTOMATION'}
                      onClick={() => { setView('AUTOMATION'); setIsSidebarOpen(false); }}
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
                    onClick={() => { setView('DEVELOPER'); setIsSidebarOpen(false); }}
                    isCollapsed={isSidebarCollapsed}
                  />
                </div>
              )}
            </nav>

            {/* Footer Actions & Dev Tools */}
            <div className="p-4 border-t border-slate-100 space-y-2 flex-shrink-0">

              <button
                onClick={handleLogout}
                className={`flex items-center text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 text-sm font-medium ${isSidebarCollapsed ? 'w-full justify-center px-0 py-3' : 'w-full space-x-3 px-4 py-2'}`}
                title={isSidebarCollapsed ? "Sign Out" : undefined}
              >
                <LogOut size={18} />
                {!isSidebarCollapsed && <span>Sign Out</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main id="main-content" className="flex-1 flex flex-col min-w-0 h-full overflow-hidden" tabIndex={-1} role="main">
          <h1 className="sr-only">
            {view === 'DASHBOARD' ? 'Dashboard' : view === 'MEMBERS' ? 'Members' : view === 'EVENTS' ? 'Event List' : view === 'PROJECTS' ? 'Events Management' : view === 'ACTIVITIES' ? 'Activity Plans' : view === 'FINANCE' ? 'Finance' : view === 'PAYMENT_REQUESTS' ? 'Payment Requests' : view === 'GAMIFICATION' ? 'Gamification' : view === 'INVENTORY' ? 'Inventory' : view === 'DIRECTORY' ? 'Business Directory' : view === 'AUTOMATION' ? 'Automation Studio' : view === 'KNOWLEDGE' ? 'Knowledge' : view === 'COMMUNICATION' ? 'Communication' : view === 'CLUBS' ? 'Hobby Clubs' : view === 'SURVEYS' ? 'Surveys' : view === 'BENEFITS' ? 'Member Benefits' : view === 'DATA_IMPORT_EXPORT' ? 'Data Import/Export' : view === 'ADVERTISEMENTS' ? 'Advertisements' : view === 'AI_INSIGHTS' ? 'AI Insights' : view === 'TEMPLATES' ? 'Templates' : view === 'ACTIVITY_PLANS' ? 'Activity Plans' : view === 'REPORTS' ? 'Reports' : view === 'DEVELOPER' ? 'Developer Interface' : 'JCI LO Management'}
          </h1>
          {/* Topbar */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-30 shadow-sm flex-shrink-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu size={24} aria-hidden />
            </button>

            {/* Search */}
            <div className="hidden md:flex items-center relative max-w-md w-full ml-4">
              <Search className="absolute left-3 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search members, projects, or docs..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-jci-blue focus:border-transparent outline-none transition-all text-sm"
                aria-label="Search members, projects, or docs"
              />
            </div>

            {/* Right Actions */}
            <div className="flex items-center space-x-3 sm:space-x-4">
              <button
                onClick={() => setNotificationDrawerOpen(true)}
                className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label={unreadNotifications.length > 0 ? `Notifications, ${unreadNotifications.length} unread` : 'Notifications'}
              >
                <Bell size={20} />
                {unreadNotifications.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              <div
                className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-sky-50 text-jci-blue rounded-full text-sm font-medium cursor-pointer hover:bg-sky-100 transition-colors"
                onClick={() => setView('GAMIFICATION')}
              >
                <Award size={16} />
                <span>{member?.points || 0} Pts</span>
              </div>

              {/* User Snippet */}
              {member && (
                <div className="flex items-center space-x-2 pl-3 border-l border-slate-200">
                  <img
                    src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=0097D7&color=fff`}
                    alt="User"
                    className="w-8 h-8 rounded-full border-2 border-slate-200 shadow-sm"
                  />
                  <div className="hidden lg:block min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{member.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {simulatedRole ? `Simulating: ${simulatedRole}` : member.role}
                      {isDeveloper && !simulatedRole && ' (Developer)'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <RoleSimulator />
              {renderCurrentView()}
            </div>
          </div>
        </main>

        <NotificationDrawer
          isOpen={isNotificationDrawerOpen}
          onClose={() => setNotificationDrawerOpen(false)}
          notifications={notifications}
        />

        <Modal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} title="Help / New Process Guide" size="lg">
          <div className="space-y-4 text-sm text-slate-700">
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Reference number format</h3>
              <p>Payment requests and transactions use a unified reference format: <code className="bg-slate-100 px-1 rounded">PR-{'{loId}'}-{'{YYYYMMDD}'}-{'{seq}'}</code> (e.g. PR-default-lo-20250216-001). Please use this reference in your bank transfer memo for reconciliation.</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Payment request flow</h3>
              <p>Go to Payment Requests → Submit request (purpose, amount, activity) → System generates reference number → Finance reviews (Approve/Reject) → Applicant can check status under My Applications.</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Member profile lookup</h3>
              <p>When submitting payment requests or creating events, you can select a member and the system will auto-fill name, term, contact details and other profile fields to avoid duplicate entry.</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Reconciliation</h3>
              <p>Under Finances → Reconciliation, search by reference number to find transactions and payment requests. Match bank entries with business records, then mark as reconciled and keep an audit trail.</p>
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
                    <p className="text-slate-500 text-sm">Loading…</p>
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
                              <td className="p-2">{l.phone ?? '—'}</td>
                              <td className="p-2">{(l.interests ?? []).join(', ') || '—'}</td>
                              <td className="p-2">{l.createdAt?.slice(0, 10) ?? '—'}</td>
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
                        interests: leadInterests.trim() ? leadInterests.trim().split(/[,，]/).map((s) => s.trim()).filter(Boolean) : null,
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
                    <Button type="submit" disabled={leadFormSubmitting}>{leadFormSubmitting ? 'Submitting…' : 'Submit lead'}</Button>
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
      </div>
    </HelpModalProvider>
  );
}

const App: React.FC = () => {
  return (
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
          <ToastProvider>
            <AuthProvider>
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
            </AuthProvider>
          </ToastProvider>
        </AsyncErrorBoundary>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
