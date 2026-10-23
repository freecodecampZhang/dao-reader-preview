import { adminRequired, cleanText, failure, json, safeSlug, sameOrigin, type LibraryRow, type PagesFunction } from '../../_shared';

const maxFileSize = 6 * 1024 * 1024;
const maxBatchSize = 12 * 1024 * 1024;
const maxFiles = 20;

export const onRequestGet: PagesFunction = async (context) => {
  const denied = await adminRequired(context);
  if (denied) return denied;
  const db = context.env.DB;
  if (!db) return failure('管理员书库尚未配置 D1。', 503);
  const result = await db.prepare('SELECT slug, title, author, dynasty, text_form, edition_type, base_edition, full_text_confirmed, original_source, public_license, category, category_slug, description, r2_key, status, rights_confirmed, commercial_rights_confirmed, publication_approved, original_filename, created_at, updated_at FROM library_books ORDER BY updated_at DESC LIMIT 500').all<LibraryRow>();
  return json({ books: result.results.map((book) => ({
    slug: book.slug,
    title: book.title,
    author: book.author || '',
    dynasty: book.dynasty || '',
    textForm: book.text_form || '',
    editionType: book.edition_type || '',
    baseEdition: book.base_edition || '',
    fullTextConfirmed: book.full_text_confirmed === 1,
    originalSource: book.original_source || '',
    publicLicense: book.public_license || '',
    category: book.category,
    description: book.description,
    status: book.status,
    originalFilename: book.original_filename,
    rightsConfirmed: book.rights_confirmed === 1,
    commercialRightsConfirmed: book.commercial_rights_confirmed === 1,
    publicationApproved: book.publication_approved === 1,
    createdAt: book.created_at,
    updatedAt: book.updated_at,
  })) });
};

export const onRequestPost: PagesFunction = async (context) => {
  if (!sameOrigin(context.request)) return failure('请求来源无效。', 403);
  const denied = await adminRequired(context);
  if (denied) return denied;
  const db = context.env.DB;
  const bucket = context.env.BOOKS;
  if (!db || !bucket) return failure('管理员书库尚未配置 D1 与 R2。', 503);
  const announcedLength = Number(context.request.headers.get('Content-Length') || 0);
  if (announcedLength > maxBatchSize + 256 * 1024) return failure('单次最多上传 12 MB TXT 文件。', 413);

  let form: FormData;
  try { form = await context.request.formData(); } catch { return failure('上传表单无法读取。'); }
  const files = form.getAll('files').filter((value): value is File => value instanceof File);
  if (!files.length) return failure('请选择 TXT 文件。');
  if (files.length > maxFiles) return failure(`一次最多上传 ${maxFiles} 个 TXT 文件。`, 413);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > maxBatchSize) return failure('单次上传总大小不能超过 12 MB。', 413);

  const results: Array<{ fileName: string; title?: string; slug?: string; error?: string }> = [];
  for (const file of files) {
    const fileName = cleanText(file.name.split(/[\\/]/).pop(), 180);
    if (!/\.txt$/i.test(fileName)) { results.push({ fileName, error: '只接受 .txt 文件。' }); continue; }
    if (file.size < 1 || file.size > maxFileSize) { results.push({ fileName, error: '文件必须大于 0 且不超过 6 MB。' }); continue; }
    const slug = `book-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const r2Key = `drafts/${slug}.txt`;
    const title = cleanText(fileName.replace(/\.txt$/i, ''), 120) || '未命名书籍';
    const now = Math.floor(Date.now() / 1000);
    try {
      const bytes = await file.arrayBuffer();
      await bucket.put(r2Key, bytes, { httpMetadata: { contentType: 'text/plain; charset=utf-8' } });
      await db.prepare('INSERT INTO library_books (slug, title, author, category, category_slug, description, r2_key, status, rights_confirmed, commercial_rights_confirmed, publication_approved, original_filename, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, \'draft\', 0, 0, 0, ?, ?, ?)')
        .bind(slug, title, '待分类', safeSlug('待分类'), '管理员审核中的 TXT 书籍。', r2Key, fileName, now, now).run();
      results.push({ fileName, title, slug });
    } catch {
      await bucket.delete(r2Key).catch(() => undefined);
      results.push({ fileName, error: '保存失败，请检查 R2 与 D1 绑定后重试。' });
    }
  }
  const imported = results.filter((item) => item.slug).length;
  return json({ imported, failed: results.length - imported, results }, { status: 200 });
};
