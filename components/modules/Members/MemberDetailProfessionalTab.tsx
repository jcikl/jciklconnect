import * as React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Card, Badge } from '../../ui/Common';
import { MultiSelectDropdown } from '../../ui/MultiSelectDropdown';
import type { Member, SpecialOffer, SpecialOfferType } from '../../../types';
import { SPECIAL_OFFER_TYPE_LABELS, getSpecialOfferSummary, hasSpecialOffer } from '../../../types/member';
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
              <p className="text-sm text-slate-500 mt-0.5">{[member.business?.departmentAndPosition, member.industry].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {member.industry && (
                <span className="px-3 py-1 rounded-full bg-blue-50 text-jci-blue text-xs font-bold border border-blue-100">{member.industry}</span>
              )}
              {member.business?.acceptInternationalBusiness && member.business?.acceptInternationalBusiness !== 'No' && (
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">🌐 Intl Business</span>
              )}
              {member.business?.companyWebsite && (
                <a href={member.business?.companyWebsite} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-colors flex items-center gap-1">
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
                    value={inlineValues.business?.companyWebsite}
                    onChange={e => setInlineValues({ ...inlineValues, companyWebsite: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Position / Title</label>
                  <input
                    type="text"
                    value={inlineValues.business?.departmentAndPosition}
                    onChange={e => setInlineValues({ ...inlineValues, departmentAndPosition: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Level of Mgmt</label>
                  <select
                    value={inlineValues.business?.levelOfManagement}
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
                    value={inlineValues.business?.acceptInternationalBusiness}
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
                  value={inlineValues.business?.companyDescription}
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
                    selected={inlineValues.business?.businessCategory ?? []}
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
                    selected={inlineValues.business?.idealReferrals ? inlineValues.business?.idealReferrals.split(', ').filter(Boolean) : []}
                    onChange={selected => setInlineValues({ ...inlineValues, idealReferral: selected.join(', ') })}
                    placeholder="Select referrals..."
                  />
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <label className="text-slate-500 block text-xs uppercase font-medium">Special Member Offer</label>
                {(() => {
                  const raw = inlineValues.business?.specialOffer;
                  const structured: SpecialOffer = typeof raw === 'object' && raw !== null
                    ? raw as SpecialOffer
                    : { type: 'percentage_discount' as SpecialOfferType, description: typeof raw === 'string' ? raw : '', terms: '', expiryDate: '' };
                  const update = (patch: Partial<SpecialOffer>) =>
                    setInlineValues({ ...inlineValues, specialOffer: { ...structured, ...patch } });
                  return (
                    <>
                      <select
                        value={structured.type}
                        onChange={e => update({ type: e.target.value as SpecialOfferType })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                      >
                        {(Object.entries(SPECIAL_OFFER_TYPE_LABELS) as [SpecialOfferType, string][]).map(([v, label]) => (
                          <option key={v} value={v}>{label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="e.g. 10% off first order for JCI KL members"
                        value={structured.description}
                        onChange={e => update({ description: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                      />
                      <textarea
                        rows={2}
                        placeholder="Terms & conditions (optional)"
                        value={structured.terms ?? ''}
                        onChange={e => update({ terms: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue resize-none"
                      />
                      <input
                        type="url"
                        placeholder="Logo URL (optional)"
                        value={structured.logoUrl ?? ''}
                        onChange={e => update({ logoUrl: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                      />
                      <input
                        type="url"
                        placeholder="Ad Banner URL (optional)"
                        value={structured.imageUrl ?? ''}
                        onChange={e => update({ imageUrl: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                      />
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-slate-500 whitespace-nowrap">Status</label>
                        <div className="flex gap-2">
                          {(['Active', 'Paused'] as const).map(s => (
                            <button key={s} type="button"
                              onClick={() => update({ status: s })}
                              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                                (structured.status ?? 'Active') === s
                                  ? s === 'Active' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-400 text-white border-slate-400'
                                  : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'
                              }`}>{s}</button>
                          ))}
                        </div>
                        <label className="text-xs text-slate-500 whitespace-nowrap ml-auto">Expiry</label>
                        <input
                          type="date"
                          value={structured.expiryDate ?? ''}
                          onChange={e => update({ expiryDate: e.target.value })}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="space-y-5 text-sm">
              {/* Company header */}
              <div>
                <span className="text-slate-500 text-xs uppercase font-medium">Company Name</span>
                <p className="font-bold text-slate-900 leading-tight mt-0.5">{member.companyName || 'Freelance / Not Provided'}</p>
                {member.business?.companyWebsite && (
                  <a href={member.business?.companyWebsite.startsWith('http') ? member.business?.companyWebsite : `https://${member.business?.companyWebsite}`} target="_blank" rel="noopener noreferrer" className="text-xs text-jci-blue hover:underline block mt-1">
                    {member.business?.companyWebsite}
                  </a>
                )}
              </div>

              {/* 2-col quick-facts grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div>
                  <span className="text-slate-500 text-xs uppercase font-medium">Position</span>
                  <p className="font-medium text-slate-900 mt-0.5">{member.business?.departmentAndPosition || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs uppercase font-medium">Level of Mgmt</span>
                  <p className="font-medium text-slate-900 mt-0.5">{member.business?.levelOfManagement || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs uppercase font-medium">Industry</span>
                  <p className="font-medium text-slate-900 mt-0.5">{member.industry || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs uppercase font-medium">Intl. Business</span>
                  <p className="font-medium text-slate-900 mt-0.5">{member.business?.acceptInternationalBusiness || 'Unknown'}</p>
                </div>
              </div>

              {/* Business Categories */}
              <div>
                <span className="text-slate-500 text-xs uppercase font-medium">Business Categories</span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {Array.isArray(member.business?.businessCategory) && member.business?.businessCategory.length > 0 ? (
                    member.business?.businessCategory.map((cat, idx) => (
                      <Badge key={idx} variant="neutral" className="text-[10px]">{cat}</Badge>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">None</span>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                {/* Ideal Referral — 2-col on sm+, stacked on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 text-xs uppercase font-medium">Ideal Referral Industry</span>
                    <div className="mt-1 text-slate-700 font-medium leading-snug">
                      {member.idealReferralIndustry
                        ? <span className="text-xs leading-relaxed">{member.idealReferralIndustry}</span>
                        : <span className="text-slate-400 italic font-normal">None</span>}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs uppercase font-medium">Ideal Referral</span>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Array.isArray(member.business?.idealReferrals) && member.business?.idealReferrals.length > 0 ? (
                        member.business?.idealReferrals.map((type, idx) => (
                          <Badge key={idx} variant="info" className="text-[10px] bg-sky-50 text-sky-600 border-sky-100">{type}</Badge>
                        ))
                      ) : member.business?.idealReferrals ? (
                        <span className="text-sm text-slate-700 font-medium">{member.business?.idealReferrals}</span>
                      ) : (
                        <span className="text-slate-400 italic font-normal">None</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Company Description */}
                {member.business?.companyDescription && (
                  <div className="p-3 bg-slate-50 rounded-lg border-l-4 border-slate-300">
                    <span className="text-slate-500 text-xs uppercase font-bold mb-1 block">Company Description</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{member.business.companyDescription}</p>
                  </div>
                )}

                {/* Special Member Offer */}
                <div className="p-3 bg-jci-blue/5 rounded-lg border-l-4 border-jci-blue">
                  <span className="text-jci-blue text-xs uppercase font-bold mb-1 block">Special Member Offer</span>
                  {(() => {
                    const offer = member.business?.specialOffer;
                    if (!hasSpecialOffer(offer)) return <p className="text-sm italic text-slate-400">No special offer listed</p>;
                    if (typeof offer === 'string') return <p className="text-sm font-medium text-slate-800">{offer}</p>;
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-block text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            {SPECIAL_OFFER_TYPE_LABELS[offer.type]}
                          </span>
                          {offer.status && (
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${offer.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {offer.status}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-800">{offer.description}</p>
                        {offer.terms && <p className="text-xs text-slate-500 leading-snug">{offer.terms}</p>}
                        {(offer.imageUrl || offer.logoUrl) && (
                          <div className="flex gap-2 mt-1">
                            {offer.imageUrl && <img src={offer.imageUrl} alt="Ad banner" className="h-10 rounded object-cover border border-slate-200" />}
                            {offer.logoUrl && <img src={offer.logoUrl} alt="Logo" className="h-10 w-10 rounded object-contain border border-slate-200 bg-white p-0.5" />}
                          </div>
                        )}
                        {offer.expiryDate && (
                          <p className="text-[11px] text-slate-400">
                            Expires: {new Date(offer.expiryDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    );
                  })()}
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
