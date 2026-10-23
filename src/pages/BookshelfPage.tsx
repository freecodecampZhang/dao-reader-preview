import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, InputHTMLAttributes } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Check, ChevronDown, Clock3, FileUp, FolderOpen, Library, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import type { BookRecord, BookSummary, PublicCatalogBook, ReadingPosition } from '../types';
import { deleteBook, getAllBooks, getCatalogFavorites, getPosition, makeId, removeCatalogFavorite, renameBook, saveBook } from '../services/bookStorage';
import { parseTxtFile } from '../services/bookParser';
import { categoryList, loadApprovedCatalog } from '../services/publicCatalog';
import { SeoMeta } from '../site/SiteLayout';
import styles from './BookshelfPage.module.css';

interface BookshelfPageProps { notify: (message: string) => void }
type ShelfTab = 'shelf' | 'catalog' | 'favorites';

const directoryPickerProps = { webkitdirectory: '', directory: '' } as InputHTMLAttributes<HTMLInputElement> & { webkitdirectory: string; directory: string };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function progressPercent(position: ReaderPosition | undefined, chapterCount: number) {
  if (!position || chapterCount < 1) return 0;
  return Math.round(Math.min(1, (position.chapterIndex + position.scrollProgress) / chapterCount) * 100);
}

// Alias keeps the summary type narrow while still deriving reading progress from IndexedDB.
type ReaderPosition = ReadingPosition;

