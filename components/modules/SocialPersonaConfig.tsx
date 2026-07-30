import React, { useState } from 'react';
import { Sparkles, Save, Facebook, Megaphone, Share2, RotateCcw } from 'lucide-react';
import { Button, useToast } from '../ui/Common';
import { useSocialPersonas } from '../../hooks/useSocialPersonas';
import { DEFAULT_PERSONAS } from '../../types/socialPersona';
import type { SocialPostPlatform } from '../../types/socialPost';
import { SOCIAL_POST_PLATFORM_LABELS } from '../../types/socialPost';
import { useAuth } from '../../hooks/useAuth';

const PLATFORM_ICONS: Record<SocialPostPlatform, React.ReactNode> = {
  facebook: <Facebook size={15} />,
  instagram: <Megaphone size={15} />,
  linkedin: <Share2 size={15} />,
  xiaohongshu: <span className="text-xs font-black">红</span>,
};

const PLATFORM_COLORS: Record<SocialPostPlatform, { tab: string; active: string }> = {
  facebook:    { tab: 'text-blue-600',  active: 'border-b-2 border-blue-500 text-blue-700 bg-blue-50/60' },
  instagram:   { tab: 'text-pink-600',  active: 'border-b-2 border-pink-500 text-pink-700 bg-pink-50/60' },
  linkedin:    { tab: 'text-sky-600',   active: 'border-b-2 border-sky-500  text-sky-700  bg-sky-50/60'  },
  xiaohongshu: { tab: 'text-red-600',   active: 'border-b-2 border-red-500  text-red-700  bg-red-50/60'  },
};

const TONE_OPTIONS = [
  { value: 'professional and engaging', label: 'Professional & Engaging' },
  { value: 'fun and energetic', label: 'Fun & Energetic' },
  { value: 'inspiring and motivational', label: 'Inspiring & Motivational' },
  { value: 'informative and concise', label: 'Informative & Concise' },
];

const PLATFORMS: SocialPostPlatform[] = ['facebook', 'instagram', 'linkedin', 'xiaohongshu'];

export const SocialPersonaConfig: React.FC = () => {
  const { personas, loading, upsert } = useSocialPersonas();
  const { member } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SocialPostPlatform>('facebook');
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Partial<typeof personas[0]>>>({});

  const getDraft = (platform: SocialPostPlatform) => {
    const base = personas.find(p => p.platform === platform);
    return { ...base, ...drafts[platform] };
  };

  const setDraft = (platform: SocialPostPlatform, key: string, value: unknown) => {
    setDrafts(prev => ({ ...prev, [platform]: { ...prev[platform], [key]: value } }));
  };

  const handleSave = async (platform: SocialPostPlatform) => {
    if (!member?.id) return;
    setSaving(true);
    try {
      await upsert(platform, getDraft(platform), member.id);
      setDrafts(prev => { const n = { ...prev }; delete n[platform]; return n; });
      showToast(`${SOCIAL_POST_PLATFORM_LABELS[platform]} persona saved`, 'success');
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (platform: SocialPostPlatform) => {
    setDrafts(prev => ({ ...prev, [platform]: DEFAULT_PERSONAS[platform] }));
  };

  if (loading) return <div className="text-sm text-slate-400 py-8 text-center">Loading personas…</div>;

  const draft = getDraft(activeTab);
  const isDirty = !!drafts[activeTab] && Object.keys(drafts[activeTab]).length > 0;

  return (
    <div className="flex flex-col">
      {/* Platform tabs */}
      <div className="flex border-b border-slate-200 mb-4">
        {PLATFORMS.map(platform => {
          const isActive = activeTab === platform;
          const hasDraft = !!drafts[platform] && Object.keys(drafts[platform]).length > 0;
          return (
            <button
              key={platform}
              onClick={() => setActiveTab(platform)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors relative ${
                isActive
                  ? PLATFORM_COLORS[platform].active
                  : `text-slate-500 hover:text-slate-700 hover:bg-slate-50 ${PLATFORM_COLORS[platform].tab}`
              }`}
            >
              {PLATFORM_ICONS[platform]}
              {SOCIAL_POST_PLATFORM_LABELS[platform]}
              {hasDraft && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1.5 right-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active platform config */}
      <div className="space-y-3">
        {/* Active toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Platform active</span>
          <div
            onClick={() => setDraft(activeTab, 'isEnabled', !draft.isEnabled)}
            className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${draft.isEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${draft.isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
        </div>

        {/* System prompt */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
            <Sparkles size={11} /> AI System Prompt
          </label>
          <textarea
            value={draft.systemPrompt ?? ''}
            onChange={e => setDraft(activeTab, 'systemPrompt', e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-none font-mono"
          />
        </div>

        {/* Tone + Max length */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Default Tone</label>
            <select
              value={draft.defaultTone ?? ''}
              onChange={e => setDraft(activeTab, 'defaultTone', e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 text-slate-700 bg-white"
            >
              {TONE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Max Length (chars)</label>
            <input
              type="number"
              value={draft.maxLength ?? 2000}
              onChange={e => setDraft(activeTab, 'maxLength', Number(e.target.value))}
              className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 text-slate-700"
              min={100}
              max={10000}
            />
          </div>
        </div>

        {/* Example post */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Example Post (optional)</label>
          <textarea
            value={draft.examplePost ?? ''}
            onChange={e => setDraft(activeTab, 'examplePost', e.target.value)}
            rows={2}
            placeholder="Paste a sample post in the style you want…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => handleReset(activeTab)} className="text-xs">
            <RotateCcw size={11} className="mr-1" /> Reset Default
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSave(activeTab)}
            disabled={saving || !isDirty}
            className="text-xs"
          >
            <Save size={11} className="mr-1" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};
