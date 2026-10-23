import { backendReady, json, toPublicBook, type LibraryRow, type PagesFunction } from '../../_shared';

export const onRequestGet: PagesFunction = async ({ env }) => {
  if (!backendReady(env)) return json({ version: 1, books: [] }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  const result = await env.DB.prepare('SELECT slug, title, author, dynasty, text_form, edition_type, base_edition, full_text_confirmed, original_source, public_license, category, category_slug, description, r2_key, status, rights_confirmed, commercial_rights_confirmed, publication_approved, original_filename, created_at, updated_at FROM library_books WHERE status = \'published\' AND rights_confirmed = 1 AND commercial_rights_confirmed = 1 AND publication_approved = 1 ORDER BY created_at DESC LIMIT 2000').all<LibraryRow>();
  return json({ version: 1, books: result.results.map(toPublicBook) }, { headers: { 'Cache-Control': 'no-store' } });
};
