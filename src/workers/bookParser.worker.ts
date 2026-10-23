/// <reference lib="webworker" />
import { parseBookText } from '../utils/chapterParser';
import { detectEncoding } from '../utils/txtDecoder';

interface ParseRequest { buffer?: ArrayBuffer; text?: string }

self.onmessage = (event: MessageEvent<ParseRequest>) => {
  try {
    let text: string;
    let encoding: string;
    if (event.data.buffer) {
      const decoded = detectEncoding(event.data.buffer);
      text = decoded.text;
      encoding = decoded.encoding;
    } else {
      text = event.data.text || '';
      encoding = 'UTF-8';
    }
    self.postMessage({ text, encoding, chapters: parseBookText(text) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '解析 TXT 失败' });
  }
};

export {};
