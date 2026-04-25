// ─── LlmProvider EntityDefinition ────────────────────────

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { LlmProvider } from './llm-provider.entity.js';

export class LlmProviderDefinition extends EntityDefinition<LlmProvider> {
  getEntityName(): string {
    return 'cmh_llm_provider';
  }

  getLabel(): string {
    return 'LLM Provider';
  }

  getModuleName(): string {
    return 'cmh-chatbot';
  }

  getDefaults(): Partial<LlmProvider> {
    return {
      isActive: true,
      priority: 10,
    };
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'name', type: 'string', flags: { required: true, translatable: true } })
      .add({ name: 'description', type: 'text', flags: { nullable: true, translatable: true } })
      .add({ name: 'type', type: 'string', flags: { required: true } })
      .add({ name: 'apiKey', type: 'string', flags: { nullable: true } })
      .add({ name: 'baseUrl', type: 'string', flags: { nullable: true } })
      .add({ name: 'isActive', type: 'boolean', defaultValue: true })
      .add({ name: 'priority', type: 'integer', defaultValue: 10 })
      .add({ name: 'metadata', type: 'json', flags: { nullable: true } })
      .add({ name: 'createdAt', type: 'datetime' })
      .add({ name: 'updatedAt', type: 'datetime' });
  }
}

// Auto-register on import
registerEntityDefinition(new LlmProviderDefinition());
