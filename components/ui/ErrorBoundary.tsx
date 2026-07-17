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
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-6">
          <div className="w-full max-w-md bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden">
            <div className="p-8 sm:p-10 text-center">
              {/* Error Illustration / Icon */}
              <div className="w-20 h-20 bg-red-50 rounded-[24px] flex items-center justify-center mx-auto mb-8 shadow-sm border border-red-100/50">
                <AlertTriangle className="h-10 w-10 text-red-500" />
              </div>

              <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">
                Sorry, something went wrong
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                The application encountered an unexpected error. This may be a temporary issue — we have logged it and are working on a fix.
              </p>

              {this.state.errorId && (
                <div className="bg-slate-50 rounded-2xl p-4 mb-8 border border-slate-100 flex items-center justify-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Error ID: <span className="text-slate-800 font-mono">{this.state.errorId}</span>
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <button
                  onClick={this.handleRetry}
                  className="w-full h-14 bg-jci-blue text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-[0_12px_24px_-8px_rgba(0,151,215,0.4)] hover:bg-blue-600 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <RefreshCw className="w-5 h-5" />
                  Retry Now
                </button>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={this.handleReload}
                    className="h-12 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Page
                  </button>

                  <button
                    onClick={this.handleGoHome}
                    className="h-12 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Home className="w-4 h-4" />
                    Back to Home
                  </button>
                </div>
              </div>

                {(this.props.showDetails !== false) && (
                  <details className="mt-6 text-left">
                    <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                      Show error details
                    </summary>
                    <div className="mt-3 p-3 bg-red-50 rounded-md">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-medium text-red-800">Error message:</h4>
                        <button
                          onClick={this.copyErrorDetails}
                          className="text-xs text-red-600 hover:text-red-800 flex items-center"
                        >
                          <Bug className="w-3 h-3 mr-1" />
                          Copy details
                        </button>
                      </div>
                      <pre className="text-xs text-red-700 whitespace-pre-wrap break-all">
                        {this.state.error?.message}
                      </pre>
                      
                      {this.state.error?.stack && (
                        <>
                          <h4 className="text-sm font-medium text-red-800 mt-3 mb-1">Stack trace:</h4>
                          <pre className="text-xs text-red-700 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                            {this.state.error.stack}
                          </pre>
                        </>
                      )}

                      {this.state.errorInfo?.componentStack && (
                        <>
                          <h4 className="text-sm font-medium text-red-800 mt-3 mb-1">Component stack:</h4>
                          <pre className="text-xs text-red-700 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
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