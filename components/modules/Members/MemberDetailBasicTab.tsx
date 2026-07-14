import * as React from 'react';
import { Phone, Mail, MessageCircle, MapPin, Linkedin, Facebook, Instagram, Lock } from 'lucide-react';
import { Button, Card, Badge } from '../../ui/Common';
import { Input } from '../../ui/Form';
import { Combobox } from '../../ui/Combobox';
import { IntroducerSelector } from '../../ui/IntroducerSelector';
import type { Member, HobbyClub, Project } from '../../../types';
import { nationalityOptionsForValue } from '../../../config/constants';
import { isMalaysianIC, getBirthPlaceFromIC, getDateOfBirthFromIC, getGenderFromIC } from '../../../utils/malaysianIdUtils';
import { formatDateToDDMMMYYYY } from '../../../utils/dateUtils';

const HOBBY_OPTIONS = [
  "Art & Design", "Badminton", "Baking", "Basketball", "Car Enthusiast",
  "Cigar", "Cooking", "Cycling", "Dancing", "Diving",
  "E-Sport Mlbb", "Fashion", "Golf", "Hiking", "Leadership",
  "Liquor/ Wine Tasting", "Make Up", "Movie", "Other E-Sport", "Pickle Ball",
  "Pilates", "Public Speaking", "Reading", "Rock Climbing", "Singing",
  "Social Etiquette", "Social Service", "Travelling", "Women Empowerment", "Yoga"
];

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
}

const RestrictedField: React.FC = () => (
  <span className="inline-flex items-center gap-1 text-slate-400 text-xs italic select-none">
    <Lock size={11} /> Restricted
  </span>
);

