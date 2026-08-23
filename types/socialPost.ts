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

export const SOCIAL_POST_CONTENT_TYPE_KEY_FIELDS: Record<SocialPostContentType, string[]> = {
  recognition: [
    'Person name',
    'Role / position',
    'Achievement / award / appointment',
    'Event / organisation',
    'Why this deserves recognition',
    'Meaning for JCI KL / youth leadership',
    'People to tag or thank',
    'Preferred CTA',
  ],
  member_story: [
    'Member name',
    'Before joining JCI',
    'Challenge faced',
    'Reason for joining JCI',
    'Key JCI experience',
    'Turning point',
    'Growth / transformation',
    'Current status',
    'Lesson or inspiration for readers',
    'Preferred CTA',
  ],
  event_highlight: [
    'Event name',
    'Date and venue',
    'Attendance',
    '3 key moments',
    'Speakers / important people',
    'Outcome',
    'What participants gained',
    'Photo / video reference',
    'Next step',
    'Preferred CTA',
  ],
  announcement_teaser: [
    'What will be announced',
    'Target audience',
    'Information that can be revealed',
    'Information to keep secret',
    'Reveal date',
    'Biggest highlight',
    'Why people should care',
    'Preferred CTA',
  ],
  educational_value: [
    'Topic',
    'Target audience',
    'Problem / pain point',
    'Core insight',
    '3-5 practical steps',
    'Common mistakes',
    'Example / experience / data',
    'Save-worthy takeaway',
    'Preferred CTA',
  ],
  impact_community: [
    'Social issue / problem',
    'Project / action',
    'Beneficiaries',
    'Partners',
    'Specific numbers / results',
    'Human story / field moment',
    'Long-term meaning',
    'SDG / community value',
    'Preferred CTA',
  ],
  promotion_recruitment: [
    'Event / recruitment name',
    'Who it is for',
    'Audience pain point',
    'Benefits of joining',
    'Date, time, and venue',
    'Price',
    'Registration link / method',
    'Deadline',
    'Seat limit / urgency',
    'Preferred CTA',
  ],
  corporate_organisational: [
    'Partner / organisation',
    'Meeting / visit / MOU / collaboration',
    'Background',
    'Topics discussed',
    'Concrete outcome',
    'Meaning for members / stakeholders',
    'Next step',
    'Preferred CTA',
  ],
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
