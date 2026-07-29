export type SisterChapterType = 'sister_lo' | 'apicc';

export const SISTER_CHAPTER_TYPE_LABELS: Record<SisterChapterType, string> = {
  sister_lo: 'Sister Chapter',
  apicc: 'Asia Pacific International City Council (APICC)',
};

export interface SisterChapter {
  id: string;          // also the loId value used in members.loId
  name: string;        // e.g. "JCI Singapore"
  country: string;
  type: SisterChapterType[];
  flagEmoji?: string;
  logoUrl?: string;
  partnerSince?: string;
  website?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
