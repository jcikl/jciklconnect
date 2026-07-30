import React, { useState, useMemo } from 'react';
import {
  Share2, Plus, X, Check, ChevronRight, Sparkles, Facebook,
  Clock, Eye, Send, RotateCcw, Calendar, Megaphone, Loader2, Settings, Zap,
  LayoutList, Columns, CalendarDays, ChevronLeft,
} from 'lucide-react';
import { Button, Modal, Badge, Drawer, useToast } from '../ui/Common';
import { AsyncErrorBoundary } from '../ui/ErrorBoundary';
import { Input, Textarea, Select } from '../ui/Form';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useSocialPosts } from '../../hooks/useSocialPosts';
import { useSocialPersonas } from '../../hooks/useSocialPersonas';
import { SocialPostService } from '../../services/socialPostService';
import { SocialPersonaConfig } from './SocialPersonaConfig';
import type { SocialPost, SocialPostStatus, SocialPostPlatform, SocialPostCreateInput } from '../../types/socialPost';
import { SOCIAL_POST_STATUS_LABELS, SOCIAL_POST_PLATFORM_LABELS } from '../../types/socialPost';

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<SocialPostStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  pending_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-purple-100 text-purple-700',
  published: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const PLATFORM_ICONS: Record<SocialPostPlatform, React.ReactNode> = {
  facebook: <Facebook size={13} />,
  instagram: <Megaphone size={13} />,
  linkedin: <Share2 size={13} />,
  xiaohongshu: <span className="text-[10px] font-black">红</span>,
};


const ALL_PLATFORMS: SocialPostPlatform[] = ['facebook', 'instagram', 'linkedin', 'xiaohongshu'];

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });
}

// ── Tab definition ─────────────────────────────────────────────────────────────

type TabKey = 'all' | SocialPostStatus;

const BOD_TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending_review', label: 'Pending Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
  { key: 'rejected', label: 'Rejected' },
];

const MEMBER_TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All My Posts' },
  { key: 'draft', label: 'Drafts' },
  { key: 'pending_review', label: 'Under Review' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'published', label: 'Published' },
];

// ── Main View ─────────────────────────────────────────────────────────────────

