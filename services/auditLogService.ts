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

/**
 * P0-fix: Firestore allow create: if isAdmin() blocks BOARD-role users who legitimately
 * perform auditable operations. This function falls back to the Netlify Function
 * (/.netlify/functions/audit-log) which uses the Admin SDK and bypasses the rule.
 *
 * The fallback is only invoked after a PERMISSION_DENIED from the direct write path —
 * admin callers still use the fast direct path.
 */
async function _writeViaNetlifyFunction(entry: AuditEntry): Promise<void> {
  const idToken = await auth?.currentUser?.getIdToken();
  if (!idToken) {
    console.warn('[auditLogService] No ID token — cannot route audit entry through Netlify function.');
    return;
  }
  const response = await fetch('/.netlify/functions/audit-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(entry),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`[auditLogService] Netlify function audit write failed (${response.status}): ${text}`);
  }
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
   *
   * P0-fix: on PERMISSION_DENIED (BOARD-role callers lack direct Firestore write access)
   * the entry is re-routed through the Netlify audit-log function which uses Admin SDK.
   * Note: when using a batch, PERMISSION_DENIED can only be detected after batch.commit()
   * in the caller — pass `batch` only for ADMIN+ callers where the direct path succeeds.
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
      const code = (error as { code?: string }).code;
      if (code === 'permission-denied') {
        // P0-fix: BOARD role callers hit Firestore allow create: if isAdmin() — route through
        // Netlify Function which uses Admin SDK and is not subject to this rule.
        await _writeViaNetlifyFunction({
          ...entry,
          performedBy: entry.performedBy || auth?.currentUser?.uid || 'unknown',
        });
      } else {
        // Audit log failures must never block the main operation
        console.error('[auditLogService] Failed to write audit entry:', error);
      }
    }
  }
}
