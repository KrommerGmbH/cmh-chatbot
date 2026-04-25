// ─── Media EntityDefinition ──────────────────────────────

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { Media } from './media.entity.js';

export class MediaDefinition extends EntityDefinition<Media> {
  getEntityName(): string {
    return 'cmh_media';
  }

  getLabel(): string {
    return 'Media';
  }

  getModuleName(): string {
    return 'cmh-media';
  }

  getDefaults(): Partial<Media> {
    return {
      tags: [],
    };
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'fileName', type: 'string', flags: { required: true } })
      .add({ name: 'fileExtension', type: 'string', flags: { required: true } })
      .add({ name: 'mimeType', type: 'string', flags: { required: true } })
      .add({ name: 'fileSize', type: 'integer', flags: { required: true } })
      .add({ name: 'title', type: 'string', flags: { nullable: true } })
      .add({ name: 'alt', type: 'string', flags: { nullable: true } })
      .add({ name: 'path', type: 'string', flags: { required: true } })
      .add({ name: 'hash', type: 'string', flags: { nullable: true } })
      .add({ name: 'folderId', type: 'uuid', flags: { nullable: true }, reference: 'cmh_media_folder' })
      .add({ name: 'tags', type: 'json', flags: { required: true }, defaultValue: "'[]'" })
      .add({ name: 'createdAt', type: 'datetime', flags: { required: true } })
      .add({ name: 'updatedAt', type: 'datetime', flags: { nullable: true } });
  }
}

// Auto-register on import
registerEntityDefinition(new MediaDefinition());
