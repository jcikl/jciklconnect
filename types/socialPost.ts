export type SocialPostStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'rejected';

export type SocialPostPlatform = 'facebook' | 'instagram' | 'linkedin' | 'xiaohongshu';

export type SocialPostContentType =
  | 'recognition'
  | 'member_story'
  | 'event_highlight'
  | 'announcement_teaser'
  | 'educational_value'
  | 'impact_community'
  | 'promotion_recruitment'
  | 'corporate_organisational';

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

export const SOCIAL_POST_CONTENT_TYPE_LABELS: Record<SocialPostContentType, string> = {
  recognition: 'Recognition',
  member_story: 'People / Member Story',
  event_highlight: 'Event Highlight',
  announcement_teaser: 'Announcement / Teaser',
  educational_value: 'Educational / Value',
  impact_community: 'Impact / Community',
  promotion_recruitment: 'Promotion / Recruitment',
  corporate_organisational: 'Corporate / Organisational',
};

export interface SocialPost {
  id: string;
  title: string;
  rawContent: string;
  contentType?: SocialPostContentType;
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
  contentType?: SocialPostContentType;
  platforms: SocialPostPlatform[];
  imageUrls?: string[];
  linkedEventId?: string;
  linkedEventName?: string;
  hashtags?: string[];
}
