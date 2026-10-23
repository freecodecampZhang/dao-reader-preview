import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, BookOpenText, Bookmark, ChevronRight, FileText, Library, Search, ShieldCheck, Upload } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { PublicCatalogBook } from '../types';
import { getCatalogFavorites, removeCatalogFavorite, saveCatalogFavorite } from '../services/bookStorage';
import { categoryList, loadApprovedCatalog } from '../services/publicCatalog';
import { readPrivacyPreferences, savePrivacyPreferences } from '../services/privacyConsent';
import AdSlot from '../components/AdSlot';
import { SeoMeta } from './SiteLayout';
import styles from './PublicPages.module.css';
import articleManifest from '../content/articles.json';

type Article = {
  slug: string;
  title: string;
  description: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
  references?: Array<{ title: string; url: string }>;
};
const articles = articleManifest.articles as Article[];

function useCatalog() {
  const [books, setBooks] = useState<PublicCatalogBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void loadApprovedCatalog().then((data) => { if (active) setBooks(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : '公共书库加载失败'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { books, loading, error };
}

function BookTile({ book }: { book: PublicCatalogBook }) {
  return <Link className={styles.bookTile} to={`/books/${book.slug}`}>
    <span className={styles.bookTileIcon}><BookOpen size={21} /></span>
    <span className={styles.bookTileText}><small>{book.category}</small><strong>{book.title}</strong><span>{book.description}</span></span>
    <ArrowRight className={styles.bookTileArrow} size={17} />
  </Link>;
}

function ArticleTile({ article }: { article: Article }) {
  return <Link className={styles.articleTile} to={`/articles/${article.slug}`}>
    <span className={styles.articleTileIcon}><FileText size={19} /></span>
    <span className={styles.articleTileText}><small>原创导读</small><strong>{article.title}</strong><span>{article.description}</span></span>
    <ArrowRight className={styles.bookTileArrow} size={17} />
  </Link>;
}

export function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { books, loading } = useCatalog();
  const featured = books.slice(0, 3);
  const submit = (event: React.FormEvent) => { event.preventDefault(); navigate(`/search?q=${encodeURIComponent(query.trim())}`); };

  return <>
    <SeoMeta title="古籍阅读｜本地优先的 TXT 阅读器" description="在自己的设备上阅读古籍与小说 TXT。支持本地导入、章节目录、全文搜索、书签和阅读进度恢复。" path="/" />
    <main className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>读一卷旧书，留一段自己的时间</p>
          <h1>让文字回到<br /><em>纸页般的安静。</em></h1>
          <p className={styles.heroText}>导入自己的 TXT，在熟悉的纸色里慢慢读。书籍、书签与阅读位置留在你的浏览器设备中。</p>
          <form className={styles.heroSearch} onSubmit={submit} role="search">
            <Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索书名、作者或古籍导读" aria-label="搜索书名、作者或古籍导读" /><button aria-label="搜索"><ArrowRight size={17} /></button>
          </form>
          <div className={styles.heroActions}><Link to="/shelf" className={styles.primaryLink}><Library size={17} />打开我的书架</Link><Link to="/guide" className={styles.textLink}>了解如何使用 <ChevronRight size={15} /></Link></div>
        </div>
        <div className={styles.heroVisual} aria-label="古籍阅读器示意">
          <div className={styles.bookShadow}><div className={styles.bookPage}><span>卷一 · 山水</span><strong>山中杂记</strong><p>溪云初起日沉阁，<br />山雨欲来风满楼。</p><small>本地阅读 · 自在随心</small></div></div>
          <span className={styles.seal}>藏</span>
        </div>
      </section>

      <section className={styles.promiseRow} aria-label="产品特点">
        <div><ShieldCheck size={19} /><span><strong>本地优先</strong><small>导入 TXT 不上传服务器</small></span></div>
        <div><Bookmark size={19} /><span><strong>随读随记</strong><small>进度与书签保存在设备</small></span></div>
        <div><BookOpenText size={19} /><span><strong>阅读舒适</strong><small>目录、翻页和排版设置</small></span></div>
      </section>

      <AdSlot placement="home" />

      <section className={styles.featuredSection}>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>PUBLIC COLLECTION</p><h2>公共书库</h2><p>仅展示完成审核并确认发布权利的内容。</p></div><Link to="/category">浏览分类 <ArrowRight size={15} /></Link></div>
        {loading ? <p className={styles.state}>正在读取公共目录…</p> : featured.length ? <div className={styles.bookList}>{featured.map((book) => <BookTile key={book.slug} book={book} />)}</div> : <div className={styles.emptyCatalog}><BookOpenText size={22} /><strong>公共书库正在整理中</strong><span>目前没有已审核公开的书籍。你可以先导入自己的 TXT，本地阅读功能不受影响。</span><Link to="/shelf">前往我的书架 <ArrowRight size={14} /></Link></div>}
      </section>
      <section className={styles.featuredSection}>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>READING NOTES</p><h2>古籍导读</h2><p>原创阅读笔记与经典作品介绍，不收录未经授权的现代译注或版本正文。</p></div><Link to="/articles">全部导读 <ArrowRight size={15} /></Link></div>
        <div className={styles.articleGrid}>{articles.filter((article) => article.slug !== 'reading-guide').slice(0, 3).map((article) => <ArticleTile key={article.slug} article={article} />)}</div>
      </section>
      <section className={styles.guideCard}><span><Upload size={20} /></span><div><h2>从自己的 TXT 开始</h2><p>文件只保存在当前浏览器。无需注册，也不会自动上传。</p></div><Link to="/shelf">导入 TXT <ArrowRight size={16} /></Link></section>
    </main>
  </>;
}

export function CatalogPage() {
  const { books, loading, error } = useCatalog();
  const { categorySlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [input, setInput] = useState(query);
  useEffect(() => setInput(query), [query]);
  const categories = useMemo(() => categoryList(books), [books]);
  const activeCategory = categories.find((category) => category.slug === categorySlug);
  const shown = books.filter((book) => (!categorySlug || book.categorySlug === categorySlug)
    && (!query || `${book.title} ${book.author || ''} ${book.dynasty || ''} ${book.baseEdition || ''} ${book.category} ${book.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  const title = activeCategory ? `${activeCategory.name}｜公共书库` : '分类检索｜公共书库';
  const path = categorySlug ? `/category/${categorySlug}` : '/category';
  const submit = (event: React.FormEvent) => { event.preventDefault(); const next = new URLSearchParams(searchParams); input.trim() ? next.set('q', input.trim()) : next.delete('q'); setSearchParams(next); };

  return <>
    <SeoMeta title={`${title}｜古籍阅读`} description="按分类和书名检索经审核开放的古籍与小说。" path={path} indexable={!categorySlug || Boolean(activeCategory)} />
    <main className={styles.contentPage}>
      <p className={styles.eyebrow}>PUBLIC LIBRARY</p><h1>{activeCategory?.name || '公共书库'}</h1><p className={styles.lead}>只展示经管理员审核、确认有权发布及用于商业展示的书籍。个人导入 TXT 不会进入此目录。</p>
      <form className={styles.catalogSearch} onSubmit={submit}><Search size={18} /><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="搜索书名、作者或简介" aria-label="搜索公共书库" /><button>搜索</button></form>
      <nav className={styles.categoryChips} aria-label="书籍分类"><Link className={!categorySlug ? styles.selectedChip : ''} to="/category">全部</Link>{categories.map((category) => <Link className={categorySlug === category.slug ? styles.selectedChip : ''} to={`/category/${category.slug}`} key={category.slug}>{category.name}<small>{category.count}</small></Link>)}</nav>
      {error ? <p className={styles.state} role="alert">{error}</p> : loading ? <p className={styles.state}>正在读取公共目录…</p> : shown.length ? <div className={styles.bookList}>{shown.map((book) => <BookTile key={book.slug} book={book} />)}</div> : <div className={styles.emptyCatalog}><BookOpenText size={22} /><strong>{query ? '没有匹配的书籍' : '此分类暂时没有已审核书籍'}</strong><span>公共内容需完成审核并确认发布权利后，才会出现在网站中。</span></div>}
    </main>
  </>;
}

export function ArticleIndexPage() {
  return <>
    <SeoMeta title="古籍导读与经典作品介绍｜古籍阅读" description="阅读原创古籍版本知识、经典作品介绍与本地阅读指南。" path="/articles" />
    <main className={styles.contentPage}>
      <p className={styles.eyebrow}>READING NOTES</p><h1>古籍导读</h1>
      <p className={styles.lead}>从版本、底本和阅读方法开始，慢慢认识经典。这里发布原创导读与作品介绍；公共书库只在来源、授权和业务许可经核实后扩充。</p>
      <div className={styles.articleGrid}>{articles.map((article) => <ArticleTile key={article.slug} article={article} />)}</div>
    </main>
  </>;
}

export function SearchPage() {
  const { books, loading, error } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();
  const [input, setInput] = useState(query);
  useEffect(() => setInput(query), [query]);
  const normalized = query.toLocaleLowerCase();
  const matchingBooks = normalized ? books.filter((book) => `${book.title} ${book.author || ''} ${book.dynasty || ''} ${book.category} ${book.baseEdition || ''} ${book.description}`.toLocaleLowerCase().includes(normalized)) : [];
  const matchingArticles = normalized ? articles.filter((article) => `${article.title} ${article.description} ${article.sections.map((section) => `${section.heading} ${section.paragraphs.join(' ')}`).join(' ')}`.toLocaleLowerCase().includes(normalized)) : [];
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    input.trim() ? next.set('q', input.trim()) : next.delete('q');
    setSearchParams(next);
  };
  return <>
    <SeoMeta title="搜索古籍、作品与导读｜古籍阅读" description="搜索已审核公共书籍、原创古籍导读和经典作品介绍。私人导入 TXT 不参与网站搜索。" path="/search" indexable={false} />
    <main className={styles.contentPage}>
      <p className={styles.eyebrow}>SEARCH</p><h1>搜索内容</h1><p className={styles.lead}>搜索公共书籍资料与原创导读。你的本地 TXT 和阅读记录不会上传，也不会出现在这里。</p>
      <form className={styles.catalogSearch} onSubmit={submit} role="search"><Search size={18} /><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="书名、作者、朝代或关键词" aria-label="搜索公共书籍与导读文章" /><button>搜索</button></form>
      {!query ? <section className={styles.searchSuggestions}><h2>先从这些内容开始</h2><div className={styles.articleGrid}>{articles.filter((article) => article.slug !== 'reading-guide').slice(0, 3).map((article) => <ArticleTile key={article.slug} article={article} />)}</div></section> : <>
        {error && <p className={styles.state} role="alert">{error}</p>}
        {loading && <p className={styles.state}>正在检索公共书库…</p>}
        {!loading && !error && <>
          {matchingBooks.length > 0 && <section className={styles.searchResults}><h2>公共书籍 <small>{matchingBooks.length}</small></h2><div className={styles.bookList}>{matchingBooks.map((book) => <BookTile key={book.slug} book={book} />)}</div></section>}
          {matchingArticles.length > 0 && <section className={styles.searchResults}><h2>导读文章 <small>{matchingArticles.length}</small></h2><div className={styles.articleGrid}>{matchingArticles.map((article) => <ArticleTile key={article.slug} article={article} />)}</div></section>}
          {!matchingBooks.length && !matchingArticles.length && <div className={styles.emptyCatalog}><Search size={22} /><strong>没有找到相关内容</strong><span>试试更短的关键词，或浏览全部古籍导读。</span><Link to="/articles">浏览导读 <ArrowRight size={14} /></Link></div>}
        </>}
      </>}
    </main>
  </>;
}

export function PublicBookPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { books, loading, error } = useCatalog();
  const book = books.find((item) => item.slug === slug);
  const hasVersionMetadata = Boolean(book && (book.dynasty || book.textForm || book.editionType || book.baseEdition || book.originalSource || book.publicLicense || book.fullTextConfirmed !== undefined));
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let active = true;
    void getCatalogFavorites().then((favorites) => { if (active) setSaved(favorites.some((item) => item.slug === slug)); }).catch(() => { if (active) setActionError('收藏状态暂时无法读取。'); });
    return () => { active = false; };
  }, [slug]);

  const toggleFavorite = async () => {
    if (!book) return;
    try {
      if (saved) await removeCatalogFavorite(book.slug); else await saveCatalogFavorite(book.slug);
      setSaved(!saved);
      setActionError('');
    } catch { setActionError('收藏状态无法保存，请检查浏览器存储设置。'); }
  };

  if (loading) return <main className={styles.contentPage}><p className={styles.state}>正在读取书籍信息…</p></main>;
  if (error || !book) return <main className={styles.contentPage}><SeoMeta title="书籍暂不可用｜古籍阅读" description="此书不在当前公开书库中。" path={`/books/${slug}`} indexable={false} /><div className={styles.notFound}><strong>没有找到这本公开书籍</strong><p>{error || '书籍可能已下架，或尚未通过公开审核。'}</p><Link to="/category">返回公共书库</Link></div></main>;

  return <>
    <SeoMeta title={`${book.title}｜古籍阅读`} description={book.description} path={`/books/${book.slug}`} />
    <main className={styles.contentPage}>
      <p className={styles.breadcrumb}><Link to="/category">公共书库</Link><ChevronRight size={14} /><Link to={`/category/${book.categorySlug}`}>{book.category}</Link></p>
      <article className={styles.detailCard}>
        <div className={styles.detailCover}><BookOpenText size={31} /><span>{book.category}</span></div>
        <div className={styles.detailCopy}><p className={styles.eyebrow}>已审核公开内容</p><h1>{book.title}</h1><p className={styles.byline}>{book.author ? `作者：${book.author}` : '古籍与小说'}</p><p className={styles.description}>{book.description}</p>
          <div className={styles.detailActions}><button className={styles.primaryButton} onClick={() => navigate(`/reader/public-${book.slug}`)}>开始阅读 <ArrowRight size={16} /></button><button className={styles.secondaryButton} onClick={() => void toggleFavorite()}>{saved ? '已加入书架' : '加入书架'}</button></div>
          {actionError && <p className={styles.inlineError} role="alert">{actionError}</p>}
          <p className={styles.rightsNote}><ShieldCheck size={15} />此项公共内容已标记为管理员确认可发布及商业使用。</p>
        </div>
      </article>
      {hasVersionMetadata && <section className={styles.versionInfo}><h2>版本信息</h2><dl>
        <div><dt>作者</dt><dd>{book.author || '未提供'}</dd></div>
        <div><dt>朝代</dt><dd>{book.dynasty || '未提供'}</dd></div>
        <div><dt>文字</dt><dd>{book.textForm || '未提供'}</dd></div>
        <div><dt>类型</dt><dd>{book.editionType || '未提供'}</dd></div>
        <div><dt>底本</dt><dd>{book.baseEdition || '未提供'}</dd></div>
        <div><dt>全文完整性</dt><dd>{book.fullTextConfirmed === true ? '已核实全文完整' : '未提供核实信息'}</dd></div>
        <div><dt>原始来源</dt><dd>{book.originalSource || '未提供'}</dd></div>
        <div><dt>公开使用许可</dt><dd>{book.publicLicense || '未提供'}</dd></div>
      </dl></section>}
      <section className={styles.aboutBook}><h2>阅读说明</h2><p>点击“开始阅读”后，正文文件会从本站公共目录读取，并保存到此设备的本地书架以恢复阅读进度。个人导入 TXT 始终保存在本地，不会上传。</p></section>
      <AdSlot placement="bookDetail" />
    </main>
  </>;
}

export function ArticlePage() {
  const { slug = '' } = useParams();
  const article = articles.find((item) => item.slug === slug);
  if (!article) return <main className={styles.contentPage}><SeoMeta title="文章未找到｜古籍阅读" description="没有找到这篇文章。" path={`/articles/${slug}`} indexable={false} /><div className={styles.notFound}><strong>没有找到这篇文章</strong><Link to="/guide">返回阅读指南</Link></div></main>;
  return <>
    <SeoMeta title={`${article.title}｜古籍阅读`} description={article.description} path={`/articles/${article.slug}`} />
    <main className={styles.contentPage}>
      <article className={styles.article}>
        <p className={styles.eyebrow}>READING NOTES</p><h1>{article.title}</h1><p className={styles.lead}>{article.description}</p>
        {article.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
        {article.references?.length ? <section className={styles.articleReferences}><h2>延伸阅读</h2><ul>{article.references.map((reference) => <li key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a></li>)}</ul><small>本站导读为原创内容；外部链接仅供进一步查阅，相关作品与版本权利依原站说明。</small></section> : null}
      </article>
    </main>
  </>;
}

export function GuidePage() {
  const article = articles.find((item) => item.slug === 'reading-guide') || articles[0];
  return <>
    <SeoMeta title="阅读指南｜古籍阅读" description={article.description} path="/guide" />
    <main className={styles.contentPage}>
      <p className={styles.eyebrow}>HELP & READING</p><h1>阅读指南</h1><p className={styles.lead}>从 TXT 导入到书签、翻页与本地数据管理。</p>
      <Link className={styles.guideArticle} to={`/articles/${article.slug}`}><span><BookOpenText size={21} /></span><div><strong>{article.title}</strong><small>{article.description}</small></div><ArrowRight size={17} /></Link>
      <section className={styles.guideSteps}><h2>三步开始阅读</h2><ol><li><strong>导入文件</strong><span>在我的书架选择 TXT 或文件夹。</span></li><li><strong>打开章节</strong><span>从目录、全文搜索或上次阅读位置进入。</span></li><li><strong>保存进度</strong><span>阅读位置和书签会留在当前浏览器设备。</span></li></ol></section>
      <Link className={styles.primaryLink} to="/shelf"><Library size={16} />打开我的书架</Link>
    </main>
  </>;
}

const informationalCopy = {
  '/about': { title: '关于我们', desc: '古籍阅读是一款本地优先的古籍与小说 TXT 阅读器。', sections: [['产品定位', '古籍阅读帮助读者在浏览器中导入 TXT，按章节阅读，并管理书签与阅读位置。当前版本不要求注册账号，也不提供跨设备云同步。'], ['本地与公共内容', '从设备导入的文件只保存在当前浏览器的 IndexedDB。公共书库是单独维护的公开目录，仅在审核并确认具有发布权和商业使用权后展示内容。'], ['运营信息', '网站运营主体与登记信息尚未在此仓库配置。正式上线前请补充真实运营者名称、联系渠道及适用的经营许可信息。']] },
  '/contact': { title: '联系我们', desc: '联系古籍阅读网站的运营者。', sections: [['反馈与版权联系', '若需要咨询公共书库内容、反馈网站问题或提出版权事项，请使用下方已配置的联系邮箱。普通访客导入的 TXT 只保存在自己的设备；公共书库上传入口仅供授权管理员使用。'], ['回复方式', '公开联系邮箱通过 VITE_CONTACT_EMAIL 配置。上线前请确认邮箱真实可用，并安排请求处理流程。']] },
  '/privacy': { title: '隐私政策', desc: '了解本地 TXT、阅读进度、书签、隐私偏好和广告配置如何处理。', sections: [['本地书籍与阅读记录', '普通访客导入的 TXT 正文、解析章节、阅读位置和书签保存在当前浏览器 IndexedDB，不会上传服务器。阅读设置和本站广告偏好保存在此设备的 localStorage。当前版本没有读者账号或云同步。清除浏览器站点数据或删除书籍会移除相应本地数据。'], ['公共书库与网站请求', '只有管理员登录后台后才能批量上传 TXT。上传文件先存入私有对象存储并作为待审核草稿，仅管理员接口可以读取；只有审核并逐项确认文本发布权、商业使用权及网站发布审批后，书目才进入公开目录，正文才可由访客读取。打开已发布书籍时，浏览器会请求正文并写入本地书架以支持离线续读。'], ['广告与第三方服务', '默认不开启广告，也不加载广告第三方脚本。只有运营者填写真实平台和广告位配置、启用广告、用户允许可选广告，并满足配置的 CMP 授权条件时，页面才会请求广告脚本。开发环境只显示占位组件。'], ['隐私选择与 CMP', '本站提供的偏好设置只记录本设备上的广告选择，不是认证 CMP，也不替代适用地区要求的认证 CMP。若配置了 Google AdSense 等广告，运营者必须先选用适合流量地区的 CMP 并完成真实集成。'], ['上线前信息', '运营者身份、数据请求联系渠道、适用地区及最终保留期限需由网站运营者在上线前补充和审定。此页面描述当前代码的数据流，不代替法律审查。']] },
  '/terms': { title: '服务条款', desc: '使用古籍阅读 Web 阅读器和公共书库前，请阅读服务说明。', sections: [['服务范围', '本网站提供浏览器端 TXT 阅读、书架、章节目录、搜索、书签和公共书库浏览功能。阅读器不提供读者账号同步、购买、付费解锁或数字版权管理。'], ['本地文件', '普通访客导入的文件保存在本设备浏览器中，不会上传或自动发布。公共书库管理员上传内容会先进入私有待审核状态。'], ['公共内容', '只有完成审核并确认具有文本发布权、商业使用权和网站发布批准后，管理员才可将书籍公开。发现权利或信息问题时，请使用联系我们页面中配置的正式联系渠道。'], ['服务可用性与运营者信息', '本地阅读能力依赖当前设备和浏览器的 IndexedDB 存储空间。运营主体、适用法律和争议解决方式尚待运营者按实际情况填写，正式上线前应完成审定。']] },
} as const;

export function InformationPage() {
  const { pathname } = useLocation();
  const page = informationalCopy[pathname as keyof typeof informationalCopy] || informationalCopy['/about'];
  const email = import.meta.env.VITE_CONTACT_EMAIL?.trim();
  const [adsAllowed, setAdsAllowed] = useState(() => readPrivacyPreferences()?.optionalAds === true);
  const saveAds = (allow: boolean) => { savePrivacyPreferences(allow); setAdsAllowed(allow); };
  return <>
    <SeoMeta title={`${page.title}｜古籍阅读`} description={page.desc} path={pathname} />
    <main className={`${styles.contentPage} ${styles.infoPage}`}>
      <p className={styles.eyebrow}>INFORMATION</p><h1>{page.title}</h1><p className={styles.lead}>{page.desc}</p>
      <article className={styles.article}>{page.sections.map(([heading, copy]) => <section key={heading}><h2>{heading}</h2><p>{copy}</p>{pathname === '/contact' && heading === '回复方式' && (email ? <p><a href={`mailto:${email}`}>{email}</a></p> : <p className={styles.notice}>联系邮箱尚未配置。运营者上线前可通过 VITE_CONTACT_EMAIL 设置真实邮箱。</p>)}</section>)}
        {pathname === '/privacy' && <section className={styles.preferenceCard}><h2>本站隐私偏好</h2><p>当前设备的可选广告偏好：<strong>{adsAllowed ? '允许' : '关闭'}</strong></p><div><button onClick={() => saveAds(false)}>关闭可选广告</button><button onClick={() => saveAds(true)}>允许可选广告</button></div><small>此偏好面板不是认证 CMP。CMP 必需时，即使允许广告，在 CMP 集成确认前仍不会加载广告脚本。</small></section>}
      </article>
    </main>
  </>;
}
