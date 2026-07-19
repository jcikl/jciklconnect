import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { errorLoggingService } from '../../services/errorLoggingService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to external service in production
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to an error tracking service
    // like Sentry, LogRocket, or Bugsnag
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: getAuth().currentUser?.uid ?? 'anonymous',
      errorId: this.state.errorId
    };

    // For now, just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🐛 Error Boundary - Detailed Error Report');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.table(errorData);
      console.groupEnd();
    }

    // Upload to Firestore errorLogs (works on web + APK)
    errorLoggingService.logError(error, {
      component: 'ErrorBoundary',
      additionalData: { errorId: this.state.errorId },
    }, errorInfo);
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private copyErrorDetails = () => {
    const errorDetails = {
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => {
        alert('Error details copied to clipboard');
      })
      .catch(() => {
        console.error('Failed to copy error details');
      });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col justify-center items-center p-5 sm:p-8">
          <div className="w-full max-w-sm sm:max-w-md">
            {/* Mascot illustration */}
            <div className="flex justify-center mb-2">
              <img
                src="/mascot/Error.png"
                alt="Error mascot"
                className="w-64 sm:w-72 object-contain select-none"
                draggable={false}
              />
            </div>

            {/* Card */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 text-center">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 tracking-tight">
                Oops! Something went wrong
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-5">
                An unexpected error occurred. We've logged it and will fix it soon.
              </p>

              {this.state.errorId && (
                <div className="bg-slate-50 rounded-xl px-4 py-2.5 mb-5 border border-slate-100 flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
                  <p className="text-[11px] font-mono text-slate-400 truncate">
                    {this.state.errorId}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full h-12 bg-jci-blue text-white rounded-2xl font-bold text-sm shadow-[0_8px_20px_-6px_rgba(0,151,215,0.5)] hover:bg-blue-600 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={this.handleReload}
                    className="h-10 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl font-semibold text-xs hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reload Page
                  </button>
                  <button
                    onClick={this.handleGoHome}
                    className="h-10 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl font-semibold text-xs hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Home className="w-3.5 h-3.5" />
                    Go Home
                  </button>
                </div>
              </div>

              {(this.props.showDetails !== false) && (
                <details className="mt-5 text-left">
                  <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1.5">
                    <Bug className="w-3 h-3" />
                    Show error details
                  </summary>
                  <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-red-700">Error message</span>
                      <button
                        onClick={this.copyErrorDetails}
                        className="text-[10px] text-red-500 hover:text-red-700 font-medium"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="text-[11px] text-red-600 whitespace-pre-wrap break-all leading-relaxed">
                      {this.state.error?.message}
                    </pre>
                    {this.state.error?.stack && (
                      <>
                        <p className="text-xs font-semibold text-red-700 pt-1">Stack trace</p>
                        <pre className="text-[11px] text-red-600 whitespace-pre-wrap break-all max-h-28 overflow-y-auto leading-relaxed">
                          {this.state.error.stack}
                        </pre>
                      </>
                    )}
                    {this.state.errorInfo?.componentStack && (
                      <>
                        <p className="text-xs font-semibold text-red-700 pt-1">Component stack</p>
                        <pre className="text-[11px] text-red-600 whitespace-pre-wrap break-all max-h-28 overflow-y-auto leading-relaxed">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for error reporting in functional components
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: any) => {
    console.error('Manual error report:', error, errorInfo);
    errorLoggingService.logError(error, {
      component: 'useErrorHandler',
      additionalData: errorInfo ? { errorInfo } : undefined,
    });
  }, []);
}