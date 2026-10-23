import { adminRequired, failure, json, sameOrigin, type PagesFunction } from '../../../../_shared';

export const onRequestPost: PagesFunction<{ slug: string }> = async (context) => {
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
    if (!value || typeof value !== 'object') return failure('发布操作格式无效。');
    input = value as Record<string, unknown>;
  } catch { return failure('发布操作格式无效。'); }
  const action = typeof input.action === 'string' ? input.action : '';

  const book = await db.prepare('SELECT status, title, author, dynasty, text_form, edition_type, base_edition, full_text_confirmed, original_source, public_license, category, description FROM library_books WHERE slug = ?').bind(slug).first<{ status: string; title: string; author: string | null; dynasty: string; text_form: string; edition_type: string; base_edition: string; full_text_confirmed: number; original_source: string; public_license: string; category: string; description: string }>();
  if (!book) return failure('没有找到这本书。', 404);
  const now = Math.floor(Date.now() / 1000);
  if (action === 'publish') {
    if (!book.title.trim() || !book.category.trim() || book.category === '待分类' || !book.description.trim() || book.description === '管理员审核中的 TXT 书籍。') {
      return failure('请先填写实际书名、分类和书籍简介，再进行发布审核。');
    }
    if (!book.author?.trim() || !book.dynasty.trim() || !['简体', '繁体'].includes(book.text_form) || !['古籍 TXT', '校勘本', '原版影印'].includes(book.edition_type) || !book.base_edition.trim()) {
      return failure('发布前请补全作者、朝代、文字、版本类型和底本信息。');
    }
    if (book.full_text_confirmed !== 1) return failure('发布前请核对正文并确认全文完整。');
    const missingEvidence = (value: string) => !value.trim() || /^(未知|待确认|未填写|来源于网络|网上下载|暂无|无)$/i.test(value.trim());
    if (missingEvidence(book.original_source) || missingEvidence(book.public_license)) return failure('请填写可核对的原始来源及明确的公开使用许可；“来源于网络”或“待确认”不能作为依据。');
    if (input.rightsConfirmed !== true || input.commercialRightsConfirmed !== true || input.publicationApproved !== true) {
      return failure('发布前必须逐项确认持有文本权利、商业使用权及网站公开发布审批。');
    }
    if (book.status !== 'draft') return failure('这本书已发布。', 409);
    await db.prepare('UPDATE library_books SET status = \'published\', rights_confirmed = 1, commercial_rights_confirmed = 1, publication_approved = 1, updated_at = ? WHERE slug = ?')
      .bind(now, slug).run();
    return json({ published: true });
  }
  if (action === 'unpublish') {
    if (book.status !== 'published') return failure('这本书当前未发布。', 409);
    await db.prepare('UPDATE library_books SET status = \'draft\', rights_confirmed = 0, commercial_rights_confirmed = 0, publication_approved = 0, updated_at = ? WHERE slug = ?')
      .bind(now, slug).run();
    return json({ published: false });
  }
  return failure('未知的发布操作。');
};
