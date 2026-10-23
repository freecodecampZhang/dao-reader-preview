import type { BookRecord, Chapter } from '../types';
import { parseBookText } from './chapterParser';

const demoSource = `版权信息
界面演示书籍 · 非真实古籍正文

导读
这是一册用于展示阅读器目录、书签、进度和排版的演示书籍。导入自己的 TXT 后即可阅读完整正文。

序
以下章节文字只演示阅读交互，不是任何小说原文。

第一回 文帝带酒幸宫妃 独孤后梦龙生子
【演示正文】这是第一回的测试段落。目录跳转、正文滚动和阅读进度都会在此处正常工作。

第二回 饰名节尽孝独孤 蓄阴谋交欢杨素
【演示正文】这是第二回的测试段落。你可以打开目录切换章节，或在正文中搜索这段演示文字。

第三回 正储位谋夺太子 侍寝宫调戏宣华
【演示正文】这是第三回的测试段落。添加书签后，可以从底部导航面板跳回当前位置。

第四回 不发丧杨素弄权 三正位阿摩登极
第五回 黄金盒赐同心结 仙都宫重召复入
第六回 同钓鱼越公怒志 拟宫人炀帝生嗔
第七回 选美女杨素强谏 受嫔民王义净身
第八回 演示目录`;

export function createDemoBook(now = Date.now()): BookRecord {
  const chapters = parseBookText(demoSource).map((chapter, index) => ({
    ...chapter,
    page: [5, 6, 10, 12, 34, 56][index] || 56 + (index - 5) * 9,
    locked: index >= 6,
  } satisfies Chapter));
  return {
    id: 'demo-book',
    name: '隋炀帝艳史 · 演示目录',
    fileName: '演示书籍.txt',
    source: 'demo',
    content: demoSource,
    chapters,
    size: new TextEncoder().encode(demoSource).length,
    createdAt: now,
    updatedAt: now,
    isDemo: true,
  };
}
