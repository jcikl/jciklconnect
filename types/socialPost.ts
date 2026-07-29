export type SocialPostStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'rejected';

export type SocialPostPlatform = 'facebook' | 'instagram' | 'linkedin' | 'xiaohongshu';

export const SOCIAL_POST_STATUS_LABELS: Record<SocialPostStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  rejected: 'Rejected',
};

export const SOCIAL_POST_PLATFORM_LABELS: Record<SocialPostPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  xiaohongshu: 'Little Red Book',
};

export interface SocialPost {
  id: string;
  title: string;
  rawContent: string;
  editedContent?: string;
  platformContent?: Partial<Record<SocialPostPlatform, string>>;
  platforms: SocialPostPlatform[];
  status: SocialPostStatus;
  submittedBy: string;
  submittedByName: string;
  reviewedBy?: string;
  rejectionReason?: string;
  scheduledAt?: string;
  publishedAt?: string;
  imageUrls?: string[];
  linkedEventId?: string;
  linkedEventName?: string;
  hashtags?: string[];
  aiGenerated?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SocialPostCreateInput {
  title: string;
  rawContent: string;
  platforms: SocialPostPlatform[];
  imageUrls?: string[];
  linkedEventId?: string;
  linkedEventName?: string;
  hashtags?: string[];
}
