/**
 * ── Local Filesystem Strategy ────────────────────────────
 * 로컬 설치 환경에서의 파일 첨부 처리.
 * Electron 앱, 데스크톱 에이전트 등 로컬 파일시스템에 직접 접근 가능한 경우.
 *
 * 저장 구조: {storagePath}/files/{xx}/{xx}/{uuid}.ext (Directory Sharding)
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { AttachmentStrategy, AttachmentInput, AttachmentResult } from '../types.js';

export class LocalFsStrategy implements AttachmentStrategy {
  readonly mode = 'local' as const;
  private readonly rootPath: string;

  constructor(storagePath: string) {
    this.rootPath = storagePath;
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
      // data가 로컬 파일 경로인지 base64인지 판별
      if (await this.isFilePath(input.data)) {
        buffer = await readFile(input.data);
      } else {
        // base64 (Data URL 또는 순수 base64)
        const raw = input.data.includes(',')
          ? input.data.split(',')[1]!
          : input.data;
        buffer = Buffer.from(raw, 'base64');
      }
    } else {
      throw new Error('[LocalFsStrategy] Unsupported data type');
    }

    await writeFile(filePath, buffer);

    return {
      id,
      name: input.name,
      mimeType: input.mimeType,
      size: buffer.length,
      storagePath: filePath,
      createdAt: new Date(),
    };
  }

  async read(result: AttachmentResult): Promise<Buffer> {
    return readFile(result.storagePath);
  }

  async delete(result: AttachmentResult): Promise<void> {
    await unlink(result.storagePath).catch(() => {
      // 파일이 이미 없는 경우 무시
    });
  }

  /**
   * Directory Sharding: UUID 첫 4자를 2글자씩 분리하여 디렉토리 구조 생성
   * e.g. "a1b2c3d4-..." → files/a1/b2/
   */
  private buildShardPath(uuid: string): string {
    const clean = uuid.replace(/-/g, '');
    const shard1 = clean.slice(0, 2);
    const shard2 = clean.slice(2, 4);
    return join(this.rootPath, 'files', shard1, shard2);
  }

  /** 문자열이 기존 파일 경로인지 확인 */
  private async isFilePath(str: string): Promise<boolean> {
    // 로컬 경로 패턴: / 또는 \ 또는 드라이브 레터(C:\)로 시작
    if (!/^([/\\]|[a-zA-Z]:[/\\])/.test(str)) return false;
    try {
      await access(str);
      return true;
    } catch {
      return false;
    }
  }
}
