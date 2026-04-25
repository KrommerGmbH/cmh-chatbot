/**
 * Conversation Service
 *
 * 대화/메시지 DAL CRUD — Store UI 상태와 분리.
 * 히스토리 검색, 외부 API 등에서도 재사용 가능.
 */
import { Criteria } from '@engine/data/criteria'
import {
  ENTITY_CMH_CONVERSATION,
  ENTITY_CMH_MESSAGE,
} from '@engine/data/seed'
import { useRepositoryFactory } from '../composables/useRepositoryFactory'
import type { Conversation as ConversationEntity } from '@engine/data/entity/conversation/conversation.entity'
import type { Message as MessageEntity } from '@engine/data/entity/conversation/message.entity'

// Ensure entity definitions are registered
import '@engine/data/entity/conversation/conversation.definition'
import '@engine/data/entity/conversation/message.definition'

import type { ChatMessage, Conversation } from '../store/chat.store'

// ── Repository ───────────────────────────────────────────

const { repositoryFactory } = useRepositoryFactory()
const _conversationRepo = repositoryFactory.create(ENTITY_CMH_CONVERSATION)
const _messageRepo = repositoryFactory.create(ENTITY_CMH_MESSAGE)

// ── 대화 CRUD ────────────────────────────────────────────

/**
 * DAL에서 저장된 대화 목록 + 메시지 복원
 */
export async function loadConversationsFromDAL(
  defaultTitle: string,
  defaultModelId: string,
): Promise<Conversation[]> {
  const criteria = new Criteria()
  criteria.addSorting({ field: 'updatedAt', order: 'DESC' })
  criteria.setLimit(50)
  const convResult = await _conversationRepo.search(criteria)
  const convEntities = convResult.data as ConversationEntity[]

  if (convEntities.length === 0) return []

  const restored: Conversation[] = []

  for (const conv of convEntities) {
    const msgCriteria = new Criteria()
    msgCriteria.addFilter(Criteria.equals('conversationId', conv.id))
    msgCriteria.addSorting({ field: 'createdAt', order: 'ASC' })
    msgCriteria.setLimit(500)
    const msgResult = await _messageRepo.search(msgCriteria)
    const msgEntities = msgResult.data as MessageEntity[]

    const normalizedMessages = msgEntities
      .filter((m) => m.role !== 'assistant' || !!(m.content?.trim() || m.thinking?.trim()))
      .map((m) => {
        const meta = (m.metadata as Record<string, unknown>) ?? undefined
        return {
          id: m.id,
          role: m.role as ChatMessage['role'],
          content: m.content,
          createdAt: m.createdAt,
          thinking: m.thinking ?? undefined,
          rating: m.rating ?? undefined,
          modelName: m.modelName ?? undefined,
          hidden: meta?.hidden === true ? true : undefined,
          toolEvents: Array.isArray(m.toolCalls) ? m.toolCalls as unknown as ChatMessage['toolEvents'] : undefined,
          metadata: meta,
        }
      })

    restored.push({
      id: conv.id,
      title: conv.title || defaultTitle,
      modelId: conv.modelId || defaultModelId,
      createdAt: conv.createdAt || new Date().toISOString(),
      updatedAt: conv.updatedAt || new Date().toISOString(),
      messages: normalizedMessages,
      meta: (conv.metadata as Record<string, unknown>) ?? null,
    })
  }

  return restored
}

/**
 * DAL에 새 대화 저장
 */
export async function saveConversation(conv: {
  id: string
  title: string
  modelId: string
}): Promise<void> {
  const now = new Date().toISOString()
  await _conversationRepo.save({
    id: conv.id,
    title: conv.title,
    modelId: conv.modelId || null,
    messageCount: 0,
    totalTokens: 0,
    isPinned: false,
    isArchived: false,
    metadata: (conv as any).meta ?? null,
    createdAt: now,
    updatedAt: now,
  } as ConversationEntity).catch(() => {})
}

/**
 * 대화 제목/필드 업데이트
 */
export async function updateConversation(
  id: string,
  fields: Partial<{ title: string; updatedAt: string }>,
): Promise<void> {
  const entity = await _conversationRepo.get(id).catch(() => null) as ConversationEntity | null
  if (entity) {
    await _conversationRepo.save({
      ...entity,
      ...fields,
      updatedAt: fields.updatedAt ?? new Date().toISOString(),
    }).catch(() => {})
  }
}

/**
 * 대화 삭제 (메시지 포함)
 */
export async function deleteConversation(id: string): Promise<void> {
  await _conversationRepo.delete(id).catch(() => {})
  const msgCriteria = new Criteria()
  msgCriteria.addFilter(Criteria.equals('conversationId', id))
  const result = await _messageRepo.search(msgCriteria).catch(() => ({ data: [] }))
  for (const m of (result as { data: MessageEntity[] }).data) {
    await _messageRepo.delete(m.id).catch(() => {})
  }
}

// ── 메시지 CRUD ──────────────────────────────────────────

/**
 * DAL에 메시지 영속화
 */
export async function persistMessage(conversationId: string, msg: ChatMessage): Promise<void> {
  const now = new Date().toISOString()
  console.log('[conversation] persistMessage:', msg.role, msg.id, 'conv:', conversationId, 'content length:', msg.content?.length)

  // #3 hidden + #6 toolEvents → DAL
  const msgMetadata: Record<string, unknown> = { ...(msg.metadata ?? {}) }
  if (msg.hidden) msgMetadata.hidden = true

  await _messageRepo.save({
    id: msg.id,
    conversationId,
    role: msg.role as MessageEntity['role'],
    content: msg.content,
    thinking: msg.thinking ?? null,
    rating: msg.rating ?? null,
    userId: null,
    modelName: msg.modelName ?? null,
    toolCalls: (msg.toolEvents as unknown as Record<string, unknown>[]) ?? null,
    metadata: Object.keys(msgMetadata).length > 0 ? msgMetadata : null,
    createdAt: msg.createdAt ?? now,
    updatedAt: now,
  } as MessageEntity).then(() => {
    console.log('[conversation] Message saved OK:', msg.id)
  }).catch((e: unknown) => {
    console.error('[conversation] Message save FAILED:', msg.id, e)
  })

  // 대화 메타 업데이트
  const entity = await _conversationRepo.get(conversationId).catch(() => null) as ConversationEntity | null
  if (entity) {
    await _conversationRepo.save({
      ...entity,
      messageCount: (entity.messageCount ?? 0) + 1,
      lastMessageAt: now,
      updatedAt: now,
    }).catch(() => {})
  }
}

/**
 * 메시지 평가 점수 저장
 */
export async function rateMessage(messageId: string, score: number | null): Promise<void> {
  const entity = await _messageRepo.get(messageId).catch(() => null) as MessageEntity | null
  if (entity) {
    await _messageRepo.save({ ...entity, rating: score, updatedAt: new Date().toISOString() } as MessageEntity).catch(() => {})
  }
}
