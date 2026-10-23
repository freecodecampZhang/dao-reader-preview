import { describe, expect, it } from 'vitest';
import { filterApprovedBooks, isApprovedPublicBook } from '../src/services/publicCatalog';

const approved = {
  slug: 'public-domain-poems',
  title: '公版诗集',
  author: '佚名',
  category: '古典诗词',
  categorySlug: 'poetry',
  description: '经审核确认具备公开传播及商业使用权的内容。',
  contentFile: 'library/public-domain-poems.txt',
  status: 'approved',
  rightsConfirmed: true,
  commercialRightsConfirmed: true,
  publicationApproved: true,
};

describe('public catalog release gate', () => {
  it('requires publication approval and explicit commercial rights confirmation', () => {
    expect(isApprovedPublicBook(approved)).toBe(true);
    expect(isApprovedPublicBook({ ...approved, commercialRightsConfirmed: false })).toBe(false);
    expect(isApprovedPublicBook({ ...approved, status: 'pending' })).toBe(false);
  });

  it('rejects unsafe paths, invalid slugs, incomplete records, and duplicates', () => {
    const unsafe = { ...approved, contentFile: '../../secret.txt' };
    const invalidSlug = { ...approved, slug: '../secret', contentFile: 'library/../secret.txt' };
    expect(filterApprovedBooks([approved, unsafe, invalidSlug, approved])).toEqual([approved]);
  });
});
