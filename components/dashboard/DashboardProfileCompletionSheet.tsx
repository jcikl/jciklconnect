import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle } from 'lucide-react';
import { useToast } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { MembersService } from '../../services/membersService';
import {
  PROFILE_BASIC_LABELS,
  PROFILE_CONTACT_LABELS,
  PROFILE_PROFESSIONAL_LABELS,
  ProfileCompleteness,
  buildProfileUpdatePayload,
  getProfileMissingCounts,
} from './dashboardHomeUtils';

interface DashboardProfileCompletionSheetProps {
  isOpen: boolean;
  member: any;
  profileCompleteness: ProfileCompleteness | null;
  profileDraft: Record<string, string>;
  setProfileDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  profileSaving: boolean;
  setProfileSaving: React.Dispatch<React.SetStateAction<boolean>>;
  profileTab: string;
  setProfileTab: React.Dispatch<React.SetStateAction<string>>;
  onClose: () => void;
}

export const DashboardProfileCompletionSheet: React.FC<DashboardProfileCompletionSheetProps> = ({
  isOpen,
  member,
  profileCompleteness,
  profileDraft,
  setProfileDraft,
  profileSaving,
  setProfileSaving,
  profileTab,
  setProfileTab,
  onClose,
}) => {
  const { showToast } = useToast();

  if (!isOpen || !profileCompleteness) return null;

  const { done, total, pct, missing } = profileCompleteness;
  const set = (key: string, v: string) => setProfileDraft(draft => ({ ...draft, [key]: v }));
  const val = (key: string, fallback = '') => profileDraft[key] ?? fallback;
  const { basicCount, contactCount, professionalCount } = getProfileMissingCounts(missing);
  const tabDefs = [
    { id: 'basic', label: 'Basic Info', count: basicCount, total: PROFILE_BASIC_LABELS.length },
    { id: 'contact', label: 'Contact', count: contactCount, total: PROFILE_CONTACT_LABELS.length },
    { id: 'professional', label: 'Professional', count: professionalCount, total: PROFILE_PROFESSIONAL_LABELS.length },
  ];

  const handleSave = async () => {
    if (!member?.id || Object.keys(profileDraft).length === 0) return;
    setProfileSaving(true);
    try {
      const updates = buildProfileUpdatePayload(profileDraft);
      await MembersService.updateMember(member.id, updates as Parameters<typeof MembersService.updateMember>[1]);
      showToast('Profile updated!', 'success');
      onClose();
      setProfileDraft({});
    } catch {
      showToast('Failed to save. Please try again.', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-end md:items-center md:justify-center" onClick={onClose}>
      <div className="rounded-t-[32px] md:rounded-2xl w-full md:max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col md:mx-4 animate-slide-up" style={{ background: '#0f172a' }} onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-3 pb-4 flex-shrink-0" style={{
          backgroundImage: 'linear-gradient(135deg, rgba(0,111,183,0.92) 0%, rgba(0,75,135,0.90) 55%, rgba(0,40,90,0.88) 100%), url(/background/birthday-background.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}>
          <div className="flex justify-center pb-2 md:hidden"><div className="w-10 h-1 rounded-full bg-white/30" /></div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0 w-10 h-10">
                <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90" aria-hidden="true">
                  <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="3.5" />
                  <circle cx="20" cy="20" r="16" fill="none" stroke="white" strokeWidth="3.5"
                    strokeDasharray={`${2 * Math.PI * 16} ${2 * Math.PI * 16}`}
                    strokeDashoffset={2 * Math.PI * 16 * (1 - pct / 100)}
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-black text-white leading-none">{pct}%</span>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-white">{member?.general?.name ?? 'Your Profile'}</h3>
                <p className="text-xs text-blue-200/80">{done} of {total} sections filled</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close"
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-start">
            {tabDefs.map((tab, index) => (
              <React.Fragment key={tab.id}>
                {index > 0 && (
                  <div className={`flex-1 h-0.5 mt-4 transition-colors ${tabDefs[index - 1].count === 0 ? 'bg-emerald-500/60' : 'bg-white/15'}`} />
                )}
                <button className="flex flex-col items-center gap-1.5 flex-1 focus:outline-none" onClick={() => setProfileTab(tab.id)}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${tab.count === 0 ? 'bg-emerald-500 text-white'
                    : profileTab === tab.id ? 'bg-jci-blue text-white'
                      : 'bg-white/10 text-white/40'
                    }`}>
                    {tab.count === 0 ? <CheckCircle size={14} /> : tab.count}
                  </div>
                  <span className={`text-[10px] font-semibold whitespace-nowrap ${tab.count === 0 ? 'text-emerald-400'
                    : profileTab === tab.id ? 'text-blue-300'
                      : 'text-white/40'
                    }`}>{tab.label}</span>
                  <span className={`text-[10px] ${tab.count === 0 ? 'text-emerald-400' : 'text-blue-300'}`}>
                    {`${Math.round((tab.total - tab.count) / tab.total * 100)}%`}
                  </span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3
          [&_input]:bg-white/10 [&_input]:border-white/20 [&_input]:text-white [&_input]:placeholder:text-white/30
          [&_button[type=button]]:bg-white/10 [&_button[type=button]]:border-white/20 [&_button[type=button]]:text-white
          [&_textarea]:bg-white/10 [&_textarea]:border-white/20 [&_textarea]:text-white [&_textarea]:placeholder:text-white/30
          [&_label]:text-white/60">
          {profileTab === 'basic' && (
            basicCount === 0
              ? <div className="space-y-2">
                  <div className="flex items-center gap-2 pb-1 mb-1">
                    <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                    <p className="text-xs font-semibold text-emerald-400">All basic info filled</p>
                  </div>
                  {(member?.general?.avatarUrl || member?.avatarUrl) && (
                    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5">
                      <span className="text-xs text-white/40">Profile Photo</span>
                      <img src={member?.general?.avatarUrl || member?.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-white/20" />
                    </div>
                  )}
                  {[
                    { label: 'Shirt Style', value: member?.others?.shirtStyle },
                    { label: 'T-Shirt Size', value: member?.others?.tshirtSize },
                    { label: 'Jacket Size', value: member?.others?.jacketSize },
                  ].filter(row => row.value).map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5">
                      <span className="text-xs text-white/40">{row.label}</span>
                      <span className="text-xs text-white/80 font-medium">{row.value}</span>
                    </div>
                  ))}
                </div>
              : <div className="space-y-3">
                {missing.find(field => field.label === 'Apparel & Items') && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Apparel & Items</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Select label="Shirt Style"
                        value={val('shirtStyle', member?.others?.shirtStyle ?? '')}
                        onChange={e => set('shirtStyle', e.target.value)}
                        options={[{ value: '', label: 'Select…' }, { value: 'Unisex', label: 'Unisex' }, { value: 'Lady Cut', label: 'Lady Cut' }]} />
                      <Select label="T-Shirt Size"
                        value={val('tshirtSize', member?.others?.tshirtSize ?? '')}
                        onChange={e => set('tshirtSize', e.target.value)}
                        options={[{ value: '', label: 'Select…' }, ...['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL', '7XL'].map(size => ({ value: size, label: size }))]} />
                      <Select label="Jacket Size"
                        value={val('jacketSize', member?.others?.jacketSize ?? '')}
                        onChange={e => set('jacketSize', e.target.value)}
                        options={[{ value: '', label: 'Select…' }, ...['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL', '7XL'].map(size => ({ value: size, label: size }))]} />
                    </div>
                  </div>
                )}
              </div>
          )}
          {profileTab === 'contact' && (
            contactCount === 0
              ? <div className="space-y-2">
                  <div className="flex items-center gap-2 pb-1 mb-1">
                    <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                    <p className="text-xs font-semibold text-emerald-400">All contact info filled</p>
                  </div>
                  {[
                    { label: 'Phone Number', value: member?.contact?.phone },
                    { label: 'Address', value: member?.contact?.address },
                    { label: 'Emergency Contact Name', value: member?.contact?.emergency?.name },
                    { label: 'Emergency Relationship', value: member?.contact?.emergency?.relationship },
                    { label: 'Emergency Phone', value: member?.contact?.emergency?.phone },
                  ].filter(row => row.value).map(row => (
                    <div key={row.label} className="flex items-start justify-between gap-3 py-2 px-3 rounded-xl bg-white/5">
                      <span className="text-xs text-white/40 shrink-0">{row.label}</span>
                      <span className="text-xs text-white/80 font-medium text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              : <div className="space-y-3">
                {missing.find(field => field.label === 'Phone number') && (
                  <Input label="Phone Number" type="tel"
                    value={val('phone', member?.contact?.phone ?? '')}
                    onChange={e => set('phone', e.target.value)} />
                )}
                {missing.find(field => field.label === 'Address') && (
                  <Input label="Address"
                    value={val('address', member?.contact?.address ?? '')}
                    onChange={e => set('address', e.target.value)} />
                )}
                {missing.find(field => field.label === 'Emergency contact') && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Emergency Contact</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input label="Name"
                        value={val('emergencyContactName', member?.contact?.emergency?.name ?? '')}
                        onChange={e => set('emergencyContactName', e.target.value)} />
                      <Input label="Relationship"
                        value={val('emergencyContactRelationship', member?.contact?.emergency?.relationship ?? '')}
                        onChange={e => set('emergencyContactRelationship', e.target.value)} />
                    </div>
                    <Input label="Phone" type="tel"
                      value={val('emergencyContact', member?.contact?.emergency?.name ?? '')}
                      onChange={e => set('emergencyContact', e.target.value)} />
                  </div>
                )}
              </div>
          )}
          {profileTab === 'professional' && (
            <div className="space-y-3">
              {[
                { label: 'Company Name', value: member?.companyName },
                { label: 'Industry', value: member?.industry },
                { label: 'Position / Title', value: member?.business?.departmentAndPosition },
                { label: 'Business Categories', value: Array.isArray(member?.business?.businessCategory) && member.business.businessCategory.length > 0 ? member.business.businessCategory.join(', ') : undefined },
                { label: 'Company Description', value: member?.business?.companyDescription },
                { label: 'Ideal Referral', value: (Array.isArray(member?.business?.idealReferrals) && member.business.idealReferrals.length > 0) ? member.business.idealReferrals.join(', ') : (member?.idealReferralIndustry || undefined) },
                { label: 'International Business', value: member?.business?.acceptInternationalBusiness },
                { label: 'Level of Management', value: member?.business?.levelOfManagement },
              ].filter(row => row.value).map(row => (
                <div key={row.label} className="flex items-start justify-between gap-3 py-2 px-3 rounded-xl bg-white/5">
                  <span className="text-xs text-white/40 shrink-0">{row.label}</span>
                  <span className="text-xs text-white/80 font-medium text-right">{row.value}</span>
                </div>
              ))}
              {professionalCount === 0
                ? <div className="flex items-center gap-2 pt-1">
                    <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                    <p className="text-xs font-semibold text-emerald-400">All professional info filled</p>
                  </div>
                : <>
                    {missing.find(field => field.label === 'Company name') && (
                      <Input label="Company Name"
                        value={val('companyName', member?.companyName ?? '')}
                        onChange={e => set('companyName', e.target.value)} />
                    )}
                    {missing.find(field => field.label === 'Industry') && (
                      <Input label="Industry"
                        value={val('industry', member?.industry ?? '')}
                        onChange={e => set('industry', e.target.value)} />
                    )}
                    {missing.find(field => field.label === 'Position / title') && (
                      <Input label="Position / Title"
                        value={val('departmentAndPosition', member?.business?.departmentAndPosition ?? '')}
                        onChange={e => set('departmentAndPosition', e.target.value)} />
                    )}
                    {missing.find(field => field.label === 'Company description') && (
                      <Textarea label="Company Description" rows={2}
                        value={val('companyDescription', member?.business?.companyDescription ?? '')}
                        onChange={e => set('companyDescription', e.target.value)} />
                    )}
                    {missing.find(field => field.label === 'Ideal referral') && (
                      <Input label="Ideal Referral" placeholder="e.g. SME owners in F&B industry"
                        value={val('idealReferral', Array.isArray(member?.business?.idealReferrals) ? member.business.idealReferrals.join(', ') : '')}
                        onChange={e => set('idealReferral', e.target.value)} />
                    )}
                    {missing.find(field => field.label === 'International business') && (
                      <Select label="International Business"
                        value={val('acceptInternationalBusiness', member?.business?.acceptInternationalBusiness ?? '')}
                        onChange={e => set('acceptInternationalBusiness', e.target.value)}
                        options={[{ value: '', label: 'Select…' }, { value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }, { value: 'Willing to Explore', label: 'Willing to Explore' }]} />
                    )}
                    {missing.find(field => field.label === 'Level of management') && (
                      <div className="space-y-1.5">
                        <span className="text-xs text-white/60">Level of Management</span>
                        <div className="flex gap-2">
                          {['Top', 'Middle', 'Frontline'].map(option => (
                            <button key={option} type="button"
                              onClick={() => set('levelOfManagement', option)}
                              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                              style={val('levelOfManagement', member?.business?.levelOfManagement ?? '') === option
                                ? { backgroundColor: '#0097D7', color: '#fff' }
                                : { backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
              }
            </div>
          )}
        </div>

        <div className="flex-none px-4 py-3 flex items-center gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={onClose}
            className="flex-shrink-0 px-4 py-2.5 text-sm font-semibold text-white/50 hover:text-white/80 transition-colors rounded-xl hover:bg-white/10">
            Cancel
          </button>
          <button disabled={profileSaving || Object.keys(profileDraft).length === 0}
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-jci-blue text-white text-sm font-bold disabled:opacity-40 hover:bg-blue-600 transition-all active:scale-[0.98]">
            {profileSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
