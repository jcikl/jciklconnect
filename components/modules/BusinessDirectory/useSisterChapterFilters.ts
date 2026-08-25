import { useMemo, useState } from 'react';

interface SisterChapterFilterMember {
  jciChapter: string;
  country: string;
  industry: string;
}

export const useSisterChapterFilters = (members: SisterChapterFilterMember[]) => {
  const [selectedSisterChapter, setSelectedSisterChapter] = useState<string>('All');
  const [selectedSisterCountry, setSelectedSisterCountry] = useState<string>('All');
  const [selectedSisterIndustry, setSelectedSisterIndustry] = useState<string>('All');

  const sisterChapters = useMemo(() => ['All', ...Array.from(new Set(members.map(member => member.jciChapter)))], [members]);
  const sisterCountries = useMemo(() => ['All', ...Array.from(new Set(members.map(member => member.country)))], [members]);
  const sisterIndustries = useMemo(() => ['All', ...Array.from(new Set(members.map(member => member.industry)))], [members]);

  const sisterFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedSisterChapter !== 'All') count++;
    if (selectedSisterCountry !== 'All') count++;
    if (selectedSisterIndustry !== 'All') count++;
    return count;
  }, [selectedSisterChapter, selectedSisterCountry, selectedSisterIndustry]);

  return {
    selectedSisterChapter,
    selectedSisterCountry,
    selectedSisterIndustry,
    setSelectedSisterChapter,
    setSelectedSisterCountry,
    setSelectedSisterIndustry,
    sisterChapters,
    sisterCountries,
    sisterIndustries,
    sisterFiltersCount,
  };
};
