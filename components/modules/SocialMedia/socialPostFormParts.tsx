import React from 'react';
import type { SocialPostContentType, SocialPostPlatform } from '../../../types/socialPost';
import {
  SOCIAL_POST_CONTENT_TYPE_KEY_FIELDS,
  SOCIAL_POST_CONTENT_TYPE_LABELS,
  SOCIAL_POST_PLATFORM_LABELS,
} from '../../../types/socialPost';
import { PLATFORM_ICONS } from './socialMediaUi';

const KEY_INFORMATION_HEADING = 'Key Information';
const REFERENCE_CONTENT_HEADING = 'Reference Content';

export type KeyInfoValues = Record<string, string>;

export function parseReferenceMaterial(content: string, contentType: SocialPostContentType): { keyInfo: KeyInfoValues; referenceContent: string } {
  const fields = SOCIAL_POST_CONTENT_TYPE_KEY_FIELDS[contentType];
  const keyInfo = Object.fromEntries(fields.map(field => [field, ''])) as KeyInfoValues;
  const lines = content.split(/\r?\n/);
  const referenceStart = lines.findIndex(line => line.trim().toLowerCase() === `${REFERENCE_CONTENT_HEADING}:`.toLowerCase());

  fields.forEach(field => {
    const line = lines.find(candidate => candidate.toLowerCase().startsWith(`${field.toLowerCase()}:`));
    if (line) keyInfo[field] = line.slice(field.length + 1).trim();
  });

  const hasStructuredKeyInfo = Object.values(keyInfo).some(Boolean);
  if (referenceStart >= 0) {
    return { keyInfo, referenceContent: lines.slice(referenceStart + 1).join('\n').trim() };
  }

  return { keyInfo, referenceContent: hasStructuredKeyInfo ? '' : content };
}

export function buildReferenceMaterial(contentType: SocialPostContentType, keyInfo: KeyInfoValues, referenceContent: string) {
  const keyInfoLines = SOCIAL_POST_CONTENT_TYPE_KEY_FIELDS[contentType]
    .map(field => `${field}: ${(keyInfo[field] ?? '').trim()}`)
    .filter(line => !line.endsWith(':'));
  const sections = [
    keyInfoLines.length ? `${KEY_INFORMATION_HEADING}:\n${keyInfoLines.join('\n')}` : '',
    referenceContent.trim() ? `${REFERENCE_CONTENT_HEADING}:\n${referenceContent.trim()}` : '',
  ].filter(Boolean);
  return sections.join('\n\n');
}

export const KeyInformationFields: React.FC<{
  contentType: SocialPostContentType;
  values: KeyInfoValues;
  onChange: (field: string, value: string) => void;
  onBlur?: () => void;
}> = ({ contentType, values, onChange, onBlur }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-2">Key Information *</label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {SOCIAL_POST_CONTENT_TYPE_KEY_FIELDS[contentType].map(field => (
        <input
          key={field}
          type="text"
          value={values[field] ?? ''}
          onChange={e => onChange(field, e.target.value)}
          onBlur={onBlur}
          placeholder={field}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 outline-none"
        />
      ))}
    </div>
  </div>
);

export const ReadonlyField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</p>
    <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap border border-slate-200">
      {children}
    </div>
  </div>
);

export const ReadonlyKeyInformation: React.FC<{ contentType: SocialPostContentType; values: KeyInfoValues }> = ({ contentType, values }) => (
  <div>
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Key Information</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {SOCIAL_POST_CONTENT_TYPE_KEY_FIELDS[contentType].map(field => (
        <div key={field} className="bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{field}</p>
          <p className="text-sm text-slate-700 mt-0.5">{values[field] || '-'}</p>
        </div>
      ))}
    </div>
  </div>
);

export const MockupPreview: React.FC<{
  title: string;
  platforms: SocialPostPlatform[];
  activePlatform: SocialPostPlatform;
  contentType: SocialPostContentType;
  caption: string;
  hashtags?: string[];
}> = ({ title, platforms, activePlatform, contentType, caption, hashtags = [] }) => (
  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 rounded-full bg-jci-blue text-white flex items-center justify-center text-xs font-black">
          JC
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">JCI Kuala Lumpur</p>
          <p className="text-[11px] text-slate-400 truncate">
            {SOCIAL_POST_PLATFORM_LABELS[activePlatform]} · {SOCIAL_POST_CONTENT_TYPE_LABELS[contentType]}
          </p>
        </div>
      </div>
      <div className="flex gap-1">
        {platforms.map(platform => (
          <span key={platform} className={`w-6 h-6 rounded-full flex items-center justify-center border ${platform === activePlatform ? 'border-jci-blue text-jci-blue bg-blue-50' : 'border-slate-200 text-slate-400 bg-white'}`}>
            {PLATFORM_ICONS[platform]}
          </span>
        ))}
      </div>
    </div>
    <div className="aspect-[16/9] bg-slate-100 border-b border-slate-100 flex items-center justify-center text-xs font-semibold text-slate-400">
      Visual / poster area
    </div>
    <div className="p-4 space-y-2">
      <p className="text-sm font-bold text-slate-900">{title || 'Post title'}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap min-h-[120px]">
        {caption || 'Caption preview will appear here.'}
      </p>
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {hashtags.map(tag => (
            <span key={tag} className="text-[11px] text-jci-blue bg-jci-blue/8 px-2 py-0.5 rounded-full">#{tag}</span>
          ))}
        </div>
      )}
    </div>
  </div>
);
