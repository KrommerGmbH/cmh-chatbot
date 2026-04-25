// ─── MediaFolder EntityDefinition ────────────────────────

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { MediaFolder } from './media-folder.entity.js';

export class MediaFolderDefinition extends EntityDefinition<MediaFolder> {
  getEntityName(): string {
    return 'cmh_media_folder';
  }

  getLabel(): string {
    return 'Media Folder';
  }

  getModuleName(): string {
    return 'cmh-media';
  }

  getDefaults(): Partial<MediaFolder> {
    return {};
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'name', type: 'string', flags: { required: true } })
      .add({ name: 'parentId', type: 'uuid', flags: { nullable: true }, reference: 'cmh_media_folder' })
      .add({ name: 'createdAt', type: 'datetime', flags: { required: true } });
  }
}

// Auto-register on import
registerEntityDefinition(new MediaFolderDefinition());
