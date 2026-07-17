import React, { useState, useEffect, useMemo, useRef, lazy, Suspense, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Users, Calendar, LayoutDashboard, Briefcase, FolderKanban,
  LogOut, Award, Sparkles, TrendingUp,
  Menu, Bell, Search, AlertTriangle, Package, Building2, Workflow,
  MessageSquare, BookOpen, Heart, CheckSquare, Check, X, CheckCircle,
  Gift, Database, Megaphone, BarChart3, FileText, Code, Mail, Phone, Facebook, Instagram, Youtube, Clock, UserCircle,
  ChevronLeft, ChevronRight, ChevronDown, Target, Edit3, CreditCard, Image as ImageIcon, MapPin, Tag, Shield, RotateCcw, ArrowLeft,
  Download, Printer, Share2, Copy, ExternalLink, Eye, Upload, Info, Zap, Activity, DollarSign, Lock, Unlock, SlidersHorizontal, Handshake
} from 'lucide-react';
import { Button, Card, Badge, StatCard, Modal, Drawer, ToastProvider, useToast, ProgressBar } from './components/ui/Common';
import { PerfMonitor } from './components/ui/PerfMonitor';
import * as Forms from './components/ui/Form';
import { LoginModal } from './components/auth/LoginModal';
import { RegisterModal } from './components/auth/RegisterModal';
import { UserRole, Notification, Event, Project } from './types';
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
import { getCurrentBoardCalendarYear } from './utils/boardMembership';
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
const BoardDashboard = lazy(() => import('./components/dashboard/BoardDashboard').then(m => ({ default: m.BoardDashboard })));
const DashboardHome = lazy(() => import('./components/dashboard/DashboardHome').then(m => ({ default: m.DashboardHome })));
const DeveloperInterface = lazy(() => import('./components/modules/DeveloperInterface').then(m => ({ default: m.DeveloperInterface })));
const ToyyibView = lazy(() => import('./components/modules/ToyyibView').then(m => ({ default: m.ToyyibView })));
const SystemConfigView = lazy(() => import('./components/modules/SystemConfigView').then(m => ({ default: m.SystemConfigView })));
const PublicationsView = lazy(() => import('./components/modules/PublicationsView').then(m => ({ default: m.PublicationsView })));
const RadarDataImporter = lazy(() => import('./components/admin/RadarDataImporter').then(m => ({ default: m.RadarDataImporter })));
const SponsorshipView = lazy(() => import('./components/modules/SponsorshipView').then(m => ({ default: m.SponsorshipView })));
import { PublicationService, toGoogleDrivePreviewUrl, extractGoogleDriveFileId } from './services/publicationService';
import { BatchModeProvider, useBatchMode } from './contexts/BatchModeContext';
import { PartnershipsService } from './services/partnershipsService';
import { GuestAnalyticsService, pathToGuestPage, GuestPage } from './services/guestAnalyticsService';
import { Partnership, FlagshipProject } from './types';
import { AdvertisementService } from './services/advertisementService';

// --- View Definitions ---
// ViewType is now defined in types/views.ts and re-exported from types/index.ts
import { ViewType } from './types/views';

// --- Layout Components (extracted) ---
import { GuestHeader } from './components/layout/GuestHeader';
import { GuestFooter } from './components/layout/GuestFooter';
import { SidebarItem } from './components/layout/SidebarItem';
import { NotificationDrawer } from './components/layout/NotificationDrawer';
import { SearchDropdown } from './components/layout/SearchDropdown';
import { GuestAnalyticsTracker } from './components/layout/GuestAnalyticsTracker';

// REMOVED: inline GuestHeader definition (moved to components/layout/GuestHeader.tsx)
// REMOVED: inline GuestFooter definition (moved to components/layout/GuestFooter.tsx)
// REMOVED: inline SidebarItem definition (moved to components/layout/SidebarItem.tsx)
// REMOVED: inline NotificationDrawer definition (moved to components/layout/NotificationDrawer.tsx)
// REMOVED: inline SearchDropdown definition (moved to components/layout/SearchDropdown.tsx)
// REMOVED: inline GuestAnalyticsTracker definition (moved to components/layout/GuestAnalyticsTracker.tsx)

// --- Helper Components (GuestHeader, GuestFooter, SidebarItem, NotificationDrawer, SearchDropdown, GuestAnalyticsTracker imported from components/layout/) ---

