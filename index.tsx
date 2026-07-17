import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// import './styles/accessibility.css';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './components/ui/Common';
import { errorLoggingService } from './services/errorLoggingService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// TODO BUNDLE-004: @tanstack/react-query is loaded for all users but currently only used by
// useGamification.ts. Either migrate the top 5 heaviest data hooks (useMembers, useEvents,
// useProjects, useFinanceData, useCommunication) to useQuery/useMutation to justify the ~13KB cost,
// or remove react-query and rewrite useGamification.ts with useState+useEffect.
// Decision deferred — evaluate after React perf improvements (PERF-A-004) are shipped.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3 * 60 * 1000, // 3 min — matches existing cacheService TTL
      retry: 1,
    },
  },
});

// Catch async errors that never reach the React ErrorBoundary (APK debugging)
if (!(window as any).__globalErrorHandlersInstalled) {
  (window as any).__globalErrorHandlersInstalled = true;
  window.addEventListener('error', (event) => {
    errorLoggingService.logError(
      event.error instanceof Error ? event.error : new Error(String(event.message)),
      { component: 'window.onerror', action: `${event.filename}:${event.lineno}` }
    );
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    errorLoggingService.logError(
      reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason ?? 'Unknown rejection')),
      { component: 'unhandledrejection' }
    );
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      updateViaCache: 'none',
      scope: '/'
    }).then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              window.location.reload();
            }
          });
        }
      });
    }).catch(err => console.error('SW registration failed:', err));
  });
}
