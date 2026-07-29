import * as React from 'react';
import { ArrowUpRight, Upload, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, Badge, Drawer, useToast } from '../../ui/Common';
import { MultiSelectDropdown } from '../../ui/MultiSelectDropdown';
import type { Member, SpecialOffer } from '../../../types';
import { getSpecialOfferSummary, hasSpecialOffer } from '../../../types/member';
import { INDUSTRY_OPTIONS, IDEAL_REFERRAL_OPTIONS, BUSINESS_CATEGORIES_OPTIONS } from '../../../config/constants';
import { uploadMemberOfferLogoToCloudinary, uploadMemberOfferBannerToCloudinary } from '../../../services/cloudinaryService';

const EMPTY_OFFER: SpecialOffer = { description: '', terms: '', expiryDate: '', status: 'Active' };

interface MemberDetailProfessionalTabProps {
  member: Member;
  isEditMode: boolean;
  inlineValues: any;
  setInlineValues: React.Dispatch<React.SetStateAction<any>>;
  activeInlineEditCard: string | null;
}

const MemberDetailProfessionalTabBase: React.FC<MemberDetailProfessionalTabProps> = (props) => {
  const { member, isEditMode, inlineValues, setInlineValues, activeInlineEditCard } = props;
  const { showToast } = useToast();
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [uploadingBanner, setUploadingBanner] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [draftOffer, setDraftOffer] = React.useState<SpecialOffer>({ ...EMPTY_OFFER });

  const offers: SpecialOffer[] = (inlineValues?.specialOffers ?? []).filter((o: SpecialOffer) => o.description?.trim());

  // Sync draftOffer after the drawer opens (robust against batching/portal timing)
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
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !member.id) return;
    setUploadingLogo(true);
    try {
      const url = await uploadMemberOfferLogoToCloudinary(file, member.id);
      updateDraft({ logoUrl: url });
    } catch {
      showToast('Failed to upload logo', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !member.id) return;
    setUploadingBanner(true);
    try {
      const url = await uploadMemberOfferBannerToCloudinary(file, member.id);
      updateDraft({ imageUrl: url });
    } catch {
      showToast('Failed to upload banner', 'error');
    } finally {
      setUploadingBanner(false);
    }
  };

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
                    value={inlineValues.companyWebsite ?? ''}
                    onChange={e => setInlineValues({ ...inlineValues, companyWebsite: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Company Description</label>
                  <textarea
                    value={inlineValues.companyDescription ?? ''}
                    onChange={e => setInlineValues({ ...inlineValues, companyDescription: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue resize-y"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Position / Title</label>
                  <input
                    type="text"
                    value={inlineValues.departmentAndPosition ?? ''}
                    onChange={e => setInlineValues({ ...inlineValues, departmentAndPosition: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Level of Mgmt</label>
                  <select
                    value={inlineValues.levelOfManagement ?? ''}
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
                    value={inlineValues.acceptInternationalBusiness ?? ''}
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

              <div className="grid grid-cols-2 gap-4 border-t pt-3">
                <div className="col-span-2">
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Business Categories</label>
                  <MultiSelectDropdown
                    options={BUSINESS_CATEGORIES_OPTIONS}
                    selected={inlineValues.businessCategory ?? []}
                    onChange={selected => setInlineValues({ ...inlineValues, businessCategory: selected })}
                    placeholder="Select categories..."
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ideal Referral Industry</label>
                  <MultiSelectDropdown
                    options={INDUSTRY_OPTIONS}
                    selected={inlineValues.idealReferralIndustry ? [...new Set<string>(inlineValues.idealReferralIndustry.split('||').flatMap((v: string) => v.split(', ')).filter(Boolean))] : []}
                    onChange={selected => setInlineValues({ ...inlineValues, idealReferralIndustry: selected.join('||') })}
                    placeholder="Select industries..."
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ideal Referral</label>
                  <MultiSelectDropdown
                    options={IDEAL_REFERRAL_OPTIONS.map(opt => opt.label)}
                    selected={Array.isArray(inlineValues.idealReferral) ? inlineValues.idealReferral : (inlineValues.idealReferral ? String(inlineValues.idealReferral).split(', ').filter(Boolean) : [])}
                    onChange={selected => setInlineValues({ ...inlineValues, idealReferral: selected.join(', ') })}
                    placeholder="Select referrals..."
                  />
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <label className="text-slate-500 block text-xs uppercase font-medium">Special Member Offers</label>
                <div className="space-y-2">
                  {/* Add offer row — always at top */}
                  <button type="button" onClick={openNew} className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:border-jci-blue hover:text-jci-blue hover:bg-blue-50/40 transition-colors">
                    <div className="w-8 h-8 rounded-md border border-dashed border-current flex items-center justify-center shrink-0"><Plus size={13} /></div>
                    <span className="text-xs font-semibold">Add Offer</span>
                  </button>
                  {offers.map((o, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-colors">
                      {/* Banner thumbnail or placeholder */}
                      <div className="w-16 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-100 flex items-center justify-center">
                        {o.imageUrl
                          ? <img src={o.imageUrl} alt="" className="w-full h-full object-cover" />
                          : o.logoUrl
                          ? <img src={o.logoUrl} alt="" className="w-full h-full object-contain p-1 bg-white" />
                          : <Upload size={13} className="text-slate-300" />
                        }
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
                {member.business?.companyDescription && (
                  <p className="text-xs text-slate-500 leading-relaxed mt-1.5">{member.business.companyDescription}</p>
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


                {/* Special Member Offers */}
                {(() => {
                  const allOffers: SpecialOffer[] = member.business?.specialOffers ??
                    (member.business?.specialOffer ? [typeof member.business.specialOffer === 'string' ? { description: member.business.specialOffer } : member.business.specialOffer] : []);
                  if (allOffers.length === 0) return null;
                  return (
                    <div className="space-y-3">
                      {allOffers.map((offerObj, idx) => {
                        const isActive = !offerObj.status || offerObj.status === 'Active';
                        return (
                          <div key={idx} className="rounded-xl border border-slate-200 overflow-hidden">
                            {offerObj.imageUrl && (
                              <div className="aspect-[3/1] w-full bg-slate-100 overflow-hidden">
                                <img src={offerObj.imageUrl} alt="Ad banner" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="p-4 flex items-start gap-3">
                              {offerObj.logoUrl && (
                                <img src={offerObj.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-contain border border-slate-100 bg-white p-0.5 shrink-0 shadow-sm" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-[10px] font-black text-jci-blue uppercase tracking-widest">Special Offer</span>
                                  {offerObj.status && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{offerObj.status}</span>
                                  )}
                                </div>
                                <p className="font-bold text-slate-900 text-sm leading-snug">{offerObj.description}</p>
                                {offerObj.terms && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{offerObj.terms}</p>}
                                {offerObj.expiryDate && (
                                  <p className="text-[11px] text-slate-400 mt-1.5">Expires {new Date(offerObj.expiryDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                )}
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
        </Card>
      </div>

      {/* Offer Drawer */}
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
            <input
              type="text"
              placeholder="e.g. 10% off first order for JCI KL members"
              value={draftOffer.description}
              onChange={e => updateDraft({ description: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Terms & Conditions</label>
            <textarea
              rows={3}
              placeholder="Terms & conditions (optional)"
              value={draftOffer.terms ?? ''}
              onChange={e => updateDraft({ terms: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-jci-blue focus:outline-none resize-none"
            />
          </div>

          {/* Logo + Banner */}
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

          {/* Status + Expiry */}
          <div className="flex items-center gap-3 pt-1">
            <label className="text-xs text-slate-500 whitespace-nowrap">Status</label>
            <div className="flex gap-2">
              {(['Active', 'Paused'] as const).map(s => (
                <button key={s} type="button" onClick={() => updateDraft({ status: s })}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    (draftOffer.status ?? 'Active') === s
                      ? s === 'Active' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-400 text-white border-slate-400'
                      : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'
                  }`}>{s}</button>
              ))}
            </div>
            <label className="text-xs text-slate-500 whitespace-nowrap ml-auto">Expiry</label>
            <input
              type="date"
              value={draftOffer.expiryDate ?? ''}
              onChange={e => updateDraft({ expiryDate: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:outline-none"
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export const MemberDetailProfessionalTab = React.memo(MemberDetailProfessionalTabBase);
