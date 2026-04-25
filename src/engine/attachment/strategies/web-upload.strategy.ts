/**
 * ── Web Upload Strategy ──────────────────────────────────
 * 웹 서버 환경에서의 파일 첨부 처리.
 * Hono 서버에 multipart 또는 base64로 파일이 올라오는 경우.
 *
 * 저장 구조: {storagePath}/uploads/{xx}/{xx}/{uuid}.ext (Directory Sharding)
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { AttachmentStrategy, AttachmentInput, AttachmentResult } from '../types.js';

export class WebUploadStrategy implements AttachmentStrategy {
  readonly mode = 'web' as const;
  private readonly rootPath: string;
  private readonly baseUrl: string;

  /**
   * @param storagePath 서버 로컬 저장 디렉토리
   * @param baseUrl 클라이언트가 접근할 URL 프리픽스 (e.g. '/api/files')
   */
  constructor(storagePath: string, baseUrl = '/api/files') {
    this.rootPath = storagePath;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async store(input: AttachmentInput): Promise<AttachmentResult> {
    const id = randomUUID();
    const ext = extname(input.name) || '';
    const shardDir = this.buildShardPath(id);
    const filePath = join(shardDir, `${id}${ext}`);

    await mkdir(shardDir, { recursive: true });

    let buffer: Buffer;
    if (Buffer.isBuffer(input.data)) {
      buffer = input.data;
    } else if (typeof input.data === 'string') {
      // 웹 환경에서는 base64 (Data URL 또는 순수 base64)로 전달됨
      const raw = input.data.includes(',')
        ? input.data.split(',')[1]!
        : input.data;
      buffer = Buffer.from(raw, 'base64');
    } else {
      throw new Error('[WebUploadStrategy] Unsupported data type');
    }

    await writeFile(filePath, buffer);

    // storagePath에 접근 URL을 저장 (클라이언트가 다운로드 시 사용)
    const accessUrl = `${this.baseUrl}/${id}${ext}`;

    return {
      id,
      name: input.name,
      mimeType: input.mimeType,
      size: buffer.length,
      storagePath: accessUrl,
      createdAt: new Date(),
    };
  }

  async read(result: AttachmentResult): Promise<Buffer> {
    // URL → 실제 로컬 경로 복원
    const localPath = this.urlToLocalPath(result);
    return readFile(localPath);
  }

  async delete(result: AttachmentResult): Promise<void> {
    const localPath = this.urlToLocalPath(result);
    await unlink(localPath).catch(() => {
      // 파일이 이미 없는 경우 무시
    });
  }

  /** 접근 URL에서 실제 로컬 파일 경로 복원 */
  private urlToLocalPath(result: AttachmentResult): string {
    // storagePath = '/api/files/a1b2c3d4-xxxx.pdf' → 'a1b2c3d4-xxxx.pdf'
    const filename = result.storagePath.split('/').pop()!;
    const idPart = result.id.replace(/-/g, '');
    const shard1 = idPart.slice(0, 2);
    const shard2 = idPart.slice(2, 4);
    return join(this.rootPath, 'uploads', shard1, shard2, filename);
  }

  /**
   * Directory Sharding: UUID 첫 4자를 2글자씩 분리
   * e.g. "a1b2c3d4-..." → uploads/a1/b2/
   */
  private buildShardPath(uuid: string): string {
    const clean = uuid.replace(/-/g, '');
    const shard1 = clean.slice(0, 2);
    const shard2 = clean.slice(2, 4);
    return join(this.rootPath, 'uploads', shard1, shard2);
  }
}
