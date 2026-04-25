// ─── LangGraph Stream Bridge ─────────────────────────────
// LangGraph graph.stream() 이벤트 → AI SDK Data Stream Protocol 변환.
// Workflow route에서 LangGraph 실행 결과를 SSE로 전송할 때 사용.

import { createUIMessageStream, type UIMessageStreamWriter } from 'ai';
import type { StateGraph } from '@langchain/langgraph';
import type { AgentState } from './state-schema.js';
import type { Logger } from '../../core/logger.js';

export interface StreamBridgeOptions {
  /** 로깅 */
  logger?: Logger;
  /** 노드 진입 시 메타데이터 전송 여부 */
  sendNodeMetadata?: boolean;
}

/**
 * LangGraph compiledGraph.stream() → AI SDK Data Stream ReadableStream 변환.
 *
 * LangGraph의 각 노드 실행 결과를 AI SDK Data Stream Protocol 형태로 변환하여
 * Renderer에서 실시간으로 소비할 수 있게 합니다.
 *
 * @example
 * ```ts
 * const graph = buildDefaultGraph(chatModel);
 * const stream = createLangGraphStream(graph, input, { logger });
 * return createUIMessageStreamResponse({ stream });
 * ```
 */
export function createLangGraphStream(
  compiledGraph: ReturnType<StateGraph<any>['compile']>,
  input: Partial<AgentState>,
  options?: StreamBridgeOptions,
): ReturnType<typeof createUIMessageStream> {
  const { logger, sendNodeMetadata = true } = options ?? {};

  return createUIMessageStream({
    execute: async ({ writer }) => {
      try {
        const stream = await compiledGraph.stream(input, {
          streamMode: 'updates',
        });

        for await (const event of stream) {
          // event는 { [nodeName]: stateUpdate } 형태
          for (const [nodeName, update] of Object.entries(event)) {
            const stateUpdate = update as Partial<AgentState>;

            // 노드 메타데이터 전송 (어떤 에이전트가 실행 중인지)
            if (sendNodeMetadata) {
              writer.write({
                type: 'data-langgraph' as const,
                data: [{ type: 'node-enter', node: nodeName, agent: stateUpdate.currentAgent ?? nodeName }],
              });
            }

            // 메시지가 있으면 텍스트 스트림으로 전송
            const messages = (stateUpdate as any).messages;
            if (Array.isArray(messages) && messages.length > 0) {
              const lastMsg = messages[messages.length - 1];
              const content = typeof lastMsg.content === 'string'
                ? lastMsg.content
                : typeof lastMsg.kwargs?.content === 'string'
                  ? lastMsg.kwargs.content
                  : '';

              if (content) {
                writer.write({
                  type: 'text-delta',
                  delta: content,
                  id: nodeName,
                });
              }
            }

            logger?.debug({ node: nodeName }, 'langgraph:node-complete');
          }
        }
      } catch (error) {
        logger?.error({ error }, 'langgraph:stream-error');
        writer.write({
          type: 'error',
          errorText: error instanceof Error ? error.message : 'LangGraph execution error',
        });
      }
    },
  });
}
