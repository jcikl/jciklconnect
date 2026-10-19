// Pure helpers for external-member affiliation, shared by the app (hooks/useAuth signUpExternal) and
// Netlify (netlify/lib/externalAccounts.mjs). Plain JS + JSDoc, like utils/memberCard.mjs.

/**
 * sisterChapters.type (array) → members.affiliation.category.
 * @param {{ type?: string[] } | null | undefined} chapter
 * @returns {'sister' | 'apicc' | 'global'}
 */
export function categoryForChapter(chapter) {
  const types = Array.isArray(chapter?.type) ? chapter.type : [];
  if (types.includes('sister_lo')) return 'sister';
  if (types.includes('apicc')) return 'apicc';
  if (types.includes('global')) return 'global';
  return 'sister';
}
