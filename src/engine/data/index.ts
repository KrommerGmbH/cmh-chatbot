// ─── Data module barrel exports ─────────────────────────
// Shopware DAL-compatible data access layer for cmh-chatbot.
//
// Import this module to get the full DAL surface:
//   import { Criteria, Repository, RepositoryFactory, ... } from '@krommergmbh/cmh-chatbot';

// Base types
export type {
  Entity,
  ProviderType,
  ModelType,
  EntityFieldType,
  EntityFieldDefinition,
  EntityIndexDefinition,
  DataEntityDefinition,
  SearchResult,
} from './types.js';

// Criteria
export { Criteria } from './criteria.js';
export type { CriteriaFilter, CriteriaSorting } from './criteria.js';

// Field collection
export { FieldCollection } from './field.collection.js';
export type { FieldFlags, FieldEntry } from './field.collection.js';

// Entity definition
export { EntityDefinition } from './entity.definition.js';

// Entity registry
export {
  registerEntityDefinition,
  getEntityDefinition,
  getAllEntityDefinitions,
  EntityRegistry,
} from './entity-registry.js';

// Data adapter
export { InMemoryDataAdapter, LocalStorageDataAdapter } from './data-adapter.js';
export type { DataAdapter } from './data-adapter.js';
export { SqliteDataAdapter } from './sqlite-adapter.js';

// Repository
export { Repository } from './repository.js';
export { RepositoryFactory } from './repository-factory.js';

// Entity definitions (auto-registers on import)
export {
  type LlmProvider,
  type LlmModel,
  type AgentType,
  type AgentCategory,
  type Agent,
  type AgentStatus,
  LlmProviderDefinition,
  LlmModelDefinition,
  AgentTypeDefinition,
  AgentDefinition,
} from './entity/index.js';

// Seed data
export {
  ENTITY_CMH_LLM_PROVIDER,
  ENTITY_CMH_LLM_MODEL,
  ENTITY_CMH_AGENT_TYPE,
  ENTITY_CMH_AGENT,
  DEFAULT_PROVIDERS,
  DEFAULT_MODELS,
  DEFAULT_AGENT_TYPES,
  DEFAULT_AGENTS,
  seedDefaultData,
} from './seed.js';

// Data layer initializer
export { initDataLayer } from './init.js';
export type { InitDataLayerOptions, InitDataLayerResult } from './init.js';
