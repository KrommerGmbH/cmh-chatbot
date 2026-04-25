// ─── ModelType EntityDefinition ──────────────────────────

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { ModelTypeEntity } from './model-type.entity.js';

export class ModelTypeDefinition extends EntityDefinition<ModelTypeEntity> {
  static readonly ENTITY_NAME = 'cmh_model_type';

  getEntityName(): string {
    return ModelTypeDefinition.ENTITY_NAME;
  }

  getLabel(): string {
    return 'Model Type';
  }

  getModuleName(): string {
    return 'cmh-chatbot';
  }

  getDefaults(): Partial<ModelTypeEntity> {
    return {
      isActive: true,
      position: 0,
      icon: 'ph:brain',
    };
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'technicalName', type: 'string', flags: { required: true } })
      .add({ name: 'icon', type: 'string', defaultValue: 'ph:brain' })
      .add({ name: 'position', type: 'integer', defaultValue: 0 })
      .add({ name: 'isActive', type: 'boolean', defaultValue: true })
      // ── Translatable fields (resolved from _translation) ──
      .add({ name: 'name', type: 'string', flags: { translatable: true } })
      .add({ name: 'description', type: 'text', flags: { translatable: true, nullable: true } })
      .add({ name: 'createdAt', type: 'datetime' })
      .add({ name: 'updatedAt', type: 'datetime' });
  }
}

// Auto-register on import
registerEntityDefinition(new ModelTypeDefinition());
