import { backendReady, failure, type LibraryRow, type PagesFunction } from '../../../../_shared';

export const onRequestGet: PagesFunction<{ slug: string }> = async ({ params, env }) => {
  const slug = params.slug;
  if (!/^book-[a-f0-9]{20}$/.test(slug)) return failure('没有找到这本公开书籍。', 404);
  if (!backendReady(env)) return failure('公共书库暂不可用。', 503);
  const book = await env.DB.prepare('SELECT r2_key FROM library_books WHERE slug = ? AND status = \'published\' AND rights_confirmed = 1 AND commercial_rights_confirmed = 1 AND publication_approved = 1').bind(slug).first<Pick<LibraryRow, 'r2_key'>>();
  if (!book || !book.r2_key.startsWith('drafts/')) return failure('没有找到这本公开书籍。', 404);
  const object = await env.BOOKS.get(book.r2_key);
  if (!object) return failure('书籍正文暂不可用。', 404);
  return new Response(object.body, { headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  } });
};
