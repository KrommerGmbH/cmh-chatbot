/**
 * MCP Service — MCP 서버 등록/관리
 *
 * Phase 10.6: MCP (Model Context Protocol) 서버 라이프사이클 관리
 */

export interface McpServerConfig {
  id: string
  name: string
  description?: string
  /** Transport: 'stdio' | 'sse' | 'streamable-http' */
  transport: 'stdio' | 'sse' | 'streamable-http'
  /** stdio 용 */
  command?: string
  args?: string[]
  env?: Record<string, string>
  /** sse / streamable-http 용 */
  url?: string
  headers?: Record<string, string>
  /** 연결 상태 */
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  /** 마지막 에러 */
  lastError?: string
  /** 등록된 도구 목록 */
  tools: McpToolInfo[]
  isActive: boolean
  createdAt: string
}

export interface McpToolInfo {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/**
 * MCP 서버 레지스트리
 */
export class McpService {
  private servers = new Map<string, McpServerConfig>()
  private onChangeCallbacks: Array<() => void> = []

  /** 서버 등록 */
  register(config: Omit<McpServerConfig, 'status' | 'tools' | 'createdAt'>): McpServerConfig {
    const server: McpServerConfig = {
      ...config,
      status: 'disconnected',
      tools: [],
      createdAt: new Date().toISOString(),
    }
    this.servers.set(server.id, server)
    this.notifyChange()
    return server
  }

  /** 서버 삭제 */
  unregister(id: string): boolean {
    const result = this.servers.delete(id)
    if (result) this.notifyChange()
    return result
  }

  /** 모든 서버 조회 */
  list(): McpServerConfig[] {
    return Array.from(this.servers.values())
  }

  /** 특정 서버 조회 */
  get(id: string): McpServerConfig | undefined {
    return this.servers.get(id)
  }

  /** 서버 상태 업데이트 */
  updateStatus(id: string, status: McpServerConfig['status'], error?: string): void {
    const server = this.servers.get(id)
    if (!server) return
    server.status = status
    if (error) server.lastError = error
    this.notifyChange()
  }

  /** 서버 도구 목록 업데이트 */
  updateTools(id: string, tools: McpToolInfo[]): void {
    const server = this.servers.get(id)
    if (!server) return
    server.tools = tools
    this.notifyChange()
  }

  /** 활성 서버의 모든 도구 조회 */
  getAllActiveTools(): McpToolInfo[] {
    const tools: McpToolInfo[] = []
    for (const server of this.servers.values()) {
      if (server.isActive && server.status === 'connected') {
        tools.push(...server.tools)
      }
    }
    return tools
  }

  /** 변경 콜백 등록 */
  onChange(callback: () => void): () => void {
    this.onChangeCallbacks.push(callback)
    return () => {
      this.onChangeCallbacks = this.onChangeCallbacks.filter(cb => cb !== callback)
    }
  }

  private notifyChange(): void {
    for (const cb of this.onChangeCallbacks) cb()
  }
}

/** 싱글턴 인스턴스 */
let _instance: McpService | null = null

export function getMcpService(): McpService {
  if (!_instance) _instance = new McpService()
  return _instance
}
