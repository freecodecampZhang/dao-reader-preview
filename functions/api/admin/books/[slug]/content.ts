import { adminRequired, failure, type LibraryRow, type PagesFunction } from '../../../../_shared';

export const onRequestGet: PagesFunction<{ slug: string }> = async (context) => {
  const denied = await adminRequired(context);
  if (denied) return denied;
  const db = context.env.DB;
  const bucket = context.env.BOOKS;
  if (!db || !bucket) return failure('管理员书库尚未配置 D1 与 R2。', 503);
  const slug = context.params.slug;
  if (!/^book-[a-f0-9]{20}$/.test(slug)) return failure('书籍标识无效。', 404);
  const row = await db.prepare('SELECT status, r2_key FROM library_books WHERE slug = ?').bind(slug).first<Pick<LibraryRow, 'status' | 'r2_key'>>();
  if (!row || !row.r2_key.startsWith('drafts/')) return failure('没有找到这本书。', 404);
  const object = await bucket.get(row.r2_key);
  if (!object) return failure('书籍正文暂不可用。', 404);
  return new Response(object.body, { headers: {
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
};
