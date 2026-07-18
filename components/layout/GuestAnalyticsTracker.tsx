import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { GuestAnalyticsService, pathToGuestPage, GuestPage } from '../../services/guestAnalyticsService';
import { useAuth } from '../../hooks/useAuth';

export const GuestAnalyticsTracker: React.FC = () => {
  const { member, loading: authLoading } = useAuth();
  const location = useLocation();
  const pageRef = useRef<GuestPage | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    // Wait for auth to resolve, then only track confirmed unauthenticated visitors
    if (authLoading || member) return;
    const page = pathToGuestPage(location.pathname);
    if (pageRef.current) {
      GuestAnalyticsService.trackDwell(pageRef.current, (performance.now() - startRef.current) / 1000);
    }
    pageRef.current = page;
    startRef.current = performance.now();
    if (page) GuestAnalyticsService.trackPageView(page);
  }, [location.pathname, member, authLoading]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden' && pageRef.current) {
        GuestAnalyticsService.trackDwell(pageRef.current, (performance.now() - startRef.current) / 1000);
        startRef.current = performance.now();
      }
    };
    document.addEventListener('visibilitychange', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      if (pageRef.current) {
        GuestAnalyticsService.trackDwell(pageRef.current, (performance.now() - startRef.current) / 1000);
      }
    };
  }, []);

  return null;
};
