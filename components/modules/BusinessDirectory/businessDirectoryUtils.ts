export const BUSINESS_CATEGORIES = [
  'Service Provider',
  'Retailer / E-Commerce',
  'Manufacturer / Producer',
  'Distributor / Exporter / Importer',
];

/** Free-text match over a sister-chapter member: name, company, chapter, industry (case-insensitive). */
export const filterSisterMembersBySearch = <T extends { name: string; chineseName?: string; companyName: string; jciChapter: string; industry: string; businessCategory: string }>(
  members: T[],
  searchTerm: string,
): T[] => {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return members;
  return members.filter(m =>
    [m.name, m.chineseName, m.companyName, m.jciChapter, m.industry, m.businessCategory]
      .some(v => !!v && v.toLowerCase().includes(q)));
};

// Generate an inline SVG data URI with initials so avatars do not rely on external requests.
export const getInitialsSvg = (name: string, size = 44): string => {
  const initials = name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2) || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#0097D7" rx="${size / 2}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="sans-serif" font-size="${Math.round(size * 0.4)}px">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};
