import type { ChatBotEvent } from '../engine/types/index.js';
import { parseAIStreamProtocol } from '../shared/ai-stream/protocol-parser.js';

export interface ChatClientConfig {
  /** Server base URL, e.g. http://localhost:4000 */
  baseUrl: string;
  /** Use WebSocket for real-time streaming (default: true) */
  useWebSocket?: boolean;
  /** Custom headers for HTTP requests */
  headers?: Record<string, string>;
  /** Reconnect interval in ms (default: 3000) */
  reconnectInterval?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatStreamCallbacks {
  onToken?: (token: string) => void;
  onDone?: (fullText: string, usage?: Record<string, number>) => void;
  onError?: (error: Error) => void;
}

/**
 * Client SDK for connecting to cmh-chatbot server.
 * Works in both Node.js and browser environments.
 *
 * @example
 * ```ts
 * import { ChatClient } from '@krommergmbh/cmh-chatbot/client';
 *
 * const client = new ChatClient({ baseUrl: 'http://localhost:4000' });
 *
 * await client.chat(
 *   [{ role: 'user', content: 'Hello!' }],
 *   {
 *     onToken: (t) => process.stdout.write(t),
 *     onDone: (text) => console.log('\n---\n', text),
 *   },
 * );
 * ```
 */
export class ChatClient {
  private ws: WebSocket | null = null;
  private pendingCallbacks = new Map<string, ChatStreamCallbacks>();
  private pendingTexts = new Map<string, string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly config: ChatClientConfig) {}

  // ---- HTTP/SSE Streaming ----

  /**
   * Send a chat request via HTTP POST with SSE streaming.
   */
  async chat(
    messages: ChatMessage[],
    callbacks?: ChatStreamCallbacks,
    options?: { model?: string; system?: string },
  ): Promise<string> {
    if (this.config.useWebSocket !== false && typeof WebSocket !== 'undefined') {
      return this.chatViaWebSocket(messages, callbacks, options);
    }

    return this.chatViaHTTP(messages, callbacks, options);
  }

  /**
   * Non-streaming generate request.
   */
  async generate(
    messages: ChatMessage[],
    options?: { model?: string; system?: string },
  ): Promise<{ text: string; usage?: Record<string, number> }> {
    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify({ messages, ...options }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Generate failed (${response.status}): ${errBody}`);
    }

    return response.json();
  }

  /**
   * Health check.
   */
  async health(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.config.baseUrl}/health`, {
      headers: this.config.headers,
    });
    return response.json();
  }

  /**
   * Submit job to the queue (requires Redis on server).
   */
  async queueInfer(
    messages: ChatMessage[],
    options?: { model?: string; system?: string; priority?: number },
  ): Promise<{ jobId: string; status: string }> {
    const response = await fetch(`${this.config.baseUrl}/api/queue/infer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify({ messages, ...options }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Queue submit failed (${response.status}): ${errBody}`);
    }

    return response.json();
  }

  /**
   * Disconnect WebSocket if connected.
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ---- Internal: HTTP streaming ----

  private async chatViaHTTP(
    messages: ChatMessage[],
    callbacks?: ChatStreamCallbacks,
    options?: { model?: string; system?: string },
  ): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify({ messages, ...options }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      const error = new Error(`Chat failed (${response.status}): ${errBody}`);
      callbacks?.onError?.(error);
      throw error;
    }

    let fullText = '';

    try {
      let parsedAnyDelta = false;

      for await (const part of parseAIStreamProtocol(response)) {
        if (part.content) {
          parsedAnyDelta = true;
          fullText += part.content;
          callbacks?.onToken?.(part.content);
        }
      }

      // 서버가 plain text stream을 반환하는 구형/커스텀 케이스 호환
      if (!parsedAnyDelta) {
        const fallbackText = await response.text().catch(() => '');
        if (fallbackText) {
          fullText += fallbackText;
          callbacks?.onToken?.(fallbackText);
        }
      }
    } catch (error) {
      callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }

    callbacks?.onDone?.(fullText);
    return fullText;
  }

  // ---- Internal: WebSocket streaming ----

  private chatViaWebSocket(
    messages: ChatMessage[],
    callbacks?: ChatStreamCallbacks,
    options?: { model?: string; system?: string },
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const ws = this.ensureWebSocket();
      const id = crypto.randomUUID();

      this.pendingCallbacks.set(id, {
        ...callbacks,
        onDone: (text, usage) => {
          callbacks?.onDone?.(text, usage);
          this.pendingCallbacks.delete(id);
          this.pendingTexts.delete(id);
          resolve(text);
        },
        onError: (error) => {
          callbacks?.onError?.(error);
          this.pendingCallbacks.delete(id);
          this.pendingTexts.delete(id);
          reject(error);
        },
      });

      this.pendingTexts.set(id, '');

      const payload = JSON.stringify({
        type: 'chat',
        id,
        messages,
        model: options?.model,
        system: options?.system,
      });

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      } else {
        ws.addEventListener('open', () => ws.send(payload), { once: true });
      }
    });
  }

  private ensureWebSocket(): WebSocket {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws;
    }

    const wsUrl = this.config.baseUrl
      .replace(/^http/, 'ws')
      .replace(/\/$/, '') + '/ws';

    this.ws = new WebSocket(wsUrl);

    this.ws.addEventListener('message', (event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data));

        if (data.type === 'text-delta' && data.id) {
          const cb = this.pendingCallbacks.get(data.id);
          const current = (this.pendingTexts.get(data.id) ?? '') + data.delta;
          this.pendingTexts.set(data.id, current);
          cb?.onToken?.(data.delta);
        } else if (data.type === 'done' && data.id) {
          const cb = this.pendingCallbacks.get(data.id);
          const fullText = this.pendingTexts.get(data.id) ?? '';
          cb?.onDone?.(fullText, data.usage);
        } else if (data.type === 'error' && data.id) {
          const cb = this.pendingCallbacks.get(data.id);
          cb?.onError?.(new Error(data.error));
        }
      } catch {
        // Ignore parse errors
      }
    });

    this.ws.addEventListener('close', () => {
      this.ws = null;
      // Auto-reconnect if there are pending requests
      if (this.pendingCallbacks.size > 0) {
        const interval = this.config.reconnectInterval ?? 3000;
        this.reconnectTimer = setTimeout(() => this.ensureWebSocket(), interval);
      }
    });

    this.ws.addEventListener('error', () => {
      // Error handling is done in 'close' handler
    });

    return this.ws;
  }
}