const MemberDetailBasicTabBase: React.FC<MemberDetailBasicTabProps> = (props) => {
  const {
    member, isEditMode, inlineValues, setInlineValues,
    isAdmin, isDeveloper, canViewSensitiveFields,
    loadingClubs, memberClubs, members, allProjects,
    avatarUploading, avatarUploadProgress, handleInlineAvatarUpload,
    resolveIntroducerDisplay,
  } = props;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left column */}
      <div className="space-y-6">
        <Card title="Basic Information">
          {isEditMode && inlineValues ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-row items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white bg-blue-50 shadow-sm shrink-0">
                  {inlineValues.avatar ? (
                    <img src={inlineValues._avatarTs ? `${inlineValues.avatar}?v=${inlineValues._avatarTs}` : inlineValues.avatar} alt={inlineValues.name || member.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-black text-jci-blue">
                      {(inlineValues.name || member.name || 'M').charAt(0)}
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
                  <div className="flex flex-wrap gap-2">
                    <label className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-bold transition-colors ${avatarUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-jci-blue text-white hover:bg-jci-navy cursor-pointer'}`}>
                      {avatarUploading ? 'Uploading...' : 'Upload'}
                      <input type="file" accept="image/*" className="hidden" disabled={avatarUploading} onChange={handleInlineAvatarUpload} />
                    </label>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Name (Short)<span className="text-red-500 ml-1">*</span></label>
                  <input
                    type="text"
                    value={inlineValues.name}
                    onChange={e => setInlineValues({ ...inlineValues, name: e.target.value })}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Full Name (ID)</label>
                  <input
                    type="text"
                    value={inlineValues.fullName}
                    onChange={e => setInlineValues({ ...inlineValues, fullName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">ID Number</label>
                  {canViewSensitiveFields ? (
                    <input
                      type="text"
                      value={inlineValues.idNumber}
                      onChange={e => {
                        const ic = e.target.value;
                        const updates: any = { idNumber: ic };
                        if (isMalaysianIC(ic)) {
                          const bp = getBirthPlaceFromIC(ic); if (bp) updates.birthPlace = bp;
                          const dob = getDateOfBirthFromIC(ic); if (dob) updates.dateOfBirth = dob;
                          const gender = getGenderFromIC(ic); if (gender) updates.gender = gender;
                        }
                        setInlineValues({ ...inlineValues, ...updates });
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                    />
                  ) : (
                    <RestrictedField />
                  )}
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Date of Birth</label>
                  <Input
                    type="date"
                    value={inlineValues.dateOfBirth}
                    onChange={e => setInlineValues({ ...inlineValues, dateOfBirth: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Nationality</label>
                  <Combobox
                    options={nationalityOptionsForValue(inlineValues.nationality)}
                    value={inlineValues.nationality}
                    onChange={val => setInlineValues({ ...inlineValues, nationality: val })}
                    placeholder="Select nationality..."
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Birth Place</label>
                  <input
                    type="text"
                    value={inlineValues.birthPlace || ''}
                    onChange={e => setInlineValues({ ...inlineValues, birthPlace: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Gender</label>
                  <select
                    value={inlineValues.gender}
                    onChange={e => setInlineValues({ ...inlineValues, gender: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ethnicity</label>
                  <select
                    value={inlineValues.ethnicity}
                    onChange={e => setInlineValues({ ...inlineValues, ethnicity: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
                  >
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
                    {(['Vegetarian', 'Halal', 'Normal'] as const).map((opt) => (
                      <label key={opt} className="cursor-pointer flex-1 flex">
                        <input type="radio" name="inlineDietaryPreference" value={opt.toLowerCase()} checked={inlineValues.dietaryPreference === opt.toLowerCase()} onChange={e => setInlineValues({ ...inlineValues, dietaryPreference: e.target.value })} className="hidden" />
                        <span className={`flex-1 text-center px-1 md:px-4 py-2 text-[10px] md:text-sm font-medium transition-colors ${inlineValues.dietaryPreference === opt.toLowerCase() ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Introducer</label>
                  <IntroducerSelector
                    value={inlineValues.introducer || ''}
                    onChange={val => setInlineValues({ ...inlineValues, introducer: val })}
                    members={members}
                    projects={allProjects}
                  />
                </div>
              </div>

              <div className="border-t pt-3">
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Personal Biography</label>
                <textarea
                  value={inlineValues.bio}
                  onChange={e => setInlineValues({ ...inlineValues, bio: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-y"
                />
              </div>

              <div className="border-t pt-3">
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Hobbies</label>
                <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-lg bg-slate-50">
                  {HOBBY_OPTIONS.map(opt => {
                    const isChecked = inlineValues.hobbies.includes(opt);
                    return (
                      <label key={opt} className="cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const newHobbies = e.target.checked
                              ? [...inlineValues.hobbies, opt]
                              : inlineValues.hobbies.filter((h: string) => h !== opt);
                            setInlineValues({ ...inlineValues, hobbies: newHobbies });
                          }}
                          className="hidden"
                        />
                        <span className={`inline-block px-2 py-1 rounded text-[10px] font-semibold border ${isChecked
                          ? 'bg-jci-blue text-white border-jci-blue'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-jci-blue'
                          }`}>
                          {opt}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-3">
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Skills</label>
                <input
                  type="text"
                  value={inlineValues.skills}
                  onChange={e => setInlineValues({ ...inlineValues, skills: e.target.value })}
                  placeholder="e.g. Public Speaking, Event Management (comma separated)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 block text-xs uppercase font-medium">Full Name (ID)</span>
                  <p className="font-medium text-slate-900">{member.fullName || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs uppercase font-medium">ID Number</span>
                  {canViewSensitiveFields
                    ? <p className="font-medium text-slate-900 uppercase">{member.idNumber || 'Not provided'}</p>
                    : <RestrictedField />}
                </div>
                <div>
                  <span className="text-slate-500 block text-xs uppercase font-medium">Date of Birth</span>
                  <p className="font-medium text-slate-900">{formatDateToDDMMMYYYY(member.dateOfBirth)}</p>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs uppercase font-medium">Nationality</span>
                  <p className="font-medium text-slate-900">{member.nationality || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs uppercase font-medium">Birth Place</span>
                  {(() => {
                    const storedBp = member.general?.birthPlace ?? member.birthPlace;
                    const bp = storedBp
                      || (isMalaysianIC(member.idNumber || '') ? getBirthPlaceFromIC(member.idNumber || '') : '');
                    return (
                      <p className="font-medium text-slate-900 flex items-center gap-1.5">
                        {bp || 'Not provided'}
                        {!storedBp && bp && (
                          <span className="text-[10px] text-jci-blue font-normal">from IC</span>
                        )}
                      </p>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-slate-500 block text-xs uppercase font-medium">Gender</span>
                  <p className="font-medium text-slate-900">{member.gender || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs uppercase font-medium">Ethnicity</span>
                  <p className="font-medium text-slate-900">{(member.general?.ethnicity ?? member.ethnicity) || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs uppercase font-medium">Dietary Preference</span>
                  <p className="font-medium text-slate-900 capitalize">{(member.general?.dietaryPreference ?? member.dietaryPreference) || 'Not provided'}</p>
                </div>
              </div>

              <div className="border-t pt-3">
                <span className="text-slate-500 block text-xs uppercase font-medium mb-1">Introducer</span>
                <p className="text-sm font-medium text-slate-900">{resolveIntroducerDisplay(member.introducer)}</p>
              </div>

              <div className="border-t pt-3">
                <span className="text-slate-500 block text-xs uppercase font-medium mb-1">Personal Biography</span>
                <p className="text-sm text-slate-600 line-clamp-4 italic">
                  {member.bio || 'No biography provided.'}
                </p>
              </div>

              <div className="border-t pt-3">
                <span className="text-slate-500 block text-xs uppercase font-medium mb-2">Hobbies</span>
                <div className="flex flex-wrap gap-1">
                  {Array.isArray(member.hobbies) && member.hobbies.length > 0 ? (
                    member.hobbies.map(hobby => (
                      <Badge key={hobby} variant="neutral" className="text-[10px]">{hobby}</Badge>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No hobbies listed</span>
                  )}
                </div>
              </div>

              <div className="border-t pt-3">
                <span className="text-slate-500 block text-xs uppercase font-medium mb-2">Skills</span>
                <div className="flex flex-wrap gap-1">
                  {Array.isArray(member.skills) && member.skills.length > 0 ? (
                    member.skills.map(skill => (
                      <Badge key={skill} variant="neutral" className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100">{skill}</Badge>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No skills listed</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card title="Hobby Clubs">
          {loadingClubs ? (
            <div className="text-center py-4 text-slate-400 text-sm">Loading clubs...</div>
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
            <div className="text-center py-4 text-slate-400 text-sm">Not a member of any clubs</div>
          )}
        </Card>
      </div>

      {/* Right column (2 cols) */}
      <div className="lg:col-span-2 space-y-6">
        <Card title="Contact Information">
          {isEditMode && inlineValues ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Primary Phone</label>
                  <input
                    type="text"
                    value={inlineValues.phone}
                    onChange={e => setInlineValues({ ...inlineValues, phone: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Alternate Phone</label>
                  <input
                    type="text"
                    value={inlineValues.alternatePhone}
                    onChange={e => setInlineValues({ ...inlineValues, alternatePhone: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={inlineValues.email}
                    onChange={e => setInlineValues({ ...inlineValues, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">WhatsApp Group Added</label>
                  <select
                    value={inlineValues.whatsappGroup ? 'Yes' : 'No'}
                    onChange={e => setInlineValues({ ...inlineValues, whatsappGroup: e.target.value === 'Yes' })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Address</label>
                  {canViewSensitiveFields ? (
                    <textarea
                      value={inlineValues.address}
                      onChange={e => setInlineValues({ ...inlineValues, address: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue resize-y"
                    />
                  ) : (
                    <RestrictedField />
                  )}
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1 mb-3">Emergency Contact</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={inlineValues.emergencyContactName}
                      onChange={e => setInlineValues({ ...inlineValues, emergencyContactName: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Relationship</label>
                    <input
                      type="text"
                      value={inlineValues.emergencyContactRelationship}
                      onChange={e => setInlineValues({ ...inlineValues, emergencyContactRelationship: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Phone</label>
                    <input
                      type="text"
                      value={inlineValues.emergencyContactPhone}
                      onChange={e => setInlineValues({ ...inlineValues, emergencyContactPhone: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1 mb-3">Social Media Links</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-500 block text-xs font-medium mb-1">LinkedIn</label>
                    <input
                      type="text"
                      value={inlineValues.linkedin}
                      onChange={e => setInlineValues({ ...inlineValues, linkedin: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block text-xs font-medium mb-1">Facebook</label>
                    <input
                      type="text"
                      value={inlineValues.facebook}
                      onChange={e => setInlineValues({ ...inlineValues, facebook: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block text-xs font-medium mb-1">Instagram</label>
                    <input
                      type="text"
                      value={inlineValues.instagram}
                      onChange={e => setInlineValues({ ...inlineValues, instagram: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block text-xs font-medium mb-1">WeChat ID</label>
                    <input
                      type="text"
                      value={inlineValues.wechat}
                      onChange={e => setInlineValues({ ...inlineValues, wechat: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium">Primary Phone</p>
                    <p className="text-sm font-bold">{member.phone || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <Phone size={16} className="rotate-90" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium">Alternate Phone</p>
                    <p className="text-sm font-bold">{member.alternatePhone || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-jci-blue">
                    <MessageCircle size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium">WhatsApp Group</p>
                    <p className="text-sm font-bold">{member.whatsappGroup ? 'Yes' : 'Not Added'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium">Address</p>
                    {canViewSensitiveFields
                      ? <p className="text-sm text-slate-700">{member.address || 'No address on file'}</p>
                      : <RestrictedField />}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1">Emergency Contact</h4>
                <div>
                  <p className="text-sm font-bold text-slate-900">{member.emergencyContactName || 'None Listed'}</p>
                  <p className="text-xs text-slate-500">{member.emergencyContactRelationship} • {member.emergencyContactPhone}</p>
                </div>

                <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1 mt-4">Social Media</h4>
                <div className="flex gap-4 items-center">
                  {member.linkedin
                    ? <a href={member.linkedin} target="_blank" rel="noreferrer" className="text-[#0077B5]"><Linkedin size={20} /></a>
                    : <Linkedin size={20} className="text-slate-300" />}
                  {member.facebook
                    ? <a href={member.facebook} target="_blank" rel="noreferrer" className="text-[#1877F2]"><Facebook size={20} /></a>
                    : <Facebook size={20} className="text-slate-300" />}
                  {member.instagram
                    ? <a href={member.instagram} target="_blank" rel="noreferrer" className="text-[#E1306C]"><Instagram size={20} /></a>
                    : <Instagram size={20} className="text-slate-300" />}
                  {member.wechat
                    ? <div className="text-[#07C160] flex items-center gap-1"><MessageCircle size={20} /></div>
                    : <MessageCircle size={20} className="text-slate-300" />}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card title="Apparel & Items">
          {isEditMode && inlineValues ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Cut Style</label>
                  <select
                    value={inlineValues.cutStyle}
                    onChange={e => setInlineValues({ ...inlineValues, cutStyle: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                  >
                    <option value="">Select Cut</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">T-Shirt Size</label>
                  <select
                    value={inlineValues.tshirtSize}
                    onChange={e => setInlineValues({ ...inlineValues, tshirtSize: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                  >
                    <option value="">Select Size</option>
                    {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Jacket Size</label>
                  <select
                    value={inlineValues.jacketSize}
                    onChange={e => setInlineValues({ ...inlineValues, jacketSize: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                  >
                    <option value="">Select Size</option>
                    {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Logo Status</label>
                  <select
                    value={inlineValues.tshirtStatus}
                    onChange={e => setInlineValues({ ...inlineValues, tshirtStatus: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                  >
                    <option value="NA">NA</option>
                    <option value="Pending">Pending</option>
                    <option value="Received">Received</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
              </div>

              <div className="border-t pt-3">
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Embroidered Name</label>
                <input
                  type="text"
                  value={inlineValues.embroideredName}
                  onChange={e => setInlineValues({ ...inlineValues, embroideredName: e.target.value })}
                  placeholder="Embroidered Name on Jacket"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 border rounded-lg text-center">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Cut Style</span>
                  <p className="font-bold text-slate-900">{member.cutStyle || 'N/A'}</p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">T-Shirt</span>
                  <p className="font-bold text-slate-900">{member.tshirtSize || 'N/A'}</p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Jacket</span>
                  <p className="font-bold text-slate-900">{member.jacketSize || 'N/A'}</p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Logo Status</span>
                  <Badge variant={member.tshirtStatus === 'Received' || member.tshirtStatus === 'Delivered' ? 'success' : 'warning'}>
                    {member.tshirtStatus || 'N/A'}
                  </Badge>
                </div>
              </div>
              {member.embroideredName && (
                <div className="mt-4 p-2 bg-slate-50 rounded text-center border-t border-slate-200">
                  <span className="text-xs text-slate-500">Embroidered Name: </span>
                  <span className="text-sm font-bold text-slate-900 italic">"{member.embroideredName}"</span>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export const MemberDetailBasicTab = React.memo(MemberDetailBasicTabBase);
