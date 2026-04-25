import type { Server as HTTPServer } from 'node:http';
import { serve } from '@hono/node-server';
import type { ChatServerConfig } from '../types/index.js';
import { createLogger, type Logger } from '../core/logger.js';
import { resolveModelPath } from '../core/model-loader.js';
import { LlamaServer } from '../core/llama-server.js';
import { QueueManager } from '../queue/manager.js';
import { MDNSDiscovery } from '../discovery/mdns.js';
import { TailscaleDiscovery } from '../discovery/tailscale.js';
import { initDataLayer } from '../data/init.js';
import { createRoutes, type RouteContext } from './routes.js';
import { attachWebSocket } from './websocket.js';

export interface ChatServer {
  /** Start listening */
  start(): Promise<void>;
  /** Graceful shutdown */
  stop(): Promise<void>;
  /** Underlying HTTP server */
  httpServer: HTTPServer;
}

/**
 * Create and configure a ChatBot server instance.
 * Uses llama.cpp server binary — no node-llama-cpp, no Ollama, no cloud API.
 *
 * @example
 * ```ts
 * import { createChatServer } from '@krommergmbh/cmh-chatbot/server';
 *
 * const server = await createChatServer({
 *   model: {
 *     modelPath: './models/gemma-3-4b-it-Q4_K_M.gguf',
 *     serverBinaryPath: './bin/llama-server',
 *   },
 *   port: 4000,
 * });
 *
 * await server.start();
 * ```
 */
export async function createChatServer(
  config: ChatServerConfig,
): Promise<ChatServer> {
  const logger = createLogger(config.logLevel ?? 'info', 'cmh-chatbot');
  const startedAt = new Date();

  // ---- Validate model path (managed mode only) ----
  // External llama-server 모드(serverUrl)에서는 modelPath가 없어도 서버를 기동할 수 있어야 함.
  if (!config.model.serverUrl) {
    resolveModelPath(config.model);
  }

  // ---- Start llama-server ----
  logger.info('Starting llama-server...');
  const llamaServer = new LlamaServer(config.model, logger);
  await llamaServer.start();

  // ---- Queue (optional) ----
  let queue: QueueManager | null = null;
  if (config.redis) {
    queue = new QueueManager(config.redis, logger);
    await queue.init();
    logger.info('queue:ready');
  }

  // ---- Data Layer (DAL + ModelFactory) ----
  const { repositoryFactory, modelFactory } = await initDataLayer({
    dataAdapter: config.dataAdapter,
    dbPath: config.dbPath,
    llamaServerUrl: llamaServer.baseUrl,
    logger,
  });
  logger.info('data-layer:ready');

  // ---- HTTP + Routes ----
  const routeCtx: RouteContext = {
    config,
    llamaServerUrl: llamaServer.baseUrl,
    logger,
    queue,
    modelFactory,
    repositoryFactory,
    startedAt,
  };

  const app = createRoutes(routeCtx);
  const port = config.port ?? 4000;
  const host = config.host ?? '0.0.0.0';

  let httpServer: HTTPServer | null = null;

  // ---- Discovery ----
  let mdns: MDNSDiscovery | null = null;
  let tailscale: TailscaleDiscovery | null = null;

  if (config.discovery?.mdns !== false) {
    mdns = new MDNSDiscovery(logger);
  }
  if (config.discovery?.tailscale !== false) {
    tailscale = new TailscaleDiscovery(logger);
  }

  return {
    get httpServer() {
      return httpServer!;
    },

    async start() {
      httpServer = serve({
        fetch: app.fetch,
        port,
        hostname: host,
      }) as unknown as HTTPServer;

      // Attach WebSocket
      attachWebSocket(httpServer, llamaServer.baseUrl, config.model, logger);

      logger.info({ port, host, llamaServerUrl: llamaServer.baseUrl }, 'server:listening');

      if (mdns) {
        mdns.advertise(config.serviceName ?? 'cmh-chatbot', port);
      }

      if (tailscale) {
        const status = await tailscale.getStatus();
        if (status.running) {
          logger.info({ ip: status.ip, magicDNS: status.magicDNS }, 'tailscale:available');
        }
      }
    },

    async stop() {
      logger.info('server:stopping');

      mdns?.stop();

      if (queue) await queue.close();

      if (httpServer) {
        await new Promise<void>((resolve, reject) => {
          httpServer!.close((err) => (err ? reject(err) : resolve()));
        });
      }

      await llamaServer.stop();

      logger.info('server:stopped');
    },
  };
}
