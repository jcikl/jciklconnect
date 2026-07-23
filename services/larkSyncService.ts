import { auth } from '../config/firebase';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { errorLoggingService } from './errorLoggingService';

type LarkSyncAction = 'upsert' | 'delete';
type LarkSyncCollection = 'members';

interface LarkSyncRequest {
  collection: LarkSyncCollection;
  id: string;
  action?: LarkSyncAction;
}

const LARK_SYNC_ENDPOINT = '/.netlify/functions/lark-sync';

export class LarkSyncService {
  static async syncRecord(request: LarkSyncRequest): Promise<void> {
    const user = auth?.currentUser;
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetchWithTimeout(
        LARK_SYNC_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'upsert', ...request }),
        },
        15000
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Lark sync failed with ${response.status}${body ? `: ${body}` : ''}`);
      }
    } catch (error) {
      errorLoggingService.logError(
        error instanceof Error ? error : new Error(String(error)),
        {
          context: 'LarkSyncService.syncRecord',
          additionalInfo: `${request.collection}/${request.id}`,
        }
      );
    }
  }
}
