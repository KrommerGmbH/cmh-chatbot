import pino from 'pino';
import path from 'node:path';
import { DailyRotatingFileStream } from './log-rotating-stream.js';

export function createLogger(level: string = 'info', name: string = 'cmh-chatbot') {
  const isProd = process.env.NODE_ENV === 'production';
  const rotateEnabled = process.env.LOG_ROTATE_ENABLED !== 'false';
  const logDir = process.env.LOG_DIR ?? path.resolve(process.cwd(), 'logs');
  const retentionDays = Number(process.env.LOG_RETENTION_DAYS ?? '7');

  if (isProd && rotateEnabled) {
    const fileStream = new DailyRotatingFileStream({
      dir: logDir,
      baseName: name,
      retentionDays: Number.isFinite(retentionDays) ? retentionDays : 7,
    });

    return pino({
      name,
      level,
    }, pino.multistream([
      { stream: process.stdout },
      { stream: fileStream as unknown as NodeJS.WritableStream },
    ]));
  }

  return pino({
    name,
    level,
    transport:
      !isProd
        ? { target: 'pino/file', options: { destination: 1 } }
        : undefined,
  });
}

export type Logger = pino.Logger;
