// ─── Conversation EntityDefinition ───────────────────────

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { Conversation } from './conversation.entity.js';

export class ConversationDefinition extends EntityDefinition<Conversation> {
  getEntityName(): string {
    return 'cmh_conversation';
  }

  getLabel(): string {
    return 'Conversation';
  }

  getModuleName(): string {
    return 'cmh-chatbot';
  }

  getDefaults(): Partial<Conversation> {
    return {
      messageCount: 0,
      totalTokens: 0,
      isPinned: false,
      isArchived: false,
    };
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'title', type: 'string', flags: { required: true } })
      .add({ name: 'userId', type: 'uuid', flags: { nullable: true }, reference: 'cmh_user' })
      .add({ name: 'agentId', type: 'uuid', flags: { nullable: true }, reference: 'cmh_agent' })
      .add({ name: 'modelId', type: 'uuid', flags: { nullable: true }, reference: 'cmh_llm_model' })
      .add({ name: 'systemPrompt', type: 'text', flags: { nullable: true } })
      .add({ name: 'messageCount', type: 'integer', defaultValue: 0 })
      .add({ name: 'totalTokens', type: 'integer', defaultValue: 0 })
      .add({ name: 'isPinned', type: 'boolean', defaultValue: false })
      .add({ name: 'isArchived', type: 'boolean', defaultValue: false })
      .add({ name: 'metadata', type: 'json', flags: { nullable: true } })
      .add({ name: 'createdAt', type: 'datetime' })
      .add({ name: 'updatedAt', type: 'datetime' })
      .add({ name: 'lastMessageAt', type: 'datetime', flags: { nullable: true } });
  }
}

// Auto-register on import
registerEntityDefinition(new ConversationDefinition());
