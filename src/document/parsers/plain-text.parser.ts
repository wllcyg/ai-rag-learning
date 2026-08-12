import { cleanMarkdown } from '../utils/markdown.util';

/**
 * 将 TXT / Markdown 纯文本 Buffer 解码并规范化。
 */
export function parsePlainText(buffer: Buffer): string {
  if (!buffer?.length) return '';
  const text = buffer.toString('utf8');
  return cleanMarkdown(text);
}
