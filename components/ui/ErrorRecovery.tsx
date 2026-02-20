import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, Wifi, WifiOff, CheckCircle } from 'lucide-react';

interface ErrorRecoveryProps {
  error?: Error;
  onRetry?: () => void;
  onRecover?: () => void;
  autoRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export const ErrorRecovery: React.FC<ErrorRecoveryProps> = ({
  error,
  onRetry,
  onRecover,
  autoRetry = false,
  maxRetries = 3,
  retryDelay = 2000
}) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [countdown, setCountdown] = useState(0);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto retry logic
  useEffect(() => {
    if (autoRetry && error && retryCount < maxRetries && isOnline) {
      const timer = setTimeout(() => {
        handleRetry();
      }, retryDelay);

      return () => clearTimeout(timer);
    }
  }, [error, retryCount, maxRetries, autoRetry, retryDelay, isOnline]);

  // Countdown for next retry
  useEffect(() => {
    if (autoRetry && error && retryCount < maxRetries && isOnline && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [countdown, autoRetry, error, retryCount, maxRetries, isOnline]);

  const handleRetry = async () => {
    if (retryCount >= maxRetries) {
      return;
    }

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    try {
      if (onRetry) {
        await onRetry();
      }
      
      // If retry succeeds, reset retry count and call recovery handler
      setRetryCount(0);
      if (onRecover) {
        onRecover();
      }
    } catch (retryError) {
      console.error('Retry failed:', retryError);
      
      // Set countdown for next auto retry
      if (autoRetry && retryCount + 1 < maxRetries) {
        setCountdown(Math.floor(retryDelay / 1000));
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const getErrorType = (error: Error): 'network' | 'permission' | 'validation' | 'unknown' => {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'permission';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return 'validation';
    }
    
    return 'unknown';
  };

  const getRecoveryStrategy = (errorType: string) => {
    switch (errorType) {
      case 'network':
        return {
          title: '网络连接问题',
          description: '请检查您的网络连接并重试',
          icon: isOnline ? Wifi : WifiOff,
          canRetry: isOnline,
          suggestions: [
            '检查网络连接',
            '刷新页面',
            '稍后重试'
          ]
        };
      
      case 'permission':
        return {
          title: '权限不足',
          description: '您没有执行此操作的权限',
          icon: AlertCircle,
          canRetry: false,
          suggestions: [
            '联系管理员获取权限',
            '使用其他账户登录',
            '返回上一页'
          ]
        };
      
      case 'validation':
        return {
          title: '数据验证失败',
          description: '请检查输入的数据是否正确',
          icon: AlertCircle,
          canRetry: true,
          suggestions: [
            '检查必填字段',
            '验证数据格式',
            '重新提交'
          ]
        };
      
      default:
        return {
          title: '未知错误',
          description: '发生了意外错误',
          icon: AlertCircle,
          canRetry: true,
          suggestions: [
            '刷新页面',
            '清除浏览器缓存',
            '联系技术支持'
          ]
        };
    }
  };

  if (!error) {
    return null;
  }

  const errorType = getErrorType(error);
  const strategy = getRecoveryStrategy(errorType);
  const Icon = strategy.icon;
  const canRetry = strategy.canRetry && retryCount < maxRetries;

  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className="h-5 w-5 text-red-400" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            {strategy.title}
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{strategy.description}</p>
            {error.message && (
              <p className="mt-1 font-mono text-xs bg-red-100 p-2 rounded">
                {error.message}
              </p>
            )}
          </div>

          {/* Recovery suggestions */}
          <div className="mt-3">
            <h4 className="text-sm font-medium text-red-800">建议的解决方案:</h4>
            <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
              {strategy.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>

          {/* Retry information */}
          {retryCount > 0 && (
            <div className="mt-3 text-sm text-red-600">
              已重试 {retryCount} / {maxRetries} 次
            </div>
          )}

          {/* Auto retry countdown */}
          {autoRetry && countdown > 0 && canRetry && (
            <div className="mt-2 text-sm text-red-600">
              {countdown} 秒后自动重试...
            </div>
          )}

          {/* Network status */}
          {errorType === 'network' && (
            <div className="mt-2 flex items-center text-sm">
              {isOnline ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-700">网络已连接</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500 mr-1" />
                  <span className="text-red-700">网络未连接</span>
                </>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex space-x-2">
            {canRetry && (
              <button
                onClick={handleRetry}
                disabled={isRetrying || (!isOnline && errorType === 'network')}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    重试中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="-ml-1 mr-2 h-4 w-4" />
                    重试 ({maxRetries - retryCount} 次剩余)
                  </>
                )}
              </button>
            )}

            {retryCount >= maxRetries && (
              <div className="text-sm text-red-600">
                已达到最大重试次数。请刷新页面或联系技术支持。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook for error recovery
export function useErrorRecovery(maxRetries = 3) {
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);

  const reportError = (error: Error) => {
    setError(error);
    setRetryCount(0);
  };

  const retry = async (retryFn: () => Promise<void> | void) => {
    if (retryCount >= maxRetries) {
      return false;
    }

    setIsRecovering(true);
    setRetryCount(prev => prev + 1);

    try {
      await retryFn();
      setError(null);
      setRetryCount(0);
      return true;
    } catch (retryError) {
      console.error('Retry failed:', retryError);
      return false;
    } finally {
      setIsRecovering(false);
    }
  };

  const reset = () => {
    setError(null);
    setRetryCount(0);
    setIsRecovering(false);
  };

  return {
    error,
    retryCount,
    isRecovering,
    canRetry: retryCount < maxRetries,
    reportError,
    retry,
    reset
  };
}