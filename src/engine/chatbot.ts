import type { ChatBotConfig } from './types/index.js';
import { createLogger, type Logger } from './core/logger.js';
import { LlamaServer } from './core/llama-server.js';
import { resolveModelPath } from './core/model-loader.js';
import { InferenceEngine } from './core/inference.js';
import { QueueManager } from './queue/manager.js';
import { InferenceWorker } from './queue/worker.js';
import { MDNSDiscovery } from './discovery/mdns.js';
import { TailscaleDiscovery } from './discovery/tailscale.js';
import { AgentOrchestrator } from './agent/orchestrator.js';
import { RAGPipeline } from './rag/pipeline.js';
import { ModelFactory } from './provider/model-factory.js';
import type { RepositoryFactory } from './data/repository-factory.js';
import { initDataLayer } from './data/init.js';

export interface ChatBot {
  /** Start all services (llama-server, queue, discovery) */
  start(): Promise<void>;
  /** Graceful shutdown */
  stop(): Promise<void>;
  /** Is the bot fully started and ready? */
  readonly isReady: boolean;
  /** Logger instance */
  readonly logger: Logger;
  /** Inference engine for direct LLM calls */
  readonly inference: InferenceEngine;
  /** LlamaServer instance */
  readonly llamaServer: LlamaServer;
  /** Queue manager (if Redis configured) */
  readonly queue: QueueManager | null;
  /** Agent orchestrator (if agents configured) */
  readonly orchestrator: AgentOrchestrator | null;
  /** RAG pipeline (if stores configured) */
  readonly rag: RAGPipeline | null;
  /** Model factory (if providerRegistry or dataAdapter configured) */
  readonly modelFactory: ModelFactory | null;
  /** Shopware DAL-compatible repository factory */
  readonly repositoryFactory: RepositoryFactory | null;
}

/**
 * Create a ChatBot instance — convenience factory that wires all components.
 *
 * Unlike `createChatServer()` which starts an HTTP server,
 * `createChatBot()` creates the core engine without HTTP bindings,
 * suitable for embedding in host apps (Electron, Docker, etc.).
 *
 * @example
 * ```ts
 * import { createChatBot } from '@krommergmbh/cmh-chatbot';
 *
 * const bot = await createChatBot({
 *   mode: 'hub',
 *   llm: {
 *     modelPath: './models/gemma-3-4b-it-Q4_K_M.gguf',
 *     serverBinaryPath: './bin/llama-server',
 *   },
 * });
 *
 * await bot.start();
 *
 * const result = await bot.inference.generate({
 *   serverUrl: bot.llamaServer.baseUrl,
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * console.log(result.text);
 *
 * await bot.stop();
 * ```
 */
export async function createChatBot(config: ChatBotConfig): Promise<ChatBot> {
  const logger = createLogger(config.logLevel ?? 'info', 'cmh-chatbot');
  let ready = false;

  // ── LLM ──────────────────────────────────────────────
  resolveModelPath(config.llm);
  const llamaServer = new LlamaServer(config.llm, logger);
  const inference = new InferenceEngine(logger);

  // ── Queue (optional) ─────────────────────────────────
  let queue: QueueManager | null = null;
  let worker: InferenceWorker | null = null;

  if (config.redis) {
    queue = new QueueManager(config.redis, logger);
    worker = new InferenceWorker(
      config.redis,
      llamaServer.baseUrl,
      config.llm,
      logger,
    );
  }

  // ── Agent Orchestrator (optional) ────────────────────
  let orchestrator: AgentOrchestrator | null = null;
  if (config.agents && config.agents.length > 0) {
    orchestrator = new AgentOrchestrator({
      agents: config.agents,
      llamaServerUrl: llamaServer.baseUrl,
      modelConfig: config.llm,
      promptStore: config.promptStore,
      securityGate: config.securityGate,
      logger,
    });
  }

  // ── RAG Pipeline (optional) ──────────────────────────
  let rag: RAGPipeline | null = null;
  if (config.conversationStore || config.vectorStore) {
    rag = new RAGPipeline({
      conversationStore: config.conversationStore,
      vectorStore: config.vectorStore,
      logger,
    });
  }

  // ── Model Factory (optional) ─────────────────────────
  const { repositoryFactory, modelFactory: mf } = await initDataLayer({
    dataAdapter: config.dataAdapter,
    llamaServerUrl: llamaServer.baseUrl,
    logger,
  });
  const modelFactory = mf;

  // ── Discovery ────────────────────────────────────────
  let mdns: MDNSDiscovery | null = null;
  let tailscale: TailscaleDiscovery | null = null;

  if (config.discovery?.mdns !== false) {
    mdns = new MDNSDiscovery(logger);
  }
  if (config.discovery?.tailscale !== false) {
    tailscale = new TailscaleDiscovery(logger);
  }

  return {
    get isReady() {
      return ready;
    },
    logger,
    inference,
    llamaServer,
    queue,
    orchestrator,
    rag,
    modelFactory,
    repositoryFactory,

    async start() {
      logger.info({ mode: config.mode }, 'chatbot:starting');

      // 1. Start llama-server
      await llamaServer.start();

      // 2. Start queue
      if (queue) {
        await queue.init();
        logger.info('chatbot:queue-ready');
      }
      if (worker) {
        await worker.start(1);
        logger.info('chatbot:worker-ready');
      }

      // 3. Discovery
      if (mdns && config.mode === 'hub') {
        mdns.advertise('cmh-chatbot', 4000);
      }
      if (mdns && config.mode === 'edge') {
        mdns.scan();
      }
      if (tailscale) {
        const status = await tailscale.getStatus();
        if (status.running) {
          logger.info({ ip: status.ip, magicDNS: status.magicDNS }, 'chatbot:tailscale-ready');
        }
      }

      ready = true;
      logger.info(
        { mode: config.mode, llamaServerUrl: llamaServer.baseUrl },
        'chatbot:ready',
      );
    },

    async stop() {
      logger.info('chatbot:stopping');
      ready = false;

      mdns?.stop();

      if (worker) await worker.stop();
      if (queue) await queue.close();
      await llamaServer.stop();

      logger.info('chatbot:stopped');
    },
  };
}
