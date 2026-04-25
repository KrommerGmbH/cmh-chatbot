// ─── Scheduler Service ───────────────────────────────────
// Phase 7 — cronJob 기반 스케줄링.
// DAL에서 스케줄 로드 → node-cron으로 실행 → Orchestration Layer 호출.

import * as cron from 'node-cron';
import type { Logger } from '../core/logger.js';
import type { ModelFactory } from '../provider/model-factory.js';
import { createAISdkModel } from '../provider/ai-sdk-factory.js';
import { generateText } from 'ai';

export interface ScheduledTask {
  id: string;
  /** cron 표현식 (예: '0 9 * * *' = 매일 09:00) */
  cronExpression: string;
  /** 시스템 프롬프트 */
  systemPrompt: string;
  /** 사용자 프롬프트 (실행할 작업 내용) */
  userPrompt: string;
  /** 사용할 모델 ID */
  modelId?: string;
  /** 활성 여부 */
  isActive: boolean;
  /** 결과 콜백 (이메일 전송, 파일 저장 등) */
  callbackType?: 'log' | 'webhook' | 'email';
  callbackTarget?: string;
}

export interface SchedulerConfig {
  modelFactory: ModelFactory;
  logger: Logger;
  /** 기본 모델 ID (태스크에 modelId 미지정 시) */
  defaultModelId?: string;
  /** 결과 핸들러 */
  onResult?: (taskId: string, result: string) => Promise<void>;
}

/**
 * cron 기반 LLM 스케줄러.
 * 등록된 태스크를 cron 표현식에 따라 자동 실행.
 */
export class Scheduler {
  private readonly tasks = new Map<string, cron.ScheduledTask>();
  private readonly config: SchedulerConfig;

  constructor(config: SchedulerConfig) {
    this.config = config;
  }

  /**
   * 태스크 등록 및 스케줄 시작.
   */
  register(task: ScheduledTask): void {
    // 기존 동일 ID 태스크 해제
    this.unregister(task.id);

    if (!task.isActive) return;
    if (!cron.validate(task.cronExpression)) {
      this.config.logger.warn({ taskId: task.id, cron: task.cronExpression }, 'scheduler:invalid-cron');
      return;
    }

    const scheduled = cron.schedule(task.cronExpression, () => {
      this.executeTask(task).catch((err) => {
        this.config.logger.error({ taskId: task.id, error: err }, 'scheduler:task-error');
      });
    });

    this.tasks.set(task.id, scheduled);
    this.config.logger.info({ taskId: task.id, cron: task.cronExpression }, 'scheduler:registered');
  }

  /**
   * 태스크 등록 해제.
   */
  unregister(taskId: string): void {
    const existing = this.tasks.get(taskId);
    if (existing) {
      existing.stop();
      this.tasks.delete(taskId);
    }
  }

  /**
   * 모든 태스크 중지 (graceful shutdown).
   */
  stopAll(): void {
    for (const [id, task] of this.tasks) {
      task.stop();
      this.config.logger.info({ taskId: id }, 'scheduler:stopped');
    }
    this.tasks.clear();
  }

  /**
   * 태스크 수동 실행 (테스트/디버그용).
   */
  async executeTask(task: ScheduledTask): Promise<string> {
    this.config.logger.info({ taskId: task.id }, 'scheduler:executing');

    const resolved = await this.config.modelFactory.resolve(
      task.modelId ?? this.config.defaultModelId,
    );

    if (!resolved) {
      throw new Error(`Model not found: ${task.modelId}`);
    }

    const model = createAISdkModel(resolved);

    const result = await generateText({
      model,
      system: task.systemPrompt,
      messages: [{ role: 'user', content: task.userPrompt }],
      maxOutputTokens: 4096,
    });

    this.config.logger.info(
      { taskId: task.id, tokens: result.usage?.totalTokens },
      'scheduler:complete',
    );

    // 결과 핸들러 호출
    if (this.config.onResult) {
      await this.config.onResult(task.id, result.text);
    }

    return result.text;
  }

  /**
   * 현재 등록된 태스크 수.
   */
  get size(): number {
    return this.tasks.size;
  }
}
