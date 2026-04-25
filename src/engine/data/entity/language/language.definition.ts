// ─── Language EntityDefinition ────────────────────────────

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { LanguageEntity } from './language.entity.js';

export class LanguageDefinition extends EntityDefinition<LanguageEntity> {
  static readonly ENTITY_NAME = 'cmh_language';

  getEntityName(): string {
    return LanguageDefinition.ENTITY_NAME;
  }

  getLabel(): string {
    return 'Language';
  }

  getModuleName(): string {
    return 'cmh-chatbot';
  }

  getDefaults(): Partial<LanguageEntity> {
    return {
      isActive: true,
      isDefault: false,
      position: 0,
      icon: 'ph:globe',
    };
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'code', type: 'string', flags: { required: true } })
      .add({ name: 'nativeName', type: 'string', flags: { required: true } })
      .add({ name: 'icon', type: 'string', defaultValue: 'ph:globe' })
      .add({ name: 'position', type: 'integer', defaultValue: 0 })
      .add({ name: 'isDefault', type: 'boolean', defaultValue: false })
      .add({ name: 'isActive', type: 'boolean', defaultValue: true })
      // ── Translatable fields (resolved from _translation) ──
      .add({ name: 'name', type: 'string', flags: { translatable: true } })
      .add({ name: 'createdAt', type: 'datetime' })
      .add({ name: 'updatedAt', type: 'datetime' });
  }
}

// Auto-register on import
registerEntityDefinition(new LanguageDefinition());
