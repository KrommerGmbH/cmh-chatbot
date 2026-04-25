// ─── Mode ───────────────────────────────────────────────
export type ChatBotMode = 'cloud' | 'hub' | 'edge';

// ─── LLM Config (llama.cpp server) ──────────────────────
export interface LlamaModelConfig {
  /** Absolute path to GGUF model file (required for managed mode) */
  modelPath: string;
  /** Context window size (default: 4096) */
  contextSize?: number;
  /** Number of layers to offload to GPU (default: 0) */
  gpuLayers?: number;
  /** Temperature for generation (default: 0.7) */
  temperature?: number;
  /** Max tokens to generate (default: 2048) */
  maxTokens?: number;
  /** System prompt */
  systemPrompt?: string;
  /** Flash attention — better performance if supported */
  flashAttention?: boolean;
  /** Number of CPU threads (default: half of CPU count) */
  threads?: number;

  // ── llama-server config ──

  /** Path to llama-server binary. Required if serverUrl is not set. */
  serverBinaryPath?: string;
  /** URL of an already-running llama-server (e.g. http://127.0.0.1:8080). Skips binary spawn. */
  serverUrl?: string;
  /** Port for spawned llama-server (default: 8080) */
  serverPort?: number;
  /** Host for spawned llama-server (default: 127.0.0.1) */
  serverHost?: string;
  /** Number of parallel request slots for llama-server (default: 1) */
  serverParallel?: number;
}

/** @deprecated Use LlamaModelConfig instead */
export type LLMProviderConfig = LlamaModelConfig;

// ─── Redis ──────────────────────────────────────────────
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  /** Key prefix for BullMQ queues */
  prefix?: string;
}

// ─── Discovery ──────────────────────────────────────────
export interface DiscoveryConfig {
  /** Enable mDNS (bonjour-service) for LAN discovery */
  mdns?: boolean;
  /** mDNS service name */
  mdnsServiceName?: string;
  /** Enable Tailscale mesh networking */
  tailscale?: boolean;
}

// ─── Security ───────────────────────────────────────────
export type SecurityLevel = 'auto' | 'notify' | 'approve';

// ─── Agent ──────────────────────────────────────────────
export type AgentRole = 'orchestrator' | 'manager' | 'worker' | 'support';

export interface AgentDefinition {
  id: string;
  name: string;
  role: AgentRole;
  parentId: string | null;
  promptTemplateId: string;
  tools: string[];
  securityLevel: SecurityLevel;
  metadata?: Record<string, unknown>;
}

// ─── Prompt ─────────────────────────────────────────────
export interface PromptTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  variables: string[];
  version: number;
}

export interface PromptStore {
  getTemplate(id: string): Promise<PromptTemplate | null>;
  listTemplates(): Promise<PromptTemplate[]>;
}

// ─── Security Gate ──────────────────────────────────────
export interface SecurityGateCallbacks {
  preFilter?(action: SecurityAction): Promise<boolean>;
  validate(action: SecurityAction): Promise<boolean>;
  onNotify?(action: SecurityAction): Promise<void>;
  onApprove?(action: SecurityAction): Promise<boolean>;
  onAudit?(entry: SecurityAuditEntry): Promise<void>;
}

export interface SecurityAction {
  type: string;
  agentId: string;
  agentName: string;
  action: string;
  description: string;
  securityLevel: SecurityLevel;
  data?: Record<string, unknown>;
}

export interface SecurityAuditEntry {
  action: SecurityAction;
  approved: boolean;
  timestamp: Date;
}

// ─── RAG ────────────────────────────────────────────────
export interface VectorStore {
  upsert(id: string, embedding: number[], metadata: Record<string, unknown>): Promise<void>;
  search(query: number[], topK: number, filter?: Record<string, unknown>): Promise<SearchResult[]>;
  delete(id: string): Promise<void>;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
  content?: string;
}

export interface ConversationMessage {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export interface ConversationStore {
  saveMessage(msg: ConversationMessage): Promise<void>;
  getMessages(conversationId: string, limit?: number): Promise<ConversationMessage[]>;
  searchSimilar(embedding: number[], topK: number): Promise<ConversationMessage[]>;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  sectionTitle: string;
  content: string;
  orderIndex: number;
  tokenCount: number;
}

export interface ParsedDocument {
  title: string;
  content: string;
  sections: { title: string; content: string }[];
}

export interface DocumentProcessor {
  parse(file: Buffer, mimeType: string): Promise<ParsedDocument>;
  chunk(doc: ParsedDocument, strategy: 'semantic' | 'section'): Promise<DocumentChunk[]>;
}

export interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
  content?: string;
}

