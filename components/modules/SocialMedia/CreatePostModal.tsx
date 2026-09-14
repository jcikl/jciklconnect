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

const MOCK_DATA: Record<SocialPostContentType, { title: string; keyInfo: Record<string, string>; referenceContent: string; hashtags: string }> = {
  event_highlight: {
    title: 'JCI KL Business Mixer 2026 Recap',
    keyInfo: {
      'Event name': 'JCI KL Business Mixer 2026',
      'Date and venue': '12 September 2026, Menara Hap Seng, Kuala Lumpur',
      'Attendance': '120 members and guests',
      '3 key moments': 'Keynote on ESG leadership; panel discussion with 4 CEOs; networking dinner with live pitching',
      'Speakers / important people': 'Dato\' Amin Halim (CEO, KL Corp), President Peter Tan, VP Sarah Lim',
      'Outcome': 'RM 50,000 in potential business leads identified; 3 MOU discussions initiated',
      'What participants gained': 'New high-value connections, ESG business frameworks, investor introductions',
      'Photo / video reference': 'Photos uploaded to Drive; highlight reel by video team',
      'Next step': 'Follow-up coffee sessions in October; post-event survey by 20 Sep',
      'Preferred CTA': 'Tag someone who should have been there! 👇',
    },
    referenceContent: '',
    hashtags: '#JCIKL #BusinessMixer #YouthLeadership #JCIMalaysia',
  },
  recognition: {
    title: 'Congratulations Sarah Lim — JCI Malaysia TOYP Award 2026',
    keyInfo: {
      'Person name': 'Sarah Lim Xin Yee',
      'Role / position': 'Secretary General, JCI KL 2026',
      'Achievement / award / appointment': 'JCI Malaysia Outstanding Young Person (TOYP) — Leadership Development category',
      'Event / organisation': 'JCI Malaysia National Conference 2026',
      'Why this deserves recognition': 'First JCI KL member to win TOYP in Leadership Development in 5 years; led 3 national-level programmes',
      'Meaning for JCI KL / youth leadership': 'Inspires the next generation of servant leaders and puts JCI KL on the national map',
      'People to tag or thank': 'JCI Malaysia, JCI KL BOD, Sarah\'s mentor VP Jason Wong',
      'Preferred CTA': 'Drop a 🎉 to congratulate Sarah!',
    },
    referenceContent: '',
    hashtags: '#JCIKL #TOYP #YouthLeadership #JCIMalaysia',
  },
  member_story: {
    title: 'From Boardroom Wallflower to Chapter Leader — Jason\'s JCI Journey',
    keyInfo: {
      'Member name': 'Jason Wong Kai Sheng',
      'Before joining JCI': 'Corporate banker with zero public speaking experience and low confidence in group settings',
      'Challenge faced': 'Fear of leading, imposter syndrome, no network outside the office',
      'Reason for joining JCI': 'Wanted to grow beyond spreadsheets and build real-world leadership skills',
      'Key JCI experience': 'Led the Annual Charity Gala committee, raising RM 30,000 for underprivileged youth',
      'Turning point': 'Delivered first impromptu speech at KL Zone conference — standing ovation changed everything',
      'Growth / transformation': 'Now a certified JCI trainer, mentoring 15 new members; promoted to VP Training',
      'Current status': 'VP Training 2026, JCI Certified Trainer, finalist for TOYP 2027',
      'Lesson or inspiration for readers': 'Growth lives 3 seconds outside your comfort zone. Take the step.',
      'Preferred CTA': 'Share your JCI turning-point moment below 👇',
    },
    referenceContent: '',
    hashtags: '#JCIKL #MemberStory #GrowthMindset #YoungProfessionals',
  },
  announcement_teaser: {
    title: 'Something Big Is Coming — JCI KL Annual Gala 2026',
    keyInfo: {
      'What will be announced': 'Annual Gala Dinner 2026 — theme, performers, and award categories',
      'Target audience': 'JCI KL members, alumni, and KL business community',
      'Information that can be revealed': 'Date confirmed: 15 November 2026 | Venue: The Majestic Hotel KL',
      'Information to keep secret': 'Headline performer and VIP keynote speaker',
      'Reveal date': '1 October 2026',
      'Biggest highlight': 'Surprise headline performer + JCI KL Excellence Awards ceremony',
      'Why people should care': 'Biggest JCI KL annual gathering — networking, awards, and an unforgettable night',
      'Preferred CTA': 'Save the date 🗓️ and watch this space — you won\'t want to miss this.',
    },
    referenceContent: '',
    hashtags: '#JCIKL #GalaDinner2026 #SaveTheDate #ComingSoon',
  },
  educational_value: {
    title: '5 Networking Mistakes That Are Costing You Connections',
    keyInfo: {
      'Topic': 'How to network effectively at professional events',
      'Target audience': 'Young professionals aged 22-35 attending their first business events',
      'Problem / pain point': 'Most people leave events with a stack of business cards and zero real connections',
      'Core insight': 'Authentic curiosity beats scripted pitches. People remember how you made them feel, not what you said.',
      '3-5 practical steps': '1. Research 3 attendees before the event | 2. Open with questions, not your title | 3. Follow up within 24h with a personal detail | 4. Give before you ask | 5. One memorable line about what you do',
      'Common mistakes': 'Monopolising conversations; staying in your comfort group; forgetting to follow up; handing out cards without context',
      'Example / experience / data': 'JCI KL members who actively networked at Business Mixer 2025 reported 3× more referrals within 90 days',
      'Save-worthy takeaway': '"Your network is your net worth — but only if you water it." 💡',
      'Preferred CTA': 'Save this post before your next event. Which tip do you need most? 👇',
    },
    referenceContent: '',
    hashtags: '#JCIKL #NetworkingTips #YoungProfessionals #Leadership',
  },
  impact_community: {
    title: 'JCI KL Career Launch 2026 — 65 Graduates. 30 Days. Real Jobs.',
    keyInfo: {
      'Social issue / problem': 'Youth unemployment and skills gap among B40 graduates in urban Kuala Lumpur',
      'Project / action': 'JCI KL Career Launch Programme 2026 — resume workshops, mock interviews, and employer speed-dating',
      'Beneficiaries': '80 fresh graduates from B40 backgrounds across KL and Selangor',
      'Partners': 'Yayasan Chow Kit, TalentCorp Malaysia, 12 participating employers',
      'Specific numbers / results': '65 of 80 participants (81%) secured internships or job offers within 30 days',
      'Human story / field moment': 'Amirah, 22, cried when she received her first architecture firm offer — she had been rejected 14 times before the programme',
      'Long-term meaning': 'Building a generation of self-sufficient young Malaysians who pay it forward',
      'SDG / community value': 'SDG 8 — Decent Work and Economic Growth; SDG 10 — Reduced Inequalities',
      'Preferred CTA': 'Share this with someone who needs it. Together we build better futures. 🌱',
    },
    referenceContent: '',
    hashtags: '#JCIKL #CareerLaunch #YouthEmpowerment #SDG8 #Malaysia',
  },
  promotion_recruitment: {
    title: 'Ready to Lead? Join JCI KL — Q4 Induction 2026',
    keyInfo: {
      'Event / recruitment name': 'JCI KL New Member Induction — Q4 2026',
      'Who it is for': 'Young professionals aged 18-40 who want to grow their leadership, network, and impact',
      'Audience pain point': 'Feeling stuck in career, no real leadership experience, wanting a community that challenges you to grow',
      'Benefits of joining': 'World-class leadership training, access to 200+ KL business leaders, run real projects with real budgets, global JCI network',
      'Date, time, and venue': '18 October 2026, 9am – 1pm, JCI KL Secretariat, Jalan Ipoh KL',
      'Price': 'FREE for first-time attendees',
      'Registration link / method': 'DM "JOIN" to this page or visit jcikl.com/join',
      'Deadline': '15 October 2026 (limited seats)',
      'Seat limit / urgency': 'Only 30 seats — 18 already taken!',
      'Preferred CTA': 'DM "JOIN" now or tag a friend who is ready to lead! 🔥',
    },
    referenceContent: '',
    hashtags: '#JCIKL #JoinJCI #YoungLeaders #Recruitment #KualaLumpur',
  },
  corporate_organisational: {
    title: 'JCI KL × Bursa Malaysia — Partnership for Financial Literacy',
    keyInfo: {
      'Partner / organisation': 'Bursa Malaysia',
      'Meeting / visit / MOU / collaboration': 'MOU signing ceremony and leadership exchange visit',
      'Background': 'Two-year strategic partnership focused on financial literacy and capital market awareness for Malaysian youth',
      'Topics discussed': 'Joint financial education roadmap; co-hosted workshops calendar 2027; youth investor programme',
      'Concrete outcome': 'MOU signed 10 September 2026; 3 co-hosted workshops confirmed; 500 youth target beneficiaries for 2027',
      'Meaning for members / stakeholders': 'JCI KL members gain exclusive access to Bursa resources, expert speakers, and exchange floor visits',
      'Next step': 'First joint workshop "Invest Young, Lead Well" — January 2027 at Bursa Malaysia HQ',
    },
    referenceContent: '',
    hashtags: '#JCIKL #BursaMalaysia #FinancialLiteracy #Partnership #YouthLeadership',
  },
};

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

  const fillMockData = () => {
    const mock = MOCK_DATA[contentType];
    setTitle(mock.title);
    setKeyInfoValues(mock.keyInfo);
    setReferenceContent(mock.referenceContent);
    setHashtags(mock.hashtags);
  };

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
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-medium text-slate-700">Title *</label>
              <button
                type="button"
                onClick={fillMockData}
                className="text-[11px] font-medium text-jci-blue hover:text-jci-navy hover:underline whitespace-nowrap"
              >
                Fill sample data
              </button>
            </div>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. JCI KL Business Mixer Recap" />
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
