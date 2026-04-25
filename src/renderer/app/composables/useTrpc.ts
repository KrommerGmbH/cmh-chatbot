import { createTRPCProxyClient } from '@trpc/client'
import { ipcLink } from 'electron-trpc/renderer'
import type { AppRouter } from '../../../main/ipc/router'

let client: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null = null
let initFailed = false

/**
 * Singleton tRPC client for Renderer → Main IPC.
 * Uses electron-trpc's ipcLink under the hood.
 *
 * preload가 아직 로드되지 않았거나 Electron 환경이 아닌 경우 null 반환.
 */
export function useTrpc() {
  if (initFailed) return null
  if (!client) {
    try {
      client = createTRPCProxyClient<AppRouter>({
        links: [ipcLink()],
        transformer: {
          serialize: (value: unknown) => value,
          deserialize: (value: unknown) => value,
        } as unknown as any,
      })
    } catch (err) {
      console.warn('[useTrpc] electronTRPC 사용 불가 (preload 미로드?):', err)
      initFailed = true
      return null
    }
  }
  return client
}
