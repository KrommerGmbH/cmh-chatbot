/**
 * ── Attachment Routes ────────────────────────────────────
 * Hono 라우트: 파일 업로드 / 다운로드 / 삭제 엔드포인트.
 * 웹 서버 모드에서 클라이언트가 호출하는 REST API.
 */

import { Hono } from 'hono';
import type { AttachmentService } from './attachment.service.js';
import type { AttachmentResult } from './types.js';

/** 메모리 내 결과 캐시 (프로덕션에서는 DB로 교체) */
const resultCache = new Map<string, AttachmentResult>();

/**
 * 첨부 파일 관련 라우트를 생성한다.
 * 메인 routes.ts에서 `app.route('/api', createAttachmentRoutes(attachmentService))` 로 연결.
 */
export function createAttachmentRoutes(service: AttachmentService): Hono {
  const routes = new Hono();

  // ── POST /upload — 파일 업로드 (multipart or JSON base64) ──
  routes.post('/upload', async (c) => {
    const contentType = c.req.header('content-type') ?? '';

    try {
      if (contentType.includes('multipart/form-data')) {
        // multipart 업로드
        const formData = await c.req.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
          return c.json({ error: 'No file provided in form data' }, 400);
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await service.upload({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: buffer.length,
          data: buffer,
        });

        resultCache.set(result.id, result);
        return c.json(toClientResult(result), 201);
      }

      // JSON base64 업로드
      const body = await c.req.json<{
        name: string;
        mimeType: string;
        data: string; // base64
      }>();

      if (!body.name || !body.data) {
        return c.json({ error: 'Missing required fields: name, data' }, 400);
      }

      const raw = body.data.includes(',') ? body.data.split(',')[1]! : body.data;
      const size = Math.ceil((raw.length * 3) / 4);

      const result = await service.upload({
        name: body.name,
        mimeType: body.mimeType || 'application/octet-stream',
        size,
        data: body.data,
      });

      resultCache.set(result.id, result);
      return c.json(toClientResult(result), 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      return c.json({ error: message }, 400);
    }
  });

  // ── POST /upload/batch — 여러 파일 일괄 업로드 ──
  routes.post('/upload/batch', async (c) => {
    try {
      const formData = await c.req.formData();
      const files = formData.getAll('files');

      if (!files.length) {
        return c.json({ error: 'No files provided' }, 400);
      }

      const inputs = await Promise.all(
        files.filter((f): f is File => f instanceof File).map(async (file) => {
          const buffer = Buffer.from(await file.arrayBuffer());
          return {
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: buffer.length,
            data: buffer,
          };
        }),
      );

      const { results, errors } = await service.uploadBatch(inputs);

      for (const r of results) {
        resultCache.set(r.id, r);
      }

      return c.json({
        uploaded: results.map(toClientResult),
        errors: errors.map((e) => ({ name: e.input.name, error: e.error.message })),
      }, results.length > 0 ? 201 : 400);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Batch upload failed';
      return c.json({ error: message }, 400);
    }
  });

  // ── GET /files/:id — 파일 다운로드 ──
  routes.get('/files/:id', async (c) => {
    const id = c.req.param('id');
    // id에서 확장자 분리: "a1b2c3d4-xxxx.pdf" → "a1b2c3d4-xxxx"
    const cleanId = id.replace(/\.[^.]+$/, '');
    const result = resultCache.get(cleanId);

    if (!result) {
      return c.json({ error: 'File not found' }, 404);
    }

    try {
      const buffer = await service.download(result);
      return new Response(new Uint8Array(buffer) as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': result.mimeType,
          'Content-Disposition': `inline; filename="${result.name}"`,
          'Content-Length': String(buffer.length),
        },
      });
    } catch {
      return c.json({ error: 'File read failed' }, 500);
    }
  });

  // ── DELETE /files/:id — 파일 삭제 ──
  routes.delete('/files/:id', async (c) => {
    const id = c.req.param('id');
    const result = resultCache.get(id);

    if (!result) {
      return c.json({ error: 'File not found' }, 404);
    }

    try {
      await service.remove(result);
      resultCache.delete(id);
      return c.json({ success: true });
    } catch {
      return c.json({ error: 'File delete failed' }, 500);
    }
  });

  return routes;
}

/** 클라이언트에 반환할 안전한 결과 객체 (내부 경로 제외) */
function toClientResult(r: AttachmentResult) {
  return {
    id: r.id,
    name: r.name,
    mimeType: r.mimeType,
    size: r.size,
    url: r.storagePath,
    extractedText: r.extractedText,
    createdAt: r.createdAt.toISOString(),
  };
}
