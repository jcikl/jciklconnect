import React, { useState, useEffect } from 'react';
import { Button, Tabs } from '../ui/Common';
import { Member, UserRole, MemberTier, MembershipType, MembershipDues } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { MEMBER_SELF_EDITABLE_FIELDS, INDUSTRY_OPTIONS, INTERNATIONAL_PARTNERSHIP_OPTIONS } from '../../config/constants';

interface MemberEditFormProps {
  member: Member;
  onSubmit: (updates: Partial<Member>) => void;
  onCancel: () => void;
  /** When true (member/guest self-edit), only Contact + Apparel tabs, submit restricted to MEMBER_SELF_EDITABLE_FIELDS */
  selfEditableOnly?: boolean;
}

const COUNTRIES = [
  'Malaysia', 'Singapore', 'Indonesia', 'Thailand', 'Vietnam', 'Philippines',
  'China', 'Japan', 'South Korea', 'India', 'Australia', 'New Zealand',
  'United States', 'United Kingdom', 'Canada', 'Germany', 'France', 'Other'
];

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
    hobbies: Array.isArray(member.hobbies) ? member.hobbies : (member.hobbies ? [member.hobbies] : []),
    skills: Array.isArray(member.skills) ? member.skills.join(', ') : (member.skills || ''),

    // Membership & Status
    role: member.role,
    tier: member.tier,
    membershipType: member.membershipType || '',
    senatorCertified: member.senatorCertified || false,
    attendanceRate: member.attendanceRate ?? 0,
    churnRisk: member.churnRisk,

    // Professional & Business
    companyName: member.companyName || '',
    companyWebsite: member.companyWebsite || '',
    companyDescription: member.companyDescription || '',
    departmentAndPosition: member.departmentAndPosition || '',
    acceptInternationalBusiness: member.acceptInternationalBusiness || '',
    businessCategory: Array.isArray(member.businessCategory) ? member.businessCategory : (member.businessCategory ? [member.businessCategory] : []),
    industry: member.industry || '',
    interestedIndustries: Array.isArray(member.interestedIndustries) ? member.interestedIndustries : (member.interestedIndustries ? [member.interestedIndustries] : []),
    internationalPartnershipTypes: Array.isArray(member.internationalPartnershipTypes) ? member.internationalPartnershipTypes : (member.internationalPartnershipTypes ? [member.internationalPartnershipTypes] : []),

    // Contact Information
    phone: member.phone || '',
    alternatePhone: member.alternatePhone || '',
    whatsappGroup: member.whatsappGroup || '',
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

