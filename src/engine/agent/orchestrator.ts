import type { AgentDefinition, LlamaModelConfig, PromptStore, SecurityGateCallbacks } from '../types/index.js';
import type { Logger } from '../core/logger.js';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { AgentHarness, type AgentMessage, type AgentRunResult } from './harness.js';
import { SecurityGate } from './security-gate.js';
import { PromptRenderer } from './prompt-renderer.js';
import { buildDefaultGraph } from '../langchain/graph/builder.js';
import { createCheckpointer } from '../langchain/memory/checkpointer.js';
import type { AgentState } from '../langchain/graph/state-schema.js';
import { CallbackHandlerRegistry } from '../langchain/callbacks/registry.js';
// Side-effect imports — 레지스트리에 핸들러 자동 등록
import '../langchain/callbacks/logging.handler.js';
import '../langchain/callbacks/monitoring.handler.js';
import '../langchain/callbacks/profiler.handler.js';
import '../langchain/callbacks/tracing.handler.js';

export interface OrchestratorConfig {
  agents: AgentDefinition[];
  /**
   * llama-server base URL (legacy — 하위호환용).
   * chatModel 이 제공되면 무시됨.
   */
  llamaServerUrl?: string;
  /** LangChain BaseChatModel 인스턴스. 제공하면 llamaServerUrl 대신 사용. */
  chatModel?: BaseChatModel;
  modelConfig: LlamaModelConfig;
  promptStore?: PromptStore;
  securityGate?: SecurityGateCallbacks;
  logger: Logger;
}

/**
 * Agent Orchestrator — manages the hierarchy of agents.
 * Routes user messages to the appropriate agent.
 * Uses llama-server's OpenAI-compatible API.
 */
export class AgentOrchestrator {
  private agents = new Map<string, AgentHarness>();
  private orchestratorAgent: AgentHarness | null = null;
  private securityGate: SecurityGate | null = null;
  private promptRenderer: PromptRenderer | null = null;
  private chatModel: BaseChatModel | null = null;
  /** Phase 5.3 — LangGraph 컴파일된 그래프 (lazy init) */
  private langGraphApp: Awaited<ReturnType<typeof buildDefaultGraph>> | null = null;

  constructor(private readonly config: OrchestratorConfig) {
    const { agents, llamaServerUrl, chatModel, modelConfig, promptStore, securityGate, logger } = config;

    if (securityGate) {
      this.securityGate = new SecurityGate(securityGate, logger);
    }
    if (promptStore) {
      this.promptRenderer = new PromptRenderer(promptStore, logger);
    }

    // chatModel 우선, 없으면 llamaServerUrl로 생성 (하위호환)
    const serverUrl = llamaServerUrl ?? 'http://127.0.0.1:8080';
    const resolvedModel: BaseChatModel = chatModel ?? new ChatOpenAI({
      model: 'default',
      temperature: modelConfig.temperature ?? 0.7,
      maxTokens: modelConfig.maxTokens ?? 2048,
      streaming: true,
      configuration: {
        baseURL: serverUrl.endsWith('/v1') ? serverUrl : `${serverUrl}/v1`,
        apiKey: 'not-needed',
      },
      openAIApiKey: 'not-needed',
    });

    this.chatModel = resolvedModel;

    for (const def of agents) {
      const harness = new AgentHarness(
        def,
        resolvedModel,
        modelConfig,
        this.promptRenderer,
        this.securityGate,
        logger,
      );
      this.agents.set(def.id, harness);

      if (def.role === 'orchestrator') {
        this.orchestratorAgent = harness;
      }
    }

    logger.info({ agentCount: agents.length }, 'orchestrator:initialized');
  }

  async process(messages: AgentMessage[]): Promise<AgentRunResult> {
    if (this.orchestratorAgent) {
      return this.orchestratorAgent.run({ messages });
    }

    const worker = this.findFirstByRole('worker') ?? this.findFirstByRole('manager');
    if (!worker) {
      throw new Error('No agents available for processing');
    }

    return worker.run({ messages });
  }

  async runAgent(
    agentId: string,
    messages: AgentMessage[],
    systemPromptVars?: Record<string, string>,
  ): Promise<AgentRunResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    return agent.run({ messages, systemPromptVars });
  }

  getAgent(agentId: string): AgentHarness | undefined {
    return this.agents.get(agentId);
  }

  listAgents(): AgentHarness[] {
    return [...this.agents.values()];
  }

  /**
   * Phase 5.3 — LangGraph StateGraph 기반 멀티에이전트 처리.
   *
   * `process()`의 LangGraph 버전. 내부적으로 기본 5-노드 그래프를 빌드하고
   * 사용자 메시지를 Supervisor → Manager/Worker/Profiler 파이프라인으로 라우팅.
   *
   * @param userMessage 사용자 메시지 텍스트
   * @param threadId 대화 스레드 ID (체크포인터 키)
   * @returns 최종 assistant 응답 텍스트
   */
  async processWithGraph(
    userMessage: string,
    threadId: string,
  ): Promise<{ response: string; state: AgentState }> {
    if (!this.chatModel) {
      throw new Error('ChatModel not initialized');
    }

    // Lazy init — 첫 호출 시 그래프 빌드
    if (!this.langGraphApp) {
      const checkpointer = await createCheckpointer({ type: 'memory' });
      this.langGraphApp = buildDefaultGraph(this.chatModel, checkpointer);
    }

    const callbacks = CallbackHandlerRegistry.createAutoAttachHandlers();
    const config = { configurable: { thread_id: threadId }, callbacks };

    const result = await this.langGraphApp.invoke(
      { messages: [new HumanMessage(userMessage)] },
      config,
    );

    // 마지막 AI 메시지에서 응답 추출
    const messages = result.messages ?? [];
    let response = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg._getType?.() === 'ai' || (msg as any).role === 'assistant') {
        response = typeof msg.content === 'string' ? msg.content : '';
        break;
      }
    }

    return { response, state: result };
  }

  /**
   * Phase 5.3 — LangGraph 스트리밍 버전.
   * 토큰 단위로 콜백을 호출.
   */
  async *streamWithGraph(
    userMessage: string,
    threadId: string,
  ): AsyncGenerator<{ type: 'token' | 'state'; data: string | AgentState }> {
    if (!this.chatModel) {
      throw new Error('ChatModel not initialized');
    }

    if (!this.langGraphApp) {
      const checkpointer = await createCheckpointer({ type: 'memory' });
      this.langGraphApp = buildDefaultGraph(this.chatModel, checkpointer);
    }

    const callbacks = CallbackHandlerRegistry.createAutoAttachHandlers();
    const config = { configurable: { thread_id: threadId }, callbacks };

    const stream = await this.langGraphApp.stream(
      { messages: [new HumanMessage(userMessage)] },
      { ...config, streamMode: 'updates' },
    );

    for await (const update of stream) {
      // 각 노드 업데이트에서 메시지 추출
      for (const [_nodeName, nodeOutput] of Object.entries(update)) {
        const output = nodeOutput as any;
        if (output?.messages) {
          for (const msg of output.messages) {
            const content = typeof msg.content === 'string' ? msg.content : '';
            if (content) {
              yield { type: 'token', data: content };
            }
          }
        }
      }
    }
  }

  private findFirstByRole(role: string): AgentHarness | undefined {
    for (const agent of this.agents.values()) {
      if (agent.role === role) return agent;
    }
    return undefined;
  }
}