// --- Guest Page Components (lazy-loaded — authenticated users pay no parse cost) ---
const GuestLandingPage = lazy(() => import('./components/pages/guest/GuestLandingPage').then(m => ({ default: m.GuestLandingPage ?? m.default })));
const GuestEventsPage = lazy(() => import('./components/pages/guest/GuestEventsPage').then(m => ({ default: m.GuestEventsPage ?? m.default })));
const FlagshipProjectsPage = lazy(() => import('./components/pages/guest/FlagshipProjectsPage').then(m => ({ default: m.FlagshipProjectsPage ?? m.default })));
const GuestAboutPage = lazy(() => import('./components/pages/guest/GuestAboutPage').then(m => ({ default: m.GuestAboutPage ?? m.default })));
const GuestEnewslettersPage = lazy(() => import('./components/pages/guest/GuestEnewslettersPage').then(m => ({ default: m.GuestEnewslettersPage ?? m.default })));
const GuestDirectoryPage = lazy(() => import('./components/pages/guest/GuestDirectoryPage').then(m => ({ default: m.GuestDirectoryPage ?? m.default })));
const GuestPartnershipPage = lazy(() => import('./components/pages/guest/GuestPartnershipPage').then(m => ({ default: m.GuestPartnershipPage ?? m.default })));
const NotFoundPage = lazy(() => import('./components/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

// REMOVED: inline GuestLandingPage definition (moved to components/pages/guest/GuestLandingPage.tsx)
// REMOVED: inline GuestEventsPage definition (moved to components/pages/guest/GuestEventsPage.tsx)
// REMOVED: inline FlagshipProjectsPage definition (moved to components/pages/guest/FlagshipProjectsPage.tsx)
// REMOVED: inline GuestAboutPage definition (moved to components/pages/guest/GuestAboutPage.tsx)
// REMOVED: inline NewsletterThumbnail + GuestEnewslettersPage definition (moved to components/pages/guest/GuestEnewslettersPage.tsx)
// REMOVED: inline GuestDirectoryPage definition (moved to components/pages/guest/GuestDirectoryPage.tsx)
// REMOVED: inline GuestPartnershipPage definition (moved to components/pages/guest/GuestPartnershipPage.tsx)

// --- Main App Shell ---



export const JCIKLApp: React.FC = () => {
  const [view, setView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem('jc_last_view');
    return (savedView as ViewType) || 'GUEST';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);
  const [isNotificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [isSearchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [headerSearchActive, setHeaderSearchActive] = useState(false);
  const headerSearchRef = useRef<HTMLInputElement>(null);

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
  const [drawerDragY, setDrawerDragY] = useState(0);
  const drawerDragStartY = useRef(0);
  const drawerScrollRef = useRef<HTMLDivElement>(null);

  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    drawerDragStartY.current = e.touches[0].clientY;
  };
  const handleDrawerTouchMove = (e: React.TouchEvent) => {
    const scrollTop = drawerScrollRef.current?.scrollTop ?? 0;
    const delta = e.touches[0].clientY - drawerDragStartY.current;
    if (delta > 0 && scrollTop === 0) setDrawerDragY(delta);
  };
  const handleDrawerTouchEnd = () => {
    if (drawerDragY > 100) setShowMobileMenu(false);
    setDrawerDragY(0);
  };
  const [isSimulateDropdownOpen, setIsSimulateDropdownOpen] = useState(false);
  const [showBoardDashboard, setShowBoardDashboard] = useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [memberPickerRole, setMemberPickerRole] = useState<UserRole | null>(null);
  const [memberPickerSearch, setMemberPickerSearch] = useState('');
  const [memberPickerList, setMemberPickerList] = useState<{ id: string; name: string; label: string; labelColor: string; avatar?: string }[]>([]);
  const [memberPickerLoading, setMemberPickerLoading] = useState(false);

  const { user, member, loading: authLoading, signOut, simulatedRole, simulatedMemberId, simulateRole, simulateAsMember, isDevMode, authError } = useAuth();
  const { showToast } = useToast();

  // Surface auth-state errors (Firestore/App Check failures during sign-in) as a toast
  useEffect(() => {
    if (authError) showToast(authError, 'error');
  }, [authError, showToast]);

  const openMemberPicker = async (role: UserRole | null) => {
    setMemberPickerRole(role);
    setMemberPickerSearch('');
    setMemberPickerOpen(true);
    setMemberPickerLoading(true);
    try {
      const [all, boardMembers] = await Promise.all([
        MembersService.getAllMembers(),
        BoardManagementService.getBoardMembersByYear(String(getCurrentBoardCalendarYear())).catch(() => []),
      ]);

      // Board position map: memberId → position title
      const boardPositionMap = new Map<string, string>();
      // Commission Director set: all member IDs listed as commission directors
      const commissionDirectorSet = new Set<string>();
      boardMembers.forEach(b => {
        boardPositionMap.set(b.memberId, b.position || 'Board');
        (b.commissionDirectorIds || []).forEach(id => commissionDirectorSet.add(id));
      });

      const enriched = all.map(m => {
        const isBoard = boardPositionMap.has(m.id);
        const isCommDir = !isBoard && commissionDirectorSet.has(m.id);
        const isProbation = !isBoard && !isCommDir && !!(m.probationTasks);
        // sortOrder: Board=0, CommDir=1, Member=2, Probation=3
        const sortOrder = isBoard ? 0 : isCommDir ? 1 : isProbation ? 3 : 2;
        return {
          id: m.id,
          name: m.fullName || m.name || m.id,
          label: isBoard
            ? 'Board'
            : isCommDir ? 'Comm. Director'
              : isProbation ? 'Probation'
                : 'Member',
          labelColor: isBoard ? 'purple' : isCommDir ? 'teal' : isProbation ? 'amber' : 'blue',
          avatar: m.avatarUrl || m.general?.avatarUrl || undefined,
          sortOrder,
          sortName: m.fullName || m.name || '',
        };
      });

      enriched.sort((a, b) => a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.sortName.localeCompare(b.sortName));

      setMemberPickerList(enriched.map(({ sortOrder: _s, sortName: _n, ...rest }) => rest));
    } catch {
      setMemberPickerList([]);
    } finally {
      setMemberPickerLoading(false);
    }
  };

  const {
    isBoard,
    isAdmin,
    isDeveloper,
    isMember,
    isPlainMember,
    isGuest,
    canAccessWorkspaceModules,
    canAccessEventsAndPayments,
    effectiveRole,
    hasPermission,
  } = usePermissions();
  const { projects } = useProjects();
  const canViewEventsManagement = React.useMemo(() => {
    if (!member) return false;
    if (isAdmin || isBoard || isDeveloper || isMember) return true;
    return projects.some(p => {
      const isCreator = p.organizerId === member.id || p.submittedBy === member.id;
      const isCommittee = p.committee?.some(c => c.memberId === member.id) ?? false;
      return isCreator || isCommittee;
    });
  }, [member, isAdmin, isBoard, isDeveloper, isMember, projects]);


  // useCommunication hook is safe to call even without authentication
  // It handles the case when member is null internally
  const { notifications, markNotificationAsRead } = useCommunication();
  const { members } = useMembers();
  const { events } = useEvents();

  const metrics = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const totalMembers = members.length;
    const activeMembers = members.filter(m => {
      const record = m.membership?.[currentYear];
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
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
        memberId: m.id,
        title: `ðŸŽ‚ Member Birthday Today!`,
        message: `It's ${m.name}'s birthday today! Let's send them some warm wishes.`,
        type: 'info' as const,
        read: false,
        timestamp: 'Today'
      }));
  }, [members]);

  // Combined notifications — skip client-side birthdays if Firestore already has any birthday notifications
  const allNotifications = React.useMemo(() => {
    const firestoreHasBirthday = notifications.some(n =>
      n.title?.toLowerCase().includes('birthday') || n.message?.toLowerCase().includes('birthday')
    );
    const clientBirthdays = firestoreHasBirthday ? [] : birthdayNotifications;
    return [...clientBirthdays, ...notifications];
  }, [birthdayNotifications, notifications]);

  const unreadNotifications = allNotifications.filter(n => !n.read && !n.id.startsWith('birthday-'));

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
      API_CONFIG: 'API Settings',
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

  const [isSignOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await handleSignOut();
      localStorage.removeItem('jc_last_view');
      navigate('/', { replace: true });
      setView('GUEST');
      showToast('Logged out successfully', 'success');
    } catch (error) {
      showToast('Failed to logout', 'error');
    }
  };

  const [viewHistory, setViewHistory] = useState<ViewType[]>([]);
  const backPressedOnceRef = useRef(false);
  const backPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleViewChange = (newView: ViewType, selectedId?: string) => {
    setSearchQuery('');
    setViewHistory(prev => [...prev, view]);
    setView(newView);
    if (newView === 'MEMBERS' && selectedId) setInitialSelectedMemberId(selectedId);
    if (newView === 'EVENTS' && selectedId) setInitialSelectedEventId(selectedId);
    if (newView === 'PROJECTS' && selectedId) setInitialSelectedProjectId(selectedId);
    if (newView === 'DIRECTORY' && selectedId) setInitialSelectedBusinessId(selectedId);
  };

  // Android hardware back button (Capacitor only — skip on web/Netlify)
  useEffect(() => {
    let listener: { remove: () => void } | null = null;
    let cancelled = false;
    import(/* @vite-ignore */ '@capacitor/app').then(({ App: CapApp }) => {
      if (cancelled) return;
      CapApp.addListener('backButton', () => {
        // Close any open drawer/modal first
        if (isMenuDrawerOpen) { setIsMenuDrawerOpen(false); return; }
        if (isNotificationDrawerOpen) { setNotificationDrawerOpen(false); return; }
        if (isSearchDrawerOpen) { setSearchDrawerOpen(false); return; }
        if (isLoginModalOpen) { setLoginModalOpen(false); return; }

        // Navigate back through view history
        if (viewHistory.length > 0) {
          const prev = viewHistory[viewHistory.length - 1];
          setViewHistory(h => h.slice(0, -1));
          setView(prev);
          return;
        }

        // On root view (DASHBOARD or GUEST) — double-press to exit
        if (backPressedOnceRef.current) {
          CapApp.exitApp();
        } else {
          backPressedOnceRef.current = true;
          showToast('Press back again to exit', 'info');
          backPressTimerRef.current = setTimeout(() => {
            backPressedOnceRef.current = false;
          }, 2000);
        }
      }).then(l => { listener = l; });
    }).catch(() => { /* not in Capacitor environment */ });

    return () => {
      cancelled = true;
      listener?.remove();
      if (backPressTimerRef.current) clearTimeout(backPressTimerRef.current);
    };
  }, [view, viewHistory, isMenuDrawerOpen, isNotificationDrawerOpen, isSearchDrawerOpen, isLoginModalOpen]);

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
  const handleGuestRegister = () => {
    const page = pathToGuestPage(window.location.pathname);
    if (page) GuestAnalyticsService.trackSignupClick(page);
    openRegistration();
  };

  const handleGuestPageChange = (page: 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships') => {
    window.scrollTo({ top: 0, behavior: 'instant' });
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
      onRegister: handleGuestRegister,
      onPageChange: handleGuestPageChange,
    };

    return (
      <>
        <GuestAnalyticsTracker />
        <Suspense fallback={<div />}>
          <Routes>
            <Route path="/" element={<GuestLandingPage {...guestPageProps} />} />
            <Route path="/events" element={<GuestEventsPage {...guestPageProps} />} />
            <Route path="/projects" element={<FlagshipProjectsPage {...guestPageProps} />} />
            <Route path="/about" element={<GuestAboutPage {...guestPageProps} />} />
            <Route path="/enewsletters" element={<GuestEnewslettersPage {...guestPageProps} />} />
            <Route path="/directory" element={<GuestDirectoryPage {...guestPageProps} />} />
            <Route path="/partnerships" element={<GuestPartnershipPage {...guestPageProps} />} />
            <Route path="/roadmap" element={<div />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
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
    // Per-module error boundary: isolates crashes so only the affected module
    // shows an error instead of the entire content area going blank.
    const wrapEB = (component: React.ReactNode, moduleName: string) => (
      <ErrorBoundary fallback={<div className="p-8 text-center text-red-600">{moduleName} 加载失败，请刷新或联系 IT</div>}>
        {component}
      </ErrorBoundary>
    );

    const dashboardFallback = <DashboardHome userRole={(member?.role as UserRole) || UserRole.MEMBER} onNavigate={handleViewChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} scrollRef={scrollRef} />;

    switch (view) {
      case 'MEMBERS':
        if (!canAccessWorkspaceModules) return dashboardFallback;
        return wrapEB(<MembersView searchQuery={searchQuery} initialSelectedMemberId={initialSelectedMemberId} onClearSelection={() => setInitialSelectedMemberId(null)} />, '会员');
      case 'PROJECTS':
        if (!canViewEventsManagement) return dashboardFallback;
        return wrapEB(<ProjectsView onNavigate={handleViewChange} searchQuery={searchQuery} initialSelectedProjectId={initialSelectedProjectId} onClearSelection={() => setInitialSelectedProjectId(null)} />, '活动管理');
      case 'FLAGSHIP_PROJECTS_MGT':
        if (!canViewEventsManagement || isPlainMember) return dashboardFallback;
        return wrapEB(<FlagshipProjectsManagementView searchQuery={searchQuery} />, '旗舰项目');
      case 'EVENTS':
        if (!canAccessWorkspaceModules) return dashboardFallback;
        return wrapEB(<EventsView searchQuery={searchQuery} initialSelectedEventId={initialSelectedEventId} onClearSelection={() => setInitialSelectedEventId(null)} />, '活动列表');
      case 'FINANCE':
        if (member?.role === UserRole.GUEST) return dashboardFallback;
        if (!hasPermission('canViewFinance')) return dashboardFallback;
        return wrapEB(<FinanceView searchQuery={searchQuery} />, '财务');
      case 'PAYMENT_REQUESTS':
        if (!hasPermission('canViewFinance') && !canAccessEventsAndPayments) return dashboardFallback;
        return wrapEB(<PaymentRequestsView searchQuery={searchQuery} />, '付款申请');
      case 'GAMIFICATION':
        if (member?.role === UserRole.GUEST) return dashboardFallback;
        return wrapEB(<GamificationView />, '积分系统');
      case 'INVENTORY':
        if (member?.role === UserRole.GUEST) return dashboardFallback;
        if (!hasPermission('canViewFinance')) return dashboardFallback;
        return wrapEB(<InventoryView searchQuery={searchQuery} />, '库存');
      case 'DIRECTORY':
        return wrapEB(<BusinessDirectoryView searchQuery={searchQuery} initialSelectedBusinessId={initialSelectedBusinessId} onClearSelection={() => setInitialSelectedBusinessId(null)} />, '商业目录');
      case 'AUTOMATION':
        if (!isAdmin && !isBoard) return dashboardFallback;
        return wrapEB(<AutomationStudio />, '自动化');
      case 'KNOWLEDGE':
        return wrapEB(<KnowledgeView searchQuery={searchQuery} />, '知识库');
      case 'COMMUNICATION':
        if (!canAccessWorkspaceModules) return dashboardFallback;
        return wrapEB(<CommunicationView searchQuery={searchQuery} />, '通讯');
      case 'CLUBS':
        if (member?.role === UserRole.INACTIVE) return dashboardFallback;
        return wrapEB(<HobbyClubsView searchQuery={searchQuery} />, '兴趣小组');
      case 'SURVEYS':
        if (member?.role === UserRole.INACTIVE) return dashboardFallback;
        return wrapEB(<SurveysView searchQuery={searchQuery} />, '问卷');
      case 'BENEFITS':
        if (member?.role === UserRole.GUEST || member?.role === UserRole.INACTIVE) return dashboardFallback;
        return wrapEB(<MemberBenefitsView searchQuery={searchQuery} />, '会员福利');
      case 'DATA_IMPORT_EXPORT':
        if (member?.role === UserRole.GUEST || isPlainMember) return dashboardFallback;
        return wrapEB(<DataImportExportView />, '数据导入导出');
      case 'RADAR_IMPORTER':
        if (member?.role === UserRole.GUEST || isPlainMember) return dashboardFallback;
        return wrapEB(<RadarDataImporter />, 'Radar 导入');
      case 'ADVERTISEMENTS':
        if (member?.role === UserRole.GUEST || isPlainMember) return dashboardFallback;
        return wrapEB(<AdvertisementsView searchQuery={searchQuery} />, '合作推广');
      case 'AI_INSIGHTS':
        if (!isDeveloper && !isAdmin && !isBoard) return dashboardFallback;
        return wrapEB(<AIInsightsView onNavigate={handleViewChange} searchQuery={searchQuery} />, 'AI 洞察');
      case 'TEMPLATES':
        if (member?.role === UserRole.GUEST || isPlainMember) return dashboardFallback;
        return wrapEB(<TemplatesView searchQuery={searchQuery} />, '模板');
      case 'ACTIVITY_PLANS':
        if (!canAccessWorkspaceModules && !isBoard && !isAdmin) return dashboardFallback;
        return wrapEB(<ActivityPlansView searchQuery={searchQuery} />, '活动计划');
      case 'REPORTS':
        if (member?.role === UserRole.GUEST || isPlainMember) return dashboardFallback;
        return wrapEB(<ReportsView />, '报告');
      case 'DEVELOPER':
        if (!isDeveloper && !isAdmin) return dashboardFallback;
        return wrapEB(<DeveloperInterface />, '开发者界面');
      case 'TOYYIB':
        if (!isAdmin && !isBoard && !isDeveloper) return dashboardFallback;
        return wrapEB(<ToyyibView />, 'ToyyibPay');
      case 'WHAPI_CONFIG':
        if (!isAdmin && !isBoard && !isDeveloper) return dashboardFallback;
        return wrapEB(<SystemConfigView initialTab="whapi" />, '系统配置');
      case 'API_CONFIG':
        if (!isAdmin && !isBoard && !isDeveloper) return dashboardFallback;
        return wrapEB(<SystemConfigView initialTab="toyyib" />, '系统配置');
      case 'MEMBERSHIP_CONFIG':
        if (!isAdmin && !isBoard) return dashboardFallback;
        return wrapEB(<SystemConfigView initialTab="membership" />, '会籍配置');
      case 'ACCESS_CONFIG':
        if (!isAdmin && !isBoard) return dashboardFallback;
        return wrapEB(<SystemConfigView initialTab="access" />, '访问配置');
      case 'SYSTEM_CONFIG':
        if (!isAdmin && !isBoard) return dashboardFallback;
        return wrapEB(<SystemConfigView />, '系统配置');
      case 'PUBLICATIONS':
        if (member?.role === UserRole.GUEST || isPlainMember) return dashboardFallback;
        return wrapEB(<PublicationsView />, '刊物');
      case 'SPONSORSHIPS':
        if (!isBoard && !isAdmin) return dashboardFallback;
        return wrapEB(<SponsorshipView searchQuery={searchQuery} />, '赞助');
      default:
        if ((isBoard || isAdmin) && showBoardDashboard) {
          return wrapEB(
            <BoardDashboard
              onNavigate={handleViewChange}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              scrollRef={scrollRef}
            />,
            '董事会仪表板'
          );
        }
        return wrapEB(
          <DashboardHome
            userRole={(member?.role as UserRole) || UserRole.MEMBER}
            onNavigate={handleViewChange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            scrollRef={scrollRef}
          />,
          '仪表板'
        );
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
                    <SidebarItem
                      icon={<FolderKanban size={18} />}
                      label="Events Management"
                      isActive={view === 'PROJECTS'}
                      onClick={() => { handleViewChange('PROJECTS'); setIsSidebarOpen(false); }}
                      isCollapsed={isSidebarCollapsed}
                    />
                  )}
                  <SidebarItem
                    icon={<CheckSquare size={18} />}
                    label="Surveys"
                    isActive={view === 'SURVEYS'}
                    onClick={() => { handleViewChange('SURVEYS'); setIsSidebarOpen(false); }}
                    isCollapsed={isSidebarCollapsed}
                  />
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
                    <SidebarItem
                      icon={<Handshake size={18} />}
                      label="Sponsorships"
                      isActive={view === 'SPONSORSHIPS'}
                      onClick={() => { handleViewChange('SPONSORSHIPS'); setIsSidebarOpen(false); }}
                      isCollapsed={isSidebarCollapsed}
                    />
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
              {(isBoard || isAdmin || isDeveloper) && (
                <div className="pt-4 mt-4 border-t border-slate-100">
                  <p className={`px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>Portal</p>
                  {canViewEventsManagement && !isPlainMember && (
                    <SidebarItem
                      icon={<Briefcase size={18} />}
                      label="Flagship Projects Mgt"
                      isActive={view === 'FLAGSHIP_PROJECTS_MGT'}
                      onClick={() => { handleViewChange('FLAGSHIP_PROJECTS_MGT'); setIsSidebarOpen(false); }}
                      isCollapsed={isSidebarCollapsed}
                    />
                  )}
                  {(isBoard || isAdmin) && (
                    <SidebarItem
                      icon={<Megaphone size={18} />}
                      label="Partnerships & Promotions"
                      isActive={view === 'ADVERTISEMENTS'}
                      onClick={() => { handleViewChange('ADVERTISEMENTS'); setIsSidebarOpen(false); }}
                      isCollapsed={isSidebarCollapsed}
                    />
                  )}
                  <SidebarItem
                    icon={<BookOpen size={18} />}
                    label="Publications"
                    isActive={view === 'PUBLICATIONS'}
                    onClick={() => { handleViewChange('PUBLICATIONS'); setIsSidebarOpen(false); }}
                    isCollapsed={isSidebarCollapsed}
                  />
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
                        icon={<SlidersHorizontal size={18} />}
                        label="Config"
                        isActive={view === 'SYSTEM_CONFIG' || view === 'MEMBERSHIP_CONFIG' || view === 'ACCESS_CONFIG' || view === 'API_CONFIG' || view === 'TOYYIB' || view === 'WHAPI_CONFIG'}
                        onClick={() => { handleViewChange('SYSTEM_CONFIG'); setIsSidebarOpen(false); }}
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
          {!isOnline && (
            <div role="status" aria-live="polite" className="shrink-0 bg-yellow-500 text-white text-xs text-center py-1 px-4 z-[100]">
              离线模式 — 显示缓存数据，操作将在恢复连接后同步
            </div>
          )}
          <h1 className="sr-only">
            {view === 'DASHBOARD' ? 'Dashboard' : view === 'MEMBERS' ? 'Members' : view === 'EVENTS' ? 'Event List' : view === 'PROJECTS' ? 'Events Management' : view === 'FINANCE' ? 'Finance' : view === 'PAYMENT_REQUESTS' ? 'Payment Requests' : view === 'GAMIFICATION' ? 'Gamification' : view === 'INVENTORY' ? 'Inventory' : view === 'DIRECTORY' ? 'Business Directory' : view === 'AUTOMATION' ? 'Automation Studio' : view === 'KNOWLEDGE' ? 'Knowledge' : view === 'COMMUNICATION' ? 'Communication' : view === 'CLUBS' ? 'Hobby Clubs' : view === 'SURVEYS' ? 'Surveys' : view === 'BENEFITS' ? 'Member Benefits' : view === 'DATA_IMPORT_EXPORT' ? 'Data Import/Export' : view === 'ADVERTISEMENTS' ? 'Partnership & Promotions' : view === 'AI_INSIGHTS' ? 'AI Insights' : view === 'TEMPLATES' ? 'Templates' : view === 'ACTIVITY_PLANS' ? 'Activity Plans' : view === 'REPORTS' ? 'Reports' : view === 'DEVELOPER' ? 'Developer Interface' : 'JCI LO Management'}
          </h1>
          {/* Topbar removed for premium gradient header replacement */}

          {/* Global Persistent Header */}
          {member && (
            <div className="z-[50] text-white relative shrink-0">
              {/* Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-jci-navy via-[#1a3a7a] to-jci-blue overflow-hidden z-0 shadow-md">
                <div className="absolute right-0 top-0 w-64 h-full opacity-10" style={{ background: 'radial-gradient(ellipse at 100% 50%, white, transparent 70%)' }}></div>
              </div>

              <div className="relative z-10 flex items-center justify-between h-14 px-4 sm:px-6 max-w-7xl mx-auto">
                {/* Left: Brand mark + chapter / page label */}
                <div className="flex items-center gap-3 min-w-0 h-9">
                  {(isBoard || isAdmin) ? (
                    <button
                      onClick={() => setShowBoardDashboard(v => !v)}
                      title="Toggle Board Dashboard"
                      className="h-9 flex items-center justify-center shrink-0 transition-all duration-200 hover:opacity-80"
                    >
                      <img src="/mascot/JCIKL-Mascot.png" alt="JCI KL" className="h-7 w-auto" />
                      <span className={`ml-1.5 h-7 flex items-center text-[20px] leading-7 font-black tracking-tight whitespace-nowrap ${showBoardDashboard ? 'text-amber-300' : 'text-white'}`}>JCI KL Connect</span>
                    </button>
                  ) : (
                    <div className="h-9 flex items-center justify-center shrink-0">
                      <img src="/mascot/JCIKL-Mascot.png" alt="JCI KL" className="h-7 w-auto" />
                      <span className="ml-1.5 h-7 flex items-center text-[20px] leading-7 font-black tracking-tight whitespace-nowrap text-white">JCI KL Connect</span>
                    </div>
                  )}
                  <div className="hidden sm:flex flex-col leading-none gap-0.5 min-w-0">
                    <span className="text-[10px] font-bold text-white/55 uppercase tracking-widest">Kuala Lumpur</span>
                    <span className="text-sm font-semibold text-white truncate">
                      {({ 'DASHBOARD': 'Dashboard', 'MEMBERS': 'Members', 'EVENTS': 'Event List', 'PROJECTS': 'Events Mgmt', 'FINANCE': 'Finance', 'PAYMENT_REQUESTS': 'Payments', 'GAMIFICATION': 'Gamification', 'INVENTORY': 'Inventory', 'DIRECTORY': 'Biz Directory', 'AUTOMATION': 'Automation', 'KNOWLEDGE': 'Knowledge', 'COMMUNICATION': 'Communication', 'CLUBS': 'Hobby Clubs', 'SURVEYS': 'Surveys', 'BENEFITS': 'Benefits', 'DATA_IMPORT_EXPORT': 'Data I/O', 'ADVERTISEMENTS': 'Partnerships', 'AI_INSIGHTS': 'AI Insights', 'TEMPLATES': 'Templates', 'REPORTS': 'Reports', 'DEVELOPER': 'Developer' } as Record<string, string>)[view] ?? 'Dashboard'}
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-0.5 h-9">
                  {/* Role simulator */}
                  {(isDevMode || member.role === UserRole.ADMIN || simulatedRole !== null) && (
                    <div className="relative z-30">
                      <button
                        onClick={() => setIsSimulateDropdownOpen(!isSimulateDropdownOpen)}
                        className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/25 rounded-lg px-2.5 h-9 transition-all text-white text-[11px] font-bold"
                        title="Simulate Role"
                      >
                        <Shield size={11} className="text-purple-300 shrink-0" />
                        <span className="hidden sm:inline">
                          {simulatedMemberId && member
                            ? `${(member.fullName || member.name || 'Member').split(' ')[0]} (${simulatedRole})`
                            : simulatedRole ? `${simulatedRole} Mode` : 'Dev/Admin'}
                        </span>
                        <ChevronDown size={10} className={`text-white/60 transition-transform duration-200 ${isSimulateDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isSimulateDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsSimulateDropdownOpen(false)} />
                          <div className="absolute right-0 mt-2 w-44 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                            {[
                              { value: '', label: 'Dev/Admin', desc: 'Full privileges', needsPicker: false },
                              { value: UserRole.ADMIN, label: 'Admin', desc: 'Administrator', needsPicker: false },
                              { value: 'MEMBER_PICK', label: 'Member', desc: 'Pick any member', needsPicker: true },
                              { value: UserRole.GUEST, label: 'Guest', desc: 'No account', needsPicker: false },
                            ].map((opt) => {
                              const isSelected = opt.value === 'MEMBER_PICK'
                                ? !!simulatedMemberId
                                : (simulatedRole ? simulatedRole === opt.value : opt.value === '');
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    setIsSimulateDropdownOpen(false);
                                    if (!opt.value) {
                                      simulateRole(null);
                                      showToast('Reset to Admin role', 'info');
                                    } else if (opt.needsPicker) {
                                      openMemberPicker(null);
                                    } else {
                                      simulateRole(opt.value as UserRole);
                                      showToast(`Simulating ${opt.value} role`, 'info');
                                    }
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-[11px] transition-all flex flex-col gap-0.5 ${isSelected ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{opt.label}</span>
                                    {isSelected && <Check size={10} className="text-white" />}
                                  </div>
                                  <span className={`text-[9px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{opt.desc}</span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Search */}
                  <div
                    className={`flex items-center ml-1 rounded-xl border ${headerSearchActive ? 'bg-white/15 border-white/25' : 'border-transparent'}`}
                    style={{
                      width: headerSearchActive ? 'min(280px, 52vw)' : '34px',
                      overflow: 'hidden',
                      transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
                    }}
                  >
                    {headerSearchActive && (
                      <input
                        ref={headerSearchRef}
                        type="text"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setSearchDrawerOpen(e.target.value.length > 0); }}
                        onFocus={() => setSearchDrawerOpen(searchQuery.length > 0)}
                        onKeyDown={e => { if (e.key === 'Escape') { setHeaderSearchActive(false); setSearchQuery(''); setSearchDrawerOpen(false); } }}
                        placeholder="Search…"
                        className="flex-1 bg-transparent text-white placeholder-white/35 text-sm outline-none pl-3 py-1.5 min-w-0"
                        style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                      />
                    )}
                    <button
                      onClick={() => {
                        if (headerSearchActive) {
                          setHeaderSearchActive(false);
                          setSearchQuery('');
                          setSearchDrawerOpen(false);
                        } else {
                          setHeaderSearchActive(true);
                          setSearchQuery('');
                          setSearchDrawerOpen(false);
                          setTimeout(() => headerSearchRef.current?.focus(), 50);
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-white/15 transition-colors shrink-0"
                      title="Search"
                    >
                      <span style={{ display: 'inline-flex', transition: 'transform 0.2s', transform: headerSearchActive ? 'rotate(90deg) scale(0.85)' : 'none' }}>
                        {headerSearchActive ? <X size={16} /> : <Search size={17} />}
                      </span>
                    </button>
                  </div>

                  {/* Notifications */}
                  <button
                    onClick={() => setNotificationDrawerOpen(true)}
                    className="relative p-2 rounded-lg hover:bg-white/15 transition-all"
                  >
                    <Bell size={18} />
                    {unreadNotifications.length > 0 && (
                      <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center px-0.5">
                        {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                      </span>
                    )}
                  </button>

                  {/* Logout (desktop only) */}
                  <button
                    onClick={() => setSignOutConfirmOpen(true)}
                    className="hidden md:flex p-2 rounded-lg hover:bg-white/15 transition-all"
                    title="Sign Out"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable Area */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar pt-4 pb-32 md:pb-4 px-5 sm:px-8">
            <AsyncErrorBoundary>
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
            </AsyncErrorBoundary>
          </div>
        </main>

        <NotificationDrawer
          isOpen={isNotificationDrawerOpen}
          onClose={() => setNotificationDrawerOpen(false)}
          notifications={allNotifications}
          onMarkAsRead={markNotificationAsRead}
        />

        {/* Search dropdown — backdrop tap to close */}
        {isSearchDrawerOpen && (
          <div className="fixed inset-0 z-[48]" onClick={() => { setHeaderSearchActive(false); setSearchQuery(''); setSearchDrawerOpen(false); }} />
        )}
        <SearchDropdown
          isOpen={isSearchDrawerOpen}
          onClose={() => { setHeaderSearchActive(false); setSearchQuery(''); setSearchDrawerOpen(false); }}
          searchQuery={searchQuery}
          onNavigate={handleViewChange}
        />

        <Modal
          isOpen={isSignOutConfirmOpen}
          onClose={() => setSignOutConfirmOpen(false)}
          title=""
          size="sm"
          noHeader
        >
          <div className="relative flex flex-col items-center text-center px-6 pt-8 pb-6 gap-5">
            <button
              onClick={() => setSignOutConfirmOpen(false)}
              className="absolute top-0 right-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <img src="/mascot/logout.png" alt="" className="w-auto h-auto max-h-32 object-contain" />
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-800 text-base">Sign out?</p>
              <p className="text-sm text-slate-400">You'll need to log in again to access your account.</p>
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setSignOutConfirmOpen(false)}>Cancel</Button>
              <Button variant="danger" className="flex-1" onClick={() => { setSignOutConfirmOpen(false); handleLogout(); }}>Sign Out</Button>
            </div>
          </div>
        </Modal>

      </div >

      {/* Floating Bottom Navigation Bar (Mobile) */}
      {
        (isMember || isGuest || isBoard || isAdmin || isDeveloper) && !isBatchMode && (
          <>
            <div className={`md:hidden fixed bottom-5 left-4 right-4 ${'bg-slate-900/95 border-slate-700/50'} backdrop-blur-xl rounded-3xl shadow-xl border flex items-center h-[66px] px-1 z-50`}>
              {/* Dashboard */}
              <button
                onClick={() => handleViewChange('DASHBOARD')}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 h-full"
              >
                <div className={`flex items-center justify-center transition-all duration-200 ${view === 'DASHBOARD' ? 'bg-jci-blue rounded-2xl px-3.5 py-1.5 shadow-sm shadow-jci-blue/40' : 'px-3.5 py-1.5'}`}>
                  <LayoutDashboard size={18} className={view === 'DASHBOARD' ? 'text-white' : ('text-slate-400')} />
                </div>
                <span className={`text-[10px] font-semibold transition-colors duration-200 ${view === 'DASHBOARD' ? 'text-jci-blue' : ('text-slate-500')}`}>Dashboard</span>
              </button>

              {/* Directory */}
              <button
                onClick={() => handleViewChange('DIRECTORY')}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 h-full"
              >
                <div className={`flex items-center justify-center transition-all duration-200 ${view === 'DIRECTORY' ? 'bg-jci-blue rounded-2xl px-3.5 py-1.5 shadow-sm shadow-jci-blue/40' : 'px-3.5 py-1.5'}`}>
                  <Building2 size={18} className={view === 'DIRECTORY' ? 'text-white' : ('text-slate-400')} />
                </div>
                <span className={`text-[10px] font-semibold transition-colors duration-200 ${view === 'DIRECTORY' ? 'text-jci-blue' : ('text-slate-500')}`}>Directory</span>
              </button>

              {/* Benefits */}
              <button
                onClick={() => handleViewChange('BENEFITS')}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 h-full"
              >
                <div className={`flex items-center justify-center transition-all duration-200 ${view === 'BENEFITS' ? 'bg-jci-blue rounded-2xl px-3.5 py-1.5 shadow-sm shadow-jci-blue/40' : 'px-3.5 py-1.5'}`}>
                  <Gift size={18} className={view === 'BENEFITS' ? 'text-white' : ('text-slate-400')} />
                </div>
                <span className={`text-[10px] font-semibold transition-colors duration-200 ${view === 'BENEFITS' ? 'text-jci-blue' : ('text-slate-500')}`}>Benefits</span>
              </button>

              {/* Menu / Avatar */}
              <button
                onClick={() => setShowMobileMenu(true)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 h-full"
              >
                <div className={`rounded-xl overflow-hidden transition-all duration-200 ${showMobileMenu ? 'ring-2 ring-jci-blue ring-offset-1 ring-offset-transparent' : ''}`}>
                  {member?.avatar ? (
                    <img src={member.avatar} alt={member?.name || 'Me'} className="w-8 h-8 rounded-xl object-cover" />
                  ) : (
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${showMobileMenu ? 'bg-jci-blue text-white' : ('bg-white/10 text-slate-300')}`}>
                      {(member?.name || 'M').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className={`text-[10px] font-semibold transition-colors duration-200 ${showMobileMenu ? 'text-jci-blue' : ('text-slate-500')}`}>Menu</span>
              </button>
            </div>

            {/* Mobile Menu Bottom Drawer */}
            {showMobileMenu && (
              <div className="md:hidden fixed inset-0 z-[60]" onClick={() => setShowMobileMenu(false)}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <div
                  ref={drawerScrollRef}
                  className={`absolute bottom-0 left-0 right-0 ${'bg-slate-900 border-slate-700'} border-t rounded-t-3xl px-6 pb-6 pt-4 shadow-2xl max-h-[94vh] overflow-y-auto`}
                  style={{ transform: `translateY(${drawerDragY}px)`, transition: drawerDragY === 0 ? 'transform 0.3s ease' : 'none' }}
                  onClick={e => e.stopPropagation()}
                  onTouchStart={handleDrawerTouchStart}
                  onTouchMove={handleDrawerTouchMove}
                  onTouchEnd={handleDrawerTouchEnd}
                >
                  <div className={`w-10 h-1 rounded-full mx-auto mb-4 ${'bg-slate-600'}`} />

                  {/* Profile Card */}
                  <div
                    className={`flex items-center gap-3 p-3 rounded-2xl mb-4 cursor-pointer active:scale-[0.98] transition-all ${'bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800'}`}
                    onClick={() => { handleViewChange('MEMBERS', member?.id); setShowMobileMenu(false); }}
                  >
                    <div className="relative shrink-0">
                      {member?.avatar ? (
                        <img src={member.avatar} alt={member?.name || ''} className="w-12 h-12 rounded-full object-cover border-2 border-white/20" />
                      ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black ${'bg-jci-blue text-white'}`}>
                          {(member?.name || 'M').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-black text-sm leading-tight truncate ${'text-white'}`}>{member?.name || 'Member'}</p>
                      <p className={`text-xs truncate mt-0.5 ${'text-slate-400'}`}>{member?.email || ''}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${'bg-jci-blue/20 text-jci-blue'}`}>{member?.tier || 'Member'}</span>
                        <span className={`text-[10px] font-bold ${'text-slate-500'}`}>{member?.points ?? 0} pts</span>
                      </div>
                    </div>
                    <div className={`text-xs font-bold shrink-0 ${'text-slate-500'}`}>
                      View Profile →
                    </div>
                  </div>

                  {/* Main grid */}
                  <div className="grid grid-cols-5 gap-y-4 gap-x-1">
                    {canAccessWorkspaceModules && (
                      <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('MEMBERS'); setShowMobileMenu(false); }}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${'bg-purple-950/30 text-purple-400 border-purple-900/50'}`}><Users size={22} /></div>
                        <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${'text-slate-300'}`}>Members</span>
                      </div>
                    )}
                    {/* Event List — visible to all roles including GUEST */}
                    <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('EVENTS'); setShowMobileMenu(false); }}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${'bg-green-950/30 text-green-400 border-green-900/50'}`}><Calendar size={22} /></div>
                      <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${'text-slate-300'}`}>Event List</span>
                    </div>
                    {canAccessWorkspaceModules && (
                      <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('COMMUNICATION'); setShowMobileMenu(false); }}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${'bg-sky-950/30 text-sky-400 border-sky-900/50'}`}><MessageSquare size={22} /></div>
                        <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${'text-slate-300'}`}>Comm</span>
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('KNOWLEDGE'); setShowMobileMenu(false); }}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${'bg-indigo-950/30 text-indigo-400 border-indigo-900/50'}`}><BookOpen size={22} /></div>
                      <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${'text-slate-300'}`}>Knowledge</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('CLUBS'); setShowMobileMenu(false); }}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${'bg-pink-950/30 text-pink-400 border-pink-900/50'}`}><Heart size={22} /></div>
                      <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${'text-slate-300'}`}>Hobbies</span>
                    </div>
                  </div>

                  {/* Workspace section */}
                  {member?.role !== UserRole.GUEST && (
                    <div className="pt-4">
                      <div className="flex items-center gap-2 mb-3 w-[90%]">
                        <span className={`text-[10px] font-bold uppercase tracking-widest shrink-0 ${'text-slate-500'}`}>Workspace</span>
                        <div className={`flex-1 h-px ${'bg-slate-700/60'}`} />
                      </div>
                      <div className="grid grid-cols-4 gap-y-4 gap-x-1">
                        {canViewEventsManagement && (
                          <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('PROJECTS'); setShowMobileMenu(false); }}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${'bg-blue-950/30 text-blue-400 border-blue-900/50'}`}><FolderKanban size={22} /></div>
                            <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${'text-slate-300'}`}>Evts Mgt</span>
                          </div>
                        )}
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('SURVEYS'); setShowMobileMenu(false); }}>
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${'bg-rose-950/30 text-rose-400 border-rose-900/50'}`}><CheckSquare size={22} /></div>
                          <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${'text-slate-300'}`}>Surveys</span>
                        </div>
                        {canAccessEventsAndPayments && (
                          <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('PAYMENT_REQUESTS'); setShowMobileMenu(false); }}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${'bg-amber-950/30 text-amber-400 border-amber-900/50'}`}><FileText size={22} /></div>
                            <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${'text-slate-300'}`}>Payment Req</span>
                          </div>
                        )}
                        {hasPermission('canViewFinance') && (
                          <>
                            <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('FINANCE'); setShowMobileMenu(false); }}>
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${'bg-emerald-950/30 text-emerald-400 border-emerald-900/50'}`}><TrendingUp size={22} /></div>
                              <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${'text-slate-300'}`}>Finances</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('INVENTORY'); setShowMobileMenu(false); }}>
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${'bg-amber-950/30 text-amber-400 border-amber-900/50'}`}><Package size={22} /></div>
                              <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${'text-slate-300'}`}>Inventory</span>
                            </div>
                          </>
                        )}
                        {canAccessWorkspaceModules && (
                          <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('GAMIFICATION'); setShowMobileMenu(false); }}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${'bg-yellow-950/30 text-yellow-400 border-yellow-900/50'}`}><Award size={22} /></div>
                            <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${'text-slate-300'}`}>Gamify</span>
                          </div>
                        )}
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('TEMPLATES'); setShowMobileMenu(false); }}>
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${'bg-indigo-950/30 text-indigo-400 border-indigo-900/50'}`}><FileText size={22} /></div>
                          <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${'text-slate-300'}`}>Templates</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('REPORTS'); setShowMobileMenu(false); }}>
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm ${'bg-indigo-950/30 text-indigo-400 border-indigo-900/50'}`}><BarChart3 size={22} /></div>
                          <span className={`text-[10px] sm:text-xs font-bold text-center mt-1 ${'text-slate-300'}`}>Reports</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Portal section */}
                  {(isBoard || isAdmin || isDeveloper) && (
                    <div className="pt-4">
                      <div className="flex items-center gap-2 mb-3 w-[90%]">
                        <span className="text-[10px] font-bold uppercase tracking-widest shrink-0 text-slate-500">Portal</span>
                        <div className="flex-1 h-px bg-slate-700/60" />
                      </div>
                      <div className="grid grid-cols-4 gap-y-4 gap-x-1">
                        {canViewEventsManagement && !isPlainMember && (
                          <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('FLAGSHIP_PROJECTS_MGT'); setShowMobileMenu(false); }}>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-sky-950/30 text-sky-400 border-sky-900/50"><Briefcase size={22} /></div>
                            <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Flagship</span>
                          </div>
                        )}
                        {(isBoard || isAdmin) && (
                          <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('ADVERTISEMENTS'); setShowMobileMenu(false); }}>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-sky-950/30 text-sky-400 border-sky-900/50"><Megaphone size={22} /></div>
                            <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Partners</span>
                          </div>
                        )}
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('PUBLICATIONS'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-sky-950/30 text-sky-400 border-sky-900/50"><BookOpen size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Publications</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* System section */}
                  {(isBoard || isAdmin || isDeveloper) && (
                    <div className="pt-4">
                      <div className="flex items-center gap-2 mb-3 w-[90%]">
                        <span className="text-[10px] font-bold uppercase tracking-widest shrink-0 text-slate-500">System</span>
                        <div className="flex-1 h-px bg-slate-700/60" />
                      </div>
                      <div className="grid grid-cols-5 gap-y-4 gap-x-1">
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('DATA_IMPORT_EXPORT'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><Database size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Data I/O</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('RADAR_IMPORTER'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><Zap size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Radar</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('SYSTEM_CONFIG'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><SlidersHorizontal size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Config</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transform transition-transform" onClick={() => { handleViewChange('AUTOMATION'); setShowMobileMenu(false); }}>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-sm bg-slate-800/60 text-slate-300 border-slate-700/50"><Activity size={22} /></div>
                          <span className="text-[10px] sm:text-xs font-bold text-center mt-1 text-slate-300">Automation</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Logout */}
                  <div className="mt-4 pt-4">
                    <button
                      onClick={() => { setShowMobileMenu(false); setSignOutConfirmOpen(true); }}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] ${'bg-red-950/30 text-red-400 border border-red-900/40 hover:bg-red-950/50'}`}
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

      {/* Member Picker Modal — for role simulation */}
      {memberPickerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMemberPickerOpen(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">View as Member</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Select a member to simulate their view</p>
                </div>
                <button onClick={() => setMemberPickerOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                  <X size={14} />
                </button>
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search by name..."
                  value={memberPickerSearch}
                  onChange={e => setMemberPickerSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
            {/* List */}
            <div className="flex-1 overflow-y-auto py-1">
              {memberPickerLoading ? (
                <div className="flex items-center justify-center py-10 text-xs text-slate-400">Loading members…</div>
              ) : (() => {
                const q = memberPickerSearch.toLowerCase();
                const filtered = memberPickerList.filter(m => !q || m.name.toLowerCase().includes(q));
                if (!filtered.length) return <div className="flex items-center justify-center py-10 text-xs text-slate-400">No members found</div>;
                return filtered.map(m => (
                  <button
                    key={m.id}
                    onClick={async () => {
                      setMemberPickerOpen(false);
                      const role = m.labelColor === 'purple' ? UserRole.BOARD : UserRole.MEMBER;
                      await simulateAsMember(m.id, role);
                      showToast(`Viewing as ${m.name} (${m.label})`, 'info');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[11px] font-bold text-blue-600 dark:text-blue-300 shrink-0 overflow-hidden">
                      {m.avatar ? <img src={m.avatar} alt="" className="w-full h-full object-cover" /> : m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{m.name}</p>
                    </div>
                    <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full max-w-[90px] truncate ${m.labelColor === 'purple' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300' :
                      m.labelColor === 'teal' ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300' :
                        m.labelColor === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' :
                          'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}>{m.label || 'Member'}</span>
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

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
          <PerfMonitor />
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
