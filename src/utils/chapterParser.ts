import type { Chapter } from '../types';

const SECTION_NAMES = new Set(['序', '前言', '导读', '版权信息', '作者简介', '目录', '尾声', '后记', '楔子', '序章', '引子', '番外']);
const CHAPTER_PREFIX = /^第[〇零一二三四五六七八九十百千万两兩\d０-９]+[章节回卷部篇集]/u;
const SPECIAL_HEADING = /^(?:序章|楔子|尾声|后记|引子|番外|前言|导读|版权信息|作者简介|目录|序)(?:[\s:：、.．-].*)?$/u;

function isHeading(rawLine: string): boolean {
  const line = rawLine.trim().replace(/[　\t]+/g, ' ');
  if (!line || line.length > 72) return false;
  if (SPECIAL_HEADING.test(line)) return true;
  if (!CHAPTER_PREFIX.test(line)) return false;
  // 标题行通常短且独立；含常见句末标点的长句不当作目录章节。
  return !/[。！？!?]/u.test(line) && line.length <= 60;
}

function chapterId(index: number, title: string): string {
  const slug = title.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 36);
  return `chapter-${index}-${slug || 'text'}`;
}

/** 以独立标题行分章，保留章节正文与自然段的原始内容。 */
export function parseBookText(input: string): Chapter[] {
  const text = input.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  const headers: Array<{ start: number; contentStart: number; title: string }> = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    if (isHeading(line)) {
      const title = line.trim().replace(/[　\t]+/g, ' ');
      const contentStart = offset + line.length + (offset + line.length < text.length ? 1 : 0);
      headers.push({ start: offset, contentStart, title });
    }
    offset += line.length + 1;
  }

  if (!headers.length) {
    return [{ id: chapterId(0, '正文'), title: '正文', content: text, startOffset: 0, endOffset: text.length, page: 1 }];
  }

  const chapters: Chapter[] = [];
  const preface = text.slice(0, headers[0].start);
  if (preface.trim()) {
    const firstLabel = preface.split('\n').find((line) => line.trim())?.trim() || '前言';
    const title = SECTION_NAMES.has(firstLabel) ? firstLabel : '前言';
    chapters.push({ id: chapterId(chapters.length, title), title, content: preface, startOffset: 0, endOffset: headers[0].start, page: 1 });
  }

  headers.forEach((header, index) => {
    const endOffset = headers[index + 1]?.start ?? text.length;
    const content = text.slice(header.contentStart, endOffset);
    chapters.push({
      id: chapterId(chapters.length, header.title),
      title: header.title,
      content,
      startOffset: header.start,
      endOffset,
      page: Math.max(1, Math.floor(header.start / 800) + 1),
    });
  });
  return chapters;
}

/**
 * Parse chapters for reading. If headings consume the entire file (or a legacy
 * parser stored only empty chapter bodies), keep the complete source readable
 * as one raw-text chapter instead of opening a blank page.
 */
export function parseReadableBookText(input: string): Chapter[] {
  const text = input.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  const chapters = parseBookText(text);
  if (chapters.some((chapter) => chapter.content.trim().length > 0) || !text.trim()) return chapters;

  return [{
    id: chapterId(0, '原文'),
    title: '原文',
    content: text,
    startOffset: 0,
    endOffset: text.length,
    page: 1,
  }];
}

export function estimateChapterPage(chapter: Chapter): number {
  return Math.max(1, chapter.page || Math.floor(chapter.startOffset / 800) + 1);
}
