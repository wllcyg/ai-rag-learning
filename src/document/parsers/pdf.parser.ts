import { Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { cleanMarkdown, toMarkdownTable } from '../utils/markdown.util';

const logger = new Logger('PdfParser');

/**
 * 图片上传回调：解析过程中抽出的图片字节，经此函数上传后返回可访问 URL。
 * 由调用方注入（例如上传到 Cloudflare R2 / S3 对象存储），本模块不关心具体存储实现。
 */
export type ImageUploader = (
  bytes: Buffer,
  fileName: string,
  contentType: string,
) => Promise<string>;

export interface ParsePdfOptions {
  /**
   * 若提供，则从 PDF 中提取图片、并发上传，并按页以 Markdown 图片语法写入结果。
   * 未提供时仅输出文本（及可选的表格附录）。
   */
  uploadImage?: ImageUploader;
  /**
   * 跳过宽或高小于该像素阈值的图片（多为装饰图标/噪点），默认 50。
   */
  imageThreshold?: number;
}

/**
 * 将 PDF 解析为 Markdown（包含并发图片上传与表格清洗，防内存泄漏）。
 */
export async function parsePdf(
  buffer: Buffer,
  options: ParsePdfOptions = {},
): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const threshold = options.imageThreshold ?? 50;

  try {
    // ---------- 1. 文本：按页取出 ----------
    const textResult = await parser.getText();
    const pageTexts = textResult?.pages ?? [];
    /** pageNumber → 该页已上传图片的 URL 列表（保持提取顺序） */
    const pageImageUrls = new Map<number, string[]>();

    // ---------- 2. 图片（可选）：提取 → 过滤小图 → 并发上传 ----------
    if (options.uploadImage) {
      try {
        const imageResult = await parser.getImage({
          imageThreshold: threshold,
          imageBuffer: true,
          imageDataUrl: false,
        });

        const pendingUploads: Array<{
          pageNumber: number;
          buffer: Buffer;
          fileName: string;
          contentType: string;
        }> = [];

        for (const page of imageResult?.pages ?? []) {
          let imgIdx = 0;
          for (const image of page.images ?? []) {
            if (
              (image.width > 0 && image.width < threshold) ||
              (image.height > 0 && image.height < threshold)
            ) {
              continue;
            }
            if (!image.data?.length) continue;

            const contentType = sniffImageContentType(image.data);
            const ext = contentType === 'image/jpeg' ? 'jpg' : 'png';
            const fileName = `pdf_img_p${page.pageNumber}_${imgIdx++}.${ext}`;

            pendingUploads.push({
              pageNumber: page.pageNumber,
              buffer: Buffer.from(image.data),
              fileName,
              contentType,
            });
          }
        }

        // 并发上传所有图片，极大缩短高并发/多图 PDF 解析延时
        const uploadResults = await Promise.all(
          pendingUploads.map(async (item) => {
            try {
              const url = await options.uploadImage!(
                item.buffer,
                item.fileName,
                item.contentType,
              );
              return { pageNumber: item.pageNumber, url };
            } catch (err) {
              logger.warn(
                `PDF 图片上传失败: page=${item.pageNumber}, err=${err instanceof Error ? err.message : err}`,
              );
              return null;
            }
          }),
        );

        for (const res of uploadResults) {
          if (res) {
            const list = pageImageUrls.get(res.pageNumber) ?? [];
            list.push(res.url);
            pageImageUrls.set(res.pageNumber, list);
          }
        }

        if (pageImageUrls.size > 0) {
          logger.log(`PDF 图片并发上传完成: 共 ${pendingUploads.length} 张`);
        }
      } catch (err) {
        logger.warn(
          `PDF 图片提取失败，继续仅文本: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // ---------- 3. 按页拼装 Markdown ----------
    const parts: string[] = [];
    if (pageTexts.length > 0) {
      for (const page of pageTexts) {
        const text = (page.text ?? '').trim();
        if (text) parts.push(text);

        const urls = pageImageUrls.get(page.num) ?? [];
        for (const url of urls) {
          parts.push(`![](${url})`);
        }
        if (text || urls.length) parts.push('');
      }
    } else {
      const fallback = (textResult?.text ?? '').trim();
      if (fallback) parts.push(fallback);
      for (const urls of pageImageUrls.values()) {
        for (const url of urls) parts.push(`![](${url})`);
      }
    }

    let markdown = cleanMarkdown(parts.join('\n\n'));

    // ---------- 4. 表格提取 ----------
    try {
      const tableResult = await parser.getTable();
      const pages = tableResult?.pages ?? [];
      if (pages.length > 0 && !markdown.includes('| ---')) {
        const tableParts: string[] = [];
        let tableIdx = 0;
        for (const page of pages) {
          for (const table of page.tables ?? []) {
            const rows = normalizePdfTable(table);
            if (rows.length > 0) {
              tableIdx += 1;
              tableParts.push(
                `### 表格 ${tableIdx}\n\n${toMarkdownTable(rows)}`,
              );
            }
          }
        }
        if (tableParts.length > 0) {
          markdown = cleanMarkdown(
            `${markdown}\n\n## 检测到的表格\n\n${tableParts.join('\n')}`,
          );
        }
      }
    } catch {
      // 表格提取失败不影响主结果
    }

    return markdown;
  } finally {
    // 强制销毁释放底层 PDF WASM/C++ 内存，彻底消除 OOM 隐患
    await parser.destroy();
  }
}

/**
 * 通过文件头魔数字节判断图片 MIME
 */
function sniffImageContentType(data: Uint8Array): string {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    data.length >= 4 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    data.length >= 4 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46
  ) {
    return 'image/webp';
  }
  if (
    data.length >= 4 &&
    data[0] === 0x47 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x38
  ) {
    return 'image/gif';
  }
  if (data.length >= 2 && data[0] === 0x42 && data[1] === 0x4d) {
    return 'image/bmp';
  }
  return 'image/png';
}

/**
 * 结构归一化：将可能返回的多种表格结构统一转换成二维字符串数组
 */
function normalizePdfTable(raw: unknown): string[][] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    if (Array.isArray(raw[0])) {
      return (raw as unknown[][]).map((row) =>
        row.map((cell) => String(cell ?? '').trim()),
      );
    }
    const merged: string[][] = [];
    for (const item of raw) {
      merged.push(...normalizePdfTable(item));
    }
    return merged;
  }

  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as { rows?: unknown; data?: unknown };
    if (obj.rows) return normalizePdfTable(obj.rows);
    if (obj.data) return normalizePdfTable(obj.data);
  }

  return [];
}
