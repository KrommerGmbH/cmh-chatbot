import { Worker, type Job } from 'bullmq';
import type { RedisConfig, InferenceJob, InferenceResult, LlamaModelConfig } from '../types/index.js';
import type { Logger } from '../core/logger.js';
import { createRedisConnection } from './connection.js';

const QUEUE_NAME = 'cmh-inference';

export interface WorkerCallbacks {
  onCompleted?: (jobId: string, result: InferenceResult) => void;
  onFailed?: (jobId: string, error: Error) => void;
}

/**
 * BullMQ Worker — consumes inference jobs from the queue.
 * Calls llama-server's OpenAI-compatible API for inference.
 */
export class InferenceWorker {
  private worker: Worker | null = null;

  constructor(
    private readonly redisConfig: RedisConfig,
    private readonly llamaServerUrl: string,
    private readonly modelConfig: LlamaModelConfig,
    private readonly logger: Logger,
    private readonly callbacks?: WorkerCallbacks,
  ) {}

  async start(concurrency: number = 1): Promise<void> {
    const connection = createRedisConnection(this.redisConfig);

    this.worker = new Worker<InferenceJob, InferenceResult>(
      QUEUE_NAME,
      async (job: Job<InferenceJob>) => {
        this.logger.info({ jobId: job.id }, 'worker:processing');

        const messages = job.data.system
          ? [{ role: 'system', content: job.data.system }, ...job.data.messages]
          : this.modelConfig.systemPrompt
            ? [{ role: 'system', content: this.modelConfig.systemPrompt }, ...job.data.messages]
            : job.data.messages;

        const response = await fetch(`${this.llamaServerUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            max_tokens: this.modelConfig.maxTokens ?? 2048,
            temperature: this.modelConfig.temperature ?? 0.7,
            stream: false,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`llama-server error (${response.status}): ${errText}`);
        }

        const data = (await response.json()) as any;
        const text = data.choices?.[0]?.message?.content ?? '';

        return {
          text,
          finishReason: data.choices?.[0]?.finish_reason ?? 'stop',
          usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
              }
            : undefined,
        };
      },
      {
        connection,
        concurrency,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    );

    this.worker.on('completed', (job, result) => {
      this.logger.info({ jobId: job.id }, 'worker:completed');
      this.callbacks?.onCompleted?.(job.id!, result);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error({ jobId: job?.id, error: error.message }, 'worker:failed');
      if (job) this.callbacks?.onFailed?.(job.id!, error);
    });

    await this.worker.waitUntilReady();
    this.logger.info({ concurrency }, 'BullMQ worker started');
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      this.logger.info('BullMQ worker stopped');
    }
  }
}
