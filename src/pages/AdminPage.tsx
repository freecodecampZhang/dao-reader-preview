import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Check, CircleAlert, Eye, FileUp, LogOut, RefreshCw, Save, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import { SeoMeta } from '../site/SiteLayout';
import { parseBufferInWorker } from '../services/bookParser';
import styles from './AdminPage.module.css';

interface AdminBook {
  slug: string;
  title: string;
  author: string;
  dynasty: string;
  textForm: string;
  editionType: string;
  baseEdition: string;
  fullTextConfirmed: boolean;
  originalSource: string;
  publicLicense: string;
  category: string;
  description: string;
  status: 'draft' | 'published';
  originalFilename: string;
  rightsConfirmed: boolean;
  commercialRightsConfirmed: boolean;
  publicationApproved: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ApiResponse { error?: string; [key: string]: unknown }
type RightsConfirmation = { rightsConfirmed: boolean; commercialRightsConfirmed: boolean; publicationApproved: boolean };
interface BookPreview { text: string; chapterCount: number; encoding: string; truncated: boolean }

async function api<T extends ApiResponse = ApiResponse>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(payload.error || `请求失败（${response.status}）`);
  return payload;
}

function formatTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [rights, setRights] = useState<Record<string, RightsConfirmation>>({});
  const [previews, setPreviews] = useState<Record<string, BookPreview>>({});
  const [previewOpen, setPreviewOpen] = useState<Record<string, boolean>>({});
  const [loadingPreview, setLoadingPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    const result = await api<{ books: AdminBook[] }>('/api/admin/books');
    setBooks(result.books);
    setRights((current) => Object.fromEntries(result.books.map((book) => [book.slug, book.status === 'published' ? {
      rightsConfirmed: false, commercialRightsConfirmed: false, publicationApproved: false,
    } : current[book.slug] || {
      rightsConfirmed: false, commercialRightsConfirmed: false, publicationApproved: false,
    }])));
  };

  useEffect(() => {
    let alive = true;
    void api<{ configured: boolean; authenticated: boolean }>('/api/admin/session')
      .then((session) => {
        if (!alive) return;
        setConfigured(session.configured);
        setAuthenticated(session.authenticated);
        if (session.authenticated) return refresh();
        return undefined;
      })
      .catch((reason: unknown) => {
        if (!alive) return;
        setConfigured(false);
        const message = reason instanceof Error ? reason.message : '管理员状态检查失败。';
        setError(message.includes('404') ? '管理员 Pages Functions API 尚未部署到此环境。' : message);
      })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      setPassword(''); setAuthenticated(true); setNotice('已安全登录'); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '管理员登录失败。'); }
    finally { setBusy(false); }
  };

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const form = new FormData();
      for (const file of files) form.append('files', file, file.name);
      const result = await api<{ imported: number; failed: number; results: Array<{ fileName: string; error?: string }> }>('/api/admin/books', { method: 'POST', body: form });
      await refresh();
      const failedNames = result.results.filter((item) => item.error).map((item) => `${item.fileName}：${item.error}`).join('；');
      setNotice(`已收录 ${result.imported} 本为待审核草稿${result.failed ? `，${result.failed} 本失败` : ''}。草稿不会公开。`);
      if (failedNames) setError(failedNames);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '批量上传失败。'); }
    finally { setBusy(false); }
  };

  const editBook = (slug: string, field: keyof Pick<AdminBook, 'title' | 'author' | 'dynasty' | 'textForm' | 'editionType' | 'baseEdition' | 'originalSource' | 'publicLicense' | 'category' | 'description'>, value: string) => {
    setBooks((items) => items.map((book) => book.slug === slug ? { ...book, [field]: value } : book));
  };

  const bookPayload = (book: AdminBook) => ({
    title: book.title, author: book.author, dynasty: book.dynasty, textForm: book.textForm,
    editionType: book.editionType, baseEdition: book.baseEdition, fullTextConfirmed: book.fullTextConfirmed,
    originalSource: book.originalSource, publicLicense: book.publicLicense,
    category: book.category, description: book.description,
  });

  const saveBook = async (book: AdminBook) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/api/admin/books/${encodeURIComponent(book.slug)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookPayload(book)),
      });
      setNotice(`《${book.title}》资料已保存。`);
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存资料失败。'); }
    finally { setBusy(false); }
  };

  const publishBook = async (book: AdminBook) => {
    const confirmation = rights[book.slug];
    if (!confirmation?.rightsConfirmed || !confirmation.commercialRightsConfirmed || !confirmation.publicationApproved) return;
    if (!book.author.trim() || !book.dynasty.trim() || !book.textForm || !book.editionType || !book.baseEdition.trim() || !book.fullTextConfirmed || !book.originalSource.trim() || !book.publicLicense.trim()) {
      setError('发布前请补全版本资料、原始来源和公开使用许可，并确认全文完整。');
      return;
    }
    if (!window.confirm(`确认将《${book.title}》发布到全站公共书库？所有访客都可以阅读。`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/api/admin/books/${encodeURIComponent(book.slug)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookPayload(book)),
      });
      await api(`/api/admin/books/${encodeURIComponent(book.slug)}/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', ...confirmation }),
      });
      await refresh(); setNotice(`《${book.title}》已发布，全站访客现在可以阅读。`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '发布失败。'); }
    finally { setBusy(false); }
  };

  const unpublishBook = async (book: AdminBook) => {
    if (!window.confirm(`确认撤下《${book.title}》？书籍会从公共目录和搜索结果中移除。`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/api/admin/books/${encodeURIComponent(book.slug)}/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unpublish' }),
      });
      await refresh(); setNotice(`《${book.title}》已撤下，正文仍保留为私有草稿。`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '撤下失败。'); }
    finally { setBusy(false); }
  };

  const deleteDraft = async (book: AdminBook) => {
    if (!window.confirm(`永久删除待审核书籍《${book.title}》及其私有正文？`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/api/admin/books/${encodeURIComponent(book.slug)}`, { method: 'DELETE' });
      await refresh(); setNotice(`《${book.title}》已删除。`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '删除失败。'); }
    finally { setBusy(false); }
  };

  const logout = async () => {
    setBusy(true);
    try { await api('/api/admin/session', { method: 'DELETE' }); setAuthenticated(false); setBooks([]); setNotice('已退出管理员登录。'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '退出登录失败。'); }
    finally { setBusy(false); }
  };

  const setRight = (slug: string, key: keyof RightsConfirmation, checked: boolean) => {
    setRights((items) => ({ ...items, [slug]: { ...items[slug], [key]: checked } }));
  };

  const togglePreview = async (book: AdminBook) => {
    if (previewOpen[book.slug]) { setPreviewOpen((items) => ({ ...items, [book.slug]: false })); return; }
    if (previews[book.slug]) { setPreviewOpen((items) => ({ ...items, [book.slug]: true })); return; }
    setLoadingPreview(book.slug); setError('');
    try {
      const response = await fetch(`/api/admin/books/${encodeURIComponent(book.slug)}/content`, { credentials: 'same-origin' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || '书籍正文读取失败。');
      }
      const parsed = await parseBufferInWorker(await response.arrayBuffer());
      setPreviews((items) => ({ ...items, [book.slug]: { text: parsed.text.slice(0, 5000), chapterCount: parsed.chapters.length, encoding: parsed.encoding, truncated: parsed.text.length > 5000 } }));
      setPreviewOpen((items) => ({ ...items, [book.slug]: true }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : '书籍正文预览失败。'); }
    finally { setLoadingPreview(''); }
  };

  const pendingBooks = books.filter((book) => book.status === 'draft');
  const publishedBooks = books.filter((book) => book.status === 'published');

  return <main className={styles.page}>
    <SeoMeta title="书库管理｜古籍阅读" description="管理员审核和管理公共书库内容。" path="/admin" indexable={false} />
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>PUBLIC LIBRARY ADMIN</p><h1>公共书库管理</h1><p>TXT 批量上传后先保存为私有草稿；完成审核并确认发布权利后，才对访客开放。</p></div>
      {authenticated && <div className={styles.headerActions}><button className={styles.iconButton} onClick={() => { setBusy(true); void refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '刷新失败。')).finally(() => setBusy(false)); }} disabled={busy} aria-label="刷新书库"><RefreshCw size={17} /><span>刷新</span></button><button className={styles.iconButton} onClick={() => void logout()} disabled={busy}><LogOut size={17} /><span>退出</span></button></div>}
    </header>

    {error && <div className={styles.messageError} role="alert"><CircleAlert size={17} />{error}</div>}
    {notice && <div className={styles.messageSuccess} role="status"><Check size={17} />{notice}</div>}

    {checking ? <p className={styles.state}>正在确认管理员登录状态…</p> : !configured ? <section className={styles.setupNotice}><ShieldCheck size={24} /><div><h2>管理员后台尚未配置</h2><p>为保护书稿，上传接口默认关闭。请先按部署文档配置 D1、私有 R2 桶，以及管理员账号、密码和会话密钥，再重新部署网站。</p></div></section> : !authenticated ? <form className={styles.login} onSubmit={(event) => void login(event)}>
      <ShieldCheck size={25} /><h2>管理员登录</h2><p>此入口仅供书库管理员使用。</p><label>管理员账号<input type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required maxLength={80} /></label><label>管理员密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required maxLength={256} /></label><button className={styles.primaryButton} disabled={busy || !username || !password}>{busy ? '正在登录…' : '登录管理后台'}</button>
    </form> : <>
      <section className={styles.uploadSection}>
        <div className={styles.uploadIntro}><span className={styles.uploadIcon}><UploadCloud size={20} /></span><div><h2>批量收录 TXT</h2><p>每个文件最多 6 MB，单次最多 20 本且总量不超过 12 MB。正文会存入私有文件桶。</p></div></div>
        <input ref={fileInput} className={styles.hiddenInput} type="file" accept=".txt,text/plain" multiple onChange={(event) => void uploadFiles(event)} />
        <button className={styles.primaryButton} onClick={() => fileInput.current?.click()} disabled={busy}><FileUp size={17} />{busy ? '正在处理…' : '选择多个 TXT 文件'}</button>
      </section>

      <div className={styles.counts}><span><strong>{pendingBooks.length}</strong>待审核</span><span><strong>{publishedBooks.length}</strong>已发布</span></div>

      <section className={styles.bookSection}>
        <div className={styles.sectionHeading}><div><h2>待审核草稿</h2><p>补全版本资料、核对正文与来源许可，再逐项确认权利并发布。</p></div><span className={styles.draftBadge}>私有</span></div>
        {pendingBooks.length ? pendingBooks.map((book) => {
          const checked = rights[book.slug] || { rightsConfirmed: false, commercialRightsConfirmed: false, publicationApproved: false };
          const allConfirmed = checked.rightsConfirmed && checked.commercialRightsConfirmed && checked.publicationApproved;
          const versionReady = Boolean(book.author.trim() && book.dynasty.trim() && book.textForm && book.editionType && book.baseEdition.trim() && book.fullTextConfirmed && book.originalSource.trim() && book.publicLicense.trim());
          return <article className={styles.bookRow} key={book.slug}>
            <div className={styles.bookHeading}><div><h3>{book.title}</h3><p>{book.originalFilename} · 收录于 {formatTime(book.createdAt)}</p></div><span className={styles.draftBadge}>待审核</span></div>
            <button className={styles.previewButton} onClick={() => void togglePreview(book)} disabled={busy || loadingPreview === book.slug}><Eye size={15} />{loadingPreview === book.slug ? '正在读取正文…' : previewOpen[book.slug] ? '收起正文预览' : '预览正文'}</button>
            {previewOpen[book.slug] && previews[book.slug] && <section className={styles.preview} aria-label={`《${book.title}》正文预览`}><p>{previews[book.slug].chapterCount} 个章节 · {previews[book.slug].encoding}{previews[book.slug].truncated ? ' · 仅显示前 5000 字' : ''}</p><pre>{previews[book.slug].text}</pre></section>}
            <div className={styles.fields}>
              <label>书名<input value={book.title} maxLength={120} onChange={(event) => editBook(book.slug, 'title', event.target.value)} /></label>
              <label>作者<input value={book.author} maxLength={80} placeholder="未知作者请填写“佚名”" onChange={(event) => editBook(book.slug, 'author', event.target.value)} /></label>
              <label>朝代<input value={book.dynasty} maxLength={40} placeholder="如：明、清、唐" onChange={(event) => editBook(book.slug, 'dynasty', event.target.value)} /></label>
              <label>分类<input value={book.category} maxLength={40} onChange={(event) => editBook(book.slug, 'category', event.target.value)} /></label>
              <label className={styles.descriptionField}>简介<textarea value={book.description} maxLength={280} rows={3} onChange={(event) => editBook(book.slug, 'description', event.target.value)} /></label>
              <label>文字<select value={book.textForm} onChange={(event) => editBook(book.slug, 'textForm', event.target.value)}><option value="">请选择</option><option value="简体">简体</option><option value="繁体">繁体</option></select></label>
              <label>版本类型<select value={book.editionType} onChange={(event) => editBook(book.slug, 'editionType', event.target.value)}><option value="">请选择</option><option value="古籍 TXT">古籍 TXT</option><option value="校勘本">校勘本</option><option value="原版影印">原版影印</option></select></label>
              <label>底本<input value={book.baseEdition} maxLength={120} placeholder="如：万历词话本、崇祯本" onChange={(event) => editBook(book.slug, 'baseEdition', event.target.value)} /></label>
              <label className={styles.descriptionField}>原始来源<input value={book.originalSource} maxLength={500} placeholder="填写馆藏、出版信息或原始链接" onChange={(event) => editBook(book.slug, 'originalSource', event.target.value)} /></label>
              <label className={styles.descriptionField}>公开使用许可<input value={book.publicLicense} maxLength={500} placeholder="填写明确许可依据；仅写“来源于网络”不够" onChange={(event) => editBook(book.slug, 'publicLicense', event.target.value)} /></label>
            </div>
            <div className={styles.rightsList}>
              <label><input type="checkbox" checked={book.fullTextConfirmed} onChange={(event) => setBooks((items) => items.map((item) => item.slug === book.slug ? { ...item, fullTextConfirmed: event.target.checked } : item))} />我已核对目录与正文，确认全文完整（如有缺卷、缺页或删节，请先说明并补齐）。</label>
              <label><input type="checkbox" checked={checked.rightsConfirmed} onChange={(event) => setRight(book.slug, 'rightsConfirmed', event.target.checked)} />我已核验该文本及其发布授权，确认本站有权公开。</label>
              <label><input type="checkbox" checked={checked.commercialRightsConfirmed} onChange={(event) => setRight(book.slug, 'commercialRightsConfirmed', event.target.checked)} />我已核验公开展示及商业使用所需的权利。</label>
              <label><input type="checkbox" checked={checked.publicationApproved} onChange={(event) => setRight(book.slug, 'publicationApproved', event.target.checked)} />我已完成内容审核，并批准将其发布到全站公共书库。</label>
            </div>
            <div className={styles.rowActions}><span className={styles.reviewStatus}>{versionReady ? '版本资料齐全' : '版本资料未完成'}</span><button onClick={() => void saveBook(book)} disabled={busy}><Save size={15} />保存资料</button><button className={styles.publishButton} onClick={() => void publishBook(book)} disabled={busy || !allConfirmed || !versionReady}><Check size={15} />审核并发布</button><button className={styles.deleteButton} onClick={() => void deleteDraft(book)} disabled={busy}><Trash2 size={15} />删除</button></div>
          </article>;
        }) : <div className={styles.empty}><FileUp size={23} /><strong>暂时没有待审核书籍</strong><span>上传的 TXT 会先出现在这里，不会自动公开。</span></div>}
      </section>

      <section className={styles.bookSection}>
        <div className={styles.sectionHeading}><div><h2>已发布书籍</h2><p>公开内容需有完整版本资料、全文核实记录及有效的发布权利确认。</p></div><span className={styles.publishedBadge}>全站可读</span></div>
        {publishedBooks.length ? <div className={styles.publishedList}>{publishedBooks.map((book) => <article className={styles.publishedRow} key={book.slug}><div><strong>{book.title}</strong><span>{[book.category, book.author, book.dynasty, book.baseEdition].filter(Boolean).join(' · ')}</span></div><a href={`/books/${encodeURIComponent(book.slug)}`} target="_blank" rel="noreferrer">查看页面</a><button className={styles.unpublishButton} onClick={() => void unpublishBook(book)} disabled={busy}>撤下</button></article>)}</div> : <div className={styles.empty}><ShieldCheck size={23} /><strong>目前没有已发布内容</strong><span>发布后会进入公共书库、分类检索和站点地图。</span></div>}
      </section>
    </>}
  </main>;
}
