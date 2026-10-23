import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libraryDir = path.join(root, 'public', 'library');
const manifestPath = path.join(root, 'public', 'catalog.json');
const oldManifest = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => '{"version":1,"books":[]}'));
const oldEntries = Array.isArray(oldManifest.books) ? oldManifest.books : [];
const existingBySource = new Map(oldEntries
  .filter((entry) => entry && typeof entry === 'object' && typeof entry.sourceFile === 'string')
  .map((entry) => [entry.sourceFile, entry]));
const filenames = (await readdir(libraryDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.txt')
  .map((entry) => entry.name)
  .sort((a, b) => a < b ? -1 : a > b ? 1 : 0);

function inferExplicitAttribution(filename) {
  const match = filename.match(/[（(]([^（）()]*)[）)]$/);
  if (!match) return {};
  const attribution = match[1];
  const dynastyMatch = attribution.match(/^(先秦|秦|汉|西汉|东汉|三国|晋|南北朝|隋|唐|五代|宋|元|明|清|民国)(.+)$/);
  if (!dynastyMatch) return {};
  const [, dynasty, possibleAuthor] = dynastyMatch;
  const nonAuthorMarkers = /[本碑注解疏校评辑集传经录图刻藏序]/;
  if (possibleAuthor.length >= 2 && possibleAuthor.length <= 4 && !nonAuthorMarkers.test(possibleAuthor)) {
    return { dynasty, author: possibleAuthor.replace(/[著撰编]$/, '') };
  }
  return {};
}

const books = filenames.map((sourceFile) => {
  const title = path.basename(sourceFile, path.extname(sourceFile)).trim();
  const slug = `book-${createHash('sha256').update(sourceFile, 'utf8').digest('hex').slice(0, 12)}`;
  const existing = existingBySource.get(sourceFile);
  const inferred = inferExplicitAttribution(title);
  return {
    ...(existing || {}),
    slug,
    title,
    ...(existing?.author ? { author: existing.author } : inferred.author ? { author: inferred.author } : {}),
    category: existing?.category || '古籍与小说',
    categorySlug: existing?.categorySlug || 'classics',
    description: existing?.description || `根据文件名建立的 TXT 书目项；来源、版本与发布权利待核实。`,
    contentFile: `library/${slug}.txt`,
    sourceFile,
    ...(existing?.dynasty ? {} : inferred.dynasty ? { dynasty: inferred.dynasty } : { dynasty: '' }),
    textForm: existing?.textForm ?? '',
    editionType: existing?.editionType ?? '古籍 TXT',
    baseEdition: existing?.baseEdition ?? '',
    fullTextConfirmed: existing?.fullTextConfirmed ?? false,
    originalSource: existing?.originalSource ?? '',
    publicLicense: existing?.publicLicense ?? '',
    status: existing?.status === 'approved' ? 'approved' : 'draft',
    rightsConfirmed: existing?.rightsConfirmed === true,
    commercialRightsConfirmed: existing?.commercialRightsConfirmed === true,
    publicationApproved: existing?.publicationApproved === true,
  };
});

await writeFile(manifestPath, `${JSON.stringify({ version: 1, books }, null, 2)}\n`, 'utf8');
console.log(`已按文件名生成 ${books.length} 条书目记录；${books.filter((book) => book.status === 'approved' && book.rightsConfirmed && book.commercialRightsConfirmed && book.publicationApproved).length} 条满足发布条件，其余保留为草稿。`);
