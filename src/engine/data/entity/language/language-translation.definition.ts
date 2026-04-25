// ─── Language Translation EntityDefinition ───────────────
// Shopware _translation 테이블 패턴

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { LanguageTranslation } from './language-translation.entity.js';

export class LanguageTranslationDefinition extends EntityDefinition<LanguageTranslation> {
  static readonly ENTITY_NAME = 'cmh_language_translation';

  getEntityName(): string {
    return LanguageTranslationDefinition.ENTITY_NAME;
  }

  getLabel(): string {
    return 'Language Translation';
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'languageId', type: 'uuid', flags: { required: true }, reference: 'cmh_language' })
      .add({ name: 'entityId', type: 'uuid', flags: { required: true }, reference: 'cmh_language' })
      .add({ name: 'locale', type: 'string', flags: { required: true } })
      .add({ name: 'name', type: 'string', flags: { required: true } })
      .add({ name: 'createdAt', type: 'datetime' })
      .add({ name: 'updatedAt', type: 'datetime' });
  }
}

// Auto-register on import
registerEntityDefinition(new LanguageTranslationDefinition());
