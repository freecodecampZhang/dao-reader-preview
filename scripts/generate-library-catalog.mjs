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
const categorySlugByName = new Map([
  ['春秋', 'chunqiu'],
  ['乐经', 'yuejing'],
  ['礼经', 'lijing'],
  ['启蒙蒙学', 'qimeng-mengxue'],
  ['尚书', 'shangshu'],
  ['诗经', 'shijing'],
  ['四书', 'sishu'],
  ['五经总义', 'wujing-zongyi'],
  ['小学', 'xiaoxue'],
  ['孝经', 'xiaojing'],
  ['修身治家', 'xiushen-zhijia'],
  ['语录', 'yulu'],
]);
const approveCategoryFolders = process.argv.includes('--approve-category-folders');
const sources = [];
for (const entry of await readdir(libraryDir, { withFileTypes: true })) {
  if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.txt') {
    sources.push({ sourceFile: entry.name, category: '小说', categorySlug: 'novels' });
    continue;
  }
  if (!entry.isDirectory()) continue;
  const categorySlug = categorySlugByName.get(entry.name);
  if (!categorySlug) throw new Error(`未配置公共书库分类目录：${entry.name}`);
  for (const child of await readdir(path.join(libraryDir, entry.name), { withFileTypes: true })) {
    if (child.isFile() && path.extname(child.name).toLowerCase() === '.txt') {
      sources.push({ sourceFile: `${entry.name}/${child.name}`, category: entry.name, categorySlug });
    }
  }
}
sources.sort((a, b) => a.sourceFile < b.sourceFile ? -1 : a.sourceFile > b.sourceFile ? 1 : 0);

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

const books = sources.map(({ sourceFile, category, categorySlug }) => {
  const title = path.basename(sourceFile, path.extname(sourceFile)).trim();
  const slug = `book-${createHash('sha256').update(sourceFile, 'utf8').digest('hex').slice(0, 12)}`;
  const existing = existingBySource.get(sourceFile);
  const inferred = inferExplicitAttribution(title);
  const categoryIsApproved = approveCategoryFolders && sourceFile.includes('/');
  return {
    ...(existing || {}),
    slug,
    title,
    ...(existing?.author ? { author: existing.author } : inferred.author ? { author: inferred.author } : {}),
    category,
    categorySlug,
    description: existing?.description || (categoryIsApproved
      ? `收录于“${category}”分类；具体版本与底本信息待补充。`
      : `根据文件名建立的 TXT 书目项；来源、版本与发布权利待核实。`),
    contentFile: `library/${slug}.txt`,
    sourceFile,
    ...(existing?.dynasty ? {} : inferred.dynasty ? { dynasty: inferred.dynasty } : { dynasty: '' }),
    textForm: existing?.textForm ?? '',
    editionType: existing?.editionType ?? '古籍 TXT',
    baseEdition: existing?.baseEdition ?? '',
    fullTextConfirmed: existing?.fullTextConfirmed ?? false,
    originalSource: existing?.originalSource ?? '',
    publicLicense: existing?.publicLicense ?? '',
    status: categoryIsApproved || existing?.status === 'approved' ? 'approved' : 'draft',
    rightsConfirmed: categoryIsApproved || existing?.rightsConfirmed === true,
    commercialRightsConfirmed: categoryIsApproved || existing?.commercialRightsConfirmed === true,
    publicationApproved: categoryIsApproved || existing?.publicationApproved === true,
  };
});

await writeFile(manifestPath, `${JSON.stringify({ version: 1, books }, null, 2)}\n`, 'utf8');
console.log(`已扫描 ${books.length} 条书目记录（平铺小说 ${sources.filter((source) => !source.sourceFile.includes('/')).length} 本，分类目录 ${sources.filter((source) => source.sourceFile.includes('/')).length} 本）；${books.filter((book) => book.status === 'approved' && book.rightsConfirmed && book.commercialRightsConfirmed && book.publicationApproved).length} 条满足发布条件${approveCategoryFolders ? '（已按本次管理员指令批准分类目录）' : '，分类目录默认保留为草稿'}。`);
