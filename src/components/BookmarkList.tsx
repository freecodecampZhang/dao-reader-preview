import { Bookmark, BookmarkX, ChevronRight } from 'lucide-react';
import type { BookmarkRecord } from '../types';
import styles from './BookmarkList.module.css';

interface BookmarkListProps {
  bookmarks: BookmarkRecord[];
  onJump: (bookmark: BookmarkRecord) => void;
  onRemove: (bookmarkId: string) => void;
}

export default function BookmarkList({ bookmarks, onJump, onRemove }: BookmarkListProps) {
  if (!bookmarks.length) return <div className={styles.empty}><Bookmark size={24} /><strong>还没有书签</strong><span>阅读时添加书签，之后可以从这里继续。</span></div>;
  return <div className={styles.list}>
    {bookmarks.map((bookmark) => <article className={styles.item} key={bookmark.id}>
      <button className={styles.jump} onClick={() => onJump(bookmark)} title={`跳转到${bookmark.chapterTitle}`}>
        <span className={styles.marker}><Bookmark size={17} /></span>
        <span className={styles.text}><strong>{bookmark.chapterTitle}</strong><small>{bookmark.quote || '书签位置'}</small><time>{new Date(bookmark.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</time></span>
        <ChevronRight size={17} />
      </button>
      <button className={styles.remove} onClick={() => onRemove(bookmark.id)} aria-label={`删除${bookmark.chapterTitle}书签`} title="删除书签"><BookmarkX size={16} /></button>
    </article>)}
  </div>;
}
