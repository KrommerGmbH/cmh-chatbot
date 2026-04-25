/**
 * Entity barrel — imports trigger auto-registration of entity definitions.
 * Using named imports to satisfy TypeScript module resolution.
 */
import { MediaDefinition } from '@engine/data/entity/media/media.definition'
import { MediaFolderDefinition } from '@engine/data/entity/media/media-folder.definition'
import { RagDocumentDefinition } from '@engine/data/entity/rag/rag-document.definition'

// Ensure definitions are retained (prevent tree-shaking)
void MediaDefinition
void MediaFolderDefinition
void RagDocumentDefinition
