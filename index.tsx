import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// import './styles/accessibility.css';
import { AuthProvider } from './hooks/useAuth';
import { AccessibilityRunner } from './components/accessibility/AccessibilityRunner';
import { ToastProvider } from './components/ui/Common';
import { errorLoggingService } from './services/errorLoggingService';

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
    <ToastProvider>
      <AuthProvider>
        <AccessibilityRunner>
          <App />
        </AccessibilityRunner>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
