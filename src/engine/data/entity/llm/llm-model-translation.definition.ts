// ─── LlmModel Translation EntityDefinition ──────────────
// Shopware _translation 테이블 패턴

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { LlmModelTranslation } from './llm-model-translation.entity.js';

export class LlmModelTranslationDefinition extends EntityDefinition<LlmModelTranslation> {
  static readonly ENTITY_NAME = 'cmh_llm_model_translation';

  getEntityName(): string {
    return LlmModelTranslationDefinition.ENTITY_NAME;
  }

  getLabel(): string {
    return 'LLM Model Translation';
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'modelId', type: 'uuid', flags: { required: true }, reference: 'cmh_llm_model' })
      .add({ name: 'entityId', type: 'uuid', flags: { required: true }, reference: 'cmh_llm_model' })
      .add({ name: 'locale', type: 'string', flags: { required: true } })
      .add({ name: 'name', type: 'string', flags: { required: true } })
      .add({ name: 'description', type: 'text', flags: { nullable: true } })
      .add({ name: 'createdAt', type: 'datetime' })
      .add({ name: 'updatedAt', type: 'datetime' });
  }
}

// Auto-register on import
registerEntityDefinition(new LlmModelTranslationDefinition());
