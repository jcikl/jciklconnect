import * as React from 'react';
import { Phone, MessageCircle, MapPin, Linkedin, Facebook, Instagram, Lock } from 'lucide-react';
import { Card } from '../../ui/Common';
import type { Member } from '../../../types';

const RestrictedField: React.FC = () => (
  <span className="inline-flex items-center gap-1 text-slate-400 text-xs italic select-none">
    <Lock size={11} /> Restricted
  </span>
);

interface MemberDetailContactTabProps {
  member: Member;
  isEditMode: boolean;
  inlineValues: any;
  setInlineValues: React.Dispatch<React.SetStateAction<any>>;
  canViewSensitiveFields: boolean;
}

const MemberDetailContactTabBase: React.FC<MemberDetailContactTabProps> = ({
  member, isEditMode, inlineValues, setInlineValues, canViewSensitiveFields,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
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
    </div>
  );
};

export const MemberDetailContactTab = React.memo(MemberDetailContactTabBase);
