/**
 * Firestore Read/Write Logger
 *
 * Fire-and-forget audit logger. Buffers events for 3 seconds then writes
 * a single batched document to systemLogs — so a burst of 50 cache misses
 * becomes 1 write, not 50.
 *
 * Usage:
 *   logRead('finance:transactions', 'financeService.getAllTransactions')
 *   logWrite('transactions', 'financeService.createTransaction')
 *   logListener('conversations', 'messagingService.subscribeToMessages')
 */

import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';

export type LogOperation = 'READ' | 'WRITE' | 'DELETE' | 'LISTENER';

export interface FirestoreLogEntry {
  operation: LogOperation;
  /** Cache key or collection name */
  source: string;
  /** Function/service that triggered the operation */
  caller: string;
  timestamp: number; // epoch ms — converted to Timestamp on flush
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

  // Group by (operation, source) to produce summary counts
  const summary: Record<string, { operation: LogOperation; source: string; caller: string; count: number; firstAt: number; lastAt: number }> = {};
  for (const entry of batch) {
    const key = `${entry.operation}::${entry.source}::${entry.caller}`;
    if (!summary[key]) {
      summary[key] = { operation: entry.operation, source: entry.source, caller: entry.caller, count: 0, firstAt: entry.timestamp, lastAt: entry.timestamp };
    }
    summary[key].count++;
    if (entry.timestamp < summary[key].firstAt) summary[key].firstAt = entry.timestamp;
    if (entry.timestamp > summary[key].lastAt) summary[key].lastAt = entry.timestamp;
  }

  const entries = Object.values(summary);
  try {
    await addDoc(collection(db, COLLECTIONS.SYSTEM_LOGS), {
      flushedAt: Timestamp.now(),
      windowMs: entries.length > 0 ? entries[0].lastAt - entries[0].firstAt : 0,
      totalOps: batch.length,
      entries: entries.map(e => ({
        operation: e.operation,
        source: e.source,
        caller: e.caller,
        count: e.count,
        firstAt: Timestamp.fromMillis(e.firstAt),
        lastAt: Timestamp.fromMillis(e.lastAt),
      })),
    });
  } catch {
    // Silent — logger must never crash the app
  }
}

// Flush on page unload so we don't lose the last buffer
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (buffer.length > 0) flush();
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

function record(operation: LogOperation, source: string, caller: string) {
  if (isDevMode()) {
    // In dev mode just print — don't write to Firestore
    console.debug(`[Firestore ${operation}] ${caller} → ${source}`);
    return;
  }
  // Never log the logger itself to avoid infinite loops
  if (source.includes('systemLogs')) return;

  buffer.push({ operation, source, caller, timestamp: Date.now() });
  scheduleFlush();
}

/** Log a Firestore read (cache miss — actual network call) */
export function logRead(source: string, caller: string) {
  record('READ', source, caller);
}

/** Log a Firestore write (setDoc / addDoc / updateDoc) */
export function logWrite(source: string, caller: string) {
  record('WRITE', source, caller);
}

/** Log a Firestore delete */
export function logDelete(source: string, caller: string) {
  record('DELETE', source, caller);
}

/** Log a real-time listener registration */
export function logListener(source: string, caller: string) {
  record('LISTENER', source, caller);
}
