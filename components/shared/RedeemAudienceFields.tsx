import React, { useMemo } from 'react';
import { Checkbox } from '../ui/Form';
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown';
import { useSisterChapters } from '../../hooks/useSisterChapters';
import { KL_COUNTRY, type BenefitAudience } from '../../utils/benefitEligibility';

const AUDIENCE_OPTIONS: { value: BenefitAudience; label: string }[] = [
  { value: 'kl', label: 'JCI KL members' },
  { value: 'sister', label: 'Sister chapters' },
  { value: 'apicc', label: 'APICC' },
  { value: 'global', label: 'Global JCI' },
];

interface RedeemAudienceFieldsProps {
  audiences: BenefitAudience[];
  countries: string[];
  onAudiencesChange: (next: BenefitAudience[]) => void;
  onCountriesChange: (next: string[]) => void;
}

/**
 * "Who can redeem" fields shared by partner benefits (AdvertisementFormModal) and members' own offers.
 * Values feed utils/benefitEligibility (getBenefitEligibility / getOfferEligibility).
 * Country options: Malaysia plus the sister chapters' countries (plus any already selected).
 */
export const RedeemAudienceFields: React.FC<RedeemAudienceFieldsProps> = ({ audiences, countries, onAudiencesChange, onCountriesChange }) => {
  const { chapters } = useSisterChapters();
  const countryOptions = useMemo(
    () => Array.from(new Set([KL_COUNTRY, ...chapters.map(c => c.country).filter(Boolean), ...countries])).sort(),
    [chapters, countries],
  );
  const toggleAudience = (value: BenefitAudience) =>
    onAudiencesChange(audiences.includes(value) ? audiences.filter(a => a !== value) : [...audiences, value]);

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Who can redeem</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {AUDIENCE_OPTIONS.map(opt => (
          <Checkbox
            key={opt.value}
            label={opt.label}
            checked={audiences.includes(opt.value)}
            onChange={() => toggleAudience(opt.value)}
          />
        ))}
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Countries <span className="text-slate-400 font-normal">(none = any country)</span></label>
        <MultiSelectDropdown options={countryOptions} selected={countries} onChange={onCountriesChange} placeholder="Any country" />
      </div>
      <p className="text-xs text-slate-500">Nothing ticked means JCI KL members only.</p>
    </div>
  );
};
