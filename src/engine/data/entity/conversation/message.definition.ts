// ─── Message EntityDefinition ────────────────────────────

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { Message } from './message.entity.js';

export class MessageDefinition extends EntityDefinition<Message> {
  getEntityName(): string {
    return 'cmh_message';
  }

  getLabel(): string {
    return 'Message';
  }

  getModuleName(): string {
    return 'cmh-chatbot';
  }

  getDefaults(): Partial<Message> {
    return {
      role: 'user',
      content: '',
    };
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'conversationId', type: 'uuid', flags: { required: true }, reference: 'cmh_conversation' })
      .add({ name: 'role', type: 'string', flags: { required: true }, defaultValue: 'user' })
      .add({ name: 'content', type: 'text', flags: { required: true } })
      .add({ name: 'thinking', type: 'text', flags: { nullable: true } })
      .add({ name: 'toolCalls', type: 'json', flags: { nullable: true } })
      .add({ name: 'userId', type: 'uuid', flags: { nullable: true }, reference: 'cmh_user' })
      .add({ name: 'modelName', type: 'string', flags: { nullable: true } })
      .add({ name: 'rating', type: 'integer', flags: { nullable: true } })
      .add({ name: 'embeddingVector', type: 'json', flags: { nullable: true } })
      .add({ name: 'tokenUsage', type: 'json', flags: { nullable: true } })
      .add({ name: 'latencyMs', type: 'integer', flags: { nullable: true } })
      .add({ name: 'metadata', type: 'json', flags: { nullable: true } })
      .add({ name: 'createdAt', type: 'datetime' })
      .add({ name: 'updatedAt', type: 'datetime' });
  }
}

// Auto-register on import
registerEntityDefinition(new MessageDefinition());
