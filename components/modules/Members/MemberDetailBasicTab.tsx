import * as React from 'react';
import {
  Phone, MessageCircle, MapPin, Linkedin, Facebook, Instagram, Lock,
  Eye, EyeOff, User, Briefcase, Package, Users, ArrowUpRight, Upload,
  Plus, Pencil, Trash2,
} from 'lucide-react';
import { Badge, Drawer, useToast } from '../../ui/Common';
import { Input } from '../../ui/Form';
import { Combobox } from '../../ui/Combobox';
import { IntroducerSelector } from '../../ui/IntroducerSelector';
import { MultiSelectDropdown } from '../../ui/MultiSelectDropdown';
import type { Member, HobbyClub, Project, SpecialOffer } from '../../../types';
import {
  nationalityOptionsForValue,
  INDUSTRY_OPTIONS,
  IDEAL_REFERRAL_OPTIONS,
  BUSINESS_CATEGORIES_OPTIONS,
} from '../../../config/constants';
import { isMalaysianIC, getBirthPlaceFromIC, getDateOfBirthFromIC, getGenderFromIC } from '../../../utils/malaysianIdUtils';
import { formatDateToDDMMMYYYY } from '../../../utils/dateUtils';
import { uploadMemberOfferLogoToCloudinary, uploadMemberOfferBannerToCloudinary } from '../../../services/cloudinaryService';

const HOBBY_OPTIONS = [
  'Art & Design', 'Badminton', 'Baking', 'Basketball', 'Car Enthusiast',
  'Cigar', 'Cooking', 'Cycling', 'Dancing', 'Diving',
  'E-Sport Mlbb', 'Fashion', 'Golf', 'Hiking', 'Leadership',
  'Liquor/ Wine Tasting', 'Make Up', 'Movie', 'Other E-Sport', 'Pickle Ball',
  'Pilates', 'Public Speaking', 'Reading', 'Rock Climbing', 'Singing',
  'Social Etiquette', 'Social Service', 'Travelling', 'Women Empowerment', 'Yoga',
];

const EMPTY_OFFER: SpecialOffer = { description: '', terms: '', expiryDate: '', status: 'Active' };

const toExternalWebsiteUrl = (url?: string) => {
  const trimmed = url?.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const RestrictedField: React.FC = () => (
  <span className="inline-flex items-center gap-1 text-slate-400 text-xs italic select-none">
    <Lock size={11} /> Restricted
  </span>
);

const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="sticky top-0 z-10 bg-white -mx-5 px-5 py-3 mb-1 text-sm font-bold text-slate-800 border-b border-slate-100">
    {children}
  </h3>
);

interface MemberDetailBasicTabProps {
  member: Member;
  isEditMode: boolean;
  inlineValues: any;
  setInlineValues: React.Dispatch<React.SetStateAction<any>>;
  isAdmin: boolean;
  isDeveloper: boolean;
  canViewSensitiveFields: boolean;
  loadingClubs: boolean;
  memberClubs: HobbyClub[];
  members: Member[];
  allProjects: Project[];
  avatarUploading: boolean;
  avatarUploadProgress: number;
  handleInlineAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  resolveIntroducerDisplay: (introVal?: string) => string;
  isSelfView?: boolean;
  activeInlineEditCard?: string | null;
}

const INFO_TABS = [
  { id: 'basic', label: 'Basic Information', icon: User },
  { id: 'contact', label: 'Contact', icon: Phone },
  { id: 'professional', label: 'Professional & Business', icon: Briefcase },
  { id: 'clubs', label: 'Hobby Clubs', icon: Users },
  { id: 'apparel', label: 'Apparel & Items', icon: Package },
] as const;

type InfoTabId = typeof INFO_TABS[number]['id'];

