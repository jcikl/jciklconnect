import * as React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Card, Badge } from '../../ui/Common';
import { MultiSelectDropdown } from '../../ui/MultiSelectDropdown';
import type { Member } from '../../../types';
import { INDUSTRY_OPTIONS, IDEAL_REFERRAL_OPTIONS, BUSINESS_CATEGORIES_OPTIONS } from '../../../config/constants';

interface MemberDetailProfessionalTabProps {
  member: Member;
  isEditMode: boolean;
  inlineValues: any;
  setInlineValues: React.Dispatch<React.SetStateAction<any>>;
  activeInlineEditCard: string | null;
}

const MemberDetailProfessionalTabBase: React.FC<MemberDetailProfessionalTabProps> = (props) => {
  const { member, isEditMode, inlineValues, setInlineValues, activeInlineEditCard } = props;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-3 space-y-6">
        {(member.companyName || member.industry) && activeInlineEditCard !== 'professional' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-gradient-to-r from-slate-50 to-white rounded-2xl border border-slate-200">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-slate-900 truncate">{member.companyName || '—'}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{[(member.business?.departmentAndPosition ?? member.departmentAndPosition), member.industry].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {member.industry && (
                <span className="px-3 py-1 rounded-full bg-blue-50 text-jci-blue text-xs font-bold border border-blue-100">{member.industry}</span>
              )}
              {member.acceptInternationalBusiness && member.acceptInternationalBusiness !== 'No' && (
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">🌐 Intl Business</span>
              )}
              {member.companyWebsite && (
                <a href={member.companyWebsite} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-colors flex items-center gap-1">
                  <ArrowUpRight size={11} /> Website
                </a>
              )}
            </div>
          </div>
        )}

        <Card title="Professional & Business">
          {isEditMode && inlineValues ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Company Name</label>
                  <input
                    type="text"
                    value={inlineValues.companyName}
                    onChange={e => setInlineValues({ ...inlineValues, companyName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Company Website</label>
                  <input
                    type="text"
                    value={inlineValues.companyWebsite}
                    onChange={e => setInlineValues({ ...inlineValues, companyWebsite: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Position / Title</label>
                  <input
                    type="text"
                    value={inlineValues.departmentAndPosition}
                    onChange={e => setInlineValues({ ...inlineValues, departmentAndPosition: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Level of Mgmt</label>
                  <select
                    value={inlineValues.levelOfManagement}
                    onChange={e => setInlineValues({ ...inlineValues, levelOfManagement: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                  >
                    <option value="">Select Level</option>
                    <option value="Top">Top</option>
                    <option value="Middle">Middle</option>
                    <option value="Frontline">Frontline</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Industry</label>
                  <select
                    value={inlineValues.industry}
                    onChange={e => setInlineValues({ ...inlineValues, industry: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                  >
                    <option value="">Select Industry</option>
                    {INDUSTRY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Intl. Business Engagement</label>
                  <select
                    value={inlineValues.acceptInternationalBusiness}
                    onChange={e => setInlineValues({ ...inlineValues, acceptInternationalBusiness: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                  >
                    <option value="">Select Option</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="Willing to Explore">Willing to Explore</option>
                  </select>
                </div>
              </div>

              <div className="border-t pt-3">
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Company Description</label>
                <textarea
                  value={inlineValues.companyDescription}
                  onChange={e => setInlineValues({ ...inlineValues, companyDescription: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-3">
                <div className="col-span-2">
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Business Categories</label>
                  <MultiSelectDropdown
                    options={BUSINESS_CATEGORIES_OPTIONS}
                    selected={inlineValues.businessCategory}
                    onChange={selected => setInlineValues({ ...inlineValues, businessCategory: selected })}
                    placeholder="Select categories..."
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ideal Referral Industry</label>
                  <MultiSelectDropdown
                    options={INDUSTRY_OPTIONS}
                    selected={inlineValues.idealReferralIndustry ? inlineValues.idealReferralIndustry.split(', ').filter(Boolean) : []}
                    onChange={selected => setInlineValues({ ...inlineValues, idealReferralIndustry: selected.join(', ') })}
                    placeholder="Select industries..."
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ideal Referral</label>
                  <MultiSelectDropdown
                    options={IDEAL_REFERRAL_OPTIONS.map(opt => opt.label)}
                    selected={inlineValues.idealReferral ? inlineValues.idealReferral.split(', ').filter(Boolean) : []}
                    onChange={selected => setInlineValues({ ...inlineValues, idealReferral: selected.join(', ') })}
                    placeholder="Select referrals..."
                  />
                </div>
              </div>

              <div className="border-t pt-3">
                <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Special Member Offer</label>
                <input
                  type="text"
                  value={inlineValues.specialOffer}
                  onChange={e => setInlineValues({ ...inlineValues, specialOffer: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Col 1 */}
                <div className="space-y-4 text-sm md:border-r md:border-slate-100 md:pr-6">
                  <div>
                    <span className="text-slate-500 text-xs uppercase font-medium">Company Name</span>
                    <p className="font-bold text-slate-900 leading-tight mt-0.5">{member.companyName || 'Freelance / Not Provided'}</p>
                    {member.companyWebsite && (
                      <a href={member.companyWebsite.startsWith('http') ? member.companyWebsite : `https://${member.companyWebsite}`} target="_blank" rel="noopener noreferrer" className="text-xs text-jci-blue hover:underline block mt-1">
                        {member.companyWebsite}
                      </a>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs uppercase font-medium">Position</span>
                    <p className="font-medium text-slate-900 mt-0.5">{(member.business?.departmentAndPosition ?? member.departmentAndPosition) || 'Not provided'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs uppercase font-medium">Level of Mgmt</span>
                    <p className="font-medium text-slate-900 mt-0.5">{(member.business?.levelOfManagement ?? member.levelOfManagement) || 'Not provided'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs uppercase font-medium">Industry</span>
                    <p className="font-medium text-slate-900 mt-0.5">{member.industry || 'Not provided'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs uppercase font-medium">Intl. Business</span>
                    <p className="font-medium text-slate-900 mt-0.5">{member.acceptInternationalBusiness || 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs uppercase font-medium">Business Categories</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Array.isArray(member.businessCategory) && member.businessCategory.length > 0 ? (
                        member.businessCategory.map((cat, idx) => (
                          <Badge key={idx} variant="neutral" className="text-[10px]">{cat}</Badge>
                        ))
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Col 2-3 */}
                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                    <div>
                      <span className="text-slate-500 text-xs uppercase font-medium">Ideal Referral Industry</span>
                      <div className="mt-1 text-slate-700 font-medium">
                        {member.idealReferralIndustry ? (
                          <span>{member.idealReferralIndustry}</span>
                        ) : (
                          <span className="text-slate-400 italic font-normal">None</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs uppercase font-medium">Ideal Referral</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Array.isArray(member.idealReferrals) && member.idealReferrals.length > 0 ? (
                          member.idealReferrals.map((type, idx) => (
                            <Badge key={idx} variant="info" className="text-[10px] bg-sky-50 text-sky-600 border-sky-100">{type}</Badge>
                          ))
                        ) : member.idealReferral ? (
                          <span className="text-sm text-slate-700 font-medium">{member.idealReferral}</span>
                        ) : (
                          <span className="text-slate-400 italic font-normal">None</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {(member.business?.companyDescription ?? member.companyDescription) && (
                    <div className="p-3 bg-slate-50 rounded-lg border-l-4 border-slate-300">
                      <span className="text-slate-500 text-xs uppercase font-bold mb-1 block">Company Description</span>
                      <p className="text-xs text-slate-600 leading-relaxed">{member.business?.companyDescription ?? member.companyDescription}</p>
                    </div>
                  )}

                  {member.specialOffer && (
                    <div className="p-3 bg-jci-blue/5 rounded-lg border-l-4 border-jci-blue">
                      <span className="text-jci-blue text-xs uppercase font-bold mb-1 block">Special Member Offer</span>
                      <p className="text-sm font-medium text-slate-800">{member.specialOffer}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export const MemberDetailProfessionalTab = React.memo(MemberDetailProfessionalTabBase);
