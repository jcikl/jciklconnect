import React, { useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Eye,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { Button, Drawer, Tabs, useToast } from '../../ui/Common';
import { Select } from '../../ui/Form';
import { useSocialPersonas } from '../../../hooks/useSocialPersonas';
import { SocialPostService } from '../../../services/socialPostService';
import type { SocialPost, SocialPostContentType, SocialPostPlatform } from '../../../types/socialPost';
import {
  SOCIAL_POST_CONTENT_TYPE_LABELS,
  SOCIAL_POST_PLATFORM_LABELS,
  SOCIAL_POST_STATUS_LABELS,
} from '../../../types/socialPost';
import { PLATFORM_ICONS, STATUS_COLORS, formatSocialDate, formatSocialDateTime } from './socialMediaUi';
import {
  KeyInformationFields,
  MockupPreview,
  ReadonlyField,
  ReadonlyKeyInformation,
  buildReferenceMaterial,
  parseReferenceMaterial,
  type KeyInfoValues,
} from './socialPostFormParts';

const ALL_PLATFORMS: SocialPostPlatform[] = ['facebook', 'instagram', 'linkedin', 'xiaohongshu'];
const ALL_CONTENT_TYPES = Object.keys(SOCIAL_POST_CONTENT_TYPE_LABELS) as SocialPostContentType[];

interface ReviewDrawerProps {
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
  onUpdateDraft: (updates: { title: string; rawContent: string; contentType: SocialPostContentType; platforms: SocialPostPlatform[]; hashtags: string[] }) => Promise<void>;
  onDelete: () => Promise<void>;
}

export const ReviewDrawer: React.FC<ReviewDrawerProps> = ({ post, isBod, isAdmin, memberId, onClose, onSubmitForReview, onApprove, onReject, onSchedule, onMarkPublished, onUpdateContent, onUpdatePlatformContent, onUpdateDraft, onDelete }) => {
  const isOwner = post.submittedBy === memberId;
  const canEditDraft = post.status === 'draft' && (isBod || isOwner);
  const [activeReviewTab, setActiveReviewTab] = useState<'event_details' | 'socmed_setting' | 'mock_up'>('event_details');

  const isMultiPlatform = post.platforms.length > 1;
  const [activePlatform, setActivePlatform] = useState<SocialPostPlatform>(post.platforms[0]);
  const [editedContent, setEditedContent] = useState(post.editedContent ?? post.rawContent);
  const [platformContent, setPlatformContent] = useState<Partial<Record<SocialPostPlatform, string>>>(post.platformContent ?? {});

  const initialDraftContentType = post.contentType ?? 'event_highlight';
  const parsedReference = parseReferenceMaterial(post.rawContent, initialDraftContentType);
  const [draftTitle, setDraftTitle] = useState(post.title);
  const [keyInfoValues, setKeyInfoValues] = useState<KeyInfoValues>(parsedReference.keyInfo);
  const [referenceContent, setReferenceContent] = useState(parsedReference.referenceContent);
  const [draftContentType, setDraftContentType] = useState<SocialPostContentType>(initialDraftContentType);
  const [draftPlatforms, setDraftPlatforms] = useState<SocialPostPlatform[]>(post.platforms);
  const [draftHashtags, setDraftHashtags] = useState(post.hashtags?.join(', ') ?? '');
  const [draftSaving, setDraftSaving] = useState(false);
  const draftSourceMaterial = buildReferenceMaterial(draftContentType, keyInfoValues, referenceContent);

  const saveDraft = async () => {
    setDraftSaving(true);
    try {
      await onUpdateDraft({
        title: draftTitle.trim() || post.title,
        rawContent: draftSourceMaterial.trim() || post.rawContent,
        contentType: draftContentType,
        platforms: draftPlatforms,
        hashtags: draftHashtags.split(/[,\s#]+/).map(t => t.trim()).filter(Boolean),
      });
    } finally {
      setDraftSaving(false);
    }
  };

  const toggleDraftPlatform = (p: SocialPostPlatform) =>
    setDraftPlatforms(prev => prev.includes(p) ? (prev.length > 1 ? prev.filter(x => x !== p) : prev) : [...prev, p]);

  const handleContentTypeChange = async (value: SocialPostContentType) => {
    const nextKeyInfoValues = {};
    setDraftContentType(value);
    setKeyInfoValues(nextKeyInfoValues);
    if (!isBod || canEditDraft) return;
    await onUpdateDraft({
      title: draftTitle.trim() || post.title,
      rawContent: buildReferenceMaterial(value, nextKeyInfoValues, referenceContent).trim() || post.rawContent,
      contentType: value,
      platforms: draftPlatforms,
      hashtags: draftHashtags.split(/[,\s#]+/).map(t => t.trim()).filter(Boolean),
    });
  };

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
        draftSourceMaterial.trim() || post.rawContent,
        SOCIAL_POST_PLATFORM_LABELS[activePlatform],
        persona?.defaultTone ?? 'professional and engaging',
        persona?.systemPrompt,
        draftContentType,
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
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'AI rewrite failed', 'error');
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
            draftSourceMaterial.trim() || post.rawContent,
            SOCIAL_POST_PLATFORM_LABELS[platform],
            persona?.defaultTone ?? 'professional and engaging',
            persona?.systemPrompt,
            draftContentType,
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
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to generate all', 'error');
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
                rawContent: draftSourceMaterial.trim() || post.rawContent,
                contentType: draftContentType,
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
          <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
            {SOCIAL_POST_CONTENT_TYPE_LABELS[draftContentType]}
          </span>
        </div>

        <div className="text-xs text-slate-500 flex gap-4">
          <span>Submitted by <strong className="text-slate-700">{post.submittedByName}</strong></span>
          <span>{formatSocialDate(post.createdAt)}</span>
        </div>

        {post.status === 'rejected' && post.rejectionReason && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-red-700 mb-0.5">Rejected — feedback from BOD:</p>
            <p className="text-sm text-red-600">{post.rejectionReason}</p>
          </div>
        )}

        <Tabs
          tabs={[
            { id: 'event_details', label: 'Event details' },
            { id: 'socmed_setting', label: 'Socmed Setting' },
            { id: 'mock_up', label: 'Mock up' },
          ]}
          activeTab={activeReviewTab}
          onTabChange={tab => setActiveReviewTab(tab as typeof activeReviewTab)}
          fullWidth
          mobileFallback="pill"
        />

        {activeReviewTab === 'event_details' && (
          <div className="space-y-3">
            {canEditDraft ? (
              <>
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Content Type</label>
                  <Select
                    value={draftContentType}
                    onChange={e => handleContentTypeChange(e.target.value as SocialPostContentType)}
                    options={ALL_CONTENT_TYPES.map(type => ({ value: type, label: SOCIAL_POST_CONTENT_TYPE_LABELS[type] }))}
                  />
                </div>
                <KeyInformationFields
                  contentType={draftContentType}
                  values={keyInfoValues}
                  onChange={(field, value) => setKeyInfoValues(prev => ({ ...prev, [field]: value }))}
                  onBlur={saveDraft}
                />
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Reference Content</label>
                  <textarea
                    value={referenceContent}
                    onChange={e => setReferenceContent(e.target.value)}
                    onBlur={saveDraft}
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 outline-none resize-none"
                    placeholder="Paste poster copy, draft notes, links, photo/video context, or any extra details here."
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Optional supporting material. AI treats this as source material, not as the final caption.</p>
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
              </>
            ) : (
              <>
                <ReadonlyField label="Title">{draftTitle || post.title}</ReadonlyField>
                {isBod ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Content Type</label>
                    <Select
                      value={draftContentType}
                      onChange={e => handleContentTypeChange(e.target.value as SocialPostContentType)}
                      options={ALL_CONTENT_TYPES.map(type => ({ value: type, label: SOCIAL_POST_CONTENT_TYPE_LABELS[type] }))}
                    />
                  </div>
                ) : (
                  <ReadonlyField label="Content Type">{SOCIAL_POST_CONTENT_TYPE_LABELS[draftContentType]}</ReadonlyField>
                )}
                <ReadonlyKeyInformation contentType={draftContentType} values={keyInfoValues} />
                <ReadonlyField label="Reference Content">{referenceContent || post.rawContent || '-'}</ReadonlyField>
                <ReadonlyField label="Hashtags">
                  {draftHashtags
                    ? draftHashtags.split(/[,\s#]+/).map(tag => `#${tag}`).join(' ')
                    : '-'}
                </ReadonlyField>
              </>
            )}
          </div>
        )}

        {activeReviewTab === 'socmed_setting' && (
          <div className="space-y-4">
            {canEditDraft && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Platform</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PLATFORMS.map(p => (
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
            )}
            {!canEditDraft && (
              <ReadonlyField label="Platform">
                {post.platforms.map(platform => SOCIAL_POST_PLATFORM_LABELS[platform]).join(', ')}
              </ReadonlyField>
            )}

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

            {!isBod && post.editedContent && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Edited Caption</p>
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap">
                  {post.editedContent}
                </div>
              </div>
            )}

            {!isBod && !post.editedContent && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Edited Caption</p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-400">
                  No edited caption yet.
                </div>
              </div>
            )}
          </div>
        )}

        {activeReviewTab === 'mock_up' && (
          <MockupPreview
            title={draftTitle}
            platforms={draftPlatforms}
            activePlatform={activePlatform}
            contentType={draftContentType}
            caption={activePlatformContent || draftSourceMaterial}
            hashtags={draftHashtags.split(/[,\s#]+/).map(t => t.trim()).filter(Boolean)}
          />
        )}

        {post.scheduledAt && (
          <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 rounded-xl px-4 py-3 border border-purple-200">
            <Calendar size={15} />
            <span>Scheduled for <strong>{formatSocialDateTime(post.scheduledAt)}</strong></span>
          </div>
        )}

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
