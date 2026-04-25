// ─── LlmModel EntityDefinition ──────────────────────────

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { LlmModel } from './llm-model.entity.js';

export class LlmModelDefinition extends EntityDefinition<LlmModel> {
  getEntityName(): string {
    return 'cmh_llm_model';
  }

  getLabel(): string {
    return 'LLM Model';
  }

  getModuleName(): string {
    return 'cmh-chatbot';
  }

  getDefaults(): Partial<LlmModel> {
    return {
      isDefault: false,
      isActive: true,
      isDownloaded: false,
      contextLength: 4096,
    };
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'providerId', type: 'uuid', flags: { required: true }, reference: 'cmh_llm_provider' })
      .add({ name: 'modelTypeId', type: 'uuid', flags: { required: true }, reference: 'cmh_model_type' })
      .add({ name: 'name', type: 'string', flags: { required: true, translatable: true } })
      .add({ name: 'description', type: 'text', flags: { nullable: true, translatable: true } })
      .add({ name: 'modelId', type: 'string', flags: { required: true } })
      .add({ name: 'type', type: 'string', flags: { required: true } })
      .add({ name: 'contextLength', type: 'integer', defaultValue: 4096 })
      .add({ name: 'isDefault', type: 'boolean', defaultValue: false })
      .add({ name: 'isActive', type: 'boolean', defaultValue: true })
      .add({ name: 'parameters', type: 'json', flags: { nullable: true } })
      .add({ name: 'filePath', type: 'string', flags: { nullable: true } })
      .add({ name: 'fileSize', type: 'integer', flags: { nullable: true } })
      .add({ name: 'isDownloaded', type: 'boolean', defaultValue: false })
      .add({ name: 'downloadUrl', type: 'string', flags: { nullable: true } })
      .add({ name: 'createdAt', type: 'datetime' })
      .add({ name: 'updatedAt', type: 'datetime' });
  }
}

// Auto-register on import
registerEntityDefinition(new LlmModelDefinition());
