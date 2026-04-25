import type { HealthStatus } from '../types/index.js';
import type { QueueManager } from '../queue/manager.js';

/**
 * Build health status object.
 */
export async function getHealthStatus(
  queue: QueueManager | null,
  startedAt: Date,
): Promise<HealthStatus> {
  const uptimeMs = Date.now() - startedAt.getTime();

  let queueStatus: HealthStatus['queue'] = {
    connected: false,
    jobs: { waiting: 0, active: 0, completed: 0, failed: 0 },
  };

  if (queue) {
    try {
      const counts = await queue.getJobCounts();
      queueStatus = { connected: true, jobs: counts };
    } catch {
      queueStatus = {
        connected: false,
        jobs: { waiting: 0, active: 0, completed: 0, failed: 0 },
      };
    }
  }

  return {
    status: 'ok',
    version: '0.1.0',
    uptime: uptimeMs,
    queue: queueStatus,
  };
}
