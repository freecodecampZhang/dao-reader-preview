import type { Chapter } from '../types';

interface ParseResponse { text?: string; encoding?: string; chapters?: Chapter[]; error?: string }

function parseWithWorker(payload: { buffer?: ArrayBuffer; text?: string }, transfer: Transferable[] = []) {
  return new Promise<{ text: string; encoding: string; chapters: Chapter[] }>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/bookParser.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<ParseResponse>) => {
      worker.terminate();
      if (event.data.error || !event.data.chapters || event.data.text === undefined) {
        reject(new Error(event.data.error || 'TXT 解析失败'));
        return;
      }
      if (!event.data.text.trim()) {
        reject(new Error('TXT 文件没有可读取的文字内容。'));
        return;
      }
      resolve({ text: event.data.text, encoding: event.data.encoding || 'UTF-8', chapters: event.data.chapters });
    };
    worker.onerror = () => { worker.terminate(); reject(new Error('TXT 解析器启动失败，请刷新页面后重试。')); };
    worker.postMessage(payload, transfer);
  });
}

export async function parseTxtFile(file: File) {
  const buffer = await file.arrayBuffer();
  return parseWithWorker({ buffer }, [buffer]);
}

export function parseBufferInWorker(buffer: ArrayBuffer) {
  return parseWithWorker({ buffer }, [buffer]);
}

export function parseTextInWorker(text: string) {
  return parseWithWorker({ text });
}