export default function BookshelfPage({ notify }: BookshelfPageProps) {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<ShelfTab>('shelf');
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [positions, setPositions] = useState<Record<string, ReaderPosition>>({});
  const [catalog, setCatalog] = useState<PublicCatalogBook[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [importProgress, setImportProgress] = useState('');
  const [loading, setLoading] = useState(true);

  const refreshBooks = async () => {
    const nextBooks = await getAllBooks();
    setBooks(nextBooks);
    const pairs = await Promise.all(nextBooks.map(async (book) => [book.id, await getPosition(book.id)] as const));
    setPositions(Object.fromEntries(pairs.filter((pair): pair is readonly [string, ReaderPosition] => Boolean(pair[1]))));
  };

  const refreshCatalog = async () => {
    setCatalogError('');
    try {
      const [books, favorites] = await Promise.all([loadApprovedCatalog(), getCatalogFavorites()]);
      setCatalog(books);
      setFavoriteSlugs(favorites.map((favorite) => favorite.slug));
      setSelectedCategory((current) => current && books.some((book) => book.categorySlug === current) ? current : '');
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : '公共书库暂时无法读取。');
    }
  };

  useEffect(() => {
    void Promise.all([refreshBooks(), refreshCatalog()])
      .catch((error: unknown) => notify(error instanceof Error ? error.message : '打开书架失败'))
      .finally(() => setLoading(false));
  }, []);

  const search = query.trim().toLocaleLowerCase();
  const filteredBooks = useMemo(() => books.filter((book) => !search || `${book.name} ${book.fileName}`.toLocaleLowerCase().includes(search)), [books, search]);
  const categories = useMemo(() => categoryList(catalog), [catalog]);
  const catalogBooks = useMemo(() => catalog.filter((book) => (!selectedCategory || book.categorySlug === selectedCategory)
    && (!search || `${book.title} ${book.author || ''} ${book.category} ${book.description}`.toLocaleLowerCase().includes(search))).slice(0, 160), [catalog, search, selectedCategory]);
  const favoriteBooks = useMemo(() => catalog.filter((book) => favoriteSlugs.includes(book.slug)
    && (!search || `${book.title} ${book.author || ''} ${book.category}`.toLocaleLowerCase().includes(search))), [catalog, favoriteSlugs, search]);
  const latestBook = books.find((book) => book.lastReadAt && positions[book.id]);

  const importFiles = async (fileList: FileList | File[]) => {
    const textFiles = Array.from(fileList).filter((file) => file.name.toLowerCase().endsWith('.txt'));
    if (!textFiles.length) {
      if (fileList.length) notify('所选内容中没有找到 TXT 文件');
      return;
    }
    let imported = 0;
    const failures: string[] = [];
    for (const [index, file] of textFiles.entries()) {
      setImportProgress(`正在解析 ${index + 1} / ${textFiles.length}：${file.name}`);
      try {
        const parsed = await parseTxtFile(file);
        const pathName = file.webkitRelativePath || file.name;
        const book: BookRecord = {
          id: makeId('book'),
          name: file.name.replace(/\.txt$/i, ''),
          fileName: pathName,
          source: 'upload',
          content: parsed.text,
          chapters: parsed.chapters,
          size: file.size,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await saveBook(book);
        imported++;
      } catch (error) {
        failures.push(`${file.name}: ${error instanceof Error ? error.message : '解析失败'}`);
      }
    }
    setImportProgress('');
    await refreshBooks();
    setTab('shelf');
    if (failures.length) notify(`已导入 ${imported} 本，${failures.length} 本未能读取：${failures[0]}`);
    else notify(`已导入 ${imported} 本 TXT`);
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    void importFiles(input.files || []).finally(() => { input.value = ''; });
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files.length) void importFiles(event.dataTransfer.files);
  };

  const openBook = (id: string) => navigate(`/reader/${encodeURIComponent(id)}`);

  const openCatalogBook = (book: PublicCatalogBook) => navigate(`/books/${encodeURIComponent(book.slug)}`);

  const forgetFavorite = async (slug: string) => {
    try {
      await removeCatalogFavorite(slug);
      setFavoriteSlugs((slugs) => slugs.filter((item) => item !== slug));
      notify('已从收藏中移除');
    } catch { notify('移除收藏失败，请稍后重试。'); }
  };

  const handleRename = async (book: BookSummary) => {
    const nextName = window.prompt('修改书名', book.name)?.trim();
    if (!nextName || nextName === book.name) return;
    try { await renameBook(book.id, nextName); await refreshBooks(); notify('书名已更新'); }
    catch (error) { notify(error instanceof Error ? error.message : '修改书名失败'); }
  };

  const handleDelete = async (book: BookSummary) => {
    if (book.isDemo) { notify('演示书籍用于展示目录样式，暂不删除'); return; }
    if (!window.confirm(`确定删除《${book.name}》吗？书籍、阅读进度和书签都会一并删除。`)) return;
    try { await deleteBook(book.id); await refreshBooks(); notify('书籍已删除'); }
    catch (error) { notify(error instanceof Error ? error.message : '删除失败'); }
  };

  return (
    <main className={styles.page} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <SeoMeta title="我的书架｜古籍阅读" description="管理保存在此设备浏览器中的 TXT 书籍、收藏与阅读进度。" path="/shelf" indexable={false} />
      <header className={styles.header}>
        <div className={styles.headerActions}>
          <button className={styles.subtleButton} onClick={() => void Promise.all([refreshBooks(), refreshCatalog()])} aria-label="刷新书架和古籍目录" title="刷新">
            <RefreshCw size={17} /><span>刷新</span>
          </button>
          <button className={styles.importButton} onClick={() => fileInput.current?.click()}><FileUp size={17} /><span>导入 TXT</span></button>
          <input ref={fileInput} className={styles.hiddenInput} type="file" accept=".txt,text/plain" multiple onChange={onInputChange} />
          <input ref={folderInput} className={styles.hiddenInput} type="file" accept=".txt,text/plain" multiple {...directoryPickerProps} onChange={onInputChange} aria-label="选择包含 TXT 的文件夹" />
        </div>
      </header>

      <section className={styles.content}>
        <div className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>本地藏书</p>
            <h1>把喜欢的文字，<span>留在书架上。</span></h1>
            <p className={styles.description}>TXT 保存在此浏览器的 IndexedDB 中，随时继续阅读。</p>
          </div>
          {latestBook && <button className={styles.continueCard} onClick={() => openBook(latestBook.id)}>
            <span className={styles.continueIcon}><Clock3 size={19} /></span>
            <span className={styles.continueText}><small>接着上次读</small><strong>{latestBook.name}</strong><em>{positions[latestBook.id]?.chapterIndex ? `读到第 ${positions[latestBook.id].chapterIndex + 1} 章` : '继续阅读'}</em></span>
            <ChevronDown className={styles.continueArrow} size={20} />
          </button>}
        </div>

        <div className={styles.shelfToolbar}>
          <div className={styles.tabs} role="tablist" aria-label="书籍来源">
            <button className={tab === 'shelf' ? styles.activeTab : ''} role="tab" aria-selected={tab === 'shelf'} onClick={() => setTab('shelf')}>我的书架 <span>{books.length}</span></button>
            <button className={tab === 'catalog' ? styles.activeTab : ''} role="tab" aria-selected={tab === 'catalog'} onClick={() => setTab('catalog')}>公共书库 <span>{catalog.length}</span></button>
            <button className={tab === 'favorites' ? styles.activeTab : ''} role="tab" aria-selected={tab === 'favorites'} onClick={() => setTab('favorites')}>收藏 <span>{favoriteSlugs.length}</span></button>
          </div>
          <label className={styles.searchBox}><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索书名或目录…" aria-label="搜索书名" />{query && <button aria-label="清空搜索" onClick={() => setQuery('')}>×</button>}</label>
          {tab === 'shelf' && <button className={styles.folderButton} onClick={() => folderInput.current?.click()}><FolderOpen size={17} /><span>导入文件夹</span></button>}
        </div>

        {importProgress && <div className={styles.importStatus} role="status"><span className={styles.spinner} />{importProgress}</div>}

        {tab === 'shelf' ? (
          <section className={styles.bookGrid} aria-label="我的书架">
            {loading ? <p className={styles.stateMessage}>正在读取书架…</p> : filteredBooks.length === 0 ? <div className={styles.emptyState}><BookOpen size={32} /><strong>{search ? '没有找到这本书' : '书架还空着'}</strong><span>导入 TXT，或查看已审核开放的公共书籍。</span><button onClick={() => fileInput.current?.click()}><Plus size={16} />导入 TXT</button></div> : filteredBooks.map((book, index) => {
              const percent = progressPercent(positions[book.id], book.chapterCount);
              return <article className={styles.bookCard} key={book.id}>
                <button className={`${styles.bookCover} ${styles[`cover${index % 5}`]}`} onClick={() => openBook(book.id)} aria-label={`打开《${book.name}》`}>
                  <span className={styles.coverSeal}>{book.source === 'demo' ? '演' : '藏'}</span>
                  <BookOpen size={25} strokeWidth={1.4} />
                  <span className={styles.coverTitle}>{book.name}</span>
                </button>
                <div className={styles.bookDetails}>
                  <button className={styles.bookName} onClick={() => openBook(book.id)}>{book.name}</button>
                  <p>{book.source === 'demo' ? '演示书籍 · 示例目录' : `${book.chapterCount} 章 · ${formatSize(book.size)}`}</p>
                  <div className={styles.progressTrack}><span style={{ width: `${percent}%` }} /></div>
                  <div className={styles.bookMeta}><span>{percent ? `读至 ${percent}%` : '尚未阅读'}</span><span>{book.lastReadAt ? new Date(book.lastReadAt).toLocaleDateString('zh-CN') : '最近导入'}</span></div>
                </div>
                <div className={styles.cardActions}>
                  {book.source !== 'demo' && <button aria-label={`修改《${book.name}》书名`} title="修改书名" onClick={() => void handleRename(book)}><Pencil size={15} /></button>}
                  {book.source !== 'demo' && <button aria-label={`删除《${book.name}》`} title="删除书籍" onClick={() => void handleDelete(book)}><Trash2 size={15} /></button>}
                </div>
              </article>;
            })}
          </section>
        ) : tab === 'catalog' ? (
          <section className={styles.catalogPanel} aria-label="公共书库">
            {catalogError ? <div className={styles.emptyState}><Library size={32} /><strong>公共书库暂不可用</strong><span>{catalogError}</span></div> : <>
              <label className={styles.folderSelect}><span>分类</span><select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option value="">全部分类</option>{categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}（{category.count}）</option>)}</select><ChevronDown size={16} /></label>
              <div className={styles.catalogList}>
                {catalogBooks.length === 0 ? <p className={styles.stateMessage}>暂时没有经管理员审核并确认发布权利的公共书籍。你可以导入自己的 TXT，文件只保存在本设备。</p> : catalogBooks.map((book) => <button className={styles.catalogRow} key={book.slug} onClick={() => openCatalogBook(book)}>
                  <span className={styles.catalogIcon}><BookOpen size={18} /></span><span className={styles.catalogText}><strong>{book.title}</strong><small>{book.category}{book.author ? ` · ${book.author}` : ''}</small></span><span className={styles.catalogOpen}>详情</span>
                </button>)}
              </div>
              {catalogBooks.length >= 160 && <p className={styles.limitNote}>当前显示前 160 本，请缩小搜索范围。</p>}
            </>}
          </section>
        ) : (
          <section className={styles.catalogPanel} aria-label="已收藏的公共书籍">
            {catalogError ? <div className={styles.emptyState}><Library size={32} /><strong>收藏书目暂不可用</strong><span>{catalogError}</span></div> : favoriteBooks.length === 0 ? <div className={styles.emptyState}><BookOpen size={32} /><strong>还没有收藏公共书籍</strong><span>在书籍详情页选择“加入书架”，收藏会保存在当前设备。</span></div> : <div className={styles.catalogList}>
              {favoriteBooks.map((book) => <div className={styles.favoriteRow} key={book.slug}>
                <button className={styles.catalogRow} onClick={() => openCatalogBook(book)}><span className={styles.catalogIcon}><BookOpen size={18} /></span><span className={styles.catalogText}><strong>{book.title}</strong><small>{book.category}{book.author ? ` · ${book.author}` : ''}</small></span><span className={styles.catalogOpen}>详情</span></button>
                <button className={styles.removeFavorite} onClick={() => void forgetFavorite(book.slug)} aria-label={`从收藏中移除《${book.title}》`} title="移除收藏"><X size={16} /></button>
              </div>)}
            </div>}
          </section>
        )}
      </section>
      <footer className={styles.footer}><span><Check size={15} />本地 TXT 仅保存在此设备的浏览器中</span><span>{books.length} 本本地书籍 · {favoriteSlugs.length} 本公共收藏</span></footer>
    </main>
  );
}
