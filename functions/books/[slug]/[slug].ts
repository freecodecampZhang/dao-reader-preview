import { escapeHtml, validSiteOrigin, type LibraryRow, type PagesFunction } from '../_shared';

export const onRequestGet: PagesFunction<{ slug: string }> = async (context) => {
  const response = await context.next();
  if (!response.ok || !response.headers.get('Content-Type')?.includes('text/html') || !context.env.DB) return response;
  const slug = context.params.slug;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return response;
  const book = await context.env.DB.prepare('SELECT slug, title, author, dynasty, text_form, edition_type, base_edition, full_text_confirmed, original_source, public_license, category, category_slug, description, r2_key, status, rights_confirmed, commercial_rights_confirmed, publication_approved, original_filename, created_at, updated_at FROM library_books WHERE slug = ? AND status = \'published\' AND rights_confirmed = 1 AND commercial_rights_confirmed = 1 AND publication_approved = 1').bind(slug).first<LibraryRow>();
  if (!book) return response;

  const origin = validSiteOrigin(context.env);
  const title = `${escapeHtml(book.title)}｜古籍阅读`;
  const description = escapeHtml(book.description);
  const robots = origin ? 'index,follow' : 'noindex,nofollow';
  let html = await response.text();
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  const replaceMeta = (selector: RegExp, replacement: string) => {
    if (selector.test(html)) html = html.replace(selector, replacement);
    else html = html.replace(/<\/head>/i, `${replacement}\n</head>`);
  };
  replaceMeta(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${description}">`);
  replaceMeta(/<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${robots}">`);
  replaceMeta(/<meta\s+property=["']og:type["'][^>]*>/i, '<meta property="og:type" content="book">');
  replaceMeta(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${title}">`);
  replaceMeta(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${description}">`);
  if (origin) {
    const canonical = `<link rel="canonical" href="${origin}/books/${encodeURIComponent(slug)}/">`;
    if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonical);
    else html = html.replace(/<\/head>/i, `${canonical}\n</head>`);
    const bookEdition = [book.dynasty, book.base_edition, book.edition_type].filter(Boolean).join(' · ');
    const bookLd = {
      '@context': 'https://schema.org', '@type': 'Book', name: book.title,
      ...(book.author ? { author: { '@type': 'Person', name: book.author } } : {}),
      ...(book.text_form ? { inLanguage: book.text_form === '繁体' ? 'zh-Hant' : 'zh-Hans' } : {}),
      ...(bookEdition ? { bookEdition } : {}),
      description: book.description,
    };
    html = html.replace(/<\/head>/i, `<script type="application/ld+json">${JSON.stringify(bookLd).replace(/</g, '\\u003c')}</script>\n</head>`);
  }

  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
};
