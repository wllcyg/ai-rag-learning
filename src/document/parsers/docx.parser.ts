import mammoth from 'mammoth';
import TurndownService from 'turndown';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { gfm } = require('turndown-plugin-gfm') as {
  gfm: (service: TurndownService) => void;
};
import { cleanMarkdown } from '../utils/markdown.util';

/**
 * 图片上传回调定义：由调用方注入（如 Cloudflare R2 上传方法）。
 */
export type ImageUploader = (
  bytes: Buffer,
  fileName: string,
  contentType: string,
) => Promise<string>;

export interface ParseDocxOptions {
  /**
   * 图片上传回调（可选）。
   * 如果提供此函数，DOCX 内嵌入的图片会被自动提取并上传至对象存储（如 Cloudflare R2），
   * 并将 Markdown 中的图片地址替换为公网 CDN URL；
   * 未提供时默认转为 Data URI (Base64)。
   */
  uploadImage?: ImageUploader;
}

/**
 * 将 DOCX 解析为 Markdown（支持内嵌图片自动上传至对象存储）。
 *
 * 整体流程：
 * 1. mammoth 把 DOCX 转为 HTML（拦截内嵌图片字节并调用 uploadImage 上传到 R2）；
 * 2. turndown(+GFM) 把 HTML 转为 Markdown；
 * 3. cleanMarkdown 做换行与空白规范化。
 */
export async function parseDocx(
  buffer: Buffer,
  options: ParseDocxOptions = {},
): Promise<string> {
  const { value: html } = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        // 英文样式
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        // 中文 Word 内置「标题 N」
        "p[style-name='标题 1'] => h1:fresh",
        "p[style-name='标题 2'] => h2:fresh",
        "p[style-name='标题 3'] => h3:fresh",
        "p[style-name='标题 4'] => h4:fresh",
      ],
      // 🌟 拦截图片：提取二进制 Buffer，调用 uploadImage 回调上传至 R2 并回填 URL
      convertImage: options.uploadImage
        ? mammoth.images.imgElement(async (element) => {
            const base64Data = await element.read('base64');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const contentType = element.contentType || 'image/png';
            const ext = contentType.split('/')[1] || 'png';
            const fileName = `docx_img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

            // 调用上传回调拿到 R2 的公开 URL
            const imageUrl = await options.uploadImage!(
              imageBuffer,
              fileName,
              contentType,
            );
            return { src: imageUrl };
          })
        : undefined,
    },
  );

  const turndown = new TurndownService({
    headingStyle: 'atx', // # 标题
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  // GFM：表格、删除线、任务列表等扩展语法
  turndown.use(gfm);

  return cleanMarkdown(turndown.turndown(html));
}
