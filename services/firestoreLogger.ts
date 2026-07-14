/**
 * System Logger — Firestore ops + Performance monitoring
 *
 * Fire-and-forget buffered logger. Buffers events for 3 seconds then writes
 * one batched document to systemLogs.
 *
 * Firestore ops:
 *   logRead('finance:transactions', 'financeService.getAllTransactions')
 *   logWrite('transactions', 'financeService.createTransaction')
 *   logListener('conversations', 'messagingService.subscribeToMessages')
 *
 * Performance:
 *   logPerf('route:/members', 'navigation', 320)       // ms
 *   logPerf('fetch:members:all', 'membersService', 85)
 *   logPerf('interaction:openMemberModal', 'click', 45)
 */

import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';

export type LogOperation = 'READ' | 'WRITE' | 'DELETE' | 'LISTENER' | 'PERF';

export interface FirestoreLogEntry {
  operation: LogOperation;
  source: string;
  caller: string;
  timestamp: number;
  durationMs?: number; // PERF entries only
}

// ─── Buffer ──────────────────────────────────────────────────────────────────

const buffer: FirestoreLogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DELAY_MS = 3000;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DELAY_MS);
}

async function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);

  // Group by (operation, source, caller) — PERF entries keep avgDurationMs
  const summary: Record<string, {
    operation: LogOperation; source: string; caller: string;
    count: number; firstAt: number; lastAt: number;
    totalDurationMs: number; maxDurationMs: number;
  }> = {};

  for (const entry of batch) {
    const key = `${entry.operation}::${entry.source}::${entry.caller}`;
    if (!summary[key]) {
      summary[key] = {
        operation: entry.operation, source: entry.source, caller: entry.caller,
        count: 0, firstAt: entry.timestamp, lastAt: entry.timestamp,
        totalDurationMs: 0, maxDurationMs: 0,
      };
    }
    const s = summary[key];
    s.count++;
    if (entry.timestamp < s.firstAt) s.firstAt = entry.timestamp;
    if (entry.timestamp > s.lastAt) s.lastAt = entry.timestamp;
    if (entry.durationMs) {
      s.totalDurationMs += entry.durationMs;
      if (entry.durationMs > s.maxDurationMs) s.maxDurationMs = entry.durationMs;
    }
  }

  const entries = Object.values(summary);
  try {
    await addDoc(collection(db, COLLECTIONS.SYSTEM_LOGS), {
      flushedAt: Timestamp.now(),
      windowMs: batch.length > 0 ? batch[batch.length - 1].timestamp - batch[0].timestamp : 0,
      totalOps: batch.length,
      entries: entries.map(e => {
        const base = {
          operation: e.operation,
          source: e.source,
          caller: e.caller,
          count: e.count,
          firstAt: Timestamp.fromMillis(e.firstAt),
          lastAt: Timestamp.fromMillis(e.lastAt),
        };
        if (e.totalDurationMs > 0) {
          return {
            ...base,
            avgDurationMs: Math.round(e.totalDurationMs / e.count),
            maxDurationMs: e.maxDurationMs,
          };
        }
        return base;
      }),
    });
  } catch {
    // Silent — logger must never crash the app
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (buffer.length > 0) flush();
  });
}

// ─── Internal record ─────────────────────────────────────────────────────────

function record(operation: LogOperation, source: string, caller: string, durationMs?: number) {
  if (isDevMode()) {
    const dur = durationMs != null ? ` (${durationMs}ms)` : '';
    console.debug(`[${operation}] ${caller} → ${source}${dur}`);
    return;
  }
  if (source.includes('systemLogs')) return;

  buffer.push({ operation, source, caller, timestamp: Date.now(), durationMs });
  scheduleFlush();
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function logRead(source: string, caller: string) {
  record('READ', source, caller);
}

export function logWrite(source: string, caller: string) {
  record('WRITE', source, caller);
}

export function logDelete(source: string, caller: string) {
  record('DELETE', source, caller);
}

export function logListener(source: string, caller: string) {
  record('LISTENER', source, caller);
}

/**
 * Log a performance measurement.
 * @param source  What was measured, e.g. 'route:/members', 'fetch:members:all', 'interaction:openModal'
 * @param caller  Where the measurement was taken, e.g. 'navigation', 'useMembersData', 'click'
 * @param durationMs  Elapsed time in milliseconds
 */
export function logPerf(source: string, caller: string, durationMs: number) {
  record('PERF', source, caller, durationMs);
}

/**
 * Start a stopwatch. Call the returned function when the operation completes.
 * Returns a stop function that logs the elapsed time automatically.
 *
 * Usage:
 *   const stop = startPerf('route:/members', 'navigation');
 *   // ... do work ...
 *   stop();
 */
export function startPerf(source: string, caller: string): () => void {
  const start = performance.now();
  return () => {
    const durationMs = Math.round(performance.now() - start);
    logPerf(source, caller, durationMs);
  };
}
