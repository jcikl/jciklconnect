import React, { useState } from 'react';
import { Button, Modal, Tabs, useToast } from '../../ui/Common';
import { Input, Select, Textarea } from '../../ui/Form';
import type { SocialPostContentType, SocialPostCreateInput, SocialPostPlatform } from '../../../types/socialPost';
import {
  SOCIAL_POST_CONTENT_TYPE_LABELS,
  SOCIAL_POST_PLATFORM_LABELS,
} from '../../../types/socialPost';
import { PLATFORM_ICONS } from './socialMediaUi';
import {
  KeyInformationFields,
  MockupPreview,
  buildReferenceMaterial,
  type KeyInfoValues,
} from './socialPostFormParts';

const ALL_PLATFORMS: SocialPostPlatform[] = ['facebook', 'instagram', 'linkedin', 'xiaohongshu'];
const ALL_CONTENT_TYPES = Object.keys(SOCIAL_POST_CONTENT_TYPE_LABELS) as SocialPostContentType[];

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: SocialPostCreateInput) => Promise<void>;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [activeFormTab, setActiveFormTab] = useState<'event_details' | 'socmed_setting' | 'mock_up'>('event_details');
  const [title, setTitle] = useState('');
  const [keyInfoValues, setKeyInfoValues] = useState<KeyInfoValues>({});
  const [referenceContent, setReferenceContent] = useState('');
  const [contentType, setContentType] = useState<SocialPostContentType>('event_highlight');
  const [platforms, setPlatforms] = useState<SocialPostPlatform[]>(['facebook']);
  const [hashtags, setHashtags] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const togglePlatform = (p: SocialPostPlatform) =>
    setPlatforms(prev => prev.includes(p) ? (prev.length > 1 ? prev.filter(x => x !== p) : prev) : [...prev, p]);

  const sourceMaterial = buildReferenceMaterial(contentType, keyInfoValues, referenceContent);
  const hashtagList = hashtags.split(/[,\s#]+/).map(t => t.trim()).filter(Boolean);

  const reset = () => { setActiveFormTab('event_details'); setTitle(''); setKeyInfoValues({}); setReferenceContent(''); setContentType('event_highlight'); setPlatforms(['facebook']); setHashtags(''); };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!title.trim() || !sourceMaterial.trim()) { showToast('Title and key information are required', 'error'); return; }
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        rawContent: sourceMaterial,
        contentType,
        platforms,
        hashtags: hashtagList,
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
      size="lg"
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
        <Tabs
          tabs={[
            { id: 'event_details', label: 'Event details' },
            { id: 'socmed_setting', label: 'Socmed Setting' },
            { id: 'mock_up', label: 'Mock up' },
          ]}
          activeTab={activeFormTab}
          onTabChange={tab => setActiveFormTab(tab as typeof activeFormTab)}
          fullWidth
          mobileFallback="pill"
        />

        {activeFormTab === 'event_details' && (
          <div className="space-y-4">
            <Input label="Title *" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. JCI KL Business Mixer Recap" />
            <Select
              label="Content Type"
              value={contentType}
              onChange={e => { setContentType(e.target.value as SocialPostContentType); setKeyInfoValues({}); }}
              options={ALL_CONTENT_TYPES.map(type => ({ value: type, label: SOCIAL_POST_CONTENT_TYPE_LABELS[type] }))}
            />
            <KeyInformationFields
              contentType={contentType}
              values={keyInfoValues}
              onChange={(field, value) => setKeyInfoValues(prev => ({ ...prev, [field]: value }))}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reference Content</label>
              <Textarea
                value={referenceContent}
                onChange={e => setReferenceContent(e.target.value)}
                placeholder="Paste poster copy, draft notes, links, photo/video context, or any extra details here."
                rows={4}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Optional supporting material. AI will use key information and reference content as source material.
              </p>
            </div>
            <Input
              label="Hashtags (optional)"
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder="#JCIKL #Leadership (comma or space separated)"
            />
          </div>
        )}

        {activeFormTab === 'socmed_setting' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Platform</label>
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Edited Caption</label>
              <Textarea
                value=""
                onChange={() => undefined}
                placeholder="Edited caption will be generated or edited during review."
                rows={6}
                disabled
              />
            </div>
          </div>
        )}

        {activeFormTab === 'mock_up' && (
          <MockupPreview
            title={title}
            platforms={platforms}
            activePlatform={platforms[0]}
            contentType={contentType}
            caption={sourceMaterial}
            hashtags={hashtagList}
          />
        )}

        <p className="text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
          Your reference content will be reviewed by our BOD team. They may edit it or generate platform-specific AI captions before scheduling.
        </p>
      </div>
    </Modal>
  );
};
