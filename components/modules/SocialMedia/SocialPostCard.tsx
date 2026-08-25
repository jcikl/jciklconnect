import React from 'react';
import { ChevronRight, Clock, Send, Sparkles } from 'lucide-react';
import { Button } from '../../ui/Common';
import type { SocialPost } from '../../../types/socialPost';
import { SOCIAL_POST_PLATFORM_LABELS, SOCIAL_POST_STATUS_LABELS } from '../../../types/socialPost';
import { PLATFORM_ICONS, STATUS_COLORS, formatSocialDate, formatSocialDateTime } from './socialMediaUi';

interface SocialPostCardProps {
  post: SocialPost;
  isBod: boolean;
  onClick: () => void;
  onSubmit: (post: SocialPost) => void;
}

export const SocialPostCard: React.FC<SocialPostCardProps> = ({ post, isBod, onClick, onSubmit }) => (
  <div
    className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer group"
    onClick={onClick}
  >
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[post.status]}`}>
            {SOCIAL_POST_STATUS_LABELS[post.status]}
          </span>
          <div className="flex gap-1">
            {post.platforms.map(platform => (
              <span key={platform} className="flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                {PLATFORM_ICONS[platform]} {SOCIAL_POST_PLATFORM_LABELS[platform]}
              </span>
            ))}
          </div>
          {post.aiGenerated && (
            <span className="flex items-center gap-0.5 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
              <Sparkles size={9} /> AI
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-slate-900 truncate">{post.title}</p>
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {post.editedContent ?? post.rawContent}
        </p>
        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
          <span>by {post.submittedByName}</span>
          <span>{formatSocialDate(post.createdAt)}</span>
          {post.scheduledAt && (
            <span className="flex items-center gap-0.5 text-purple-500">
              <Clock size={10} /> {formatSocialDateTime(post.scheduledAt)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!isBod && post.status === 'draft' && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onSubmit(post); }}
            className="text-xs"
          >
            <Send size={12} className="mr-1" /> Submit
          </Button>
        )}
        <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
    </div>
  </div>
);
