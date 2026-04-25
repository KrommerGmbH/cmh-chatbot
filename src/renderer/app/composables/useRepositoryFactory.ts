import { RepositoryFactory } from '@core/data'
import {
  AideWorksBridgeDataAdapter,
  LocalStorageDataAdapter,
  hasAideWorksBridge,
} from '@engine/data/data-adapter'
import { seedDefaultData } from '@engine/data/seed'

/** Shared singleton adapter + factory for all renderer components.
 *  Uses LocalStorageDataAdapter for persistence across page reloads. */
const _adapter = hasAideWorksBridge()
  ? new AideWorksBridgeDataAdapter((window as any).aideworks)
  : new LocalStorageDataAdapter('cmh')

if (_adapter instanceof LocalStorageDataAdapter) {
  seedDefaultData(_adapter)
}

const _factory = new RepositoryFactory(_adapter)

export function useRepositoryFactory() {
  return {
    repositoryFactory: _factory as { create: <T>(entityName: string) => any },
  }
}