// ─── ScheduledTask EntityDefinition ──────────────────────

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { ScheduledTask } from './scheduled-task.entity.js';

export class ScheduledTaskDefinition extends EntityDefinition<ScheduledTask> {
  getEntityName(): string {
    return 'cmh_scheduled_task';
  }

  getLabel(): string {
    return 'Scheduled Task';
  }

  getModuleName(): string {
    return 'cmh-scheduler';
  }

  getDefaults(): Partial<ScheduledTask> {
    return {
      isActive: true,
      callbackType: 'log',
    };
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'cronExpression', type: 'string', flags: { required: true } })
      .add({ name: 'systemPrompt', type: 'text', flags: { required: true } })
      .add({ name: 'userPrompt', type: 'text', flags: { required: true } })
      .add({ name: 'modelId', type: 'string', flags: { nullable: true } })
      .add({ name: 'isActive', type: 'boolean', flags: { required: true }, defaultValue: 'true' })
      .add({ name: 'callbackType', type: 'string', flags: { nullable: true } })
      .add({ name: 'callbackTarget', type: 'string', flags: { nullable: true } })
      .add({ name: 'lastRunAt', type: 'datetime', flags: { nullable: true } })
      .add({ name: 'lastResult', type: 'text', flags: { nullable: true } })
      .add({ name: 'lastError', type: 'text', flags: { nullable: true } })
      .add({ name: 'createdAt', type: 'datetime', flags: { nullable: true } })
      .add({ name: 'updatedAt', type: 'datetime', flags: { nullable: true } });
  }
}

registerEntityDefinition(new ScheduledTaskDefinition());

export default ScheduledTaskDefinition;
