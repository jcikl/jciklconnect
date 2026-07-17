import { collection, addDoc, Timestamp } from 'firebase/firestore';
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
  static async writeAuditEntry(entry: AuditEntry): Promise<void> {
    if (isDevMode()) {
      console.log('[DEV MODE] Audit entry:', entry);
      return;
    }
    try {
      await addDoc(collection(db, COLLECTIONS.AUDIT_LOG), {
        ...entry,
        performedBy: entry.performedBy || auth?.currentUser?.uid || 'unknown',
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      // Audit log failures must never block the main operation
      console.error('[auditLogService] Failed to write audit entry:', error);
    }
  }
}
