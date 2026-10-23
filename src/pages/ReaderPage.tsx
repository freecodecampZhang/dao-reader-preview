import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, BookmarkPlus, ChevronLeft, ChevronRight, List, Search, Settings2 } from 'lucide-react';
import ReaderTocSheet, { type SearchHit } from '../components/ReaderTocSheet';
import AdSlot from '../components/AdSlot';
import type { ReaderTool } from '../components/ReaderToolbar';
import type { BookmarkRecord, BookRecord, ReaderSettings, ReadingPosition } from '../types';
import { getBook, getBookmarks, getPosition, makeId, removeBookmark, saveBook, saveBookmark, savePosition } from '../services/bookStorage';
import { parseBufferInWorker } from '../services/bookParser';
import { loadApprovedCatalog } from '../services/publicCatalog';
import { SeoMeta } from '../site/SiteLayout';
import styles from './ReaderPage.module.css';

interface ReaderPageProps {
  settings: ReaderSettings;
  onSettingsChange: (settings: ReaderSettings) => void;
  notify: (message: string) => void;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pieces = text.split(new RegExp(`(${escaped})`, 'ig'));
  let highlighted = 0;
  return <>{pieces.map((piece, index) => {
    if (piece.toLocaleLowerCase() === query.trim().toLocaleLowerCase() && highlighted < 80) {
      highlighted++;
      return <mark key={index}>{piece}</mark>;
    }
    return <span key={index}>{piece}</span>;
  })}</>;
}

