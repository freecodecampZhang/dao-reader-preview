import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import BookshelfPage from './pages/BookshelfPage';
import ReaderPage from './pages/ReaderPage';
import { getBook, getPosition, saveBook, savePosition } from './services/bookStorage';
import { readReaderSettings, writeReaderSettings } from './services/readerSettings';
import { createDemoBook } from './utils/demoBook';
import type { ReaderSettings } from './types';
import styles from './app.module.css';
import SiteLayout from './site/SiteLayout';
import { ArticlePage, CatalogPage, GuidePage, HomePage, InformationPage, PublicBookPage } from './site/PublicPages';

export default function App() {
  const [settings, setSettings] = useState<ReaderSettings>(readReaderSettings);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    writeReaderSettings(settings);
  }, [settings]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        let demo = await getBook('demo-book');
        if (!demo) {
          demo = createDemoBook();
          await saveBook(demo);
        }
        if (!(await getPosition('demo-book'))) {
          const firstStoryChapter = Math.min(3, demo.chapters.length - 1);
          await savePosition({
            bookId: demo.id,
            chapterId: demo.chapters[firstStoryChapter].id,
            chapterIndex: firstStoryChapter,
            scrollProgress: 0,
            offset: 0,
            updatedAt: Date.now(),
          });
        }
      } catch (error) {
        if (alive) notify(error instanceof Error ? error.message : '初始化本地书库失败');
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  }, []);

  const updateSettings = useCallback((next: ReaderSettings) => setSettings(next), []);

  if (!ready) return <div className={styles.loading}>正在打开本地书架…</div>;

  return (
    <div className={styles.app}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/shelf" element={<BookshelfPage notify={notify} />} />
          <Route path="/category" element={<CatalogPage />} />
          <Route path="/category/:categorySlug" element={<CatalogPage />} />
          <Route path="/books/:slug" element={<PublicBookPage />} />
          <Route path="/articles/:slug" element={<ArticlePage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/about" element={<InformationPage />} />
          <Route path="/contact" element={<InformationPage />} />
          <Route path="/privacy" element={<InformationPage />} />
          <Route path="/terms" element={<InformationPage />} />
        </Route>
        <Route path="/reader/:bookId" element={<ReaderPage settings={settings} onSettingsChange={updateSettings} notify={notify} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </div>
  );
}
