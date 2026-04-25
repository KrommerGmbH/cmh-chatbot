// ─── LlmProvider Translation EntityDefinition ───────────
// Shopware _translation 테이블 패턴

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { LlmProviderTranslation } from './llm-provider-translation.entity.js';

export class LlmProviderTranslationDefinition extends EntityDefinition<LlmProviderTranslation> {
  static readonly ENTITY_NAME = 'cmh_llm_provider_translation';

  getEntityName(): string {
    return LlmProviderTranslationDefinition.ENTITY_NAME;
  }

  getLabel(): string {
    return 'LLM Provider Translation';
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'providerId', type: 'uuid', flags: { required: true }, reference: 'cmh_llm_provider' })
      .add({ name: 'entityId', type: 'uuid', flags: { required: true }, reference: 'cmh_llm_provider' })
      .add({ name: 'locale', type: 'string', flags: { required: true } })
      .add({ name: 'name', type: 'string', flags: { required: true } })
      .add({ name: 'description', type: 'text', flags: { nullable: true } })
      .add({ name: 'createdAt', type: 'datetime' })
      .add({ name: 'updatedAt', type: 'datetime' });
  }
}

// Auto-register on import
registerEntityDefinition(new LlmProviderTranslationDefinition());
