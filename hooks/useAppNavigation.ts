import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ViewType } from '../types/views';
import { getViewTitle } from '../components/app/viewTitles';

export type GuestPageKey = 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'partnerships';

interface UseAppNavigationOptions {
  isAuthenticated: boolean;
  authLoading: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  resetSearch: () => void;
  closeMenuDrawer: () => void;
  closeNotificationDrawer: () => void;
  closeSearchDrawer: () => void;
  closeLoginModal: () => void;
  isMenuDrawerOpen: boolean;
  isNotificationDrawerOpen: boolean;
  isSearchDrawerOpen: boolean;
  isLoginModalOpen: boolean;
}

export const useAppNavigation = ({
  isAuthenticated,
  authLoading,
  showToast,
  resetSearch,
  closeMenuDrawer,
  closeNotificationDrawer,
  closeSearchDrawer,
  closeLoginModal,
  isMenuDrawerOpen,
  isNotificationDrawerOpen,
  isSearchDrawerOpen,
  isLoginModalOpen,
}: UseAppNavigationOptions) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [view, setView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem('jc_last_view');
    return (savedView as ViewType) || 'GUEST';
  });
  const [viewHistory, setViewHistory] = useState<ViewType[]>([]);
  const [initialSelectedMemberId, setInitialSelectedMemberId] = useState<string | null>(null);
  const [initialSelectedEventId, setInitialSelectedEventId] = useState<string | null>(null);
  const [initialSelectedProjectId, setInitialSelectedProjectId] = useState<string | null>(null);
  const [initialSelectedBusinessId, setInitialSelectedBusinessId] = useState<string | null>(null);

  const viewRef = useRef(view);
  const backPressedOnceRef = useRef(false);
  const backPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const pageTitle = getViewTitle(view);
    document.title = `${pageTitle} | JCI Kuala Lumpur`;

    if (view && !view.startsWith('GUEST')) {
      localStorage.setItem('jc_last_view', view);
    }
  }, [view]);

  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated) {
      navigate('/roadmap');
      if (viewRef.current.startsWith('GUEST')) {
        setView('DASHBOARD');
      }
      resetSearch();
      return;
    }

    const savedView = localStorage.getItem('jc_last_view');
    if (savedView && savedView.startsWith('GUEST')) {
      setView(savedView as ViewType);
    } else {
      setView('GUEST');
    }
    resetSearch();
  }, [isAuthenticated, authLoading, navigate, resetSearch]);

  useEffect(() => {
    if (!isAuthenticated) {
      const path = location.pathname;

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
      } else if (path === '/partnerships') {
        setView('GUEST_PARTNERSHIPS');
      } else if (path === '/') {
        setView('GUEST');
      }
      return;
    }

    const path = location.pathname;
    const guestPaths = ['/', '/about', '/events', '/projects', '/enewsletters', '/partnerships'];

    if (guestPaths.includes(path)) {
      navigate('/roadmap', { replace: true });
      if (view.startsWith('GUEST')) {
        setView('DASHBOARD');
      }
    } else if (path === '/roadmap' && view.startsWith('GUEST')) {
      setView('DASHBOARD');
    }
  }, [location.pathname, isAuthenticated, navigate, view]);

  const handleViewChange = useCallback((newView: ViewType, selectedId?: string) => {
    resetSearch();
    setViewHistory(prev => [...prev, view]);
    setView(newView);
    if (newView === 'MEMBERS' && selectedId) setInitialSelectedMemberId(selectedId);
    if (newView === 'EVENTS' && selectedId) setInitialSelectedEventId(selectedId);
    if (newView === 'PROJECTS' && selectedId) setInitialSelectedProjectId(selectedId);
    if (newView === 'DIRECTORY' && selectedId) setInitialSelectedBusinessId(selectedId);
  }, [resetSearch, view]);

  const handleGuestPageChange = useCallback((page: GuestPageKey) => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    resetSearch();

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
    } else if (page === 'partnerships') {
      setView('GUEST_PARTNERSHIPS');
      navigate('/partnerships');
    }
  }, [navigate, resetSearch]);

  const resetToGuestHome = useCallback(() => {
    localStorage.removeItem('jc_last_view');
    navigate('/', { replace: true });
    setView('GUEST');
  }, [navigate]);

  useEffect(() => {
    let listener: { remove: () => void } | null = null;
    let cancelled = false;
    import(/* @vite-ignore */ '@capacitor/app').then(({ App: CapApp }) => {
      if (cancelled) return;
      CapApp.addListener('backButton', () => {
        if (isMenuDrawerOpen) { closeMenuDrawer(); return; }
        if (isNotificationDrawerOpen) { closeNotificationDrawer(); return; }
        if (isSearchDrawerOpen) { closeSearchDrawer(); return; }
        if (isLoginModalOpen) { closeLoginModal(); return; }

        if (viewHistory.length > 0) {
          const prev = viewHistory[viewHistory.length - 1];
          setViewHistory(h => h.slice(0, -1));
          setView(prev);
          return;
        }

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
  }, [
    view,
    viewHistory,
    isMenuDrawerOpen,
    isNotificationDrawerOpen,
    isSearchDrawerOpen,
    isLoginModalOpen,
    closeMenuDrawer,
    closeNotificationDrawer,
    closeSearchDrawer,
    closeLoginModal,
    showToast,
  ]);

  return {
    view,
    setView,
    handleViewChange,
    handleGuestPageChange,
    resetToGuestHome,
    initialSelectedMemberId,
    initialSelectedEventId,
    initialSelectedProjectId,
    initialSelectedBusinessId,
    clearSelectedMember: () => setInitialSelectedMemberId(null),
    clearSelectedEvent: () => setInitialSelectedEventId(null),
    clearSelectedProject: () => setInitialSelectedProjectId(null),
    clearSelectedBusiness: () => setInitialSelectedBusinessId(null),
    selectCurrentMemberProfile: (memberId: string) => {
      setInitialSelectedMemberId(memberId);
      setView('MEMBERS');
    },
  };
};
