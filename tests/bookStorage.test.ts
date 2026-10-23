import { afterEach, describe, expect, it } from 'vitest';
import type { BookRecord } from '../src/types';
import { deleteBook, getAllBooks, getBookmarks, getBook, getCatalogFavorites, getPosition, makeId, removeBookmark, removeCatalogFavorite, saveBook, saveBookmark, saveCatalogFavorite, savePosition } from '../src/services/bookStorage';

const createdIds: string[] = [];

function fixture(): BookRecord {
  const now = Date.now();
  const id = makeId('test-book');
  createdIds.push(id);
  return {
    id,
    name: '测试古籍',
    fileName: 'test.txt',
    source: 'upload',
    content: '第一章\n正文内容',
    chapters: [{ id: 'chapter-1', title: '第一章', content: '正文内容', startOffset: 0, endOffset: 10, page: 1 }],
    size: 14,
    createdAt: now,
    updatedAt: now,
  };
}

afterEach(async () => {
  await Promise.all(createdIds.splice(0).map((id) => deleteBook(id)));
});

describe('IndexedDB 本地书库', () => {
  it('保存完整书籍，书架列表只读取轻量元数据', async () => {
    const book = fixture();
    await saveBook(book);
    expect((await getBook(book.id))?.content).toBe(book.content);
    expect(await getAllBooks()).toEqual(expect.arrayContaining([expect.objectContaining({ id: book.id, chapterCount: 1 })]));
  });

  it('keeps approved public-book favorites on this device and supports removal', async () => {
    await saveCatalogFavorite('sample-public-book');
    expect(await getCatalogFavorites()).toEqual(expect.arrayContaining([expect.objectContaining({ slug: 'sample-public-book' })]));
    await removeCatalogFavorite('sample-public-book');
    expect(await getCatalogFavorites()).not.toEqual(expect.arrayContaining([expect.objectContaining({ slug: 'sample-public-book' })]));
    await expect(saveCatalogFavorite('../private.txt')).rejects.toThrow();
  });

  it('保存阅读进度和书签，删除书籍时清理关联数据', async () => {
    const book = fixture();
    await saveBook(book);
    const position = { bookId: book.id, chapterId: 'chapter-1', chapterIndex: 0, scrollProgress: .4, offset: 4, updatedAt: Date.now() };
    await savePosition(position);
    const bookmark = { id: makeId('mark'), bookId: book.id, chapterId: 'chapter-1', chapterTitle: '第一章', offset: 4, scrollProgress: .4, quote: '正文', note: '', createdAt: Date.now() };
    await saveBookmark(bookmark);
    expect(await getPosition(book.id)).toMatchObject({ scrollProgress: .4, offset: 4 });
    expect(await getBookmarks(book.id)).toHaveLength(1);
    await removeBookmark(bookmark.id);
    expect(await getBookmarks(book.id)).toHaveLength(0);
    await saveBookmark(bookmark);
    await deleteBook(book.id);
    expect(await getBook(book.id)).toBeUndefined();
    expect(await getPosition(book.id)).toBeUndefined();
    expect(await getBookmarks(book.id)).toHaveLength(0);
    createdIds.splice(createdIds.indexOf(book.id), 1);
  });
});
