// ─── AgentType EntityDefinition ──────────────────────────

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { AgentType } from './agent-type.entity.js';

export class AgentTypeDefinition extends EntityDefinition<AgentType> {
  getEntityName(): string {
    return 'cmh_agent_type';
  }

  getLabel(): string {
    return 'Agent Type';
  }

  getModuleName(): string {
    return 'cmh-chatbot';
  }

  getDefaults(): Partial<AgentType> {
    return {
      isActive: true,
      priority: 10,
      maxConcurrentTasks: 1,
      canHaveChildren: false,
    };
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'name', type: 'string', flags: { required: true, translatable: true } })
      .add({ name: 'technicalName', type: 'string', flags: { required: true } })
      .add({ name: 'description', type: 'text', flags: { required: true, translatable: true } })
      .add({ name: 'maxConcurrentTasks', type: 'integer', defaultValue: 1 })
      .add({ name: 'canHaveChildren', type: 'boolean', defaultValue: false })
      .add({ name: 'isActive', type: 'boolean', defaultValue: true })
      .add({ name: 'priority', type: 'integer', defaultValue: 10 })
      .add({ name: 'config', type: 'json', flags: { nullable: true } })
      .add({ name: 'createdAt', type: 'datetime' })
      .add({ name: 'updatedAt', type: 'datetime' });
  }
}

// Auto-register on import
registerEntityDefinition(new AgentTypeDefinition());
