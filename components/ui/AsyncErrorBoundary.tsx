import React, { Component, ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  children: ReactNode;
  onError?: (error: Error) => void;
  fallback?: ReactNode;
}

interface State {
  asyncError: Error | null;
}

/**
 * AsyncErrorBoundary - Handles both synchronous and asynchronous errors
 * 
 * This component extends the regular ErrorBoundary to also catch:
 * - Promise rejections
 * - Async/await errors
 * - Network request failures
 */
export class AsyncErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      asyncError: null
    };
  }

  componentDidMount() {
    // Listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    
    // Listen for general errors
    window.addEventListener('error', this.handleError);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    window.removeEventListener('error', this.handleError);
  }

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Create an Error object from the rejection reason
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));

    this.setState({ asyncError: error });
    
    if (this.props.onError) {
      this.props.onError(error);
    }

    // Prevent the default browser behavior
    event.preventDefault();
  };

  private handleError = (event: ErrorEvent) => {
    console.error('Global error:', event.error);
    
    const error = event.error || new Error(event.message);
    this.setState({ asyncError: error });
    
    if (this.props.onError) {
      this.props.onError(error);
    }
  };

  private resetAsyncError = () => {
    this.setState({ asyncError: null });
  };

  render() {
    // If we have an async error, throw it so ErrorBoundary can catch it
    if (this.state.asyncError) {
      throw this.state.asyncError;
    }

    return (
      <ErrorBoundary 
        onError={(error, errorInfo) => {
          console.error('ErrorBoundary caught error:', error, errorInfo);
          if (this.props.onError) {
            this.props.onError(error);
          }
        }}
        fallback={this.props.fallback}
      >
        {this.props.children}
      </ErrorBoundary>
    );
  }
}

// Hook for handling async errors in functional components
export function useAsyncError() {
  const [, setError] = React.useState<Error | null>(null);
  
  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}

// Utility function to wrap async functions with error handling
export function withAsyncErrorHandling<T extends any[], R>(
  asyncFn: (...args: T) => Promise<R>,
  onError?: (error: Error) => void
) {
  return async (...args: T): Promise<R | undefined> => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      if (onError) {
        onError(errorObj);
      } else {
        console.error('Async function error:', errorObj);
      }
      
      // Re-throw the error so it can be caught by error boundaries
      throw errorObj;
    }
  };
}

// Custom hook for safe async operations
export function useSafeAsync<T>() {
  const [state, setState] = React.useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: false,
    error: null
  });

  const execute = React.useCallback(async (asyncFn: () => Promise<T>) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await asyncFn();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      setState({ data: null, loading: false, error: errorObj });
      throw errorObj;
    }
  }, []);

  const reset = React.useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset
  };
}