const MemberDetailBasicTabBase: React.FC<MemberDetailBasicTabProps> = (props) => {
  const {
    member, isEditMode, inlineValues, setInlineValues,
    isAdmin, isDeveloper, canViewSensitiveFields,
    loadingClubs, memberClubs, members, allProjects,
    avatarUploading, avatarUploadProgress, handleInlineAvatarUpload,
    resolveIntroducerDisplay, isSelfView = false, activeInlineEditCard,
  } = props;

  const { showToast } = useToast();
  const [activeInfoTab, setActiveInfoTab] = React.useState<InfoTabId>('basic');

  // Professional offers drawer state
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [draftOffer, setDraftOffer] = React.useState<SpecialOffer>({ ...EMPTY_OFFER });
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [uploadingBanner, setUploadingBanner] = React.useState(false);

  const offers: SpecialOffer[] = (inlineValues?.specialOffers ?? []).filter((o: SpecialOffer) => o.description?.trim());

  React.useEffect(() => {
    if (!drawerOpen) return;
    if (editingIndex !== null) {
      const src = (inlineValues?.specialOffers ?? [])[editingIndex];
      if (src) setDraftOffer({ ...src });
    } else {
      setDraftOffer({ ...EMPTY_OFFER });
    }
  }, [drawerOpen, editingIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => { setEditingIndex(null); setDrawerOpen(true); };
  const openEdit = (idx: number) => { setEditingIndex(idx); setDrawerOpen(true); };
  const deleteOffer = (idx: number) => setInlineValues({ ...inlineValues, specialOffers: offers.filter((_, i) => i !== idx) });
  const saveDrawer = () => {
    if (!draftOffer.description.trim()) return;
    const next = [...offers];
    if (editingIndex === null) next.push(draftOffer); else next[editingIndex] = draftOffer;
    setInlineValues({ ...inlineValues, specialOffers: next });
    setDrawerOpen(false);
  };
  const updateDraft = (patch: Partial<SpecialOffer>) => setDraftOffer(prev => ({ ...prev, ...patch }));

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !member.id) return;
    setUploadingLogo(true);
    try { updateDraft({ logoUrl: await uploadMemberOfferLogoToCloudinary(file, member.id) }); }
    catch { showToast('Failed to upload logo', 'error'); }
    finally { setUploadingLogo(false); }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !member.id) return;
    setUploadingBanner(true);
    try { updateDraft({ imageUrl: await uploadMemberOfferBannerToCloudinary(file, member.id) }); }
    catch { showToast('Failed to upload banner', 'error'); }
    finally { setUploadingBanner(false); }
  };

  // Contact privacy helpers
  const privacy = inlineValues?.privacy ?? member.privacy ?? {};
  const togglePrivacy = (key: 'showPhone' | 'showAlternatePhone' | 'showSocials') =>
    setInlineValues((prev: any) => ({ ...prev, privacy: { ...privacy, [key]: !(privacy[key] ?? true) } }));

  return (
    <>
      <div className="flex rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Left icon-only tab bar */}
        <div className="flex flex-col border-r border-slate-200 bg-slate-50 w-12 shrink-0">
          {INFO_TABS.map((tab, i) => (
            <button
              key={tab.id}
              title={tab.label}
              onClick={() => setActiveInfoTab(tab.id)}
              className={`relative flex items-center justify-center py-5 w-full transition-all ${i > 0 ? 'border-t border-slate-200' : ''} ${activeInfoTab === tab.id ? 'bg-white text-jci-blue' : 'text-slate-400 hover:text-slate-600 hover:bg-white/60'}`}
            >
              {activeInfoTab === tab.id && (
                <>
                  <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-jci-blue" />
                  <span className="absolute right-0 top-0 bottom-0 w-px bg-white" />
                </>
              )}
              <tab.icon size={16} className="shrink-0" />
            </button>
          ))}
        </div>

        {/* Right content panel */}
        <div className="flex-1 bg-white overflow-y-auto max-h-[560px]">

          {/* ── Basic Information ── */}
          {activeInfoTab === 'basic' && (
            <div className="px-5 pb-5">
              <H3>Basic Information</H3>
              {isEditMode && inlineValues ? (
                <div className="space-y-4 text-sm">
                  {/* Avatar upload */}
                  <div className="flex flex-row items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white bg-blue-50 shadow-sm shrink-0">
                      {inlineValues.avatar ? (
                        <img src={inlineValues._avatarTs ? `${inlineValues.avatar}?v=${inlineValues._avatarTs}` : inlineValues.avatar} alt={inlineValues.name || member.general?.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-black text-jci-blue">
                          {(inlineValues.name || member.general?.name || 'M').charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      <div>
                        <p className="font-bold text-slate-900">Member Avatar</p>
                        <p className="text-xs text-slate-500 mt-0.5">Upload a profile photo for member-facing pages.</p>
                      </div>
                      {avatarUploading && (
                        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full bg-jci-blue transition-all" style={{ width: `${avatarUploadProgress}%` }} />
                        </div>
                      )}
                      <label className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-bold transition-colors ${avatarUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-jci-blue text-white hover:bg-jci-navy cursor-pointer'}`}>
                        {avatarUploading ? 'Uploading...' : 'Upload'}
                        <input type="file" accept="image/*" className="hidden" disabled={avatarUploading} onChange={handleInlineAvatarUpload} />
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Name (Short)<span className="text-red-500 ml-1">*</span></label>
                      <input type="text" value={inlineValues.name ?? ''} onChange={e => setInlineValues({ ...inlineValues, name: e.target.value })} required className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Full Name (ID)</label>
                      <input type="text" value={inlineValues.fullName ?? ''} onChange={e => setInlineValues({ ...inlineValues, fullName: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">ID Number</label>
                      {canViewSensitiveFields ? (
                        <input type="text" value={inlineValues.idNumber ?? ''} onChange={e => {
                          const ic = e.target.value;
                          const updates: any = { idNumber: ic };
                          if (isMalaysianIC(ic)) {
                            const bp = getBirthPlaceFromIC(ic); if (bp) updates['general.birthPlace'] = bp;
                            const dob = getDateOfBirthFromIC(ic); if (dob) updates['general.dob'] = dob;
                            const gender = getGenderFromIC(ic); if (gender) updates['general.gender'] = gender;
                          }
                          setInlineValues({ ...inlineValues, ...updates });
                        }} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                      ) : <RestrictedField />}
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Date of Birth</label>
                      <Input type="date" value={inlineValues.dateOfBirth ?? ''} onChange={e => setInlineValues({ ...inlineValues, dateOfBirth: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Nationality</label>
                      <Combobox options={nationalityOptionsForValue(inlineValues.nationality)} value={inlineValues.nationality ?? ''} onChange={val => setInlineValues({ ...inlineValues, nationality: val })} placeholder="Select nationality..." />
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Birth Place</label>
                      <input type="text" value={inlineValues.birthPlace ?? ''} onChange={e => setInlineValues({ ...inlineValues, birthPlace: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Gender</label>
                      <select value={inlineValues.gender ?? ''} onChange={e => setInlineValues({ ...inlineValues, gender: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white">
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ethnicity</label>
                      <select value={inlineValues.ethnicity ?? ''} onChange={e => setInlineValues({ ...inlineValues, ethnicity: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white">
                        <option value="">Select Ethnicity</option>
                        <option value="Chinese">Chinese</option>
                        <option value="Malay">Malay</option>
                        <option value="Indian">Indian</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Dietary Preference</label>
                      <div className="flex w-full rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200">
                        {(['Vegetarian', 'Halal', 'Normal'] as const).map(opt => (
                          <label key={opt} className="cursor-pointer flex-1 flex">
                            <input type="radio" name="inlineDietaryPreference" value={opt.toLowerCase()} checked={inlineValues.dietaryPreference === opt.toLowerCase()} onChange={e => setInlineValues({ ...inlineValues, dietaryPreference: e.target.value })} className="hidden" />
                            <span className={`flex-1 text-center px-1 md:px-4 py-2 text-[10px] md:text-sm font-medium transition-colors ${inlineValues.dietaryPreference === opt.toLowerCase() ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Introducer</label>
                      <IntroducerSelector value={inlineValues.introducer ?? ''} onChange={val => setInlineValues({ ...inlineValues, introducer: val })} members={members} projects={allProjects} />
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Personal Biography</label>
                    <textarea value={inlineValues.bio ?? ''} onChange={e => setInlineValues({ ...inlineValues, bio: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-y" />
                  </div>
                  <div className="border-t pt-3">
                    <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Hobbies</label>
                    <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-lg bg-slate-50">
                      {HOBBY_OPTIONS.map(opt => {
                        const isChecked = (inlineValues.hobbies ?? []).includes(opt);
                        return (
                          <label key={opt} className="cursor-pointer">
                            <input type="checkbox" checked={isChecked} onChange={e => {
                              const newHobbies = e.target.checked ? [...(inlineValues.hobbies ?? []), opt] : (inlineValues.hobbies ?? []).filter((h: string) => h !== opt);
                              setInlineValues({ ...inlineValues, hobbies: newHobbies });
                            }} className="hidden" />
                            <span className={`inline-block px-2 py-1 rounded text-[10px] font-semibold border ${isChecked ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-300 hover:border-jci-blue'}`}>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Skills</label>
                    <input type="text" value={inlineValues.skills} onChange={e => setInlineValues({ ...inlineValues, skills: e.target.value })} placeholder="e.g. Public Speaking, Event Management (comma separated)" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 block text-xs uppercase font-medium">Full Name (ID)</span>
                      <p className="font-medium text-slate-900">{member.general?.fullName || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs uppercase font-medium">ID Number</span>
                      {canViewSensitiveFields ? <p className="font-medium text-slate-900 uppercase">{member.general?.idNumber || 'Not provided'}</p> : <RestrictedField />}
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs uppercase font-medium">Date of Birth</span>
                      <p className="font-medium text-slate-900">{formatDateToDDMMMYYYY(member.general?.dob)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs uppercase font-medium">Nationality</span>
                      <p className="font-medium text-slate-900">{member.general?.nationality || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs uppercase font-medium">Birth Place</span>
                      {(() => {
                        const storedBp = member.general?.birthPlace;
                        const bp = storedBp || (isMalaysianIC(member.general?.idNumber || '') ? getBirthPlaceFromIC(member.general?.idNumber || '') : '');
                        return (
                          <p className="font-medium text-slate-900 flex items-center gap-1.5">
                            {bp || 'Not provided'}
                            {!storedBp && bp && <span className="text-[10px] text-jci-blue font-normal">from IC</span>}
                          </p>
                        );
                      })()}
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs uppercase font-medium">Gender</span>
                      <p className="font-medium text-slate-900">{member.general?.gender || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs uppercase font-medium">Ethnicity</span>
                      <p className="font-medium text-slate-900">{member.general?.ethnicity || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs uppercase font-medium">Dietary Preference</span>
                      <p className="font-medium text-slate-900 capitalize">{member.general?.dietaryPreference || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <span className="text-slate-500 block text-xs uppercase font-medium mb-1">Introducer</span>
                    <p className="text-sm font-medium text-slate-900">{resolveIntroducerDisplay(member.jciCareer?.introducer)}</p>
                  </div>
                  <div className="border-t pt-3">
                    <span className="text-slate-500 block text-xs uppercase font-medium mb-1">Personal Biography</span>
                    <p className="text-sm text-slate-600 line-clamp-4 italic">{member.others?.bio || 'No biography provided.'}</p>
                  </div>
                  <div className="border-t pt-3">
                    <span className="text-slate-500 block text-xs uppercase font-medium mb-2">Hobbies</span>
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(member.others?.hobbies) && member.others?.hobbies.length > 0
                        ? member.others?.hobbies.map(hobby => <Badge key={hobby} variant="neutral" className="text-[10px]">{hobby}</Badge>)
                        : <span className="text-xs text-slate-400 italic">No hobbies listed</span>}
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <span className="text-slate-500 block text-xs uppercase font-medium mb-2">Skills</span>
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(member.skills) && member.skills.length > 0
                        ? member.skills.map(skill => <Badge key={skill} variant="neutral" className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100">{skill}</Badge>)
                        : <span className="text-xs text-slate-400 italic">No skills listed</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Contact ── */}
          {activeInfoTab === 'contact' && (
            <div className="px-5 pb-5">
              <H3>Contact</H3>
              {isEditMode && inlineValues ? (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-500 flex items-center gap-1.5 text-xs uppercase font-medium mb-1">
                        Primary Phone
                        {isSelfView && (
                          <button type="button" onClick={() => togglePrivacy('showPhone')} className="text-slate-400 hover:text-jci-blue transition-colors" title={(privacy.showPhone ?? true) ? 'Visible to members' : 'Hidden from members'}>
                            {(privacy.showPhone ?? true) ? <Eye size={12} /> : <EyeOff size={12} />}
                          </button>
                        )}
                      </label>
                      <input type="text" value={inlineValues.phone ?? ''} onChange={e => setInlineValues({ ...inlineValues, phone: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" />
                    </div>
                    <div>
                      <label className="text-slate-500 flex items-center gap-1.5 text-xs uppercase font-medium mb-1">
                        Alternate Phone
                        {isSelfView && (
                          <button type="button" onClick={() => togglePrivacy('showAlternatePhone')} className="text-slate-400 hover:text-jci-blue transition-colors" title={(privacy.showAlternatePhone ?? true) ? 'Visible to members' : 'Hidden from members'}>
                            {(privacy.showAlternatePhone ?? true) ? <Eye size={12} /> : <EyeOff size={12} />}
                          </button>
                        )}
                      </label>
                      <input type="text" value={inlineValues.alternatePhone ?? ''} onChange={e => setInlineValues({ ...inlineValues, alternatePhone: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" />
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Email</label>
                      <input type="email" value={inlineValues.email ?? ''} onChange={e => setInlineValues({ ...inlineValues, email: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" />
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">WhatsApp Group Added</label>
                      <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-300 bg-white p-1">
                        {[{ label: 'No', value: false }, { label: 'Yes', value: true }].map(option => (
                          <button key={option.label} type="button" onClick={() => setInlineValues({ ...inlineValues, whatsappGroup: option.value })} className={`h-8 rounded-md text-sm font-medium transition-colors ${inlineValues.whatsappGroup === option.value ? 'bg-jci-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>{option.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Address</label>
                      {canViewSensitiveFields
                        ? <textarea value={inlineValues.address ?? ''} onChange={e => setInlineValues({ ...inlineValues, address: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue resize-y" />
                        : <RestrictedField />}
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1 mb-3">Emergency Contact</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Name</label>
                        <input type="text" value={inlineValues.emergencyContactName ?? ''} onChange={e => setInlineValues({ ...inlineValues, emergencyContactName: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" />
                      </div>
                      <div>
                        <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Relationship</label>
                        <input type="text" value={inlineValues.emergencyContactRelationship ?? ''} onChange={e => setInlineValues({ ...inlineValues, emergencyContactRelationship: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Phone</label>
                        <input type="text" value={inlineValues.emergencyContactPhone ?? ''} onChange={e => setInlineValues({ ...inlineValues, emergencyContactPhone: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" />
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1 mb-3 flex items-center gap-1.5">
                      Social Media Links
                      {isSelfView && (
                        <button type="button" onClick={() => togglePrivacy('showSocials')} className="text-slate-400 hover:text-jci-blue transition-colors font-normal" title={(privacy.showSocials ?? true) ? 'Visible to members' : 'Hidden from members'}>
                          {(privacy.showSocials ?? true) ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                      )}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-slate-500 block text-xs font-medium mb-1">LinkedIn</label><input type="text" value={inlineValues.linkedin ?? ''} onChange={e => setInlineValues({ ...inlineValues, linkedin: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" /></div>
                      <div><label className="text-slate-500 block text-xs font-medium mb-1">Facebook</label><input type="text" value={inlineValues.facebook ?? ''} onChange={e => setInlineValues({ ...inlineValues, facebook: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" /></div>
                      <div><label className="text-slate-500 block text-xs font-medium mb-1">Instagram</label><input type="text" value={inlineValues.instagram ?? ''} onChange={e => setInlineValues({ ...inlineValues, instagram: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" /></div>
                      <div><label className="text-slate-500 block text-xs font-medium mb-1">WeChat ID</label><input type="text" value={inlineValues.wechat ?? ''} onChange={e => setInlineValues({ ...inlineValues, wechat: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" /></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><Phone size={16} /></div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-medium">Primary Phone</p>
                        {(isSelfView || canViewSensitiveFields || (member.privacy?.showPhone ?? true)) ? <p className="text-sm font-bold">{member.contact?.phone || 'N/A'}</p> : <RestrictedField />}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><Phone size={16} className="rotate-90" /></div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-medium">Alternate Phone</p>
                        {(isSelfView || canViewSensitiveFields || (member.privacy?.showAlternatePhone ?? true)) ? <p className="text-sm font-bold">{member.contact?.alternatePhone || 'N/A'}</p> : <RestrictedField />}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-jci-blue"><MessageCircle size={16} /></div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-medium">WhatsApp Group</p>
                        <p className="text-sm font-bold">{member.contact?.whatsappJoined ? 'Yes' : 'Not Added'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"><MapPin size={16} /></div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-medium">Address</p>
                        {canViewSensitiveFields ? <p className="text-sm text-slate-700">{member.contact?.address || 'No address on file'}</p> : <RestrictedField />}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1">Emergency Contact</h4>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{member.contact?.emergency?.name || 'None Listed'}</p>
                      <p className="text-xs text-slate-500">{member.contact?.emergency?.relationship} • {member.contact?.emergency?.phone}</p>
                    </div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1 mt-4">Social Media</h4>
                    {(isSelfView || canViewSensitiveFields || (member.privacy?.showSocials ?? true)) ? (
                      <div className="flex gap-4 items-center">
                        {member.contact?.socials?.linkedin ? <a href={member.contact?.socials?.linkedin} target="_blank" rel="noreferrer" className="text-[#0077B5]"><Linkedin size={20} /></a> : <Linkedin size={20} className="text-slate-300" />}
                        {member.contact?.socials?.facebook ? <a href={member.contact?.socials?.facebook} target="_blank" rel="noreferrer" className="text-[#1877F2]"><Facebook size={20} /></a> : <Facebook size={20} className="text-slate-300" />}
                        {member.contact?.socials?.instagram ? <a href={member.contact?.socials?.instagram} target="_blank" rel="noreferrer" className="text-[#E1306C]"><Instagram size={20} /></a> : <Instagram size={20} className="text-slate-300" />}
                        {member.contact?.socials?.wechat ? <div className="text-[#07C160]"><MessageCircle size={20} /></div> : <MessageCircle size={20} className="text-slate-300" />}
                      </div>
                    ) : <RestrictedField />}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Professional & Business ── */}
          {activeInfoTab === 'professional' && (
            <div className="px-5 pb-5">
              <H3>Professional & Business</H3>
              {/* Company header banner (view mode only) */}
              {!isEditMode && (member.companyName || member.industry) && activeInlineEditCard !== 'professional' && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-slate-900 truncate">{member.companyName || '—'}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{[member.business?.departmentAndPosition, member.industry].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {member.industry && <span className="px-3 py-1 rounded-full bg-blue-50 text-jci-blue text-xs font-bold border border-blue-100">{member.industry}</span>}
                    {member.business?.acceptInternationalBusiness && member.business?.acceptInternationalBusiness !== 'No' && <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">🌐 Intl Business</span>}
                    {member.business?.companyWebsite && <a href={toExternalWebsiteUrl(member.business?.companyWebsite)} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-colors flex items-center gap-1"><ArrowUpRight size={11} /> Website</a>}
                  </div>
                </div>
              )}
              {isEditMode && inlineValues ? (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-slate-500 block text-xs uppercase font-medium mb-1">Company Name</label><input type="text" value={inlineValues.companyName} onChange={e => setInlineValues({ ...inlineValues, companyName: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" /></div>
                    <div><label className="text-slate-500 block text-xs uppercase font-medium mb-1">Company Website</label><input type="text" value={inlineValues.companyWebsite ?? ''} onChange={e => setInlineValues({ ...inlineValues, companyWebsite: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" /></div>
                    <div className="col-span-2"><label className="text-slate-500 block text-xs uppercase font-medium mb-1">Company Description</label><textarea value={inlineValues.companyDescription ?? ''} onChange={e => setInlineValues({ ...inlineValues, companyDescription: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue resize-y" /></div>
                    <div><label className="text-slate-500 block text-xs uppercase font-medium mb-1">Position / Title</label><input type="text" value={inlineValues.departmentAndPosition ?? ''} onChange={e => setInlineValues({ ...inlineValues, departmentAndPosition: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" /></div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Level of Mgmt</label>
                      <select value={inlineValues.levelOfManagement ?? ''} onChange={e => setInlineValues({ ...inlineValues, levelOfManagement: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white">
                        <option value="">Select Level</option>
                        <option value="Top">Top</option>
                        <option value="Middle">Middle</option>
                        <option value="Frontline">Frontline</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Industry</label>
                      <select value={inlineValues.industry} onChange={e => setInlineValues({ ...inlineValues, industry: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white">
                        <option value="">Select Industry</option>
                        {INDUSTRY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Intl. Business Engagement</label>
                      <select value={inlineValues.acceptInternationalBusiness ?? ''} onChange={e => setInlineValues({ ...inlineValues, acceptInternationalBusiness: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white">
                        <option value="">Select Option</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                        <option value="Willing to Explore">Willing to Explore</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t pt-3">
                    <div className="col-span-2">
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Business Categories</label>
                      <MultiSelectDropdown options={BUSINESS_CATEGORIES_OPTIONS} selected={inlineValues.businessCategory ?? []} onChange={selected => setInlineValues({ ...inlineValues, businessCategory: selected })} placeholder="Select categories..." />
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ideal Referral Industry</label>
                      <MultiSelectDropdown options={INDUSTRY_OPTIONS} selected={inlineValues.idealReferralIndustry ? [...new Set<string>(inlineValues.idealReferralIndustry.split('||').flatMap((v: string) => v.split(', ')).filter(Boolean))] : []} onChange={selected => setInlineValues({ ...inlineValues, idealReferralIndustry: selected.join('||') })} placeholder="Select industries..." />
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ideal Referral</label>
                      <MultiSelectDropdown options={IDEAL_REFERRAL_OPTIONS.map(opt => opt.label)} selected={Array.isArray(inlineValues.idealReferral) ? inlineValues.idealReferral : (inlineValues.idealReferral ? String(inlineValues.idealReferral).split(', ').filter(Boolean) : [])} onChange={selected => setInlineValues({ ...inlineValues, idealReferral: selected.join(', ') })} placeholder="Select referrals..." />
                    </div>
                  </div>
                  <div className="border-t pt-3 space-y-2">
                    <label className="text-slate-500 block text-xs uppercase font-medium">Special Member Offers</label>
                    <button type="button" onClick={openNew} className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:border-jci-blue hover:text-jci-blue hover:bg-blue-50/40 transition-colors">
                      <div className="w-8 h-8 rounded-md border border-dashed border-current flex items-center justify-center shrink-0"><Plus size={13} /></div>
                      <span className="text-xs font-semibold">Add Offer</span>
                    </button>
                    {offers.map((o, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-colors">
                        <div className="w-16 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-100 flex items-center justify-center">
                          {o.imageUrl ? <img src={o.imageUrl} alt="" className="w-full h-full object-cover" /> : o.logoUrl ? <img src={o.logoUrl} alt="" className="w-full h-full object-contain p-1 bg-white" /> : <Upload size={13} className="text-slate-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{o.description}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${(o.status ?? 'Active') === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{o.status ?? 'Active'}</span>
                        </div>
                        <button type="button" onClick={() => openEdit(idx)} className="p-1.5 rounded-lg text-slate-400 hover:text-jci-blue hover:bg-blue-50 transition-colors"><Pencil size={13} /></button>
                        <button type="button" onClick={() => deleteOffer(idx)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-5 text-sm">
                  <div>
                    <span className="text-slate-500 text-xs uppercase font-medium">Company Name</span>
                    <p className="font-bold text-slate-900 leading-tight mt-0.5">{member.companyName || 'Freelance / Not Provided'}</p>
                    {member.business?.companyWebsite && <a href={toExternalWebsiteUrl(member.business?.companyWebsite)} target="_blank" rel="noopener noreferrer" className="text-xs text-jci-blue hover:underline block mt-1">{member.business?.companyWebsite}</a>}
                    {member.business?.companyDescription && <p className="text-xs text-slate-500 leading-relaxed mt-1.5">{member.business.companyDescription}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                    <div><span className="text-slate-500 text-xs uppercase font-medium">Position</span><p className="font-medium text-slate-900 mt-0.5">{member.business?.departmentAndPosition || 'Not provided'}</p></div>
                    <div><span className="text-slate-500 text-xs uppercase font-medium">Level of Mgmt</span><p className="font-medium text-slate-900 mt-0.5">{member.business?.levelOfManagement || 'Not provided'}</p></div>
                    <div><span className="text-slate-500 text-xs uppercase font-medium">Industry</span><p className="font-medium text-slate-900 mt-0.5">{member.industry || 'Not provided'}</p></div>
                    <div><span className="text-slate-500 text-xs uppercase font-medium">Intl. Business</span><p className="font-medium text-slate-900 mt-0.5">{member.business?.acceptInternationalBusiness || 'Unknown'}</p></div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs uppercase font-medium">Business Categories</span>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Array.isArray(member.business?.businessCategory) && member.business?.businessCategory.length > 0
                        ? member.business?.businessCategory.map((cat, idx) => <Badge key={idx} variant="neutral" className="text-[10px]">{cat}</Badge>)
                        : <span className="text-slate-400 italic">None</span>}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-500 text-xs uppercase font-medium">Ideal Referral Industry</span>
                        <div className="mt-1 text-slate-700 font-medium leading-snug">
                          {member.idealReferralIndustry ? <span className="text-xs leading-relaxed">{member.idealReferralIndustry}</span> : <span className="text-slate-400 italic font-normal">None</span>}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs uppercase font-medium">Ideal Referral</span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {Array.isArray(member.business?.idealReferrals) && member.business?.idealReferrals.length > 0
                            ? member.business?.idealReferrals.map((type, idx) => <Badge key={idx} variant="info" className="text-[10px] bg-sky-50 text-sky-600 border-sky-100">{type}</Badge>)
                            : member.business?.idealReferrals
                              ? <span className="text-sm text-slate-700 font-medium">{member.business?.idealReferrals}</span>
                              : <span className="text-slate-400 italic font-normal">None</span>}
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const allOffers: SpecialOffer[] = member.business?.specialOffers ?? (member.business?.specialOffer ? [typeof member.business.specialOffer === 'string' ? { description: member.business.specialOffer } : member.business.specialOffer] : []);
                      if (allOffers.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          {allOffers.map((offerObj, idx) => {
                            const isActive = !offerObj.status || offerObj.status === 'Active';
                            return (
                              <div key={idx} className="rounded-xl border border-slate-200 overflow-hidden">
                                {offerObj.imageUrl && <div className="aspect-[3/1] w-full bg-slate-100 overflow-hidden"><img src={offerObj.imageUrl} alt="Ad banner" className="w-full h-full object-cover" /></div>}
                                <div className="p-4 flex items-start gap-3">
                                  {offerObj.logoUrl && <img src={offerObj.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-contain border border-slate-100 bg-white p-0.5 shrink-0 shadow-sm" />}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <span className="text-[10px] font-black text-jci-blue uppercase tracking-widest">Special Offer</span>
                                      {offerObj.status && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{offerObj.status}</span>}
                                    </div>
                                    <p className="font-bold text-slate-900 text-sm leading-snug">{offerObj.description}</p>
                                    {offerObj.terms && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{offerObj.terms}</p>}
                                    {offerObj.expiryDate && <p className="text-[11px] text-slate-400 mt-1.5">Expires {new Date(offerObj.expiryDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Hobby Clubs ── */}
          {activeInfoTab === 'clubs' && (
            <div className="px-5 pb-5">
              <H3>Hobby Clubs</H3>
              {loadingClubs ? (
                <div className="text-center py-8 text-slate-400 text-sm">Loading clubs...</div>
              ) : memberClubs.length > 0 ? (
                <div className="space-y-2">
                  {memberClubs.map(club => (
                    <div key={club.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{club.name}</p>
                        <p className="text-xs text-slate-500">{club.category}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">Not a member of any clubs</div>
              )}
            </div>
          )}

          {/* ── Apparel & Items ── */}
          {activeInfoTab === 'apparel' && (
            <div className="px-5 pb-5">
              <H3>Apparel & Items</H3>
              {isEditMode && inlineValues ? (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Cut Style</label>
                      <select value={inlineValues.cutStyle ?? ''} onChange={e => setInlineValues({ ...inlineValues, cutStyle: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white">
                        <option value="">Select Cut</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">T-Shirt Size</label>
                      <select value={inlineValues.tshirtSize ?? ''} onChange={e => setInlineValues({ ...inlineValues, tshirtSize: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white">
                        <option value="">Select Size</option>
                        {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Jacket Size</label>
                      <select value={inlineValues.jacketSize ?? ''} onChange={e => setInlineValues({ ...inlineValues, jacketSize: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white">
                        <option value="">Select Size</option>
                        {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Delivery Status</label>
                      <select value={inlineValues.tshirtStatus ?? ''} onChange={e => setInlineValues({ ...inlineValues, tshirtStatus: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white">
                        <option value="NA">NA</option>
                        <option value="Pending">Pending</option>
                        <option value="Received">Received</option>
                        <option value="Delivered">Delivered</option>
                      </select>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Embroidered Name</label>
                    <input type="text" value={inlineValues.embroideredName ?? ''} onChange={e => setInlineValues({ ...inlineValues, embroideredName: e.target.value })} placeholder="Embroidered Name on Jacket" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 border rounded-lg text-center"><span className="text-slate-500 block text-[10px] uppercase font-bold">Cut Style</span><p className="font-bold text-slate-900">{member.others?.shirtStyle || 'N/A'}</p></div>
                    <div className="p-3 border rounded-lg text-center"><span className="text-slate-500 block text-[10px] uppercase font-bold">T-Shirt</span><p className="font-bold text-slate-900">{member.others?.tshirtSize || 'N/A'}</p></div>
                    <div className="p-3 border rounded-lg text-center"><span className="text-slate-500 block text-[10px] uppercase font-bold">Jacket</span><p className="font-bold text-slate-900">{member.others?.jacketSize || 'N/A'}</p></div>
                    <div className="p-3 border rounded-lg text-center">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Delivery Status</span>
                      <Badge variant={member.others?.tshirtStatus === 'Received' || member.others?.tshirtStatus === 'Delivered' ? 'success' : 'warning'}>
                        {member.others?.tshirtStatus || 'N/A'}
                      </Badge>
                    </div>
                  </div>
                  {member.others?.embroideredName && (
                    <div className="mt-4 p-2 bg-slate-50 rounded text-center border-t border-slate-200">
                      <span className="text-xs text-slate-500">Embroidered Name: </span>
                      <span className="text-sm font-bold text-slate-900 italic">"{member.others?.embroideredName}"</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Special Offer Drawer — outside scroll container */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingIndex === null ? 'Add Special Offer' : 'Edit Offer'}
        position="bottom"
        size="xl"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setDrawerOpen(false)} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="button" onClick={saveDrawer} disabled={!draftOffer.description.trim()} className="flex-1 h-10 rounded-xl bg-jci-blue text-white text-sm font-bold disabled:opacity-40 hover:bg-blue-600 transition-colors">Save</button>
          </div>
        }
      >
        <div className="space-y-4 text-sm p-1">
          <div>
            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Offer Description *</label>
            <input type="text" placeholder="e.g. 10% off first order for JCI KL members" value={draftOffer.description} onChange={e => updateDraft({ description: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:outline-none" />
          </div>
          <div>
            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Terms & Conditions</label>
            <textarea rows={3} placeholder="Terms & conditions (optional)" value={draftOffer.terms ?? ''} onChange={e => updateDraft({ terms: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-slate-500 font-medium">Company Logo</p>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 aspect-square flex items-center justify-center overflow-hidden">
                {draftOffer.logoUrl ? <img src={draftOffer.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" /> : <Upload size={18} className="text-slate-300" />}
              </div>
              <div className="flex items-center gap-1.5">
                <label className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${uploadingLogo ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-700 border-slate-300 hover:border-jci-blue hover:text-jci-blue'}`}>
                  <Upload size={11} />{uploadingLogo ? 'Uploading…' : 'Upload'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={handleLogoUpload} />
                </label>
                {draftOffer.logoUrl && <button type="button" onClick={() => updateDraft({ logoUrl: '' })} className="text-xs text-slate-400 hover:text-red-500">Remove</button>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-slate-500 font-medium">Ad Banner</p>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 aspect-square flex items-center justify-center overflow-hidden">
                {draftOffer.imageUrl ? <img src={draftOffer.imageUrl} alt="Banner" className="w-full h-full object-cover" /> : <Upload size={18} className="text-slate-300" />}
              </div>
              <div className="flex items-center gap-1.5">
                <label className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${uploadingBanner ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-700 border-slate-300 hover:border-jci-blue hover:text-jci-blue'}`}>
                  <Upload size={11} />{uploadingBanner ? 'Uploading…' : 'Upload'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingBanner} onChange={handleBannerUpload} />
                </label>
                {draftOffer.imageUrl && <button type="button" onClick={() => updateDraft({ imageUrl: '' })} className="text-xs text-slate-400 hover:text-red-500">Remove</button>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <label className="text-xs text-slate-500 whitespace-nowrap">Status</label>
            <div className="flex gap-2">
              {(['Active', 'Paused'] as const).map(s => (
                <button key={s} type="button" onClick={() => updateDraft({ status: s })}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${(draftOffer.status ?? 'Active') === s ? s === 'Active' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-400 text-white border-slate-400' : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'}`}>{s}</button>
              ))}
            </div>
            <label className="text-xs text-slate-500 whitespace-nowrap ml-auto">Expiry</label>
            <input type="date" value={draftOffer.expiryDate ?? ''} onChange={e => updateDraft({ expiryDate: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:outline-none" />
          </div>
        </div>
      </Drawer>
    </>
  );
};

export const MemberDetailBasicTab = React.memo(MemberDetailBasicTabBase);