export const SocialMediaView: React.FC = () => {
  const { member, user } = useAuth();
  const { hasPermission } = usePermissions();
  const isBod = hasPermission('canManageEvents'); // Board + Admin + Super_Admin
  const { isAdmin } = usePermissions();
  const { posts, loading, createPost, submitForReview, approvePost, rejectPost, schedulePost, markPublished, updatePost, deletePost, reload } = useSocialPosts(member?.id ?? '', isBod);
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [personaDrawerOpen, setPersonaDrawerOpen] = useState(false);

  const tabs = isBod ? BOD_TABS : MEMBER_TABS;

  const filtered = useMemo(() => {
    if (activeTab === 'all') return posts;
    return posts.filter(p => p.status === activeTab);
  }, [posts, activeTab]);

  const handleCreate = async (input: SocialPostCreateInput) => {
    if (!member) return;
    try {
      await createPost(input, { id: member.id, name: member.general?.name ?? member.id });
      setCreateOpen(false);
      showToast('Draft saved', 'success');
    } catch {
      showToast('Failed to save draft', 'error');
    }
  };

  const handleSubmitForReview = async (post: SocialPost) => {
    try {
      await submitForReview(post);
      if (selectedPost?.id === post.id) setSelectedPost(p => p ? { ...p, status: 'pending_review' } : p);
      showToast('Submitted for review', 'success');
    } catch {
      showToast('Failed to submit', 'error');
    }
  };

  const counts: Partial<Record<TabKey, number>> = useMemo(() => {
    const c: Partial<Record<TabKey, number>> = {};
    posts.forEach(p => { c[p.status] = (c[p.status] ?? 0) + 1; });
    c.all = posts.length;
    return c;
  }, [posts]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Share2 size={20} className="text-jci-blue" /> Social Media
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBod ? 'Review and publish member-submitted content.' : 'Submit content for the JCI KL official social media pages.'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            {([
              { mode: 'list' as const, icon: <LayoutList size={14} />, label: 'List' },
              { mode: 'kanban' as const, icon: <Columns size={14} />, label: 'Kanban' },
              { mode: 'calendar' as const, icon: <CalendarDays size={14} />, label: 'Calendar' },
            ]).map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                aria-label={label}
                className={`p-1.5 rounded-md transition-colors ${viewMode === mode ? 'bg-white text-jci-blue shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {icon}
              </button>
            ))}
          </div>
          {isBod && (
            <button
              onClick={() => setPersonaDrawerOpen(true)}
              aria-label="AI Personas"
              className="p-2 rounded-xl text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
            >
              <Settings size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Status tabs — hidden in kanban/calendar (kanban shows all columns, calendar is date-based) */}
      {viewMode === 'list' && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-jci-blue text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
              {(counts[tab.key] ?? 0) > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/20' : 'bg-slate-200'}`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Views */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : viewMode === 'list' ? (
        filtered.length === 0 ? (
          <div className="text-center py-14 border-2 border-dashed border-slate-200 rounded-xl">
            <Share2 size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No posts here</p>
            <button onClick={() => setCreateOpen(true)} className="mt-2 text-xs text-jci-blue hover:underline">
              Create your first post →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => setCreateOpen(true)}
              className="w-full flex items-center gap-3 bg-white border border-dashed border-jci-blue/40 hover:border-jci-blue hover:bg-jci-blue/5 rounded-xl px-4 py-3 transition-colors group"
            >
              <div className="w-7 h-7 rounded-full bg-jci-blue/10 group-hover:bg-jci-blue/20 flex items-center justify-center flex-shrink-0 transition-colors">
                <Plus size={15} className="text-jci-blue" />
              </div>
              <span className="text-sm font-semibold text-jci-blue">New Post</span>
            </button>
            {filtered.map(post => (
              <PostCard
                key={post.id}
                post={post}
                isBod={isBod}
                onClick={() => setSelectedPost(post)}
                onSubmit={handleSubmitForReview}
              />
            ))}
          </div>
        )
      ) : viewMode === 'kanban' ? (
        <KanbanView
          posts={posts}
          isBod={isBod}
          onOpenCreate={() => setCreateOpen(true)}
          onSelect={setSelectedPost}
          onSubmit={handleSubmitForReview}
          onStatusChange={async (post, newStatus) => {
            await updatePost(post.id, { status: newStatus });
          }}
        />
      ) : (
        <CalendarView
          posts={posts}
          onSelect={setSelectedPost}
        />
      )}

      {/* Create modal */}
      <CreatePostModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      {/* AI Personas drawer */}
      {isBod && (
        <Drawer isOpen={personaDrawerOpen} title="AI Personas" onClose={() => setPersonaDrawerOpen(false)} position="bottom" size="xl">
          <div className="pb-6">
            <AsyncErrorBoundary>
              {personaDrawerOpen && <SocialPersonaConfig />}
            </AsyncErrorBoundary>
          </div>
        </Drawer>
      )}

      {/* Review / Edit drawer */}
      {selectedPost && (
        <ReviewDrawer
          post={selectedPost}
          isBod={isBod}
          isAdmin={isAdmin}
          memberId={member?.id ?? ''}
          onClose={() => setSelectedPost(null)}
          onSubmitForReview={handleSubmitForReview}
          onApprove={async (editedContent) => {
            try {
              await approvePost(selectedPost, member?.id ?? '', editedContent);
              setSelectedPost(p => p ? { ...p, status: 'approved', editedContent } : p);
              showToast('Post approved', 'success');
            } catch { showToast('Failed to approve', 'error'); }
          }}
          onReject={async (reason) => {
            try {
              await rejectPost(selectedPost, member?.id ?? '', reason);
              setSelectedPost(p => p ? { ...p, status: 'rejected', rejectionReason: reason } : p);
              showToast('Post rejected', 'success');
            } catch { showToast('Failed to reject', 'error'); }
          }}
          onSchedule={async (scheduledAt) => {
            try {
              await schedulePost(selectedPost, scheduledAt);
              setSelectedPost(p => p ? { ...p, status: 'scheduled', scheduledAt } : p);
              showToast('Post scheduled', 'success');
            } catch { showToast('Failed to schedule', 'error'); }
          }}
          onMarkPublished={async () => {
            try {
              await markPublished(selectedPost);
              setSelectedPost(p => p ? { ...p, status: 'published' } : p);
              showToast('Marked as published', 'success');
            } catch { showToast('Failed to mark published', 'error'); }
          }}
          onUpdateContent={async (editedContent) => {
            try {
              await updatePost(selectedPost.id, { editedContent });
              setSelectedPost(p => p ? { ...p, editedContent } : p);
            } catch { showToast('Failed to save', 'error'); }
          }}
          onUpdatePlatformContent={async (platformContent) => {
            try {
              await updatePost(selectedPost.id, { platformContent, aiGenerated: true });
              setSelectedPost(p => p ? { ...p, platformContent, aiGenerated: true } : p);
            } catch { showToast('Failed to save', 'error'); }
          }}
          onUpdateDraft={async (updates) => {
            try {
              await updatePost(selectedPost.id, updates);
              setSelectedPost(p => p ? { ...p, ...updates } : p);
            } catch { showToast('Failed to save draft', 'error'); }
          }}
          onDelete={async () => {
            try {
              await deletePost(selectedPost.id);
              setSelectedPost(null);
              showToast('Post deleted', 'success');
            } catch { showToast('Failed to delete', 'error'); }
          }}
        />
      )}
    </div>
  );
};

