import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BookRecord, BookSummary, BookmarkRecord, CatalogFavorite, ReadingPosition } from '../types';

interface ReaderDatabase extends DBSchema {
  books: {
    key: string;
    value: BookRecord;
    indexes: { 'by-updated': number; 'by-source': string };
  };
  bookSummaries: {
    key: string;
    value: BookSummary;
    indexes: { 'by-updated': number; 'by-source': string };
  };
  positions: { key: string; value: ReadingPosition };
  bookmarks: {
    key: string;
    value: BookmarkRecord;
    indexes: { 'by-book': string; 'by-created': number };
  };
  catalogFavorites: { key: string; value: CatalogFavorite; indexes: { 'by-saved': number } };
}

let databasePromise: Promise<IDBPDatabase<ReaderDatabase>> | undefined;

function database() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('此浏览器不支持 IndexedDB，无法保存本地书籍。'));
  if (!databasePromise) {
    databasePromise = openDB<ReaderDatabase>('classic-txt-reader', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
          const books = db.createObjectStore('books', { keyPath: 'id' });
          books.createIndex('by-updated', 'updatedAt');
          books.createIndex('by-source', 'source');
        }
        if (!db.objectStoreNames.contains('bookSummaries')) {
          const summaries = db.createObjectStore('bookSummaries', { keyPath: 'id' });
          summaries.createIndex('by-updated', 'updatedAt');
          summaries.createIndex('by-source', 'source');
        }
        if (!db.objectStoreNames.contains('positions')) db.createObjectStore('positions', { keyPath: 'bookId' });
        if (!db.objectStoreNames.contains('bookmarks')) {
          const bookmarks = db.createObjectStore('bookmarks', { keyPath: 'id' });
          bookmarks.createIndex('by-book', 'bookId');
          bookmarks.createIndex('by-created', 'createdAt');
        }
        if (!db.objectStoreNames.contains('catalogFavorites')) {
          const favorites = db.createObjectStore('catalogFavorites', { keyPath: 'slug' });
          favorites.createIndex('by-saved', 'savedAt');
        }
      },
      blocked() { console.warn('书库升级被其他阅读器标签页阻塞，请关闭旧标签页后刷新。'); },
    }).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

export async function getAllBooks(): Promise<BookSummary[]> {
  const db = await database();
  const books = await db.getAll('bookSummaries');
  return books.sort((a, b) => (b.lastReadAt || b.updatedAt) - (a.lastReadAt || a.updatedAt));
}

export async function getBook(bookId: string): Promise<BookRecord | undefined> {
  return (await database()).get('books', bookId);
}

export async function saveBook(book: BookRecord): Promise<void> {
  const db = await database();
  const saved = { ...book, updatedAt: Date.now() };
  const tx = db.transaction(['books', 'bookSummaries'], 'readwrite');
  await Promise.all([
    tx.objectStore('books').put(saved),
    tx.objectStore('bookSummaries').put(toSummary(saved)),
  ]);
  await tx.done;
}

function toSummary(book: BookRecord): BookSummary {
  const { content: _content, chapters, ...summary } = book;
  return { ...summary, chapterCount: chapters.length };
}

export async function renameBook(bookId: string, name: string): Promise<BookRecord> {
  const db = await database();
  const book = await db.get('books', bookId);
  if (!book) throw new Error('找不到这本书');
  const renamed = { ...book, name: name.trim(), updatedAt: Date.now() };
  const tx = db.transaction(['books', 'bookSummaries'], 'readwrite');
  await Promise.all([
    tx.objectStore('books').put(renamed),
    tx.objectStore('bookSummaries').put(toSummary(renamed)),
  ]);
  await tx.done;
  return renamed;
}

export async function deleteBook(bookId: string): Promise<void> {
  const db = await database();
  const tx = db.transaction(['books', 'bookSummaries', 'positions', 'bookmarks'], 'readwrite');
  const bookmarkKeys = await tx.objectStore('bookmarks').index('by-book').getAllKeys(bookId);
  await Promise.all([
    tx.objectStore('books').delete(bookId),
    tx.objectStore('bookSummaries').delete(bookId),
    tx.objectStore('positions').delete(bookId),
    ...bookmarkKeys.map((key) => tx.objectStore('bookmarks').delete(key)),
  ]);
  await tx.done;
}

export async function getPosition(bookId: string): Promise<ReadingPosition | undefined> {
  return (await database()).get('positions', bookId);
}

export async function savePosition(position: ReadingPosition): Promise<void> {
  const db = await database();
  const tx = db.transaction(['positions', 'books', 'bookSummaries'], 'readwrite');
  const [book] = await Promise.all([
    tx.objectStore('books').get(position.bookId),
    tx.objectStore('positions').put(position),
  ]);
  if (book) {
    const updated = { ...book, lastReadAt: position.updatedAt, updatedAt: position.updatedAt };
    await Promise.all([
      tx.objectStore('books').put(updated),
      tx.objectStore('bookSummaries').put(toSummary(updated)),
    ]);
  }
  await tx.done;
}

export async function getBookmarks(bookId: string): Promise<BookmarkRecord[]> {
  const db = await database();
  return (await db.getAllFromIndex('bookmarks', 'by-book', bookId)).sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveBookmark(bookmark: BookmarkRecord): Promise<void> {
  await (await database()).put('bookmarks', bookmark);
}

export async function removeBookmark(bookmarkId: string): Promise<void> {
  await (await database()).delete('bookmarks', bookmarkId);
}

export async function getCatalogFavorites(): Promise<CatalogFavorite[]> {
  const db = await database();
  return (await db.getAllFromIndex('catalogFavorites', 'by-saved')).sort((a, b) => b.savedAt - a.savedAt);
}

export async function saveCatalogFavorite(slug: string): Promise<void> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('書籍標識無效');
  await (await database()).put('catalogFavorites', { slug, savedAt: Date.now() });
}

export async function removeCatalogFavorite(slug: string): Promise<void> {
  await (await database()).delete('catalogFavorites', slug);
}

export function makeId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
}
