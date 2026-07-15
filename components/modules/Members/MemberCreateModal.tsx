import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Modal, Button } from '../../ui/Common';
import { Input, Select } from '../../ui/Form';
import { IntroducerSelector } from '../../ui/IntroducerSelector';
import { UserRole, MemberTier, type MemberCreateInput, type Member, type Project } from '../../../types';
import { NATIONALITY_OPTIONS, INDUSTRY_OPTIONS } from '../../../config/constants';

const HOBBY_OPTIONS = [
  'Art & Design', 'Badminton', 'Baking', 'Basketball', 'Car Enthusiast',
  'Cigar', 'Cooking', 'Cycling', 'Dancing', 'Diving',
  'E-Sport Mlbb', 'Fashion', 'Golf', 'Hiking', 'Leadership',
  'Liquor/ Wine Tasting', 'Make Up', 'Movie', 'Other E-Sport', 'Pickle Ball',
  'Pilates', 'Public Speaking', 'Reading', 'Rock Climbing', 'Singing',
  'Social Etiquette', 'Social Service', 'Travelling', 'Women Empowerment', 'Yoga',
];

interface MemberCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  allProjects: Project[];
  onCreateMember: (data: MemberCreateInput & Record<string, any>) => Promise<void>;
}

export const MemberCreateModal: React.FC<MemberCreateModalProps> = ({
  isOpen,
  onClose,
  members,
  allProjects,
  onCreateMember,
}) => {
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [interestedIndustries, setInterestedIndustries] = useState<string[]>([]);
  const [introducer, setIntroducer] = useState('');

  const handleClose = () => {
    setHobbies([]);
    setInterestedIndustries([]);
    setIntroducer('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const name = `${firstName} ${lastName}`.trim();

    const skillsInput = formData.get('skills') as string;
    const skills = skillsInput ? skillsInput.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
    const formRole = (formData.get('role') as UserRole) || UserRole.MEMBER;

    const newMember: MemberCreateInput & Record<string, any> = {
      name,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string || '',
      role: formRole,
      tier: (formData.get('tier') as MemberTier) || MemberTier.BRONZE,
      points: 0,
      joinDate: new Date().toISOString().split('T')[0],
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0097D7&color=fff`,
      churnRisk: 'Low',
      attendanceRate: 100,
      badges: [],
      skills,
      hobbies: hobbies.length > 0 ? hobbies : undefined,
      interestedIndustries: interestedIndustries.length > 0 ? interestedIndustries : undefined,
      'business.interestedIndustries': interestedIndustries.length > 0 ? interestedIndustries : undefined,

      fullName: formData.get('fullName') as string || undefined,
      idNumber: formData.get('idNumber') as string || undefined,
      gender: (formData.get('gender') as any) || undefined,
      ethnicity: (formData.get('ethnicity') as any) || undefined,
      'general.ethnicity': (formData.get('ethnicity') as any) || undefined,
      nationality: formData.get('nationality') as string || 'Malaysia',
      dateOfBirth: formData.get('dateOfBirth') as string || undefined,
      introducer: introducer || undefined,
      senatorshipId: formData.get('senatorshipId') as string || undefined,

      companyName: formData.get('companyName') as string || undefined,
      industry: formData.get('industry') as string || undefined,

      whatsappGroup: false,
      tshirtStatus: 'NA',
    };

    await onCreateMember(newMember);
    handleClose();
    e.currentTarget.reset();
  };

  const toggleHobby = (opt: string, checked: boolean) =>
    setHobbies(prev => checked ? [...prev, opt] : prev.filter(h => h !== opt));

  const toggleIndustry = (opt: string, checked: boolean) =>
    setInterestedIndustries(prev => checked ? [...prev, opt] : prev.filter(i => i !== opt));

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Register New Member"
      size="xl"
      drawerOnMobile
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="outline" className="flex-1" type="button" onClick={handleClose}>Cancel</Button>
          <Button className="flex-1" type="submit" form="add-member-form">Register Member</Button>
        </div>
      }
    >
      <form id="add-member-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <p className="text-xs text-blue-700 flex items-start gap-2">
            <Sparkles size={14} className="shrink-0 mt-0.5" />
            Fill in as much information as possible to create a complete member profile. You can also import members from CSV for bulk registration.
          </p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto pr-2">
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Identity & Account</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input name="firstName" label="First Name" placeholder="John" required />
                <Input name="lastName" label="Last Name" placeholder="Doe" required />
                <Input name="email" label="Email Address" type="email" placeholder="john@example.com" required />
                <Input name="phone" label="Phone" type="tel" placeholder="+60..." />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Identity Verification</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input name="fullName" label="Full Name (ID Card)" />
                <Input name="idNumber" label="ID Number" />
                <Input name="dateOfBirth" label="Date of Birth" type="date" />
                <Select name="nationality" label="Nationality" defaultValue="Malaysia" options={NATIONALITY_OPTIONS.map(c => ({ label: c, value: c }))} />
                <div className="col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                    <div className="flex gap-2">
                      {['Male', 'Female'].map(opt => (
                        <label key={opt} className="cursor-pointer flex-1 text-center">
                          <input type="radio" name="gender" value={opt} className="hidden peer" />
                          <span className="block px-3 py-2 rounded-lg text-xs font-medium border-2 border-slate-200 peer-checked:border-jci-blue peer-checked:bg-jci-blue/5 peer-checked:text-jci-blue transition-all">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Ethnicity</label>
                    <div className="flex gap-2">
                      {['Chinese', 'Malay', 'Indian', 'Others'].map(opt => (
                        <label key={opt} className="cursor-pointer flex-1 text-center">
                          <input type="radio" name="ethnicity" value={opt} className="hidden peer" />
                          <span className="block px-2 py-2 rounded-lg text-[10px] font-medium border-2 border-slate-200 peer-checked:border-jci-blue peer-checked:bg-jci-blue/5 peer-checked:text-jci-blue transition-all">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Internal Profile</h3>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  name="role"
                  label="System Role"
                  defaultValue={UserRole.MEMBER}
                  options={[UserRole.GUEST, UserRole.MEMBER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INACTIVE].map(r => ({ label: r, value: r }))}
                />
                <p className="col-span-2 text-xs text-slate-500 -mt-2">
                  Membership type is computed from profile. Senatorship numbers are validated under the Senatorship tab.
                </p>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Introducer</label>
                  <IntroducerSelector value={introducer} onChange={setIntroducer} members={members} projects={allProjects} />
                </div>
                <Input name="senatorshipId" label="Senatorship Number (optional)" placeholder="e.g. 12345" />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Professional Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input name="companyName" label="Company Name" />
                <Select
                  name="industry"
                  label="Industry"
                  options={[{ label: 'Select industry...', value: '' }, ...INDUSTRY_OPTIONS.map(opt => ({ label: opt, value: opt }))]}
                />
                <div className="col-span-2">
                  <Input name="skills" label="Skills (comma-separated)" placeholder="Leadership, Networking, Marketing..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Interested Industries</label>
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    {INDUSTRY_OPTIONS.map(opt => (
                      <label key={opt} className="cursor-pointer">
                        <input type="checkbox" checked={interestedIndustries.includes(opt)} onChange={e => toggleIndustry(opt, e.target.checked)} className="hidden" />
                        <span className={`inline-block px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border-2 ${interestedIndustries.includes(opt) ? 'bg-sky-500 text-white border-sky-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-sky-500/30'}`}>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Hobbies & Interests</h3>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 rounded-lg border border-slate-200">
                {HOBBY_OPTIONS.map(opt => (
                  <label key={opt} className="cursor-pointer">
                    <input type="checkbox" checked={hobbies.includes(opt)} onChange={e => toggleHobby(opt, e.target.checked)} className="hidden" />
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border-2 ${hobbies.includes(opt) ? 'bg-jci-blue text-white border-jci-blue shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-jci-blue/30'}`}>{opt}</span>
                  </label>
                ))}
              </div>
            </section>

            <p className="text-xs text-slate-400 italic text-center py-4">
              Additional detailed fields such as Apparel, Social Media, and Emergency Contacts can be filled after registration via the Edit Profile button.
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
};
