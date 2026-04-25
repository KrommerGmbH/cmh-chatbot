import type { PromptTemplate, PromptStore } from '../types/index.js';
import type { Logger } from '../core/logger.js';
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts';
import type { BaseMessage } from '@langchain/core/messages';

/**
 * Renders prompt templates by replacing {{variable}} placeholders.
 * Fetches templates from the host-provided PromptStore.
 *
 * Phase 3.5 — LangChain ChatPromptTemplate 지원 추가.
 * 기존 string interpolation은 하위호환을 위해 유지.
 */
export class PromptRenderer {
  constructor(
    private readonly store: PromptStore,
    private readonly logger: Logger,
  ) {}

  /**
   * Render a prompt template with given variables (legacy — string 반환).
   */
  async render(
    templateId: string,
    variables: Record<string, string>,
  ): Promise<string> {
    const template = await this.store.getTemplate(templateId);
    if (!template) {
      throw new Error(`Prompt template not found: ${templateId}`);
    }

    return this.interpolate(template.systemPrompt, variables);
  }

  /**
   * Render a raw template string (no store lookup).
   */
  renderString(template: string, variables: Record<string, string>): string {
    return this.interpolate(template, variables);
  }

  /**
   * Phase 3.5 — LangChain ChatPromptTemplate 기반 렌더링.
   * 스토어에서 템플릿을 가져와 LangChain 메시지 배열로 변환.
   *
   * 변수 치환은 LangChain의 {variable} 문법 사용.
   * (기존 {{variable}} → {variable} 변환 후 LangChain에 전달)
   */
  async renderAsMessages(
    templateId: string,
    variables: Record<string, string>,
    userMessage?: string,
  ): Promise<BaseMessage[]> {
    const template = await this.store.getTemplate(templateId);
    if (!template) {
      throw new Error(`Prompt template not found: ${templateId}`);
    }

    // {{variable}} → {variable} (LangChain 문법)
    const lcTemplate = template.systemPrompt.replace(/\{\{(\w+)\}\}/g, '{$1}');

    const promptParts: [string, string][] = [
      ['system', lcTemplate],
    ];
    if (userMessage) {
      promptParts.push(['human', '{userMessage}']);
    }

    const chatPrompt = ChatPromptTemplate.fromMessages(
      promptParts.map(([role, tmpl]) => {
        if (role === 'system') return SystemMessagePromptTemplate.fromTemplate(tmpl);
        return HumanMessagePromptTemplate.fromTemplate(tmpl);
      }),
    );

    const allVars = userMessage
      ? { ...variables, userMessage }
      : { ...variables };

    return chatPrompt.formatMessages(allVars);
  }

  /**
   * List all available template IDs.
   */
  async listTemplates(): Promise<PromptTemplate[]> {
    return this.store.listTemplates();
  }

  private interpolate(
    template: string,
    variables: Record<string, string>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      if (key in variables) {
        return variables[key];
      }
      this.logger.warn({ key, template: template.slice(0, 50) }, 'prompt:missing-variable');
      return match; // Keep unresolved placeholder
    });
  }
}
