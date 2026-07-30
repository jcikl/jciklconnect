import React, { useState, useMemo } from 'react';
import {
  Share2, Plus, X, Check, ChevronRight, Sparkles, Facebook,
  Clock, Eye, Send, RotateCcw, Calendar, Megaphone, Loader2, Settings, Zap,
} from 'lucide-react';
import { Button, Modal, Badge, Drawer, useToast } from '../ui/Common';
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

const TONE_OPTIONS = [
  { value: 'professional and engaging', label: 'Professional & Engaging' },
  { value: 'fun and energetic', label: 'Fun & Energetic' },
  { value: 'inspiring and motivational', label: 'Inspiring & Motivational' },
  { value: 'informative and concise', label: 'Informative & Concise' },
];

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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Share2 size={20} className="text-jci-blue" /> Social Media
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBod ? 'Review and publish member-submitted content.' : 'Submit content for the JCI KL official social media pages.'}
          </p>
        </div>
        {isBod && (
          <button
            onClick={() => setPersonaDrawerOpen(true)}
            aria-label="AI Personas"
            className="p-2 rounded-xl text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors shrink-0"
          >
            <Settings size={16} />
          </button>
        )}
      </div>

      {/* Tabs */}
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

      {/* Post list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
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
            <p className="text-xs text-slate-500 mb-4">
              Configure the AI writing style for each platform. These prompts are used when BOD clicks "AI Rewrite" in the review drawer.
            </p>
            <SocialPersonaConfig />
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
  onDelete: () => Promise<void>;
}> = ({ post, isBod, isAdmin, memberId, onClose, onSubmitForReview, onApprove, onReject, onSchedule, onMarkPublished, onUpdateContent, onUpdatePlatformContent, onDelete }) => {
  const isMultiPlatform = post.platforms.length > 1;
  const [activePlatform, setActivePlatform] = useState<SocialPostPlatform>(post.platforms[0]);
  const [editedContent, setEditedContent] = useState(post.editedContent ?? post.rawContent);
  const [platformContent, setPlatformContent] = useState<Partial<Record<SocialPostPlatform, string>>>(post.platformContent ?? {});
  const [tone, setTone] = useState('professional and engaging');
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
        persona?.defaultTone ?? tone,
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
            persona?.defaultTone ?? tone,
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

  const isOwner = post.submittedBy === memberId;

  return (
    <Drawer isOpen title={post.title} onClose={onClose} position="bottom" size="xl">
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

        {/* Original content */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Original Content</p>
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap border border-slate-200">
            {post.rawContent}
          </div>
        </div>

        {/* Edited / AI content (BOD editable) */}
        {isBod && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Edited Caption</p>
              <div className="flex items-center gap-2">
                {!isMultiPlatform && (
                  <select
                    value={tone}
                    onChange={e => setTone(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-2 py-1 text-slate-600 bg-white"
                  >
                    {TONE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                )}
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

        {/* Member actions */}
        {!isBod && isOwner && post.status === 'draft' && (
          <div className="border-t border-slate-100 pt-4">
            <Button variant="primary" className="w-full" onClick={() => onSubmitForReview(post)}>
              <Send size={14} className="mr-1.5" /> Submit for Review
            </Button>
          </div>
        )}

        {/* Admin delete */}
        {isAdmin && (
          <div className="border-t border-slate-100 pt-4">
            <Button
              variant="outline"
              className="w-full text-red-500 border-red-200 hover:bg-red-50"
              onClick={onDelete}
              disabled={saving}
            >
              <X size={14} className="mr-1.5" /> Delete Post
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
};
