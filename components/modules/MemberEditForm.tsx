import React, { useState, useEffect, useMemo } from 'react';
import { Button, Tabs } from '../ui/Common';
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown';
import { Member, UserRole, MemberTier, MembershipType, MembershipDues, MembershipRuleConfig } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { MEMBER_SELF_EDITABLE_FIELDS, INDUSTRY_OPTIONS, IDEAL_REFERRAL_OPTIONS, BUSINESS_CATEGORIES_OPTIONS, nationalityOptionsForValue } from '../../config/constants';
import {
  MembershipConfigService,
  computeMembershipTypeFromMember,
} from '../../services/membershipConfigService';
import { MembershipTypeDisplay } from '../shared/MembershipTypeDisplay';
import { deleteFromCloudinary, uploadMemberAvatarToCloudinary } from '../../services/cloudinaryService';

interface MemberEditFormProps {
  member: Member;
  onSubmit: (updates: Partial<Member>) => void | Promise<void>;
  onCancel: () => void;
  /** When true (member/guest self-edit), only Contact + Apparel tabs, submit restricted to MEMBER_SELF_EDITABLE_FIELDS */
  selfEditableOnly?: boolean;
  initialTab?: 'basic' | 'professional' | 'contact' | 'apparel' | 'membership';
}

const HOBBY_OPTIONS = [
  "Art & Design", "Badminton", "Baking", "Basketball", "Car Enthusiast",
  "Cigar", "Cooking", "Cycling", "Dancing", "Diving",
  "E-Sport Mlbb", "Fashion", "Golf", "Hiking", "Leadership",
  "Liquor/ Wine Tasting", "Make Up", "Movie", "Other E-Sport", "Pickle Ball",
  "Pilates", "Public Speaking", "Reading", "Rock Climbing", "Singing",
  "Social Etiquette", "Social Service", "Travelling", "Women Empowerment", "Yoga"
];

function initFormValues(member: Member) {
  return {
    // Basic Information
    name: member.name || '',
    fullName: member.fullName || '',
    idNumber: member.idNumber || '',
    dateOfBirth: member.dateOfBirth || '',
    gender: member.gender || '',
    ethnicity: member.ethnicity || '',
    nationality: member.nationality || 'Malaysia',
    introducer: member.introducer || '',
    bio: member.bio || '',
    avatar: member.avatar || member.avatarUrl || member.general?.avatarUrl || '',
    hobbies: Array.isArray(member.hobbies) ? member.hobbies : (member.hobbies ? [member.hobbies] : []),
    skills: Array.isArray(member.skills) ? member.skills.join(', ') : (member.skills || ''),

    // Membership & Status
    role: member.role,
    tier: member.tier,
    membershipType: member.membershipType || '',
    senatorCertified: member.senatorCertified || false,
    senatorshipId: member.senatorshipId || '',
    senatorshipBoardValidated: member.senatorshipBoardValidated || false,
    attendanceRate: member.attendanceRate ?? 0,
    churnRisk: member.churnRisk,

    // Professional & Business
    companyName: member.companyName || '',
    companyWebsite: member.companyWebsite || '',
    companyDescription: member.companyDescription || '',
    departmentAndPosition: member.departmentAndPosition || '',
    levelOfManagement: member.levelOfManagement || '',
    idealReferralIndustry: member.idealReferralIndustry || '',
    idealReferral: member.idealReferral || (Array.isArray(member.idealReferrals) ? member.idealReferrals.join(', ') : ''),
    acceptInternationalBusiness: member.acceptInternationalBusiness || '',
    businessCategory: Array.isArray(member.businessCategory) ? member.businessCategory : (member.businessCategory ? [member.businessCategory] : []),
    industry: member.industry || '',
    interestedIndustries: Array.isArray(member.interestedIndustries) ? member.interestedIndustries : (member.interestedIndustries ? [member.interestedIndustries] : []),
    internationalPartnershipTypes: Array.isArray(member.internationalPartnershipTypes) ? member.internationalPartnershipTypes : (member.internationalPartnershipTypes ? [member.internationalPartnershipTypes] : []),

    // Contact Information
    phone: member.phone || '',
    alternatePhone: member.alternatePhone || '',
    whatsappGroup: !!member.whatsappGroup,
    email: member.email || '',
    address: member.address || '',
    linkedin: member.linkedin || '',
    facebook: member.facebook || '',
    instagram: member.instagram || '',
    wechat: member.wechat || '',
    emergencyContactName: member.emergencyContactName || '',
    emergencyContactPhone: member.emergencyContactPhone || '',
    emergencyContactRelationship: member.emergencyContactRelationship || '',

    // Apparel & Items
    cutStyle: member.cutStyle || '',
    tshirtSize: member.tshirtSize || '',
    jacketSize: member.jacketSize || '',
    embroideredName: member.embroideredName || '',
    tshirtStatus: (member.tshirtStatus as string) || 'NA',
    // Approval year for GUEST -> PROBATION transition
    membershipYear: member.joinDate ? new Date(member.joinDate).getFullYear() : new Date().getFullYear(),
  };
}

