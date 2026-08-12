import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export interface UploadOptions {
  fileName: string;
  contentType?: string;
  prefix?: string;
}

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Cloudflare R2 静态存储服务（包含可追溯的 Key 与回滚删除功能）
 */
@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly publicDomain: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );
    this.bucketName =
      this.configService.get<string>('R2_BUCKET_NAME') ?? 'knowledge-hub';
    this.publicDomain =
      this.configService.get<string>('R2_PUBLIC_DOMAIN') ?? '';

    if (accountId && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log(
        `Cloudflare R2 存储服务已连接 (Bucket: ${this.bucketName})`,
      );
    } else {
      this.logger.warn(
        '未配置 Cloudflare R2 密钥参数 (R2_ACCOUNT_ID / ACCESS_KEY_ID)，对象存储功能未启用',
      );
    }
  }

  /** 判断 Cloudflare R2 对象存储服务是否开启 */
  isEnabled(): boolean {
    return !!this.client;
  }

  /**
   * 上传二进制 Buffer 到 Cloudflare R2 并返回公开访问的 URL 和 R2 Key
   */
  async uploadBytesWithKey(
    bytes: Buffer,
    options: UploadOptions,
  ): Promise<UploadResult> {
    if (!this.client) {
      throw new Error('Cloudflare R2 存储服务未开启，请先配置环境变量');
    }

    const prefix = options.prefix
      ? `${options.prefix.replace(/\/$/, '')}/`
      : '';
    const key = `${prefix}${Date.now()}_${options.fileName}`;
    const contentType = options.contentType || 'application/octet-stream';

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    });

    await this.client.send(command);

    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const baseUrl = this.publicDomain
      ? this.publicDomain.replace(/\/$/, '')
      : `https://${this.bucketName}.${accountId}.r2.dev`;

    const url = `${baseUrl}/${key}`;
    this.logger.log(`文件成功上传至 Cloudflare R2: ${url} (Key: ${key})`);
    return { url, key };
  }

  /**
   * 简化版本：仅返回公开访问 URL
   */
  async uploadBytes(bytes: Buffer, options: UploadOptions): Promise<string> {
    const { url } = await this.uploadBytesWithKey(bytes, options);
    return url;
  }

  /**
   * 从 Cloudflare R2 中回滚删除指定 Key 的文件
   * @param key 对象在 R2 存储桶中的路径（如 raw-documents/123_doc.pdf）
   */
  async deleteObject(key: string): Promise<void> {
    if (!this.client) return;

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.client.send(command);
      this.logger.log(`[R2 回滚] 文件已成功从 Cloudflare R2 删除: ${key}`);
    } catch (err) {
      this.logger.warn(
        `[R2 回滚失败] 无法删除 R2 对象 (Key: ${key}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
