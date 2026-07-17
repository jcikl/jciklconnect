import { collection, addDoc, WriteBatch, doc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';

export interface AuditEntry {
  action: string;
  performedBy: string;
  targetCollection: string;
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class AuditLogService {
  /**
   * Write an audit log entry.
   *
   * @param entry - The audit data to persist.
   * @param batch - Optional WriteBatch. When provided the audit doc is added to
   *   the batch via `batch.set()` so it commits atomically with the main operation.
   *   When omitted a standalone `addDoc()` is used (backward-compatible).
   *
   * @important Callers performing multi-document writes should pass their
   *   `writeBatch` so the audit entry is committed atomically. Do NOT use a
   *   separate `addDoc()` alongside a batch — that breaks atomicity.
   */
  static async writeAuditEntry(entry: AuditEntry, batch?: WriteBatch): Promise<void> {
    if (isDevMode()) {
      console.log('[DEV MODE] Audit entry:', entry);
      return;
    }
    try {
      const payload = {
        ...entry,
        performedBy: entry.performedBy || auth?.currentUser?.uid || 'unknown',
        timestamp: Timestamp.now(),
      };
      if (batch) {
        const newAuditRef = doc(collection(db, COLLECTIONS.AUDIT_LOG));
        batch.set(newAuditRef, payload);
      } else {
        await addDoc(collection(db, COLLECTIONS.AUDIT_LOG), payload);
      }
    } catch (error) {
      // Audit log failures must never block the main operation
      console.error('[auditLogService] Failed to write audit entry:', error);
    }
  }
}
