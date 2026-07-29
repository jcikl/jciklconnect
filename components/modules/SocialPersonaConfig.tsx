import React, { useState } from 'react';
import { Sparkles, Save, Facebook, Megaphone, Share2, RotateCcw } from 'lucide-react';
import { Button, useToast } from '../ui/Common';
import { useSocialPersonas } from '../../hooks/useSocialPersonas';
import { DEFAULT_PERSONAS } from '../../types/socialPersona';
import type { SocialPostPlatform } from '../../types/socialPost';
import { SOCIAL_POST_PLATFORM_LABELS } from '../../types/socialPost';
import { useAuth } from '../../hooks/useAuth';

const PLATFORM_ICONS: Record<SocialPostPlatform, React.ReactNode> = {
  facebook: <Facebook size={18} />,
  instagram: <Megaphone size={18} />,
  linkedin: <Share2 size={18} />,
  xiaohongshu: <span className="text-sm font-black">红</span>,
};

const PLATFORM_COLORS: Record<SocialPostPlatform, string> = {
  facebook: 'bg-blue-50 border-blue-200 text-blue-700',
  instagram: 'bg-pink-50 border-pink-200 text-pink-700',
  linkedin: 'bg-sky-50 border-sky-200 text-sky-700',
  xiaohongshu: 'bg-red-50 border-red-200 text-red-700',
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
  const [saving, setSaving] = useState<SocialPostPlatform | null>(null);
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
    setSaving(platform);
    try {
      await upsert(platform, getDraft(platform), member.id);
      setDrafts(prev => { const n = { ...prev }; delete n[platform]; return n; });
      showToast(`${SOCIAL_POST_PLATFORM_LABELS[platform]} persona saved`, 'success');
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleReset = (platform: SocialPostPlatform) => {
    setDrafts(prev => ({ ...prev, [platform]: DEFAULT_PERSONAS[platform] }));
  };

  if (loading) return <div className="text-sm text-slate-400 py-8 text-center">Loading personas…</div>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-slate-500">Configure the AI writing style for each platform. These prompts are used when BOD clicks "AI Rewrite" in the review drawer.</p>
      </div>
      {PLATFORMS.map(platform => {
        const draft = getDraft(platform);
        const isDirty = !!drafts[platform] && Object.keys(drafts[platform]).length > 0;
        return (
          <div key={platform} className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${PLATFORM_COLORS[platform]}`}>
              <div className="flex items-center gap-2 font-semibold text-sm">
                {PLATFORM_ICONS[platform]}
                {SOCIAL_POST_PLATFORM_LABELS[platform]}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-medium">Active</span>
                <div
                  onClick={() => setDraft(platform, 'isEnabled', !draft.isEnabled)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${draft.isEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${draft.isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>
            {/* Body */}
            <div className="p-4 space-y-3 bg-white">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                  <Sparkles size={11} /> AI System Prompt
                </label>
                <textarea
                  value={draft.systemPrompt ?? ''}
                  onChange={e => setDraft(platform, 'systemPrompt', e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-none font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Default Tone</label>
                  <select
                    value={draft.defaultTone ?? ''}
                    onChange={e => setDraft(platform, 'defaultTone', e.target.value)}
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
                    onChange={e => setDraft(platform, 'maxLength', Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 text-slate-700"
                    min={100}
                    max={10000}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Example Post (optional — helps guide AI style)</label>
                <textarea
                  value={draft.examplePost ?? ''}
                  onChange={e => setDraft(platform, 'examplePost', e.target.value)}
                  rows={2}
                  placeholder="Paste a sample post in the style you want…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReset(platform)}
                  className="text-xs"
                >
                  <RotateCcw size={11} className="mr-1" /> Reset Default
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSave(platform)}
                  disabled={saving === platform || !isDirty}
                  className="text-xs"
                >
                  <Save size={11} className="mr-1" />
                  {saving === platform ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
