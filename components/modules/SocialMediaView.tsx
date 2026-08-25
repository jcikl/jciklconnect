import React, { useState, useMemo } from 'react';
import {
  Share2, Plus, Loader2, Settings,
  LayoutList, Columns, CalendarDays,
} from 'lucide-react';
import { Drawer, Tabs, useToast } from '../ui/Common';
import { AsyncErrorBoundary } from '../ui/ErrorBoundary';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useSocialPosts } from '../../hooks/useSocialPosts';
import { SocialPersonaConfig } from './SocialPersonaConfig';
import { SocialPostCard } from './SocialMedia/SocialPostCard';
import { SocialKanbanView } from './SocialMedia/SocialKanbanView';
import { SocialCalendarView } from './SocialMedia/SocialCalendarView';
import { CreatePostModal } from './SocialMedia/CreatePostModal';
import { ReviewDrawer } from './SocialMedia/ReviewDrawer';
import type { SocialPost, SocialPostStatus, SocialPostCreateInput } from '../../types/socialPost';
import { SOCIAL_POST_STATUS_LABELS } from '../../types/socialPost';

// ── Status helpers ─────────────────────────────────────────────────────────────

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
              <SocialPostCard
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
        <SocialKanbanView
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
        <SocialCalendarView
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
