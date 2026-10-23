export type ThemeName = 'paper' | 'light' | 'night';
export type FontFamily = 'serif' | 'sans';
export type BookSource = 'upload' | 'catalog' | 'demo';

export interface Chapter {
  id: string;
  title: string;
  content: string;
  startOffset: number;
  endOffset: number;
  page: number;
  locked?: boolean;
}

export interface BookRecord {
  id: string;
  name: string;
  fileName: string;
  source: BookSource;
  content: string;
  chapters: Chapter[];
  size: number;
  createdAt: number;
  updatedAt: number;
  lastReadAt?: number;
  isDemo?: boolean;
  catalogPath?: string;
}

export type BookSummary = Omit<BookRecord, 'content' | 'chapters'> & { chapterCount: number };

export interface ReadingPosition {
  bookId: string;
  chapterId: string;
  chapterIndex: number;
  scrollProgress: number;
  offset: number;
  updatedAt: number;
}

export interface BookmarkRecord {
  id: string;
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  offset: number;
  scrollProgress: number;
  quote: string;
  note: string;
  createdAt: number;
}

export interface ReaderSettings {
  theme: ThemeName;
  fontSize: number;
  lineHeight: number;
  fontFamily: FontFamily;
  pageMargin: number;
}

/** Public book metadata is deliberately separate from private IndexedDB books. */
export interface PublicCatalogBook {
  slug: string;
  title: string;
  author?: string;
  dynasty?: string;
  textForm?: '简体' | '繁体';
  editionType?: '古籍 TXT' | '校勘本' | '原版影印';
  baseEdition?: string;
  fullTextConfirmed?: boolean;
  originalSource?: string;
  publicLicense?: string;
  category: string;
  categorySlug: string;
  description: string;
  contentFile: string;
  status: 'approved';
  rightsConfirmed: true;
  commercialRightsConfirmed: true;
  publicationApproved: true;
}

export interface PublicCatalogManifest {
  version: 1;
  books: PublicCatalogBook[];
}

export interface CatalogFavorite {
  slug: string;
  savedAt: number;
}
