import { validSiteOrigin, type PagesFunction } from './_shared';

export const onRequestGet: PagesFunction = async (context) => {
  const response = await context.next();
  const origin = validSiteOrigin(context.env);
  if (!origin || !context.env.DB || !response.ok) return response;
  const result = await context.env.DB.prepare('SELECT slug FROM library_books WHERE status = \'published\' AND rights_confirmed = 1 AND commercial_rights_confirmed = 1 AND publication_approved = 1 ORDER BY created_at DESC LIMIT 2000').all<{ slug: string }>();
  if (!result.results.length) return response;
  const dynamicEntries = result.results
    .filter((book) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(book.slug))
    .map((book) => `  <url><loc>${origin}/books/${encodeURIComponent(book.slug)}/</loc></url>`)
    .join('\n');
  if (!dynamicEntries) return response;
  const xml = (await response.text()).replace('</urlset>', `${dynamicEntries}\n</urlset>`);
  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  headers.set('Content-Type', 'application/xml; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(xml, { status: response.status, headers });
};