export const MemberEditForm: React.FC<MemberEditFormProps> = ({ member, onSubmit, onCancel, selfEditableOnly = false, initialTab }) => {
  const { isAdmin, isDeveloper } = usePermissions();
  const canEditSystemStatus = isAdmin || isDeveloper;
  const [activeTab, setActiveTab] = useState<'basic' | 'professional' | 'contact' | 'apparel' | 'membership'>(
    initialTab || (selfEditableOnly ? 'contact' : 'basic')
  );
  const [formValues, setFormValues] = useState(() => initFormValues(member));
  const [membershipRules, setMembershipRules] = useState<Record<MembershipType, MembershipRuleConfig> | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    MembershipConfigService.getRules().then(setMembershipRules).catch(() => { });
  }, []);

  useEffect(() => {
    setFormValues(initFormValues(member));
  }, [member.id]);

  const membershipTypePreview = useMemo(
    () => ({
      nationality: formValues.nationality,
      dateOfBirth: formValues.dateOfBirth,
      senatorCertified: member.senatorCertified,
      senatorshipId: formValues.senatorshipId,
      senatorshipBoardValidated: member.senatorshipBoardValidated,
      role: formValues.role,
      membershipType: member.membershipType,
    }),
    [formValues, member.membershipType, member.senatorCertified, member.senatorshipBoardValidated]
  );

  const handleChange = (field: string, value: string | number | boolean | string[]) => {
    setFormValues(prev => {
      const newValues = { ...prev, [field]: value };

      // If role changed to PROBATION, default the year to joinDate year (from original member or form)
      if (field === 'role' && value === UserRole.PROBATION && (member.role === UserRole.GUEST || !member.role)) {
        if (member.joinDate) {
          newValues.membershipYear = new Date(member.joinDate).getFullYear();
        } else {
          newValues.membershipYear = new Date().getFullYear();
        }
      }

      return newValues;
    });
  };

  const currentAvatar = formValues.avatar;

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      window.alert('Please upload an image file.');
      return;
    }

    setAvatarUploading(true);
    setAvatarUploadProgress(0);
    try {
      const uploadedUrl = await uploadMemberAvatarToCloudinary(file, member, setAvatarUploadProgress);
      handleChange('avatar', uploadedUrl);
    } catch (err) {
      console.error('Failed to upload member avatar:', err);
      window.alert(err instanceof Error ? err.message : 'Failed to upload avatar.');
    } finally {
      setAvatarUploading(false);
      setAvatarUploadProgress(0);
    }
  };

  const handleAvatarDelete = () => {
    if (!currentAvatar) return;
    handleChange('avatar', '');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const skillsArr = (formValues.skills || '')
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    const interestedIndustriesArr = formValues.interestedIndustries;

    const senatorshipLocked = member.senatorshipBoardValidated === true;
    const senatorshipIdValue = senatorshipLocked
      ? String(member.senatorshipId || '')
      : formValues.senatorshipId?.toString().trim() ?? '';

    const computedMembershipType =
      membershipRules
        ? computeMembershipTypeFromMember(
          {
            nationality: formValues.nationality,
            dateOfBirth: formValues.dateOfBirth,
            senatorCertified: member.senatorCertified,
            senatorshipId: senatorshipIdValue,
            senatorshipBoardValidated: member.senatorshipBoardValidated,
            role: (formValues.role as UserRole) || member.role,
            membershipType: member.membershipType,
          },
          membershipRules
        )
        : member.membershipType;

    const updates: Partial<Member> = {
      name: formValues.name || member.name,
      avatar: formValues.avatar || '',
      avatarUrl: formValues.avatar || '',
      email: formValues.email || member.email,
      phone: formValues.phone || undefined,
      introducer: formValues.introducer || undefined,
      bio: formValues.bio || undefined,
      role: (formValues.role as UserRole) || member.role,
      tier: (formValues.tier as MemberTier) || member.tier,
      attendanceRate: typeof formValues.attendanceRate === 'number' ? formValues.attendanceRate : member.attendanceRate,
      churnRisk: formValues.churnRisk || member.churnRisk,
      membershipType: computedMembershipType,
      ...(!senatorshipLocked
        ? { senatorshipId: senatorshipIdValue }
        : {}),

      fullName: formValues.fullName || undefined,
      idNumber: formValues.idNumber || undefined,
      gender: (formValues.gender as Member['gender']) || undefined,
      ethnicity: (formValues.ethnicity as Member['ethnicity']) || undefined,
      nationality: formValues.nationality || undefined,
      dateOfBirth: formValues.dateOfBirth || undefined,
      hobbies: formValues.hobbies.length > 0 ? formValues.hobbies : undefined,
      skills: skillsArr.length > 0 ? skillsArr : member.skills,

      companyName: formValues.companyName || undefined,
      companyWebsite: formValues.companyWebsite || undefined,
      companyDescription: formValues.companyDescription || undefined,
      departmentAndPosition: formValues.departmentAndPosition || undefined,
      levelOfManagement: formValues.levelOfManagement || undefined,
      idealReferralIndustry: formValues.idealReferralIndustry || undefined,
      idealReferral: formValues.idealReferral || undefined,
      acceptInternationalBusiness: (formValues.acceptInternationalBusiness as Member['acceptInternationalBusiness']) || undefined,
      businessCategory: formValues.businessCategory.length > 0 ? formValues.businessCategory : undefined,
      industry: formValues.industry || undefined,
      interestedIndustries: interestedIndustriesArr.length > 0 ? interestedIndustriesArr : undefined,
      internationalPartnershipTypes: formValues.internationalPartnershipTypes,
      alternatePhone: formValues.alternatePhone || member.alternatePhone,
      address: formValues.address || undefined,
      linkedin: formValues.linkedin || undefined,

      facebook: formValues.facebook || undefined,
      instagram: formValues.instagram || undefined,
      wechat: formValues.wechat || undefined,
      emergencyContactName: formValues.emergencyContactName || undefined,
      emergencyContactPhone: formValues.emergencyContactPhone || undefined,
      emergencyContactRelationship: formValues.emergencyContactRelationship || undefined,

      cutStyle: (formValues.cutStyle as Member['cutStyle']) || undefined,
      tshirtSize: (formValues.tshirtSize as Member['tshirtSize']) || undefined,
      jacketSize: (formValues.jacketSize as Member['jacketSize']) || undefined,
      embroideredName: formValues.embroideredName || undefined,
      tshirtStatus: (formValues.tshirtStatus as Member['tshirtStatus']) || undefined,
    };

    // Handle GUEST -> PROBATION membership initialization
    if (formValues.role === UserRole.PROBATION && (member.role === UserRole.GUEST || !member.role)) {
      const yearStr = String(formValues.membershipYear);
      updates.membership = {
        ...(member.membership || {}),
        [yearStr]: {
          year: formValues.membershipYear,
          dues: (member.hasPaidInitiationFee ? 0 : 50) + MembershipDues.Probation, // 300 + 50 = 350
          amount: 0,
          status: 'pending',
          transactionId: []
        }
      };
    }

    const filteredUpdates = selfEditableOnly
      ? (Object.fromEntries(
        Object.entries(updates).filter(([k]) =>
          (MEMBER_SELF_EDITABLE_FIELDS as readonly string[]).includes(k) ||
          k === 'avatar' ||
          k === 'avatarUrl'
        )
      ) as Partial<Member>)
      : updates;

    await onSubmit(filteredUpdates);

    const originalAvatar = member.avatar || member.avatarUrl || member.general?.avatarUrl || '';
    if (originalAvatar && originalAvatar !== formValues.avatar) {
      deleteFromCloudinary(originalAvatar).catch((err) => {
        console.error('Failed to delete previous member avatar from Cloudinary:', err);
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 space-y-0">
      <div className="shrink-0 -mx-4 md:mx-0 px-4 md:px-0 border-b md:border-b-0 overflow-x-auto no-scrollbar">
        <Tabs
          tabs={['Basic Information', 'Professional & Business', 'Contact Information', 'Membership & Status', 'Apparel & Items']}
          activeTab={
            activeTab === 'basic' ? 'Basic Information' :
              activeTab === 'membership' ? 'Membership & Status' :
                activeTab === 'professional' ? 'Professional & Business' :
                  activeTab === 'contact' ? 'Contact Information' : 'Apparel & Items'
          }
          onTabChange={(tab) => {
            if (tab === 'Basic Information') setActiveTab('basic');
            else if (tab === 'Membership & Status') setActiveTab('membership');
            else if (tab === 'Professional & Business') setActiveTab('professional');
            else if (tab === 'Contact Information') setActiveTab('contact');
            else if (tab === 'Apparel & Items') setActiveTab('apparel');
          }}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 md:pr-2 py-4 md:py-6">
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white bg-slate-200 shadow-sm shrink-0">
                {currentAvatar ? (
                  <img src={currentAvatar} alt={formValues.name || member.name || 'Member avatar'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl font-black text-jci-blue bg-blue-50">
                    {(formValues.name || member.name || 'M').charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">Member Avatar</p>
                <p className="text-xs text-slate-500 mt-0.5">Upload a square profile photo for member directory, dashboard, and public board display.</p>
                {avatarUploading && (
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-jci-blue transition-all" style={{ width: `${avatarUploadProgress}%` }} />
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <label className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold transition-colors ${avatarUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-jci-blue text-white hover:bg-jci-navy cursor-pointer'}`}>
                  {avatarUploading ? 'Uploading...' : 'Upload Photo'}
                  <input type="file" accept="image/*" className="hidden" disabled={avatarUploading} onChange={handleAvatarUpload} />
                </label>
                {currentAvatar && (
                  <Button type="button" variant="outline" onClick={handleAvatarDelete} disabled={avatarUploading} className="text-red-600 border-red-200 hover:bg-red-50">
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-6 md:gap-y-4">
              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Name<span className="text-red-500 ml-1">*</span></label>
                <input name="name" value={formValues.name} onChange={(e) => handleChange('name', e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Full Name</label>
                <input name="fullName" value={formValues.fullName} onChange={(e) => handleChange('fullName', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">ID Number</label>
                <input name="idNumber" value={formValues.idNumber} onChange={(e) => handleChange('idNumber', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Date of Birth</label>
                <input name="dateOfBirth" type="date" value={formValues.dateOfBirth} onChange={(e) => handleChange('dateOfBirth', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Gender</label>
                <div className="flex w-full rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200">
                  {['Male', 'Female'].map((opt) => (
                    <label key={opt} className="cursor-pointer flex-1 flex">
                      <input type="radio" name="gender" value={opt} checked={formValues.gender === opt} onChange={(e) => handleChange('gender', e.target.value)} className="hidden" />
                      <span className={`flex-1 text-center px-2 py-2 md:py-2 text-sm md:text-sm font-medium transition-colors ${formValues.gender === opt ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Nationality</label>
                <select name="nationality" value={formValues.nationality} onChange={(e) => handleChange('nationality', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white">
                  {nationalityOptionsForValue(formValues.nationality).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Introducer</label>
                <input name="introducer" value={formValues.introducer} onChange={(e) => handleChange('introducer', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
            </div>
            <div>
              <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ethnicity</label>
              <div className="flex w-full rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200">
                {['Chinese', 'Malay', 'Indian', 'Others'].map((opt) => (
                  <label key={opt} className="cursor-pointer flex-1 flex">
                    <input type="radio" name="ethnicity" value={opt} checked={formValues.ethnicity === opt} onChange={(e) => handleChange('ethnicity', e.target.value)} className="hidden" />
                    <span className={`flex-1 text-center px-1 md:px-4 py-2 md:py-2 text-[10px] md:text-sm font-medium transition-colors ${formValues.ethnicity === opt ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Personal Biography</label>
              <textarea name="bio" value={formValues.bio} onChange={(e) => handleChange('bio', e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-y min-h-[100px]" />
            </div>
            <div>
              <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Hobbies</label>
              <div className="flex flex-wrap gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50/30">
                {HOBBY_OPTIONS.map(opt => (
                  <label key={opt} className="cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formValues.hobbies.includes(opt)}
                      onChange={(e) => {
                        const newHobbies = e.target.checked ? [...formValues.hobbies, opt] : formValues.hobbies.filter(h => h !== opt);
                        handleChange('hobbies', newHobbies);
                      }}
                      className="hidden"
                    />
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold md:font-medium transition-colors border-2 ${formValues.hobbies.includes(opt) ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-700 border-slate-300 hover:border-jci-blue'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Skills</label>
              <input name="skills" value={formValues.skills} onChange={(e) => handleChange('skills', e.target.value)} placeholder="e.g., Public Speaking, Management" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
            </div>
          </div>
        )}

        {activeTab === 'membership' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-6 md:gap-y-4">
              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Current Role</label>
                <select
                  name="role"
                  value={formValues.role}
                  onChange={(e) => handleChange('role', e.target.value)}
                  disabled={!canEditSystemStatus}
                  className={`w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white ${!canEditSystemStatus ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                >
                  {[UserRole.GUEST, UserRole.MEMBER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INACTIVE].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Member Tier</label>
                <select
                  name="tier"
                  value={formValues.tier}
                  onChange={(e) => handleChange('tier', e.target.value)}
                  disabled={!canEditSystemStatus}
                  className={`w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white ${!canEditSystemStatus ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                >
                  {['Bronze', 'Silver', 'Gold', 'Platinum'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Show year selection only when approving a Guest */}
              {formValues.role === UserRole.PROBATION && (member.role === UserRole.GUEST || !member.role) && (
                <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                  <label className="md:w-40 md:shrink-0 text-sm font-bold text-amber-600">Initiation Year</label>
                  <select
                    value={formValues.membershipYear}
                    onChange={(e) => handleChange('membershipYear', parseInt(e.target.value))}
                    disabled={!canEditSystemStatus}
                    className={`w-full rounded-lg border-2 border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 ${!canEditSystemStatus ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 2 - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-6 md:gap-y-4">
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">
                    Membership Type
                  </label>
                  <MembershipTypeDisplay member={membershipTypePreview} showDetails={false} />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">
                    Senatorship Number
                  </label>
                  <div className="space-y-1">
                    <input
                      name="senatorshipId"
                      value={formValues.senatorshipId}
                      onChange={(e) => handleChange('senatorshipId', e.target.value)}
                      disabled={member.senatorshipBoardValidated === true}
                      placeholder="e.g. 12345"
                      className={`w-full rounded-lg border px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 ${member.senatorshipBoardValidated
                          ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed'
                          : 'border-slate-300 bg-white'
                        }`}
                    />
                    {member.senatorshipBoardValidated && (
                      <p className="text-xs text-green-700 leading-snug">
                        <span className="font-medium">Board validated</span>
                        {member.senatorshipValidatedAt && (
                          <span className="text-slate-500">
                            {' '}
                            · {new Date(member.senatorshipValidatedAt).toLocaleDateString()}
                            {member.senatorshipValidatedBy ? ` by ${member.senatorshipValidatedBy}` : ''}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Attendance (%)</label>
                <input
                  name="attendanceRate"
                  type="number"
                  value={String(formValues.attendanceRate)}
                  onChange={(e) => { const v = parseInt(e.target.value, 10); handleChange('attendanceRate', isNaN(v) ? 0 : v); }}
                  disabled={!canEditSystemStatus}
                  className={`w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white ${!canEditSystemStatus ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                />
              </div>

              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Churn Risk</label>
                <select
                  name="churnRisk"
                  value={formValues.churnRisk}
                  onChange={(e) => handleChange('churnRisk', e.target.value)}
                  disabled={!canEditSystemStatus}
                  className={`w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white ${!canEditSystemStatus ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                >
                  {['Low', 'Medium', 'High'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'professional' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-8 md:gap-y-3">
            {/* Left Column - Main Fields */}
            <div className="space-y-4">
              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Company</label>
                <input name="companyName" value={formValues.companyName} onChange={(e) => handleChange('companyName', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>

              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Website</label>
                <input name="companyWebsite" type="text" placeholder="https://..." value={formValues.companyWebsite} onChange={(e) => handleChange('companyWebsite', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>

              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Industry</label>
                <select
                  name="industry"
                  value={formValues.industry}
                  onChange={(e) => handleChange('industry', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
                >
                  <option value="">Select...</option>
                  {INDUSTRY_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Position</label>
                <input name="departmentAndPosition" value={formValues.departmentAndPosition} onChange={(e) => handleChange('departmentAndPosition', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>

              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Level of Mgmt</label>
                <select
                  name="levelOfManagement"
                  value={formValues.levelOfManagement}
                  onChange={(e) => handleChange('levelOfManagement', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
                >
                  <option value="">Select Level</option>
                  <option value="Top">Top</option>
                  <option value="Middle">Middle</option>
                  <option value="Frontline">Frontline</option>
                </select>
              </div>

              <div className="mt-2">
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ideal Referral Industry</label>
                <MultiSelectDropdown
                  options={INDUSTRY_OPTIONS}
                  selected={formValues.idealReferralIndustry ? formValues.idealReferralIndustry.split(', ').filter(Boolean) : []}
                  onChange={selected => handleChange('idealReferralIndustry', selected.join(', '))}
                  placeholder="Select industries..."
                />
              </div>

              <div className="mt-2">
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ideal Referral</label>
                <MultiSelectDropdown
                  options={IDEAL_REFERRAL_OPTIONS.map(opt => opt.label)}
                  selected={formValues.idealReferral ? formValues.idealReferral.split(', ').filter(Boolean) : []}
                  onChange={selected => handleChange('idealReferral', selected.join(', '))}
                  placeholder="Select referrals..."
                />
              </div>
            </div>

            {/* Right Column - Description */}
            <div className="mt-2 md:mt-0">
              <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Company Description</label>
              <textarea
                name="companyDescription"
                value={formValues.companyDescription}
                onChange={(e) => handleChange('companyDescription', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-none min-h-[120px]"
                placeholder="Tell us more about your business..."
              />
            </div>

            {/* Bottom Row - Full Width */}
            <div className="col-span-1 md:col-span-2 pt-2">
              <label className="text-slate-500 block text-xs uppercase font-medium mb-1">International</label>
              <div className="flex w-full rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200 bg-white">
                {['Yes', 'No', 'Explore'].map(opt => (
                  <label key={opt} className="cursor-pointer flex-1 flex">
                    <input type="radio" name="acceptInternationalBusiness" value={opt} checked={formValues.acceptInternationalBusiness === (opt === 'Explore' ? 'Willing to Explore' : opt)} onChange={(e) => handleChange('acceptInternationalBusiness', opt === 'Explore' ? 'Willing to Explore' : opt)} className="hidden" />
                    <span className={`flex-1 text-center px-1 md:px-2 py-2 md:py-2 text-sm md:text-sm font-medium transition-colors whitespace-nowrap ${formValues.acceptInternationalBusiness === (opt === 'Explore' ? 'Willing to Explore' : opt) ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Conditional International Partnership Selection */}
            {(formValues.acceptInternationalBusiness === 'Yes' || formValues.acceptInternationalBusiness === 'Willing to Explore') && (
              <div className="col-span-1 md:col-span-2 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300 py-4 px-3 md:px-6 bg-blue-50/50 rounded-xl border border-blue-100/50 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                  <h4 className="text-sm md:text-sm font-bold text-slate-800 uppercase tracking-tight">Global partnerships sought?</h4>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {IDEAL_REFERRAL_OPTIONS.map(opt => (
                    <label key={opt.label} className="group relative flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer">
                      <div className="flex items-center h-5">
                        <input
                          type="checkbox"
                          checked={formValues.internationalPartnershipTypes.includes(opt.label)}
                          onChange={(e) => {
                            const newTypes = e.target.checked
                              ? [...formValues.internationalPartnershipTypes, opt.label]
                              : formValues.internationalPartnershipTypes.filter(t => t !== opt.label);
                            handleChange('internationalPartnershipTypes', newTypes);
                          }}
                          className="w-5 h-5 md:w-4 md:h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold leading-tight ${formValues.internationalPartnershipTypes.includes(opt.label) ? 'text-blue-700' : 'text-slate-700'}`}>
                          {opt.label}
                        </span>
                        {opt.description && (
                          <span className="text-[10px] text-slate-500 mt-1 leading-snug">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="col-span-1 md:col-span-2 pt-2">
              <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Business Category</label>
              <MultiSelectDropdown
                options={BUSINESS_CATEGORIES_OPTIONS}
                selected={formValues.businessCategory}
                onChange={selected => handleChange('businessCategory', selected)}
                placeholder="Select categories..."
              />
            </div>
            <div className="col-span-1 md:col-span-2 pt-2">
              <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Interested Industries</label>
              <div className="flex flex-wrap gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50/30">
                {INDUSTRY_OPTIONS.map(opt => (
                  <label key={opt} className="cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formValues.interestedIndustries.includes(opt)}
                      onChange={(e) => {
                        const newIndustries = e.target.checked
                          ? [...formValues.interestedIndustries, opt]
                          : formValues.interestedIndustries.filter(i => i !== opt);
                        handleChange('interestedIndustries', newIndustries);
                      }}
                      className="hidden"
                    />
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold md:font-medium transition-colors border-2 ${formValues.interestedIndustries.includes(opt) ? 'bg-sky-500 text-white border-sky-500 shadow-sm' : 'bg-white text-slate-700 border-slate-300 hover:border-sky-500'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-jci-blue rounded-full"></div>
                Personal Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-6 md:gap-y-4">
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Phone</label>
                  <input name="phone" type="tel" value={formValues.phone} onChange={(e) => handleChange('phone', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Alt. Phone</label>
                  <input name="alternatePhone" type="tel" value={formValues.alternatePhone} onChange={(e) => handleChange('alternatePhone', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">WhatsApp</label>
                  <div className="py-1">
                    {formValues.whatsappGroup ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold border border-green-200">
                        Joined
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200">
                        No
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Email<span className="text-red-500 ml-1">*</span></label>
                  <input name="email" type="email" value={formValues.email} onChange={(e) => handleChange('email', e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                </div>
                <div className=" col-span-1 md:col-span-2">
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Address</label>
                  <textarea name="address" value={formValues.address} onChange={(e) => handleChange('address', e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-y min-h-[80px]" />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                Social Media
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-6 md:gap-y-4">
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">LinkedIn</label>
                  <input name="linkedin" type="url" value={formValues.linkedin} onChange={(e) => handleChange('linkedin', e.target.value)} placeholder="https://..." className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Facebook</label>
                  <input name="facebook" type="url" value={formValues.facebook} onChange={(e) => handleChange('facebook', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Instagram</label>
                  <input name="instagram" type="url" value={formValues.instagram} onChange={(e) => handleChange('instagram', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">WeChat</label>
                  <input name="wechat" value={formValues.wechat} onChange={(e) => handleChange('wechat', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-6 md:gap-y-4">
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Name</label>
                  <input name="emergencyContactName" value={formValues.emergencyContactName} onChange={(e) => handleChange('emergencyContactName', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Phone</label>
                  <input name="emergencyContactPhone" type="tel" value={formValues.emergencyContactPhone} onChange={(e) => handleChange('emergencyContactPhone', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Relationship</label>
                  <input name="emergencyContactRelationship" value={formValues.emergencyContactRelationship} onChange={(e) => handleChange('emergencyContactRelationship', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'apparel' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-6 md:gap-y-4">
              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Cut Style</label>
                <div className="flex w-full rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200 bg-white">
                  {['Unisex', 'Lady Cut'].map(opt => (
                    <label key={opt} className="cursor-pointer flex-1 flex">
                      <input type="radio" name="cutStyle" value={opt} checked={formValues.cutStyle === opt} onChange={(e) => handleChange('cutStyle', e.target.value)} className="hidden" />
                      <span className={`flex-1 text-center px-1 py-2 md:py-2 text-[10px] md:text-sm font-medium transition-colors ${formValues.cutStyle === opt ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Emb. Name</label>
                <input name="embroideredName" value={formValues.embroideredName} onChange={(e) => handleChange('embroideredName', e.target.value)} placeholder="Uniform name..." className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-6 md:gap-y-4">
              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">T-Shirt Size</label>
                <select
                  name="tshirtSize"
                  value={formValues.tshirtSize}
                  onChange={(e) => handleChange('tshirtSize', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
                >
                  <option value="">Select size...</option>
                  {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL', '7XL'].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Jacket Size</label>
                <select
                  name="jacketSize"
                  value={formValues.jacketSize}
                  onChange={(e) => handleChange('jacketSize', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
                >
                  <option value="">Select size...</option>
                  {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL', '7XL'].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Status</label>
              <select
                name="tshirtStatus"
                value={formValues.tshirtStatus}
                onChange={(e) => handleChange('tshirtStatus', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
              >
                {['NA', 'Requested', 'Sent', 'Delivered', 'Received'].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 pt-4 pb-2 flex gap-3 border-t border-slate-200 mt-auto">
        <Button type="submit" className="flex-1 h-12 md:h-10 text-sm font-bold md:font-medium">Save Changes</Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-12 md:h-10 text-sm font-bold md:font-medium">Cancel</Button>
      </div>
    </form>
  );
};
