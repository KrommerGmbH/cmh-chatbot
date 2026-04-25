// ─── User EntityDefinition ───────────────────────────────

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { UserEntity } from './user.entity.js';

export class UserDefinition extends EntityDefinition<UserEntity> {
  static readonly ENTITY_NAME = 'cmh_user';

  getEntityName(): string {
    return UserDefinition.ENTITY_NAME;
  }

  getLabel(): string {
    return 'User';
  }

  getModuleName(): string {
    return 'cmh-chatbot';
  }

  getDefaults(): Partial<UserEntity> {
    return {
      isActive: true,
      avatarIcon: 'ph:cat-light',
    };
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'name', type: 'string', flags: { required: true } })
      .add({ name: 'email', type: 'string', flags: { nullable: true } })
      .add({ name: 'languageId', type: 'uuid', flags: { required: true }, reference: 'cmh_language' })
      .add({ name: 'avatarIcon', type: 'string', defaultValue: 'ph:cat-light' })
      .add({ name: 'isActive', type: 'boolean', defaultValue: true })
      .add({ name: 'createdAt', type: 'datetime' })
      .add({ name: 'updatedAt', type: 'datetime' });
  }
}

// Auto-register on import
registerEntityDefinition(new UserDefinition());