export const MemberEditForm: React.FC<MemberEditFormProps> = ({ member, onSubmit, onCancel, selfEditableOnly = false }) => {
  const { isAdmin } = usePermissions();
  const [activeTab, setActiveTab] = useState<'basic' | 'professional' | 'contact' | 'apparel' | 'membership'>(selfEditableOnly ? 'contact' : 'basic');
  const [formValues, setFormValues] = useState(() => initFormValues(member));

  useEffect(() => {
    setFormValues(initFormValues(member));
  }, [member.id]);

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
        newValues.membershipType = 'Probation';
      }

      return newValues;
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const skillsArr = (formValues.skills || '')
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    const interestedIndustriesArr = formValues.interestedIndustries;

    const updates: Partial<Member> = {
      name: formValues.name || member.name,
      email: formValues.email || member.email,
      phone: formValues.phone || undefined,
      introducer: formValues.introducer || undefined,
      bio: formValues.bio || undefined,
      role: (formValues.role as UserRole) || member.role,
      tier: (formValues.tier as MemberTier) || member.tier,
      attendanceRate: typeof formValues.attendanceRate === 'number' ? formValues.attendanceRate : member.attendanceRate,
      churnRisk: formValues.churnRisk || member.churnRisk,
      membershipType: (formValues.membershipType as Member['membershipType']) || member.membershipType,
      senatorCertified: formValues.senatorCertified,

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
      acceptInternationalBusiness: (formValues.acceptInternationalBusiness as Member['acceptInternationalBusiness']) || undefined,
      businessCategory: formValues.businessCategory.length > 0 ? formValues.businessCategory : undefined,
      industry: formValues.industry || undefined,
      interestedIndustries: interestedIndustriesArr.length > 0 ? interestedIndustriesArr : undefined,
      internationalPartnershipTypes: formValues.internationalPartnershipTypes,

      alternatePhone: formValues.alternatePhone || member.alternatePhone,
      whatsappGroup: formValues.whatsappGroup || undefined,
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
          type: 'Probation',
          amount: 0,
          status: 'pending',
          transactionId: []
        }
      };
    }

    const filteredUpdates = selfEditableOnly
      ? (Object.fromEntries(
        Object.entries(updates).filter(([k]) =>
          (MEMBER_SELF_EDITABLE_FIELDS as readonly string[]).includes(k)
        )
      ) as Partial<Member>)
      : updates;

    onSubmit(filteredUpdates);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 space-y-0">
      <div className="shrink-0">
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

      <div className="flex-1 min-h-0 overflow-y-auto pr-2 py-4">
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Name<span className="text-red-500 ml-1">*</span></label>
                <input name="name" value={formValues.name} onChange={(e) => handleChange('name', e.target.value)} required className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Full Name (ID Card)</label>
                <input name="fullName" value={formValues.fullName} onChange={(e) => handleChange('fullName', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">ID Number (ID Card/Passport)</label>
                <input name="idNumber" value={formValues.idNumber} onChange={(e) => handleChange('idNumber', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Date of Birth</label>
                <input name="dateOfBirth" type="date" value={formValues.dateOfBirth} onChange={(e) => handleChange('dateOfBirth', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Gender</label>
                <div className="flex-1 flex rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200">
                  {['Male', 'Female'].map((opt) => (
                    <label key={opt} className="cursor-pointer flex-1 flex">
                      <input type="radio" name="gender" value={opt} checked={formValues.gender === opt} onChange={(e) => handleChange('gender', e.target.value)} className="hidden" />
                      <span className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${formValues.gender === opt ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Nationality</label>
                <select name="nationality" value={formValues.nationality} onChange={(e) => handleChange('nationality', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20">
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Ethnicity</label>
              <div className="flex-1 flex rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200">
                {['Chinese', 'Malay', 'Indian', 'Others'].map((opt) => (
                  <label key={opt} className="cursor-pointer flex-1 flex">
                    <input type="radio" name="ethnicity" value={opt} checked={formValues.ethnicity === opt} onChange={(e) => handleChange('ethnicity', e.target.value)} className="hidden" />
                    <span className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${formValues.ethnicity === opt ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <label className="w-40 shrink-0 text-sm font-medium text-slate-700 pt-2">Personal Biography</label>
              <textarea name="bio" value={formValues.bio} onChange={(e) => handleChange('bio', e.target.value)} rows={3} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-y min-h-[80px]" />
            </div>
            <div className="flex items-start gap-3">
              <label className="w-40 shrink-0 text-sm font-medium text-slate-700 pt-2">Hobbies (Multi-selection)</label>
              <div className="flex-1 flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-lg">
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
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border-2 ${formValues.hobbies.includes(opt) ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-700 border-slate-300 hover:border-jci-blue hover:text-jci-blue'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Skills (comma-separated)</label>
              <input name="skills" value={formValues.skills} onChange={(e) => handleChange('skills', e.target.value)} placeholder="e.g., Public Speaking, Management, Coding" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
            </div>
          </div>
        )}

        {activeTab === 'membership' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Current Role</label>
                <select name="role" value={formValues.role} onChange={(e) => handleChange('role', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20">
                  {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Member Tier</label>
                <select name="tier" value={formValues.tier} onChange={(e) => handleChange('tier', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20">
                  {['Bronze', 'Silver', 'Gold', 'Platinum'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Show year selection only when approving a Guest */}
              {formValues.role === UserRole.PROBATION && (member.role === UserRole.GUEST || !member.role) && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                  <label className="w-40 shrink-0 text-sm font-bold text-amber-600">Initiation Year</label>
                  <select
                    value={formValues.membershipYear}
                    onChange={(e) => handleChange('membershipYear', parseInt(e.target.value))}
                    className="flex-1 rounded-lg border-2 border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  >
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 2 - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Introducer</label>
                <input name="introducer" value={formValues.introducer} onChange={(e) => handleChange('introducer', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Membership Type</label>
              <div className={`flex-1 flex rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200 ${!isAdmin ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                {['Full', 'Probation', 'Honorary', 'Visiting', 'Senator', 'Associate'].map(opt => (
                  <label key={opt} className={`flex-1 flex ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                    <input
                      type="radio"
                      name="membershipType"
                      value={opt}
                      checked={formValues.membershipType === opt}
                      onChange={(e) => isAdmin && handleChange('membershipType', e.target.value)}
                      disabled={!isAdmin}
                      className="hidden"
                    />
                    <span className={`flex-1 text-center px-2 py-2 text-sm font-medium transition-colors whitespace-nowrap ${formValues.membershipType === opt ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {formValues.membershipType === 'Senator' && (
                <div className="flex items-center gap-3 col-span-2">
                  <span className="w-40 shrink-0" />
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg flex-1">
                    <input type="checkbox" id="senatorCertified" checked={formValues.senatorCertified} onChange={(e) => handleChange('senatorCertified', e.target.checked)} className="rounded border-gray-300 text-jci-blue focus:ring-jci-blue" />
                    <label htmlFor="senatorCertified" className="text-sm font-medium text-blue-900 cursor-pointer">Senator Certified</label>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Attendance Rate (%)</label>
                <input name="attendanceRate" type="number" value={String(formValues.attendanceRate)} onChange={(e) => { const v = parseInt(e.target.value, 10); handleChange('attendanceRate', isNaN(v) ? 0 : v); }} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Churn Risk</label>
                <select name="churnRisk" value={formValues.churnRisk} onChange={(e) => handleChange('churnRisk', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20">
                  {['Low', 'Medium', 'High'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'professional' && (
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {/* Left Column - Main Fields */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="w-32 shrink-0 text-sm font-medium text-slate-700">Company Name</label>
                <input name="companyName" value={formValues.companyName} onChange={(e) => handleChange('companyName', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>

              <div className="flex items-center gap-3">
                <label className="w-32 shrink-0 text-sm font-medium text-slate-700">Company Website</label>
                <input name="companyWebsite" type="text" placeholder="e.g., https://example.com" value={formValues.companyWebsite} onChange={(e) => handleChange('companyWebsite', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>

              <div className="flex items-center gap-3">
                <label className="w-32 shrink-0 text-sm font-medium text-slate-700">Industry</label>
                <select
                  name="industry"
                  value={formValues.industry}
                  onChange={(e) => handleChange('industry', e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
                >
                  <option value="">Select industry...</option>
                  {INDUSTRY_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label className="w-32 shrink-0 text-sm font-medium text-slate-700 text-xs leading-tight">Department & Position</label>
                <input name="departmentAndPosition" value={formValues.departmentAndPosition} onChange={(e) => handleChange('departmentAndPosition', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
            </div>

            {/* Right Column - Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Company Description</label>
              <textarea
                name="companyDescription"
                value={formValues.companyDescription}
                onChange={(e) => handleChange('companyDescription', e.target.value)}
                className="flex-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-none min-h-[150px]"
                placeholder="Tell us more about your business..."
              />
            </div>

            {/* Bottom Row - Full Width */}
            <div className="col-span-2 flex items-center gap-3 pt-2">
              <label className="w-32 shrink-0 text-sm font-medium text-slate-700 text-xs leading-tight">Accept International Business</label>
              <div className="flex-1 flex rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200 bg-white">
                {['Yes', 'No', 'Willing to Explore'].map(opt => (
                  <label key={opt} className="cursor-pointer flex-1 flex">
                    <input type="radio" name="acceptInternationalBusiness" value={opt} checked={formValues.acceptInternationalBusiness === opt} onChange={(e) => handleChange('acceptInternationalBusiness', e.target.value)} className="hidden" />
                    <span className={`flex-1 text-center px-2 py-2 text-sm font-medium transition-colors whitespace-nowrap ${formValues.acceptInternationalBusiness === opt ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Conditional International Partnership Selection */}
            {(formValues.acceptInternationalBusiness === 'Yes' || formValues.acceptInternationalBusiness === 'Willing to Explore') && (
              <div className="col-span-2 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300 py-4 px-6 bg-blue-50/50 rounded-xl border border-blue-100/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                  <h4 className="text-sm font-bold text-slate-800">What kind of global partnerships are you looking for?</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {INTERNATIONAL_PARTNERSHIP_OPTIONS.map(opt => (
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
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold leading-tight ${formValues.internationalPartnershipTypes.includes(opt.label) ? 'text-blue-700' : 'text-slate-700'}`}>
                          {opt.label}
                        </span>
                        {opt.description && (
                          <span className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                            {opt.description}
                          </span>
                        )}
                      </div>
                      {formValues.internationalPartnershipTypes.includes(opt.label) && (
                        <div className="absolute top-2 right-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 col-span-2">
              <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Business Category</label>
              <div className="flex-1 flex rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200">
                {['Manufacturer', 'Distributor', 'Service Provider', 'Retailer'].map(opt => (
                  <label key={opt} className="cursor-pointer flex-1 flex">
                    <input
                      type="checkbox"
                      checked={formValues.businessCategory.includes(opt)}
                      onChange={(e) => {
                        const newCat = e.target.checked ? [...formValues.businessCategory, opt] : formValues.businessCategory.filter(c => c !== opt);
                        handleChange('businessCategory', newCat);
                      }}
                      className="hidden"
                    />
                    <span className={`flex-1 text-center px-2 py-2 text-sm font-medium transition-colors whitespace-nowrap ${formValues.businessCategory.includes(opt) ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-3 col-span-2">
              <label className="w-40 shrink-0 text-sm font-medium text-slate-700 pt-2">Interested Industries</label>
              <div className="flex-1 flex flex-wrap gap-2 p-2 border border-slate-200 rounded-lg bg-white">
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
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border-2 ${formValues.interestedIndustries.includes(opt) ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-700 border-slate-300 hover:border-sky-500 hover:text-sky-500'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Personal Contact</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Phone</label>
                <input name="phone" type="tel" value={formValues.phone} onChange={(e) => handleChange('phone', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Alternate Phone</label>
                <input name="alternatePhone" type="tel" value={formValues.alternatePhone} onChange={(e) => handleChange('alternatePhone', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">WhatsApp Group</label>
                <input name="whatsappGroup" value={formValues.whatsappGroup} onChange={(e) => handleChange('whatsappGroup', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Email<span className="text-red-500 ml-1">*</span></label>
                <input name="email" type="email" value={formValues.email} onChange={(e) => handleChange('email', e.target.value)} required className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-start gap-3 col-span-2">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700 pt-2">Address</label>
                <textarea name="address" value={formValues.address} onChange={(e) => handleChange('address', e.target.value)} rows={3} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-y min-h-[80px]" />
              </div>
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2 mt-4">Social Media</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">LinkedIn</label>
                <input name="linkedin" type="url" value={formValues.linkedin} onChange={(e) => handleChange('linkedin', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Facebook</label>
                <input name="facebook" type="url" value={formValues.facebook} onChange={(e) => handleChange('facebook', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Instagram</label>
                <input name="instagram" type="url" value={formValues.instagram} onChange={(e) => handleChange('instagram', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">WeChat</label>
                <input name="wechat" value={formValues.wechat} onChange={(e) => handleChange('wechat', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2 mt-4">Emergency Contact</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Emergency Contact Name</label>
                <input name="emergencyContactName" value={formValues.emergencyContactName} onChange={(e) => handleChange('emergencyContactName', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Emergency Contact Phone</label>
                <input name="emergencyContactPhone" type="tel" value={formValues.emergencyContactPhone} onChange={(e) => handleChange('emergencyContactPhone', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Relationship</label>
                <input name="emergencyContactRelationship" value={formValues.emergencyContactRelationship} onChange={(e) => handleChange('emergencyContactRelationship', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'apparel' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Cut Style</label>
                <div className="flex-1 flex rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200">
                  {['Unisex', 'Lady Cut'].map(opt => (
                    <label key={opt} className="cursor-pointer flex-1 flex">
                      <input type="radio" name="cutStyle" value={opt} checked={formValues.cutStyle === opt} onChange={(e) => handleChange('cutStyle', e.target.value)} className="hidden" />
                      <span className={`flex-1 text-center px-4 py-2 text-sm font-medium transition-colors ${formValues.cutStyle === opt ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Embroidered Name</label>
                <input name="embroideredName" value={formValues.embroideredName} onChange={(e) => handleChange('embroideredName', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="w-40 shrink-0 text-sm font-medium text-slate-700">T-Shirt Size</label>
              <div className="flex-1 flex rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200">
                {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL', '7XL'].map(opt => (
                  <label key={opt} className="cursor-pointer flex-1 flex">
                    <input type="radio" name="tshirtSize" value={opt} checked={formValues.tshirtSize === opt} onChange={(e) => handleChange('tshirtSize', e.target.value)} className="hidden" />
                    <span className={`flex-1 text-center px-2 py-2 text-sm font-medium transition-colors whitespace-nowrap ${formValues.tshirtSize === opt ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="w-40 shrink-0 text-sm font-medium text-slate-700">Jacket Size</label>
              <div className="flex-1 flex rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200">
                {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL', '7XL'].map(opt => (
                  <label key={opt} className="cursor-pointer flex-1 flex">
                    <input type="radio" name="jacketSize" value={opt} checked={formValues.jacketSize === opt} onChange={(e) => handleChange('jacketSize', e.target.value)} className="hidden" />
                    <span className={`flex-1 text-center px-2 py-2 text-sm font-medium transition-colors whitespace-nowrap ${formValues.jacketSize === opt ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="w-40 shrink-0 text-sm font-medium text-slate-700">T-Shirt Status</label>
              <div className="flex-1 flex rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200">
                {['NA', 'Requested', 'Sent', 'Delivered', 'Received'].map(opt => (
                  <label key={opt} className="cursor-pointer flex-1 flex">
                    <input type="radio" name="tshirtStatus" value={opt} checked={formValues.tshirtStatus === opt} onChange={(e) => handleChange('tshirtStatus', e.target.value)} className="hidden" />
                    <span className={`flex-1 text-center px-2 py-2 text-sm font-medium transition-colors whitespace-nowrap ${formValues.tshirtStatus === opt ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 pt-4 flex gap-3 border-t border-slate-200">
        <Button type="submit" className="flex-1">Save Changes</Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
      </div>
    </form>
  );
};
