import { adminRequired, cleanText, failure, json, safeSlug, sameOrigin, type LibraryRow, type PagesFunction } from '../../../_shared';

export const onRequestPatch: PagesFunction<{ slug: string }> = async (context) => {
  if (!sameOrigin(context.request)) return failure('请求来源无效。', 403);
  const denied = await adminRequired(context);
  if (denied) return denied;
  const db = context.env.DB;
  if (!db) return failure('管理员书库尚未配置 D1。', 503);
  const slug = context.params.slug;
  if (!/^book-[a-f0-9]{20}$/.test(slug)) return failure('书籍标识无效。', 404);
  let input: Record<string, unknown>;
  try {
    const value: unknown = await context.request.json();
    if (!value || typeof value !== 'object') return failure('书籍资料格式无效。');
    input = value as Record<string, unknown>;
  } catch { return failure('书籍资料格式无效。'); }
  const title = cleanText(input.title, 120);
  const author = cleanText(input.author, 80);
  const dynasty = cleanText(input.dynasty, 40);
  const textForm = cleanText(input.textForm, 12);
  const editionType = cleanText(input.editionType, 20);
  const baseEdition = cleanText(input.baseEdition, 120);
  const fullTextConfirmed = input.fullTextConfirmed === true ? 1 : 0;
  const originalSource = cleanText(input.originalSource, 500);
  const publicLicense = cleanText(input.publicLicense, 500);
  const category = cleanText(input.category, 40);
  const description = cleanText(input.description, 280);
  if (!title || !category || !description) return failure('书名、分类和简介不能为空。');
  if (textForm && !['简体', '繁体'].includes(textForm)) return failure('文字请选择简体或繁体。');
  if (editionType && !['古籍 TXT', '校勘本', '原版影印'].includes(editionType)) return failure('版本类型无效。');
  const row = await db.prepare('SELECT status FROM library_books WHERE slug = ?').bind(slug).first<{ status: string }>();
  if (!row) return failure('没有找到这本书。', 404);
  await db.prepare('UPDATE library_books SET title = ?, author = ?, dynasty = ?, text_form = ?, edition_type = ?, base_edition = ?, full_text_confirmed = ?, original_source = ?, public_license = ?, category = ?, category_slug = ?, description = ?, updated_at = ? WHERE slug = ?')
    .bind(title, author || null, dynasty, textForm, editionType, baseEdition, fullTextConfirmed, originalSource, publicLicense, category, safeSlug(category), description, Math.floor(Date.now() / 1000), slug).run();
  const updated = await db.prepare('SELECT slug, title, author, dynasty, text_form, edition_type, base_edition, full_text_confirmed, original_source, public_license, category, category_slug, description, r2_key, status, rights_confirmed, commercial_rights_confirmed, publication_approved, original_filename, created_at, updated_at FROM library_books WHERE slug = ?').bind(slug).first<LibraryRow>();
  if (!updated) return failure('保存书籍资料失败。', 500);
  return json({ slug: updated.slug, title: updated.title, author: updated.author || '', dynasty: updated.dynasty, textForm: updated.text_form, editionType: updated.edition_type, baseEdition: updated.base_edition, fullTextConfirmed: updated.full_text_confirmed === 1, originalSource: updated.original_source, publicLicense: updated.public_license, category: updated.category, description: updated.description, status: updated.status });
};

export const onRequestDelete: PagesFunction<{ slug: string }> = async (context) => {
  if (!sameOrigin(context.request)) return failure('请求来源无效。', 403);
  const denied = await adminRequired(context);
  if (denied) return denied;
  const db = context.env.DB;
  const bucket = context.env.BOOKS;
  if (!db || !bucket) return failure('管理员书库尚未配置 D1 与 R2。', 503);
  const slug = context.params.slug;
  const row = await db.prepare('SELECT status, r2_key FROM library_books WHERE slug = ?').bind(slug).first<{ status: string; r2_key: string }>();
  if (!row) return failure('没有找到这本书。', 404);
  if (row.status !== 'draft') return failure('请先撤下公开内容，再删除这本书。', 409);
  await db.prepare('DELETE FROM library_books WHERE slug = ?').bind(slug).run();
  await bucket.delete(row.r2_key);
  return json({ deleted: true });
};
