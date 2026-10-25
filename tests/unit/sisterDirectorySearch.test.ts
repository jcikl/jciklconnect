import { describe, it, expect } from 'vitest';
import { filterSisterMembersBySearch } from '../../components/modules/BusinessDirectory/businessDirectoryUtils';

const m = (o: Partial<{ name: string; chineseName: string; companyName: string; jciChapter: string; industry: string; businessCategory: string }>) =>
  ({ name: '', companyName: '', jciChapter: '', industry: '', businessCategory: '', ...o });

describe('filterSisterMembersBySearch', () => {
  const list = [
    m({ name: 'Alice Tan', companyName: 'Acme', jciChapter: 'JCI Singapore', industry: 'Finance' }),
    m({ name: 'Bob Lee', chineseName: '李', companyName: 'Zed Corp', jciChapter: 'JCI Penang', industry: 'IT' }),
  ];
  it('returns all for empty/blank term', () => {
    expect(filterSisterMembersBySearch(list, '  ')).toHaveLength(2);
  });
  it('matches name, company, chapter, industry case-insensitively', () => {
    expect(filterSisterMembersBySearch(list, 'alice')).toHaveLength(1);
    expect(filterSisterMembersBySearch(list, 'ZED')).toHaveLength(1);
    expect(filterSisterMembersBySearch(list, 'penang')).toHaveLength(1);
    expect(filterSisterMembersBySearch(list, 'finance')).toHaveLength(1);
    expect(filterSisterMembersBySearch(list, '李')).toHaveLength(1);
  });
  it('returns none when nothing matches', () => {
    expect(filterSisterMembersBySearch(list, 'nope')).toHaveLength(0);
  });
});
