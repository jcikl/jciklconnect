/**
 * PerfMonitor — invisible component mounted once in App.tsx
 *
 * Tracks:
 * 1. Route change duration (navigation → first paint)
 * 2. Click interaction duration (click → next animation frame = JS + layout)
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { logPerf, logError } from '../../services/firestoreLogger';

export function PerfMonitor() {
  const location = useLocation();
  const navStart = useRef<number>(performance.now());
  const prevPath = useRef<string>(location.pathname);
  const firstMount = useRef(true);

  // Route change timing
  useEffect(() => {
    if (firstMount.current) {
      // Initial load — measure from navigation start
      const durationMs = Math.round(performance.now() - navStart.current);
      logPerf(`route:${location.pathname}`, 'navigation:initial', durationMs);
      firstMount.current = false;
      return;
    }
    const durationMs = Math.round(performance.now() - navStart.current);
    logPerf(`route:${location.pathname}`, 'navigation:change', durationMs);
    prevPath.current = location.pathname;
  }, [location.pathname]);

  // Record nav start time on every path change (before React re-renders)
  useEffect(() => {
    navStart.current = performance.now();
  }, [location.pathname]);

  // Console error/warn interception
  useEffect(() => {
    const origError = console.error.bind(console);
    const origWarn = console.warn.bind(console);

    console.error = (...args: any[]) => {
      origError(...args);
      const msg = args.map(a => (a instanceof Error ? a.message : String(a))).join(' ');
      logError(msg, 'error');
    };
    console.warn = (...args: any[]) => {
      origWarn(...args);
      const msg = args.map(a => (a instanceof Error ? a.message : String(a))).join(' ');
      logError(msg, 'warn');
    };

    return () => {
      console.error = origError;
      console.warn = origWarn;
    };
  }, []);

  // Click interaction timing — global listener
  useEffect(() => {
    function onPointerDown() {
      const clickAt = performance.now();
      // Measure time until next animation frame (= JS processing + layout)
      requestAnimationFrame(() => {
        const durationMs = Math.round(performance.now() - clickAt);
        // Only log slow interactions (>100ms) to avoid noise
        if (durationMs > 100) {
          logPerf(`interaction:${prevPath.current}`, 'click', durationMs);
        }
      });
    }
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return null;
}
