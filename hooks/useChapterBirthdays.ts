/** Own-chapter birthdays for an active external user (dashboard birthday widget). `month` null → nothing loads. */
import { useEffect, useState } from 'react';
import { ChapterBirthdaysService, type ChapterBirthday } from '../services/chapterBirthdaysService';

export function useChapterBirthdays(month: number | null) {
  const [birthdays, setBirthdays] = useState<ChapterBirthday[]>([]);
  const [loading, setLoading] = useState(month != null);

  useEffect(() => {
    if (month == null) { setBirthdays([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    ChapterBirthdaysService.getForMonth(month)
      .then(list => { if (!cancelled) setBirthdays(list); })
      // Widget is optional: on failure (already logged by the service) show no birthdays.
      .catch(() => { if (!cancelled) setBirthdays([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  return { birthdays, loading };
}
