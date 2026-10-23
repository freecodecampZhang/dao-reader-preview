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
    && (book.contentFile === `library/${book.slug}.txt` || book.contentFile === `api/public/books/${book.slug}/content`)
    && book.status === 'approved'
    && book.rightsConfirmed === true
    && book.commercialRightsConfirmed === true
    && book.publicationApproved === true
    && (book.dynasty === undefined || typeof book.dynasty === 'string')
    && (book.textForm === undefined || book.textForm === '简体' || book.textForm === '繁体')
    && (book.editionType === undefined || book.editionType === '古籍 TXT' || book.editionType === '校勘本' || book.editionType === '原版影印')
    && (book.baseEdition === undefined || typeof book.baseEdition === 'string')
    && (book.fullTextConfirmed === undefined || typeof book.fullTextConfirmed === 'boolean')
    && (book.originalSource === undefined || typeof book.originalSource === 'string')
    && (book.publicLicense === undefined || typeof book.publicLicense === 'string');
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
  const [response, dynamicResponse] = await Promise.all([
    fetch('/catalog.json', { headers: { Accept: 'application/json' } }),
    fetch('/api/public/catalog', { headers: { Accept: 'application/json' } }).catch(() => null),
  ]);
  if (!response.ok) throw new Error('公共书库暂时无法读取，请稍后重试。');
  const manifest = await response.json() as Partial<PublicCatalogManifest>;
  if (manifest.version !== 1 || !Array.isArray(manifest.books)) throw new Error('公共书库清单格式无效。');
  let dynamicBooks: unknown[] = [];
  if (dynamicResponse?.ok) {
    try {
      const dynamicManifest = await dynamicResponse.json() as Partial<PublicCatalogManifest>;
      if (dynamicManifest.version === 1 && Array.isArray(dynamicManifest.books)) dynamicBooks = dynamicManifest.books;
    } catch { /* Keep the validated static catalog available if the dynamic catalog is unavailable. */ }
  }
  return filterApprovedBooks([...manifest.books, ...dynamicBooks]);
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