export interface WebSearchProvider {
  search(query: string, maxResults: number): Promise<WebSearchResult[]>;
}

export interface RAGContext {
  chunks: { content: string; source: string; score: number }[];
  totalTokens: number;
}

export interface RAGRetrieveOptions {
  sources: ('conversation' | 'document' | 'web')[];
  topK: number;
  maxTokens: number;
}

// ─── LLM Provider / Model (§10 — DAL entities) ─────────
// Canonical types now live in src/data/.  Re-exported for backward compat.
export type { ProviderType, ModelType } from '../data/types.js';
export type { LlmProvider, LlmModel } from '../data/entity/index.js';

/** @deprecated Use LlmProvider from data/entity instead */
export type { LlmProvider as ProviderConfig } from '../data/entity/index.js';
/** @deprecated Use LlmModel from data/entity instead */
export type { LlmModel as ModelConfig } from '../data/entity/index.js';

/** @deprecated Replaced by Repository<LlmProvider> + Repository<LlmModel> via DAL */
export interface ProviderRegistry {
  getProvider(id: string): Promise<import('../data/entity/index.js').LlmProvider | null>;
  getModel(id: string): Promise<import('../data/entity/index.js').LlmModel | null>;
  getDefaultModel(providerId: string): Promise<import('../data/entity/index.js').LlmModel | null>;
  listProviders(filter?: { type?: import('../data/types.js').ProviderType; isActive?: boolean }): Promise<import('../data/entity/index.js').LlmProvider[]>;
  listModels(providerId: string): Promise<import('../data/entity/index.js').LlmModel[]>;
}

// DataAdapter re-export for config usage
export type { DataAdapter } from '../data/data-adapter.js';

// ─── ChatBot Config ─────────────────────────────────────
export interface ChatBotConfig {
  mode: ChatBotMode;
  llm: LlamaModelConfig;
  redis?: RedisConfig;
  discovery?: DiscoveryConfig;
  /** @deprecated Use dataAdapter instead. Will be removed in v1.0. */
  providerRegistry?: ProviderRegistry;
  /** Shopware DAL-compatible data adapter. Defaults to InMemoryDataAdapter with seed data. */
  dataAdapter?: import('../data/data-adapter.js').DataAdapter;
  conversationStore?: ConversationStore;
  vectorStore?: VectorStore;
  promptStore?: PromptStore;
  securityGate?: SecurityGateCallbacks;
  agents?: AgentDefinition[];
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// ─── ChatServer Config ──────────────────────────────────
export interface ChatServerConfig {
  /** LLM model config (GGUF path or HuggingFace URI) */
  model: LlamaModelConfig;
  /** Server listen port (default 4000) */
  port?: number;
  /** Server listen host (default '0.0.0.0') */
  host?: string;
  /** mDNS service name for discovery */
  serviceName?: string;
  /** Redis config for BullMQ queue */
  redis?: RedisConfig;
  /** Queue options */
  queue?: { concurrency?: number };
  /** Discovery options */
  discovery?: DiscoveryConfig;
  /** CORS config */
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
  /** @deprecated Use dataAdapter instead. Will be removed in v1.0. */
  providerRegistry?: ProviderRegistry;
  /** Shopware DAL-compatible data adapter. Defaults to InMemoryDataAdapter with seed data. */
  dataAdapter?: import('../data/data-adapter.js').DataAdapter;
  /** SQLite DB 파일 경로. 지정 시 SqliteDataAdapter 사용 (dataAdapter 없을 때) */
  dbPath?: string;
  conversationStore?: ConversationStore;
  vectorStore?: VectorStore;
  promptStore?: PromptStore;
  securityGate?: SecurityGateCallbacks;
  agents?: AgentDefinition[];
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// ─── Queue Job ──────────────────────────────────────────
export interface InferenceJob {
  messages: Array<{ role: string; content: string }>;
  system?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface InferenceResult {
  text: string;
  thinking?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

// ─── Health ─────────────────────────────────────────────
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  uptime: number;
  queue: {
    connected: boolean;
    jobs: { waiting: number; active: number; completed: number; failed: number };
  };
  model?: {
    loaded: boolean;
    path?: string;
  };
}

// ─── Events ─────────────────────────────────────────────
export type ChatBotEvent =
  | 'ready'
  | 'error'
  | 'inference:start'
  | 'inference:complete'
  | 'inference:error'
  | 'circuit:open'
  | 'circuit:close'
  | 'circuit:halfOpen'
  | 'discovery:found'
  | 'discovery:lost';
