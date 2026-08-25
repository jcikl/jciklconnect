import React from 'react';
import { Loader2 } from 'lucide-react';
import { EmptyState } from './EmptyState';

interface LoadingStateProps {
  loading: boolean;
  error?: string | null;
  children: React.ReactNode;
  emptyMessage?: string;
  empty?: boolean;
  onRetry?: () => void;
  loadingMessage?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  loading,
  error,
  children,
  emptyMessage = 'No data available',
  empty = false,
  onRetry,
  loadingMessage = 'Loading...',
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-jci-blue" />
          <p className="text-sm text-slate-500">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="mb-2 font-medium text-red-600">Error loading data</p>
          <p className="text-sm text-slate-500">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg border border-blue-200 px-4 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (empty) {
    return <EmptyState title={emptyMessage} className="my-4" />;
  }

  return <>{children}</>;
};

export type { LoadingStateProps };
