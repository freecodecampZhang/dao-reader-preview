import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

function filterApprovedCatalog(values: unknown[]) {
  const seen = new Set<string>();
  return values.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === 'object')).filter((book) => {
    const slug = book.slug;
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || seen.has(slug)) return false;
    if (typeof book.title !== 'string' || !book.title.trim() || typeof book.category !== 'string' || !book.category.trim()) return false;
    if (typeof book.categorySlug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(book.categorySlug)) return false;
    const contentFile = `library/${slug}.txt`;
    if (typeof book.description !== 'string' || !book.description.trim() || book.contentFile !== contentFile) return false;
    if (book.status !== 'approved' || book.rightsConfirmed !== true || book.commercialRightsConfirmed !== true || book.publicationApproved !== true) return false;
    if (!existsSync(resolve(process.cwd(), 'public', contentFile))) return false;
    seen.add(slug);
    return true;
  });
}

function privateTxtFirewall(): Plugin {
  return {
    name: 'private-txt-firewall',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        let pathname = '';
        try { pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname); }
        catch { response.statusCode = 400; response.end('Bad request'); return; }
        if (pathname.startsWith('/api/')) { response.statusCode = 404; response.end('Not found'); return; }
        if (pathname === '/catalog.json') {
          try {
            const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'public/catalog.json'), 'utf8')) as { version?: number; books?: unknown[] };
            const books = manifest.version === 1 && Array.isArray(manifest.books) ? filterApprovedCatalog(manifest.books) : [];
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(JSON.stringify({ version: 1, books }));
          } catch { response.statusCode = 500; response.end('Public catalog unavailable'); }
          return;
        }
        if (!pathname.toLowerCase().endsWith('.txt')) { next(); return; }

        // TXT in project folders is user/private source material. Only explicitly
        // approved files under public/library may be served during development.
        const match = pathname.match(/^\/library\/([a-z0-9]+(?:-[a-z0-9]+)*)\.txt$/);
        if (!match) { response.statusCode = 404; response.end('Not found'); return; }
        try {
          const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'public/catalog.json'), 'utf8')) as { version?: number; books?: unknown[] };
          const approved = manifest.version === 1 && Array.isArray(manifest.books)
            && filterApprovedCatalog(manifest.books).some((book) => book.slug === match[1]);
          if (!approved) { response.statusCode = 404; response.end('Not found'); return; }
        } catch { response.statusCode = 404; response.end('Not found'); return; }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), privateTxtFirewall()],
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  test: { environment: 'jsdom', setupFiles: './tests/setup.ts', restoreMocks: true },
});
