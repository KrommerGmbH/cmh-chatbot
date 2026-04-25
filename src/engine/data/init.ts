// ─── Data layer initializer ─────────────────────────────
// Shared between createChatBot() and createChatServer().
// Sets up DataAdapter → RepositoryFactory → ModelFactory.

import type { DataAdapter } from './data-adapter.js';
import { SqliteDataAdapter } from './sqlite-adapter.js';
import { RepositoryFactory } from './repository-factory.js';
import { ModelFactory, type ResolvedModel } from '../provider/model-factory.js';
import type { LlmProvider } from './entity/llm/llm-provider.entity.js';
import type { LlmModel } from './entity/llm/llm-model.entity.js';
import { ENTITY_CMH_LLM_PROVIDER, ENTITY_CMH_LLM_MODEL, seedDefaultData } from './seed.js';
import type { Logger } from '../core/logger.js';

// Ensure entity definitions are registered (side-effect imports)
import './entity/language/language.definition.js';
import './entity/language/language-translation.definition.js';
import './entity/user/user.definition.js';
import './entity/model-type/model-type.definition.js';
import './entity/model-type/model-type-translation.definition.js';
import './entity/llm/llm-provider.definition.js';
import './entity/llm/llm-provider-translation.definition.js';
import './entity/llm/llm-model.definition.js';
import './entity/llm/llm-model-translation.definition.js';
import './entity/agent/agent-type.definition.js';
import './entity/agent/agent-type-translation.definition.js';
import './entity/agent/agent.definition.js';

export interface InitDataLayerOptions {
  dataAdapter?: DataAdapter;
  /** SQLite DB 파일 경로. 지정 시 SqliteDataAdapter 사용 (dataAdapter보다 우선순위 낮음) */
  dbPath?: string;
  llamaServerUrl: string;
  logger: Logger;
}

export interface InitDataLayerResult {
  repositoryFactory: RepositoryFactory;
  modelFactory: ModelFactory;
}

/**
 * Initialize the DAL layer — called by both createChatBot() and createChatServer().
 *
 * 1. Uses provided DataAdapter or creates InMemoryDataAdapter (with seed data)
 * 2. Creates RepositoryFactory
 * 3. Creates ModelFactory wired to provider/model repositories
 */
export async function initDataLayer(options: InitDataLayerOptions): Promise<InitDataLayerResult> {
  const { dataAdapter, dbPath, llamaServerUrl, logger } = options;

  // Use provided adapter or create SQLite-backed adapter (default)
  let adapter: DataAdapter;
  if (dataAdapter) {
    adapter = dataAdapter;
  } else {
    const resolvedPath = dbPath || './data/cmh-chatbot.sqlite';
    const sqliteAdapter = new SqliteDataAdapter(resolvedPath);
    await sqliteAdapter.ready();
    seedDefaultData(sqliteAdapter);
    adapter = sqliteAdapter;
    logger.debug(`data-layer:using-sqlite-adapter path=${resolvedPath}` as any);
  }

  const repositoryFactory = new RepositoryFactory(adapter);

  // Create typed repositories for ModelFactory
  const providerRepo = repositoryFactory.create<LlmProvider>(ENTITY_CMH_LLM_PROVIDER);
  const modelRepo = repositoryFactory.create<LlmModel>(ENTITY_CMH_LLM_MODEL);

  const modelFactory = new ModelFactory(providerRepo, modelRepo, llamaServerUrl, logger);

  logger.debug('data-layer:initialized');

  return { repositoryFactory, modelFactory };
}

export type { ResolvedModel };
