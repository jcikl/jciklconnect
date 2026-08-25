import React, { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Button, useToast } from '../../ui/Common';
import type { SocialPost, SocialPostStatus } from '../../../types/socialPost';
import { SOCIAL_POST_STATUS_LABELS } from '../../../types/socialPost';
import { PLATFORM_ICONS, STATUS_COLORS, formatSocialDate } from './socialMediaUi';

const KANBAN_STATUSES: SocialPostStatus[] = ['draft', 'pending_review', 'approved', 'scheduled', 'published', 'rejected'];

interface SocialKanbanViewProps {
  posts: SocialPost[];
  isBod: boolean;
  onOpenCreate: () => void;
  onSelect: (post: SocialPost) => void;
  onSubmit: (post: SocialPost) => void;
  onStatusChange: (post: SocialPost, newStatus: SocialPostStatus) => Promise<void>;
}

export const SocialKanbanView: React.FC<SocialKanbanViewProps> = ({
  posts,
  isBod,
  onOpenCreate,
  onSelect,
  onSubmit,
  onStatusChange,
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<SocialPostStatus | null>(null);
  const { showToast } = useToast();

  const draggingPost = draggingId ? posts.find(p => p.id === draggingId) ?? null : null;

  const handleDragStart = (e: React.DragEvent, post: SocialPost) => {
    setDraggingId(post.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: SocialPostStatus) => {
    e.preventDefault();
    setDropTarget(null);
    if (!draggingPost || draggingPost.status === targetStatus) {
      setDraggingId(null);
      return;
    }
    try {
      await onStatusChange(draggingPost, targetStatus);
      showToast(`Moved to ${SOCIAL_POST_STATUS_LABELS[targetStatus]}`, 'success');
    } catch {
      showToast('Failed to move post', 'error');
    }
    setDraggingId(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4">
      {KANBAN_STATUSES.map(status => {
        const col = posts.filter(p => p.status === status);
        const isDropTarget = dropTarget === status && draggingPost?.status !== status;
        return (
          <div
            key={status}
            className="flex-none w-60 flex flex-col gap-2"
            onDragOver={e => { e.preventDefault(); setDropTarget(status); }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={e => handleDrop(e, status)}
          >
            <div className={`flex items-center justify-between px-1 py-1 rounded-lg transition-colors ${isDropTarget ? 'bg-jci-blue/8' : ''}`}>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
                {SOCIAL_POST_STATUS_LABELS[status]}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{col.length}</span>
            </div>

            {isDropTarget && (
              <div className="border-2 border-dashed border-jci-blue/40 rounded-xl py-3 flex items-center justify-center bg-jci-blue/5 text-[11px] text-jci-blue font-semibold">
                Drop here
              </div>
            )}

            {status === 'draft' && (
              <button
                onClick={onOpenCreate}
                className="flex items-center gap-2 border border-dashed border-jci-blue/40 hover:border-jci-blue hover:bg-jci-blue/5 rounded-xl px-3 py-2 transition-colors group"
              >
                <Plus size={13} className="text-jci-blue" />
                <span className="text-xs font-semibold text-jci-blue">New Post</span>
              </button>
            )}

            {col.map(post => (
              <div
                key={post.id}
                draggable
                onDragStart={e => handleDragStart(e, post)}
                onDragEnd={() => { setDraggingId(null); setDropTarget(null); }}
                onClick={() => onSelect(post)}
                className={`bg-white border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-slate-300 hover:shadow-sm transition-all select-none ${
                  draggingId === post.id ? 'opacity-40 border-jci-blue' : 'border-slate-200'
                }`}
              >
                <p className="text-xs font-semibold text-slate-900 line-clamp-2 mb-1">{post.title}</p>
                <p className="text-[11px] text-slate-500 line-clamp-2">{post.rawContent}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex gap-0.5">
                    {post.platforms.map(platform => (
                      <span key={platform} className="text-slate-400">{PLATFORM_ICONS[platform]}</span>
                    ))}
                  </div>
                  {post.aiGenerated && <Sparkles size={10} className="text-purple-400" />}
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-slate-400">{formatSocialDate(post.createdAt)}</span>
                  {!isBod && status === 'draft' && (
                    <button
                      onClick={e => { e.stopPropagation(); onSubmit(post); }}
                      className="text-[10px] font-semibold text-jci-blue hover:underline"
                    >
                      Submit →
                    </button>
                  )}
                </div>
              </div>
            ))}

            {col.length === 0 && !isDropTarget && status !== 'draft' && (
              <div className="border border-dashed border-slate-200 rounded-xl py-6 flex items-center justify-center">
                <span className="text-[11px] text-slate-300">Empty</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
