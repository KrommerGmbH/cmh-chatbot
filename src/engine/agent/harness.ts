import type { AgentDefinition, SecurityAction, LlamaModelConfig } from '../types/index.js';
import type { Logger } from '../core/logger.js';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { SecurityGate } from './security-gate.js';
import { PromptRenderer } from './prompt-renderer.js';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentRunOptions {
  messages: AgentMessage[];
  systemPromptVars?: Record<string, string>;
  maxTurns?: number;
}

export interface AgentRunResult {
  agentId: string;
  response: string;
  thinking?: string;
  turns: number;
}

/**
 * Agent Harness — wraps a single agent definition,
 * resolves its prompt, enforces security, and runs inference.
 *
 * Phase 3.4 — LangChain BaseChatModel.invoke() 기반으로 전환.
 * 더 이상 llama-server에 직접 fetch 하지 않고, 주입받은 chatModel을 사용.
 */
export class AgentHarness {
  constructor(
    private readonly definition: AgentDefinition,
    private readonly chatModel: BaseChatModel,
    private readonly modelConfig: LlamaModelConfig,
    private readonly promptRenderer: PromptRenderer | null,
    private readonly securityGate: SecurityGate | null,
    private readonly logger: Logger,
  ) {}

  get id(): string {
    return this.definition.id;
  }

  get name(): string {
    return this.definition.name;
  }

  get role(): string {
    return this.definition.role;
  }

  /**
   * Run the agent with given messages — LangChain invoke() 기반.
   */
  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const { messages, systemPromptVars = {} } = options;

    // Resolve system prompt
    let systemPrompt: string | undefined;
    if (this.promptRenderer && this.definition.promptTemplateId) {
      systemPrompt = await this.promptRenderer.render(
        this.definition.promptTemplateId,
        {
          agentName: this.definition.name,
          agentRole: this.definition.role,
          ...systemPromptVars,
        },
      );
    }

    // Security check
    if (this.securityGate) {
      const action: SecurityAction = {
        type: 'inference',
        agentId: this.definition.id,
        agentName: this.definition.name,
        action: 'run',
        description: `Agent ${this.definition.name} processing ${messages.length} messages`,
        securityLevel: this.definition.securityLevel,
      };

      const approved = await this.securityGate.validate(action);
      if (!approved) {
        return {
          agentId: this.definition.id,
          response: '[Action denied by security gate]',
          turns: 0,
        };
      }
    }

    // Build LangChain message list
    const langchainMessages = [];
    if (systemPrompt) {
      langchainMessages.push(new SystemMessage(systemPrompt));
    } else if (this.modelConfig.systemPrompt) {
      langchainMessages.push(new SystemMessage(this.modelConfig.systemPrompt));
    }
    for (const msg of messages) {
      if (msg.role === 'user') langchainMessages.push(new HumanMessage(msg.content));
      else if (msg.role === 'assistant') langchainMessages.push(new AIMessage(msg.content));
      else if (msg.role === 'system') langchainMessages.push(new SystemMessage(msg.content));
    }

    // LangChain invoke — BaseChatModel 호출
    const response = await this.chatModel.invoke(langchainMessages);
    const text = typeof response.content === 'string'
      ? response.content
      : '';

    this.logger.info({ agentId: this.definition.id }, 'agent:run-complete');

    return {
      agentId: this.definition.id,
      response: text,
      turns: 1,
    };
  }
}
