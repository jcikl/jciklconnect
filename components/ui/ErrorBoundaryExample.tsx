import React, { useState } from 'react';
import { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';
import { AsyncErrorBoundary, useAsyncError } from './AsyncErrorBoundary';
import { ErrorRecovery, useErrorRecovery } from './ErrorRecovery';
import { useErrorLogging, errorLoggingService } from '../../services/errorLoggingService';
import { Button } from './Common';
import { AlertTriangle, Bug, Zap } from 'lucide-react';

// Component that throws synchronous errors
const SyncErrorComponent: React.FC<{ shouldError: boolean }> = ({ shouldError }) => {
  if (shouldError) {
    throw new Error('This is a test synchronous error!');
  }
  
  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
      <p className="text-green-800">✅ Sync component is working fine!</p>
    </div>
  );
};

// Component that throws async errors
const AsyncErrorComponent: React.FC<{ shouldError: boolean }> = ({ shouldError }) => {
  const throwAsyncError = useAsyncError();
  const [isLoading, setIsLoading] = useState(false);

  const handleAsyncOperation = async () => {
    setIsLoading(true);
    try {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (shouldError) {
        throw new Error('This is a test asynchronous error!');
      }
      
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      throwAsyncError(error as Error);
    }
  };

  React.useEffect(() => {
    if (shouldError) {
      handleAsyncOperation();
    }
  }, [shouldError]);

  if (isLoading) {
    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-800">🔄 Loading async operation...</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
      <p className="text-green-800">✅ Async component is working fine!</p>
      <Button onClick={handleAsyncOperation} className="mt-2">
        Test Async Operation
      </Button>
    </div>
  );
};

// Component with error recovery
const RecoverableComponent: React.FC = () => {
  const { error, retryCount, isRecovering, reportError, retry, reset } = useErrorRecovery();
  const { logError, logWarning } = useErrorLogging();
  const [shouldFail, setShouldFail] = useState(false);

  const simulateOperation = async () => {
    if (shouldFail) {
      const error = new Error('Simulated operation failure');
      logError(error, { component: 'RecoverableComponent', action: 'simulate_operation' });
      throw error;
    }
    
    // Simulate successful operation
    await new Promise(resolve => setTimeout(resolve, 500));
    logWarning('Operation completed successfully', { component: 'RecoverableComponent' });
  };

  const handleOperation = async () => {
    try {
      await simulateOperation();
      reset(); // Clear any previous errors
    } catch (error) {
      reportError(error as Error);
    }
  };

  const handleRetry = async () => {
    const success = await retry(simulateOperation);
    if (success) {
      setShouldFail(false); // Reset failure state on successful retry
    }
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <h4 className="font-semibold mb-3">Recoverable Component</h4>
      
      {error && (
        <ErrorRecovery
          error={error}
          onRetry={handleRetry}
          onRecover={reset}
          autoRetry={false}
          maxRetries={3}
        />
      )}
      
      {!error && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="shouldFail"
              checked={shouldFail}
              onChange={(e) => setShouldFail(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="shouldFail" className="text-sm">
              Simulate failure
            </label>
          </div>
          
          <Button 
            onClick={handleOperation}
            disabled={isRecovering}
            className="w-full"
          >
            {isRecovering ? 'Recovering...' : 'Run Operation'}
          </Button>
          
          {retryCount > 0 && (
            <p className="text-sm text-gray-600">
              Retry attempts: {retryCount}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Component wrapped with HOC
const WrappedComponent = withErrorBoundary(
  ({ message }: { message: string }) => (
    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
      <p className="text-purple-800">🎯 HOC Wrapped Component: {message}</p>
    </div>
  ),
  {
    onError: (error, errorInfo) => {
      console.log('HOC Error Boundary caught error:', error);
    }
  }
);

// Main example component
export const ErrorBoundaryExample: React.FC = () => {
  const [syncError, setSyncError] = useState(false);
  const [asyncError, setAsyncError] = useState(false);
  const [showWrapped, setShowWrapped] = useState(true);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Error Boundary Examples
        </h2>
        <p className="text-gray-600">
          Demonstrating different error handling scenarios
        </p>
      </div>

      {/* Controls */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-3 flex items-center">
          <Bug className="w-5 h-5 mr-2" />
          Error Controls
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant={syncError ? 'danger' : 'outline'}
            onClick={() => setSyncError(!syncError)}
            className="flex items-center justify-center"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            {syncError ? 'Fix' : 'Trigger'} Sync Error
          </Button>
          
          <Button
            variant={asyncError ? 'danger' : 'outline'}
            onClick={() => setAsyncError(!asyncError)}
            className="flex items-center justify-center"
          >
            <Zap className="w-4 h-4 mr-2" />
            {asyncError ? 'Fix' : 'Trigger'} Async Error
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowWrapped(!showWrapped)}
            className="flex items-center justify-center"
          >
            {showWrapped ? 'Hide' : 'Show'} HOC Component
          </Button>
        </div>
      </div>

      {/* Error Boundary Examples */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Synchronous Error Example */}
        <div className="space-y-3">
          <h3 className="font-semibold">Synchronous Error Boundary</h3>
          <ErrorBoundary
            onError={(error) => {
              console.log('Sync Error Boundary:', error);
            }}
          >
            <SyncErrorComponent shouldError={syncError} />
          </ErrorBoundary>
        </div>

        {/* Asynchronous Error Example */}
        <div className="space-y-3">
          <h3 className="font-semibold">Asynchronous Error Boundary</h3>
          <AsyncErrorBoundary
            onError={(error) => {
              console.log('Async Error Boundary:', error);
            }}
          >
            <AsyncErrorComponent shouldError={asyncError} />
          </AsyncErrorBoundary>
        </div>

        {/* Error Recovery Example */}
        <div className="space-y-3">
          <h3 className="font-semibold">Error Recovery</h3>
          <RecoverableComponent />
        </div>

        {/* HOC Example */}
        <div className="space-y-3">
          <h3 className="font-semibold">HOC Wrapped Component</h3>
          {showWrapped && (
            <WrappedComponent message="This component is wrapped with withErrorBoundary HOC" />
          )}
          {!showWrapped && (
            <div className="p-4 bg-gray-100 border border-gray-200 rounded-lg text-center text-gray-500">
              Component hidden
            </div>
          )}
        </div>
      </div>

      {/* Error Logging Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Error Logging</h3>
        <p className="text-blue-800 text-sm">
          All errors are automatically logged to the error logging service. 
          Check the browser console to see the detailed error logs and statistics.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => {
            const stats = errorLoggingService.getStatistics();
            console.log('Error Statistics:', stats);
            console.log('All Logs:', errorLoggingService.getLogs());
          }}
        >
          View Error Statistics
        </Button>
      </div>
    </div>
  );
};