// ── Post card ─────────────────────────────────────────────────────────────────

const PostCard: React.FC<{
  post: SocialPost;
  isBod: boolean;
  onClick: () => void;
  onSubmit: (post: SocialPost) => void;
}> = ({ post, isBod, onClick, onSubmit }) => (
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
            {post.platforms.map(p => (
              <span key={p} className="flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                {PLATFORM_ICONS[p]} {SOCIAL_POST_PLATFORM_LABELS[p]}
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
          <span>{formatDate(post.createdAt)}</span>
          {post.scheduledAt && (
            <span className="flex items-center gap-0.5 text-purple-500">
              <Clock size={10} /> {formatDateTime(post.scheduledAt)}
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

// ── Kanban view ───────────────────────────────────────────────────────────────

const KANBAN_STATUSES: SocialPostStatus[] = ['draft', 'pending_review', 'approved', 'scheduled', 'published', 'rejected'];

const KanbanView: React.FC<{
  posts: SocialPost[];
  isBod: boolean;
  onOpenCreate: () => void;
  onSelect: (post: SocialPost) => void;
  onSubmit: (post: SocialPost) => void;
  onStatusChange: (post: SocialPost, newStatus: SocialPostStatus) => Promise<void>;
}> = ({ posts, isBod, onOpenCreate, onSelect, onSubmit, onStatusChange }) => {
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
    if (!draggingPost || draggingPost.status === targetStatus) { setDraggingId(null); return; }
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
            {/* Column header */}
            <div className={`flex items-center justify-between px-1 py-1 rounded-lg transition-colors ${isDropTarget ? 'bg-jci-blue/8' : ''}`}>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
                {SOCIAL_POST_STATUS_LABELS[status]}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{col.length}</span>
            </div>

            {/* Drop zone indicator */}
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
                    {post.platforms.map(p => (
                      <span key={p} className="text-slate-400">{PLATFORM_ICONS[p]}</span>
                    ))}
                  </div>
                  {post.aiGenerated && <Sparkles size={10} className="text-purple-400" />}
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-slate-400">{formatDate(post.createdAt)}</span>
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

// ── Calendar view (matches EventCalendarView style) ───────────────────────────

const MONTH_ABBR_SM = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DAY_FULL_SM = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const WEEK_DAY_LABELS_SM = ['M','T','W','T','F','S','S'];

function getISOWeekSM(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
}

function isSameDaySM(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildCalendarWeeksSM(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const endOffset   = (7 - ((lastDay.getDay() + 6) % 7) - 1 + 7) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const end   = new Date(year, month, lastDay.getDate() + endOffset);
  const weeks: Date[][] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(week);
  }
  return weeks;
}

const CalendarView: React.FC<{
  posts: SocialPost[];
  onSelect: (post: SocialPost) => void;
}> = ({ posts, onSelect }) => {
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);

  const calendarWeeks = useMemo(
    () => buildCalendarWeeksSM(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  const navigateMonth = (dir: 'prev' | 'next') => {
    setCurrentDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1)); return d; });
  };

  const getPostsForDate = (date: Date) =>
    posts.filter(post => {
      const dateStr = post.scheduledAt ?? post.createdAt;
      return dateStr && isSameDaySM(new Date(dateStr), date);
    });

  const selectedDatePosts = selectedDate ? getPostsForDate(selectedDate) : [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-2 py-3 gap-0.5">
        <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center select-none">
          <span className="text-xl font-black tracking-widest text-slate-900">{MONTH_ABBR_SM[currentDate.getMonth()]}</span>
          <span className="ml-2 text-sm font-medium text-slate-400">{currentDate.getFullYear()}</span>
        </div>
        <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => { setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); }}
          className="ml-1 w-7 h-7 border-2 border-slate-300 rounded-md flex items-center justify-center text-xs font-black text-slate-600 hover:border-jci-blue hover:text-jci-blue transition-colors"
          title="Go to today"
        >
          {today.getDate()}
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-[24px_repeat(7,1fr)] px-2 pb-1 border-b border-slate-100">
        <div />
        {WEEK_DAY_LABELS_SM.map((label, i) => (
          <div key={i} className={`text-center text-[11px] font-bold py-0.5 ${i === 6 ? 'text-red-400' : 'text-slate-400'}`}>{label}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="px-2 pt-1 pb-2">
        {calendarWeeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-[24px_repeat(7,1fr)] mb-0.5">
            <div className="flex items-start justify-center pt-2.5">
              <span className="text-[9px] text-slate-300 font-bold select-none leading-none">{getISOWeekSM(week[0])}</span>
            </div>
            {week.map((date, di) => {
              const dayPosts  = getPostsForDate(date);
              const isToday_  = isSameDaySM(date, today);
              const isSelected = !!selectedDate && isSameDaySM(date, selectedDate);
              const inMonth   = date.getMonth() === currentDate.getMonth();
              const isSunday  = di === 6;
              return (
                <div
                  key={di}
                  className="flex flex-col items-center pt-1 pb-0.5 cursor-pointer group"
                  onClick={() => setSelectedDate(date)}
                >
                  <div className={[
                    'w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-bold transition-colors leading-none mb-0.5',
                    isToday_ ? 'bg-jci-blue text-white'
                      : isSelected ? 'bg-slate-200 text-slate-900'
                      : isSunday ? (inMonth ? 'text-red-400 group-hover:bg-red-50' : 'text-red-200')
                      : inMonth ? 'text-slate-800 group-hover:bg-slate-100' : 'text-slate-300',
                  ].join(' ')}>
                    {date.getDate()}
                  </div>
                  <div className="w-full px-0.5 space-y-0.5">
                    {dayPosts.slice(0, 2).map(post => (
                      <div
                        key={post.id}
                        onClick={e => { e.stopPropagation(); onSelect(post); }}
                        className={`w-full text-[8px] font-semibold truncate px-1 py-[1px] rounded-sm leading-tight cursor-pointer ${STATUS_COLORS[post.status]} ${!inMonth ? 'opacity-40' : ''}`}
                        title={post.title}
                      >
                        {post.title}
                      </div>
                    ))}
                    {dayPosts.length > 2 && (
                      <span className="text-[8px] text-slate-400 pl-0.5 leading-none">+{dayPosts.length - 2}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected date panel */}
      {selectedDate && (
        <div className="border-t border-slate-100">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/70">
            <span className="text-base font-black text-slate-900">{selectedDate.getDate()}</span>
            <span className="text-sm font-semibold text-slate-400">{DAY_FULL_SM[selectedDate.getDay()]}</span>
            {isSameDaySM(selectedDate, today) && (
              <span className="ml-auto text-[10px] font-bold bg-jci-blue/10 text-jci-blue px-2 py-0.5 rounded-full">Today</span>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto">
            {selectedDatePosts.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-5">No posts on this day</p>
            ) : (
              selectedDatePosts.map(post => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                  onClick={() => onSelect(post)}
                >
                  <div className={`w-1 h-10 rounded-full shrink-0 ${STATUS_COLORS[post.status].replace('text-', 'bg-').split(' ')[0]}`} />
                  <div className={`w-10 h-10 rounded-xl shrink-0 flex flex-col items-center justify-center text-center ${STATUS_COLORS[post.status]}`}>
                    <span className="text-[8px] font-bold leading-none uppercase">{MONTH_ABBR_SM[selectedDate.getMonth()]}</span>
                    <span className="text-sm font-black leading-tight">{selectedDate.getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{post.title}</p>
                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[post.status]}`}>{SOCIAL_POST_STATUS_LABELS[post.status]}</span>
                      {post.platforms.map(p => <span key={p}>{PLATFORM_ICONS[p]}</span>)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Create modal ──────────────────────────────────────────────────────────────

const CreatePostModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: SocialPostCreateInput) => Promise<void>;
}> = ({ isOpen, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [platforms, setPlatforms] = useState<SocialPostPlatform[]>(['facebook']);
  const [hashtags, setHashtags] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const togglePlatform = (p: SocialPostPlatform) =>
    setPlatforms(prev => prev.includes(p) ? (prev.length > 1 ? prev.filter(x => x !== p) : prev) : [...prev, p]);

  const reset = () => { setTitle(''); setRawContent(''); setPlatforms(['facebook']); setHashtags(''); };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!title.trim() || !rawContent.trim()) { showToast('Title and content are required', 'error'); return; }
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        rawContent: rawContent.trim(),
        platforms,
        hashtags: hashtags.split(/[,\s#]+/).map(t => t.trim()).filter(Boolean),
      });
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Post"
      size="md"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="outline" className="flex-1" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save Draft'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Title *" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. JCI KL Business Mixer Recap" />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Content *</label>
          <Textarea
            value={rawContent}
            onChange={e => setRawContent(e.target.value)}
            placeholder="Write your post content here. Our team will review and optionally polish it with AI before publishing."
            rows={5}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Target Platforms</label>
          <div className="flex gap-2 flex-wrap">
            {ALL_PLATFORMS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors ${
                  platforms.includes(p)
                    ? 'border-jci-blue bg-jci-blue/5 text-jci-blue'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {PLATFORM_ICONS[p]} {SOCIAL_POST_PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <Input
          label="Hashtags (optional)"
          value={hashtags}
          onChange={e => setHashtags(e.target.value)}
          placeholder="#JCIKL #Leadership (comma or space separated)"
        />
        <p className="text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
          Your draft will be reviewed by our BOD team. They may edit or AI-rewrite the content before scheduling.
        </p>
      </div>
    </Modal>
  );
};

// ── Review drawer (BOD + member detail view) ──────────────────────────────────

const ReviewDrawer: React.FC<{
  post: SocialPost;
  isBod: boolean;
  isAdmin: boolean;
  memberId: string;
  onClose: () => void;
  onSubmitForReview: (post: SocialPost) => void;
  onApprove: (editedContent: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onSchedule: (scheduledAt: string) => Promise<void>;
  onMarkPublished: () => Promise<void>;
  onUpdateContent: (content: string) => Promise<void>;
  onUpdatePlatformContent: (platformContent: Partial<Record<SocialPostPlatform, string>>) => Promise<void>;
  onUpdateDraft: (updates: { title: string; rawContent: string; platforms: SocialPostPlatform[]; hashtags: string[] }) => Promise<void>;
  onDelete: () => Promise<void>;
}> = ({ post, isBod, isAdmin, memberId, onClose, onSubmitForReview, onApprove, onReject, onSchedule, onMarkPublished, onUpdateContent, onUpdatePlatformContent, onUpdateDraft, onDelete }) => {
  const isOwner = post.submittedBy === memberId;
  const canEditDraft = post.status === 'draft' && (isBod || isOwner);

  const isMultiPlatform = post.platforms.length > 1;
  const [activePlatform, setActivePlatform] = useState<SocialPostPlatform>(post.platforms[0]);
  const [editedContent, setEditedContent] = useState(post.editedContent ?? post.rawContent);
  const [platformContent, setPlatformContent] = useState<Partial<Record<SocialPostPlatform, string>>>(post.platformContent ?? {});

  // Draft editing state
  const [draftTitle, setDraftTitle] = useState(post.title);
  const [draftContent, setDraftContent] = useState(post.rawContent);
  const [draftPlatforms, setDraftPlatforms] = useState<SocialPostPlatform[]>(post.platforms);
  const [draftHashtags, setDraftHashtags] = useState(post.hashtags?.join(', ') ?? '');
  const [draftSaving, setDraftSaving] = useState(false);

  const saveDraft = async () => {
    setDraftSaving(true);
    try {
      await onUpdateDraft({
        title: draftTitle.trim() || post.title,
        rawContent: draftContent.trim() || post.rawContent,
        platforms: draftPlatforms,
        hashtags: draftHashtags.split(/[,\s#]+/).map(t => t.trim()).filter(Boolean),
      });
    } finally {
      setDraftSaving(false);
    }
  };

  const toggleDraftPlatform = (p: SocialPostPlatform) =>
    setDraftPlatforms(prev => prev.includes(p) ? (prev.length > 1 ? prev.filter(x => x !== p) : prev) : [...prev, p]);

  const [rewriting, setRewriting] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(post.scheduledAt?.slice(0, 16) ?? '');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const { getPersona } = useSocialPersonas();

  const activePlatformContent = isMultiPlatform
    ? (platformContent[activePlatform] ?? post.rawContent)
    : editedContent;

  const setActivePlatformContent = (value: string) => {
    if (isMultiPlatform) {
      setPlatformContent(prev => ({ ...prev, [activePlatform]: value }));
    } else {
      setEditedContent(value);
    }
  };

  const handleAiRewrite = async () => {
    setRewriting(true);
    try {
      const persona = getPersona(activePlatform);
      const result = await SocialPostService.aiRewrite(
        post.rawContent,
        SOCIAL_POST_PLATFORM_LABELS[activePlatform],
        persona?.defaultTone ?? 'professional and engaging',
        persona?.systemPrompt,
      );
      if (isMultiPlatform) {
        const updated = { ...platformContent, [activePlatform]: result };
        setPlatformContent(updated);
        await onUpdatePlatformContent(updated);
      } else {
        setEditedContent(result);
        await onUpdateContent(result);
      }
      showToast(`AI rewrite complete for ${SOCIAL_POST_PLATFORM_LABELS[activePlatform]}`, 'success');
    } catch {
      showToast('AI rewrite failed', 'error');
    } finally {
      setRewriting(false);
    }
  };

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    try {
      const results = await Promise.allSettled(
        post.platforms.map(async (platform) => {
          const persona = getPersona(platform);
          const result = await SocialPostService.aiRewrite(
            post.rawContent,
            SOCIAL_POST_PLATFORM_LABELS[platform],
            persona?.defaultTone ?? 'professional and engaging',
            persona?.systemPrompt,
          );
          return { platform, result };
        })
      );
      const updated: Partial<Record<SocialPostPlatform, string>> = { ...platformContent };
      let successCount = 0;
      results.forEach(r => {
        if (r.status === 'fulfilled') { updated[r.value.platform] = r.value.result; successCount++; }
      });
      setPlatformContent(updated);
      await onUpdatePlatformContent(updated);
      showToast(`Generated ${successCount}/${post.platforms.length} platform versions`, 'success');
    } catch {
      showToast('Failed to generate all', 'error');
    } finally {
      setGeneratingAll(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try { await onApprove(isMultiPlatform ? (platformContent[activePlatform] ?? editedContent) : editedContent); }
    finally { setSaving(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { showToast('Please provide a reason', 'error'); return; }
    setSaving(true);
    try { await onReject(rejectReason); setShowRejectForm(false); }
    finally { setSaving(false); }
  };

  const handleSchedule = async () => {
    if (!scheduledAt) { showToast('Please select a date and time', 'error'); return; }
    setSaving(true);
    try { await onSchedule(new Date(scheduledAt).toISOString()); setShowScheduleForm(false); }
    finally { setSaving(false); }
  };

  const drawerFooter = (canEditDraft || isAdmin) ? (
    <div className="flex items-center justify-between">
      <div>
        {isAdmin && (
          <Button
            variant="outline"
            className="px-3 text-red-500 border-red-200 hover:bg-red-50"
            onClick={onDelete}
            disabled={saving}
            aria-label="Delete post"
          >
            <X size={16} />
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        {canEditDraft && (
          <Button variant="outline" onClick={saveDraft} disabled={draftSaving}>
            {draftSaving ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
            Save Draft
          </Button>
        )}
        {canEditDraft && (
          <Button
            variant="primary"
            disabled={draftSaving}
            onClick={async () => {
              await saveDraft();
              onSubmitForReview({
                ...post,
                title: draftTitle.trim() || post.title,
                rawContent: draftContent.trim() || post.rawContent,
                platforms: draftPlatforms,
                hashtags: draftHashtags.split(/[,\s#]+/).map(t => t.trim()).filter(Boolean),
              });
            }}
          >
            <Send size={14} className="mr-1.5" /> Submit for Review
          </Button>
        )}
      </div>
    </div>
  ) : undefined;

  return (
    <Drawer isOpen title={post.title} onClose={onClose} position="bottom" size="xl" footer={drawerFooter}>
      <div className="space-y-5 pb-6">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[post.status]}`}>
            {SOCIAL_POST_STATUS_LABELS[post.status]}
          </span>
          {post.platforms.map(p => (
            <span key={p} className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {PLATFORM_ICONS[p]} {SOCIAL_POST_PLATFORM_LABELS[p]}
            </span>
          ))}
          {post.aiGenerated && (
            <span className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              <Sparkles size={9} /> AI Enhanced
            </span>
          )}
        </div>

        <div className="text-xs text-slate-500 flex gap-4">
          <span>Submitted by <strong className="text-slate-700">{post.submittedByName}</strong></span>
          <span>{formatDate(post.createdAt)}</span>
        </div>

        {/* Rejection reason */}
        {post.status === 'rejected' && post.rejectionReason && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-red-700 mb-0.5">Rejected — feedback from BOD:</p>
            <p className="text-sm text-red-600">{post.rejectionReason}</p>
          </div>
        )}

        {/* Draft editing form (member owner or BOD) / read-only original content */}
        {canEditDraft ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Title</label>
              <input
                type="text"
                value={draftTitle}
                onChange={e => setDraftTitle(e.target.value)}
                onBlur={saveDraft}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 outline-none"
                placeholder="Post title…"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Platforms</label>
              <div className="flex flex-wrap gap-2">
                {(ALL_PLATFORMS).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleDraftPlatform(p)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                      draftPlatforms.includes(p)
                        ? 'border-jci-blue bg-blue-50 text-jci-blue'
                        : 'border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {PLATFORM_ICONS[p]} {SOCIAL_POST_PLATFORM_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Content</label>
              <textarea
                value={draftContent}
                onChange={e => setDraftContent(e.target.value)}
                onBlur={saveDraft}
                rows={6}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 outline-none resize-none"
                placeholder="Write your post content…"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Hashtags</label>
              <input
                type="text"
                value={draftHashtags}
                onChange={e => setDraftHashtags(e.target.value)}
                onBlur={saveDraft}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 outline-none"
                placeholder="#jcikl, #leadership, #community"
              />
              <p className="text-[10px] text-slate-400 mt-1">Separate with commas or spaces</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Original Content</p>
            <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap border border-slate-200">
              {post.rawContent}
            </div>
          </div>
        )}

        {/* Edited / AI content (BOD editable) */}
        {isBod && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Edited Caption</p>
              <div className="flex items-center gap-2">
                {isMultiPlatform && (
                  <button
                    onClick={handleGenerateAll}
                    disabled={generatingAll || rewriting}
                    className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-200 transition-colors disabled:opacity-50"
                  >
                    {generatingAll ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    {generatingAll ? 'Generating…' : 'Generate All'}
                  </button>
                )}
                <button
                  onClick={handleAiRewrite}
                  disabled={rewriting || generatingAll}
                  className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition-colors disabled:opacity-50"
                >
                  {rewriting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {rewriting ? 'Rewriting…' : 'AI Rewrite'}
                </button>
              </div>
            </div>

            {/* Platform tabs for multi-platform posts */}
            {isMultiPlatform && (
              <div className="flex gap-1 mb-2">
                {post.platforms.map(p => (
                  <button
                    key={p}
                    onClick={() => setActivePlatform(p)}
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                      activePlatform === p
                        ? 'border-purple-300 bg-purple-50 text-purple-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {PLATFORM_ICONS[p]} {SOCIAL_POST_PLATFORM_LABELS[p]}
                    {platformContent[p] && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />}
                  </button>
                ))}
                <span className="text-[10px] text-slate-400 self-center ml-1">
                  {post.platforms.filter(p => platformContent[p]).length}/{post.platforms.length} generated
                </span>
              </div>
            )}

            <textarea
              value={activePlatformContent}
              onChange={e => setActivePlatformContent(e.target.value)}
              onBlur={() => {
                if (isMultiPlatform) onUpdatePlatformContent({ ...platformContent, [activePlatform]: activePlatformContent });
                else onUpdateContent(editedContent);
              }}
              rows={6}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-none"
            />
            {post.hashtags && post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {post.hashtags.map(h => (
                  <span key={h} className="text-[11px] text-jci-blue bg-jci-blue/8 px-2 py-0.5 rounded-full">#{h}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Member: non-editable view of edited content */}
        {!isBod && post.editedContent && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">BOD Edited Version</p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap">
              {post.editedContent}
            </div>
          </div>
        )}

        {/* Schedule info */}
        {post.scheduledAt && (
          <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 rounded-xl px-4 py-3 border border-purple-200">
            <Calendar size={15} />
            <span>Scheduled for <strong>{formatDateTime(post.scheduledAt)}</strong></span>
          </div>
        )}

        {/* BOD actions */}
        {isBod && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            {post.status === 'pending_review' && (
              <div className="flex gap-3">
                <Button variant="primary" className="flex-1" onClick={handleApprove} disabled={saving}>
                  <Check size={14} className="mr-1.5" /> Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-red-500 border-red-200 hover:bg-red-50"
                  onClick={() => setShowRejectForm(true)}
                  disabled={saving}
                >
                  <X size={14} className="mr-1.5" /> Reject
                </Button>
              </div>
            )}
            {post.status === 'approved' && (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowScheduleForm(true)} disabled={saving}>
                  <Clock size={14} className="mr-1.5" /> Schedule
                </Button>
                <Button variant="primary" className="flex-1" onClick={onMarkPublished} disabled={saving}>
                  <Eye size={14} className="mr-1.5" /> Mark Published
                </Button>
              </div>
            )}
            {post.status === 'scheduled' && (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowScheduleForm(true)} disabled={saving}>
                  <RotateCcw size={14} className="mr-1.5" /> Reschedule
                </Button>
                <Button variant="primary" className="flex-1" onClick={onMarkPublished} disabled={saving}>
                  <Eye size={14} className="mr-1.5" /> Mark Published
                </Button>
              </div>
            )}

            {/* Reject form */}
            {showRejectForm && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-red-700">Rejection reason (sent to member)</p>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Please revise the tone — too promotional. Also add the event date."
                  className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowRejectForm(false)}>Cancel</Button>
                  <Button variant="primary" size="sm" onClick={handleReject} disabled={saving}
                    className="bg-red-500 hover:bg-red-600 focus:ring-red-500">
                    Confirm Reject
                  </Button>
                </div>
              </div>
            )}

            {/* Schedule form */}
            {showScheduleForm && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-purple-700">Schedule publishing time</p>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="w-full rounded-lg border border-purple-300 px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowScheduleForm(false)}>Cancel</Button>
                  <Button variant="primary" size="sm" onClick={handleSchedule} disabled={saving}>
                    Confirm Schedule
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </Drawer>
  );
};
