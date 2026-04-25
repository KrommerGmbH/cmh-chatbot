import IORedis from 'ioredis';
import type { RedisConfig } from '../types/index.js';

/**
 * Create an IORedis connection from config.
 * Shared between QueueManager and Worker.
 */
export function createRedisConnection(config: RedisConfig): IORedis {
  return new IORedis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    maxRetriesPerRequest: null, // Required by BullMQ
    lazyConnect: true,
  });
}
