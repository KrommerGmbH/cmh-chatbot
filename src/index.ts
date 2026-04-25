// ─── Main entry: @krommergmbh/cmh-chatbot ───────────────
// ChatBot factory
export { createChatBot, type ChatBot } from './engine/chatbot.js';

// Core
export { createLogger } from './engine/core/logger.js';
export { LlamaServer } from './engine/core/llama-server.js';
export { resolveModelPath } from './engine/core/model-loader.js';
export { InferenceEngine } from './engine/core/inference.js';

// Provider (§10 — DAL-powered)
export { ModelFactory, type ResolvedModel } from './engine/provider/model-factory.js';

// Data (Shopware DAL-compatible)
export {
  Criteria,
  Repository,
  RepositoryFactory,
  EntityDefinition,
  EntityRegistry,
  InMemoryDataAdapter,
  SqliteDataAdapter,
  FieldCollection,
  registerEntityDefinition,
  getEntityDefinition,
  getAllEntityDefinitions,
  LlmProviderDefinition,
  LlmModelDefinition,
  ENTITY_CMH_LLM_PROVIDER,
  ENTITY_CMH_LLM_MODEL,
  DEFAULT_PROVIDERS,
  DEFAULT_MODELS,
  seedDefaultData,
} from './engine/data/index.js';

export type {
  Entity,
  DataAdapter,
  SearchResult as DALSearchResult,
  LlmProvider,
  LlmModel,
  DataEntityDefinition,
  EntityFieldDefinition,
  CriteriaFilter,
  CriteriaSorting,
} from './engine/data/index.js';

// Types
export type {
  ChatBotMode,
  LlamaModelConfig,
  LLMProviderConfig,
  RedisConfig,
  DiscoveryConfig,
  SecurityLevel,
  AgentRole,
  AgentDefinition,
  PromptTemplate,
  PromptStore,
  SecurityGateCallbacks,
  SecurityAction,
  SecurityAuditEntry,
  VectorStore,
  SearchResult,
  ConversationMessage,
  ConversationStore,
  DocumentChunk,
  ParsedDocument,
  DocumentProcessor,
  WebSearchResult,
  WebSearchProvider,
  RAGContext,
  RAGRetrieveOptions,
  ChatBotConfig,
  ChatServerConfig,
  InferenceJob,
  InferenceResult,
  HealthStatus,
  ChatBotEvent,
  // §10 Provider/Model types (backward compat)
  ProviderType,
  ModelType,
  ProviderConfig,
  ModelConfig,
  ProviderRegistry,
} from './engine/types/index.js';

export {
  ChatBotError,
  ProviderError,
  QueueError,
  CircuitOpenError,
  DiscoveryError,
} from './engine/types/errors.js';

// Queue
export { QueueManager } from './engine/queue/manager.js';
export { InferenceWorker } from './engine/queue/worker.js';

// Resilience
export { ResilienceBreaker } from './engine/resilience/circuit-breaker.js';

// Discovery
export { MDNSDiscovery } from './engine/discovery/mdns.js';
export { TailscaleDiscovery } from './engine/discovery/tailscale.js';

// Agent
export { AgentOrchestrator } from './engine/agent/orchestrator.js';
export { AgentHarness } from './engine/agent/harness.js';
export { SecurityGate } from './engine/agent/security-gate.js';
export { PromptRenderer } from './engine/agent/prompt-renderer.js';

// RAG
export { RAGPipeline } from './engine/rag/pipeline.js';
