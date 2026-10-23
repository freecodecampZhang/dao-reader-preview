import type { PublicCatalogBook, PublicCatalogManifest } from '../types';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isApprovedPublicBook(value: unknown): value is PublicCatalogBook {
  if (!value || typeof value !== 'object') return false;
  const book = value as Record<string, unknown>;
  return typeof book.slug === 'string' && slugPattern.test(book.slug)
    && typeof book.title === 'string' && Boolean(book.title.trim())
    && typeof book.category === 'string' && Boolean(book.category.trim())
    && typeof book.categorySlug === 'string' && slugPattern.test(book.categorySlug)
    && typeof book.description === 'string' && Boolean(book.description.trim())
    && book.contentFile === `library/${book.slug}.txt`
    && book.status === 'approved'
    && book.rightsConfirmed === true
    && book.commercialRightsConfirmed === true
    && book.publicationApproved === true;
}

export function filterApprovedBooks(values: unknown[]): PublicCatalogBook[] {
  const seen = new Set<string>();
  return values.filter(isApprovedPublicBook).filter((book) => {
    if (seen.has(book.slug)) return false;
    seen.add(book.slug);
    return true;
  });
}

export async function loadApprovedCatalog(): Promise<PublicCatalogBook[]> {
  const response = await fetch('/catalog.json', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('公共书库暂时无法读取，请稍后重试。');
  const manifest = await response.json() as Partial<PublicCatalogManifest>;
  if (manifest.version !== 1 || !Array.isArray(manifest.books)) throw new Error('公共书库清单格式无效。');
  return filterApprovedBooks(manifest.books);
}

export function categoryList(books: PublicCatalogBook[]) {
  const categories = new Map<string, { slug: string; name: string; count: number }>();
  for (const book of books) {
    const existing = categories.get(book.categorySlug);
    categories.set(book.categorySlug, {
      slug: book.categorySlug,
      name: existing?.name || book.category,
      count: (existing?.count || 0) + 1,
    });
  }
  return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}
