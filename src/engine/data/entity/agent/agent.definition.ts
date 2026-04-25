// ─── Agent EntityDefinition ──────────────────────────────

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { Agent } from './agent.entity.js';

export class AgentDefinition extends EntityDefinition<Agent> {
  getEntityName(): string {
    return 'cmh_agent';
  }

  getLabel(): string {
    return 'Agent';
  }

  getModuleName(): string {
    return 'cmh-chatbot';
  }

  getDefaults(): Partial<Agent> {
    return {
      status: 'idle',
      isActive: true,
      isDeletable: true,
      position: 10,
    };
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'agentTypeId', type: 'uuid', flags: { required: true }, reference: 'cmh_agent_type' })
      .add({ name: 'name', type: 'string', flags: { required: true } })
      .add({ name: 'status', type: 'string', defaultValue: 'idle' })
      .add({ name: 'parentAgentId', type: 'uuid', flags: { nullable: true }, reference: 'cmh_agent' })
      .add({ name: 'rolePrompt', type: 'text', flags: { nullable: true } })
      .add({ name: 'missionPrompt', type: 'text', flags: { nullable: true } })
      .add({ name: 'userPrompt', type: 'text', flags: { nullable: true } })
      .add({ name: 'systemPrompt', type: 'text', flags: { nullable: true } })
      .add({ name: 'modelId', type: 'uuid', flags: { nullable: true }, reference: 'cmh_llm_model' })
      .add({ name: 'subModelId', type: 'uuid', flags: { nullable: true }, reference: 'cmh_llm_model' })
      .add({ name: 'parameters', type: 'json', flags: { nullable: true } })
      .add({ name: 'currentTasks', type: 'json', flags: { nullable: true } })
      .add({ name: 'capabilities', type: 'json', flags: { nullable: true } })
      .add({ name: 'langchainConfig', type: 'json', flags: { nullable: true } })
      .add({ name: 'config', type: 'json', flags: { nullable: true } })
      .add({ name: 'isActive', type: 'boolean', defaultValue: true })
      .add({ name: 'isDeletable', type: 'boolean', defaultValue: true })
      .add({ name: 'position', type: 'integer', defaultValue: 10 })
      .add({ name: 'icon', type: 'string', flags: { nullable: true } })
      .add({ name: 'color', type: 'string', flags: { nullable: true } })
      .add({ name: 'domain', type: 'string', flags: { nullable: true } })
      .add({ name: 'createdAt', type: 'datetime' })
      .add({ name: 'updatedAt', type: 'datetime' });
  }
}

// Auto-register on import
registerEntityDefinition(new AgentDefinition());
