import { WebSocketServer, type WebSocket } from 'ws';
import type { Server as HTTPServer } from 'node:http';
import type { Logger } from '../core/logger.js';
import type { LlamaModelConfig } from '../types/index.js';

interface WSMessage {
  type: 'chat' | 'ping';
  id?: string;
  messages?: Array<{ role: string; content: string }>;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Attach a WebSocket server to an existing HTTP server.
 * Handles real-time chat with streaming token delivery via llama-server API.
 */
export function attachWebSocket(
  server: HTTPServer,
  llamaServerUrl: string,
  modelConfig: LlamaModelConfig,
  logger: Logger,
): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    logger.info('ws:connected');

    ws.on('message', async (raw: Buffer | string) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8'));
      } catch {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
        return;
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (msg.type === 'chat' && msg.messages) {
        await handleChatMessage(ws, msg, llamaServerUrl, modelConfig, logger);
      }
    });

    ws.on('close', () => logger.debug('ws:disconnected'));
    ws.on('error', (error) => logger.error({ error }, 'ws:error'));
  });

  return wss;
}

async function handleChatMessage(
  ws: WebSocket,
  msg: WSMessage,
  llamaServerUrl: string,
  modelConfig: LlamaModelConfig,
  logger: Logger,
): Promise<void> {
  const messageId = msg.id ?? crypto.randomUUID();

  try {
    const messages = msg.system
      ? [{ role: 'system', content: msg.system }, ...(msg.messages ?? [])]
      : modelConfig.systemPrompt
        ? [{ role: 'system', content: modelConfig.systemPrompt }, ...(msg.messages ?? [])]
        : msg.messages ?? [];

    const response = await fetch(`${llamaServerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        max_tokens: msg.maxTokens ?? modelConfig.maxTokens ?? 2048,
        temperature: msg.temperature ?? modelConfig.temperature ?? 0.7,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      ws.send(JSON.stringify({ type: 'error', id: messageId, error: errText }));
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta && ws.readyState === ws.OPEN) {
            fullText += delta;
            ws.send(JSON.stringify({ type: 'text-delta', id: messageId, delta }));
          }
        } catch {
          // Skip malformed SSE
        }
      }
    }

    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'done', id: messageId, text: fullText }));
    }
  } catch (error) {
    logger.error({ error, messageId }, 'ws:chat-error');
    if (ws.readyState === ws.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'error',
          id: messageId,
          error: error instanceof Error ? error.message : 'Internal error',
        }),
      );
    }
  }
}
