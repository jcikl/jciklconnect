import React, { Component, ErrorInfo, ReactNode, useCallback } from 'react';
import { RefreshCw, Home, Bug, AlertTriangle } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { errorLoggingService } from '../../services/errorLoggingService';

// ── Fallback UI components ─────────────────────────────────────────────────────

export interface ErrorFallbackProps {
  errorId?: string | null;
  error?: Error | null;
  errorInfo?: ErrorInfo | null;
  onRetry?: () => void;
  showDetails?: boolean;
}

/** Full-page dark card — default fallback for top-level ErrorBoundary. */
export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  errorId, error, errorInfo, onRetry, showDetails = true,
}) => (
  <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col justify-center items-center p-5 sm:p-8">
    <div className="w-full max-w-sm sm:max-w-md">
      <div className="bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 p-6 sm:p-8 text-center">
        <img
          src="/mascot/Error.png"
          alt="Error mascot"
          className="w-48 sm:w-56 object-contain select-none mx-auto mb-4"
          draggable={false}
        />
        <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
          Oops! Something went wrong
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-5">
          An unexpected error occurred. We've logged it and will fix it soon.
        </p>

        {errorId && (
          <div className="bg-slate-700 rounded-xl px-4 py-2.5 mb-5 border border-slate-600 flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
            <p className="text-[11px] font-mono text-slate-400 truncate">{errorId}</p>
          </div>
        )}

        <div className="space-y-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full h-12 bg-jci-blue text-white rounded-2xl font-bold text-sm shadow-[0_8px_20px_-6px_rgba(0,151,215,0.5)] hover:bg-blue-600 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => window.location.reload()}
              className="h-10 bg-slate-700 text-slate-300 border border-slate-600 rounded-xl font-semibold text-xs hover:bg-slate-600 transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reload Page
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="h-10 bg-slate-700 text-slate-300 border border-slate-600 rounded-xl font-semibold text-xs hover:bg-slate-600 transition-all flex items-center justify-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" /> Go Home
            </button>
          </div>
        </div>

        {showDetails && (
          <details className="mt-5 text-left">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5">
              <Bug className="w-3 h-3" /> Show error details
            </summary>
            <div className="mt-3 p-3 bg-red-950/50 rounded-xl border border-red-900/50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-red-400">Error message</span>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(
                      JSON.stringify({ errorId, message: error?.message, stack: error?.stack }, null, 2),
                    )
                  }
                  className="text-[10px] text-red-500 hover:text-red-300 font-medium"
                >
                  Copy
                </button>
              </div>
              <pre className="text-[11px] text-red-400 whitespace-pre-wrap break-all leading-relaxed">
                {error?.message}
              </pre>
              {error?.stack && (
                <>
                  <p className="text-xs font-semibold text-red-400 pt-1">Stack trace</p>
                  <pre className="text-[11px] text-red-400 whitespace-pre-wrap break-all max-h-28 overflow-y-auto leading-relaxed">
                    {error.stack}
                  </pre>
                </>
              )}
              {errorInfo?.componentStack && (
                <>
                  <p className="text-xs font-semibold text-red-400 pt-1">Component stack</p>
                  <pre className="text-[11px] text-red-400 whitespace-pre-wrap break-all max-h-28 overflow-y-auto leading-relaxed">
                    {errorInfo.componentStack}
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

/** Compact inline fallback — default for section-level AsyncErrorBoundary. */
export const SectionErrorFallback: React.FC<Pick<ErrorFallbackProps, 'onRetry'>> = ({ onRetry }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
    <AlertTriangle size={28} className="text-amber-400 mb-2" />
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
      This section failed to load
    </p>
    <p className="text-xs text-slate-400 mb-3">The rest of the page should still work.</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 text-xs font-semibold text-jci-blue hover:underline"
      >
        <RefreshCw size={12} /> Try again
      </button>
    )}
  </div>
);

// ── ErrorBoundary class ────────────────────────────────────────────────────────

interface Props {
  children: ReactNode;
  /** Static fallback node (takes precedence over FallbackComponent). */
  fallback?: ReactNode;
  /** Custom fallback component receiving error state props. */
  FallbackComponent?: React.ComponentType<ErrorFallbackProps>;
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
    this.state = { hasError: false, error: null, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    this.props.onError?.(error, errorInfo);
    this.logError(error, errorInfo);
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    if (process.env.NODE_ENV === 'development') {
      console.group('🐛 ErrorBoundary');
      console.error('Error:', error);
      console.error('Component stack:', errorInfo.componentStack);
      console.groupEnd();
    }
    errorLoggingService.logError(
      error,
      {
        component: 'ErrorBoundary',
        additionalData: {
          errorId: this.state.errorId,
          userId: getAuth().currentUser?.uid ?? 'anonymous',
          url: window.location.href,
        },
      },
      errorInfo,
    );
  };

  private handleRetry = () =>
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const Fallback = this.props.FallbackComponent ?? ErrorFallback;
    return (
      <Fallback
        errorId={this.state.errorId}
        error={this.state.error}
        errorInfo={this.state.errorInfo}
        onRetry={this.handleRetry}
        showDetails={this.props.showDetails}
      />
    );
  }
}

// ── AsyncErrorBoundary ─────────────────────────────────────────────────────────
// Section-level boundary: uses SectionErrorFallback by default.
// NOTE: global unhandledrejection / error listeners belong in index.tsx, not here.
// Mounting multiple instances of a global listener is the source of cascading errors.

export function AsyncErrorBoundary({
  children,
  fallback,
  onError,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary
      FallbackComponent={SectionErrorFallback}
      fallback={fallback}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  );
}

// ── HOC + hook ─────────────────────────────────────────────────────────────────

export function withErrorBoundary<P extends object>(
  Comp: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>,
) {
  const Wrapped = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Comp {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `withErrorBoundary(${Comp.displayName ?? Comp.name})`;
  return Wrapped;
}

export function useErrorHandler() {
  return useCallback((error: Error, errorInfo?: unknown) => {
    errorLoggingService.logError(error, {
      component: 'useErrorHandler',
      additionalData: errorInfo ? { errorInfo } : undefined,
    });
  }, []);
}
