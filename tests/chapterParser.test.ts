import { describe, expect, it } from 'vitest';
import { parseBookText } from '../src/utils/chapterParser';
import { detectEncoding } from '../src/utils/txtDecoder';

describe('parseBookText', () => {
  it('识别常见中文章回标题并保留章节正文与段落', () => {
    const source = '书前说明\n第一章 天地初开\n第一段\n\n第二段\n第１２回 风起\n正文\n第一百二十章 归来\n收尾';
    const chapters = parseBookText(source);
    expect(chapters.map((chapter) => chapter.title)).toEqual(['前言', '第一章 天地初开', '第１２回 风起', '第一百二十章 归来']);
    expect(chapters[1].content).toBe('第一段\n\n第二段\n');
    expect(chapters[2].content).toBe('正文\n');
    expect(chapters[3].content).toBe('收尾');
  });

  it('普通句子不会被误识别；无章节标题时保留为正文', () => {
    const source = '第一，先读序言。\n这是正文里提到的第一章，但它不是标题。';
    expect(parseBookText(source)).toEqual([
      expect.objectContaining({ title: '正文', content: source }),
    ]);
  });

  it('识别序章、楔子和尾声等独立目录项', () => {
    const chapters = parseBookText('序章\n开篇\n楔子\n引子\n尾声\n结束');
    expect(chapters.map((chapter) => chapter.title)).toEqual(['序章', '楔子', '引子', '尾声']);
  });
});

describe('detectEncoding', () => {
  it('读取带 BOM 的 UTF-8 与 UTF-16LE', () => {
    expect(detectEncoding(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])).text).toBe('A');
    expect(detectEncoding(new Uint8Array([0xff, 0xfe, 0x2d, 0x4e])).text).toBe('中');
  });

  it('以 GB18030 解码常见中文旧 TXT', () => {
    const decoded = detectEncoding(new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]));
    expect(decoded.encoding).toBe('GB18030');
    expect(decoded.text).toBe('中文');
  });
});
