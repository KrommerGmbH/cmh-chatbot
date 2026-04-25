/**
 * B-4 LLM Response Cache
 *
 * 동일 프롬프트+모델 조합에 대한 응답을 인메모리 LRU 캐시로 관리.
 * 스트리밍 응답은 캐시하지 않고, non-streaming generateChat 결과만 캐시.
 *
 * 캐시 키: SHA-256(JSON.stringify({ modelId, messages, system, temperature }))
 */

import { createHash } from 'crypto'

export interface CacheEntry {
  content: string
  reasoning?: string
  createdAt: number
  /** 원본 응답 토큰 수 (추정) */
  tokens?: number
}

export interface ResponseCacheConfig {
  /** 최대 캐시 항목 수 (기본: 200) */
  maxEntries?: number
  /** 항목 TTL (ms, 기본: 10분) */
  ttlMs?: number
  /** 캐시 활성화 여부 (기본: true) */
  enabled?: boolean
}

export class ResponseCacheService {
  private cache = new Map<string, CacheEntry>()
  private readonly maxEntries: number
  private readonly ttlMs: number
  private readonly enabled: boolean

  constructor(config: ResponseCacheConfig = {}) {
    this.maxEntries = config.maxEntries ?? 200
    this.ttlMs = config.ttlMs ?? 10 * 60 * 1000 // 10 min
    this.enabled = config.enabled ?? true
  }

  /**
   * 캐시 키 생성
   */
  buildKey(params: {
    modelId: string
    messages: Array<{ role: string; content: unknown }>
    system?: string
    temperature?: number
  }): string {
    const payload = JSON.stringify({
      m: params.modelId,
      msgs: params.messages.map((msg) => ({
        r: msg.role,
        c: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      })),
      s: params.system ?? '',
      t: params.temperature ?? 0.7,
    })
    return createHash('sha256').update(payload).digest('hex')
  }

  /**
   * 캐시에서 조회
   */
  get(key: string): CacheEntry | null {
    if (!this.enabled) return null
    const entry = this.cache.get(key)
    if (!entry) return null

    // TTL 만료 확인
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key)
      return null
    }

    // LRU: 접근 시 맨 뒤로 이동
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry
  }

  /**
   * 캐시에 저장
   */
  set(key: string, entry: Omit<CacheEntry, 'createdAt'>): void {
    if (!this.enabled) return
    if (!entry.content?.trim()) return // 빈 응답은 캐시하지 않음

    // LRU eviction
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }

    this.cache.set(key, { ...entry, createdAt: Date.now() })
  }

  /**
   * 캐시 통계
   */
  stats(): { size: number; maxEntries: number; enabled: boolean } {
    return { size: this.cache.size, maxEntries: this.maxEntries, enabled: this.enabled }
  }

  /**
   * 캐시 초기화
   */
  clear(): void {
    this.cache.clear()
  }
}

/** 싱글톤 인스턴스 */
export const responseCache = new ResponseCacheService()
