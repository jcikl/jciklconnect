import { ErrorInfo } from 'react';

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId: string;
  level: 'error' | 'warning' | 'info';
  context?: Record<string, any>;
  resolved?: boolean;
}

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  additionalData?: Record<string, any>;
}

class ErrorLoggingService {
  private logs: ErrorLogEntry[] = [];
  private sessionId: string;
  private maxLogs = 100; // Keep only the last 100 logs in memory

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadLogsFromStorage();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadLogsFromStorage(): void {
    try {
      const storedLogs = localStorage.getItem('errorLogs');
      if (storedLogs) {
        this.logs = JSON.parse(storedLogs);
      }
    } catch (error) {
      console.warn('Failed to load error logs from storage:', error);
    }
  }

  private saveLogsToStorage(): void {
    try {
      // Only keep the most recent logs in localStorage
      const recentLogs = this.logs.slice(-this.maxLogs);
      localStorage.setItem('errorLogs', JSON.stringify(recentLogs));
    } catch (error) {
      console.warn('Failed to save error logs to storage:', error);
    }
  }

  /**
   * Log an error with full context
   */
  logError(
    error: Error, 
    context?: ErrorContext, 
    errorInfo?: ErrorInfo
  ): string {
    const errorId = this.generateErrorId();
    
    const logEntry: ErrorLogEntry = {
      id: errorId,
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: context?.userId || this.getCurrentUserId(),
      sessionId: this.sessionId,
      level: 'error',
      context: {
        component: context?.component,
        action: context?.action,
        ...context?.additionalData
      },
      resolved: false
    };

    this.addLogEntry(logEntry);
    this.reportToExternalService(logEntry);
    
    return errorId;
  }

  /**
   * Log a warning
   */
  logWarning(message: string, context?: ErrorContext): string {
    const warningId = this.generateErrorId();
    
    const logEntry: ErrorLogEntry = {
      id: warningId,
      timestamp: new Date().toISOString(),
      message,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: context?.userId || this.getCurrentUserId(),
      sessionId: this.sessionId,
      level: 'warning',
      context: {
        component: context?.component,
        action: context?.action,
        ...context?.additionalData
      },
      resolved: false
    };

    this.addLogEntry(logEntry);
    
    return warningId;
  }

  /**
   * Log an info message
   */
  logInfo(message: string, context?: ErrorContext): string {
    const infoId = this.generateErrorId();
    
    const logEntry: ErrorLogEntry = {
      id: infoId,
      timestamp: new Date().toISOString(),
      message,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: context?.userId || this.getCurrentUserId(),
      sessionId: this.sessionId,
      level: 'info',
      context: {
        component: context?.component,
        action: context?.action,
        ...context?.additionalData
      },
      resolved: false
    };

    this.addLogEntry(logEntry);
    
    return infoId;
  }

  private addLogEntry(logEntry: ErrorLogEntry): void {
    this.logs.push(logEntry);
    
    // Keep only the most recent logs in memory
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    this.saveLogsToStorage();
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 ${logEntry.level.toUpperCase()}: ${logEntry.message}`);
      console.log('Error ID:', logEntry.id);
      console.log('Timestamp:', logEntry.timestamp);
      console.log('Context:', logEntry.context);
      if (logEntry.stack) {
        console.log('Stack:', logEntry.stack);
      }
      if (logEntry.componentStack) {
        console.log('Component Stack:', logEntry.componentStack);
      }
      console.groupEnd();
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentUserId(): string | undefined {
    try {
      return localStorage.getItem('userId') || undefined;
    } catch {
      return undefined;
    }
  }

  private async reportToExternalService(logEntry: ErrorLogEntry): Promise<void> {
    // In a real application, you would send this to an error tracking service
    // like Sentry, LogRocket, Bugsnag, or your own logging endpoint
    
    try {
      // Example: Send to your own logging endpoint
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(logEntry)
      // });

      // Example: Send to Sentry
      // if (window.Sentry) {
      //   window.Sentry.captureException(new Error(logEntry.message), {
      //     extra: logEntry.context,
      //     tags: {
      //       errorId: logEntry.id,
      //       component: logEntry.context?.component
      //     }
      //   });
      // }

      console.log('Error reported to external service:', logEntry.id);
    } catch (error) {
      console.warn('Failed to report error to external service:', error);
    }
  }

  /**
   * Get all logs
   */
  getLogs(): ErrorLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: ErrorLogEntry['level']): ErrorLogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get unresolved logs
   */
  getUnresolvedLogs(): ErrorLogEntry[] {
    return this.logs.filter(log => !log.resolved);
  }

  /**
   * Mark a log as resolved
   */
  markAsResolved(errorId: string): void {
    const log = this.logs.find(l => l.id === errorId);
    if (log) {
      log.resolved = true;
      this.saveLogsToStorage();
    }
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.saveLogsToStorage();
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Get error statistics
   */
  getStatistics(): {
    total: number;
    byLevel: Record<string, number>;
    unresolved: number;
    lastError?: string;
  } {
    const byLevel = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const unresolved = this.logs.filter(log => !log.resolved).length;
    const lastError = this.logs.length > 0 
      ? this.logs[this.logs.length - 1].timestamp 
      : undefined;

    return {
      total: this.logs.length,
      byLevel,
      unresolved,
      lastError
    };
  }
}

// Create a singleton instance
export const errorLoggingService = new ErrorLoggingService();

// Convenience functions
export const logError = (error: Error, context?: ErrorContext, errorInfo?: ErrorInfo) => 
  errorLoggingService.logError(error, context, errorInfo);

export const logWarning = (message: string, context?: ErrorContext) => 
  errorLoggingService.logWarning(message, context);

export const logInfo = (message: string, context?: ErrorContext) => 
  errorLoggingService.logInfo(message, context);

// React hook for error logging
export function useErrorLogging() {
  return {
    logError: (error: Error, context?: ErrorContext) => 
      errorLoggingService.logError(error, context),
    logWarning: (message: string, context?: ErrorContext) => 
      errorLoggingService.logWarning(message, context),
    logInfo: (message: string, context?: ErrorContext) => 
      errorLoggingService.logInfo(message, context),
    getLogs: () => errorLoggingService.getLogs(),
    getStatistics: () => errorLoggingService.getStatistics(),
    clearLogs: () => errorLoggingService.clearLogs(),
    exportLogs: () => errorLoggingService.exportLogs()
  };
}