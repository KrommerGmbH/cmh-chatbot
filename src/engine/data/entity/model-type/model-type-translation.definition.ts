// ─── ModelType Translation EntityDefinition ─────────────
// Shopware _translation 테이블 패턴

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { ModelTypeTranslation } from './model-type.entity.js';

export class ModelTypeTranslationDefinition extends EntityDefinition<ModelTypeTranslation> {
  static readonly ENTITY_NAME = 'cmh_model_type_translation';

  getEntityName(): string {
    return ModelTypeTranslationDefinition.ENTITY_NAME;
  }

  getLabel(): string {
    return 'Model Type Translation';
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'modelTypeId', type: 'uuid', flags: { required: true }, reference: 'cmh_model_type' })
      .add({ name: 'entityId', type: 'uuid', flags: { required: true }, reference: 'cmh_model_type' })
      .add({ name: 'locale', type: 'string', flags: { required: true } })
      .add({ name: 'name', type: 'string', flags: { required: true } })
      .add({ name: 'description', type: 'text', flags: { nullable: true } })
      .add({ name: 'createdAt', type: 'datetime' })
      .add({ name: 'updatedAt', type: 'datetime' });
  }
}

// Auto-register on import
registerEntityDefinition(new ModelTypeTranslationDefinition());
