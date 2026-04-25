import { Queue, type JobsOptions } from 'bullmq';
import type { RedisConfig, InferenceJob } from '../types/index.js';
import { QueueError } from '../types/errors.js';
import type { Logger } from '../core/logger.js';
import { createRedisConnection } from './connection.js';

const QUEUE_NAME = 'cmh-inference';

/**
 * BullMQ Queue Manager — registers inference jobs.
 */
export class QueueManager {
  private queue: Queue | null = null;

  constructor(
    private readonly config: RedisConfig,
    private readonly logger: Logger,
  ) {}

  async init(): Promise<void> {
    try {
      const connection = createRedisConnection(this.config);
      this.queue = new Queue(QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      });

      // Verify connection
      await this.queue.waitUntilReady();
      this.logger.info('BullMQ queue connected');
    } catch (error) {
      throw new QueueError(
        `Failed to initialize queue: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * Add an inference job to the queue.
   */
  async addJob(
    job: InferenceJob,
    options?: Partial<JobsOptions>,
  ): Promise<string> {
    if (!this.queue) throw new QueueError('Queue not initialized');

    const added = await this.queue.add(
      'inference',
      job,
      {
        priority: job.priority ?? 0,
        ...options,
      },
    );

    this.logger.debug({ jobId: added.id, priority: job.priority }, 'job:added');
    return added.id!;
  }

  /**
   * Get the current queue size (waiting + active).
   */
  async getJobCounts(): Promise<{ waiting: number; active: number; completed: number; failed: number }> {
    if (!this.queue) throw new QueueError('Queue not initialized');
    const counts = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed');
    return {
      waiting: counts['waiting'] ?? 0,
      active: counts['active'] ?? 0,
      completed: counts['completed'] ?? 0,
      failed: counts['failed'] ?? 0,
    };
  }

  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
      this.logger.info('BullMQ queue closed');
    }
  }
}
