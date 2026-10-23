import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const publicRoot = path.join(root, 'public');

function readEnvFile(filename) {
  return readFile(path.join(root, filename), 'utf8').then((text) => new Map(text.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match) return [];
      return [[match[1], match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_all, double, single) => double ?? single)]];
    }))).catch(() => new Map());
}

const envFiles = await Promise.all(['.env', '.env.local', '.env.production', '.env.production.local'].map(readEnvFile));
const envValue = (key) => process.env[key] ?? [...envFiles].reverse().map((values) => values.get(key)).find((value) => value !== undefined);
const configuredUrl = envValue('VITE_SITE_URL') || '';
let siteUrl = '';
try {
  const candidate = new URL(configuredUrl);
  if (candidate.protocol === 'https:' && !candidate.username && !candidate.password && (candidate.pathname === '/' || candidate.pathname === '') && !candidate.search && !candidate.hash) siteUrl = candidate.origin;
} catch { /* Invalid/placeholder deployment origins do not get indexed. */ }
const indexingEnabled = envValue('VITE_INDEXING_ENABLED') === 'true' && Boolean(siteUrl);

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const routeUrl = (route) => `${siteUrl}${route === '/' ? '/' : `${route.replace(/\/$/, '')}/`}`;
const canonicalPath = (route) => route === '/' ? '/' : `${route.replace(/\/$/, '')}/`;
const metaFor = ({ title, description, route, type = 'website', jsonLd }) => {
  const robots = indexingEnabled ? 'index,follow' : 'noindex,nofollow';
  const canonical = indexingEnabled ? `<link rel="canonical" href="${escapeHtml(routeUrl(route))}">` : '';
  const structured = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : '';
  return `<title>${escapeHtml(title)}</title>\n    <meta name="description" content="${escapeHtml(description)}">\n    <meta name="robots" content="${robots}">\n    <meta property="og:type" content="${type}">\n    <meta property="og:title" content="${escapeHtml(title)}">\n    <meta property="og:description" content="${escapeHtml(description)}">\n    ${canonical}\n    ${structured}`;
};

const manifestPath = path.join(publicRoot, 'catalog.json');
let rawManifest;
try { rawManifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { rawManifest = { version: 1, books: [] }; }
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const candidates = rawManifest.version === 1 && Array.isArray(rawManifest.books) ? rawManifest.books : [];
const approved = [];
const seen = new Set();
for (const item of candidates) {
  if (!item || typeof item !== 'object' || !slugPattern.test(item.slug || '') || seen.has(item.slug)) continue;
  if (typeof item.title !== 'string' || !item.title.trim() || typeof item.description !== 'string' || !item.description.trim()) continue;
  if (typeof item.category !== 'string' || !item.category.trim() || !slugPattern.test(item.categorySlug || '')) continue;
  if (item.status !== 'approved' || item.rightsConfirmed !== true || item.commercialRightsConfirmed !== true || item.publicationApproved !== true) continue;
  if (item.contentFile !== `library/${item.slug}.txt`) continue;
  try { await readFile(path.join(publicRoot, 'library', `${item.slug}.txt`)); } catch { continue; }
  seen.add(item.slug);
  approved.push({ ...item });
}

// Vite copies public/ wholesale; remove any unlisted text so source files cannot
// accidentally become publicly reachable. Only reviewed manifest rows are copied.
const outLibrary = path.join(dist, 'library');
await rm(outLibrary, { recursive: true, force: true });
for (const book of approved) {
  await mkdir(outLibrary, { recursive: true });
  await copyFile(path.join(publicRoot, 'library', `${book.slug}.txt`), path.join(outLibrary, `${book.slug}.txt`));
}
await writeFile(path.join(dist, 'catalog.json'), `${JSON.stringify({ version: 1, books: approved }, null, 2)}\n`, 'utf8');

const articlesFile = JSON.parse(await readFile(path.join(root, 'src', 'content', 'articles.json'), 'utf8'));
const categories = [...new Map(approved.map((book) => [book.categorySlug, book.category])).entries()];
const staticPages = [
  { route: '/', title: '古籍阅读｜本地优先的 TXT 阅读器', description: '在自己的设备上阅读古籍与小说 TXT。支持本地导入、章节目录、全文搜索、书签和阅读进度恢复。' },
  { route: '/category', title: '分类检索｜公共书库｜古籍阅读', description: '按分类和书名检索经审核开放的古籍与小说。' },
  { route: '/guide', title: '阅读指南｜古籍阅读', description: '从 TXT 导入到书签、翻页与本地数据管理。' },
  { route: '/about', title: '关于我们｜古籍阅读', description: '古籍阅读是一款本地优先的古籍与小说 TXT 阅读器。' },
  { route: '/contact', title: '联系我们｜古籍阅读', description: '联系古籍阅读网站的运营者。' },
  { route: '/privacy', title: '隐私政策｜古籍阅读', description: '了解本地 TXT、阅读进度、书签、隐私偏好和广告配置如何处理。' },
  { route: '/terms', title: '服务条款｜古籍阅读', description: '使用古籍阅读 Web 阅读器和公共书库前，请阅读服务说明。' },
  ...articlesFile.articles.map((article) => ({
    route: `/articles/${article.slug}`,
    title: `${article.title}｜古籍阅读`,
    description: article.description,
    type: 'article',
    jsonLd: { '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: article.description },
  })),
  ...categories.map(([slug, name]) => ({ route: `/category/${slug}`, title: `${name}｜公共书库｜古籍阅读`, description: `浏览公共书库中的${name}内容。` })),
  ...approved.map((book) => ({
    route: `/books/${book.slug}`,
    title: `${book.title}｜古籍阅读`,
    description: book.description,
    type: 'book',
    jsonLd: { '@context': 'https://schema.org', '@type': 'Book', name: book.title, ...(book.author ? { author: { '@type': 'Person', name: book.author } } : {}), description: book.description },
  })),
];

const template = await readFile(path.join(dist, 'index.html'), 'utf8');
if (!template.includes('<!-- PUBLIC_SEO_META -->')) throw new Error('index.html is missing the public SEO marker');
for (const page of staticPages) {
  const html = template.replace('<!-- PUBLIC_SEO_META -->', metaFor(page));
  const target = page.route === '/' ? path.join(dist, 'index.html') : path.join(dist, ...page.route.split('/').filter(Boolean), 'index.html');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
}
// Keep private app entry points explicitly noindex when served as a route shell.
for (const route of ['/shelf', '/reader']) {
  const target = path.join(dist, route.slice(1), 'index.html');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, template.replace('<!-- PUBLIC_SEO_META -->', metaFor({ title: '古籍阅读', description: '本地阅读器页面。', route, type: 'website' })), 'utf8');
}

const urls = indexingEnabled ? staticPages.map((page) => routeUrl(page.route)) : [];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(path.join(dist, 'sitemap.xml'), sitemap, 'utf8');
const robots = indexingEnabled
  ? `User-agent: *\nAllow: /\nDisallow: /shelf\nDisallow: /reader/\nSitemap: ${siteUrl}/sitemap.xml\n`
  : 'User-agent: *\nDisallow: /\n';
await writeFile(path.join(dist, 'robots.txt'), robots, 'utf8');

console.log(`SEO 路由生成完成：${staticPages.length} 个公开页面，${approved.length} 本已审核公共书籍；索引${indexingEnabled ? '已启用' : '默认关闭'}。`);
