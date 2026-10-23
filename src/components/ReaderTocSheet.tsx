import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDownToLine, BookOpen, ChevronDown, LockKeyhole, Search } from 'lucide-react';
import type { BookRecord, BookmarkRecord, ReaderSettings } from '../types';
import BookmarkList from './BookmarkList';
import ReaderProgressPanel from './ReaderProgressPanel';
import ReaderToolbar, { type ReaderTool } from './ReaderToolbar';
import { ThemePanel, TypographyPanel } from './ReaderSettingsPanel';
import styles from './ReaderTocSheet.module.css';

export interface SearchHit {
  chapterIndex: number;
  chapterTitle: string;
  offset: number;
  snippet: string;
}

interface ReaderTocSheetProps {
  open: boolean;
  book: BookRecord;
  tool: ReaderTool;
  chapterIndex: number;
  chapterProgress: number;
  overallProgress: number;
  currentOffset: number;
  currentReadPage: number;
  query: string;
  searchHits: SearchHit[];
  bookmarks: BookmarkRecord[];
  settings: ReaderSettings;
  onClose: () => void;
  onSelectTool: (tool: ReaderTool) => void;
  onQueryChange: (query: string) => void;
  onCompositionStart: () => void;
  onCompositionEnd: (query: string) => void;
  onSelectChapter: (index: number) => void;
  onJumpToPosition: (index: number, offset: number) => void;
  onAddBookmark: () => void;
  onJumpBookmark: (bookmark: BookmarkRecord) => void;
  onRemoveBookmark: (id: string) => void;
  onSettingsChange: (settings: ReaderSettings) => void;
  onLockedChapter: () => void;
}

function snippetWithHighlight(snippet: string, query: string) {
  if (!query) return snippet;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return snippet.split(new RegExp(`(${escaped})`, 'ig')).map((part, index) =>
    part.toLocaleLowerCase() === query.toLocaleLowerCase()
      ? <mark key={index}>{part}</mark>
      : part,
  );
}

