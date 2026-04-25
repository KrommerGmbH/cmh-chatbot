// ─── RagDocument EntityDefinition ────────────────────────

import { EntityDefinition } from '../../entity.definition.js';
import { FieldCollection } from '../../field.collection.js';
import { registerEntityDefinition } from '../../entity-registry.js';
import type { RagDocument } from './rag-document.entity.js';

export class RagDocumentDefinition extends EntityDefinition<RagDocument> {
  getEntityName(): string {
    return 'cmh_rag_document';
  }

  getLabel(): string {
    return 'RAG Document';
  }

  getModuleName(): string {
    return 'cmh-media';
  }

  getDefaults(): Partial<RagDocument> {
    return {
      status: 'pending',
      sectionPosition: 0,
      chunkStrategy: 'recursive',
    };
  }

  defineFields(): FieldCollection {
    return new FieldCollection()
      .add({ name: 'id', type: 'uuid', flags: { primaryKey: true, required: true } })
      .add({ name: 'mediaId', type: 'uuid', flags: { required: true }, reference: 'cmh_media' })
      .add({ name: 'theme', type: 'string', flags: { required: true } })
      .add({ name: 'themeVector', type: 'json', flags: { nullable: true } })
      .add({ name: 'section', type: 'string', flags: { required: true } })
      .add({ name: 'sectionVector', type: 'json', flags: { nullable: true } })
      .add({ name: 'sectionPosition', type: 'integer', flags: { required: true }, defaultValue: '0' })
      .add({ name: 'content', type: 'text', flags: { required: true } })
      .add({ name: 'contentVector', type: 'json', flags: { nullable: true } })
      .add({ name: 'contentHash', type: 'string', flags: { required: true } })
      .add({ name: 'chunkStrategy', type: 'string', flags: { required: true }, defaultValue: "'recursive'" })
      .add({ name: 'status', type: 'string', flags: { required: true }, defaultValue: "'pending'" })
      .add({ name: 'errorMessage', type: 'text', flags: { nullable: true } })
      .add({ name: 'metadata', type: 'json', flags: { nullable: true } })
      .add({ name: 'createdAt', type: 'datetime', flags: { required: true } })
      .add({ name: 'updatedAt', type: 'datetime', flags: { nullable: true } });
  }
}

// Auto-register on import
registerEntityDefinition(new RagDocumentDefinition());