export default function ReaderPage({ settings, onSettingsChange, notify }: ReaderPageProps) {
  const { bookId: routeBookId = '' } = useParams();
  const bookId = decodeURIComponent(routeBookId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [book, setBook] = useState<BookRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [chapterIndex, setChapterIndex] = useState(0);
  const [chapterProgress, setChapterProgress] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [turnDirection, setTurnDirection] = useState<'next' | 'previous' | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [tocOpen, setTocOpen] = useState(searchParams.get('toc') === '1');
  const [tool, setTool] = useState<ReaderTool>('directory');
  const [chromeVisible, setChromeVisible] = useState(() => searchParams.get('toc') === '1');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingJump = useRef<{ index: number; offset: number } | null>(null);
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<number | undefined>(undefined);
  const turnTimer = useRef<number | undefined>(undefined);
  const turnFinishTimer = useRef<number | undefined>(undefined);
  const longPressTriggered = useRef(false);
  const [chromeActivity, setChromeActivity] = useState(0);
  const progressRef = useRef(chapterProgress);
  progressRef.current = chapterProgress;

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    setChromeActivity((activity) => activity + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setBook(null);
    setLoadError('');
    void (async () => {
      try {
        let loaded = await getBook(bookId);
        if (!loaded && bookId.startsWith('public-')) {
          const slug = bookId.slice('public-'.length);
          const publicBook = (await loadApprovedCatalog()).find((item) => item.slug === slug);
          if (!publicBook) throw new Error('这本书不在当前公开书库中，可能已下架或尚未通过审核。');
          const response = await fetch(`/${publicBook.contentFile}`, { headers: { Accept: 'text/plain' } });
          if (!response.ok) throw new Error('此书正文暂时无法读取，请稍后再试。');
          const buffer = await response.arrayBuffer();
          const size = buffer.byteLength;
          const parsed = await parseBufferInWorker(buffer);
          loaded = {
            id: bookId,
            name: publicBook.title,
            fileName: publicBook.contentFile,
            source: 'catalog',
            catalogPath: publicBook.contentFile,
            content: parsed.text,
            chapters: parsed.chapters,
            size,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await saveBook(loaded);
        }
        if (!loaded) throw new Error('找不到这本书，请返回书架重新打开。');
        const [position, savedBookmarks] = await Promise.all([getPosition(bookId), getBookmarks(bookId)]);
        if (!active) return;
        setBook(loaded);
        setBookmarks(savedBookmarks);
        const index = position?.chapterId ? loaded.chapters.findIndex((chapter) => chapter.id === position.chapterId) : -1;
        const restoredIndex = Math.max(0, Math.min(index >= 0 ? index : position?.chapterIndex || 0, loaded.chapters.length - 1));
        setChapterIndex(restoredIndex);
        setChapterProgress(position?.scrollProgress || 0);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : '打开书籍失败');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [bookId]);

  const currentChapter = book?.chapters[chapterIndex];

  useEffect(() => {
    if (!book || !currentChapter) return;
    const handle = window.requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (!element) return;
      const pending = pendingJump.current;
      const progress = pending?.index === chapterIndex
        ? currentChapter.content.length ? pending.offset / currentChapter.content.length : 0
        : chapterProgress;
      element.scrollLeft = Math.max(0, element.scrollWidth - element.clientWidth) * Math.max(0, Math.min(1, progress));
      pendingJump.current = null;
    });
    return () => window.cancelAnimationFrame(handle);
  }, [book, chapterIndex]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () => {
      const prose = element.querySelector<HTMLElement>(`.${styles.prose}`);
      if (!prose || !element.clientWidth) return;
      const pageWidth = Math.max(1, element.clientWidth);
      prose.style.columnWidth = `${pageWidth}px`;
      const gap = Number.parseFloat(window.getComputedStyle(prose).columnGap) || 0;
      const step = pageWidth + gap;
      const contentWidth = prose.scrollWidth;
      const count = Math.max(1, Math.ceil((contentWidth + gap) / step));
      const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
      const targetPage = Math.min(count - 1, Math.max(0, Math.round(maxScroll * progressRef.current / step)));
      const targetLeft = Math.min(targetPage * step, maxScroll);
      if (Math.abs(element.scrollLeft - targetLeft) > 1) element.scrollLeft = targetLeft;
      setPageCount(count);
      setPageIndex(targetPage);
      setChapterProgress(maxScroll ? targetLeft / maxScroll : 0);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    window.addEventListener('resize', measure);
    const frame = window.requestAnimationFrame(measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.cancelAnimationFrame(frame);
    };
  }, [book, chapterIndex, settings.fontSize, settings.lineHeight, settings.pageMargin]);

  useEffect(() => {
    if (!chromeVisible || tocOpen) return undefined;
    const timer = window.setTimeout(() => setChromeVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [chromeVisible, tocOpen, chromeActivity]);

  useEffect(() => () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    if (turnTimer.current) window.clearTimeout(turnTimer.current);
    if (turnFinishTimer.current) window.clearTimeout(turnFinishTimer.current);
  }, []);

  useEffect(() => {
    if (!book || !currentChapter) return;
    const timer = window.setTimeout(() => {
      const position: ReadingPosition = {
        bookId: book.id,
        chapterId: currentChapter.id,
        chapterIndex,
        scrollProgress: chapterProgress,
        offset: Math.round(currentChapter.content.length * chapterProgress),
        updatedAt: Date.now(),
      };
      void savePosition(position).catch(() => notify('阅读进度保存失败，请检查浏览器存储空间。'));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [book, currentChapter, chapterIndex, chapterProgress, notify]);

  useEffect(() => {
    if (!isComposing) {
      const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [query, isComposing]);

  const searchHits = useMemo<SearchHit[]>(() => {
    if (!book || !debouncedQuery) return [];
    const needle = debouncedQuery.toLocaleLowerCase();
    const hits: SearchHit[] = [];
    for (const [index, chapter] of book.chapters.entries()) {
      if (chapter.locked) continue;
      if (chapter.title.toLocaleLowerCase().includes(needle)) {
        hits.push({ chapterIndex: index, chapterTitle: chapter.title, offset: 0, snippet: chapter.content.slice(0, 110) || chapter.title });
      }
      let from = 0;
      while (hits.length < 100) {
        const found = chapter.content.toLocaleLowerCase().indexOf(needle, from);
        if (found < 0) break;
        hits.push({ chapterIndex: index, chapterTitle: chapter.title, offset: found, snippet: chapter.content.slice(Math.max(0, found - 42), Math.min(chapter.content.length, found + needle.length + 62)).replace(/\s+/g, ' ') });
        from = found + Math.max(1, needle.length);
      }
      if (hits.length >= 100) break;
    }
    return hits;
  }, [book, debouncedQuery]);

  const totalCharacters = useMemo(() => book?.chapters.reduce((total, chapter) => total + chapter.content.length, 0) || 0, [book]);
  const currentOffset = Math.round((currentChapter?.content.length || 0) * chapterProgress);
  const charactersBefore = book?.chapters.slice(0, chapterIndex).reduce((total, chapter) => total + chapter.content.length, 0) || 0;
  const overallProgress = totalCharacters ? Math.round((charactersBefore + currentOffset) / totalCharacters * 100) : 0;

  const closeToc = useCallback(() => {
    setTocOpen(false);
    if (searchParams.has('toc')) {
      const next = new URLSearchParams(searchParams);
      next.delete('toc');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const jumpTo = useCallback((index: number, offset = 0) => {
    const target = book?.chapters[index];
    if (!target) return;
    if (target.locked) {
      notify('该演示章节尚未提供正文，导入完整 TXT 后即可阅读');
      return;
    }
    const progress = target.content.length ? Math.max(0, Math.min(1, offset / target.content.length)) : 0;
    pendingJump.current = { index, offset };
    if (index === chapterIndex) {
      setChapterProgress(progress);
      requestAnimationFrame(() => {
        const element = scrollRef.current;
        if (element) element.scrollLeft = Math.max(0, element.scrollWidth - element.clientWidth) * progress;
      });
    } else {
      setChapterIndex(index);
      setChapterProgress(progress);
    }
    closeToc();
    showChrome();
  }, [book, chapterIndex, closeToc, notify, showChrome]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
    setChapterProgress(maxScroll ? element.scrollLeft / maxScroll : 0);
    const prose = element.querySelector<HTMLElement>(`.${styles.prose}`);
    const gap = prose ? Number.parseFloat(window.getComputedStyle(prose).columnGap) || 0 : 0;
    setPageIndex(Math.max(0, Math.min(pageCount - 1, Math.round(element.scrollLeft / ((prose?.clientWidth || element.clientWidth) + gap || 1)))));
  };

  const animateTurn = useCallback((direction: 'next' | 'previous', updatePage: () => void) => {
    if (turnTimer.current) window.clearTimeout(turnTimer.current);
    if (turnFinishTimer.current) window.clearTimeout(turnFinishTimer.current);
    setTurnDirection(direction);
    turnTimer.current = window.setTimeout(updatePage, 210);
    turnFinishTimer.current = window.setTimeout(() => setTurnDirection(null), 520);
  }, []);

  const turnPage = useCallback((direction: 'next' | 'previous') => {
    const element = scrollRef.current;
    if (!element) return;
    const prose = element.querySelector<HTMLElement>(`.${styles.prose}`);
    const gap = prose ? Number.parseFloat(window.getComputedStyle(prose).columnGap) || 0 : 0;
    const step = (prose?.clientWidth || element.clientWidth) + gap;
    const targetPage = pageIndex + (direction === 'next' ? 1 : -1);
    if (targetPage >= 0 && targetPage < pageCount) {
      animateTurn(direction, () => {
        element.scrollTo({ left: Math.min(targetPage * step, element.scrollWidth - element.clientWidth), behavior: 'instant' });
        setPageIndex(targetPage);
      });
      return;
    }
    if (direction === 'next' && book && chapterIndex < book.chapters.length - 1) {
      animateTurn('next', () => jumpTo(chapterIndex + 1, 0));
    } else if (direction === 'previous' && book && chapterIndex > 0) {
      const previous = book.chapters[chapterIndex - 1];
      animateTurn('previous', () => jumpTo(chapterIndex - 1, previous.content.length));
    }
  }, [animateTurn, book, chapterIndex, jumpTo, pageCount, pageIndex]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerOrigin.current = { x: event.clientX, y: event.clientY };
    longPressTriggered.current = false;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      showChrome();
    }, 480);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = pointerOrigin.current;
    if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 12 && longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = undefined;
    const origin = pointerOrigin.current;
    pointerOrigin.current = null;
    if (longPressTriggered.current) {
      showChrome();
      longPressTriggered.current = false;
      return;
    }
    if (!origin) return;
    const deltaX = event.clientX - origin.x;
    const deltaY = event.clientY - origin.y;
    if (Math.abs(deltaX) > 46 && Math.abs(deltaX) > Math.abs(deltaY)) {
      turnPage(deltaX < 0 ? 'next' : 'previous');
      return;
    }
    if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 18) {
      const localX = event.clientX - event.currentTarget.getBoundingClientRect().left;
      if (localX < event.currentTarget.clientWidth * .3) turnPage('previous');
      else if (localX > event.currentTarget.clientWidth * .7) turnPage('next');
    }
  };

  const handlePageKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); turnPage('next'); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); turnPage('previous'); }
  };

  const addCurrentBookmark = async () => {
    if (!book || !currentChapter) return;
    const offset = Math.round(currentChapter.content.length * chapterProgress);
    const bookmark: BookmarkRecord = {
      id: makeId('bookmark'),
      bookId: book.id,
      chapterId: currentChapter.id,
      chapterTitle: currentChapter.title,
      offset,
      scrollProgress: chapterProgress,
      quote: currentChapter.content.slice(Math.max(0, offset - 16), Math.min(currentChapter.content.length, offset + 48)).replace(/\s+/g, ' ').trim(),
      note: '',
      createdAt: Date.now(),
    };
    try {
      await saveBookmark(bookmark);
      setBookmarks((items) => [bookmark, ...items]);
      notify('书签已保存');
    } catch { notify('书签保存失败，请检查浏览器存储空间。'); }
  };

  const handleRemoveBookmark = async (bookmarkId: string) => {
    try { await removeBookmark(bookmarkId); setBookmarks((items) => items.filter((item) => item.id !== bookmarkId)); }
    catch { notify('删除书签失败'); }
  };

  const handleJumpBookmark = (bookmark: BookmarkRecord) => {
    const index = book?.chapters.findIndex((chapter) => chapter.id === bookmark.chapterId) ?? -1;
    if (index >= 0) jumpTo(index, bookmark.offset);
  };

  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = (value: string) => {
    setIsComposing(false);
    setQuery(value);
  };

  const controlStyle = {
    '--reader-size': `${settings.fontSize}px`,
    '--reader-line-height': settings.lineHeight,
    '--reader-margin': `${settings.pageMargin}%`,
    '--reader-family': settings.fontFamily === 'serif' ? '"Noto Serif SC", "Songti SC", "SimSun", serif' : 'system-ui, sans-serif',
  } as CSSProperties;

  if (loading) return <main className={styles.loading}><span className={styles.spinner} />正在打开书籍并恢复阅读位置…</main>;
  if (loadError || !book || !currentChapter) return <main className={styles.errorPage}><SeoMeta title="书籍不可用｜古籍阅读" description="这本书目前无法打开。" path={`/reader/${encodeURIComponent(bookId)}`} indexable={false} /><p>{loadError || '这本书没有可显示的正文。'}</p><button onClick={() => navigate('/shelf')}>返回书架</button></main>;

  const handleTool = (next: ReaderTool) => {
    setTool(next);
    setTocOpen(true);
    showChrome();
  };

  return <main className={styles.reader} style={controlStyle}>
    <SeoMeta title={`${book.name} · ${currentChapter.title}｜古籍阅读`} description="在古籍阅读器中继续阅读。" path={`/reader/${encodeURIComponent(book.id)}`} indexable={false} />
    <header className={`${styles.topBar} ${chromeVisible ? '' : styles.chromeHidden}`} aria-hidden={!chromeVisible} inert={!chromeVisible}>
      <button className={styles.iconButton} onClick={() => navigate('/shelf')} aria-label="返回书架" title="返回书架"><ArrowLeft size={20} /></button>
      <div className={styles.bookTitle}><strong>{book.name}</strong><small>{currentChapter.title}</small></div>
      <button className={styles.iconButton} onClick={() => handleTool('search')} aria-label="书内搜索" title="书内搜索"><Search size={19} /></button>
      <button className={styles.iconButton} onClick={() => void addCurrentBookmark()} aria-label="添加书签" title="添加书签"><BookmarkPlus size={19} /></button>
      <button className={styles.iconButton} onClick={() => handleTool('directory')} aria-label="打开目录" title="目录"><List size={20} /></button>
      <button className={styles.iconButton} onClick={() => handleTool('type')} aria-label="排版设置" title="排版"><Settings2 size={19} /></button>
    </header>

    <section className={styles.readingStage} onKeyDown={handlePageKeys} tabIndex={0} aria-label="阅读页面">
      <div className={styles.paper} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={() => { if (longPressTimer.current) window.clearTimeout(longPressTimer.current); pointerOrigin.current = null; }} onContextMenu={(event) => event.preventDefault()}>
        <div className={styles.readingScroll} ref={scrollRef} onScroll={handleScroll}>
          <article className={`${styles.prose} ${currentChapter.locked ? styles.lockedProse : ''}`}>
            <p className={styles.chapterKicker}>{currentChapterIndexLabel(book, chapterIndex)}</p>
            <h1>{currentChapter.title}</h1>
            {currentChapter.locked ? <p className={styles.lockedMessage}>该演示章节尚未提供正文。导入完整 TXT 后，所有章节都可以阅读。</p> : <>
              <div className={styles.chapterText}><HighlightedText text={currentChapter.content} query={debouncedQuery} /></div>
              {book.source === 'catalog' && <AdSlot placement="chapterEnd" />}
            </>}
          </article>
        </div>
        {turnDirection && <div aria-hidden="true" className={`${styles.pageLeaf} ${turnDirection === 'next' ? styles.pageLeafNext : styles.pageLeafPrevious}`} onAnimationEnd={() => setTurnDirection(null)} />}
      </div>
      <button type="button" aria-label="上一页" aria-hidden={!chromeVisible} inert={!chromeVisible} className={`${styles.pageTurnControl} ${styles.pageTurnPrevious} ${chromeVisible ? '' : styles.pageControlHidden}`} onClick={() => turnPage('previous')}><ChevronLeft size={22} /></button>
      <button type="button" aria-label="下一页" aria-hidden={!chromeVisible} inert={!chromeVisible} className={`${styles.pageTurnControl} ${styles.pageTurnNext} ${chromeVisible ? '' : styles.pageControlHidden}`} onClick={() => turnPage('next')}><ChevronRight size={22} /></button>
    </section>

    <footer className={`${styles.bottomBar} ${chromeVisible ? '' : styles.chromeHidden}`} aria-hidden={!chromeVisible} inert={!chromeVisible}>
      <div className={styles.chapterNavigation}>
        <button onClick={() => jumpTo(Math.max(0, chapterIndex - 1))} disabled={chapterIndex <= 0} aria-label="上一章"><ChevronLeft size={19} />上一章</button>
        <span>第 {pageIndex + 1} / {pageCount} 页 · {chapterIndex + 1} / {book.chapters.length} 节</span>
        <button onClick={() => jumpTo(Math.min(book.chapters.length - 1, chapterIndex + 1))} disabled={chapterIndex >= book.chapters.length - 1} aria-label="下一章">下一章<ChevronRight size={19} /></button>
      </div>
      <div className={styles.progressBar}><span style={{ width: `${overallProgress}%` }} /></div>
      <button className={styles.openTools} onClick={() => handleTool('directory')}><BookOpen size={16} />目录 · {overallProgress}%</button>
    </footer>

    <ReaderTocSheet
      open={tocOpen}
      book={book}
      tool={tool}
      chapterIndex={chapterIndex}
      chapterProgress={Math.round(chapterProgress * 100)}
      overallProgress={overallProgress}
      currentOffset={currentOffset}
      currentReadPage={book.isDemo ? 19 + pageIndex : Math.max(1, (currentChapter.page || 1) + pageIndex)}
      query={query}
      searchHits={searchHits}
      bookmarks={bookmarks}
      settings={settings}
      onClose={closeToc}
      onSelectTool={handleTool}
      onQueryChange={setQuery}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onSelectChapter={(index) => jumpTo(index)}
      onJumpToPosition={jumpTo}
      onAddBookmark={() => void addCurrentBookmark()}
      onJumpBookmark={handleJumpBookmark}
      onRemoveBookmark={(id) => void handleRemoveBookmark(id)}
      onSettingsChange={onSettingsChange}
      onLockedChapter={() => notify('该演示章节尚未提供正文，导入完整 TXT 后即可阅读')}
    />
  </main>;
}

function currentChapterIndexLabel(book: BookRecord, index: number) {
  if (book.isDemo && index >= 3) return `演示章节 ${index - 2}`;
  return `第 ${index + 1} 节`;
}