export default function ReaderTocSheet(props: ReaderTocSheetProps) {
  const {
    open, book, tool, chapterIndex, chapterProgress, overallProgress, currentOffset,
    query, searchHits, bookmarks, settings, onClose, onSelectTool,
    onQueryChange, onCompositionStart, onCompositionEnd, onSelectChapter, onJumpToPosition, onAddBookmark, onJumpBookmark,
    onRemoveBookmark, onSettingsChange, onLockedChapter,
  } = props;
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dragStart = useRef<number | null>(null);
  const [showBottom, setShowBottom] = useState(false);

  const toolTitle: Record<ReaderTool, string> = {
    directory: '目录', search: '搜本书', bookmarks: '书签与导航', progress: '阅读进度', theme: '阅读主题', type: '字体排版',
  };
  const currentPage = props.currentReadPage;

  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (tool === 'search') window.setTimeout(() => searchRef.current?.focus(), 100);
  }, [tool]);

  const updateBottomButton = () => {
    const element = listRef.current;
    if (!element) return;
    setShowBottom(element.scrollHeight - element.clientHeight - element.scrollTop > 1);
  };

  useEffect(() => {
    if (!open) {
      setShowBottom(false);
      return;
    }
    updateBottomButton();
    const element = listRef.current;
    if (!element || !('ResizeObserver' in window)) return;
    const observer = new ResizeObserver(updateBottomButton);
    observer.observe(element);
    return () => observer.disconnect();
  }, [book, tool, open]);

  const chapterRows = useMemo(() => book.chapters.map((chapter, index) => ({ chapter, index })), [book.chapters]);

  const handleTool = (next: ReaderTool) => {
    onSelectTool(next);
    if (next === 'directory') onQueryChange('');
  };

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onHandlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragStart.current !== null && event.clientY - dragStart.current > 56) onClose();
    dragStart.current = null;
  };

  if (!open) return null;

  return <div className={styles.overlay} role="presentation">
    <button className={styles.scrim} type="button" aria-label="关闭目录" onClick={onClose} />
    <section className={styles.sheet} role="dialog" aria-modal="true" aria-label={`${book.name}阅读菜单`} onClick={(event) => event.stopPropagation()}>
      <header className={styles.sheetHeader}>
        <button className={styles.handle} type="button" aria-label="向下拖动关闭目录" onPointerDown={onHandlePointerDown} onPointerUp={onHandlePointerUp} onPointerCancel={() => { dragStart.current = null; }}>
          <span />
        </button>
        {(tool === 'directory' || tool === 'search') ? <div className={styles.modePill} role="tablist" aria-label="目录和搜索">
          <button type="button" role="tab" aria-selected={tool === 'search'} className={tool === 'search' ? styles.modeSelected : ''} onClick={() => handleTool('search')}><Search size={18} strokeWidth={2} /><span>搜本书</span></button>
          <button type="button" role="tab" aria-selected={tool === 'directory'} className={tool === 'directory' ? styles.modeSelected : ''} onClick={() => handleTool('directory')}>目录</button>
        </div> : <div className={styles.panelHeading}><span>{toolTitle[tool]}</span><small>{book.name}</small></div>}
      </header>

      <div className={styles.listViewport}>
        {tool === 'directory' && <div className={styles.chapterList} ref={listRef} onScroll={updateBottomButton} aria-label="章节目录">
          {chapterRows.map(({ chapter, index }) => <div key={chapter.id}>
            <button className={`${styles.chapterRow} ${index === chapterIndex ? styles.chapterCurrent : ''} ${chapter.locked ? styles.chapterLocked : ''}`} aria-disabled={chapter.locked || undefined} onClick={() => chapter.locked ? onLockedChapter() : onSelectChapter(index)}>
              <span className={styles.chapterTitle}>{chapter.title}</span>
              <span className={styles.chapterAside}>{chapter.locked ? <LockKeyhole size={17} strokeWidth={1.7} aria-label="演示内容缺失" /> : <span>{chapter.page || index + 1}</span>}</span>
            </button>
            {index === chapterIndex && <div className={styles.currentPosition}>
              <button className={styles.currentJump} onClick={() => onJumpToPosition(chapterIndex, currentOffset)}>
                <BookOpen size={19} strokeWidth={1.8} /><span><strong>当前读到</strong><small>第 {chapterIndex + 1} 章 · {chapterProgress}%</small></span><em>{currentPage}</em>
              </button>
              <button className={styles.addBookmark} onClick={onAddBookmark}>添加书签</button>
            </div>}
          </div>)}
        </div>}

        {tool === 'search' && <div className={styles.searchPanel}>
          <label className={styles.searchInput}><Search size={18} /><input ref={searchRef} value={query} onChange={(event) => onQueryChange(event.target.value)} onCompositionStart={onCompositionStart} onCompositionEnd={(event) => onCompositionEnd(event.currentTarget.value)} placeholder="输入书名、章节或正文关键词" aria-label="搜索本书" /><button type="button" aria-label="清空搜索" onClick={() => onQueryChange('')}>×</button></label>
          {!query.trim() ? <div className={styles.searchEmpty}>搜索当前书籍的章节标题与正文</div> : searchHits.length === 0 ? <div className={styles.searchEmpty}>没有找到相关内容</div> : <div className={styles.searchResults}>
            <p className={styles.resultCount}>找到 {searchHits.length} 处匹配</p>
            {searchHits.map((hit, index) => <button key={`${hit.chapterIndex}-${hit.offset}-${index}`} className={styles.searchResult} onClick={() => onJumpToPosition(hit.chapterIndex, hit.offset)}>
              <strong>{hit.chapterTitle}</strong><span>…{snippetWithHighlight(hit.snippet, query)}…</span>
            </button>)}
          </div>}
        </div>}

        {tool === 'bookmarks' && <BookmarkList bookmarks={bookmarks} onJump={onJumpBookmark} onRemove={onRemoveBookmark} />}

        {tool === 'progress' && <ReaderProgressPanel chapters={book.chapters} chapterIndex={chapterIndex} chapterProgress={chapterProgress} overallProgress={overallProgress} onJump={onSelectChapter} />}

        {tool === 'theme' && <ThemePanel settings={settings} onChange={onSettingsChange} />}

        {tool === 'type' && <TypographyPanel settings={settings} onChange={onSettingsChange} />}
      </div>

      {tool === 'directory' && showBottom && <button className={styles.goBottom} onClick={() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })}><ArrowDownToLine size={19} />去底部<ChevronDown size={15} /></button>}
      <ReaderToolbar activeTool={tool} onSelect={handleTool} />
    </section>
  </div>;
}
