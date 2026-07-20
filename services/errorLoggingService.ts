import { ErrorInfo } from 'react';
import { auth } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';

function sanitizeContext(obj: unknown, depth = 0): unknown {
  if (depth > 3 || obj === null || typeof obj !== 'object') return obj;
  // Fix 12 (P2): preserve arrays instead of converting them to numeric-keyed objects.
  if (Array.isArray(obj)) return obj.map(item => sanitizeContext(item, depth + 1));
  const SENSITIVE_RE = /password|token|secret|key|credential|apikey|api_key/i;
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>)
      .filter(([k]) => !SENSITIVE_RE.test(k))
      .map(([k, v]) => [k, sanitizeContext(v, depth + 1)])
  );
}

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
  context?: string;
  additionalData?: Record<string, any>;
  [key: string]: any;
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
      // Only store minimal fields in localStorage — stack traces, componentStack,
      // and context may contain sensitive data or exceed storage quotas.
      const recentLogs = this.logs.slice(-this.maxLogs).map(({ id, timestamp, level, message }) => ({
        id, timestamp, level, message,
      }));
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
      return auth?.currentUser?.uid ?? undefined;
    } catch {
      return undefined;
    }
  }

  // Upload crash reports to Firestore `errorLogs` so APK/web errors are visible remotely.
  // Skipped only when Firebase is not initialised (e.g. unit-test environments without a firebase config).
  private async reportToExternalService(logEntry: ErrorLogEntry): Promise<void> {
    try {
      // Dynamic import avoids a circular dependency at module-load time
      const [{ collection, addDoc }, { db }] = await Promise.all([
        import('firebase/firestore'),
        import('../config/firebase'),
      ]);
      // If Firebase was never initialised (missing config), db will be null/undefined — skip silently.
      if (!db) return;

      const isNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.();
      // Sanitize and strip sensitive keys from context before writing to Firestore
      const sanitizedLogEntry = {
        ...logEntry,
        context: logEntry.context ? sanitizeContext(logEntry.context as Record<string, unknown>) as Record<string, unknown> : undefined,
      };
      // Firestore rejects undefined values — strip them
      const payload = JSON.parse(JSON.stringify({
        ...sanitizedLogEntry,
        platform: isNative ? 'apk' : 'web',
      }));

      let attempts = 0;
      while (attempts < 3) {
        try {
          await addDoc(collection(db, COLLECTIONS.ERROR_LOGS), payload);
          break;
        } catch (err) {
          attempts++;
          if (attempts === 3) {
            console.error('[errorLoggingService] Failed to write to Firestore after 3 attempts', err);
          } else {
            await new Promise(r => setTimeout(r, 1000 * attempts)); // 1 s, 2 s backoff
          }
        }
      }
    } catch (importErr) {
      // Firebase module itself failed to load — nothing we can do
      console.warn('[errorLoggingService] Could not load Firebase for error reporting:', importErr);
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