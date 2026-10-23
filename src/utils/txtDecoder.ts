export interface DecodedText {
  text: string;
  encoding: 'UTF-8' | 'GB18030' | 'UTF-16LE' | 'UTF-16BE';
}

function decode(bytes: Uint8Array, label: DecodedText['encoding'], fatal: boolean): string {
  return new TextDecoder(label.toLowerCase(), { fatal }).decode(bytes);
}

/** 先尊重 BOM，再用严格解码尝试 UTF-8、GB18030，避免静默乱码。 */
export function detectEncoding(input: ArrayBuffer | Uint8Array): DecodedText {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: decode(bytes.subarray(2), 'UTF-16LE', false), encoding: 'UTF-16LE' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: decode(bytes.subarray(2), 'UTF-16BE', false), encoding: 'UTF-16BE' };
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { text: decode(bytes.subarray(3), 'UTF-8', false), encoding: 'UTF-8' };
  try { return { text: decode(bytes, 'UTF-8', true), encoding: 'UTF-8' }; } catch {
    try { return { text: decode(bytes, 'GB18030', true), encoding: 'GB18030' }; } catch {
      throw new Error('无法识别文本编码，请将文件另存为 UTF-8 或 GB18030 后重试。');
    }
  }
}
